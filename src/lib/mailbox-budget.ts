import { db } from "@/lib/db";

// ─── The hosting account's outgoing-mail budget ──────────────────────────────
//
// hosting.com enforces a hard 100-messages-per-hour limit PER MAILBOX on
// outgoing mail and suspends the mailbox for the remainder of the hour once
// it's tripped (confirmed with their support after four separate incidents,
// every one of them naming campaigns@fixernation.org in the bounce text).
//
// This module is the single choke point for every path that sends through the
// bulk mailbox (SMTP_USER — campaigns@). Transactional mail now authenticates
// as a different mailbox (TRANSACTIONAL_SMTP_USER — noreply@) and therefore
// has its own independent 100/hr allowance at the host, which is why it
// deliberately does NOT go through this counter.
//
// It replaces the previous count-rows-in-the-last-hour approach, which was a
// read-once snapshot rather than an atomic reservation: campaign-scheduler,
// campaign-recurring-dispatch and campaign-send-hourly-resume all fire on
// `0 * * * *` as three separate Vercel invocations, so all three could read
// the same base count and each spend the full remaining budget.
const DEFAULT_BULK_HOURLY_CAP = 70;

// Runtime-tunable through the existing generic Setting key/value editor at
// /admin/settings, same key as before, so the cap can still be adjusted
// without a redeploy if the host's real limit turns out to differ. Memoized
// briefly because this is now consulted once per individual send attempt
// rather than once per batch.
const CAP_SETTING_KEY = "smtp_hourly_send_cap";
const CAP_CACHE_MS = 60_000;
let capCache: { value: number; readAt: number } | null = null;

type MailboxSendCounterDb = {
  mailboxSendCounter: {
    updateMany: (args: { where: object; data: object }) => Promise<{ count: number }>;
    create: (args: { data: object }) => Promise<unknown>;
    findUnique: (args: { where: object }) => Promise<{ key: string; count: number } | null>;
  };
};

export function bulkMailbox(): string {
  return process.env.SMTP_USER ?? "unknown-mailbox";
}

// UTC so every serverless region agrees on which hour a send belongs to —
// "2026-09-26T18".
export function utcHourKey(at: Date = new Date()): string {
  return at.toISOString().slice(0, 13);
}

export function bulkBudgetKey(at: Date = new Date()): string {
  return `${bulkMailbox()}:${utcHourKey(at)}`;
}

async function getBulkHourlyCap(): Promise<number> {
  if (capCache && Date.now() - capCache.readAt < CAP_CACHE_MS) return capCache.value;
  const row = await db.setting.findUnique({ where: { key: CAP_SETTING_KEY } }).catch(() => null);
  const parsed = row ? Number.parseInt(row.value, 10) : NaN;
  const value = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BULK_HOURLY_CAP;
  capCache = { value, readAt: Date.now() };
  return value;
}

function isUniqueViolation(err: unknown): boolean {
  return err != null && typeof err === "object" && "code" in err && (err as { code?: string }).code === "P2002";
}

/**
 * Atomically claims one slot in the current hour's budget for the bulk
 * mailbox. Returns false when this hour's budget is spent — callers must then
 * stop sending and leave their remaining work queued for the next hourly tick.
 *
 * Deliberately called BEFORE the send attempt, and never refunded on failure:
 * a bounced or rejected message still burned a real delivery attempt against
 * the host's counter, so it has to cost us a slot too.
 */
export async function reserveBulkSendSlot(at: Date = new Date()): Promise<boolean> {
  const cap = await getBulkHourlyCap();
  if (cap <= 0) return false;

  const key = bulkBudgetKey(at);
  const cdb = db as never as MailboxSendCounterDb;

  // The whole point: the conditional increment is evaluated by Postgres, so
  // concurrent invocations serialize on the row instead of each acting on a
  // stale count they read a moment earlier.
  const claimed = await cdb.mailboxSendCounter.updateMany({
    where: { key, count: { lt: cap } },
    data: { count: { increment: 1 } },
  });
  if (claimed.count === 1) return true;

  // A zero-row update means either the bucket for this hour doesn't exist yet
  // or it's already at cap — indistinguishable from the update alone. Create
  // it holding this attempt's slot; if a concurrent process created it first,
  // the unique violation tells us the bucket now exists and the conditional
  // update is the authoritative answer.
  try {
    await cdb.mailboxSendCounter.create({
      data: { key, mailbox: bulkMailbox(), hourKey: utcHourKey(at), count: 1 },
    });
    return true;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }

  const retried = await cdb.mailboxSendCounter.updateMany({
    where: { key, count: { lt: cap } },
    data: { count: { increment: 1 } },
  });
  return retried.count === 1;
}

/**
 * Thrown by callers that can't return a "paused" result to their caller and
 * have to unwind instead (the automation tick, whose step executor is
 * void-returning). Distinguished from a real failure so the work gets
 * deferred to the next tick rather than marked permanently failed.
 */
export class BulkBudgetExhaustedError extends Error {
  constructor() {
    super("Hourly outgoing-mail budget exhausted for the bulk mailbox");
    this.name = "BulkBudgetExhaustedError";
  }
}

/** Start of the next UTC hour — when a deferred bulk send can be retried. */
export function nextBudgetWindow(at: Date = new Date()): Date {
  const next = new Date(at);
  next.setUTCMinutes(0, 0, 0);
  return new Date(next.getTime() + 60 * 60 * 1000);
}

/** Slots already spent this hour — read-only, for diagnostics. */
export async function bulkSlotsUsed(at: Date = new Date()): Promise<number> {
  const cdb = db as never as MailboxSendCounterDb;
  const row = await cdb.mailboxSendCounter.findUnique({ where: { key: bulkBudgetKey(at) } });
  return row?.count ?? 0;
}

// ─── Sender-side outage detection ────────────────────────────────────────────

// This hosting provider's exact wording for a sender-side account
// suspension (not a per-recipient rejection) -- has recurred at least 4
// times. Treating it as a normal per-recipient BOUNCED would permanently
// blacklist real recipients from every future send via resolveAudience's
// bounce-suppression check, for an outage that has nothing to do with
// whether their address is valid.
const SENDER_MAILBOX_SUSPENDED = /outgoing mail from .* has been suspended/i;

// Nodemailer's transport/connection-level error codes -- these mean we
// never got a response from the recipient's mail server (or our own SMTP
// auth failed) at all, so none of them can indicate anything about
// whether the recipient's address is valid. Confirmed live: a raw
// ESOCKET/ETIMEDOUT connection failure to the mail host happened minutes
// after the SENDER_MAILBOX_SUSPENDED incident above, while the same host
// was still stabilizing post-recovery, and hit the exact same real
// recipients -- same underlying problem (infra, not the recipient), just
// a different nodemailer error code with no matching wording.
const TRANSPORT_LEVEL_ERROR_CODES = new Set(["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "EDNS", "EAUTH"]);

/**
 * True when a send failure is ours, not the recipient's — a suspended sending
 * mailbox or a transport/connection-level failure. Callers leave the affected
 * rows queued for a later retry instead of marking them bounced/failed, so one
 * outage can't blacklist a whole audience.
 */
export function isInfrastructureSendError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: string } | null)?.code;
  return SENDER_MAILBOX_SUSPENDED.test(message) || (!!code && TRANSPORT_LEVEL_ERROR_CODES.has(code));
}
