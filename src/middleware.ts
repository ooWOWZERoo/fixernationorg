import { NextRequest, NextResponse } from "next/server";

const DESIGN_COOKIE = "fn_design_preview";

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── HTTPS enforcement ───────────────────────────────────────────────────────
  const proto = req.headers.get("x-forwarded-proto");
  if (proto === "http") {
    const url = req.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 301);
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
