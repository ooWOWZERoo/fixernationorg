import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

export function AccountNav() {
  const { data: session } = useSession();
  const router = useRouter();
  const role = session?.user?.role ?? "CONSUMER";
  const isProvider = role === "PROVIDER";
  const isAmbassador = role === "AMBASSADOR";

  const cls = (href: string) => {
    const active =
      href === "/account"
        ? router.pathname === "/account"
        : router.pathname === href || router.pathname.startsWith(href + "/");
    return active
      ? "text-sm font-semibold text-navy no-underline"
      : "text-sm font-semibold text-ink-soft no-underline hover:text-navy";
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Link href="/account/home" className={cls("/account/home")}>
        Home
      </Link>
      <Link href="/account/profile" className={cls("/account/profile")}>
        My Profile
      </Link>
      <Link href="/account" className={cls("/account")}>
        Account Settings
      </Link>
      <Link href="/account/security" className={cls("/account/security")}>
        Security
      </Link>
      {isProvider && (
        <>
          <Link href="/account/business" className={cls("/account/business")}>
            Business profile
          </Link>
          <Link href="/account/provider/contacts" className={cls("/account/provider/contacts")}>
            My contacts
          </Link>
          <Link href="/account/provider/campaigns" className={cls("/account/provider/campaigns")}>
            My campaigns
          </Link>
        </>
      )}
      {isAmbassador && (
        <>
          <Link href="/account/ambassador" className={cls("/account/ambassador")}>
            Ambassador profile
          </Link>
          <Link href="/account/ambassador/materials" className={cls("/account/ambassador/materials")}>
            Campaign materials
          </Link>
          <Link href="/account/referrals" className={cls("/account/referrals")}>
            Referrals
          </Link>
          <Link href="/account/commissions" className={cls("/account/commissions")}>
            Commissions
          </Link>
        </>
      )}
      <Link href="/account/my-plan" className={cls("/account/my-plan")}>
        My Plan
      </Link>
      <Link href="/account/focus" className={cls("/account/focus")}>
        Focus &amp; Goals
      </Link>
      <Link href="/account/pathways" className={cls("/account/pathways")}>
        My Pathways
      </Link>
      <Link href="/account/challenges" className={cls("/account/challenges")}>
        My Challenges
      </Link>
      <Link href="/account/checkin" className={cls("/account/checkin")}>
        Daily Check-In
      </Link>
      <Link href="/account/progress" className={cls("/account/progress")}>
        My Progress
      </Link>
      <Link href="/account/reflections" className={cls("/account/reflections")}>
        Reflections
      </Link>
      <Link href="/account/billing" className={cls("/account/billing")}>
        Billing
      </Link>
      <Link href="/account/points" className={cls("/account/points")}>
        Community points
      </Link>
    </div>
  );
}
