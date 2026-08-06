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
  },
});
