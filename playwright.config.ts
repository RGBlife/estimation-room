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
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Vite's default dev-server binding resolves "localhost" ambiguously
    // between IPv6 (::1) and IPv4 (127.0.0.1) depending on the host's
    // resolver order -- this passed locally (macOS resolves to ::1 first,
    // matching Vite's default bind) but failed in CI (Ubuntu runners
    // resolve "localhost" to 127.0.0.1 first, which nothing was listening
    // on). Binding explicitly to 127.0.0.1 removes the ambiguity everywhere.
    command: 'npm run dev -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
