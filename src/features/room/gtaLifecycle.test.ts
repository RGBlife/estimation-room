import { describe, it, expect } from 'vitest';
import {
  nextPhase, phaseDuration, isDriveable, hasCar, seatVacated, debrisPieces,
  type GtaPhase,
} from './gtaLifecycle.ts';

const ALL: GtaPhase[] = ['idle', 'arriving', 'boarding', 'driving', 'exploding', 'returning'];

describe('phase progression', () => {
  it('runs entry through to driving', () => {
    expect(nextPhase('arriving')).toBe('boarding');
    expect(nextPhase('boarding')).toBe('driving');
  });

  it('runs the round reset back to idle', () => {
    expect(nextPhase('exploding')).toBe('returning');
    expect(nextPhase('returning')).toBe('idle');
  });

  it('waits rather than auto-advancing where a trigger is needed', () => {
    // idle waits on the button; driving waits on the round ending.
    expect(nextPhase('idle')).toBeNull();
    expect(nextPhase('driving')).toBeNull();
  });

  it('reaches driving from arriving by following nextPhase', () => {
    let phase: GtaPhase = 'arriving';
    const seen: GtaPhase[] = [phase];
    for (let i = 0; i < 5; i++) {
      const next = nextPhase(phase);
      if (!next) break;
      phase = next;
      seen.push(phase);
    }
    expect(seen).toEqual(['arriving', 'boarding', 'driving']);
  });

  it('terminates at idle from exploding without looping', () => {
    let phase: GtaPhase = 'exploding';
    const seen: GtaPhase[] = [phase];
    for (let i = 0; i < 10; i++) {
      const next = nextPhase(phase);
      if (!next) break;
      phase = next;
      seen.push(phase);
    }
    expect(seen).toEqual(['exploding', 'returning', 'idle']);
  });
});

describe('durations', () => {
  it('gives every timer-driven phase a positive duration', () => {
    for (const p of ALL) {
      if (nextPhase(p) !== null) {
        expect(phaseDuration(p)).toBeGreaterThan(0);
      }
    }
  });

  it('gives no duration to phases that wait on a trigger', () => {
    expect(phaseDuration('idle')).toBeNull();
    expect(phaseDuration('driving')).toBeNull();
  });
});

describe('phase capabilities', () => {
  it('only accepts input while driving', () => {
    for (const p of ALL) {
      expect(isDriveable(p)).toBe(p === 'driving');
    }
  });

  it('never accepts input during the round reset', () => {
    // The important guarantee: a reset can't be driven through.
    expect(isDriveable('exploding')).toBe(false);
    expect(isDriveable('returning')).toBe(false);
  });

  it('shows a car for exactly the phases a car exists in', () => {
    expect(ALL.filter(hasCar)).toEqual(['arriving', 'boarding', 'driving', 'exploding']);
  });

  it('empties the seat from driving until the rider is home', () => {
    expect(ALL.filter(seatVacated)).toEqual(['driving', 'exploding', 'returning']);
    // Seat is occupied again only once fully idle.
    expect(seatVacated('idle')).toBe(false);
    // And still occupied while the car is merely on its way, and through
    // boarding -- the rider wobbles visibly in their seat until the moment
    // they actually leave it.
    expect(seatVacated('arriving')).toBe(false);
    expect(seatVacated('boarding')).toBe(false);
  });
});

describe('debris', () => {
  it('is deterministic, so every client renders the same blast', () => {
    expect(debrisPieces()).toEqual(debrisPieces());
  });

  it('scatters pieces in all directions', () => {
    const bits = debrisPieces(8);
    expect(bits).toHaveLength(8);
    expect(bits.some(b => b.fx > 0)).toBe(true);
    expect(bits.some(b => b.fx < 0)).toBe(true);
    expect(bits.some(b => b.fy > 0)).toBe(true);
    expect(bits.some(b => b.fy < 0)).toBe(true);
  });

  it('gives every piece a real displacement', () => {
    for (const b of debrisPieces(12)) {
      expect(Math.hypot(b.fx, b.fy)).toBeGreaterThan(10);
    }
  });
});
