import { useEffect, useState } from 'react';

interface CustomVoteInputProps {
  myVote: string | null;
  onSubmit: (value: string) => void;
}

// Replaces the card grid for the Custom/Flexible deck: a free-text field in
// the same "Your vote" slot, submitted on Enter or via the Submit button.
export default function CustomVoteInput({ myVote, onSubmit }: CustomVoteInputProps) {
  const [draft, setDraft] = useState(myVote ?? '');

  useEffect(() => {
    setDraft(myVote ?? '');
  }, [myVote]);

  const submit = () => {
    const trimmed = draft.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <>
      <span className="text-[11px] font-bold tracking-[0.05em] whitespace-nowrap text-sp-text-faintest uppercase">Your vote</span>
      <div className="flex w-full max-w-[280px] items-center gap-2">
        <input
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
      </div>
    </>
  );
}
