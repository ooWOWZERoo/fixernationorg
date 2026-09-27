import { db } from "@/lib/db";
import { sendEmail, sendMorningBoostEmail } from "@/lib/email";
import { buildCampaignEmail } from "@/lib/campaign-email";
import { resolveAudience, type AudienceDefinition } from "@/lib/audience";
import { webpush } from "@/lib/web-push";
import { reserveSendSlot, bulkMailbox, morningBoostMailbox, isInfrastructureSendError } from "@/lib/mailbox-budget";

// Extracted from the admin "send now" API route so the cron-driven paths
// (one-time SCHEDULED campaigns, recurring campaign occurrences) reuse the
// same, correct, full-featured send logic instead of a divergent
// reimplementation — the previous cron-only version only supported the
// legacy listId audience path and silently skipped any campaign using
// rule-based audienceRules.

// Shared by the recurring dispatch cron and the admin "preview next send"
// endpoint so both agree on exactly which UTC calendar day "today" means —
// duplicating this with plain (runtime-local) Date math previously caused
// the preview to disagree with what the cron would actually pick.
export function utcDayWindow(now: Date): { startOfDay: Date; endOfDay: Date } {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  return { startOfDay, endOfDay };
}

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
// platform's execution time limit kills it. This time budget bounds each
// invocation's work; if QUEUED sends remain when it runs out, the campaign
// stays SENDING and the campaign-send-hourly-resume cron job (cron.ts) picks
// it back up on its next hourly sweep — see continueCampaignSend below.
const TIME_BUDGET_MS = Number(process.env.SEND_TIME_BUDGET_MS ?? 45_000);
const BATCH = 20;

// ─── Which mailbox a campaign sends as ───────────────────────────────────────
//
// The Daily Morning Boost has its own provisioned mailbox (morningboost@) and
// therefore its own independent hourly allowance at the host; every other
// campaign keeps sending as campaigns@. Nothing else about the send differs —
// same batching, same retry/bounce rules, same queue semantics.
type SenderProfile = { deliver: typeof sendEmail; mailbox: string };

// Built on demand rather than as module-level constants: the mailbox names
// come from env, and freezing them at import time would read stale values in
// any harness that populates env after modules load.
const bulkSender = (): SenderProfile => ({ deliver: sendEmail, mailbox: bulkMailbox() });
const morningBoostSender = (): SenderProfile => ({ deliver: sendMorningBoostEmail, mailbox: morningBoostMailbox() });

// recurrenceSource lives ONLY on the recurring template (isRecurring=true,
// parentCampaignId=null). The campaign that actually sends each morning is a
// fresh child occurrence created by runCampaignRecurringDispatch, and that
// child does NOT carry recurrenceSource -- so checking the field on the
// campaign in hand would silently never match the very send this routing
// exists for. Resolve through the parent when there is one. The direct check
// still matters for an admin "Send now" on the template itself.
async function resolveSender(campaign: {
  recurrenceSource: string | null;
  parentCampaignId: string | null;
}): Promise<SenderProfile> {
  if (campaign.recurrenceSource === "MORNING_BOOST") return morningBoostSender();
  if (!campaign.parentCampaignId) return bulkSender();
  const parent = await db.campaign.findUnique({
    where: { id: campaign.parentCampaignId },
    select: { recurrenceSource: true },
  });
  return parent?.recurrenceSource === "MORNING_BOOST" ? morningBoostSender() : bulkSender();
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
  sender: SenderProfile,
): Promise<{ done: boolean; sent: number; failed: number; hourlyCapReached: boolean }> {
  let sent = 0;
  let failed = 0;

  while (Date.now() < deadline) {
    const queued = await db.campaignSend.findMany({
      where: { campaignId, status: "QUEUED" },
      take: BATCH,
      include: { contact: { select: { email: true, firstName: true } } },
    });
    if (queued.length === 0) return { done: true, sent, failed, hourlyCapReached: false };

    let infrastructureFailure = false;
    let hourlyCapReached = false;

    await Promise.allSettled(
      queued.map(async (row) => {
        // One atomic claim per individual attempt against this mailbox's
        // hourly budget (mailbox-budget.ts). Claimed before the send and
        // never refunded, because a failed attempt still burned a real
        // delivery slot at the host. A denial leaves this row QUEUED for the
        // next hourly resume tick.
        if (!(await reserveSendSlot(sender.mailbox))) {
          hourlyCapReached = true;
          return;
        }
        try {
          const content = row.variantId ? (variantById.get(row.variantId) ?? fallbackContent) : fallbackContent;
          const { subject, html, text } = buildCampaignEmail(content, row.contactId, row.contact.firstName, row.id);
          await sender.deliver({ to: row.contact.email, subject, html, text, from: `${content.fromName} <${content.fromEmail}>` });
          await db.campaignSend.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date() } });
          sent++;
        } catch (err) {
          if (isInfrastructureSendError(err)) {
            // Sender-side outage or transport/connection-level failure, not a
            // per-recipient rejection -- leave the row QUEUED so
            // campaign-send-hourly-resume retries it once the underlying
            // infrastructure issue clears, instead of permanently
            // blacklisting this contact via resolveAudience's
            // bounce-suppression check.
            infrastructureFailure = true;
            failed++;
            return;
          }
          await db.campaignSend.update({ where: { id: row.id }, data: { status: "BOUNCED", bouncedAt: new Date() } }).catch(() => {});
          failed++;
        }
      })
    );

    if (hourlyCapReached) {
      return { done: false, sent, failed, hourlyCapReached: true };
    }

    if (infrastructureFailure) {
      // Every remaining attempt this invocation would hit the identical
      // infrastructure failure -- looping until the time/hourly-cap budget
      // exhausts would just spam duplicate EmailFailure rows for no benefit.
      // Leave the rest of the queue QUEUED for the next hourly resume tick.
      return { done: false, sent, failed, hourlyCapReached: false };
    }
  }
  return { done: false, sent, failed, hourlyCapReached: false };
}

