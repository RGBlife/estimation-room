import { defineConfig, loadEnv, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// main.tsx lazy-loads App so the dev-only harnesses stay out of production,
// which also meant the browser only discovered the app's largest file after
// the entry script had downloaded and run -- one extra round trip before the
// room could even start loading. This lists App's chunk (and its CSS) in the
// page itself so both download alongside the entry script.
function preloadApp(): Plugin {
  return {
    name: 'preload-app',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, { bundle }) {
        const app = Object.values(bundle ?? {}).find(chunk =>
          chunk.type === 'chunk' && chunk.facadeModuleId?.endsWith('/src/app/App.tsx'));
        if (!app || app.type !== 'chunk') return [];
        const base = process.env.GITHUB_PAGES ? '/estimation-room/' : '/';
        const css = [...(app.viteMetadata?.importedCss ?? [])];
        return [
          { tag: 'link', attrs: { rel: 'modulepreload', crossorigin: '', href: base + app.fileName }, injectTo: 'head' },
          ...css.map(file => ({ tag: 'link', attrs: { rel: 'preload', as: 'style', crossorigin: '', href: base + file }, injectTo: 'head' as const })),
        ];
      },
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const backend = env.VITE_ROOM_BACKEND || 'dotnet';
  if (!['dotnet', 'firebase'].includes(backend)) throw new Error('VITE_ROOM_BACKEND must be dotnet or firebase');
  if (backend === 'firebase' && command === 'build') {
    for (const key of ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID', 'VITE_FIREBASE_DATABASE_URL']) {
      if (!env[key]) throw new Error(`Firebase build requires ${key}`);
    }
  }
  return {
    resolve: { alias: { '#room-backend': fileURLToPath(new URL(`./src/features/room/roomStore.${backend}.ts`, import.meta.url)) } },
    plugins: [react(), tailwindcss(), preloadApp()],
    base: process.env.GITHUB_PAGES ? '/estimation-room/' : '/',
    // `npm run dev -- --host` exposes the dev server on the LAN so a phone or a
    // colleague's laptop can join the same room -- the only way to exercise real
    // multi-client behaviour (latency, interpolation, disconnects) that two tabs
    // on one machine cannot show you.
    server: {
      host: process.env.EXPOSE === '1' || undefined,
      // The room service only admits WebSockets from exact, pre-listed
      // origins. If the requested port is taken, Vite's default is to move
      // to the next one, which then fails with a silent "Connection lost.
      // Reconnecting…" loop. Failing to start is the clearer outcome; pick
      // another allowed port with `npm run dev -- --port 5174`.
      strictPort: true,
      proxy: { '/api': { target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:5050', ws: true } },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      globals: false,
      // tests/visual is a separate Playwright suite (npm run test:visual), not
      // a Vitest suite -- its own `test`/`expect` globals clash with Vitest's.
      exclude: ['node_modules/**', 'tests/**', 'test-results/**', 'playwright-report/**'],
    },
  };
});
