export default function NudgeButton({ name, onClick, disabled = false }: {
  name: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const label = disabled ? 'Wait a moment before nudging again' : `Nudge ${name} to vote`;
  return (
    <button
      type="button"
      aria-label={`Nudge ${name} to vote`}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-full min-h-9 w-full min-w-9 cursor-pointer items-center justify-center rounded-[5px] border border-dashed border-sp-border-strong bg-sp-card-bg text-sp-text-faintest transition-colors hover:border-sp-accent hover:text-sp-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sp-accent disabled:cursor-default disabled:opacity-40"
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4M12 2V1" />
      </svg>
    </button>
  );
}
