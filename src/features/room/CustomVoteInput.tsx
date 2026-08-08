import { useEffect, useState } from 'react';

interface CustomVoteInputProps {
  myVote: string | null;
  onSubmit: (value: string) => void;
}

// Replaces the card grid for the Custom/Flexible deck: a free-text field in
// the same "Your vote" slot, submitted on Enter or via the Submit button.
// Once submitted the field locks (matching how a numeric card, once picked,
// isn't directly editable either) -- "Change" clears it back to an editable
// draft rather than allowing silent in-place edits after the fact.
export default function CustomVoteInput({ myVote, onSubmit }: CustomVoteInputProps) {
  const [draft, setDraft] = useState(myVote ?? '');
  const [editing, setEditing] = useState(myVote == null);

  useEffect(() => {
    if (myVote == null) {
      setDraft('');
      setEditing(true);
    }
  }, [myVote]);

  const submit = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setEditing(false);
  };

  const locked = myVote != null && !editing;

  return (
    <>
      <span className="text-[11px] font-bold tracking-[0.05em] whitespace-nowrap text-sp-text-faintest uppercase">Your vote</span>
      <div className="flex w-full max-w-[280px] items-center gap-2">
        {locked ? (
          <>
            <div className="flex-1 truncate rounded-lg border-2 border-sp-accent bg-sp-accent-panel px-3.5 py-3 font-sp-mono text-sm font-bold text-sp-accent-on-card">
              {myVote}
            </div>
            <button
              onClick={() => { setDraft(myVote ?? ''); setEditing(true); }}
              className="cursor-pointer rounded-lg border border-sp-border-strong bg-transparent px-3.5 py-3 font-sp-font text-[13px] font-semibold whitespace-nowrap text-sp-text-dim"
            >Change</button>
          </>
        ) : (
          <>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="Enter…"
              className="flex-1 rounded-lg border-[1.5px] border-sp-border-strong bg-sp-card-bg px-3.5 py-3 font-sp-mono text-sm text-sp-text outline-none"
            />
            <button
              onClick={submit}
              className="cursor-pointer rounded-lg border-none bg-sp-accent px-4 py-3 font-sp-font text-[13px] font-bold whitespace-nowrap text-sp-bg"
            >Submit</button>
          </>
        )}
      </div>
    </>
  );
}
