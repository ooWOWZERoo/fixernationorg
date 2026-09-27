import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAction, getClientIp } from "@/lib/audit";
import { recordEvent } from "@/lib/application-events";
import { isUsState, resolveCounty } from "@/lib/us-geo";
import { TERRITORY_ELIGIBLE_ROLES, withTerritoryRequests } from "@/lib/territory-requests";

const bodySchema = z.object({
  requestType: z.enum(["INITIAL", "ADD", "CHANGE"]),
  requestedState: z.string().trim().min(1).max(60),
  requestedCounty: z.string().trim().min(1).max(120),
  existingAssignmentId: z.string().trim().min(1).optional(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) return res.status(401).json({ error: "Unauthorized" });

  // No rate limiting: this endpoint is authenticated and role-gated, not a
  // public/anonymous surface.
  if (!TERRITORY_ELIGIBLE_ROLES.includes(session.user.role)) {
    return res.status(403).json({ error: "Territory requests are for ambassadors, providers and affiliates." });
  }

  const userId = session.user.id;
  const db_ = withTerritoryRequests(db);

  if (req.method === "GET") {
    const requests = await db_.territoryRequest.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.status(200).json(requests);
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }
  const { requestType, existingAssignmentId } = parsed.data;
  const requestedState = parsed.data.requestedState.toUpperCase();

  // The state/county pair is re-validated here against the same reference
  // dataset the dropdowns are built from — the client is never trusted to
  // have sent a real county, and a request for a place that doesn't exist
  // would otherwise create a junk Territory row on approval.
  if (!isUsState(requestedState)) {
    return res.status(400).json({ error: `"${parsed.data.requestedState}" isn't a U.S. state we recognize.` });
  }
  const requestedCounty = resolveCounty(requestedState, parsed.data.requestedCounty);
  if (!requestedCounty) {
    return res.status(400).json({
      error: `We couldn't find "${parsed.data.requestedCounty}" in ${requestedState}. Pick a county from the list.`,
    });
  }

  const activeAssignments = await db.territoryAssignment.findMany({
    where: { userId, status: "ACTIVE" },
    include: { territory: { select: { id: true, name: true, state: true, county: true } } },
  });

  if (requestType === "INITIAL" && activeAssignments.length > 0) {
    return res.status(409).json({
      error: "You already have a territory. Request an additional one, or a change to the one you have.",
    });
  }
  if (requestType === "ADD" && activeAssignments.length === 0) {
    return res.status(409).json({ error: "You don't have a territory yet, so request your first one instead." });
  }

  let existing: (typeof activeAssignments)[number] | undefined;
  if (requestType === "CHANGE") {
    if (!existingAssignmentId) {
      return res.status(400).json({ error: "Tell us which territory you want to change." });
    }
    existing = activeAssignments.find((a) => a.id === existingAssignmentId);
    if (!existing) {
      return res.status(404).json({ error: "We couldn't find that territory on your account." });
    }
  } else if (existingAssignmentId) {
    return res.status(400).json({ error: "Only a change request can name an existing territory." });
  }

  // Asking for somewhere you already hold is a no-op that would also trip the
  // exclusivity check at approval time in a confusing way.
  const alreadyHeld = activeAssignments.some(
    (a) => a.territory.state === requestedState && a.territory.county === requestedCounty
  );
  if (alreadyHeld) {
    return res.status(409).json({ error: `${requestedCounty}, ${requestedState} is already assigned to you.` });
  }

  const duplicate = await db_.territoryRequest.findFirst({
    where: { userId, status: "PENDING", requestedState, requestedCounty },
  });
  if (duplicate) {
    return res.status(409).json({
      error: `You already have a pending request for ${requestedCounty}, ${requestedState}.`,
    });
  }

  // Attach the requester's territory-eligible application when they have one,
  // so the decision lands on the application timeline alongside every other
  // TERRITORY_* event. Self-service requests can exist without one, which is
  // why the column is nullable.
  const application = await db.userApplication.findFirst({
    where: { userId, type: { in: ["AMBASSADOR", "PROVIDER", "AFFILIATE"] } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const created = await db_.territoryRequest.create({
    data: {
      userId,
      applicationId: application?.id ?? null,
      requestType,
      requestedState,
      requestedCounty,
      existingAssignmentId: existing?.id ?? null,
    },
  });

  await logAction({
    actorId: userId,
    actorEmail: session.user.email,
    action: "territory_request.submitted",
    resource: "TerritoryRequest",
    resourceId: created.id,
    metadata: {
      requestType,
      requestedState,
      requestedCounty,
      existingAssignmentId: existing?.id ?? null,
      existingTerritoryName: existing?.territory.name ?? null,
    },
    ip: getClientIp(req),
  });

  if (application?.id) {
    recordEvent(application.id, "TERRITORY_REQUESTED", session.user.email, {
      territoryRequestId: created.id,
      requestType,
      requestedState,
      requestedCounty,
    }).catch((err) => console.error("[events] TERRITORY_REQUESTED record failed:", err));
  }

  // No email on submission by design — the on-page confirmation covers it.
  // Only approve/reject decisions notify the requester.
  return res.status(201).json(created);
}
