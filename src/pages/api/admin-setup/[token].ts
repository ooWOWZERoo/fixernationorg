import type { NextApiRequest, NextApiResponse } from "next";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const ClaimSchema = z.object({
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(128),
});

type AdminInviteDb = {
  adminInvite: {
    findUnique: (a: unknown) => Promise<{ id: string; email: string; role: string; claimedAt: Date | null; expiresAt: Date } | null>;
    update: (a: unknown) => Promise<unknown>;
  };
};
const inviteDb = db as never as AdminInviteDb;

async function resolveInvite(token: string) {
  const invite = await inviteDb.adminInvite.findUnique({
    where: { token },
    select: { id: true, email: true, role: true, claimedAt: true, expiresAt: true },
  });
  if (!invite) return { error: "INVALID_TOKEN" as const };
  if (invite.claimedAt) return { error: "ALREADY_CLAIMED" as const };
  if (invite.expiresAt < new Date()) return { error: "EXPIRED" as const };
  return { invite };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { token } = req.query as { token: string };

  // ── GET — validate token ─────────────────────────────────────────────────────
  if (req.method === "GET") {
    const result = await resolveInvite(token);
    if (result.error) return res.status(result.error === "INVALID_TOKEN" ? 404 : result.error === "ALREADY_CLAIMED" ? 409 : 410).json({ error: result.error });
    return res.status(200).json({ email: result.invite.email, role: result.invite.role });
  }

  // ── POST — create account ────────────────────────────────────────────────────
  if (req.method === "POST") {
    const result = await resolveInvite(token);
    if (result.error) return res.status(result.error === "INVALID_TOKEN" ? 404 : result.error === "ALREADY_CLAIMED" ? 409 : 410).json({ error: result.error });

    const parsed = ClaimSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
    }

    const { invite } = result;

    const existing = await db.user.findUnique({ where: { email: invite.email }, select: { id: true } });
    if (existing) {
      return res.status(409).json({
        error: "EMAIL_EXISTS",
        message: "An account already exists for this email address. Sign in instead.",
      });
    }

    const { name, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        email: invite.email,
        name: name.trim(),
        passwordHash,
        role: invite.role as import("@prisma/client").UserRole,
        emailVerified: new Date(),
      },
      select: { id: true },
    });

    await inviteDb.adminInvite.update({
      where: { id: invite.id },
      data: { claimedAt: new Date(), claimedById: user.id },
    });

    return res.status(201).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}
