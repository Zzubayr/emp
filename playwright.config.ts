import { defineConfig } from "@playwright/test";

// End-to-end tests run against their own database (prisma/test.db), reseeded on every run.
const env = { DATABASE_URL: "file:./test.db", SHOW_DEV_CODES: "true", DISABLE_TICK: "true", APP_URL: "http://localhost:3100", CRON_SECRET: "test-secret" };

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", trace: "off", viewport: { width: 1440, height: 900 } },
  webServer: {
    command: "npx prisma db push --skip-generate --accept-data-loss && npx tsx prisma/seed.ts && npx next dev -p 3100",
    url: "http://localhost:3100/sign-in",
    env,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
