import { useEffect, useRef, useState } from 'react';

const WEAPON_TIP_MS = 10000;
const WEAPON_TIP_FADE_MS = 600;
const HAS_THROWN_KEY = 'sp_has_thrown_weapon';

interface UseWeaponTargetingResult {
  weaponTrayOpen: boolean;
  equippedWeaponId: string | null;
  weaponTipRendered: boolean;
  weaponTipClosing: boolean;
  openTray: () => void;
  closeTray: () => void;
  selectWeapon: (weaponId: string) => void;
  cancelTargeting: () => void;
  dismissWeaponTip: () => void;
  throwAt: (targetUid: string, event: React.MouseEvent | undefined, onThrow: (targetUid: string, weaponId: string, offsetX: number, offsetY: number) => void) => void;
}

// Owns weapon-tray open/equip state and the one-time "click someone to hit
// them" tip banner. The tip only shows the first time this browser ever
// equips a weapon, and auto-fades after WEAPON_TIP_MS; once the user has
// actually thrown once, it never shows again (tracked in localStorage so it
// stays gone across sessions/rounds).
export function useWeaponTargeting(): UseWeaponTargetingResult {
  const [weaponTrayOpen, setWeaponTrayOpen] = useState(false);
  const [equippedWeaponId, setEquippedWeaponId] = useState<string | null>(null);
  const [weaponTipRendered, setWeaponTipRendered] = useState(false);
  const [weaponTipClosing, setWeaponTipClosing] = useState(false);
  const weaponTipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weaponTipFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissWeaponTip = () => {
    clearTimeout(weaponTipTimerRef.current ?? undefined);
    setWeaponTipClosing(true);
    clearTimeout(weaponTipFadeTimerRef.current ?? undefined);
    weaponTipFadeTimerRef.current = setTimeout(() => {
      setWeaponTipRendered(false);
      setWeaponTipClosing(false);
    }, WEAPON_TIP_FADE_MS);
  };

  const selectWeapon = (weaponId: string) => {
    setEquippedWeaponId(weaponId);
    setWeaponTrayOpen(false);
    clearTimeout(weaponTipTimerRef.current ?? undefined);
    if (!localStorage.getItem(HAS_THROWN_KEY)) {
      clearTimeout(weaponTipFadeTimerRef.current ?? undefined);
      setWeaponTipRendered(true);
      setWeaponTipClosing(false);
      weaponTipTimerRef.current = setTimeout(dismissWeaponTip, WEAPON_TIP_MS);
    }
  };

  const cancelTargeting = () => {
    setEquippedWeaponId(null);
    dismissWeaponTip();
  };

  useEffect(() => () => {
    clearTimeout(weaponTipTimerRef.current ?? undefined);
    clearTimeout(weaponTipFadeTimerRef.current ?? undefined);
  }, []);

  // Weapon stays equipped after a throw so people can keep hitting targets
  // without reopening the tray — only Cancel or picking a new weapon clears it.
  // The click position within the target's avatar (roughly -0.5..0.5 of its
  // width/height, from center) travels with the throw so the impact lands
  // where they actually clicked instead of always snapping to the center.
  const throwAt = (
    targetUid: string,
    event: React.MouseEvent | undefined,
    onThrow: (targetUid: string, weaponId: string, offsetX: number, offsetY: number) => void,
  ) => {
    if (!equippedWeaponId) return;
    let offsetX = 0;
    let offsetY = 0;
    if (event?.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      offsetX = (event.clientX - rect.left) / rect.width - 0.5;
      offsetY = (event.clientY - rect.top) / rect.height - 0.5;
    }
    localStorage.setItem(HAS_THROWN_KEY, '1');
    dismissWeaponTip();
    onThrow(targetUid, equippedWeaponId, offsetX, offsetY);
  };

  return {
    weaponTrayOpen,
    equippedWeaponId,
    weaponTipRendered,
    weaponTipClosing,
    openTray: () => setWeaponTrayOpen(true),
    closeTray: () => setWeaponTrayOpen(false),
    selectWeapon,
    cancelTargeting,
    dismissWeaponTip,
    throwAt,
  };
}

export { WEAPON_TIP_FADE_MS };
