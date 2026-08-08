import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.GITHUB_PAGES ? '/estimation-room/' : '/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: false,
    // tests/visual is a separate Playwright suite (npm run test:visual), not
    // a Vitest suite -- its own `test`/`expect` globals clash with Vitest's.
    exclude: ['node_modules/**', 'tests/**'],
  },
});
