import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";

const NAV_LINKS = [
  { href: "/", label: "Home", dropdown: [
    { href: "/about", label: "About" },
  ]},
  { href: "/books", label: "Books" },
  { href: "/blog", label: "Blogs" },
  { href: "/network", label: "Community" },
  { href: "/events", label: "Events" },
  { href: "/providers", label: "Providers", dropdown: [
    { href: "/providers", label: "Find a Provider" },
    { href: "/ambassadors", label: "Find an Ambassador" },
  ]},
  { href: "/join", label: "Join Fixer Nation", dropdown: [
    { href: "/become-a-provider", label: "Become a Provider" },
    { href: "/become-an-ambassador", label: "Become an Ambassador" },
  ]},
  { href: "/ask-the-fixer", label: "Ask The Fixer" },
];

export function SiteHeader() {
  const { data: session } = useSession();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/site-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.logoUrl && setLogoUrl(d.logoUrl));
  }, []);

  useEffect(() => {
    if (!session) return;
    // Seed from the JWT immediately, then refresh from the profile API so
    // avatar updates appear without requiring a re-login.
    if (session.user?.image) setAvatarUrl(session.user.image);
    fetch("/api/account/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.socialProfile?.avatarUrl) setAvatarUrl(d.socialProfile.avatarUrl); });
  }, [session?.user?.id]);

  useEffect(() => {
    if (!session) return;
    const fetchUnread = () =>
      fetch("/api/network/messages/unread")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setUnreadCount(d.count));
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [session]);

  const isActive = (href: string) =>
    href === "/" ? router.pathname === "/" : router.pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-navy/8 bg-white">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6 lg:px-8">

        {/* Brand */}
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 no-underline hover:no-underline"
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Fixer Nation" className="h-12 w-auto max-w-[200px] object-contain" />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-navy text-amber text-xl font-extrabold">
              ✓
            </span>
          )}
          <span className="text-lg font-extrabold tracking-tight text-navy">
            Fixer Nation
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => {
            if (link.dropdown) {
              return (
                <div key={link.href} className="group relative">
                  <Link
                    href={link.href}
                    className={[
                      "block rounded-lg px-3 py-2 text-sm font-bold transition-colors no-underline",
                      isActive(link.href) ? "text-amber-dark" : "text-navy hover:text-navy/70",
                    ].join(" ")}
                  >
                    {link.label}
                  </Link>
                  <div className="absolute left-0 top-full hidden pt-1 group-hover:block z-20">
                    <div className="w-52 overflow-hidden rounded-2xl border border-navy/6 bg-white shadow-[0_24px_50px_-20px_rgba(20,40,56,0.35)]">
                      {link.dropdown.map((sub) => (
                        <Link
                          key={sub.href}
                          href={sub.href}
                          className="block px-4 py-3 text-sm font-semibold text-ink no-underline hover:bg-cream-panel"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }
            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "relative rounded-lg px-3 py-2 text-sm font-bold transition-colors no-underline",
                  isActive(link.href) ? "text-amber-dark" : "text-navy hover:text-navy/70",
                ].join(" ")}
              >
                {link.label}
                {link.href === "/network" && session && unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber px-1 text-[10px] font-bold text-navy-dark">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Auth CTAs + hamburger */}
        <div className="flex items-center gap-3">
          {session ? (
            <div className="relative hidden lg:block">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-navy hover:text-navy/70 transition-colors"
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-navy text-xs font-bold text-amber">
                    {session.user?.name?.[0]?.toUpperCase() ?? "U"}
                  </span>
                )}
                <span>{session.user?.name ?? session.user?.email}</span>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-2xl border border-navy/6 bg-white shadow-[0_24px_50px_-20px_rgba(20,40,56,0.35)]">
                    <Link href="/dashboard" className="block px-4 py-3 text-sm font-semibold text-ink no-underline hover:bg-cream-panel" onClick={() => setUserMenuOpen(false)}>
                      Dashboard
                    </Link>
                    <Link href="/account/profile" className="block px-4 py-3 text-sm font-semibold text-ink no-underline hover:bg-cream-panel" onClick={() => setUserMenuOpen(false)}>
                      My Profile
                    </Link>
                    <Link href="/account" className="block px-4 py-3 text-sm font-semibold text-ink no-underline hover:bg-cream-panel" onClick={() => setUserMenuOpen(false)}>
                      Account Settings
                    </Link>
                    {["ADMIN", "SUPER_ADMIN"].includes(session.user?.adminRole ?? "") && (
                      <Link href="/admin" className="block border-t border-navy/8 px-4 py-3 text-sm font-semibold text-navy no-underline hover:bg-cream-panel" onClick={() => setUserMenuOpen(false)}>
                        Admin Dashboard
                      </Link>
                    )}
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="w-full text-left border-t border-navy/8 px-4 py-3 text-sm font-semibold text-ink hover:bg-cream-panel"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="hidden items-center gap-4 lg:flex">
              <Link
                href="/signin"
                className="text-sm font-bold text-navy no-underline hover:text-navy/70 transition-colors"
              >
                Log In
              </Link>
            </div>
          )}

          {/* Hamburger */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-navy hover:bg-navy/6 lg:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-navy/8 bg-white px-4 pb-4 pt-2 lg:hidden">
          <nav className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <div key={link.href}>
                <Link
                  href={link.href}
                  className={[
                    "block rounded-lg px-3 py-2.5 text-sm font-bold no-underline transition-colors",
                    isActive(link.href) ? "text-amber-dark" : "text-navy hover:bg-cream-panel",
                  ].join(" ")}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
                {link.dropdown?.map((sub) => (
                  <Link
                    key={sub.href}
                    href={sub.href}
                    className={[
                      "block rounded-lg py-2 pl-7 pr-3 text-sm font-semibold no-underline transition-colors",
                      isActive(sub.href) ? "text-amber-dark" : "text-ink-soft hover:bg-cream-panel hover:text-navy",
                    ].join(" ")}
                    onClick={() => setMenuOpen(false)}
                  >
                    {sub.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-navy/8 pt-3">
            {session ? (
              <>
                <Link href="/dashboard" className="rounded-lg px-3 py-2.5 text-sm font-bold text-navy no-underline hover:bg-cream-panel" onClick={() => setMenuOpen(false)}>
                  Dashboard
                </Link>
                <Link href="/account/profile" className="rounded-lg px-3 py-2.5 text-sm font-bold text-navy no-underline hover:bg-cream-panel" onClick={() => setMenuOpen(false)}>
                  My Profile
                </Link>
                {["ADMIN", "SUPER_ADMIN"].includes(session.user?.adminRole ?? "") && (
                  <Link href="/admin" className="rounded-lg px-3 py-2.5 text-sm font-bold text-navy no-underline hover:bg-cream-panel" onClick={() => setMenuOpen(false)}>
                    Admin Dashboard
                  </Link>
                )}
                <button onClick={() => signOut({ callbackUrl: "/" })} className="text-left rounded-lg px-3 py-2.5 text-sm font-bold text-navy hover:bg-cream-panel">
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/signin" className="rounded-lg px-3 py-2.5 text-center text-sm font-bold text-navy no-underline hover:bg-cream-panel" onClick={() => setMenuOpen(false)}>
                Log In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
