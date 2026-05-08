import { defineConfig, devices } from "@playwright/test";

const webUrl = process.env.E2E_WEB_URL ?? "http://localhost:3002";
const adminUrl = process.env.E2E_ADMIN_URL ?? "http://localhost:3003";

/**
 * Two projects so each spec can target either the customer PWA or the
 * admin app without juggling base URLs. Specs that don't care which app
 * (e.g. health) live under tests/health and run against both.
 */
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "web-chromium",
      testMatch: /.*\.web\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: webUrl },
    },
    {
      name: "admin-chromium",
      testMatch: /.*\.admin\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], baseURL: adminUrl },
    },
    {
      name: "web-webkit",
      testMatch: /.*\.web\.spec\.ts/,
      use: { ...devices["Desktop Safari"], baseURL: webUrl },
    },
  ],
});
