// Single source of truth for the Firestore `rooms/{roomCode}` document shape.
// Keep in sync with firestore.rules' validParticipant()/validAvatar() functions,
// which are the actual runtime enforcement -- this file describes what those
// rules accept, it does not replace them.

// Widened from a closed literal union: the real constraint on which values
// are legal now lives in decks.ts (per-deck value sets, including Custom's
// arbitrary free text) and firestore.rules (shape/length cap).
export type CardValue = string;

export type DeckId = 'fibonacci' | 'tshirt' | 'powersOf2' | 'rom' | 'custom';

// Current avatar format (avatar.js AVATAR_CATEGORIES). Index bounds below are
// enforced by firestore.rules' validAvatar() and are not expressible in TS.
export interface AvatarOptions {
  seed: string; // <= 32 chars
  bgIdx: number; // 0-7
  hairIdx: number; // 0-44
  hairColorIdx: number; // 0-13
  skinColorIdx: number; // 0-3
  eyesIdx: number; // 0-25
  eyebrowsIdx: number; // 0-14
  mouthIdx: number; // 0-29
  glassesIdx: number; // 0-4
  glassesIdxOn: boolean;
  earringsIdx: number; // 0-5
  earringsIdxOn: boolean;
  featureIdx: number; // 0-3
  featureIdxOn: boolean;
}

// Legacy format: pre-customization-panel avatars (random look only, no
// per-feature indices). Still validated by firestore.rules' validAvatar().
export interface LegacyAvatarOptions {
  seed: string;
  bgIdx: number;
  glasses: boolean;
  earrings: boolean;
  flair: boolean;
}

export interface Participant {
  name: string; // 1-40 chars
  isObserver: boolean;
  vote: CardValue | null;
  joinedAt: number;
  // Exactly one of these two branches is present, enforced by firestore.rules'
  // validParticipant() hasOnly() checks -- never both, never neither.
  avatar?: AvatarOptions | LegacyAvatarOptions;
  // Transitional: participants written by pre-local-avatar-generation clients
  // store a dicebear API URL instead. Removable once no such clients/rooms remain.
  avatarUrl?: string;
}

export interface RoomDoc {
  code: string;
  story: string; // <= 200 chars
  isRevealed: boolean;
  creatorId: string;
  deck: DeckId;
  // serverTimestamp() sentinel on write / Timestamp on read. Not consumed
  // anywhere today; typed loosely on purpose rather than pulling in Firestore's
  // FieldValue unions for a field nothing reads.
  createdAt: unknown;
  participants: Record<string, Participant>;
}

// Payload constructed by JoinScreen and passed into createRoom/joinRoom.
export interface JoinPayload {
  name: string;
  avatar: AvatarOptions;
  isObserver: boolean;
  deck: DeckId;
}
