import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/server/auth/config";

/**
 * Route protection — redirects only.
 *
 * This exists to save an unauthenticated visitor from loading a dashboard
 * shell before being bounced, and to keep signed-in users off the login page.
 * It is NOT a security boundary: it runs on the edge, reads only a signed
 * token, and cannot know whether this user owns this course. Every protected
 * page and action re-checks authorization server-side via `@/server/authz`.
 *
 * Uses the edge-safe half of the Auth.js config — the Prisma adapter cannot
 * run here.
 */
const { auth } = NextAuth(authConfig);

/**
 * Prefixes that require a session of any role.
 *
 * `/certificates/<serial>` is deliberately absent. A certificate is a
 * credential meant to be shown to someone who does not have an account here —
 * an employer, a client — so gating it behind sign-in would defeat its
 * purpose. The serial is the capability, and it carries 100 bits of entropy.
 * A learner's own list stays behind auth at /dashboard/certificates.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/learn",
  "/wishlist",
  "/notifications",
  "/profile",
  "/settings",
  "/checkout",
  "/orders",
  "/studio",
  "/admin",
];

/** Prefixes that additionally require a role. */
const ROLE_PREFIXES: Array<{ prefix: string; roles: readonly string[] }> = [
  { prefix: "/studio", roles: ["INSTRUCTOR", "ADMIN"] },
  { prefix: "/admin", roles: ["ADMIN"] },
];

/** Signed-in users have no business on these. */
const GUEST_ONLY = ["/login", "/register", "/forgot-password", "/reset-password"];

export default auth((request) => {
  const { pathname, search } = request.nextUrl;
  const session = request.auth;
  const role = session?.user?.role;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !session) {
    const url = new URL("/login", request.nextUrl.origin);
    url.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (session && role) {
    const roleRule = ROLE_PREFIXES.find(
      ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (roleRule && !roleRule.roles.includes(role)) {
      return NextResponse.redirect(new URL("/unauthorized", request.nextUrl.origin));
    }
  }

  if (session && GUEST_ONLY.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.redirect(new URL("/dashboard", request.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  /**
   * Scoped to the routes that actually need a redirect decision.
   *
   * Running it across the whole site meant `auth()` executed — and attached
   * session cookies — on every public page view, including ones that end in a
   * `notFound()`. Committing those headers early is what stopped Next setting
   * a 404 status on missing courses and categories.
   */
  matcher: [
    "/dashboard/:path*",
    "/learn/:path*",
    "/wishlist/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/checkout/:path*",
    "/orders/:path*",
    "/studio/:path*",
    "/admin/:path*",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ],
};
