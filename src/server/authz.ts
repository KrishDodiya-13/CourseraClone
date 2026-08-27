import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";

import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { routes } from "@/lib/routes";
import type { UserRole } from "@/features/viewer/types";

/**
 * Server-side authorization.
 *
 * The rule this file exists to enforce, from the Phase 0 plan: **middleware is
 * for redirects, not security**. Middleware runs on the edge, sees only a
 * signed token, and knows nothing about ownership or enrolment. Every one of
 * these helpers re-reads the session server-side and, where a relationship is
 * involved, checks it against the database.
 *
 * Nothing here trusts a role sent by the client, and nothing here trusts the
 * session token on its own either. The token proves *who* signed in; the
 * account row decides whether they may still act and in what capacity. For
 * anything resource-specific the role is not consulted at all — the actual row
 * is.
 *
 * Two flavours, deliberately:
 *  - `require*` / `verify*` REDIRECT. Use them in pages and layouts, where a
 *    redirect is the correct user experience.
 *  - `assert*` THROW an {@link AuthorizationError}. Use them in Server Actions
 *    and route handlers, where a redirect would be swallowed.
 *  - `check*` return a boolean, for deciding what to render.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  emailVerified: Date | null;
}

export class AuthorizationError extends Error {
  readonly code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND";

  constructor(code: AuthorizationError["code"], message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/*  Session                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Re-reads the account behind a session token.
 *
 * The JWT is signed and therefore not forgeable, but it is also a *snapshot*:
 * it carries whatever the role and identity were at sign-in and keeps carrying
 * them for the token's whole 30-day life. Trusting it alone meant three things
 * that only look fine until someone tests them — a suspended account kept full
 * access to paid content, a demoted admin kept the admin console, and a
 * soft-deleted account kept everything. All three were verified before this
 * lookup existed.
 *
 * So the account is re-read on every request. `cache()` scopes that to a single
 * render pass, so a page calling `requireAuth` in its layout and three more
 * times in its components costs one primary-key lookup, not four. That is the
 * price of a moderation decision taking effect immediately rather than in a
 * month, and it is worth paying.
 */
const readAccount = cache(async (userId: string) => {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      emailVerified: true,
      deletedAt: true,
    },
  });
});

/**
 * The current user, or null. Never redirects — use this when a page renders
 * differently for guests rather than refusing them.
 *
 * Returns null for an account that has since been suspended, deactivated or
 * deleted, so every caller treats a revoked session exactly as it treats no
 * session at all.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const account = await readAccount(session.user.id);
  if (!account || account.deletedAt !== null || account.status !== "ACTIVE") return null;

  return {
    id: account.id,
    email: account.email,
    // Name, role and verification come from the row rather than the token, so
    // a rename or a role change is visible on the next request.
    name: account.name,
    role: account.role,
    emailVerified: account.emailVerified,
  };
}

/* -------------------------------------------------------------------------- */
/*  Authentication                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Requires a signed-in user, or redirects to login.
 *
 * The current path is passed as `callbackUrl` so the user lands back where
 * they were trying to go instead of on a generic dashboard.
 */
