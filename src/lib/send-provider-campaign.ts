import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { trackingHmac } from "@/lib/track";
import { reserveBulkSendSlot, isInfrastructureSendError } from "@/lib/mailbox-budget";

// Provider campaigns used to send their entire audience inside the "Send now"
// request, in a serial loop, with no rate limiting at all — the single largest
// uncounted source of volume against the campaigns@ mailbox. This is the
// queue/resume drain for them, deliberately shaped like send-campaign.ts's
// (same BATCH, same time budget, same Promise.allSettled pass, same
// leave-it-queued-on-a-sender-outage rule) without being folded into it:
// CampaignSend and ProviderCampaignSend have different columns, different
// status enums and different failure consequences, so a shared abstraction
// would cost more than it saves. The one thing that IS shared, and has to be,
// is the atomic hourly budget claim — both drains spend from the same mailbox.

const TIME_BUDGET_MS = Number(process.env.SEND_TIME_BUDGET_MS ?? 45_000);
const BATCH = 20;

type ProviderCampaignRecord = {
  id: string;
  providerUserId: string;
  name: string;
  subject: string;
  fromName: string;
  htmlBody: string;
  textBody: string | null;
  status: string;
};

type QueuedRow = {
  id: string;
  providerContactId: string;
  contact: { email: string };
};

type ProviderSendDb = {
  providerCampaign: {
    findUnique: (args: unknown) => Promise<unknown | null>;
    findMany: (args: unknown) => Promise<Array<{ id: string }>>;
    update: (args: unknown) => Promise<unknown>;
  };
  providerCampaignSend: {
    findMany: (args: unknown) => Promise<QueuedRow[]>;
    update: (args: unknown) => Promise<unknown>;
    count: (args: unknown) => Promise<number>;
  };
};

export type ProviderDrainResult = {
  done: boolean;
  sent: number;
  failed: number;
  hourlyCapReached: boolean;
};

function buildEmail(campaign: ProviderCampaignRecord, sendId: string) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "";
  const pixel = `<img src="${baseUrl}/api/track/provider-open?s=${sendId}&t=${trackingHmac(sendId)}" width="1" height="1" style="display:none" alt="">`;
  const footer = `<br><br><hr style="border:none;border-top:1px solid #eee"><p style="font-size:12px;color:#999">Sent by ${campaign.fromName} through Fixer Nation. Questions? Contact <a href="mailto:support@fixernation.org">support@fixernation.org</a>.</p>`;
  const textFooter = `\n\n---\nSent by ${campaign.fromName} through Fixer Nation. Questions? support@fixernation.org`;
  return {
    subject: campaign.subject,
    html: campaign.htmlBody + pixel + footer,
    text: (campaign.textBody ?? campaign.subject) + textFooter,
    from: `${campaign.fromName} via Fixer Nation <campaigns@fixernation.org>`,
  };
}

/**
 * Drains QUEUED sends for one SENDING provider campaign until the audience is
 * exhausted, the hourly mailbox budget runs out, this invocation's time budget
 * runs out, or the sending mailbox turns out to be suspended. Anything left
 * over stays QUEUED for the next campaign-send-hourly-resume tick.
 */
export async function continueProviderCampaignSend(campaignId: string): Promise<ProviderDrainResult> {
  const pdb = db as never as ProviderSendDb;

  const campaign = (await pdb.providerCampaign.findUnique({
    where: { id: campaignId },
  })) as ProviderCampaignRecord | null;

  if (!campaign || campaign.status !== "SENDING") {
    return { done: true, sent: 0, failed: 0, hourlyCapReached: false };
  }

  const deadline = Date.now() + TIME_BUDGET_MS;
  let sent = 0;
  let failed = 0;
  let done = false;

  while (Date.now() < deadline) {
    const queued = await pdb.providerCampaignSend.findMany({
      where: { campaignId, status: "QUEUED" },
      take: BATCH,
      select: { id: true, providerContactId: true, contact: { select: { email: true } } },
    });
    if (queued.length === 0) {
      done = true;
      break;
    }

    let infrastructureFailure = false;
    let hourlyCapReached = false;

    await Promise.allSettled(
      queued.map(async (row) => {
        if (!(await reserveBulkSendSlot())) {
          hourlyCapReached = true;
          return;
        }
        try {
          await sendEmail({ to: row.contact.email, ...buildEmail(campaign, row.id) });
          await pdb.providerCampaignSend.update({
            where: { id: row.id },
            data: { status: "SENT", sentAt: new Date() },
          });
          sent++;
        } catch (err) {
          if (isInfrastructureSendError(err)) {
            // Our mailbox is suspended or the transport is down — nothing to
            // do with this recipient's address. Leaving the row QUEUED means
            // the next hourly tick retries it instead of the provider seeing
            // their whole list marked failed for an outage on our side.
            infrastructureFailure = true;
            failed++;
            return;
          }
          await pdb.providerCampaignSend
            .update({ where: { id: row.id }, data: { status: "FAILED" } })
            .catch(() => {});
          failed++;
        }
      })
    );

    if (hourlyCapReached) return { done: false, sent, failed, hourlyCapReached: true };
    if (infrastructureFailure) return { done: false, sent, failed, hourlyCapReached: false };
  }

  if (!done) {
    // Re-check rather than trusting the loop exit: the deadline can expire on
    // the same pass that drained the last row.
    const remaining = await pdb.providerCampaignSend.count({ where: { campaignId, status: "QUEUED" } });
    done = remaining === 0;
  }

  if (done) {
    await pdb.providerCampaign.update({
      where: { id: campaignId },
      data: { status: "SENT", sentAt: new Date() },
    });
  }

  return { done, sent, failed, hourlyCapReached: false };
}

/** Every provider campaign still mid-flight, for the hourly resume sweep. */
export async function findPausedProviderCampaigns(): Promise<string[]> {
  const pdb = db as never as ProviderSendDb;
  const rows = await pdb.providerCampaign.findMany({
    where: { status: "SENDING", sends: { some: { status: "QUEUED" } } },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
