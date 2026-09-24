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
  affiliateType: "AMBASSADOR" | "PROVIDER" | "AFFILIATE";
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

// SP-71 — read-only self-service snapshot (promo codes, territory, commission
// rate) for the account pages of any affiliate-capable role.
export async function getAffiliateAccountSnapshot(userId: string) {
  // A user can end up with more than one AffiliateAssignment (e.g. an old
  // Ambassador application plus a later standalone Affiliate application) --
  // prefer their ACTIVE one, falling back to the most recent, rather than an
  // arbitrary unordered row. Mirrors src/pages/api/account/commissions.ts.
  const assignment =
    (await db.affiliateAssignment.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    })) ??
    (await db.affiliateAssignment.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }));

  if (!assignment) {
    return { assignment: null, promoCodes: [], territoryAssignments: [], commissionRules: [] };
  }

  const [promoCodes, commissionRules, territoryAssignments] = await Promise.all([
    db.promoCode.findMany({
      where: { affiliateId: assignment.id },
      orderBy: { createdAt: "desc" },
    }),
    db.commissionRule.findMany({
      where: { affiliateId: assignment.id },
      orderBy: { createdAt: "desc" },
    }),
    // TerritoryAssignment has no relation to AffiliateAssignment -- it links
    // straight to User -- so this is looked up by userId, not affiliateId.
    db.territoryAssignment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { territory: true },
    }),
  ]);

  return { assignment, promoCodes, territoryAssignments, commissionRules };
}
