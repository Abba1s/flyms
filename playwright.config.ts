import { defineConfig, devices } from '@playwright/test';

/**
 * E2E tests run against the Vite dev server and a local Supabase (`pnpm db:start`).
 * The browser clock is frozen so admission statuses are deterministic.
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // Screenshots are a manual visual check: SHOTS_DIR=/tmp/shots pnpm exec playwright test screenshots
  testIgnore: process.env.SHOTS_DIR ? [] : ['**/screenshots.spec.ts'],
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm --filter @flyms/web dev --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