export async function requireAuth(callbackUrl?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const target = callbackUrl
      ? `${routes.login}?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : routes.login;
    redirect(target);
  }
  return user;
}

/** Server Action equivalent of {@link requireAuth}. */
export async function assertAuth(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthorizationError("UNAUTHENTICATED", "You need to be signed in.");
  }
  return user;
}

/* -------------------------------------------------------------------------- */
/*  Roles                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * ADMIN satisfies every role check. An admin who cannot open an instructor
 * page cannot moderate it, which makes Phase 15 moderation impossible.
 */
function roleSatisfies(actual: UserRole, allowed: readonly UserRole[]): boolean {
  if (actual === "ADMIN") return true;
  return allowed.includes(actual);
}

export async function requireRole(
  allowed: readonly UserRole[],
  callbackUrl?: string,
): Promise<SessionUser> {
  const user = await requireAuth(callbackUrl);
  if (!roleSatisfies(user.role, allowed)) {
    redirect(routes.unauthorized);
  }
  return user;
}

export async function assertRole(allowed: readonly UserRole[]): Promise<SessionUser> {
  const user = await assertAuth();
  if (!roleSatisfies(user.role, allowed)) {
    throw new AuthorizationError("FORBIDDEN", "You do not have access to this.");
  }
  return user;
}

export function requireInstructor(callbackUrl?: string): Promise<SessionUser> {
  return requireRole(["INSTRUCTOR"], callbackUrl);
}

export function assertInstructor(): Promise<SessionUser> {
  return assertRole(["INSTRUCTOR"]);
}

export function requireAdmin(callbackUrl?: string): Promise<SessionUser> {
  return requireRole(["ADMIN"], callbackUrl);
}

export function assertAdmin(): Promise<SessionUser> {
  return assertRole(["ADMIN"]);
}

/** Non-redirecting predicate, for deciding what to render. */
export async function checkRole(allowed: readonly UserRole[]): Promise<boolean> {
  const user = await getSessionUser();
  return user ? roleSatisfies(user.role, allowed) : false;
}

/* -------------------------------------------------------------------------- */
/*  Resource ownership                                                        */
/* -------------------------------------------------------------------------- */

export interface EnrollmentAccess {
  enrollmentId: string;
  courseId: string;
  userId: string;
  status: "ACTIVE" | "COMPLETED" | "REFUNDED" | "CANCELLED";
}

/**
 * Confirms the user actually holds an enrolment in this course.
 *
 * This is the check that stands between a paying learner and a paywalled
 * video. It is a database read every time — never a role check, never a value
 * carried in from the page, and never cached across requests.
 *
 * A REFUNDED or CANCELLED enrolment row exists but grants nothing, which is
 * why the status is filtered rather than merely fetched.
 */
export async function verifyEnrollment(
  courseId: string,
  userId?: string,
): Promise<EnrollmentAccess> {
  const resolvedUserId = userId ?? (await requireAuth()).id;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: resolvedUserId, courseId } },
    select: { id: true, courseId: true, userId: true, status: true, expiresAt: true },
  });

  const usable =
    enrollment &&
    (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED") &&
    (enrollment.expiresAt === null || enrollment.expiresAt > new Date());

  if (!usable) {
    redirect(routes.unauthorized);
  }

  return {
    enrollmentId: enrollment.id,
    courseId: enrollment.courseId,
    userId: enrollment.userId,
    status: enrollment.status,
  };
}

/** Server Action equivalent of {@link verifyEnrollment}. */
export async function assertEnrollment(
  courseId: string,
  userId?: string,
): Promise<EnrollmentAccess> {
  const resolvedUserId = userId ?? (await assertAuth()).id;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: resolvedUserId, courseId } },
    select: { id: true, courseId: true, userId: true, status: true, expiresAt: true },
  });

  const usable =
    enrollment &&
    (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED") &&
    (enrollment.expiresAt === null || enrollment.expiresAt > new Date());

  if (!usable) {
    throw new AuthorizationError("FORBIDDEN", "You are not enrolled in this course.");
  }

  return {
    enrollmentId: enrollment.id,
    courseId: enrollment.courseId,
    userId: enrollment.userId,
    status: enrollment.status,
  };
}

/** Non-redirecting enrolment check, for gating UI. */
export async function checkEnrollment(courseId: string, userId?: string): Promise<boolean> {
  const resolvedUserId = userId ?? (await getSessionUser())?.id;
  if (!resolvedUserId) return false;

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: resolvedUserId, courseId } },
    select: { status: true, expiresAt: true },
  });

  return Boolean(
    enrollment &&
    (enrollment.status === "ACTIVE" || enrollment.status === "COMPLETED") &&
    (enrollment.expiresAt === null || enrollment.expiresAt > new Date()),
  );
}

export interface CourseOwnership {
  courseId: string;
  userId: string;
  role: "OWNER" | "CO_INSTRUCTOR" | "ASSISTANT";
  isAdminOverride: boolean;
}

/**
 * Confirms the user may edit this course.
 *
 * Being an INSTRUCTOR is necessary but nowhere near sufficient — it says you
 * may teach *something*, not that you may edit *this*. The real check is a row
 * in `course_instructors` joining this user to this course.
 *
 * Admins pass for moderation, and the result records that it was an override
 * so the caller can write a distinguishable audit entry.
 */
export async function verifyCourseOwnership(
  courseId: string,
  userId?: string,
): Promise<CourseOwnership> {
  const user = userId ? { id: userId, role: "INSTRUCTOR" as UserRole } : await requireAuth();

  const link = await db.courseInstructor.findUnique({
    where: { courseId_userId: { courseId, userId: user.id } },
    select: { role: true },
  });

  if (link) {
    return { courseId, userId: user.id, role: link.role, isAdminOverride: false };
  }

  if (user.role === "ADMIN") {
    const exists = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (exists) {
      return { courseId, userId: user.id, role: "OWNER", isAdminOverride: true };
    }
  }

  redirect(routes.unauthorized);
}

/** Server Action equivalent of {@link verifyCourseOwnership}. */
export async function assertCourseOwnership(
  courseId: string,
  userId?: string,
): Promise<CourseOwnership> {
  const user = userId ? { id: userId, role: "INSTRUCTOR" as UserRole } : await assertAuth();

  const link = await db.courseInstructor.findUnique({
    where: { courseId_userId: { courseId, userId: user.id } },
    select: { role: true },
  });

  if (link) {
    return { courseId, userId: user.id, role: link.role, isAdminOverride: false };
  }

  if (user.role === "ADMIN") {
    const exists = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
    if (exists) {
      return { courseId, userId: user.id, role: "OWNER", isAdminOverride: true };
    }
  }

  throw new AuthorizationError("FORBIDDEN", "You do not have access to this course.");
}

/** Non-redirecting ownership check, for gating UI. */
export async function checkCourseOwnership(courseId: string, userId?: string): Promise<boolean> {
  const user = userId ? { id: userId, role: "INSTRUCTOR" as UserRole } : await getSessionUser();
  if (!user) return false;

  const link = await db.courseInstructor.findUnique({
    where: { courseId_userId: { courseId, userId: user.id } },
    select: { courseId: true },
  });

  if (link) return true;
  if (user.role !== "ADMIN") return false;

  const exists = await db.course.findUnique({ where: { id: courseId }, select: { id: true } });
  return Boolean(exists);
}
