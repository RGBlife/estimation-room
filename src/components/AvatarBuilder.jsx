import { useEffect, useState } from 'react';
import { AVATAR_BG, AVATAR_CATEGORIES, avatarDataUri, avatarPreviewUri, randomAvatar } from '../lib/avatar.js';

const PRO_KEY = 'sp_avatar_pro';

// Grid widens on bigger screens (more room either side of the join card), so
// more thumbnails fit per row/page without any horizontal scrolling.
const BREAKPOINTS = [
  { minWidth: 1100, panelWidth: 780, columns: 6, rows: 2, stacked: false },
  { minWidth: 760, panelWidth: 620, columns: 4, rows: 2, stacked: false },
  { minWidth: 0, panelWidth: null, columns: 3, rows: 2, stacked: true },
];

function useViewportBreakpoint() {
  const getBreakpoint = () => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 0;
    return BREAKPOINTS.find((b) => w >= b.minWidth);
  };
  const [breakpoint, setBreakpoint] = useState(getBreakpoint);
  useEffect(() => {
    const onResize = () => setBreakpoint(getBreakpoint());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return breakpoint;
}

export function useAvatarPanelWidth(expanded) {
  const breakpoint = useViewportBreakpoint();
  return expanded ? breakpoint.panelWidth : null;
}

function hasProAccess() {
  try {
    return localStorage.getItem(PRO_KEY) === '1';
  } catch {
    return false;
  }
}

function grantProAccess() {
  try {
    localStorage.setItem(PRO_KEY, '1');
  } catch {
    // localStorage unavailable — Pro will just prompt again next visit.
  }
}

function railBtnStyle(active) {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
    background: active ? 'var(--sp-accent-panel-3)' : 'transparent',
    color: active ? 'var(--sp-accent-text-strong)' : 'var(--sp-text-dim)',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
    fontFamily: 'var(--sp-font)', textAlign: 'left', width: '100%',
  };
}

function arrowBtnStyle() {
  return {
    width: 24, height: 24, borderRadius: '50%', flex: 'none',
    border: '1px solid var(--sp-border)', background: 'var(--sp-panel-2)',
    color: 'var(--sp-text-dim)', fontSize: 12, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  };
}

function ProModal({ onSubscribe, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, background: 'var(--sp-panel)',
          border: '1px solid var(--sp-border)', borderRadius: 14, padding: 24,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'linear-gradient(135deg,#f5a623,#f76b1c)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 7px', borderRadius: 5, letterSpacing: '0.04em' }}>PRO</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--sp-text)' }}>Unlock Scrum Poker Pro</span>
        </div>

        <div style={{ fontSize: 13, color: 'var(--sp-text-dim)', lineHeight: 1.5 }}>Get Pro for the following:</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--sp-text-dim)', lineHeight: 1.4 }}>
          <li>All your implementations will work first time, won't ever error</li>
          <li>AI will no longer make any mistakes</li>
          <li>Each pro user will get a personal cleaning robot (due 2050)</li>
          <li>We'll send Microsoft Teams every month a strongly worded complaint letter</li>
          <li>Priority queue for the one guy who understands the legacy VB.NET codebase</li>
          <li>The power to fly (enhanced durability not included)</li>
          <li>Oh, and access to the extras section of the avatar creator</li>
        </ul>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, justifyContent: 'center', padding: '6px 0' }}>
          <span style={{ fontSize: 15, color: 'var(--sp-text-placeholder)', textDecoration: 'line-through' }}>€10,000 a month</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--sp-accent-text-strong)' }}>€5.00 a month</span>
        </div>

        <div style={{ fontSize: 11, color: 'var(--sp-text-placeholder)', textAlign: 'center' }}>(Disclaimer: none of it is true.)</div>

        <button
          onClick={onSubscribe}
          style={{ border: 'none', background: 'var(--sp-accent)', color: 'var(--sp-bg)', borderRadius: 10, padding: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--sp-font)' }}
        >Subscribe Now</button>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', color: 'var(--sp-text-faint)', fontSize: 12, cursor: 'pointer', padding: 2 }}
        >Not now</button>
      </div>
    </div>
  );
}

