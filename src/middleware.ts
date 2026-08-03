import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const DESIGN_COOKIE = "fn_design_preview";

export default auth((req) => {
  const { pathname } = req.nextUrl;

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
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
