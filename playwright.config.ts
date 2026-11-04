import { defineConfig, devices } from "@playwright/test";

const PORT = 3100; // production build from `npm run build` (accounts not configured)
const ACCOUNTS_PORT = 3101; // separate build with accounts enabled against the local Supabase emulator
const MOCK_SUPABASE_PORT = 54400;

const accountsEnv = {
  NEXT_DIST_DIR: ".next-e2e",
  NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_SUPABASE_PORT}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_mock_key_0123456789",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${ACCOUNTS_PORT}`,
  // Fake server-only secrets: tests/e2e/accounts-security.spec.ts proves they never reach client bundles.
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_E2E_CANARY_service_role_must_never_ship",
  DATABASE_URL: "postgresql://postgres:E2E_CANARY_db_password@db.example.invalid:5432/postgres",
};

/**
 * - "desktop": the M0–M8 regression suite against `npm run build` output (run the build first).
 * - "accounts": M9 auth/dashboard/isolation tests. Builds the app into .next-e2e with Supabase env
 *   pointing at tests/mock-supabase (GoTrue/PostgREST/Storage subset over PGlite running the real
 *   migration). This is an emulator — it does not replace verification against a live project.
 * Uses the locally installed Google Chrome (channel "chrome").
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 3,
  reporter: [["list"]],
  use: { channel: "chrome", acceptDownloads: true, trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      testIgnore: /[\\/]accounts-[^\\/]*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1280, height: 900 }, baseURL: `http://localhost:${PORT}` },
    },
    {
      name: "accounts",
      testMatch: /[\\/]accounts-[^\\/]*\.spec\.ts$/,
      // Multi-step auth journeys; every request also goes through the single-threaded emulator.
      timeout: 120_000,
      use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1280, height: 900 }, baseURL: `http://localhost:${ACCOUNTS_PORT}` },
    },
  ],
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "node tests/mock-supabase/server.mjs",
      url: `http://127.0.0.1:${MOCK_SUPABASE_PORT}/__test/health`,
      env: { MOCK_SUPABASE_PORT: String(MOCK_SUPABASE_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next build && npx next start -p ${ACCOUNTS_PORT}`,
      url: `http://localhost:${ACCOUNTS_PORT}`,
      env: accountsEnv,
      reuseExistingServer: false,
      timeout: 400_000,
    },
  ],
});
