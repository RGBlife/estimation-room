import { useState } from 'react';

interface WeaponShapeProps {
  shape?: string;
}

// Small hand-drawn (non-emoji) weapon glyphs, shared by the weapon tray
// preview and the in-flight throw overlay so both stay visually identical.
export default function WeaponShape({ shape }: WeaponShapeProps) {
  if (shape === 'custom-image') {
    return <CustomImageShape />;
  }
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
  if (shape === 'fallback-portrait') {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" style={{ display: 'block' }}>
        {/* Generic placeholder portrait shown until a custom image is dropped
            into public/weapons/ — see CustomImageShape below. */}
        <circle cx="14" cy="11" r="10.5" fill="#8b95a3" />
        <ellipse cx="14" cy="14.5" rx="6.6" ry="7" fill="#e8ecf1" />
        <circle cx="11" cy="13.5" r="1.1" fill="#8b95a3" />
        <circle cx="17" cy="13.5" r="1.1" fill="#8b95a3" />
        <path d="M10.5 18 Q14 20.5 17.5 18" stroke="#8b95a3" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <path d="M5 26 L11 22.5 L14 25 L17 22.5 L23 26 L23 28 L5 28 Z" fill="#c7cfd9" />
      </svg>
    );
  }
  return null;
}

// The 'bob-ross' weapon slot renders whatever image is dropped in at
// public/weapons/bob-ross.<ext>. Falls back to a generic placeholder glyph
// if no file has been added yet, so the tray never breaks out of the box.
const CUSTOM_IMAGE_CANDIDATES = ['jpg', 'jpeg', 'png', 'webp', 'gif'].map(
  ext => `/weapons/bob-ross.${ext}`
);

function CustomImageShape() {
  const [triedIndex, setTriedIndex] = useState(0);

  if (triedIndex >= CUSTOM_IMAGE_CANDIDATES.length) {
    return <WeaponShape shape="fallback-portrait" />;
  }

  return (
    <img
      src={CUSTOM_IMAGE_CANDIDATES[triedIndex]}
      alt=""
      width={28}
      height={28}
      style={{ display: 'block', borderRadius: '50%', objectFit: 'cover' }}
      onError={() => setTriedIndex(i => i + 1)}
    />
  );
}
