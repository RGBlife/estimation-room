// Keep absent names out of room documents; Firestore rejects undefined values.
export function normalizeTeamName(value?: string): string | undefined {
  const name = value?.trim();
  if (name && name.length > 40) throw new Error('Team name must be 40 characters or fewer');
  return name || undefined;
}
