import nodemailer from "nodemailer";
import { db } from "@/lib/db";

// All three mailboxes live on the same cPanel mail server, so host/port/secure
// are shared; only the authenticating mailbox and its password differ. The
// host's rate limit is enforced per mailbox, which is the whole reason for
// splitting them.
function createMailTransport(user: string | undefined, pass: string | undefined) {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
    // Pooled + capped so a full 20-contact send batch (BATCH in
    // send-campaign.ts) reuses a handful of persistent connections instead
    // of opening one new SMTP connection per email -- that concurrent-burst
    // pattern is a likely contributor to this hosting provider's repeated
    // account suspensions (see project memory: recurring incidents on
    // 2026-09-02, 09-05, 09-15, 09-17). maxConnections is set conservatively
    // below typical shared-hosting concurrent-connection limits.
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
}

// Bulk/campaign identity (campaigns@). Everything that goes out through this
// transporter shares one 100-messages-per-hour allowance at the host and is
// metered by src/lib/mailbox-budget.ts.
const transporter = createMailTransport(process.env.SMTP_USER, process.env.SMTP_PASS);

// Transactional identity (noreply@). A separate mailbox means a separate
// hourly allowance at the host, so a big campaign can no longer starve — or
// get suspended alongside — password resets, receipts and application
// notifications. Only built when the credentials are actually configured.
const transactionalTransporter = process.env.TRANSACTIONAL_SMTP_USER
  ? createMailTransport(process.env.TRANSACTIONAL_SMTP_USER, process.env.TRANSACTIONAL_SMTP_PASS)
  : null;

// Daily Morning Boost identity (morningboost@). The highest-volume single
// recurring send on the site, so it gets its own mailbox and therefore its own
// independent hourly allowance at the host rather than competing with the rest
// of the CRM's campaign traffic for campaigns@'s budget.
const morningBoostTransporter = process.env.MORNING_BOOST_SMTP_USER
  ? createMailTransport(process.env.MORNING_BOOST_SMTP_USER, process.env.MORNING_BOOST_SMTP_PASS)
  : null;

const FROM = process.env.SMTP_FROM ?? "Fixer Nation <noreply@fixernation.org>";
const TRANSACTIONAL_FROM = process.env.TRANSACTIONAL_SMTP_FROM ?? FROM;
const MORNING_BOOST_FROM = process.env.MORNING_BOOST_SMTP_FROM ?? FROM;
const BASE_URL = process.env.NEXTAUTH_URL ?? "https://fixernation.org";

// A handful of fixed e2e test accounts (qa-member, qa-mfa-test, qa-admin,
// etc.) are real User rows on the real production domain so they behave
// identically to a real member for app logic — but their mailboxes don't
// actually exist, so any real send to them (password resets, Morning
// Boost, campaigns, or any of the automation triggers) hard-bounces
// against the real production mail server, repeatedly, hurting sender
// reputation. Dynamically-created e2e fixtures deliberately use reserved,
// non-resolving domains (fixernation-e2e.test, fixernation-e2e-audience.test)
// specifically so a real send attempt can prove the pipeline works without
// ever reaching a real mailbox — those are intentionally NOT skipped here.
const QA_LOCAL_PART = /^qa[-_]/i;
const PRODUCTION_DOMAIN = "fixernation.org";

function isQaAccountOnRealDomain(to: string): boolean {
  const at = to.lastIndexOf("@");
  if (at < 0) return false;
  const localPart = to.slice(0, at);
  const domain = to.slice(at + 1).toLowerCase();
  return QA_LOCAL_PART.test(localPart) && domain === PRODUCTION_DOMAIN;
}

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
};

type MailTransport = ReturnType<typeof createMailTransport>;

