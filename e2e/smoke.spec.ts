import { expect, test, type ConsoleMessage, type Page } from "@playwright/test";

const PASSWORD = process.env.SEED_USER_PASSWORD ?? "coursera-dev-only-password";

async function signIn(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  // `.first()`: these pages stream, and mid-hydration the form can briefly
  // exist twice, which trips strict mode. The server HTML holds exactly one.
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/**
 * A route renders if it painted its own content and logged no page error.
 *
 * The settle wait is not decoration. These pages stream, so `domcontentloaded`
 * and even `networkidle` can both fire while the body still holds nothing but
 * the shared shell and a loading skeleton — which is exactly how an earlier
 * version of this file "passed" against pages that had not rendered at all.
 */
async function renders(page: Page, path: string) {
  const errors: string[] = [];

  // Listeners are detached before returning. Leaving them attached meant every
  // route added another set, and a later route's errors were reported against
  // an earlier one — the test was lying about which page was at fault.
  const onPageError = (error: Error) => errors.push(error.message);
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error" && !/404|Failed to load resource/.test(message.text())) {
      errors.push(message.text());
    }
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);

  await page.goto(path, { waitUntil: "domcontentloaded" });

  // Wait for the loading skeleton to give way to real content.
  await page
    .waitForFunction(() => !document.body.innerText.includes("Loading page"), undefined, {
      timeout: 20_000,
    })
    .catch(() => undefined);
  await page.waitForTimeout(600);

  const text = (await page.locator("body").innerText()).trim();
  page.off("pageerror", onPageError);
  page.off("console", onConsole);
  return { chars: text.length, errors, text };
}

test("guest routes render in a real browser", async ({ page }) => {
  for (const path of ["/", "/courses", "/categories", "/verify", "/login", "/register"]) {
    const { chars, errors } = await renders(page, path);
    console.log(`GUEST ${path.padEnd(14)} chars=${chars} errors=${errors.length}`);
    expect(chars, `${path} rendered only the shell`).toBeGreaterThan(700);
    expect(errors, `${path} logged errors: ${JSON.stringify(errors)}`).toEqual([]);
  }
});

test("student routes render in a real browser", async ({ page }) => {
  await signIn(page, "amara@coursera.test");
  for (const path of [
    "/dashboard",
    "/dashboard/courses",
    "/dashboard/progress",
    "/dashboard/certificates",
    "/wishlist",
    "/orders",
    "/notifications",
    "/profile",
    "/learn/statistics-you-will-actually-use",
    "/courses/writing-for-engineers",
  ]) {
    const { chars, errors } = await renders(page, path);
    console.log(`STUDENT ${path.padEnd(38)} chars=${chars} errors=${errors.length}`);
    expect(chars, `${path} rendered only the shell`).toBeGreaterThan(700);
    expect(errors, `${path} logged errors: ${JSON.stringify(errors)}`).toEqual([]);
  }
});

test("admin routes render in a real browser", async ({ page }) => {
  await signIn(page, "admin@coursera.test");
  for (const path of [
    "/admin",
    "/admin/users",
    "/admin/courses",
    "/admin/categories",
    "/admin/payments",
    "/admin/reports",
    "/studio",
    "/studio/quizzes",
    "/studio/submissions",
  ]) {
    const { chars, errors } = await renders(page, path);
    console.log(`ADMIN ${path.padEnd(20)} chars=${chars} errors=${errors.length}`);
    expect(chars, `${path} rendered only the shell`).toBeGreaterThan(700);
    expect(errors, `${path} logged errors: ${JSON.stringify(errors)}`).toEqual([]);
  }
});