function OptionTile({ avatar, category, valueIdx, value, selected, onSelect }) {
  const swatchColor = category.swatch ? '#' + value : null;
  const previewUrl = category.swatch ? null : avatarPreviewUri(avatar, category.key, valueIdx, category.optional);
  return (
    <button
      onClick={onSelect}
      title={value}
      style={{
        width: 72, height: 72, flex: 'none', borderRadius: 10, cursor: 'pointer', padding: swatchColor ? 0 : 3,
        background: swatchColor ?? 'var(--sp-panel-2)',
        border: selected ? '2px solid var(--sp-accent)' : '1px solid var(--sp-border)',
        boxShadow: selected ? '0 0 0 2px var(--sp-accent-panel-3)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {previewUrl && <img src={previewUrl} alt={value} style={{ width: '100%', height: '100%', borderRadius: 6, display: 'block' }} />}
    </button>
  );
}

export default function AvatarBuilder({ avatar, onChange, onExpandedChange }) {
  const [expanded, setExpandedState] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [page, setPage] = useState(0);
  const [pro, setPro] = useState(hasProAccess);
  const [showProModal, setShowProModal] = useState(false);
  const breakpoint = useViewportBreakpoint();

  const setExpanded = (value) => {
    setExpandedState(value);
    onExpandedChange?.(value);
  };

  const avatarUrl = avatarDataUri(avatar);
  const category = AVATAR_CATEGORIES[activeIdx];
  const pageSize = breakpoint.columns * breakpoint.rows;

  const shuffle = () => onChange(randomAvatar());

  const selectBg = (i) => onChange({ ...avatar, bgIdx: i });

  const selectCategory = (i) => {
    if (AVATAR_CATEGORIES[i].pro && !pro) {
      setShowProModal(true);
      return;
    }
    setActiveIdx(i);
    setPage(0);
  };

  const selectValue = (valueIdx) => {
    const next = { ...avatar, [category.key]: valueIdx };
    if (category.optional) next[`${category.key}On`] = true;
    onChange(next);
  };

  const toggleOptional = () => {
    onChange({ ...avatar, [`${category.key}On`]: !avatar[`${category.key}On`] });
  };

  const subscribe = () => {
    grantProAccess();
    setPro(true);
    setShowProModal(false);
    setActiveIdx(AVATAR_CATEGORIES.length - 1);
    setPage(0);
  };

  const pageCount = Math.ceil(category.values.length / pageSize);
  const pageStart = page * pageSize;
  const pageValues = category.values.slice(pageStart, pageStart + pageSize);
  const selectedValueIdx = avatar[category.key] ?? 0;
  const isOn = !category.optional || avatar[`${category.key}On`];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, marginBottom: 24, width: '100%' }}>
      {showProModal && (
        <ProModal onSubscribe={subscribe} onClose={() => setShowProModal(false)} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 104, height: 104, borderRadius: '50%', overflow: 'hidden', flex: 'none', background: 'var(--sp-bg)', border: '1px solid var(--sp-card-idle-border)' }}>
          <img src={avatarUrl} alt="avatar preview" style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
        <button
          onClick={shuffle}
          title="Randomise"
          style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--sp-panel-2)', border: '1px solid var(--sp-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--sp-text-dim)', flex: 'none' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8"></polyline>
            <line x1="4" y1="20" x2="21" y2="3"></line>
            <polyline points="21 16 21 21 16 21"></polyline>
            <line x1="15" y1="15" x2="21" y2="21"></line>
            <line x1="4" y1="4" x2="9" y2="9"></line>
          </svg>
        </button>
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--sp-text-faintest)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6, textAlign: 'center' }}>Background</div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', justifyContent: 'center' }}>
          {AVATAR_BG.map((hex, i) => (
            <button
              key={hex}
              onClick={() => selectBg(i)}
              style={{ width: 24, height: 24, borderRadius: '50%', background: '#' + hex, cursor: 'pointer', padding: 0, border: '2px solid transparent', position: 'relative' }}
            >
              {avatar.bgIdx === i && (
                <div style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: '1.5px solid var(--sp-accent)' }} />
              )}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        style={{ border: 'none', background: 'none', padding: 0, fontSize: 12, color: 'var(--sp-accent-text)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'var(--sp-font)' }}
      >
        {expanded ? 'Collapse ▲' : 'Customize ▾'}
      </button>

      <div
        className={`sp-collapse${expanded ? ' sp-collapse-open' : ''}`}
        style={{ width: '100%', alignSelf: 'stretch' }}
      >
        <div>
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
                onChange={(e) => selectCategory(Number(e.target.value))}
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
                  <button key={cat.key} onClick={() => selectCategory(i)} style={railBtnStyle(i === activeIdx)}>
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
                    onClick={toggleOptional}
                    style={{ fontSize: 10, fontWeight: 700, color: isOn ? 'var(--sp-accent-text-strong)' : 'var(--sp-text-faint)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--sp-font)' }}
                  >
                    {isOn ? 'On' : 'Off'}
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setPage((p) => (p - 1 + pageCount) % pageCount)}
                  style={arrowBtnStyle()}
                >‹</button>
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
                        onSelect={() => selectValue(valueIdx)}
                      />
                    );
                  })}
                </div>
                <button
                  onClick={() => setPage((p) => (p + 1) % pageCount)}
                  style={arrowBtnStyle()}
                >›</button>
              </div>

              <div style={{ fontSize: 10, color: 'var(--sp-text-placeholder)', textAlign: 'center' }}>page {page + 1} of {pageCount}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
