import { defineConfig, devices } from '@playwright/test';

// Runs against the dev-only ?visual-test=cards harness (src/dev/VisualTestHarness.tsx),
// which mounts VotingBar directly with fixture data -- no Firestore, no room
// creation, fast and deterministic. Not part of `npm test` (that's Vitest);
// run explicitly with `npm run test:visual`.
export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
