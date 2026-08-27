import { z } from "zod";

/**
 * One set of validators, shared by the client form and the server action.
 *
 * The client copy exists purely to give fast feedback — the server re-parses
 * everything, because anything arriving over the wire is untrusted regardless
 * of what the form did.
 */

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email address")
  .pipe(z.email("Enter a valid email address"))
  .transform((value) => value.toLowerCase());

/**
 * Length is the requirement that actually matters. Character-class rules push
 * people towards "Password1!" — predictable, and no harder to crack than a
 * longer passphrase.
 */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200, "That is longer than 200 characters");

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter your name").max(80, "That is longer than 80 characters"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    /** Captured at signup so streaks use the learner's own day boundary. */
    timezone: z.string().default("UTC"),
    acceptTerms: z.literal(true, {
      error: "You need to accept the terms to continue",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
