import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ApplicationEventType =
  | "STATUS_CHANGED"
  | "EMAIL_SENT"
  | "INVITE_SENT"
  | "INVITE_RESENT"
  | "INVITE_REVOKED"
  | "TERRITORY_ASSIGNED"
  | "TERRITORY_REVOKED"
  | "AFFILIATE_PROVISIONED"
  | "ACCOUNT_CREATED"
  | "FIELDS_EDITED"
  | "PAYMENT_LINK_SENT"
  | "PAYMENT_RECEIVED"
  | "PAYMENT_LINK_EXPIRED";

export async function recordEvent(
  applicationId: string,
  type: ApplicationEventType,
  actor: string | null | undefined,
  meta?: Record<string, unknown>
): Promise<void> {
  await db.applicationEvent.create({
    data: {
      applicationId,
      type,
      actor: actor ?? null,
      meta: (meta ?? {}) as Prisma.InputJsonValue,
    },
  });
}
