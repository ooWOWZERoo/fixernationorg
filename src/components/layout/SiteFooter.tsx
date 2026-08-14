import Link from "next/link";

const FOOTER_LINKS = {
  Books: [
    { href: "/books", label: "Short Story Series" },
    { href: "/books", label: "Library" },
  ],
  Resources: [
    { href: "/blog", label: "FN Blog" },
    { href: "/resources", label: "Member Library" },
    { href: "/ask-the-fixer", label: "Ask The Fixer" },
  ],
  Community: [
    { href: "/network", label: "FN Network" },
    { href: "/providers", label: "Find a Provider" },
    { href: "/ambassadors", label: "Find an Ambassador" },
    { href: "/become-a-provider", label: "Become a Provider" },
    { href: "/become-an-ambassador", label: "Become an Ambassador" },
  ],
  Membership: [
    { href: "/join", label: "Plans & Pricing" },
    { href: "/books", label: "Free w/ Book" },
  ],
  Support: [
    { href: "/about", label: "About" },
    { href: "/contact", label: "Contact" },
    { href: "/signin", label: "Log In" },
  ],
};

export function SiteFooter() {
  return (
    <footer className="bg-navy-dark text-white/75">
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-6">

          {/* Brand column */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1">
            <Link href="/" className="flex items-center gap-2.5 no-underline hover:no-underline">
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-navy text-amber text-base font-extrabold">
                ✓
              </span>
              <span className="text-lg font-extrabold tracking-tight text-white">
                Fixer Nation
              </span>
            </Link>
            <p className="mt-3.5 text-sm leading-relaxed text-white/60 max-w-[220px]">
              "There are no problems in life... only issues and answers." — Fixer Nation Credo
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <h4 className="mb-3.5 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/85">
                {group}
              </h4>
              <ul className="space-y-2">
                {links.map((link, i) => (
                  <li key={i}>
                    <Link
                      href={link.href}
                      className="text-[13.5px] text-white/75 no-underline transition-colors hover:text-amber"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-11 border-t border-white/12 pt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between text-[12.5px] text-white/60">
          <span>&copy; {new Date().getFullYear()} Fixer Nation Issues and Answers. All Rights Reserved.</span>
          <div className="flex gap-5">
            <Link href="/privacy" className="text-white/75 underline underline-offset-2 transition-colors hover:text-amber">Privacy policy</Link>
            <Link href="/terms" className="text-white/75 underline underline-offset-2 transition-colors hover:text-amber">Terms of service</Link>
            <Link href="/cookie-policy" className="text-white/75 underline underline-offset-2 transition-colors hover:text-amber">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
