import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";

export function NetworkTabBar() {
  const router = useRouter();
  const { data: session } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!session) return;
    const fetch_ = () =>
      fetch("/api/network/messages/unread")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setUnread(d.count));
    fetch_();
    const interval = setInterval(fetch_, 30000);
    return () => clearInterval(interval);
  }, [session]);

  const isFeed = router.pathname === "/network";
  const isGroups = router.pathname.startsWith("/network/groups");
  const isMessages = router.pathname.startsWith("/network/messages");

  const tab = (active: boolean, label: React.ReactNode) =>
    active
      ? "border-b-[3px] border-amber pb-3 text-sm font-bold text-navy"
      : "border-b-[3px] border-transparent pb-3 text-sm font-bold text-ink-soft no-underline hover:text-navy";

  return (
    <div className="mt-8 flex gap-8">
      <Link href="/network" className={tab(isFeed, null)}>
        Feed
      </Link>
      <Link href="/network/groups" className={tab(isGroups, null)}>
        Groups
      </Link>
      <Link href="/network/messages" className={`relative ${tab(isMessages, null)}`}>
        Messages
        {session && unread > 0 && (
          <span className="absolute -right-3 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-bold text-navy-dark">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Link>
    </div>
  );
}
