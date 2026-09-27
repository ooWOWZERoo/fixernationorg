import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";
import { recordEvent } from "@/lib/application-events";
import { sendTransactionalEmail } from "@/lib/email";
import { loadTemplate } from "@/lib/template-engine";
import {
  buildTerritoryRequestApprovedEmail,
  buildTerritoryRequestRejectedEmail,
} from "@/lib/emails/territory-decision";
import { assertTerritoryAssignable, TerritoryNotAssignableError } from "@/lib/territories";
import {
  resolveOrCreateCountyTerritory,
  withTerritoryRequests,
  type TerritoryRequestRow,
} from "@/lib/territory-requests";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

const bodySchema = z.object({
  action: z.enum(["approve", "reject"]),
  adminNotes: z.string().max(2000).optional(),
});

// Sentinels so a conflict discovered mid-transaction can unwind out of
// db.$transaction and become a 409, without the transaction's return type
// having to carry a failure case.
class AlreadyReviewedError extends Error {}
class StaleChangeError extends Error {}

type RequestWithUser = TerritoryRequestRow & {
  user: { id: string; name: string | null; email: string; role: string };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session || !ADMIN_ROLES.includes(session.user.adminRole)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.method !== "PATCH") {
    res.setHeader("Allow", "PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query as { id: string };
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { action } = parsed.data;
  const adminNotes = parsed.data.adminNotes?.trim() || null;

  const db_ = withTerritoryRequests(db);
  const request = (await db_.territoryRequest.findUnique({
    where: { id },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  })) as RequestWithUser | null;

  if (!request) return res.status(404).json({ error: "Not found" });
  if (request.status !== "PENDING") {
    return res.status(409).json({ error: `This request was already ${request.status.toLowerCase()}.` });
  }

  const reviewer = session.user.email ?? session.user.id;
  const reviewedAt = new Date();

  // ── Reject ────────────────────────────────────────────────────────────────
  // Never touches a TerritoryAssignment: whatever the requester holds today
  // stays exactly as it is.
  if (action === "reject") {
    const claimed = await db_.territoryRequest.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "REJECTED", reviewedBy: reviewer, reviewedAt, adminNotes },
    });
    if (claimed.count === 0) {
      return res.status(409).json({ error: "This request was already reviewed." });
    }

    await logAction({
      actorId: session.user.id,
      actorEmail: session.user.email,
      action: "territory_request.rejected",
      resource: "TerritoryRequest",
      resourceId: id,
      metadata: {
        requestType: request.requestType,
        requestedState: request.requestedState,
        requestedCounty: request.requestedCounty,
        requesterEmail: request.user.email,
        adminNotes,
      },
      ip: getClientIp(req),
    });

    if (request.applicationId) {
      recordEvent(request.applicationId, "TERRITORY_REQUEST_REJECTED", session.user.email, {
        territoryRequestId: id,
        requestedState: request.requestedState,
        requestedCounty: request.requestedCounty,
        adminNotes,
      }).catch((err) => console.error("[events] TERRITORY_REQUEST_REJECTED record failed:", err));
    }

    await notifyDecision(request, "rejected", null, adminNotes, session.user.email);

    return res.status(200).json({ ok: true, status: "REJECTED" });
  }

  // ── Approve ───────────────────────────────────────────────────────────────
  let outcome: {
    territoryId: string;
    territoryName: string;
    territoryCreated: boolean;
    newAssignmentId: string;
    transferredFromId: string | null;
  };

  try {
    outcome = await db.$transaction(async (tx) => {
      const tx_ = withTerritoryRequests(tx);

      // Claim the request first: a second reviewer clicking Approve at the
      // same moment loses here rather than creating a duplicate assignment.
      const claimed = await tx_.territoryRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "APPROVED", reviewedBy: reviewer, reviewedAt, adminNotes },
      });
      if (claimed.count === 0) throw new AlreadyReviewedError();

      const territory = await resolveOrCreateCountyTerritory(
        tx,
        request.requestedState,
        request.requestedCounty
      );

      // Same LOCKED + exclusivity gates the admin's own direct assign runs.
      // A RESERVED territory is deliberately not blocked here — the review UI
      // flags it so the admin decides knowingly.
      await assertTerritoryAssignable(tx, territory);

      const newAssignment = await tx.territoryAssignment.create({
        data: {
          territoryId: territory.id,
          userId: request.userId,
          applicationId: request.applicationId,
          assignedBy: reviewer,
          notes: adminNotes,
        },
      });

      let transferredFromId: string | null = null;
      if (request.requestType === "CHANGE" && request.existingAssignmentId) {
        // Transfer in place — the old row is marked TRANSFERRED and pointed
        // at its replacement. Never REVOKED and never deleted: territory
        // assignment history must never be overwritten.
        const transferred = await tx.territoryAssignment.updateMany({
          where: { id: request.existingAssignmentId, status: "ACTIVE" },
          data: { status: "TRANSFERRED", transferredTo: newAssignment.id },
        });
        if (transferred.count === 0) throw new StaleChangeError();
        transferredFromId = request.existingAssignmentId;
      }

      return {
        territoryId: territory.id,
        territoryName: territory.name,
        territoryCreated: territory.created,
        newAssignmentId: newAssignment.id,
        transferredFromId,
      };
    });
  } catch (err) {
    if (err instanceof AlreadyReviewedError) {
      return res.status(409).json({ error: "This request was already reviewed." });
    }
    if (err instanceof StaleChangeError) {
      return res.status(409).json({
        error: "The territory this change was based on is no longer active. Nothing was changed.",
      });
    }
    if (err instanceof TerritoryNotAssignableError) {
      return res.status(409).json({ error: err.message });
    }
    throw err;
  }

  await logAction({
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "territory_request.approved",
    resource: "TerritoryRequest",
    resourceId: id,
    metadata: {
      requestType: request.requestType,
      requestedState: request.requestedState,
      requestedCounty: request.requestedCounty,
      requesterEmail: request.user.email,
      territoryId: outcome.territoryId,
      territoryName: outcome.territoryName,
      territoryCreated: outcome.territoryCreated,
      assignmentId: outcome.newAssignmentId,
      transferredFromAssignmentId: outcome.transferredFromId,
      adminNotes,
    },
    ip: getClientIp(req),
  });

  if (request.applicationId) {
    recordEvent(request.applicationId, "TERRITORY_REQUEST_APPROVED", session.user.email, {
      territoryRequestId: id,
      requestType: request.requestType,
      territoryId: outcome.territoryId,
      territoryName: outcome.territoryName,
      assignmentId: outcome.newAssignmentId,
      transferredFromAssignmentId: outcome.transferredFromId,
    }).catch((err) => console.error("[events] TERRITORY_REQUEST_APPROVED record failed:", err));
  }

  await notifyDecision(request, "approved", outcome.territoryName, adminNotes, session.user.email);

  return res.status(200).json({ ok: true, status: "APPROVED", ...outcome });
}

