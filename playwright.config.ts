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
    // Desktop Chrome (1280x720) was the only project, which is how the room
    // layout stayed broken on phones without any test noticing.
    //
    // Both mobile projects run on Chromium rather than the WebKit that
    // devices['iPhone 14'] would otherwise select: these assert layout
    // geometry, which the viewport size decides, and requiring a second
    // browser download to run them would be a barrier for no added signal.
    {
      name: 'mobile',
      use: {
        ...devices['Desktop Chrome'],
        // iPhone 14 -- the narrowest common target, and what the responsive
        // sizing tiers are calibrated against.
        viewport: { width: 390, height: 844 },
        isMobile: false,
        hasTouch: true,
      },
    },
    {
      name: 'tablet',
      use: {
        ...devices['Desktop Chrome'],
        // iPad portrait. Below every table breakpoint before this work, so it
        // used to get the smallest desktop layout with no adaptation at all.
        viewport: { width: 768, height: 1024 },
        isMobile: false,
        hasTouch: true,
      },
    },
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
