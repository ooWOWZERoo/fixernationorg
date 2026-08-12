import Link from "next/link";

const FOOTER_LINKS = {
  Books: [
    { href: "/books", label: "Short Story Series" },
    { href: "/books", label: "Library" },
  ],
  Resources: [
    { href: "/blog", label: "FN Blogs" },
    { href: "/ask-the-fixer", label: "Ask The Fixer" },
  ],
  Community: [
    { href: "/network", label: "FN Network" },
    { href: "/join", label: "Pro Network" },
  ],
  Membership: [
    { href: "/join", label: "Plans & Pricing" },
    { href: "/books", label: "Free w/ Book" },
  ],
  Support: [
    { href: "/about", label: "About" },
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

        <div className="mt-11 border-t border-white/12 pt-6 text-center text-[12.5px] text-white/60">
          &copy; {new Date().getFullYear()} Fixer Nation Issues and Answers. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
