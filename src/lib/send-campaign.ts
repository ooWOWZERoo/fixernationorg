import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildCampaignEmail } from "@/lib/campaign-email";
import { resolveAudience, type AudienceDefinition } from "@/lib/audience";
import { webpush } from "@/lib/web-push";

// Extracted from the admin "send now" API route so the cron-driven paths
// (one-time SCHEDULED campaigns, recurring campaign occurrences) reuse the
// same, correct, full-featured send logic instead of a divergent
// reimplementation — the previous cron-only version only supported the
// legacy listId audience path and silently skipped any campaign using
// rule-based audienceRules.

type SupDb = {
  suppressionRecord: {
    findMany: (a: unknown) => Promise<{ email: string }[]>;
  };
};

type VarDb = {
  campaignVariant: {
    findMany: (a: unknown) => Promise<{
      id: string; name: string; subject: string; fromName: string;
      fromEmail: string; htmlBody: string | null; textBody: string | null; splitPct: number;
    }[]>;
  };
};

type AbSendDb = {
  campaignSend: {
    createMany: (a: unknown) => Promise<{ count: number }>;
    findMany: (a: unknown) => Promise<{ id: string; contactId: string; variantId: string | null }[]>;
    update: (a: unknown) => Promise<unknown>;
  };
};

type PushDb = {
  pushSubscription: {
    findMany: (a: unknown) => Promise<{ id: string; userId: string; endpoint: string; p256dhKey: string; authKey: string }[]>;
  };
  contact: {
    findMany: (a: unknown) => Promise<{ id: string; userId: string | null }[]>;
  };
};

type EmailContent = { subject: string; fromName: string; fromEmail: string; htmlBody: string | null; textBody: string | null };

// A single serverless invocation can't reliably finish sending a
// large-audience campaign (thousands of contacts, ~20 at a time) before the
// platform's execution time limit kills it — leaving the campaign stuck in
// SENDING with only a partial, unknown fraction actually reached. This time
// budget bounds each invocation's work; if QUEUED sends remain when the
// budget runs out, triggerContinuation() fires a fresh invocation to pick up
// where this one left off, chaining until the audience is exhausted.
const TIME_BUDGET_MS = Number(process.env.SEND_TIME_BUDGET_MS ?? 45_000);
const BATCH = 20;
const DEFAULT_HOURLY_SEND_CAP = 60;

// The hosting account's outgoing-mail rate limit is a single shared budget
// across everything the account sends (all campaigns, all channels) — not
// per-campaign. Editable at runtime via the existing generic Setting
// key/value editor at /admin/settings (key: "smtp_hourly_send_cap"), same
// pattern as the morning_boost_direct_send_enabled kill switch, so it can be
// tuned without a redeploy if the host's actual cap turns out to be
// different from our current best guess.
async function getHourlySendCap(): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: "smtp_hourly_send_cap" } });
  const parsed = row ? Number.parseInt(row.value, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HOURLY_SEND_CAP;
}

// Deliberately global (no campaignId filter) — the host's cap is shared
// account-wide, so two campaigns sending in the same hour must share one
// budget. Counts both SENT and BOUNCED because a bounced/failed send still
// consumed an SMTP connection attempt against the host's limit.
async function countSendsInLastHour(): Promise<number> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return db.campaignSend.count({
    where: {
      OR: [{ sentAt: { gte: oneHourAgo } }, { bouncedAt: { gte: oneHourAgo } }],
    },
  });
}

// Marking a failed send as BOUNCED (not leaving it QUEUED) matters more than
// it looks: the continuation loop below re-queries "status: QUEUED" every
// pass, so a row that stays QUEUED after a permanent failure (bad address,
// etc.) would be retried forever and block progress on every contact behind
// it in the same chain.
async function sendQueuedEmailBatches(
  campaignId: string,
  fallbackContent: EmailContent,
  variantById: Map<string, EmailContent>,
  deadline: number,
): Promise<{ done: boolean; sent: number; failed: number; hourlyCapReached: boolean }> {
  let sent = 0;
  let failed = 0;

  const cap = await getHourlySendCap();
  // Seeded once from the DB, then tracked incrementally by adding every
  // attempt made during this invocation — re-querying countSendsInLastHour()
  // on every loop iteration would work too, but this avoids an extra DB
  // round-trip per batch and can't drift stale since every attempt this
  // invocation makes is accounted for as it happens.
  let usedThisHour = await countSendsInLastHour();

  while (Date.now() < deadline) {
    const remaining = cap - usedThisHour;
    if (remaining <= 0) {
      return { done: false, sent, failed, hourlyCapReached: true };
    }
    const batchSize = Math.min(BATCH, remaining);

    const queued = await db.campaignSend.findMany({
      where: { campaignId, status: "QUEUED" },
      take: batchSize,
      include: { contact: { select: { email: true, firstName: true } } },
    });
    if (queued.length === 0) return { done: true, sent, failed, hourlyCapReached: false };

    await Promise.allSettled(
      queued.map(async (row) => {
        try {
          const content = row.variantId ? (variantById.get(row.variantId) ?? fallbackContent) : fallbackContent;
          const { subject, html, text } = buildCampaignEmail(content, row.contactId, row.contact.firstName, row.id);
          await sendEmail({ to: row.contact.email, subject, html, text });
          await db.campaignSend.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date() } });
          sent++;
        } catch {
          await db.campaignSend.update({ where: { id: row.id }, data: { status: "BOUNCED", bouncedAt: new Date() } }).catch(() => {});
          failed++;
        }
      })
    );
    usedThisHour += queued.length;
  }
  return { done: false, sent, failed, hourlyCapReached: false };
}

