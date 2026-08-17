import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

const STANDALONE: NavItem = { href: "/admin", label: "Dashboard" };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Members",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/applications", label: "Applications" },
      { href: "/admin/message-templates", label: "Message templates" },
    ],
  },
  {
    label: "Territories & affiliates",
    items: [
      { href: "/admin/territories", label: "Territories" },
      { href: "/admin/affiliates", label: "Affiliates" },
      { href: "/admin/commissions", label: "Commissions" },
    ],
  },
  {
    label: "Automations",
    items: [
      { href: "/admin/automations", label: "Journeys" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/blog", label: "Blog" },
      { href: "/admin/resources", label: "Resources" },
      { href: "/admin/morning-boost", label: "Morning Boost" },
      { href: "/admin/questions", label: "Ask The Fixer" },
    ],
  },
  {
    label: "Community",
    items: [
      { href: "/admin/groups", label: "Groups" },
      { href: "/admin/events", label: "Events" },
      { href: "/admin/loyalty", label: "Loyalty" },
      { href: "/admin/contact", label: "Contact" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/products", label: "Products" },
      { href: "/admin/gift-codes", label: "Gift codes" },
      { href: "/admin/memberships", label: "Memberships" },
    ],
  },
  {
    label: "CRM",
    items: [
      { href: "/admin/contacts", label: "Contacts" },
      { href: "/admin/custom-fields", label: "Custom fields" },
      { href: "/admin/lists", label: "Lists" },
      { href: "/admin/campaigns", label: "Campaigns" },
      { href: "/admin/email-templates", label: "Email templates" },
      { href: "/admin/media", label: "Media library" },
      { href: "/admin/newsletter-topics", label: "Newsletter topics" },
      { href: "/admin/suppression", label: "Suppression" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/team", label: "Team" },
      { href: "/admin/settings", label: "Settings" },
      { href: "/admin/audit", label: "Audit log" },
      { href: "/admin/blocked-emails", label: "Blocked emails" },
    ],
  },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const isActive = (href: string, exact = false) =>
    exact
      ? router.pathname === href
      : router.pathname === href || router.pathname.startsWith(href + "/");

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/public/site-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.logoUrl && setLogoUrl(d.logoUrl));
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [router.pathname]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const open = new Set<string>();
    for (const group of NAV_GROUPS) {
      if (group.items.some((item) => isActive(item.href))) {
        open.add(group.label);
      }
    }
    return open;
  });

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const sidebarContent = (
    <>
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-4">
        <Link href="/" className="flex items-center gap-2 no-underline hover:no-underline">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Fixer Nation" className="h-7 w-7 rounded-md bg-white object-contain p-0.5" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-dark text-amber text-sm font-extrabold">
              ✓
            </span>
          )}
          <span className="text-sm font-extrabold text-white">Admin</span>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <Link
          href={STANDALONE.href}
          className={[
            "flex items-center rounded-lg px-3 py-2 text-sm font-bold no-underline transition-colors",
            isActive(STANDALONE.href, true)
              ? "bg-white/15 text-white font-extrabold"
              : "text-white/70 hover:bg-white/10 hover:text-white",
          ].join(" ")}
        >
          {STANDALONE.label}
        </Link>

        <div className="my-2 border-t border-white/10" />

        {NAV_GROUPS.map((group) => {
          const isOpen = openGroups.has(group.label);
          const hasActive = group.items.some((item) => isActive(item.href));
          return (
            <div key={group.label} className="mb-0.5">
              <button
                onClick={() => toggleGroup(group.label)}
                className={[
                  "flex w-full items-center gap-1.5 rounded-lg px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
                  hasActive && !isOpen
                    ? "text-white/80"
                    : "text-white/40 hover:text-white/70",
                ].join(" ")}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 10 10"
                  className="shrink-0 transition-transform duration-150"
                  style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}
                  aria-hidden="true"
                >
                  <path d="M3 2l4 3-4 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {group.label}
              </button>

              {isOpen && (
                <div className="ml-3 mt-0.5 border-l border-white/10 pl-2">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={[
                        "flex items-center rounded-lg px-2.5 py-1.5 text-sm no-underline transition-colors",
                        isActive(item.href)
                          ? "font-extrabold text-white"
                          : "font-medium text-white/60 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="mb-2 rounded-lg px-3 py-2">
          <p className="text-xs font-semibold text-white">{session?.user?.name ?? session?.user?.email}</p>
          <p className="text-xs text-white/50">{session?.user?.role}</p>
        </div>
        <Link
          href="/"
          className="flex items-center rounded-lg px-3 py-2 text-xs font-semibold text-white/60 no-underline hover:text-white transition-colors"
        >
          ← Back to site
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="w-full text-left rounded-lg px-3 py-2 text-xs font-semibold text-white/60 hover:text-white transition-colors"
        >
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar — in-flow, always visible at lg+ */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-navy/10 bg-navy lg:flex">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar — fixed overlay, only rendered when open */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-20 bg-black/50"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-30 flex w-56 flex-col border-r border-navy/10 bg-navy">
            {sidebarContent}
          </aside>
        </>
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-3 border-b border-navy/10 bg-white px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-navy hover:bg-navy/8"
            aria-label="Open navigation"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M2 4.5h14M2 9h14M2 13.5h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
          <span className="text-sm font-extrabold text-navy">Admin</span>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
