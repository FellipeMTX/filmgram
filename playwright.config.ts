import { defineConfig, devices } from "@playwright/test";

const port = 3171;
const origin = `http://127.0.0.1:${port}`;
const productionBuild = process.env.FILMGRAM_E2E_BUILD === "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: origin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm ${productionBuild ? "start" : "dev"} --hostname 127.0.0.1 --port ${port}`,
    port,
    env: { FILMGRAM_FIXTURES: "1" },
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