// Fire-and-forget: intentionally not awaited, so the current invocation can
// return (and free its own execution-time budget) while the next hop starts
// almost immediately rather than waiting for the next cron tick.
function triggerContinuation(campaignId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://fixernation.org";
  const url = `${base}/api/cron?job=campaign-send-continue&campaignId=${campaignId}&token=${encodeURIComponent(process.env.CRON_SECRET ?? "")}`;
  fetch(url).catch((err) => console.error("[send-campaign] continuation trigger failed:", err));
}

// Called only from the campaign-send-continue cron job — deliberately
// bypasses sendCampaignNow's already_sent guard, since re-entering a
// campaign that's already SENDING is exactly the point of a continuation
// (as opposed to an external duplicate "Send now" trigger, which that guard
// still correctly blocks).
export async function continueCampaignSend(campaignId: string): Promise<{ done: boolean; sent: number; failed: number; hourlyCapReached: boolean }> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "SENDING") return { done: true, sent: 0, failed: 0, hourlyCapReached: false };

  const variantById = new Map<string, EmailContent>();
  if (campaign.isAbTest) {
    const varDb = db as never as VarDb;
    const variants = await varDb.campaignVariant.findMany({ where: { campaignId } as never });
    for (const v of variants) variantById.set(v.id, v);
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const result = await sendQueuedEmailBatches(campaignId, campaign, variantById, deadline);

  if (result.done) {
    await db.campaign.update({ where: { id: campaignId }, data: { status: "SENT", sentAt: new Date() } });
    computeCampaignMetric(campaignId).catch(() => {});
  } else if (!result.hourlyCapReached) {
    // Time budget was hit but there's still hourly headroom — keep chaining
    // immediately, same as before this sprint.
    triggerContinuation(campaignId);
  }
  // If the hourly cap was hit: do nothing further. The campaign stays
  // SENDING with its remaining QUEUED rows untouched; re-triggering
  // immediately would just slam the same exhausted hour again. The
  // campaign-send-hourly-resume cron job picks it back up once the hour
  // rolls over (or sooner, if other sends free up headroom).
  return result;
}

export async function computeCampaignMetric(campaignId: string) {
  const rows = await db.campaignSend.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { status: true },
  });
  const s: Record<string, number> = {};
  for (const r of rows) s[r.status] = r._count.status;

  const totalSent = (s.SENT ?? 0) + (s.OPENED ?? 0) + (s.CLICKED ?? 0) + (s.BOUNCED ?? 0);
  const totalDelivered = (s.SENT ?? 0) + (s.OPENED ?? 0) + (s.CLICKED ?? 0);
  const totalOpened = (s.OPENED ?? 0) + (s.CLICKED ?? 0);
  const totalClicked = s.CLICKED ?? 0;
  const totalBounced = s.BOUNCED ?? 0;
  const totalUnsubscribed = s.UNSUBSCRIBED ?? 0;

  const openRate = totalDelivered > 0 ? totalOpened / totalDelivered : 0;
  const clickRate = totalDelivered > 0 ? totalClicked / totalDelivered : 0;
  const bounceRate = totalSent > 0 ? totalBounced / totalSent : 0;
  const unsubRate = totalDelivered > 0 ? totalUnsubscribed / totalDelivered : 0;

  return db.campaignMetric.upsert({
    where: { campaignId },
    create: {
      campaignId,
      totalSent, totalDelivered, totalOpened, totalClicked, totalBounced, totalUnsubscribed,
      openRate, clickRate, bounceRate, unsubRate,
    },
    update: {
      totalSent, totalDelivered, totalOpened, totalClicked, totalBounced, totalUnsubscribed,
      openRate, clickRate, bounceRate, unsubRate,
      computedAt: new Date(),
    },
  });
}

