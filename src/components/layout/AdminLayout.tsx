import Link from "next/link";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/groups", label: "Groups" },
  { href: "/admin/morning-boost", label: "Morning Boost" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/questions", label: "Ask The Fixer" },
  { href: "/admin/settings", label: "Settings" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session } = useSession();
  const router = useRouter();

  const isActive = (href: string, exact?: boolean) =>
    exact ? router.pathname === href : router.pathname.startsWith(href);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-navy/10 bg-navy">
        <div className="flex h-14 items-center gap-2.5 border-b border-white/10 px-4">
          <Link href="/" className="flex items-center gap-2 no-underline hover:no-underline">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-dark text-amber text-sm font-extrabold">
              ✓
            </span>
            <span className="text-sm font-extrabold text-white">Admin</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-0.5 p-3">
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "flex items-center rounded-lg px-3 py-2 text-sm font-bold no-underline transition-colors",
                isActive(item.href, item.exact)
                  ? "bg-white/15 text-white font-extrabold"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
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
      </aside>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1 p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
