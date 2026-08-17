import Head from "next/head";
import Link from "next/link";
import { AccountNav } from "@/components/account/AccountNav";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  fromName: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
  sendCount: number;
}

interface Props {
  campaigns: CampaignRow[];
}

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SENDING: "bg-amber/20 text-amber-dark",
  SENT: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-600",
};

const ProviderCampaignsPage: NextPageWithLayout<Props> = ({ campaigns }) => {
  return (
    <>
      <Head>
        <title>My campaigns — Fixer Nation</title>
      </Head>

      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">

          <AccountNav />

          <div className="mt-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-navy">My campaigns</h1>
              <p className="mt-1 text-sm text-ink-soft">{campaigns.length} total</p>
            </div>
            <Link
              href="/account/provider/campaigns/new"
              className="shrink-0 rounded-xl bg-amber px-4 py-2 text-sm font-bold text-navy-dark no-underline hover:bg-amber-dark"
            >
              + New campaign
            </Link>
          </div>

          <div className="mt-6">
            {campaigns.length === 0 ? (
              <div className="rounded-2xl border border-navy/8 bg-white p-12 text-center">
                <p className="font-semibold text-navy">No campaigns yet.</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Create one to send your first email to your contacts.
                </p>
                <Link
                  href="/account/provider/campaigns/new"
                  className="mt-4 inline-block rounded-xl bg-navy px-5 py-2 text-sm font-bold text-white no-underline hover:bg-navy-dark"
                >
                  Create a campaign
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/account/provider/campaigns/${c.id}`}
                    className="block rounded-2xl border border-navy/8 bg-white p-5 no-underline hover:border-navy/20 hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-navy truncate">{c.name}</p>
                        <p className="mt-0.5 text-sm text-ink-soft truncate">{c.subject}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[c.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {c.status.charAt(0) + c.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-ink-soft">
                      <span>From: {c.fromName}</span>
                      {c.status === "SENT" && c.sentAt && (
                        <span>Sent {new Date(c.sentAt).toLocaleDateString()} · {c.sendCount} recipient{c.sendCount !== 1 ? "s" : ""}</span>
                      )}
                      {c.status === "DRAFT" && (
                        <span>Created {new Date(c.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </section>
    </>
  );
};

ProviderCampaignsPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default ProviderCampaignsPage;

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=/account/provider/campaigns`, permanent: false } };
  }
  if (session.user.role !== "PROVIDER") {
    return { redirect: { destination: "/dashboard", permanent: false } };
  }

  const res = await fetch(`${process.env.NEXTAUTH_URL}/api/provider/campaigns`, {
    headers: { cookie: ctx.req.headers.cookie ?? "" },
  });
  const data = res.ok ? await res.json() : { campaigns: [] };

  return {
    props: { campaigns: data.campaigns ?? [] },
  };
};
