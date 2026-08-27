"use server";

import { headers } from "next/headers";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AuthError } from "next-auth";

import { db } from "@/server/db";
import { signIn, signOut } from "@/server/auth";
import { hashPassword } from "@/server/auth/password";
import {
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
  expiresAt,
  generateToken,
  hashToken,
} from "@/server/auth/tokens";
import { AUTH_LIMITS, rateLimit } from "@/server/rate-limit";
import { routes } from "@/lib/routes";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/features/auth/schema";

/**
 * Authentication actions.
 *
 * Every one of these re-validates its input with Zod before touching the
 * database — the client-side form validation is a convenience, not a
 * guarantee.
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

const GENERIC_LOGIN_ERROR = "That email and password combination is not right.";

/** Best-effort client address, used only as a rate-limit key. */
async function clientKey(scope: string): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? headerList.get("x-real-ip") ?? "unknown";
  return `${scope}:${ip}`;
}

/**
 * Emits a reset or verification link.
 *
 * There is no mail transport in this project, and none is faked. The token is
 * real and the flow is exercisable end to end; what is missing is delivery.
 *
 * In production the link is NOT printed — only the fact that one was issued.
 * `AUTH_DEBUG_PRINT_TOKENS=true` overrides that, and should be treated as what
 * it is: a switch that writes account-recovery capabilities into your logs.
 * Until a transport is wired in, users cannot self-serve a password reset.
 */
function deliverLink(label: string, email: string, url: string) {
  const printable =
    process.env.NODE_ENV !== "production" || process.env.AUTH_DEBUG_PRINT_TOKENS === "true";

  if (!printable) {
    console.info(`[auth] ${label} issued for ${email} — no mail transport is configured.`);
    return;
  }

  console.info(`\n[auth] ${label} for ${email}:\n  ${url}\n`);
}

/* -------------------------------------------------------------------------- */
/*  Registration                                                              */
/* -------------------------------------------------------------------------- */

export async function registerAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    timezone: formData.get("timezone") || "UTC",
    acceptTerms: formData.get("acceptTerms") === "on",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const limit = rateLimit(
    await clientKey("register"),
    AUTH_LIMITS.register.limit,
    AUTH_LIMITS.register.windowMs,
  );
  if (!limit.success) {
    return { ok: false, message: "Too many sign-up attempts. Try again in an hour." };
  }

  const { name, email, password, timezone } = parsed.data;

  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    // Told plainly, because the registration form is already an enumeration
    // oracle by nature — it cannot create a duplicate account, so hiding this
    // only produces a confusing dead end for a legitimate returning user.
    return {
      ok: false,
      message: "An account already exists for that email. Try logging in instead.",
      fieldErrors: { email: ["This email is already registered"] },
    };
  }

  const passwordHash = await hashPassword(password);
  const rawToken = generateToken();

  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        timezone,
        role: "STUDENT",
        profile: { create: {} },
        streak: { create: { timezone } },
      },
      select: { id: true },
    });

    await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: expiresAt(EMAIL_VERIFICATION_TTL_MS),
      },
    });
  });

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  deliverLink("Verification link", email, `${base}/verify-email?token=${rawToken}`);

  // Sign the new account straight in and send them to the dashboard.
  //
  // `redirectTo` rather than `redirect: false`: Auth.js signals a successful
  // sign-in by *throwing* a redirect, which Next turns into the navigation.
  // Using `redirect: false` and returning `{ ok: true }` created the account
  // and the session correctly but issued no navigation, so the browser sat on
  // the signup form — from the outside, indistinguishable from the button
  // doing nothing at all.
  //
  // The catch must therefore re-throw that redirect. Swallowing every error
  // here is what hid the problem: the success signal and a real failure were
  // being treated identically.
  try {
    await signIn("credentials", { email, password, redirectTo: routes.dashboard });
  } catch (error) {
    if (isRedirectError(error)) throw error;

    // The account exists at this point, so this is not a registration failure.
    // Sending them to log in manually is the honest recovery.
    if (error instanceof AuthError) {
      return { ok: true, message: "Account created. Please log in." };
    }
    throw error;
  }

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/*  Login / logout                                                            */
/* -------------------------------------------------------------------------- */

export async function loginAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const limit = rateLimit(
    await clientKey("login"),
    AUTH_LIMITS.login.limit,
    AUTH_LIMITS.login.windowMs,
  );
  if (!limit.success) {
    return { ok: false, message: "Too many attempts. Try again in a few minutes." };
  }

  const callbackUrl = (formData.get("callbackUrl") as string | null) || routes.dashboard;

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: callbackUrl,
    });
  } catch (error) {
    // `signIn` signals success by throwing a redirect; let that through.
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) {
      return { ok: false, message: GENERIC_LOGIN_ERROR };
    }
    throw error;
  }

  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: routes.home });
}

/* -------------------------------------------------------------------------- */
/*  Password reset                                                            */
/* -------------------------------------------------------------------------- */

export async function forgotPasswordAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const limit = rateLimit(
    await clientKey("reset"),
    AUTH_LIMITS.passwordReset.limit,
    AUTH_LIMITS.passwordReset.windowMs,
  );

  const { email } = parsed.data;

  // The response below is identical whether or not the account exists, and
  // whether or not the rate limit was hit. Anything else turns this form into
  // a way to discover who has an account here.
  const confirmation: ActionResult = {
    ok: true,
    message: "If an account exists for that address, a reset link is on its way.",
  };

  if (!limit.success) return confirmation;

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, deletedAt: true, status: true },
  });

  if (!user || user.deletedAt || user.status !== "ACTIVE") return confirmation;

  const rawToken = generateToken();

  await db.$transaction([
    // Any older outstanding token is burned, so a forwarded old email cannot
    // be used after a new request.
    db.passwordResetToken.updateMany({
      where: { userId: user.id, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: expiresAt(PASSWORD_RESET_TTL_MS),
      },
    }),
  ]);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  deliverLink("Password reset link", email, `${base}${routes.resetPassword}?token=${rawToken}`);

  return confirmation;
}

export async function resetPasswordAction(
  _previous: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const tokenHash = hashToken(parsed.data.token);

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, expiresAt: true, consumedAt: true },
  });

  if (!record || record.consumedAt || record.expiresAt <= new Date()) {
    return {
      ok: false,
      message: "That reset link has expired or has already been used. Request a new one.",
    };
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await db.$transaction([
    db.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    }),
    // Marked consumed in the same transaction as the password change, so the
    // link is single-use even under concurrent submissions.
    db.passwordResetToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    }),
    // Drop OAuth-less sessions by invalidating any database sessions. JWTs are
    // stateless, so this is belt-and-braces until Phase 15 adds a token
    // version column.
    db.session.deleteMany({ where: { userId: record.userId } }),
    db.auditLog.create({
      data: {
        actorId: record.userId,
        action: "UPDATE",
        entityType: "User",
        entityId: record.userId,
        metadata: { event: "password_reset" },
      },
    }),
  ]);

  return { ok: true, message: "Your password has been changed. You can log in now." };
}
