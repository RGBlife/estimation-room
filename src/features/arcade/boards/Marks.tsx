import type { Mark as MarkType } from '../../../types/games.ts';

// A mark drawn in marker: each stroke draws itself in (pathLength 1, so
// the dash animation is the same whatever the stroke's real length).
export function Mark({ mark }: { mark: MarkType }) {
  return mark === 'X' ? (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="sp-noughts-mark" data-mark="X">
      <path pathLength={1} d="M24 22c18 20 34 38 53 57" />
      <path pathLength={1} d="M76 21C58 41 42 58 23 78" className="sp-noughts-second" />
    </svg>
  ) : (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="sp-noughts-mark" data-mark="O">
      <path pathLength={1} d="M52 20c-19-2-33 13-32 31 1 17 14 30 31 29 18-1 30-15 29-32-1-16-13-28-30-28-3 0-6 1-8 2" />
    </svg>
  );
}
