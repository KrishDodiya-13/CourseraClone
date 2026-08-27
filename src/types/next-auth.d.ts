import type { DefaultSession } from "next-auth";

import type { UserRole } from "@/features/viewer/types";

/**
 * Augments the Auth.js session and JWT with the fields the app puts on them.
 *
 * Without this, `session.user.role` is a type error everywhere and the
 * temptation is to reach for `any`.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      emailVerified: Date | null;
    } & DefaultSession["user"];
  }

  interface User {
    role: UserRole;
    emailVerified?: Date | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    emailVerified: Date | null;
  }
}