// MessageTemplate first, hardcoded builder as the fallback — same precedence
// as application status emails. A send failure must never roll back a
// decision that already landed in the database.
async function notifyDecision(
  request: RequestWithUser,
  decision: "approved" | "rejected",
  territoryName: string | null,
  adminNotes: string | null,
  actorEmail: string | null | undefined
): Promise<void> {
  try {
    const key = decision === "approved" ? "territory.request_approved" : "territory.request_rejected";
    const vars = {
      first_name: (request.user.name ?? "").split(" ")[0] || "there",
      state: request.requestedState,
      county: request.requestedCounty,
      territory: territoryName ?? `${request.requestedCounty}, ${request.requestedState}`,
      request_type: request.requestType,
      admin_notes: adminNotes ?? "",
    };

    const email =
      (await loadTemplate(key, vars)) ??
      (decision === "approved"
        ? buildTerritoryRequestApprovedEmail(
            request.user.name,
            request.requestedState,
            request.requestedCounty,
            request.requestType
          )
        : buildTerritoryRequestRejectedEmail(
            request.user.name,
            request.requestedState,
            request.requestedCounty,
            adminNotes
          ));

    await sendTransactionalEmail({ to: request.user.email, ...email });

    if (request.applicationId) {
      recordEvent(request.applicationId, "EMAIL_SENT", actorEmail, {
        template: key,
        subject: email.subject,
        territoryRequestId: request.id,
      }).catch((err) => console.error("[events] EMAIL_SENT record failed:", err));
    }
  } catch (err) {
    console.error(`[territory-request] Failed to send ${decision} email:`, err);
  }
}
