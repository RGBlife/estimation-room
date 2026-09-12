import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/multiplayer',
  workers: 1,
  timeout: 90000,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4177', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4177 --strictPort',
    url: 'http://127.0.0.1:4177',
    reuseExistingServer: false,
    env: { API_PROXY_TARGET: 'http://127.0.0.1:5050' },
  },
});
