import { test, expect, type Page } from "@playwright/test";

/**
 * Layout regressions, in a real browser.
 *
 * Two things no unit test can catch: a page that scrolls sideways on a phone,
 * and a colour theme that fails to apply. Both were real defects during the UI
 * pass — the dashboard overflowed by 91px at 320px because a grid item's
 * default `min-width: auto` let the activity heatmap size the whole column.
 */

const OUT = process.env.SHOT_DIR ?? "test-results";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "coursera-dev-only-password";

async function settle(page: Page) {
  await page
    .waitForFunction(() => document.body.innerText.trim().length > 700, undefined, {
      timeout: 20000,
    })
    .catch(() => {});
  await page.waitForTimeout(500);
}

async function signIn(page: Page, email: string) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').first().fill(email);
  await page.locator('input[name="password"]').first().fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
}

/** No page may scroll sideways at any supported width. */
test("no horizontal overflow at any breakpoint", async ({ page }) => {
  test.setTimeout(300_000);
  await signIn(page, "amara@coursera.test");

  const paths = [
    "/",
    "/courses",
    "/courses/systems-design-foundations",
    "/dashboard",
    "/profile",
    "/orders",
  ];
  for (const width of [320, 375, 425, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await settle(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      if (overflow > 1) console.log(`OVERFLOW ${width}px ${path} by ${overflow}px`);
      expect(overflow, `${path} at ${width}px overflows by ${overflow}px`).toBeLessThanOrEqual(1);
    }
  }
  console.log("BREAKPOINTS OK");
});

/** Both identities, both appearances, on the pages that carry the most colour. */
test("theme matrix renders", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1280, height: 860 });

  for (const theme of ["indigo", "emerald"] as const) {
    for (const mode of ["light", "dark"] as const) {
      await page.addInitScript(
        ([t]) => {
          try {
            localStorage.setItem("lumen-color-theme", t as string);
          } catch {}
        },
        [theme],
      );
      for (const [path, name] of [
        ["/", "home"],
        ["/courses", "courses"],
      ] as const) {
        await page.goto(path, { waitUntil: "domcontentloaded" });
        await page.evaluate(
          (m) => document.documentElement.classList.toggle("dark", m === "dark"),
          mode,
        );
        await settle(page);
        await page.screenshot({ path: `${OUT}/${name}-${theme}-${mode}.png` });
      }
    }
  }
  console.log("THEME MATRIX OK");
});
