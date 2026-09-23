import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Readiness, ReadinessChange, ReadinessItem } from '../../types/planning.ts';
import { MAX_CRITERIA, MAX_CRITERION_LENGTH, newCriterionId } from './planning.ts';
import { loadPresets, presetItems, removePreset, savePreset, STARTER_PRESETS } from './presets.ts';
import PlanningWindow from './PlanningWindow.tsx';

function Criterion({ item, index, busy, onEdit, onToggle, onRemove }: {
  item: ReadinessItem; index: number; busy: boolean;
  onEdit: (text: string) => Promise<void>; onToggle: (checked: boolean) => Promise<void>; onRemove: () => void;
}) {
  const field = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState(item.text);
  const [pendingCheck, setPendingCheck] = useState<boolean | null>(null);
  useEffect(() => setDraft(item.text), [item.text]);
  useLayoutEffect(() => {
    const node = field.current;
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${Math.max(44, node.scrollHeight)}px`;
  }, [draft]);
  return (
    <li className="sp-criterion" data-checked={pendingCheck ?? item.checked}>
      <label className="sp-criterion-check"><input type="checkbox" checked={pendingCheck ?? item.checked} disabled={busy} onChange={e => {
        const checked = e.target.checked;
        setPendingCheck(checked);
        void onToggle(checked).catch(() => {}).finally(() => setPendingCheck(null));
      }} aria-label={`Mark criterion ${index + 1} ready`} /><span aria-hidden="true">✓</span></label>
      <textarea ref={field} rows={1} aria-label={`Criterion ${index + 1}`} maxLength={MAX_CRITERION_LENGTH} value={draft} disabled={busy}
        onChange={e => setDraft(e.target.value)} onBlur={() => {
          if (draft.trim() !== item.text) void onEdit(draft).catch(() => setDraft(item.text));
        }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }} />
      <button className="sp-planning-close" disabled={busy} onClick={onRemove} aria-label={`Remove criterion ${index + 1}`}>×</button>
    </li>
  );
}

export default function ReadinessWindow({ items, onChange, onClose, closing }: {
  items: Readiness; onChange: (change: ReadinessChange) => Promise<void>; onClose: () => void; closing?: boolean;
}) {
  const [presets, setPresets] = useState(loadPresets);
  const [selected, setSelected] = useState('story');
  const [newText, setNewText] = useState('');
  const [presetName, setPresetName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const entries = Object.entries(items).sort(([a], [b]) => a.localeCompare(b));
  const checked = entries.filter(([, item]) => item.checked).length;
  const allPresets = [...STARTER_PRESETS, ...presets];
  const change = async (value: ReadinessChange) => {
    setBusy(true); setError(''); setMessage('');
    try { await onChange(value); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update the checklist'); throw e; }
    finally { setBusy(false); }
  };
  const apply = (value: ReadinessChange) => { void change(value).catch(() => {}); };
  return (
    <PlanningWindow title="Ticket readiness" subtitle="Agree what ready means before estimating." onClose={onClose} side="right" closing={closing}>
      <div className="sp-readiness-body">
        <div className="sp-readiness-progress"><strong>{checked}<span> / {entries.length} ready</span></strong><span>Shared with everyone in this room</span></div>
        <progress value={checked} max={Math.max(1, entries.length)} aria-label="Readiness progress" />
        <div className="sp-preset-picker">
          <label htmlFor="readiness-preset">Start from a preset</label>
          <div className="sp-planning-row">
            <select id="readiness-preset" value={selected} onChange={e => setSelected(e.target.value)}>
              <optgroup label="Starter checklists">{STARTER_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>
              {presets.length > 0 && <optgroup label="Saved on this device">{presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup>}
            </select>
            <button className="sp-planning-secondary" disabled={busy} onClick={() => {
              const preset = allPresets.find(p => p.id === selected);
              if (preset) apply({ operation: 'replace', items: presetItems(preset) });
            }}>Use preset</button>
            {presets.some(p => p.id === selected) && <button className="sp-planning-close" aria-label="Delete saved preset" onClick={() => {
              try { setPresets(removePreset(selected)); setSelected('story'); setMessage('Preset removed from this device'); }
              catch (e) { setError((e as Error).message); }
            }}>×</button>}
          </div>
          <p>Replaces this checklist and clears its checks.</p>
        </div>
        {entries.length ? <ul className="sp-criteria">{entries.map(([id, item], index) => <Criterion key={id} item={item} index={index} busy={busy}
          onEdit={text => change({ operation: 'edit', id, text })} onToggle={checked => change({ operation: 'toggle', id, checked })} onRemove={() => apply({ operation: 'remove', id })} />)}</ul>
          : <div className="sp-planning-empty"><h3>What does your team need to know?</h3><p>Choose a starter checklist or add your first criterion below.</p></div>}
        <form className="sp-planning-row sp-add-criterion" onSubmit={e => {
          e.preventDefault(); if (busy || !newText.trim()) return;
          void change({ operation: 'add', id: newCriterionId(), text: newText }).then(() => setNewText('')).catch(() => {});
        }}>
          <input aria-label="New readiness criterion" value={newText} onChange={e => setNewText(e.target.value)} placeholder="e.g. Acceptance criteria are testable" maxLength={MAX_CRITERION_LENGTH} disabled={busy || entries.length >= MAX_CRITERIA} />
          <button className="sp-planning-secondary" disabled={busy || !newText.trim() || entries.length >= MAX_CRITERIA}>Add criterion</button>
        </form>
        <p className="sp-planning-hint">{entries.length}/{MAX_CRITERIA} criteria. Edit the text directly; changes save when you leave the field.</p>
        <section className="sp-save-preset">
          <h3>Keep this checklist for next time</h3><p>Save the criteria as a preset for any room on this device. Checks start fresh.</p>
          <form className="sp-planning-row" onSubmit={e => {
            e.preventDefault(); setError('');
            try { const next = savePreset(presetName, items); setPresets(next); setSelected(next[0].id); setPresetName(''); setMessage('Preset saved on this device'); }
            catch (e) { setError((e as Error).message); }
          }}>
            <input aria-label="Preset name" placeholder="e.g. Our story checklist" maxLength={40} value={presetName} onChange={e => setPresetName(e.target.value)} />
            <button className="sp-planning-primary" disabled={busy || !entries.length || !presetName.trim()}>Save preset</button>
          </form>
          <p className="sp-planning-hint">Using an existing preset name updates it.</p>
        </section>
        {error && <p role="alert" className="sp-planning-error">{error}</p>}
        {message && <p role="status" className="sp-planning-hint">{message}</p>}
      </div>
    </PlanningWindow>
  );
}
