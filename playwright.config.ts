import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// override: true -- .env.test is the deliberate source of truth for test
// credentials; without this, dotenv silently keeps any value already
// present in the shell's ambient environment instead of the file's.
dotenv.config({ path: path.resolve(__dirname, ".env.test"), override: true });

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/helpers/global-setup.ts",
  globalTeardown: "./tests/e2e/helpers/global-teardown.ts",
  fullyParallel: true,
  retries: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "https://fixernation.org",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