export type SendCampaignResult =
  | { status: "not_found" }
  | { status: "already_sent" }
  | { status: "no_audience" }
  | { status: "no_recipients" }
  | { status: "no_push_subscriptions" }
  | { status: "ab_test_misconfigured"; error: string }
  | { status: "sending_in_progress"; sent: number; failed: number; pausedForHourlyCap: boolean }
  | { status: "sent"; sent: number; failed: number };

// Re-validates guards internally rather than assuming a caller pre-checked —
// the API route still does its own checks first for clean HTTP responses,
// but the cron scheduler and the recurring dispatcher call this directly
// with no prior validation of their own.
export async function sendCampaignNow(campaignId: string): Promise<SendCampaignResult> {
  const id = campaignId;
  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      list: { select: { id: true, name: true } },
      _count: { select: { sends: true } },
    },
  });
  if (!campaign) return { status: "not_found" };

  const isAbTest = campaign.isAbTest ?? false;
  const channelType = campaign.channelType ?? "EMAIL";

  if (campaign.status === "SENDING" || campaign.status === "SENT") {
    return { status: "already_sent" };
  }
  if (!campaign.listId && !campaign.audienceRules) {
    return { status: "no_audience" };
  }

  // ── Resolve recipients ────────────────────────────────────────────────────
  let eligibleContacts: Array<{ id: string; email: string; firstName: string | null }>;
  let suppressedCount = 0;

  if (campaign.audienceRules) {
    const def = campaign.audienceRules as unknown as AudienceDefinition;
    const { includedIds, suppressed } = await resolveAudience(def);
    suppressedCount = suppressed.length;
    eligibleContacts = includedIds.length > 0
      ? await db.contact.findMany({
          where: { id: { in: includedIds } },
          select: { id: true, email: true, firstName: true },
        })
      : [];

    await db.campaignAudienceSnapshot.upsert({
      where: { campaignId: id },
      create: {
        campaignId: id,
        totalIncluded: eligibleContacts.length,
        totalSuppressed: suppressedCount,
        rules: campaign.audienceRules,
      },
      update: {
        totalIncluded: eligibleContacts.length,
        totalSuppressed: suppressedCount,
        takenAt: new Date(),
        rules: campaign.audienceRules,
      },
    });
  } else {
    // Legacy path: use listId
    const members = await db.contactListMember.findMany({
      where: { listId: campaign.listId! },
      include: {
        contact: {
          select: { id: true, email: true, firstName: true },
          include: { consents: { where: { topic: "CAMPAIGNS" } } } as never,
        },
      },
    });
    eligibleContacts = members
      .filter((m) => {
        const c = m.contact as unknown as { consents: Array<{ optedIn: boolean }> };
        const consent = c.consents?.[0];
        return !consent || consent.optedIn;
      })
      .map((m) => ({
        id: m.contactId,
        email: (m.contact as { email: string }).email,
        firstName: (m.contact as { firstName: string | null }).firstName,
      }));

    await db.campaignAudienceSnapshot.upsert({
      where: { campaignId: id },
      create: {
        campaignId: id,
        totalIncluded: eligibleContacts.length,
        totalSuppressed: 0,
        rules: { logic: "OR", include: [{ type: "list", listId: campaign.listId }], exclude: [] },
      },
      update: {
        totalIncluded: eligibleContacts.length,
        totalSuppressed: 0,
        takenAt: new Date(),
        rules: { logic: "OR", include: [{ type: "list", listId: campaign.listId }], exclude: [] },
      },
    });
  }

  // Filter out actively suppressed email addresses
  if (eligibleContacts.length > 0) {
    const supDb = db as never as SupDb;
    const suppressed = await supDb.suppressionRecord.findMany({
      where: {
        email: { in: eligibleContacts.map((c) => c.email) },
        liftedAt: null,
      } as never,
      select: { email: true } as never,
    });
    if (suppressed.length > 0) {
      const suppressedEmails = new Set(suppressed.map((s) => s.email));
      suppressedCount += suppressed.length;
      eligibleContacts = eligibleContacts.filter((c) => !suppressedEmails.has(c.email));
    }
  }

  if (eligibleContacts.length === 0) {
    return { status: "no_recipients" };
  }

  await db.campaign.update({ where: { id }, data: { status: "SENDING" } });

  let sent = 0;
  let failed = 0;
  const now = new Date();

  if (channelType === "PUSH") {
    // ── Push notification send ────────────────────────────────────────────
    const pushDb = db as never as PushDb;

    const contactsWithUser = await pushDb.contact.findMany({
      where: { id: { in: eligibleContacts.map((c) => c.id) } } as never,
      select: { id: true, userId: true } as never,
    });
    const userIds = contactsWithUser.filter((c) => c.userId).map((c) => c.userId!);

    if (userIds.length === 0) {
      await db.campaign.update({ where: { id }, data: { status: "DRAFT" } });
      return { status: "no_push_subscriptions" };
    }

    const subscriptions = await pushDb.pushSubscription.findMany({
      where: { userId: { in: userIds } } as never,
    });

    const contactByUserId = Object.fromEntries(
      contactsWithUser.filter((c) => c.userId).map((c) => [c.userId!, c.id])
    );

    const pushCampaign = campaign as unknown as { subject: string; textBody: string | null; pushUrl: string | null; pushIcon: string | null };
    const payload = JSON.stringify({
      title: pushCampaign.subject,
      body: pushCampaign.textBody ?? "",
      url: pushCampaign.pushUrl ?? "/",
      icon: pushCampaign.pushIcon ?? undefined,
    });

    await db.campaignSend.createMany({
      data: subscriptions.map((sub) => ({
        campaignId: id,
        contactId: contactByUserId[sub.userId],
      })).filter((r) => r.contactId),
      skipDuplicates: true,
    });

    for (let i = 0; i < subscriptions.length; i += BATCH) {
      const batch = subscriptions.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (sub) => {
          const contactId = contactByUserId[sub.userId];
          if (!contactId) return;
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dhKey, auth: sub.authKey } },
              payload,
            );
            await db.campaignSend.update({
              where: { campaignId_contactId: { campaignId: id, contactId } },
              data: { status: "SENT", sentAt: now },
            });
            sent++;
          } catch {
            await db.campaignSend.update({
              where: { campaignId_contactId: { campaignId: id, contactId } },
              data: { status: "BOUNCED", bouncedAt: now },
            }).catch(() => {});
            failed++;
          }
        })
      );
    }
  } else if (isAbTest) {
    // ── A/B send: split audience by variant, stamp variantId on each send ──
    const varDb = db as never as VarDb;
    const abDb = db as never as AbSendDb;

    const variants = await varDb.campaignVariant.findMany({
      where: { campaignId: id } as never,
      orderBy: { createdAt: "asc" } as never,
    });

    if (variants.length === 0) {
      await db.campaign.update({ where: { id }, data: { status: "DRAFT" } });
      return { status: "ab_test_misconfigured", error: "A/B test enabled but no variants defined" };
    }

    const totalVariantPct = variants.reduce((s, v) => s + v.splitPct, 0);
    if (totalVariantPct > 99) {
      await db.campaign.update({ where: { id }, data: { status: "DRAFT" } });
      return { status: "ab_test_misconfigured", error: "Variant split percentages must leave at least 1% for control (variant A)" };
    }
    const controlPct = 100 - totalVariantPct;

    type Group = { variantId: string | null; content: { subject: string; fromName: string; fromEmail: string; htmlBody: string | null; textBody: string | null }; contacts: typeof eligibleContacts };
    const groups: Group[] = [];

    const controlCount = Math.round(eligibleContacts.length * (controlPct / 100));
    groups.push({ variantId: null, content: campaign, contacts: eligibleContacts.slice(0, controlCount) });

    let offset = controlCount;
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      const count = i === variants.length - 1
        ? eligibleContacts.length - offset
        : Math.round(eligibleContacts.length * (v.splitPct / 100));
      groups.push({ variantId: v.id, content: v, contacts: eligibleContacts.slice(offset, offset + count) });
      offset += count;
    }

    for (const group of groups) {
      if (group.contacts.length === 0) continue;

      await abDb.campaignSend.createMany({
        data: group.contacts.map((c) => ({ campaignId: id, contactId: c.id, variantId: group.variantId })) as never,
        skipDuplicates: true,
      } as never);
    }

    const variantById = new Map<string, EmailContent>(variants.map((v) => [v.id, v]));
    const deadline = Date.now() + TIME_BUDGET_MS;
    const result = await sendQueuedEmailBatches(id, campaign, variantById, deadline);
    sent = result.sent;
    failed = result.failed;
    if (!result.done) {
      if (!result.hourlyCapReached) triggerContinuation(id);
      return { status: "sending_in_progress", sent, failed, pausedForHourlyCap: result.hourlyCapReached };
    }
  } else {
    // ── Standard (non-A/B) send ──────────────────────────────────────────
    await db.campaignSend.createMany({
      data: eligibleContacts.map((c) => ({ campaignId: id, contactId: c.id })),
      skipDuplicates: true,
    });

    const deadline = Date.now() + TIME_BUDGET_MS;
    const result = await sendQueuedEmailBatches(id, campaign, new Map<string, EmailContent>(), deadline);
    sent = result.sent;
    failed = result.failed;
    if (!result.done) {
      if (!result.hourlyCapReached) triggerContinuation(id);
      return { status: "sending_in_progress", sent, failed, pausedForHourlyCap: result.hourlyCapReached };
    }
  }

  await db.campaign.update({
    where: { id },
    data: { status: "SENT", sentAt: now },
  });

  computeCampaignMetric(id).catch(() => {});

  return { status: "sent", sent, failed };
}
