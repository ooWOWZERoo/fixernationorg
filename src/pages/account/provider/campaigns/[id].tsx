import Head from "next/head";
import Link from "next/link";
import { useState } from "react";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface SendRecord {
  id: string;
  status: string;
  sentAt: string | null;
  openedAt: string | null;
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

interface CampaignDetail {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  htmlBody: string;
  textBody: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
  sends: SendRecord[];
}

interface Props {
  campaign: CampaignDetail;
  contactCount: number;
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENDING: "bg-amber/20 text-amber-dark",
  SENT: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
};

const SEND_STATUS_BADGE: Record<string, string> = {
  QUEUED: "bg-slate-100 text-slate-500",
  SENT: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-600",
};

const ProviderCampaignDetailPage: NextPageWithLayout<Props> = ({ campaign, contactCount }) => {
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [status, setStatus] = useState(campaign.status);

  const handleSend = async () => {
    if (!confirm(`Send this campaign to all ${contactCount} contact${contactCount !== 1 ? "s" : ""}? This can't be undone.`)) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch(`/api/provider/campaigns/${campaign.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSendResult({ ok: false, text: data.error ?? "Something went wrong." });
      } else {
        setStatus("SENT");
        setSendResult({
          ok: true,
          text: `Sent to ${data.sent} contact${data.sent !== 1 ? "s" : ""}${data.failed > 0 ? ` (${data.failed} failed)` : ""}.`,
        });
      }
    } catch {
      setSendResult({ ok: false, text: "Network error. Please try again." });
    } finally {
      setSending(false);
    }
  };

  const sentCount = campaign.sends.filter((s) => s.status === "SENT").length;
  const failedCount = campaign.sends.filter((s) => s.status === "FAILED").length;
  const openedCount = campaign.sends.filter((s) => s.openedAt != null).length;
  const openRate = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;
  const deliveryRate = campaign.sends.length > 0 ? Math.round((sentCount / campaign.sends.length) * 100) : 0;

  return (
    <>
      <Head>
        <title>{campaign.name} — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-6">

          <div className="mb-2 flex flex-wrap items-center gap-3">
            <Link href="/account/provider/campaigns" className="text-sm font-semibold text-ink-soft no-underline hover:text-navy">
              ← My campaigns
            </Link>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-navy">{campaign.name}</h1>
              <p className="mt-1 text-sm text-ink-soft">{campaign.subject}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${STATUS_BADGE[status] ?? "bg-slate-100 text-slate-600"}`}>
              {status.charAt(0) + status.slice(1).toLowerCase()}
            </span>
          </div>

          {/* Campaign details */}
          <div className="rounded-2xl border border-navy/8 bg-white p-6 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Details</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-semibold text-navy">From</p>
                <p className="text-ink-soft">{campaign.fromName}</p>
              </div>
              <div>
                <p className="font-semibold text-navy">Subject</p>
                <p className="text-ink-soft">{campaign.subject}</p>
              </div>
              {campaign.sentAt && (
                <div>
                  <p className="font-semibold text-navy">Sent</p>
                  <p className="text-ink-soft">
                    {new Date(campaign.sentAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                  </p>
                </div>
              )}
              {status === "SENT" && (
                <div>
                  <p className="font-semibold text-navy">Recipients</p>
                  <p className="text-ink-soft">{campaign.sends.length} total</p>
                </div>
              )}
            </div>
          </div>

          {/* Delivery stats — only shown once the campaign has been sent */}
          {status === "SENT" && campaign.sends.length > 0 && (
            <div className="rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-ink-soft">Delivery stats</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-extrabold text-navy">{deliveryRate}%</p>
                  <p className="mt-0.5 text-xs text-ink-soft">Delivered</p>
                  <p className="text-xs text-ink-soft">{sentCount} of {campaign.sends.length}</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-navy">{openRate}%</p>
                  <p className="mt-0.5 text-xs text-ink-soft">Opened</p>
                  <p className="text-xs text-ink-soft">{openedCount} of {sentCount}</p>
                </div>
                <div>
                  <p className={`text-2xl font-extrabold ${failedCount > 0 ? "text-red-600" : "text-navy"}`}>{failedCount}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">Failed</p>
                  <p className="text-xs text-ink-soft">{failedCount > 0 ? "check contacts" : "none"}</p>
                </div>
              </div>
            </div>
          )}

          {/* Send action */}
          {status === "DRAFT" && (
            <div className="rounded-2xl border border-navy/8 bg-white p-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Send</h2>
              <p className="mt-2 text-sm text-ink-soft">
                This will email all {contactCount} of your contacts. Once sent, it can't be unsent.
              </p>
              {sendResult && (
                <p className={`mt-3 text-sm font-semibold ${sendResult.ok ? "text-green-700" : "text-red-600"}`}>
                  {sendResult.text}
                </p>
              )}
              <button
                onClick={handleSend}
                disabled={sending || contactCount === 0}
                className="mt-4 rounded-xl bg-navy px-6 py-2.5 text-sm font-bold text-white hover:bg-navy-dark disabled:opacity-50"
              >
                {sending ? "Sending…" : `Send to ${contactCount} contact${contactCount !== 1 ? "s" : ""}`}
              </button>
              {contactCount === 0 && (
                <p className="mt-2 text-xs text-ink-soft">
                  <Link href="/account/provider/contacts" className="underline underline-offset-2 hover:text-navy">
                    Add contacts
                  </Link>{" "}
                  before sending.
                </p>
              )}
            </div>
          )}

          {/* Send result banner after sending */}
          {status === "SENT" && sendResult?.ok && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-sm font-semibold text-green-800">{sendResult.text}</p>
            </div>
          )}

          {/* Email preview */}
          <div className="rounded-2xl border border-navy/8 bg-white p-6">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-widest text-ink-soft">Email preview</h2>
            <div
              className="prose prose-sm max-w-none text-sm text-ink"
              dangerouslySetInnerHTML={{ __html: campaign.htmlBody }}
            />
          </div>

          {/* Send history */}
          {campaign.sends.length > 0 && (
            <div className="rounded-2xl border border-navy/8 bg-white">
              <div className="border-b border-navy/8 px-5 py-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-ink-soft">Recipients</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy/8 text-left text-xs font-bold uppercase tracking-widest text-ink-soft">
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Sent at</th>
                    <th className="px-5 py-3">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.sends.map((s) => {
                    const name = [s.contact.firstName, s.contact.lastName].filter(Boolean).join(" ") || s.contact.email;
                    return (
                      <tr key={s.id} className="border-b border-navy/5 last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-navy">{name}</p>
                          {(s.contact.firstName || s.contact.lastName) && (
                            <p className="text-xs text-ink-soft">{s.contact.email}</p>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${SEND_STATUS_BADGE[s.status] ?? "bg-slate-100 text-slate-500"}`}>
                            {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-ink-soft">
                          {s.sentAt ? new Date(s.sentAt).toLocaleString() : "—"}
                        </td>
                        <td className="px-5 py-3">
                          {s.openedAt ? (
                            <span className="text-xs font-semibold text-green-700">
                              {new Date(s.openedAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-soft">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </section>
    </>
  );
};

ProviderCampaignDetailPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default ProviderCampaignDetailPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=/account/provider/campaigns/${ctx.params?.id}`, permanent: false } };
  }
  if (session.user.role !== "PROVIDER") {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  const { id } = ctx.params ?? {};
  if (typeof id !== "string") return { notFound: true };

  const [campaignRes, contactsRes] = await Promise.all([
    fetch(`${process.env.NEXTAUTH_URL}/api/provider/campaigns/${id}`, {
      headers: { cookie: ctx.req.headers.cookie ?? "" },
    }),
    fetch(`${process.env.NEXTAUTH_URL}/api/provider/contacts`, {
      headers: { cookie: ctx.req.headers.cookie ?? "" },
    }),
  ]);

  if (!campaignRes.ok) return { notFound: true };

  const campaignData = await campaignRes.json();
  const contactsData = contactsRes.ok ? await contactsRes.json() : { contacts: [] };

  return {
    props: {
      campaign: campaignData.campaign,
      contactCount: (contactsData.contacts ?? []).length,
    },
  };
};
