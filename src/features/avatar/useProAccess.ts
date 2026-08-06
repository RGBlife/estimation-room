import { useState } from 'react';

const PRO_KEY = 'sp_avatar_pro';

function hasProAccess(): boolean {
  try {
    return localStorage.getItem(PRO_KEY) === '1';
  } catch {
    return false;
  }
}

function grantProAccess(): void {
  try {
    localStorage.setItem(PRO_KEY, '1');
  } catch {
    // localStorage unavailable — Pro will just prompt again next visit.
  }
}

interface UseProAccessResult {
  pro: boolean;
  showProModal: boolean;
  requestProGate: () => boolean;
  openProModal: () => void;
  closeProModal: () => void;
  subscribe: (onSubscribed: () => void) => void;
}

// Pro-gating: localStorage-backed "purchase" flag plus the modal open state.
export function useProAccess(): UseProAccessResult {
  const [pro, setPro] = useState(hasProAccess);
  const [showProModal, setShowProModal] = useState(false);

  // Returns true if access is already granted; otherwise opens the modal and
  // returns false, so callers can bail out of whatever gated action they were
  // about to take.
  const requestProGate = (): boolean => {
    if (pro) return true;
    setShowProModal(true);
    return false;
  };

  const subscribe = (onSubscribed: () => void) => {
    grantProAccess();
    setPro(true);
    setShowProModal(false);
    onSubscribed();
  };

  return {
    pro,
    showProModal,
    requestProGate,
    openProModal: () => setShowProModal(true),
    closeProModal: () => setShowProModal(false),
    subscribe,
  };
}
