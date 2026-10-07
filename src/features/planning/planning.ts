import type { Readiness, ReadinessChange } from '../../types/planning.ts';

export const MAX_CRITERIA = 12;
export const MAX_CRITERION_LENGTH = 160;
const validId = (id: string) => /^[a-zA-Z0-9_-]{1,48}$/.test(id);
const text = (value: unknown, max: number): string => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`Enter between 1 and ${max} characters`);
  return value.trim();
};
export const newCriterionId = () => `r-${Date.now().toString(36)}-${crypto.randomUUID()}`;
export function validateReadiness(value: Readiness): Readiness {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > MAX_CRITERIA) throw new Error('Use up to 12 readiness criteria');
  return Object.fromEntries(Object.entries(value).map(([id, item]) => {
    if (!validId(id) || !item || typeof item.checked !== 'boolean') throw new Error('Invalid readiness criterion');
    return [id, { text: text(item.text, MAX_CRITERION_LENGTH), checked: item.checked }];
  }));
}
export function applyReadinessChange(current: Readiness, change: ReadinessChange): Readiness {
  if (change.operation === 'replace') return validateReadiness(change.items);
  const next = { ...current };
  if (!validId(change.id)) throw new Error('Invalid readiness criterion');
  if (change.operation === 'add') {
    if (next[change.id]) throw new Error('This criterion already exists');
    next[change.id] = { text: text(change.text, MAX_CRITERION_LENGTH), checked: false };
  } else {
    if (!next[change.id]) throw new Error('This criterion was removed. Try again.');
    switch (change.operation) {
      case 'edit': next[change.id] = { ...next[change.id], text: text(change.text, MAX_CRITERION_LENGTH) }; break;
      case 'toggle': next[change.id] = { ...next[change.id], checked: change.checked }; break;
      case 'remove': delete next[change.id]; break;
      default: throw new Error('Unknown readiness change');
    }
  }
  return validateReadiness(next);
}
export const resetReadiness = (items: Readiness): Readiness => Object.fromEntries(Object.entries(items).map(([id, item]) => [id, { ...item, checked: false }]));
