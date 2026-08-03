// Edge-safe auth config — no bcrypt, no Prisma adapter.
// Imported by middleware (Edge Runtime). Full auth.ts is for server-side only.
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const PROTECTED = ["/dashboard", "/account", "/admin"];
      const isProtected = PROTECTED.some((p) =>
        nextUrl.pathname.startsWith(p)
      );
      if (isProtected) return isLoggedIn;
      return true;
    },
  },
  providers: [],
};
