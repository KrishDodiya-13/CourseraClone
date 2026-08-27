import { expect, test, type Page } from "@playwright/test";

/**
 * The offline learning flow, end to end, in a real browser.
 *
 * Service workers, IndexedDB and Cache Storage cannot be meaningfully tested
 * in jsdom — they need a real browser with a real network layer that can be
 * cut. This walks the exact nine steps the phase specifies.
 *
 * Runs against the production build: the service worker is deliberately
 * disabled in development, so `next dev` would test nothing.
 */

const EMAIL = "wei@coursera.test";
const PASSWORD = process.env.SEED_USER_PASSWORD ?? "coursera-dev-only-password";
/** Wei is enrolled in this one; it has article lessons. */
const COURSE_SLUG = "systems-design-foundations";

async function signIn(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  // `.first()` rather than `getByLabel`: this page streams, and on a cold
  // server the form can exist twice for a few milliseconds mid-hydration,
  // which trips Playwright's strict mode. The server HTML always contains
  // exactly one, and so does the settled DOM.
  await page.locator('input[name="email"]').first().fill(EMAIL);
  await page.locator('input[name="password"]').first().fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
}

/** Waits for the service worker to control the page. */
async function waitForServiceWorker(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, undefined, {
    timeout: 30_000,
  });
}

test.describe.configure({ mode: "serial" });

test("downloads a course, works offline, and syncs on reconnect", async ({ page, context }) => {
  // ---------------------------------------------------------------- step 0
  await signIn(page);

  await page.goto(`/learn/${COURSE_SLUG}`);
  await expect(page.getByRole("navigation", { name: "Course contents" })).toBeVisible();

  await waitForServiceWorker(page);

  // ---------------------------------------------------------------- step 1
  // Download.
  const downloadButton = page.getByRole("button", { name: /download for offline/i });
  await expect(downloadButton).toBeVisible({ timeout: 15_000 });
  await downloadButton.click();

  // Scoped to the page: the same words also appear in the confirmation toast.
  await expect(page.locator("#main").getByText("Available offline").first()).toBeVisible({
    timeout: 60_000,
  });

  // The bundle is really in IndexedDB, and really has no video source.
  const stored = await page.evaluate(async () => {
    const open = indexedDB.open("lumen-offline");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const tx = db.transaction("courses", "readonly");
    const all = await new Promise<unknown[]>((resolve, reject) => {
      const request = tx.objectStore("courses").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return JSON.stringify(all);
  });

  expect(stored).toContain("Systems Design Foundations");
  // Article text is present…
  expect(stored).toContain("latency histogram");
  // …and no playback identifier ever is.
  expect(stored).not.toContain("videoPlaybackId");
  expect(stored).not.toContain("seed-playback");

  // ---------------------------------------------------------------- step 2
  // Disable internet.
  //
  // `setOffline` cuts the network at the browser-context level but does not
  // flip `navigator.onLine` in the renderer, so the app's own offline listener
  // never fires. Dispatching the event is what a real browser does when
  // connectivity drops — the network really is severed either way, which is
  // what steps 3 to 6 actually prove.
  await context.setOffline(true);

  // ---------------------------------------------------------------- step 3
  // Open the downloaded course.
  await page.goto("/offline");
  await expect(page.getByRole("navigation", { name: "Downloaded curriculum" })).toBeVisible({
    timeout: 30_000,
  });
  // The connectivity banner is the app-wide offline signal.
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(page.getByText(/You are offline/i).first()).toBeVisible({ timeout: 15_000 });

  // Lesson titles appear both in the sidebar and on the prev/next buttons,
  // so every click below is scoped to the curriculum.
  const curriculum = page.getByRole("navigation", { name: "Downloaded curriculum" });

  // ---------------------------------------------------------------- step 4
  // Read a downloaded lesson.
  await curriculum.getByRole("button", { name: /Reading a latency histogram/i }).click();
  await expect(page.getByRole("heading", { name: /Reading a latency histogram/i })).toBeVisible();
  await expect(page.getByText(/average latency is almost always a lie/i)).toBeVisible();

  // ---------------------------------------------------------------- step 5
  // Video is clearly unavailable rather than broken.
  await curriculum.getByRole("button", { name: /What we mean by/i }).click();
  await expect(page.getByText("Video is not available offline")).toBeVisible();
  // And no player, no source, nothing that could try to stream.
  expect(await page.locator("video").count()).toBe(0);

  // ---------------------------------------------------------------- step 6
  // Navigate the downloaded curriculum.
  await curriculum.getByRole("button", { name: /Reference architecture diagrams/i }).click();
  await expect(
    page.getByRole("heading", { name: /Reference architecture diagrams/i }),
  ).toBeVisible();

  // ---------------------------------------------------------------- step 7
  // Record progress while offline — it must queue, not fail.
  //
  // The lesson may already be complete from earlier work, so the toggle is
  // read rather than assumed: what matters is that the interaction succeeds
  // with no network and lands in the outbox.
  const toggle = page.getByRole("button", { name: /^(Mark complete|Completed)$/ });
  await expect(toggle).toBeVisible({ timeout: 15_000 });
  const before = (await toggle.textContent())?.trim();

  await toggle.click();
  await expect
    .poll(async () => (await toggle.textContent())?.trim(), { timeout: 15_000 })
    .not.toBe(before);

  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /queued|waiting to sync|offline/i })
      .first(),
  ).toBeVisible({ timeout: 15_000 });

  const queued = await page.evaluate(async () => {
    const open = indexedDB.open("lumen-offline");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const tx = db.transaction("outbox", "readonly");
    return new Promise<number>((resolve, reject) => {
      const request = tx.objectStore("outbox").count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  });
  expect(queued).toBeGreaterThan(0);

  // ---------------------------------------------------------------- step 8
  // Restore internet.
  await context.setOffline(false);

  // ---------------------------------------------------------------- step 9
  // Synchronise. The queue drains on the `online` event.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const open = indexedDB.open("lumen-offline");
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            open.onsuccess = () => resolve(open.result);
            open.onerror = () => reject(open.error);
          });
          const tx = db.transaction("outbox", "readonly");
          return new Promise<number>((resolve, reject) => {
            const request = tx.objectStore("outbox").count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        }),
      { timeout: 45_000, message: "outbox should drain once back online" },
    )
    .toBe(0);
});

test("refuses to bundle a course the learner is not enrolled in", async ({ page }) => {
  await signIn(page);

  // Wei is not enrolled in this one.
  const status = await page.evaluate(async () => {
    const response = await fetch("/api/learn/offline-bundle?courseSlug=writing-for-engineers", {
      credentials: "same-origin",
    });
    return response.status;
  });

  expect(status).toBe(403);
});

test("refuses to bundle anything for a signed-out visitor", async ({ page }) => {
  await page.goto("/login");

  const status = await page.evaluate(async () => {
    const response = await fetch(
      "/api/learn/offline-bundle?courseSlug=systems-design-foundations",
      { credentials: "same-origin" },
    );
    return response.status;
  });

  expect(status).toBe(401);
});
