import Head from "next/head";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAffiliateAccountSnapshot } from "@/lib/affiliate";
import { AccountNav } from "@/components/account/AccountNav";
import {
  AffiliateSnapshotSections,
  type PromoCodeData,
  type TerritoryAssignmentData,
  type CommissionRuleData,
} from "@/components/account/AffiliateSnapshotSections";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Props {
  enrolled: boolean;
  promoCodes: PromoCodeData[];
  territoryAssignments: TerritoryAssignmentData[];
  commissionRules: CommissionRuleData[];
  siteUrl: string;
}

const AffiliateProfilePage: NextPageWithLayout<Props> = ({
  enrolled,
  promoCodes,
  territoryAssignments,
  commissionRules,
  siteUrl,
}) => {
  return (
    <>
      <Head>
        <title>Affiliate Profile — Fixer Nation</title>
      </Head>
      <section className="px-6 py-14 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <AccountNav />

          <p className="mt-6 text-xs font-bold uppercase tracking-widest text-amber-dark">Affiliate</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy">Your affiliate profile</h1>
          <p className="mt-2 text-sm text-ink-soft">
            Your promo code, assigned territory, and commission rate — all in one place.
          </p>

          {!enrolled && (
            <div className="mt-8 rounded-2xl border border-navy/8 bg-white p-6">
              <p className="text-sm text-ink-soft">
                You're not enrolled as an affiliate yet. If you believe this is a mistake, reach out to the Fixer Nation team.
              </p>
            </div>
          )}

          {enrolled && (
            <AffiliateSnapshotSections
              promoCodes={promoCodes}
              territoryAssignments={territoryAssignments}
              commissionRules={commissionRules}
              siteUrl={siteUrl}
            />
          )}
        </div>
      </section>
    </>
  );
};

AffiliateProfilePage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;
export default AffiliateProfilePage;

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent("/account/affiliate")}`, permanent: false } };
  }

  if (session.user.role !== "AFFILIATE") {
    return { redirect: { destination: "/account", permanent: false } };
  }

  const snapshot = await getAffiliateAccountSnapshot(session.user.id);
  const siteUrl = process.env.NEXTAUTH_URL?.replace(/\/$/, "") ?? "https://fixernation.org";

  return {
    props: {
      enrolled: snapshot.assignment !== null,
      promoCodes: snapshot.promoCodes.map((pc) => ({
        id: pc.id,
        code: pc.code,
        status: pc.status,
        discountType: pc.discountType,
        discountValue: parseFloat(String(pc.discountValue)),
        usedCount: pc.usedCount,
        maxUses: pc.maxUses,
      })),
      territoryAssignments: snapshot.territoryAssignments.map((ta) => ({
        id: ta.id,
        status: ta.status,
        territory: {
          name: ta.territory.name,
          type: ta.territory.type,
          scope: ta.territory.scope,
          county: ta.territory.county,
          city: ta.territory.city,
          state: ta.territory.state,
          zip: ta.territory.zip,
          region: ta.territory.region,
          isExclusive: ta.territory.isExclusive,
        },
      })),
      commissionRules: snapshot.commissionRules.map((r) => ({
        id: r.id,
        name: r.name,
        rate: parseFloat(String(r.rate)),
        appliesTo: r.appliesTo,
        active: r.active,
      })),
      siteUrl,
    },
  };
};
