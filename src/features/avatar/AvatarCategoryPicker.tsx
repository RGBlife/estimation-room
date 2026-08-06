import { AVATAR_CATEGORIES, type AvatarCategory, type LooseAvatar } from './avatar.ts';
import OptionTile from './OptionTile.tsx';
import type { Breakpoint } from './useViewportBreakpoint.ts';

function railBtnClass(active: boolean): string {
  const base = 'flex w-full items-center justify-between rounded-lg border-none p-2 text-left font-sp-font text-[11px] font-bold tracking-[0.05em] uppercase cursor-pointer';
  return active
    ? `${base} bg-sp-accent-panel-3 text-sp-accent-text-strong`
    : `${base} bg-transparent text-sp-text-dim`;
}

const arrowBtnClass = 'flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-full border border-sp-border bg-sp-panel-2 p-0 text-xs text-sp-text-dim';

interface AvatarCategoryPickerProps {
  avatar: LooseAvatar;
  breakpoint: Breakpoint;
  pro: boolean;
  activeIdx: number;
  onSelectCategory: (i: number) => void;
  category: AvatarCategory;
  page: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  pageCount: number;
  pageValues: string[];
  pageStart: number;
  selectedValueIdx: number;
  onSelectValue: (valueIdx: number) => void;
  isOn: boolean;
  onToggleOptional: () => void;
}

// The expanded customize panel: category rail (or a <select> when stacked),
// pager arrows, the option-tile grid, and the optional-category on/off toggle.
export default function AvatarCategoryPicker({
  avatar, breakpoint, pro, activeIdx, onSelectCategory, category, page, onPrevPage, onNextPage,
  pageCount, pageValues, pageStart, selectedValueIdx, onSelectValue, isOn, onToggleOptional,
}: AvatarCategoryPickerProps) {
  return (
    <div
      className={`box-border w-full gap-3.5 rounded-xl border border-sp-border bg-sp-panel p-3.5 flex ${breakpoint.stacked ? 'flex-col gap-2.5' : 'flex-row'}`}
    >
      {breakpoint.stacked ? (
        <select
          value={activeIdx}
          onChange={(e) => onSelectCategory(Number(e.target.value))}
          className="w-full rounded-lg border border-sp-border bg-sp-panel-2 px-2.5 py-2 font-sp-font text-xs font-bold tracking-[0.03em] text-sp-text uppercase"
        >
          {AVATAR_CATEGORIES.map((cat, i) => (
            <option key={cat.key} value={i}>
              {cat.label}{cat.pro && !pro ? ' (Pro)' : ''}
            </option>
          ))}
        </select>
      ) : (
        <div className="flex w-[100px] flex-none flex-col gap-0.5">
          {AVATAR_CATEGORIES.map((cat, i) => (
            <button key={cat.key} onClick={() => onSelectCategory(i)} className={railBtnClass(i === activeIdx)}>
              <span>{cat.label}</span>
              {cat.pro && !pro && (
                <span className="rounded-md bg-[linear-gradient(135deg,#f5a623,#f76b1c)] px-[5px] py-[2px] text-[8px] font-bold text-white">Pro</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div className={`flex min-w-0 flex-1 flex-col gap-2 ${breakpoint.stacked ? '' : 'border-l border-sp-border pl-3'}`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-[0.05em] text-sp-text-faintest uppercase">
            {category.label} · {category.values.length}
          </span>
          {category.optional && (
            <button
              onClick={onToggleOptional}
              className={`cursor-pointer border-none bg-transparent font-sp-font text-[10px] font-bold ${isOn ? 'text-sp-accent-text-strong' : 'text-sp-text-faint'}`}
            >
              {isOn ? 'On' : 'Off'}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onPrevPage} className={arrowBtnClass}>‹</button>
          <div
            className="grid flex-1 min-w-0 justify-center gap-3.5"
            style={{ gridTemplateColumns: `repeat(${breakpoint.columns}, 72px)`, gridAutoRows: 72 }}
          >
            {pageValues.map((value, i) => {
              const valueIdx = pageStart + i;
              return (
                <OptionTile
                  key={value}
                  avatar={avatar}
                  category={category}
                  valueIdx={valueIdx}
                  value={value}
                  selected={valueIdx === selectedValueIdx}
                  onSelect={() => onSelectValue(valueIdx)}
                />
              );
            })}
          </div>
          <button onClick={onNextPage} className={arrowBtnClass}>›</button>
        </div>

        <div className="text-center text-[10px] text-sp-text-placeholder">page {page + 1} of {pageCount}</div>
      </div>
    </div>
  );
}
