import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Provider } from "next-auth/providers";

import { db } from "@/server/db";
import { authConfig } from "@/server/auth/config";
import { fakeVerifyDelay, verifyPassword } from "@/server/auth/password";
import { loginSchema } from "@/features/auth/schema";

/**
 * Full Auth.js configuration — adapter, providers and credential
 * verification. Node runtime only; middleware uses `config.ts` instead.
 */

function buildProviders(): Provider[] {
  const providers: Provider[] = [
    Credentials({
      id: "credentials",
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      /**
       * Returning `null` is the only failure signal Auth.js accepts, so every
       * rejection below looks identical from the outside. That is deliberate:
       * distinguishing "no such account" from "wrong password" hands an
       * attacker a list of which emails are registered.
       */
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) {
          await fakeVerifyDelay();
          return null;
        }

        const user = await db.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            passwordHash: true,
            emailVerified: true,
            deletedAt: true,
          },
        });

        // No account, a deleted account, or an OAuth-only account with no
        // password set. Burn the same time either way.
        if (!user || user.deletedAt || !user.passwordHash) {
          await fakeVerifyDelay();
          return null;
        }

        if (user.status !== "ACTIVE") {
          await fakeVerifyDelay();
          return null;
        }

        const valid = await verifyPassword(user.passwordHash, parsed.data.password);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ];

  // Google is registered only when both halves of the credential are present.
  // An unconfigured provider is a valid state, not an error — it simply means
  // the "Continue with Google" button is not offered.
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      Google({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: false,
        profile(profile) {
          return {
            id: profile.sub,
            email: profile.email,
            name: profile.name,
            image: profile.picture,
            // Google has already verified the address; trusting it here saves
            // sending our own confirmation mail.
            emailVerified: profile.email_verified ? new Date() : null,
            role: "STUDENT" as const,
          };
        },
      }),
    );
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: buildProviders(),

  events: {
    /**
     * A user created through an OAuth flow bypasses the registration action,
     * so the rows that action would have made are created here instead.
     */
    async createUser({ user }) {
      if (!user.id) return;
      await db.$transaction([
        db.profile.create({ data: { userId: user.id } }),
        db.streak.create({ data: { userId: user.id } }),
      ]);
    },
  },
});

/** Whether the Google button should be rendered. Server-side only. */
export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);
