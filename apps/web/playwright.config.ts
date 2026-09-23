import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

// instant() e2e tests run against a production build. NEXT_INSTANT_TEST=1
// makes that build expose the testing API that holds back dynamic content
// (next.config.ts), so the assertions see only the static shell.
export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  reporter: process.env.CI ? "github" : "list",
  testDir: "./tests",
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    env: { NEXT_INSTANT_TEST: "1", NEXT_TELEMETRY_DISABLED: "1" },
    reuseExistingServer: false,
    timeout: 300_000,
    url: `http://localhost:${PORT}/taste-lint`,
  },
});
