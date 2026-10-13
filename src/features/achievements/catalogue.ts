// Every achievement the room service can award. The service decides when one
// is earned (scrum-poker-backend Achievements.cs) and sends only its id, so
// the ids here must match it; the names and wording live here.
export interface Achievement {
  id: string;
  name: string;
  icon: string;
  // How it is earned. For a secret one, shown only once it has been.
  how: string;
  // A secret achievement shows only this hint until it is unlocked.
  clue?: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'mission-passed', name: 'Mission Passed', icon: '🗳️', how: 'Cast your first vote.' },
  { id: 'respect-plus', name: 'Respect +', icon: '💪', how: 'Vote in 25 rounds.' },
  { id: 'great-minds', name: 'Great Minds', icon: '🧠', how: 'Everyone at the table votes the same.' },
  { id: 'point-break', name: 'Point Break', icon: '🏄', how: 'A reveal runs from the lowest card to the highest.' },
  { id: 'story-pointless', name: 'Story Pointless', icon: '🤷', how: 'Vote ? three rounds running.' },
  { id: 'brew-rocracy', name: 'Brew-rocracy', icon: '☕', how: 'Vote for a coffee break.' },
  { id: 'host-with-the-most', name: 'Host with the Most', icon: '🎩', how: 'Create a room that five people sit at.' },
  { id: 'pocket-money', name: 'Pocket Money', icon: '🪙', how: 'Earn your first coin in the Arcade.' },
  { id: 'sort-of-genius', name: 'Sort of Genius', icon: '🧩', how: 'Solve a Sorted puzzle without a mistake.' },
  { id: 'noughty-by-nature', name: 'Noughty by Nature', icon: '⭕', how: 'Win a game of ultimate noughts and crosses.' },
  { id: 'you-sunk-my-battleship', name: 'You Sunk My Battleship', icon: '🚢', how: 'Win a game of Battleship.' },
  { id: 'hipster', name: 'Hipster', icon: '🕶️', how: 'In Rare Find, give an answer only one other person gave.' },
  { id: 'high-roller', name: 'High Roller', icon: '🎲', how: 'Win a duel with coins at stake.' },
  { id: 'table-for-none', name: 'Table for None', icon: '🪓', how: 'Break the table in two.', clue: "Some furniture isn't rated for this." },
  { id: 'grand-theft-estimate', name: 'Grand Theft Estimate', icon: '🚗', how: 'Take GTA Mode for a drive.', clue: 'Once the cards are down, the keys are in the ignition.' },
  { id: 'wasted', name: 'Wasted', icon: '💀', how: 'Get run over.', clue: 'Never stand still after a reveal.' },
  { id: 'five-star-wanted-level', name: 'Five-Star Wanted Level', icon: '⭐', how: 'Run over five people in one drive.', clue: 'Leave no seat unflattened.' },
  { id: 'fowl-play', name: 'Fowl Play', icon: '🐔', how: 'Throw the rubber chicken.', clue: 'Some throws cluck.' },
  { id: 'happy-little-accident', name: 'Happy Little Accident', icon: '🌲', how: 'Throw Bob Ross.', clue: 'There are no mistakes, only…' },
  { id: 'night-shift', name: 'Night Shift', icon: '🦉', how: 'Vote between midnight and 5am.', clue: 'The backlog never sleeps.' },
  { id: 'flip-flopper', name: 'Flip-Flopper', icon: '🩴', how: 'Change your vote five times in one round.', clue: 'Indecision is a decision.' },
];

const BY_ID = new Map(ACHIEVEMENTS.map(a => [a.id, a]));

// Unknown ids (a newer service than this page) are skipped rather than shown blank.
export function achievementById(id: string): Achievement | undefined {
  return BY_ID.get(id);
}

export function unlockedCount(achievements: Record<string, number> | undefined): number {
  return ACHIEVEMENTS.filter(a => achievements?.[a.id] !== undefined).length;
}
