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
      <div className="relative h-[19px] w-[26px] rounded border-2 border-[#4a5568] bg-[#c7cdd6]">
        <div className="absolute top-[3px] left-[3px] h-[11px] w-[11px] rounded-full bg-[#2b3440]" />
      </div>
    );
  }
  if (shape === 'snowball') {
    return (
      <div className="h-[22px] w-[22px] rounded-full border-2 border-[#cfe3f7] bg-[#fdfeff] shadow-[inset_-3px_-3px_0_#e3eef9]" />
    );
  }
  if (shape === 'paper-airplane') {
    // Drawn nose-right, so that an unrotated sprite reads as heading 0deg --
    // the same convention atan2 uses, and therefore the same one the flight
    // code rotates it by. The original artwork pointed up and to the right,
    // baking in a 45deg offset: every heading the flight computed was applied
    // 45deg out, and because the shape is close to symmetric about that
    // diagonal the plane looked like it was holding one fixed attitude no
    // matter which way it was actually travelling.
    //
    // Nose at (27,14) on the centre line; the swept-back wing tips and the
    // notch between them trail to the left.
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" className="block">
        <path d="M27 14 L3 25 L9 14 L3 3 Z" fill="#e8ecf1" stroke="#8b95a3" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M27 14 L9 14 L3 25 Z" fill="#c7cfd9" stroke="#8b95a3" strokeWidth="1" strokeLinejoin="round" />
      </svg>
    );
  }
  if (shape === 'fallback-portrait') {
    return (
      <svg width="28" height="28" viewBox="0 0 28 28" className="block">
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
// Paths must go through BASE_URL rather than a hardcoded leading slash --
// GitHub Pages serves this app from /estimation-room/, so a literal
// "/weapons/..." 404s there even though it resolves fine in local dev
// (where the base path is just "/").
const CUSTOM_IMAGE_CANDIDATES = ['jpg', 'jpeg', 'png', 'webp', 'gif'].map(
  ext => `${import.meta.env.BASE_URL}weapons/bob-ross.${ext}`
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
      className="block rounded-full object-cover"
      onError={() => setTriedIndex(i => i + 1)}
    />
  );
}
