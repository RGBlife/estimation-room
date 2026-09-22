import { useEffect, useRef, useState } from 'react';

interface RenameRoomDialogProps {
  roomCode: string;
  teamName?: string;
  onSave: (teamName: string) => Promise<void>;
  onClose: () => void;
}

export default function RenameRoomDialog({ roomCode, teamName, onSave, onClose }: RenameRoomDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(teamName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Restore focus explicitly: React may detach the dialog before close runs.
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, []);
  return (
    <dialog ref={dialog} aria-labelledby="rename-team-heading" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}
      className="fixed inset-0 m-auto w-[min(440px,calc(100%-32px))] overflow-hidden rounded-2xl border border-sp-border-strong bg-sp-panel p-0 text-sp-text shadow-sp-lg backdrop:bg-black/40">
      <div className="flex items-center justify-between border-b border-sp-border px-6 py-3">
        <span className="text-sm text-sp-text-faint">Room <strong className="ml-1 font-sp-mono text-sp-text">{roomCode}</strong></span>
        <button onClick={onClose} disabled={busy} aria-label="Close team editor" className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-xl text-sp-text-faint hover:bg-sp-panel-2">×</button>
      </div>
      <form className="p-6" onSubmit={async e => {
        e.preventDefault();
        if (busy) return;
        setBusy(true); setError(null);
        try { await onSave(value.trim()); onClose(); }
        catch (err) { setError(err instanceof Error ? err.message : 'Could not rename the room'); setBusy(false); }
      }}>
        <h2 id="rename-team-heading" className="font-sp-display text-3xl font-bold">Rename team</h2>
        <p className="mt-1 mb-6 text-sm text-sp-text-faint">A familiar name for everyone at the table.</p>
        <label htmlFor="room-team-name" className="mb-1.5 block text-xs font-semibold text-sp-text-faint">Team name (optional)</label>
        <input id="room-team-name" value={value} onChange={e => setValue(e.target.value)} maxLength={40} disabled={busy} placeholder="e.g. The Trailblazers"
          className="min-h-12 w-full rounded-lg border border-sp-border-strong bg-sp-bg px-3 text-lg font-semibold text-sp-text" />
        <div className="mt-2 flex justify-between gap-3 text-xs text-sp-text-faint"><span>Leave blank to use just the room code.</span><span>{value.length}/40</span></div>
        {error && <p role="alert" className="mt-3 text-sm text-sp-warn-text">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={onClose} className="min-h-11 cursor-pointer rounded-lg border border-sp-border px-4">Cancel</button>
          <button disabled={busy || value.trim() === (teamName ?? '')} className="min-h-11 cursor-pointer rounded-lg bg-sp-accent px-4 disabled:opacity-50 font-semibold text-sp-bg">{busy ? 'Saving…' : 'Save team name'}</button>
        </div>
      </form>
    </dialog>
  );
}