// PUSH sends have no hosting-side rate cap concept (that's an SMTP/mail-relay
// constraint), so this only needs a time-budget deadline, not an hourly-cap
// check. CampaignSend rows are keyed by contactId (not per-subscription), so
// a contact with multiple push subscriptions still gets exactly one row.
async function sendQueuedPushBatches(
  campaignId: string,
  payload: string,
  deadline: number,
): Promise<{ done: boolean; sent: number; failed: number }> {
  const pushDb = db as never as PushDb;
  let sent = 0;
  let failed = 0;

  while (Date.now() < deadline) {
    const queued = await db.campaignSend.findMany({
      where: { campaignId, status: "QUEUED" },
      take: BATCH,
      select: { id: true, contactId: true },
    });
    if (queued.length === 0) return { done: true, sent, failed };

    const contacts = await pushDb.contact.findMany({
      where: { id: { in: queued.map((q) => q.contactId) } } as never,
      select: { id: true, userId: true } as never,
    });
    const userIdByContact = Object.fromEntries(
      contacts.filter((c) => c.userId).map((c) => [c.id, c.userId!])
    );
    const userIds = Object.values(userIdByContact);
    const subscriptions = userIds.length > 0
      ? await pushDb.pushSubscription.findMany({ where: { userId: { in: userIds } } as never })
      : [];
    const subsByUserId = new Map<string, typeof subscriptions>();
    for (const s of subscriptions) {
      const arr = subsByUserId.get(s.userId) ?? [];
      arr.push(s);
      subsByUserId.set(s.userId, arr);
    }

    await Promise.allSettled(
      queued.map(async (row) => {
        const userId = userIdByContact[row.contactId];
        const subs = userId ? subsByUserId.get(userId) ?? [] : [];
        if (subs.length === 0) {
          await db.campaignSend.update({ where: { id: row.id }, data: { status: "BOUNCED", bouncedAt: new Date() } }).catch(() => {});
          failed++;
          return;
        }
        try {
          await Promise.all(subs.map((sub) =>
            webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dhKey, auth: sub.authKey } },
              payload,
            )
          ));
          await db.campaignSend.update({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date() } });
          sent++;
        } catch {
          await db.campaignSend.update({ where: { id: row.id }, data: { status: "BOUNCED", bouncedAt: new Date() } }).catch(() => {});
          failed++;
        }
      })
    );
  }
  return { done: false, sent, failed };
}

function buildPushPayload(campaign: { subject: string; textBody: string | null; pushUrl: string | null; pushIcon: string | null }): string {
  return JSON.stringify({
    title: campaign.subject,
    body: campaign.textBody ?? "",
    url: campaign.pushUrl ?? "/",
    icon: campaign.pushIcon ?? undefined,
  });
}

