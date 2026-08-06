import type { CSSProperties } from 'react';
import { AVATAR_CATEGORIES, type AvatarCategory, type LooseAvatar } from './avatar.ts';
import OptionTile from './OptionTile.tsx';
import type { Breakpoint } from './useViewportBreakpoint.ts';

function railBtnStyle(active: boolean): CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: active ? 'var(--sp-accent-panel-3)' : 'transparent',
    color: active ? 'var(--sp-accent-text-strong)' : 'var(--sp-text-dim)',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
    fontFamily: 'var(--sp-font)', textAlign: 'left', width: '100%',
  };
}

function arrowBtnStyle(): CSSProperties {
  return {
    width: 24, height: 24, borderRadius: '50%', flex: 'none',
    border: '1px solid var(--sp-border)', background: 'var(--sp-panel-2)',
    color: 'var(--sp-text-dim)', fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  };
}

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
      style={{
        width: '100%',
        border: '1px solid var(--sp-border)', borderRadius: 12, padding: 14,
        display: 'flex', flexDirection: breakpoint.stacked ? 'column' : 'row', gap: breakpoint.stacked ? 10 : 14,
        background: 'var(--sp-panel)',
        boxSizing: 'border-box',
      }}
    >
      {breakpoint.stacked ? (
        <select
          value={activeIdx}
          onChange={(e) => onSelectCategory(Number(e.target.value))}
          style={{
            width: '100%', padding: '8px 10px', borderRadius: 8,
            border: '1px solid var(--sp-border)', background: 'var(--sp-panel-2)',
            color: 'var(--sp-text)', fontSize: 12, fontWeight: 700, letterSpacing: '0.03em',
            textTransform: 'uppercase', fontFamily: 'var(--sp-font)',
          }}
        >
          {AVATAR_CATEGORIES.map((cat, i) => (
            <option key={cat.key} value={i}>
              {cat.label}{cat.pro && !pro ? ' (Pro)' : ''}
            </option>
          ))}
        </select>
      ) : (
        <div style={{ width: 100, display: 'flex', flexDirection: 'column', gap: 2, flex: 'none' }}>
          {AVATAR_CATEGORIES.map((cat, i) => (
            <button key={cat.key} onClick={() => onSelectCategory(i)} style={railBtnStyle(i === activeIdx)}>
              <span>{cat.label}</span>
              {cat.pro && !pro && (
                <span style={{ background: 'linear-gradient(135deg,#f5a623,#f76b1c)', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 5px', borderRadius: 5 }}>Pro</span>
              )}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, borderLeft: breakpoint.stacked ? 'none' : '1px solid var(--sp-border)', paddingLeft: breakpoint.stacked ? 0 : 12, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--sp-text-faintest)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {category.label} · {category.values.length}
          </span>
          {category.optional && (
            <button
              onClick={onToggleOptional}
              style={{ fontSize: 10, fontWeight: 700, color: isOn ? 'var(--sp-accent-text-strong)' : 'var(--sp-text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--sp-font)' }}
            >
              {isOn ? 'On' : 'Off'}
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onPrevPage} style={arrowBtnStyle()}>‹</button>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${breakpoint.columns}, 72px)`, gridAutoRows: 72, gap: 14, flex: 1, minWidth: 0, justifyContent: 'center' }}>
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
          <button onClick={onNextPage} style={arrowBtnStyle()}>›</button>
        </div>

        <div style={{ fontSize: 10, color: 'var(--sp-text-placeholder)', textAlign: 'center' }}>page {page + 1} of {pageCount}</div>
      </div>
    </div>
  );
}
