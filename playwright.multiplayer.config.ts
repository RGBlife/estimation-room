import { defineConfig, devices } from '@playwright/test';

// Select an origin already admitted by the local service.
const port = Number(process.env.ROOM_TEST_PORT || 4177);
const baseURL = `http://127.0.0.1:${port}`;
const firebase = process.env.ROOM_TEST_BACKEND === 'firebase';

export default defineConfig({
  testDir: './tests/multiplayer',
  workers: 1,
  timeout: 90000,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL, trace: 'retain-on-failure' },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    env: {
      VITE_ROOM_BACKEND: firebase ? 'firebase' : 'dotnet',
      API_PROXY_TARGET: process.env.API_PROXY_TARGET || 'http://127.0.0.1:5050',
      ...(firebase ? {
        VITE_USE_EMULATOR: '1',
        VITE_FIREBASE_PROJECT_ID: 'demo-scrum-poker',
        VITE_FIREBASE_API_KEY: 'demo-key',
        VITE_FIREBASE_AUTH_DOMAIN: 'demo-scrum-poker.firebaseapp.com',
        VITE_FIREBASE_DATABASE_URL: 'https://demo-scrum-poker-default-rtdb.firebaseio.com',
        VITE_FIREBASE_APP_ID: '1:123456:web:demo',
      } : {}),
    },
  },
});
