// Small hand-drawn (non-emoji) weapon glyphs, shared by the weapon tray
// preview and the in-flight throw overlay so both stay visually identical.
export default function WeaponShape({ shape }) {
  if (shape === 'microwave') {
    return (
      <div style={{ width: 26, height: 19, borderRadius: 4, background: '#c7cdd6', border: '2px solid #4a5568', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 3, left: 3, width: 11, height: 11, borderRadius: '50%', background: '#2b3440' }} />
      </div>
    );
  }
  if (shape === 'snowball') {
    return (
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#fdfeff', border: '2px solid #cfe3f7', boxShadow: 'inset -3px -3px 0 #e3eef9' }} />
    );
  }
  if (shape === 'paper-airplane') {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ display: 'block' }}>
        <path d="M2 15 L26 3 L15 26 L12.5 16.5 Z" fill="#e8ecf1" stroke="#8b95a3" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M12.5 16.5 L26 3 L14.5 19.5 Z" fill="#c7cfd9" stroke="#8b95a3" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    );
  }
  if (shape === 'bob-ross') {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ display: 'block' }}>
        <circle cx="14" cy="12" r="9" fill="#3b2415" />
        <circle cx="8" cy="7" r="3" fill="#3b2415" />
        <circle cx="20" cy="7" r="3" fill="#3b2415" />
        <circle cx="6" cy="12" r="3" fill="#3b2415" />
        <circle cx="22" cy="12" r="3" fill="#3b2415" />
        <circle cx="14" cy="4" r="3.2" fill="#3b2415" />
        <circle cx="14" cy="14" r="6.5" fill="#e8b384" />
        <path d="M9 17 Q14 22 19 17 L18 19.5 Q14 23 10 19.5 Z" fill="#3b2415" />
        <rect x="4" y="21" width="9" height="6" rx="1.5" fill="#d9d2c4" stroke="#8b95a3" strokeWidth="0.6" />
        <circle cx="6.5" cy="24" r="1" fill="#c94f4f" />
        <circle cx="9" cy="23" r="1" fill="#4f8fc9" />
        <circle cx="11" cy="24.5" r="1" fill="#e0b23c" />
      </svg>
    );
  }
  return null;
}
