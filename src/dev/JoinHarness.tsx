import { useState } from 'react';
import JoinScreen from '../features/join/JoinScreen.tsx';
import { loadTheme, saveTheme, type Theme } from '../shared/lib/theme.ts';

// Dev-only join screen stage. Stub actions keep layout checks independent
// of a running service and avoid creating rooms.
//
// Reached via ?visual-test=join, stripped from production builds by the same
// import.meta.env.DEV gate used elsewhere (see main.tsx).
//
// `mode` and the avatar panel's expanded state both live inside their own
// components rather than in props, so the harness reaches them the way a user
// would -- by rendering the controls and letting the test click them. Params:
//   ?visual-test=join&error=1    show the error row
//   ?visual-test=join&notice=1   show the notice row
//   ?visual-test=join&ready=0    the pre-auth "Connecting…" button state
export default function JoinHarness() {
  const params = new URLSearchParams(window.location.search);
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.getAttribute('data-theme') as Theme) || loadTheme(),
  );

  const toggleTheme = () => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      saveTheme(next);
      return next;
    });
  };

  return (
    <div className="sp-app">
      <JoinScreen
        onJoin={async () => true}
        onCreate={async () => true}
        joinError={params.get('error') === '1' ? 'Room not found' : null}
        notice={params.get('notice') === '1' ? 'This room was closed.' : null}
        prefillRoomCode={params.get('code')}
        ready={params.get('ready') !== '0'}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    </div>
  );
}
