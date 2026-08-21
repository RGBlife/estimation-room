import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import './styles/tailwind.css';

// Dev-only, Firestore-free component stage (see src/dev/VisualTestHarness.tsx)
// for visual/layout checks that don't need a real room. import.meta.env.DEV
// gates it out of production builds entirely.
//
// Both App and the harness are lazy-loaded: App's module graph eagerly
// initializes Firebase (src/shared/lib/firebase.ts, imported transitively via
// roomStore.ts) at import time, which throws if Firebase env vars aren't
// set. A static `import App from './app/App.tsx'` at the top of this file
// would pull that in regardless of which branch actually renders -- ES
// module imports are resolved before any runtime branching -- so the
// harness route (which has no Firebase secrets in CI) would crash before
// React ever mounts anything. Lazy-loading keeps each route's module graph
// isolated to only the route that's actually chosen.
const visualTest = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('visual-test')
  : null;
const isVisualTestRoute = visualTest === 'cards' || visualTest === 'gta' || visualTest === 'room';
const App = isVisualTestRoute ? null : lazy(() => import('./app/App.tsx'));
const VisualTestHarness = visualTest === 'cards' ? lazy(() => import('./dev/VisualTestHarness.tsx')) : null;
const GtaSandbox = visualTest === 'gta' ? lazy(() => import('./dev/GtaSandbox.tsx')) : null;
const RoomLayoutHarness = visualTest === 'room' ? lazy(() => import('./dev/RoomLayoutHarness.tsx')) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {GtaSandbox ? <GtaSandbox />
        : RoomLayoutHarness ? <RoomLayoutHarness />
        : VisualTestHarness ? <VisualTestHarness />
        : App && <App />}
    </Suspense>
  </StrictMode>,
);
