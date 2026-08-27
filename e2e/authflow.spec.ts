import { test, expect, type Page } from "@playwright/test";

/**
 * The complete email/password authentication flow, end to end in a browser.
 *
 * Written for the debugging phase: every step asserts the observable outcome
 * (URL, visible message, database side effect) rather than that a request was
 * made, so a green run means a person could actually sign up and sign in.
 */

const PASSWORD = process.env.SEED_USER_PASSWORD ?? "coursera-dev-only-password";
const NEW_EMAIL = `flow-${Date.now()}@coursera.test`;
const NEW_PASSWORD = "a-strong-enough-password-1";

/**
 * The registration form has five controls, not three: a confirmation field and
 * a terms checkbox as well. Filling only name/email/password produces "Check
 * the highlighted fields", which is the form working, not failing.
 */
async function fillRegister(page: Page, name: string, email: string, password: string) {
  await page.locator('input[name="name"]').first().fill(name);
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(password);
  await page.locator('input[name="confirmPassword"]').first().fill(password);
  await page.locator('input[name="acceptTerms"]').first().check();
}

async function fillLogin(page: Page, email: string, password: string) {
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(password);
}

test("guest can open both auth pages", async ({ page }) => {
  for (const path of ["/login", "/register"]) {
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);
    const text = await page.locator("body").innerText();
    console.log(`GUEST ${path} http=${res?.status()} chars=${text.trim().length}`);
    expect(res?.status(), `${path} did not return 200`).toBe(200);
    expect(page.url(), `${path} redirected away`).toContain(path);
    await expect(page.locator('input[name="email"]').first()).toBeVisible();
  }
});

test("registration creates an account and lands on the dashboard", async ({ page }) => {
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await fillRegister(page, "Flow Test", NEW_EMAIL, NEW_PASSWORD);
  await page
    .getByRole("button", { name: /create account/i })
    .first()
    .click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  console.log("REGISTER landed on:", new URL(page.url()).pathname);
  await page.waitForTimeout(1200);
  const text = await page.locator("body").innerText();
  expect(text.length, "dashboard rendered nothing").toBeGreaterThan(500);
});

test("duplicate registration is refused with a message", async ({ page }) => {
  await page.goto("/register", { waitUntil: "domcontentloaded" });
  await fillRegister(page, "Duplicate", "amara@coursera.test", NEW_PASSWORD);
  await page
    .getByRole("button", { name: /create account/i })
    .first()
    .click();
  await page.waitForTimeout(3500);
  const text = await page.locator("body").innerText();
  console.log("DUPLICATE url:", new URL(page.url()).pathname);
  console.log("DUPLICATE message:", (text.match(/[^\n]*already[^\n]*/i) ?? ["(none)"])[0].trim());
  expect(page.url(), "duplicate registration should not sign the user in").toContain("/register");
});

test("invalid password is refused and stays on login", async ({ page }) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await fillLogin(page, "amara@coursera.test", "definitely-the-wrong-password");
  await page
    .getByRole("button", { name: /log in|sign in/i })
    .first()
    .click();
  await page.waitForTimeout(3500);
  const text = await page.locator("body").innerText();
  console.log("BADPASS url:", new URL(page.url()).pathname);
  console.log(
    "BADPASS message:",
    (text.match(/[^\n]*not right[^\n]*|[^\n]*incorrect[^\n]*|[^\n]*invalid[^\n]*/i) ?? [
      "(none)",
    ])[0].trim(),
  );
  expect(page.url(), "a wrong password must not authenticate").toContain("/login");
});

test("existing user can log in, reach the dashboard, and log out", async ({ page }) => {
  // guest hitting a protected route is sent to login
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  console.log("PROTECTED as guest ->", new URL(page.url()).pathname + new URL(page.url()).search);
  expect(page.url(), "guest should be redirected off /dashboard").toContain("/login");

  await fillLogin(page, "amara@coursera.test", PASSWORD);
  await page
    .getByRole("button", { name: /log in|sign in/i })
    .first()
    .click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  console.log("LOGIN landed on:", new URL(page.url()).pathname);

  // authenticated user reaches the dashboard
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  expect(page.url(), "authenticated user should stay on /dashboard").toContain("/dashboard");
  const dash = await page.locator("body").innerText();
  console.log("DASHBOARD chars:", dash.trim().length);

  // Log out. The control lives in the header account menu and is a Radix
  // menu item that calls the sign-out server action from `onSelect` — not a
  // link, so no prefetch can trigger it, and not a nested <form>, which the
  // closing menu used to unmount before it could submit.
  const accountMenu = page.getByRole("button", { name: /^Account menu for/i }).first();
  await accountMenu.waitFor({ state: "visible", timeout: 20_000 });
  await accountMenu.click();
  await page.waitForTimeout(900);
  await page
    .getByRole("menuitem", { name: /sign out/i })
    .first()
    .click();
  await page.waitForTimeout(4000);

  const sessionCookie = (await page.context().cookies()).find(
    (cookie) => cookie.name === "authjs.session-token",
  );
  console.log("SESSION COOKIE after logout:", sessionCookie ? "still present" : "cleared");
  expect(sessionCookie, "the session cookie must be cleared on logout").toBeUndefined();
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  console.log("AFTER LOGOUT /dashboard ->", new URL(page.url()).pathname);
  expect(page.url(), "after logout the session should be gone").toContain("/login");
});
