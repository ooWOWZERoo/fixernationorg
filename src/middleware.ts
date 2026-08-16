import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const DESIGN_COOKIE = "fn_design_preview";
const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN"]);

// User-agents that are never legitimate browsers submitting forms
const BOT_UA_PATTERNS = [
  /python-requests/i,
  /go-http-client/i,
  /scrapy/i,
  /wget\//i,
  /curl\//i,
  /libwww-perl/i,
  /masscan/i,
  /zgrab/i,
  /nikto/i,
  /sqlmap/i,
];

// Public POST endpoints that should never be hit by headless scripts
const BOT_GUARDED_PATHS = new Set([
  "/api/public/subscribe",
  "/api/contact",
  "/api/ask-the-fixer",
  "/api/auth/register",
  "/api/auth/forgot-password",
]);

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Bot protection on public POST endpoints ──────────────────────────────────
  if (req.method === "POST" && BOT_GUARDED_PATHS.has(pathname)) {
    const ua = req.headers.get("user-agent") ?? "";
    if (!ua || BOT_UA_PATTERNS.some((p) => p.test(ua))) {
      // Silently succeed so bots don't know they were blocked
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }

  // ── HTTPS enforcement ───────────────────────────────────────────────────────
  const proto = req.headers.get("x-forwarded-proto");
  if (proto === "http") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
  }

  // ── Admin route gate ────────────────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });
    if (!token) {
      return NextResponse.redirect(
        new URL(`/signin?from=${encodeURIComponent(pathname)}`, req.url)
      );
    }
    // Fallback for pre-SP45 JWTs where adminRole wasn't yet in the token:
    // token.role still holds "ADMIN"/"SUPER_ADMIN" from before the migration.
    const effectiveAdminRole = (token.adminRole as string) ||
      (ADMIN_ROLES.has(token.role as string) ? token.role : "NONE");
    if (!ADMIN_ROLES.has(effectiveAdminRole as string)) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // ── Admin API gate ──────────────────────────────────────────────────────────
  if (pathname.startsWith("/api/admin")) {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });
    if (!token) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const effectiveAdminRole = (token.adminRole as string) ||
      (ADMIN_ROLES.has(token.role as string) ? token.role : "NONE");
    if (!ADMIN_ROLES.has(effectiveAdminRole as string)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ── Design system preview gate ──────────────────────────────────────────────
  if (
    pathname.startsWith("/design") &&
    !pathname.startsWith("/design/unlock")
  ) {
    const expected = process.env.DESIGN_PREVIEW_PASSWORD;
    if (expected) {
      const cookie = req.cookies.get(DESIGN_COOKIE);
      if (cookie?.value !== expected) {
        return NextResponse.redirect(
          new URL(
            `/design/unlock?from=${encodeURIComponent(pathname)}`,
            req.url
          )
        );
      }
    }
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
