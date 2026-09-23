import { MAX_CRITERIA, MAX_CRITERION_LENGTH, newCriterionId } from './planning.ts';
import type { Readiness } from '../../types/planning.ts';

export interface ReadinessPreset { id: string; name: string; criteria: string[] }
const KEY = 'sp_readiness_presets_v1';
export const STARTER_PRESETS: ReadinessPreset[] = [
  { id: 'story', name: 'Story ready', criteria: ['The problem and expected outcome are clear', 'Acceptance criteria are testable', 'Dependencies and open questions are understood', 'The team can estimate the work'] },
  { id: 'bug', name: 'Bug ready', criteria: ['Steps to reproduce are included', 'Expected and actual behaviour are described', 'Impact and affected users are understood', 'The team can estimate the fix'] },
];
export function loadPresets(): ReadinessPreset[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return value.filter((p): p is ReadinessPreset => p && typeof p.id === 'string' && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 40
      && Array.isArray(p.criteria) && p.criteria.length > 0 && p.criteria.length <= MAX_CRITERIA
      && p.criteria.every((c: unknown) => typeof c === 'string' && c.trim().length > 0 && c.length <= MAX_CRITERION_LENGTH)).slice(0, 20);
  } catch { return []; }
}
export function savePreset(name: string, items: Readiness): ReadinessPreset[] {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40 || Object.keys(items).length === 0) throw new Error('Name your preset and add at least one criterion');
  const presets = loadPresets();
  const previous = presets.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
  const preset = { id: previous?.id ?? newCriterionId(), name: trimmed, criteria: Object.values(items).map(i => i.text) };
  const next = [preset, ...presets.filter(p => p.id !== preset.id)].slice(0, 20);
  // Report storage failures instead of saying a reusable preset was saved.
  try { localStorage.setItem(KEY, JSON.stringify(next)); }
  catch { throw new Error('Could not save on this device. Check browser storage permissions.'); }
  return next;
}
export function removePreset(id: string): ReadinessPreset[] {
  const next = loadPresets().filter(p => p.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(next)); }
  catch { throw new Error('Could not remove the saved preset'); }
  return next;
}
export const presetItems = (preset: ReadinessPreset): Readiness => Object.fromEntries(preset.criteria.map((text, index) => [`c${String(index).padStart(2, '0')}-${crypto.randomUUID()}`, { text, checked: false }]));
