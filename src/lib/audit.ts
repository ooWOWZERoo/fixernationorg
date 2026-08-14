import { Prisma } from "@prisma/client";
import { db } from "./db";

interface LogActionOpts {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}

export async function logAction(opts: LogActionOpts): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: opts.actorId ?? null,
        actorEmail: opts.actorEmail ?? null,
        action: opts.action,
        resource: opts.resource,
        resourceId: opts.resourceId ?? null,
        metadata: opts.metadata ? (opts.metadata as Prisma.InputJsonValue) : undefined,
        ip: opts.ip ?? null,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log entry:", err);
  }
}

export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return first?.trim() ?? null;
  }
  return req.socket?.remoteAddress ?? null;
}
