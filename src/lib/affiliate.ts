import { db } from "@/lib/db";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randChars(n: number): string {
  let s = "";
  for (let i = 0; i < n; i++) s += CHARS[Math.floor(Math.random() * CHARS.length)];
  return s;
}

function slugFromName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return randChars(4);
  // first letter of first name + first 3 letters of last name (if exists)
  const first = parts[0].slice(0, 1).toUpperCase();
  const last = parts.length > 1 ? parts[parts.length - 1].slice(0, 3).toUpperCase() : parts[0].slice(1, 4).toUpperCase();
  return (first + last).replace(/[^A-Z0-9]/g, "").slice(0, 4).padEnd(4, randChars(1));
}

export async function generateUniquePromoCode(affiliateName?: string | null): Promise<string> {
  const slug = slugFromName(affiliateName);
  for (let i = 0; i < 10; i++) {
    const suffix = randChars(4);
    const code = `FN-${slug}-${suffix}`;
    const existing = await db.promoCode.findUnique({ where: { code } });
    if (!existing) return code;
  }
  return `FN-${randChars(4)}-${randChars(4)}`;
}

export async function provisionAffiliate({
  userId,
  applicationId,
  affiliateType,
  assignedBy,
}: {
  userId: string;
  applicationId: string;
  affiliateType: "AMBASSADOR" | "PROVIDER";
  assignedBy: string;
}) {
  // Idempotent — return existing if already provisioned for this application
  const existing = await db.affiliateAssignment.findUnique({
    where: { applicationId },
  });
  if (existing) return existing;

  return db.affiliateAssignment.create({
    data: {
      userId,
      applicationId,
      affiliateType,
      status: "PENDING",
      assignedBy,
    },
  });
}
