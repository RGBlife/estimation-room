import { defineConfig, devices } from '@playwright/test';

const firebase = process.env.ROOM_TEST_BACKEND === 'firebase';

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
