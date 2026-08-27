import type { NextAuthConfig } from "next-auth";

import type { UserRole } from "@/features/viewer/types";

/**
 * Edge-safe Auth.js configuration.
 *
 * Middleware runs on the edge runtime, where Prisma cannot. This half of the
 * config carries only what is needed to *decode* a session JWT — no adapter,
 * no database, no credential verification. The full configuration in
 * `index.ts` spreads this and adds the parts that need Node.
 *
 * Session strategy is JWT rather than database-backed. That is not incidental:
 * the Credentials provider requires it, and it also means middleware and every
 * server component can read the viewer's role without a query per request. The
 * trade-off is that a role change takes effect on the next token refresh
 * rather than instantly — acceptable, because role changes are rare and
 * administrative, and because nothing is authorised on the token alone.
 */
export const authConfig = {
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },

  /**
   * Required for self-hosting: outside development Auth.js refuses to derive
   * callback URLs from the Host header unless told the host is trustworthy.
   *
   * The security caveat is real. Trusting Host means a request that forges it
   * could steer a redirect, so the deployment must sit behind a proxy that
   * sets Host itself and rejects arbitrary values. If that cannot be
   * guaranteed, set AUTH_URL to the canonical origin instead and drop this —
   * an explicit URL is never spoofable.
   */
  trustHost: true,

  pages: {
    signIn: "/login",
    error: "/login",
    newUser: "/dashboard",
  },

  callbacks: {
    /**
     * Copies identity onto the token at sign-in, then refreshes it whenever
     * `update()` is called. `user` is only present on the first call.
     */
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
        token.role = (user as { role?: UserRole }).role ?? "STUDENT";
        token.emailVerified = (user as { emailVerified?: Date | null }).emailVerified ?? null;
      }

      if (trigger === "update" && session) {
        const next = session as { role?: UserRole; name?: string };
        if (next.role) token.role = next.role;
        if (next.name) token.name = next.name;
      }

      return token;
    },

    /**
     * Projects the token onto the session object handed to server code.
     *
     * This is a convenience, never a permission. Every guard in `authz.ts`
     * re-reads the role from here and then checks the specific relationship in
     * the database before granting anything.
     */
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string | undefined) ?? token.sub ?? "";
        session.user.role = (token.role as UserRole | undefined) ?? "STUDENT";
        session.user.emailVerified = (token.emailVerified as Date | null | undefined) ?? null;
      }
      return session;
    },
  },

  // Providers are added in `index.ts`; middleware only decodes tokens.
  providers: [],
} satisfies NextAuthConfig;
