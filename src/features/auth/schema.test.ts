import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/features/auth/schema";

const validRegistration = {
  name: "Amara Osei",
  email: "Amara@Example.COM",
  password: "a-long-enough-passphrase",
  confirmPassword: "a-long-enough-passphrase",
  timezone: "Africa/Accra",
  acceptTerms: true as const,
};

describe("registerSchema", () => {
  it("accepts a valid registration and normalises the email", () => {
    const result = registerSchema.safeParse(validRegistration);
    expect(result.success).toBe(true);
    // Emails are lowercased so a user cannot create a second account that
    // differs only in case.
    expect(result.success && result.data.email).toBe("amara@example.com");
  });

  it("rejects mismatched passwords on the confirm field", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      confirmPassword: "something-else-entirely",
    });
    expect(result.success).toBe(false);
    const issue =
      !result.success && result.error.issues.find((i) => i.path[0] === "confirmPassword");
    expect(issue).toBeTruthy();
  });

  it("rejects passwords under 10 characters", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      password: "short1!",
      confirmPassword: "short1!",
    });
    expect(result.success).toBe(false);
  });

  it("requires the terms to be accepted", () => {
    const result = registerSchema.safeParse({ ...validRegistration, acceptTerms: false });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = registerSchema.safeParse({ ...validRegistration, email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts credentials and lowercases the email", () => {
    const result = loginSchema.safeParse({ email: "SAM@Coursera.test", password: "anything" });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe("sam@coursera.test");
  });

  it("does not impose a length rule on the login password", () => {
    // Length is enforced at registration. Applying it here would tell an
    // attacker that short passwords cannot exist.
    const result = loginSchema.safeParse({ email: "sam@coursera.test", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "sam@coursera.test", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("trims surrounding whitespace", () => {
    const result = forgotPasswordSchema.safeParse({ email: "  sam@coursera.test  " });
    expect(result.success).toBe(true);
    expect(result.success && result.data.email).toBe("sam@coursera.test");
  });
});

describe("resetPasswordSchema", () => {
  it("requires a token", () => {
    const result = resetPasswordSchema.safeParse({
      token: "",
      password: "a-long-enough-passphrase",
      confirmPassword: "a-long-enough-passphrase",
    });
    expect(result.success).toBe(false);
  });

  it("requires both passwords to match", () => {
    const result = resetPasswordSchema.safeParse({
      token: "abc",
      password: "a-long-enough-passphrase",
      confirmPassword: "a-different-passphrase",
    });
    expect(result.success).toBe(false);
  });
});
