import Link from "next/link";
import { useSiteLogoUrl } from "@/hooks/useSiteLogoUrl";

const FOOTER_LINKS = {
  Books: [
    { href: "/books", label: "Short Story Series" },
    { href: "/books", label: "Library" },
  ],
  Resources: [
    { href: "/blog", label: "Blog" },
    { href: "/morning-boost", label: "Morning Boost" },
    { href: "/resources", label: "Member Library" },
    { href: "/ask-the-fixer", label: "Ask The Fixer" },
  ],
  Community: [
    { href: "/network", label: "Community" },
    { href: "/events", label: "Events" },
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
  const logoUrl = useSiteLogoUrl();

  return (
    <footer className="bg-navy-dark text-white/75">
      <div className="mx-auto max-w-6xl px-6 py-14 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-7">

          {/* Brand column — wider, visually separated from nav links */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-2 lg:border-r lg:border-amber/25 lg:pr-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <Link href="/" className="shrink-0 no-underline hover:no-underline">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="Fixer Nation" className="h-28 w-auto max-w-[200px] object-contain brightness-0 invert" />
                ) : (
                  <span className="flex h-14 w-14 items-center justify-center rounded-[12px] bg-navy text-amber text-2xl font-extrabold">
                    ✓
                  </span>
                )}
              </Link>
              <div>
                <span className="block font-serif text-5xl leading-none text-amber opacity-40 select-none">&ldquo;</span>
                <p className="mt-1 text-sm italic leading-relaxed text-white/85">
                  There are no problems in life&hellip; only issues and answers.
                </p>
                <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.1em] text-amber/60">
                  Fixer Nation Credo
                </p>
              </div>
            </div>
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
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="text-white/75 underline underline-offset-2 transition-colors hover:text-amber">Privacy policy</Link>
            <Link href="/terms" className="text-white/75 underline underline-offset-2 transition-colors hover:text-amber">Terms of service</Link>
            <Link href="/cookie-policy" className="text-white/75 underline underline-offset-2 transition-colors hover:text-amber">Cookies</Link>
            <Link href="/developers" className="text-white/75 underline underline-offset-2 transition-colors hover:text-amber">API Reference</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
