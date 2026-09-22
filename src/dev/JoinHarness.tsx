import { useState } from 'react';
import JoinScreen from '../features/join/JoinScreen.tsx';
import { loadTheme, saveTheme, type Theme } from '../shared/lib/theme.ts';
import type { AvatarOptions, RoomPeek } from '../types/room.ts';

const HARNESS_CODES = ['KXPT', 'MRQD', 'ZHLV', 'BWNF', 'TCGJ', 'PYSA'];
const harnessTeamName = (i: number) => i === 0 ? 'Platform engineering and infrastructure!!' : i % 2 === 0 ? 'Design systems' : undefined;
const HOUR = 3600000;

// Fixed looks so screenshots are stable between runs.
function harnessAvatar(k: number): AvatarOptions {
  return {
    seed: `harness-${k}`, bgIdx: k % 8, hairIdx: (k * 7) % 45, hairColorIdx: (k * 3) % 14, skinColorIdx: k % 4,
    eyesIdx: (k * 5) % 26, eyebrowsIdx: k % 15, mouthIdx: (k * 11) % 30, glassesIdx: k % 5, glassesIdxOn: k % 3 === 0,
    earringsIdx: k % 6, earringsIdxOn: k % 4 === 1, featureIdx: k % 4, featureIdxOn: false,
  };
}

// Writes a recent-rooms list this device "remembers" before JoinScreen reads
// it on mount. Card i cycles through open-with-people, empty and closed so
// one screenshot shows every state.
function seedRecentRooms(count: number) {
  const now = Date.now();
  const rooms = HARNESS_CODES.slice(0, count).map((code, i) => ({
    code,
    teamName: harnessTeamName(i),
    lastSeenAt: now - [0.2, 3, 26, 30 * 24, 5 * 24, 12][i] * HOUR,
    createdByMe: i % 2 === 0,
    people: Array.from({ length: (i % 4) + 1 }, (_, k) => ({ name: `Player ${k + 1}`, avatar: harnessAvatar(i * 4 + k) })),
  }));
  localStorage.setItem('sp_recent_rooms_v1', JSON.stringify(rooms));
}

async function harnessPeek(code: string): Promise<RoomPeek | null> {
  const i = HARNESS_CODES.indexOf(code);
  await new Promise(resolve => setTimeout(resolve, 150));
  if (i % 3 === 2) return null;
  const count = i % 3 === 1 ? 0 : (i % 2) + 3;
  return { teamName: harnessTeamName(i), participants: Array.from({ length: count }, (_, k) => ({ name: `Now ${k + 1}`, avatar: harnessAvatar(20 + i * 4 + k), isObserver: false })) };
}

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
//   ?visual-test=join&rooms=6    deal N remembered rooms (0-6) into the hero hand
//   ?visual-test=join&rooms=6&peek=0   ...without a live status check
export default function JoinHarness() {
  const params = new URLSearchParams(window.location.search);
  const rooms = Math.min(HARNESS_CODES.length, Math.max(0, Number(params.get('rooms') ?? 0) || 0));
  useState(() => { if (rooms > 0) seedRecentRooms(rooms); else localStorage.removeItem('sp_recent_rooms_v1'); });
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
        peekRoom={rooms > 0 && params.get('peek') !== '0' ? harnessPeek : undefined}
      />
    </div>
  );
}
