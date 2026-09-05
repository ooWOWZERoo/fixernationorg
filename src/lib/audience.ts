import { db } from "@/lib/db";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ListRule        { type: "list";          listId: string; label?: string }
export interface RoleRule        { type: "role";          role: string }
export interface TagRule         { type: "tag";           tag: string }
export interface ConsentRule     { type: "consent_topic"; topic: string }
export interface GroupRule       { type: "group";         groupId: string; label?: string }
export interface EventRsvpRule   { type: "event_rsvp";   eventId: string; label?: string }
export interface CustomFieldRule {
  type: "custom_field";
  fieldId: string;
  fieldLabel?: string;
  op: "eq" | "ne" | "contains" | "set" | "not_set";
  value?: string;
}

export type AudienceRule = ListRule | RoleRule | TagRule | ConsentRule | GroupRule | EventRsvpRule | CustomFieldRule;

export interface AudienceDefinition {
  logic:   "OR" | "AND";
  include: AudienceRule[];
  exclude: AudienceRule[];
}

export interface SuppressionEntry {
  contactId: string;
  reason: "opted_out" | "bounced" | "unsubscribed" | "test_contact";
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
      const list = await db.contactList.findUnique({ where: { id: rule.listId }, select: { ownerType: true } });
      // AC-066/067: Never use ambassador- or provider-owned lists for FN campaign sends
      if (!list || list.ownerType !== "FN_ADMIN") return new Set();
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
    case "group": {
      const members = await db.groupMember.findMany({
        where: { groupId: rule.groupId },
        select: { userId: true },
      });
      if (members.length === 0) return new Set();
      const contacts = await db.contact.findMany({
        where: { userId: { in: members.map((m) => m.userId) } },
        select: { id: true },
      });
      return new Set(contacts.map((c) => c.id));
    }
    case "event_rsvp": {
      const rsvps = await db.eventRsvp.findMany({
        where: { eventId: rule.eventId, status: { in: ["REGISTERED", "WAITLISTED"] as never } },
        select: { userId: true },
      });
      if (rsvps.length === 0) return new Set();
      const contacts = await db.contact.findMany({
        where: { userId: { in: rsvps.map((r) => r.userId) } },
        select: { id: true },
      });
      return new Set(contacts.map((c) => c.id));
    }
    case "custom_field": {
      const cfvDb = db as never as {
        customFieldValue: { findMany: (a: unknown) => Promise<{ contactId: string }[]> };
        contact: { findMany: (a: unknown) => Promise<{ id: string }[]> };
      };
      if (rule.op === "set") {
        const rows = await cfvDb.customFieldValue.findMany({
          where: { fieldId: rule.fieldId } as never,
          select: { contactId: true } as never,
        });
        return new Set(rows.map((r) => r.contactId));
      }
      if (rule.op === "not_set") {
        const [hasField, allContacts] = await Promise.all([
          cfvDb.customFieldValue.findMany({ where: { fieldId: rule.fieldId } as never, select: { contactId: true } as never }),
          db.contact.findMany({ select: { id: true } }),
        ]);
        const hasSet = new Set(hasField.map((r) => r.contactId));
        return new Set(allContacts.map((c) => c.id).filter((id) => !hasSet.has(id)));
      }
      if (!rule.value) return new Set();
      const whereValue =
        rule.op === "eq"       ? rule.value :
        rule.op === "ne"       ? ({ not: rule.value } as never) :
        ({ contains: rule.value, mode: "insensitive" } as never);
      const rows = await cfvDb.customFieldValue.findMany({
        where: { fieldId: rule.fieldId, value: whereValue } as never,
        select: { contactId: true } as never,
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

  // 3c. Suppress: QA/e2e test fixture contacts (never real recipients, regardless
  // of their consent/list/tag state — e2e specs create real Contact rows with
  // these patterns and a leftover one caused a real production bounce storm)
  if (included.size > 0) {
    const testContacts = await db.contact.findMany({
      where: {
        id: { in: [...included] },
        OR: [
          { email: { endsWith: "@example.com" } },
          { AND: [{ email: { startsWith: "qa-" } }, { email: { endsWith: "@fixernation.org" } }] },
        ],
      },
      select: { id: true },
    });
    for (const { id } of testContacts) {
      included.delete(id);
      suppressed.push({ contactId: id, reason: "test_contact" });
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
