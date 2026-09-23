import { useLayoutEffect, useRef, useState } from 'react';

// Editing belongs to the name itself. The native popover renders above the
// table without a scrim or a second trip through the room menu.
export default function TeamNameEditor({ teamName, onSave }: {
  teamName?: string; onSave: (name: string) => Promise<void>;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(teamName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const close = (restoreFocus = true) => {
    popover.current?.hidePopover();
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  };
  useLayoutEffect(() => {
    if (open) { input.current?.focus(); input.current?.select(); }
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const node = popover.current!;
    const position = () => {
      const anchor = trigger.current!.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 24);
      node.style.width = `${width}px`;
      node.style.left = `${Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12))}px`;
      node.style.top = `${Math.min(anchor.bottom + 8, Math.max(12, window.innerHeight - node.offsetHeight - 12))}px`;
    };
    position();
    const outside = (event: PointerEvent) => {
      if (busy || node.contains(event.target as Node) || trigger.current?.contains(event.target as Node)) return;
      // A click elsewhere keeps focus where the user put it.
      node.hidePopover(); setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('resize', position);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', position); };
  }, [open, busy, error]);
  return (
    <>
      <button ref={trigger} title={teamName || 'Add a team name'} aria-label={teamName ? `Rename team ${teamName}` : 'Add a team name'}
        aria-expanded={open} aria-haspopup="dialog" aria-disabled={busy}
        onClick={() => {
          if (busy) return;
          if (open) { close(); return; }
          setValue(teamName ?? ''); setError('');
          popover.current!.showPopover(); setOpen(true);
        }}
        className="group flex min-h-11 min-w-0 max-w-56 cursor-pointer items-center gap-2 rounded-md px-1 text-sm font-semibold text-sp-text hover:bg-sp-panel-2">
        <span className="truncate">{teamName || 'Name your team'}</span>
        <svg className="shrink-0 text-sp-text-faint" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z M13 6l5 5" /></svg>
      </button>
      <div ref={popover} popover="manual" role="dialog" aria-label="Rename team"
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!busy) close(); }
        }}
        className="fixed inset-auto m-0 max-w-[calc(100vw-24px)] rounded-xl border border-sp-border-strong bg-sp-panel p-4 text-sp-text shadow-sp-lg">
        <form onSubmit={async event => {
          event.preventDefault();
          if (busy) return;
          if (value.trim() === (teamName ?? '')) { close(); return; }
          setBusy(true); setError('');
          try { await onSave(value.trim()); close(); }
          catch (e) { setError(e instanceof Error ? e.message : 'Could not update the team name'); }
          finally { setBusy(false); }
        }}>
          <label htmlFor="room-team-name" className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold text-sp-text-faint">Team name <span aria-hidden="true" className="font-normal">{value.length}/40</span></label>
          <input ref={input} id="room-team-name" value={value} onChange={e => setValue(e.target.value)} maxLength={40} disabled={busy} placeholder="e.g. The Trailblazers"
            className="min-h-11 w-full rounded-lg border border-sp-border-strong bg-sp-bg px-3 text-base font-semibold text-sp-text" />
          <p className="mt-2 text-xs text-sp-text-faint">Leave blank to use the room code.</p>
          {error && <p role="alert" className="mt-2 text-sm text-sp-warn-text">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" disabled={busy} onClick={() => close()} className="min-h-11 cursor-pointer rounded-lg px-3 text-sm text-sp-text-faint">Cancel</button>
            <button disabled={busy || value.trim() === (teamName ?? '')} aria-label="Save team name" className="min-h-11 cursor-pointer rounded-lg bg-sp-accent px-4 text-sm font-semibold text-sp-bg disabled:opacity-50">{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </form>
      </div>
    </>
  );
}
