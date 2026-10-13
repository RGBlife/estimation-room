// A player's own progress, kept by the room service for this browser and
// sent only to its own connections -- never to the rest of the room.
export interface PlayerProfile {
  coins: number;
  // Achievement id -> when it was unlocked, in milliseconds.
  achievements: Record<string, number>;
  // How far the player has got in each solo game, for the Arcade's cards.
  games?: { sorted: { played: number }; rare: { answered: number } };
}
