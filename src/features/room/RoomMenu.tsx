import { useEffect, useRef, useState, type ReactNode } from 'react';

interface RoomMenuItem {
  label: string;
  onSelect: () => void;
  // Renders in the accent colour -- for the item that changes what you are
  // in the room (voter/observer), which is a different kind of action from
  // leaving or toggling a display preference.
  accent?: boolean;
  // Marks the current value within a group (e.g. the active deck), shown
  // with a check so the group reads as a choice rather than a list of
  // actions.
  selected?: boolean;
  // Quiet text at the row's end, e.g. a count.
  detail?: string;
  // Shown but not available yet; `detail` says when it will be.
  disabled?: boolean;
}

interface RoomMenuGroup {
  // A small heading above the group. Groups exist so a set of related
  // choices (the decks) doesn't read as more one-shot actions.
  heading: string;
  items: RoomMenuItem[];
}

interface RoomMenuProps {
  items: RoomMenuItem[];
  groups?: RoomMenuGroup[];
  // Button size in px: 44 for a finger, smaller beside desktop controls.
  size?: number;
  // The trigger's accessible name and contents: the room's ⚙ by default.
  label?: string;
  trigger?: ReactNode;
  // A round trigger, for the avatar.
  round?: boolean;
  // Quiet lines above the items, e.g. your coin balance.
  summary?: ReactNode;
}

const COG = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85 1 1.51 1H21a2 2 0 1 1 0 4h-.09c-.66 0-1.25.4-1.51 1z" />
  </svg>
);

// A header menu: the room's settings behind ⚙, or your own things behind
// your avatar. Rows are full-size (44px) on every screen, so settings that
// are used once a session cost a tap rather than header space.
export default function RoomMenu({ items, groups = [], size = 44, label = 'Room menu', trigger = COG, round = false, summary }: RoomMenuProps) {
  const [open, setOpen] = useState(false);
  // Focus the persistent trigger before an action opens a dialog; menu items unmount.
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
        style={round ? { height: size } : { width: size, height: size }}
        className={round
          ? 'flex cursor-pointer items-center gap-1 rounded-full border border-sp-border-strong bg-sp-card-bg p-1 text-sp-text-dim hover:border-sp-accent'
          : 'flex cursor-pointer items-center justify-center rounded-md border border-sp-border-strong bg-sp-panel-2 text-sp-text-dim hover:text-sp-text'}
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className={`sp-vote-card-enter absolute top-[calc(100%+8px)] ${round ? 'left-0' : 'right-0'} z-50 max-h-[70dvh] w-[230px] overflow-x-hidden overflow-y-auto rounded-lg border border-sp-border-strong bg-sp-panel shadow-sp-md`}
        >
          {summary && <div className="border-b border-sp-border px-3.5 py-2.5 font-sp-font text-[13px] text-sp-text-dim">{summary}</div>}
          {groups.map(group => (
            <div key={group.heading} className="border-b border-sp-border">
              <div className="px-3.5 pt-2.5 pb-1 font-sp-font text-[11px] font-semibold text-sp-text-faint">
                {group.heading}
              </div>
              {group.items.map(item => (
                <button
                  key={item.label}
                  role="menuitemradio"
                  aria-checked={!!item.selected}
                  onClick={() => { setOpen(false); triggerRef.current?.focus(); item.onSelect(); }}
                  className={`flex min-h-[44px] w-full cursor-pointer items-center justify-between gap-2 border-none bg-transparent px-3.5 text-left font-sp-font text-[13px] font-semibold ${
                    item.selected ? 'text-sp-accent-text' : 'text-sp-text-dim'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  {item.selected && <span aria-hidden="true" className="shrink-0">✓</span>}
                </button>
              ))}
            </div>
          ))}
          {items.map(item => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => { setOpen(false); triggerRef.current?.focus(); item.onSelect(); }}
              className={`flex min-h-[44px] w-full items-center justify-between gap-2 border-none border-b border-sp-border bg-transparent px-3.5 text-left font-sp-font text-[13px] font-semibold last:border-b-0 ${
                item.disabled ? 'cursor-default text-sp-text-faint' : item.accent ? 'cursor-pointer text-sp-accent-text' : 'cursor-pointer text-sp-text-dim'
              }`}
            >
              <span className="truncate">{item.label}</span>
              {item.detail && <span className="shrink-0 text-xs font-normal text-sp-text-faint tabular-nums">{item.detail}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
