import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.GITHUB_PAGES ? '/estimation-room/' : '/',
  // `npm run dev -- --host` exposes the dev server on the LAN so a phone or a
  // colleague's laptop can join the same room -- the only way to exercise real
  // multi-client behaviour (latency, interpolation, disconnects) that two tabs
  // on one machine cannot show you.
  server: {
    host: process.env.EXPOSE === '1' || undefined,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    // tests/visual is a separate Playwright suite (npm run test:visual), not
    // a Vitest suite -- its own `test`/`expect` globals clash with Vitest's.
    exclude: ['node_modules/**', 'tests/**'],
  },
});
