import { describe, it, expect } from 'vitest';
import { breakpointForWidth, requiredWidth } from './useViewportBreakpoint.ts';

describe('breakpointForWidth', () => {
  it('drops to four columns inside the 620px room dialog', () => {
    // The dialog's content box on a wide screen: 620px minus its px-5.
    expect(breakpointForWidth(580).columns).toBe(4);
  });

  it('keeps six columns when the join card is at its widest', () => {
    expect(breakpointForWidth(780).columns).toBe(6);
  });

  it('stacks the category rail when even four columns will not fit', () => {
    const bp = breakpointForWidth(400);
    expect(bp.columns).toBe(3);
    expect(bp.stacked).toBe(true);
  });

  it('never returns a layout wider than the space it was given', () => {
    for (let width = 300; width <= 900; width += 10) {
      const bp = breakpointForWidth(width);
      if (bp.columns > 3) expect(requiredWidth(bp)).toBeLessThanOrEqual(width);
    }
  });
});
