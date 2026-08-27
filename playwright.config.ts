import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end configuration.
 *
 * Runs against `next start`, not `next dev`: the service worker is disabled in
 * development, so offline behaviour would silently pass by testing nothing.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    // Service workers only register over HTTPS or localhost.
    serviceWorkers: "allow",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
