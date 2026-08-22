import { useEffect, useRef, useState } from 'react';

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
}

interface RoomMenuGroup {
  // Uppercase heading above the group. Groups exist so a set of related
  // choices (the decks) doesn't read as more one-shot actions.
  heading: string;
  items: RoomMenuItem[];
}

interface RoomMenuProps {
  items: RoomMenuItem[];
  groups?: RoomMenuGroup[];
}

// Phone-only overflow menu for the room's secondary controls. On a narrow
// screen the header's six controls had shrunk to fit -- the theme toggle was
// 28x28 and "Leave room" was 32x16, well under the 44x44 minimum a finger
// needs, and they still wrapped the header into a tower. Collapsing
// everything except the room code behind one properly-sized button trades
// a tap for controls that can actually be tapped.
export default function RoomMenu({ items, groups = [] }: RoomMenuProps) {
  const [open, setOpen] = useState(false);
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
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Room menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border border-sp-border-strong bg-sp-panel-2 text-sp-text-dim"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="sp-vote-card-enter absolute top-[calc(100%+8px)] right-0 z-30 max-h-[70dvh] w-[230px] overflow-x-hidden overflow-y-auto rounded-lg border border-sp-border-strong bg-sp-panel shadow-[0_10px_28px_rgba(0,0,0,0.35)]"
        >
          {groups.map(group => (
            <div key={group.heading} className="border-b border-sp-border">
              <div className="px-3.5 pt-2.5 pb-1 font-sp-font text-[10px] font-bold tracking-[0.06em] text-sp-text-faintest uppercase">
                {group.heading}
              </div>
              {group.items.map(item => (
                <button
                  key={item.label}
                  role="menuitemradio"
                  aria-checked={!!item.selected}
                  onClick={() => { setOpen(false); item.onSelect(); }}
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
              onClick={() => { setOpen(false); item.onSelect(); }}
              className={`flex min-h-[44px] w-full cursor-pointer items-center border-none border-b border-sp-border bg-transparent px-3.5 text-left font-sp-font text-[13px] font-semibold last:border-b-0 ${
                item.accent ? 'text-sp-accent-text' : 'text-sp-text-dim'
              }`}
            >{item.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
