import { useEffect, useRef, useState } from 'react';
import AvatarBuilder from '../avatar/AvatarBuilder.tsx';
import { normalizeAvatar } from '../avatar/avatar.ts';
import type { AvatarOptions, Participant } from '../../types/room.ts';

export default function RoomAvatarEditor({ participant, onSave, onClose }: {
  participant: Participant;
  onSave: (avatar: AvatarOptions) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(() => normalizeAvatar(participant.avatar));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const node = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    node.showModal();
    return () => { node.close(); previous?.focus(); };
  }, []);
  const save = async () => {
    setSaving(true);
    setError('');
    try { await onSave(draft); onClose(); }
    catch { setError("Couldn't save your avatar. Check your connection and try again."); setSaving(false); }
  };
  return (
    <dialog ref={dialog} role="dialog" aria-labelledby="avatar-editor-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[min(620px,calc(100%-24px))] overflow-y-auto rounded-2xl border border-sp-border bg-sp-panel p-0 text-sp-text shadow-xl backdrop:bg-black/40">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-sp-border bg-sp-panel px-5 py-3">
        <h2 id="avatar-editor-title" className="text-lg font-bold">Your look at the table</h2>
        <button onClick={onClose} disabled={saving} aria-label="Close avatar editor" className="h-11 w-11 cursor-pointer rounded-md text-xl disabled:opacity-40">×</button>
      </div>
      <div className="px-5 pt-5">
        <fieldset disabled={saving}>
          <AvatarBuilder avatar={draft} onChange={setDraft} initiallyExpanded />
        </fieldset>
        {error && <p role="alert" className="pb-3 text-sm text-sp-text">{error}</p>}
      </div>
      <div className="sticky bottom-0 flex justify-end gap-3 border-t border-sp-border bg-sp-panel px-5 py-3">
        <button onClick={onClose} disabled={saving} className="min-h-11 cursor-pointer rounded-md px-4 text-sm disabled:opacity-40">Cancel</button>
        <button onClick={() => void save()} disabled={saving} className="min-h-11 cursor-pointer rounded-md bg-sp-accent px-5 text-sm font-bold text-sp-bg disabled:opacity-50">{saving ? 'Saving…' : 'Save avatar'}</button>
      </div>
    </dialog>
  );
}
