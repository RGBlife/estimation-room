import { useEffect } from 'react';

let context: AudioContext | undefined;
export function chickenMuted(): boolean {
  try { return localStorage.getItem('sp_chicken_muted') === 'true'; } catch { return false; }
}
export function setChickenMuted(muted: boolean): void {
  try { localStorage.setItem('sp_chicken_muted', String(muted)); } catch { /* Optional preference. */ }
}
export function useThrowAudio() {
  useEffect(() => {
    const unlock = () => {
      if (!window.AudioContext) return;
      context ??= new AudioContext();
      void context.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);
}
export function squeakChicken() {
  if (!context || context.state !== 'running' || chickenMuted()) return;
  const start = context.currentTime;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(650, start);
  oscillator.frequency.exponentialRampToValueAtTime(1150, start + 0.09);
  oscillator.frequency.exponentialRampToValueAtTime(280, start + 0.34);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.035, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.38);
  oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
}
