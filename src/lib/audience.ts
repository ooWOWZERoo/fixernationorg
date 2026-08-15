import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListRule    { type: "list";          listId: string; label?: string }
export interface RoleRule    { type: "role";          role: string }
export interface TagRule     { type: "tag";           tag: string }
export interface ConsentRule { type: "consent_topic"; topic: string }

export type AudienceRule = ListRule | RoleRule | TagRule | ConsentRule;

export interface AudienceDefinition {
  logic:   "OR" | "AND";
  include: AudienceRule[];
  exclude: AudienceRule[];
}

export interface SuppressionEntry {
  contactId: string;
  reason: "opted_out" | "bounced" | "unsubscribed";
}

export interface AudiencePreview {
  totalIncluded:       number;
  totalSuppressed:     number;
  suppressionBreakdown: { reason: string; count: number }[];
  sample: Array<{ id: string; email: string; firstName: string | null }>;
}

// ─── Rule resolution ──────────────────────────────────────────────────────────

async function resolveRule(rule: AudienceRule): Promise<Set<string>> {
  switch (rule.type) {
    case "list": {
      const rows = await db.contactListMember.findMany({
        where: { listId: rule.listId },
        select: { contactId: true },
      });
      return new Set(rows.map((r) => r.contactId));
    }
    case "role": {
      const users = await db.user.findMany({
        where: { role: rule.role as never },
        select: { id: true },
      });
      if (users.length === 0) return new Set();
      const contacts = await db.contact.findMany({
        where: { userId: { in: users.map((u) => u.id) } },
        select: { id: true },
      });
      return new Set(contacts.map((c) => c.id));
    }
    case "tag": {
      const rows = await db.contactTag.findMany({
        where: { tag: rule.tag },
        select: { contactId: true },
      });
      return new Set(rows.map((r) => r.contactId));
    }
    case "consent_topic": {
      const rows = await db.contactConsent.findMany({
        where: { topic: rule.topic as never, optedIn: true },
        select: { contactId: true },
      });
      return new Set(rows.map((r) => r.contactId));
    }
  }
}

// ─── Core resolution ──────────────────────────────────────────────────────────

export async function resolveAudience(def: AudienceDefinition): Promise<{
  includedIds: string[];
  suppressed: SuppressionEntry[];
}> {
  // 1. Resolve and combine include rules
  let included: Set<string>;
  if (def.include.length === 0) {
    included = new Set();
  } else {
    const sets = await Promise.all(def.include.map(resolveRule));
    if (def.logic === "AND") {
      included = sets.reduce((a, b) => new Set([...a].filter((x) => b.has(x))));
    } else {
      included = new Set(sets.flatMap((s) => [...s]));
    }
  }

  // 2. Subtract exclude rules
  if (def.exclude.length > 0) {
    const excludeSets = await Promise.all(def.exclude.map(resolveRule));
    for (const set of excludeSets) {
      for (const id of set) included.delete(id);
    }
  }

  const suppressed: SuppressionEntry[] = [];
  if (included.size === 0) return { includedIds: [], suppressed: [] };

  const includedArr = [...included];

  // 3a. Suppress: opted out of CAMPAIGNS
  const optedOut = await db.contactConsent.findMany({
    where: { contactId: { in: includedArr }, topic: "CAMPAIGNS", optedIn: false },
    select: { contactId: true },
  });
  for (const { contactId } of optedOut) {
    included.delete(contactId);
    suppressed.push({ contactId, reason: "opted_out" });
  }

  // 3b. Suppress: previous bounce or unsubscribe
  if (included.size > 0) {
    const bounced = await db.campaignSend.findMany({
      where: {
        contactId: { in: [...included] },
        status: { in: ["BOUNCED", "UNSUBSCRIBED"] as never },
      },
      select: { contactId: true, status: true },
      distinct: ["contactId"],
    });
    for (const { contactId, status } of bounced) {
      if (included.has(contactId)) {
        included.delete(contactId);
        suppressed.push({
          contactId,
          reason: status === "BOUNCED" ? "bounced" : "unsubscribed",
        });
      }
    }
  }

  return { includedIds: [...included], suppressed };
}

// ─── Preview (with contact sample) ───────────────────────────────────────────

export async function previewAudience(def: AudienceDefinition): Promise<AudiencePreview> {
  const { includedIds, suppressed } = await resolveAudience(def);

  const reasons: Record<string, number> = {};
  for (const s of suppressed) {
    reasons[s.reason] = (reasons[s.reason] ?? 0) + 1;
  }

  const sampleIds = includedIds.slice(0, 5);
  const sample =
    sampleIds.length > 0
      ? await db.contact.findMany({
          where: { id: { in: sampleIds } },
          select: { id: true, email: true, firstName: true },
        })
      : [];

  return {
    totalIncluded: includedIds.length,
    totalSuppressed: suppressed.length,
    suppressionBreakdown: Object.entries(reasons).map(([reason, count]) => ({ reason, count })),
    sample,
  };
}
