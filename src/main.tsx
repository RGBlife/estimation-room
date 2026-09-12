import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/theme.css';
import './styles/tailwind.css';

// Candidate theme palettes for the design exploration (src/styles/themes.css).
// Dynamically imported, and only in DEV: it's scaffolding for choosing a
// direction, and a static import would bundle every unused palette into the
// production CSS. Loaded after theme.css so its data-theme blocks win on
// source order at equal specificity.
//
// The file is an untracked local working area, so it is absent on a fresh
// clone -- CI included. import.meta.glob resolves at build time against the
// files that actually exist, which keeps a missing file a no-op instead of an
// unresolved-import error that takes the whole dev server down.
if (import.meta.env.DEV) {
  const themes = import.meta.glob('./styles/themes.css');
  themes['./styles/themes.css']?.();
}

// Dev-only component stages for layout checks. Lazy imports keep each stage
// isolated and omit the harnesses from production builds.
const visualTest = import.meta.env.DEV
  ? new URLSearchParams(window.location.search).get('visual-test')
  : null;
const isVisualTestRoute =
  visualTest === 'cards' || visualTest === 'gta' || visualTest === 'room' || visualTest === 'join';
const App = isVisualTestRoute ? null : lazy(() => import('./app/App.tsx'));
const VisualTestHarness = visualTest === 'cards' ? lazy(() => import('./dev/VisualTestHarness.tsx')) : null;
const GtaSandbox = visualTest === 'gta' ? lazy(() => import('./dev/GtaSandbox.tsx')) : null;
const RoomLayoutHarness = visualTest === 'room' ? lazy(() => import('./dev/RoomLayoutHarness.tsx')) : null;
const JoinHarness = visualTest === 'join' ? lazy(() => import('./dev/JoinHarness.tsx')) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {GtaSandbox ? <GtaSandbox />
        : RoomLayoutHarness ? <RoomLayoutHarness />
        : VisualTestHarness ? <VisualTestHarness />
        : JoinHarness ? <JoinHarness />
        : App && <App />}
    </Suspense>
  </StrictMode>,
);
