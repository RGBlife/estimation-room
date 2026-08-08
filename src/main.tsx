import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App.tsx';
import './styles/theme.css';
import './styles/tailwind.css';

// Dev-only, Firestore-free component stage (see src/dev/VisualTestHarness.tsx)
// for visual/layout checks that don't need a real room. import.meta.env.DEV
// gates it out of production builds entirely -- the lazy import means the
// harness module itself isn't even in the production bundle.
const isVisualTestRoute = import.meta.env.DEV && new URLSearchParams(window.location.search).get('visual-test') === 'cards';
const VisualTestHarness = isVisualTestRoute ? lazy(() => import('./dev/VisualTestHarness.tsx')) : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {VisualTestHarness ? (
      <Suspense fallback={null}>
        <VisualTestHarness />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