// Called by the campaign-send-hourly-resume cron sweep, which resumes any
// SENDING campaign with QUEUED sends every hour, unconditionally — this is
// now the sole driver of forward progress once the first invocation's own
// time budget runs out (no more fire-and-forget self-triggering; see plan at
// /Users/john.shaw/.claude/plans/soft-chasing-willow.md for why). Deliberately
// bypasses sendCampaignNow's already_sent guard, since re-entering a campaign
// that's already SENDING is exactly the point (as opposed to an external
// duplicate "Send now" trigger, which that guard still correctly blocks).
export async function continueCampaignSend(campaignId: string): Promise<{ done: boolean; sent: number; failed: number; hourlyCapReached: boolean }> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "SENDING") return { done: true, sent: 0, failed: 0, hourlyCapReached: false };

  if (campaign.channelType === "PUSH") {
    const payload = buildPushPayload(campaign as unknown as { subject: string; textBody: string | null; pushUrl: string | null; pushIcon: string | null });
    const deadline = Date.now() + TIME_BUDGET_MS;
    const result = await sendQueuedPushBatches(campaignId, payload, deadline);
    if (result.done) {
      await db.campaign.update({ where: { id: campaignId }, data: { status: "SENT", sentAt: new Date() } });
      computeCampaignMetric(campaignId).catch(() => {});
    } else {
      await db.campaign.update({ where: { id: campaignId }, data: { updatedAt: new Date() } });
    }
    return { ...result, hourlyCapReached: false };
  }

  const variantById = new Map<string, EmailContent>();
  if (campaign.isAbTest) {
    const varDb = db as never as VarDb;
    const variants = await varDb.campaignVariant.findMany({ where: { campaignId } as never });
    for (const v of variants) variantById.set(v.id, v);
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  const result = await sendQueuedEmailBatches(campaignId, campaign, variantById, deadline, await resolveSender(campaign));

  if (result.done) {
    await db.campaign.update({ where: { id: campaignId }, data: { status: "SENT", sentAt: new Date() } });
    computeCampaignMetric(campaignId).catch(() => {});
  } else {
    // Not done yet — bump updatedAt so the campaign doesn't look abandoned
    // while it's still legitimately draining across hops (paused for the
    // hourly cap, or just out of time budget this invocation). Nothing else
    // touches this row while paused, and the admin "stuck sending" flag
    // (src/pages/admin/campaigns/index.tsx) depends on updatedAt reflecting
    // real last-progress, not just creation time.
    await db.campaign.update({ where: { id: campaignId }, data: { updatedAt: new Date() } });
  }
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
  let snapshotRules: unknown;

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
    snapshotRules = campaign.audienceRules;
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
    snapshotRules = { logic: "OR", include: [{ type: "list", listId: campaign.listId }], exclude: [] };
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

  // Snapshot is taken AFTER every suppression pass (audience-rule
  // excludes/opt-outs AND the global SuppressionRecord list) so totalIncluded
  // always equals exactly how many CampaignSend rows this send is about to
  // create — the admin "Partial send" reconciliation check on
  // /admin/campaigns depends on that equality holding exactly, not roughly.
  await db.campaignAudienceSnapshot.upsert({
    where: { campaignId: id },
    create: {
      campaignId: id,
      totalIncluded: eligibleContacts.length,
      totalSuppressed: suppressedCount,
      rules: snapshotRules as never,
    },
    update: {
      totalIncluded: eligibleContacts.length,
      totalSuppressed: suppressedCount,
      takenAt: new Date(),
      rules: snapshotRules as never,
    },
  });

  if (eligibleContacts.length === 0) {
    return { status: "no_recipients" };
  }

  await db.campaign.update({ where: { id }, data: { status: "SENDING" } });

  // Resolved once per send rather than per recipient — the answer can't change
  // mid-send. Unused by the PUSH branch, which has no SMTP involvement.
  const sender = await resolveSender(campaign);

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

    await db.campaignSend.createMany({
      data: subscriptions.map((sub) => ({
        campaignId: id,
        contactId: contactByUserId[sub.userId],
      })).filter((r) => r.contactId),
      skipDuplicates: true,
    });

    const pushCampaign = campaign as unknown as { subject: string; textBody: string | null; pushUrl: string | null; pushIcon: string | null };
    const payload = buildPushPayload(pushCampaign);

    const deadline = Date.now() + TIME_BUDGET_MS;
    const result = await sendQueuedPushBatches(id, payload, deadline);
    sent = result.sent;
    failed = result.failed;
    if (!result.done) {
      return { status: "sending_in_progress", sent, failed, pausedForHourlyCap: false };
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
    const result = await sendQueuedEmailBatches(id, campaign, variantById, deadline, sender);
    sent = result.sent;
    failed = result.failed;
    if (!result.done) {
      return { status: "sending_in_progress", sent, failed, pausedForHourlyCap: result.hourlyCapReached };
    }
  } else {
    // ── Standard (non-A/B) send ──────────────────────────────────────────
    await db.campaignSend.createMany({
      data: eligibleContacts.map((c) => ({ campaignId: id, contactId: c.id })),
      skipDuplicates: true,
    });

    const deadline = Date.now() + TIME_BUDGET_MS;
    const result = await sendQueuedEmailBatches(id, campaign, new Map<string, EmailContent>(), deadline, sender);
    sent = result.sent;
    failed = result.failed;
    if (!result.done) {
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
