import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { autoJoinGroups } from "@/lib/groups";
import { recordEvent } from "@/lib/application-events";
import { enrollInJourneys } from "@/lib/automation";

const postSchema = z.object({
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(128),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query as { token: string };

  // ── GET — validate token + return applicant info ──────────────────────────────
  if (req.method === "GET") {
    const application = await db.userApplication.findUnique({
      where: { accountInviteToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        status: true,
        userId: true,
        accountInviteExpiresAt: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: "INVALID_TOKEN", message: "This invite link is not valid." });
    }
    if (application.userId) {
      return res.status(409).json({ error: "ALREADY_CLAIMED", message: "This invite has already been used." });
    }
    if (application.accountInviteExpiresAt && application.accountInviteExpiresAt < new Date()) {
      return res.status(410).json({ error: "EXPIRED", message: "This invite link has expired. Contact us to request a new one." });
    }

    return res.status(200).json({
      name: application.name,
      email: application.email,
      type: application.type,
    });
  }

  // ── POST — create account ─────────────────────────────────────────────────────
  if (req.method === "POST") {
    const parsed = postSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    }

    const application = await db.userApplication.findUnique({
      where: { accountInviteToken: token },
      select: {
        id: true,
        name: true,
        email: true,
        type: true,
        status: true,
        userId: true,
        accountInviteExpiresAt: true,
      },
    });

    if (!application) {
      return res.status(404).json({ error: "INVALID_TOKEN", message: "This invite link is not valid." });
    }
    if (application.userId) {
      return res.status(409).json({ error: "ALREADY_CLAIMED", message: "This invite has already been used." });
    }
    if (application.accountInviteExpiresAt && application.accountInviteExpiresAt < new Date()) {
      return res.status(410).json({ error: "EXPIRED", message: "This invite link has expired. Contact us to request a new one." });
    }

    // Check for an existing account with this email
    const existing = await db.user.findUnique({
      where: { email: application.email },
      select: { id: true },
    });
    if (existing) {
      // Account already exists — just link it to the application
      await db.userApplication.update({
        where: { id: application.id },
        data: {
          userId: existing.id,
          accountInviteToken: null,
          accountInviteExpiresAt: null,
        },
      });
      return res.status(200).json({ ok: true, linked: true });
    }

    const { name, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);
    const newRole = application.type === "PROVIDER" ? "PROVIDER"
      : application.type === "AMBASSADOR" ? "AMBASSADOR"
      : "MEMBER";

    const user = await db.user.create({
      data: {
        email: application.email,
        name: name.trim(),
        passwordHash,
        role: newRole as "PROVIDER" | "AMBASSADOR" | "MEMBER",
        emailVerified: new Date(),
      },
      select: { id: true },
    });

    await db.userApplication.update({
      where: { id: application.id },
      data: {
        userId: user.id,
        accountInviteToken: null,
        accountInviteExpiresAt: null,
      },
    });

    recordEvent(application.id, "ACCOUNT_CREATED", null, {
      userId: user.id,
      role: newRole,
    }).catch((err) => console.error("[events] ACCOUNT_CREATED record failed:", err));

    // Auto-join role-based groups and fire automation triggers
    try {
      await autoJoinGroups(user.id, newRole);
    } catch (err) {
      console.error("[invite] autoJoinGroups failed:", err);
    }

    // SIGNUP fires first (new account), then ROLE_CHANGE for the specific role granted
    enrollInJourneys({ trigger: "SIGNUP", userId: user.id }).catch(() => {});
    enrollInJourneys({ trigger: "ROLE_CHANGE", userId: user.id, triggerConfig: { role: newRole } }).catch(() => {});

    return res.status(201).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
