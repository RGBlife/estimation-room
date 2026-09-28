import { useState } from 'react';
import type { Readiness, ReadinessChange } from '../../types/planning.ts';

const COLLAPSED_KEY = 'sp_readiness_checklist_collapsed_v1';

// Remembered per viewer; narrow screens start collapsed so the card doesn't
// sit over the seats before anyone asks for it.
function loadCollapsed() {
  try {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored !== null) return stored === '1';
  } catch { /* storage unavailable: fall through to the default */ }
  return !window.matchMedia('(min-width: 1100px)').matches;
}

// The checklist at the table: a see-through card over the left of the room
// so everyone can tick criteria as the discussion goes, without opening the
// setup drawer. Editing the criteria stays in the drawer.
export default function ReadinessChecklist({ items, onChange, onEdit }: {
  items: Readiness; onChange: (change: ReadinessChange) => Promise<void>; onEdit: () => void;
}) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const entries = Object.entries(items).sort(([a], [b]) => a.localeCompare(b));
  const isChecked = (id: string) => pending[id] ?? items[id].checked;
  const checked = entries.filter(([id]) => isChecked(id)).length;
  const collapse = (value: boolean) => {
    setCollapsed(value);
    try { localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0'); } catch { /* per-viewer nicety only */ }
  };
  const toggle = (id: string, value: boolean) => {
    setPending(current => ({ ...current, [id]: value })); setError('');
    void onChange({ operation: 'toggle', id, checked: value })
      .catch(() => setError('Could not update the checklist'))
      .finally(() => setPending(current => { const next = { ...current }; delete next[id]; return next; }));
  };
  const allReady = checked === entries.length;

  if (collapsed) return (
    <button className="sp-checklist-pill" data-ready={allReady} onClick={() => collapse(false)} aria-label={`Show checklist, ${checked} of ${entries.length} ready`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m4 12 5 5L20 6" /></svg>
      <span>{checked}/{entries.length}</span>
    </button>
  );

  return (
    <section className="sp-checklist" data-ready={allReady} aria-label="Ready check">
      <header className="sp-checklist-heading">
        <h2>Ready check</h2>
        <span className="sp-checklist-count">{checked}/{entries.length}</span>
        <button className="sp-checklist-icon" onClick={() => collapse(true)} aria-label="Hide checklist">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m15 6-6 6 6 6" /></svg>
        </button>
      </header>
      <div className="sp-checklist-progress" aria-hidden="true"><span style={{ width: `${(checked / entries.length) * 100}%` }} /></div>
      <ul>
        {entries.map(([id, item]) => (
          <li key={id}>
            <label data-checked={isChecked(id)}>
              <input type="checkbox" checked={isChecked(id)} onChange={e => toggle(id, e.target.checked)} />
              <span className="sp-checklist-box" aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true"><path d="m4 12 5 5L20 6" /></svg>
              </span>
              <span className="sp-checklist-text">{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="sp-checklist-error">{error}</p>}
      <footer><button className="sp-checklist-edit" onClick={onEdit}>Edit checklist</button></footer>
    </section>
  );
}
