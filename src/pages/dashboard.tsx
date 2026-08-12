import Link from "next/link";
import { GetServerSideProps } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SiteLayout } from "@/components/layout/SiteLayout";
import type { NextPageWithLayout } from "@/types/next";

interface Props {
  name: string | null;
  email: string;
  role: string;
}

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MEMBER: "Member",
  PROVIDER: "Provider",
  AMBASSADOR: "Ambassador",
  CONSUMER: "Guest",
};

const DashboardPage: NextPageWithLayout<Props> = ({ name, email, role }) => {
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const roleLabel = ROLE_LABEL[role] ?? role;

  return (
    <div className="min-h-screen bg-cream py-12 px-4">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-navy">
            Welcome back{name ? `, ${name.split(" ")[0]}` : ""}.
          </h1>
          <p className="mt-1 text-sm text-ink-soft">{email}</p>
        </div>

        {/* Membership card */}
        <div className="mb-6 rounded-2xl border border-navy/10 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Membership
              </p>
              <p className="mt-1 text-xl font-extrabold text-navy">{roleLabel}</p>
            </div>
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-navy text-amber text-xl font-extrabold">
              ✓
            </span>
          </div>
        </div>

        {/* Admin shortcut */}
        {isAdmin && (
          <div className="mb-6 rounded-2xl border border-amber/40 bg-amber/8 p-5">
            <p className="text-sm font-semibold text-navy">
              You have admin access.{" "}
              <Link href="/admin" className="underline underline-offset-2 hover:text-navy-dark">
                Go to Admin Dashboard →
              </Link>
            </p>
          </div>
        )}

        {/* Coming-soon feature tiles */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { label: "Morning Boost Emails", desc: "Daily motivation delivered to your inbox.", soon: false },
            { label: "Ask The Fixer", desc: "Submit a question to our expert network.", href: "/ask-the-fixer", soon: false },
            { label: "FN Blog & Library", desc: "Full access to all articles and resources.", soon: true },
            { label: "Mobile App", desc: "Access Fixer Nation on the go.", soon: true },
          ].map((tile) => (
            <div
              key={tile.label}
              className="rounded-2xl border border-navy/10 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold text-navy">{tile.label}</p>
                {tile.soon && (
                  <span className="shrink-0 rounded-full bg-amber/20 px-2 py-0.5 text-xs font-semibold text-amber-dark">
                    Coming soon
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-soft">{tile.desc}</p>
              {tile.href && (
                <Link
                  href={tile.href}
                  className="mt-3 inline-block text-xs font-semibold text-navy underline underline-offset-2 hover:text-navy-dark no-underline"
                >
                  Go →
                </Link>
              )}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

DashboardPage.getLayout = (page) => <SiteLayout>{page}</SiteLayout>;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { redirect: { destination: `/signin?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`, permanent: false } };
  }

  return {
    props: {
      name: session.user.name ?? null,
      email: session.user.email ?? "",
      role: session.user.role,
    },
  };
};

export default DashboardPage;