async function deliver(
  transport: MailTransport,
  defaultFrom: string,
  { to, subject, html, text, from }: SendArgs,
) {
  try {
    await transport.sendMail({ from: from ?? defaultFrom, to, subject, html, text });
    // Tracked so the admin dashboard's email-health banner can tell "still
    // broken" apart from "failed earlier, already recovered" -- a rolling
    // failure count alone can't distinguish those, and kept showing a red
    // banner for a full 24h after a real hosting-side suspension was
    // already lifted and mail was flowing again. Fire-and-forget: a hiccup
    // here must never affect the actual send's success.
    db.setting
      .upsert({
        where: { key: "last_successful_send_at" },
        create: { key: "last_successful_send_at", value: new Date().toISOString() },
        update: { value: new Date().toISOString() },
      })
      .catch(() => {});
  } catch (err) {
    // Recorded centrally here — every caller (password reset, verify-email,
    // Morning Boost, campaigns, admin notifications) goes through this one
    // function, so this is the one place that catches all of them without
    // each call site needing its own tracking. Best-effort: a DB hiccup
    // while recording the failure must never mask the original send error.
    const code = (err as { code?: string; responseCode?: number })?.code
      ?? (err as { responseCode?: number })?.responseCode?.toString()
      ?? null;
    await db.emailFailure
      .create({
        data: {
          to,
          subject,
          errorCode: code,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
      .catch((dbErr) => console.error("[email] Failed to record email failure:", dbErr));
    throw err;
  }
}

export async function sendEmail(args: SendArgs) {
  if (!process.env.SMTP_USER) {
    console.warn("[email] SMTP_USER not set — skipping send to", args.to);
    return;
  }
  if (isQaAccountOnRealDomain(args.to)) {
    console.warn("[email] Skipping send to fixed QA test account on the real domain:", args.to);
    return;
  }
  return deliver(transporter, FROM, args);
}

// Password-class, receipt-class and admin-notification mail: anything a person
// is actively waiting on. Sends as noreply@ so it draws on its own hourly
// allowance at the host instead of competing with campaign volume. Falls back
// to the bulk sender when the transactional credentials aren't configured —
// degrading to "sends from the wrong mailbox" is far better than silently
// dropping a password reset.
export async function sendTransactionalEmail(args: SendArgs) {
  if (!transactionalTransporter) return sendEmail(args);
  if (isQaAccountOnRealDomain(args.to)) {
    console.warn("[email] Skipping send to fixed QA test account on the real domain:", args.to);
    return;
  }
  return deliver(transactionalTransporter, TRANSACTIONAL_FROM, args);
}

/**
 * The Daily Morning Boost campaign only. Authenticates as morningboost@ so
 * that send draws on its own hourly allowance at the host — see
 * morningBoostMailbox() in mailbox-budget.ts, which must stay in agreement
 * with this function about which mailbox is actually in use, including the
 * fallback below. Falls back to the bulk sender when the credentials aren't
 * configured, so a missing env var degrades to today's behaviour instead of
 * silently dropping the day's Boost.
 */
export async function sendMorningBoostEmail(args: SendArgs) {
  if (!morningBoostTransporter) return sendEmail(args);
  if (isQaAccountOnRealDomain(args.to)) {
    console.warn("[email] Skipping send to fixed QA test account on the real domain:", args.to);
    return;
  }
  return deliver(morningBoostTransporter, MORNING_BOOST_FROM, args);
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${BASE_URL}/api/auth/verify-email?token=${token}`;
  await sendTransactionalEmail({
    to,
    subject: "Verify your Fixer Nation email",
    html: `
      <p>Thanks for joining Fixer Nation. Click the link below to verify your email and activate your account.</p>
      <p><a href="${url}">Verify my email</a></p>
      <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    `,
    text: `Verify your Fixer Nation email:\n\n${url}\n\nThis link expires in 24 hours.`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${BASE_URL}/reset-password?token=${token}`;
  await sendTransactionalEmail({
    to,
    subject: "Reset your Fixer Nation password",
    html: `
      <p>We got a request to reset your Fixer Nation password. Click below to choose a new one.</p>
      <p><a href="${url}">Reset my password</a></p>
      <p>This link expires in 1 hour. If you didn't request a reset, you can ignore this email.</p>
    `,
    text: `Reset your Fixer Nation password:\n\n${url}\n\nThis link expires in 1 hour.`,
  });
}
