import type { Locator } from '@playwright/test';

export interface OverflowResult {
  overflowsHorizontally: boolean;
  overflowsVertically: boolean;
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
}

// Detects content clipping: an element whose rendered content (scrollWidth/
// scrollHeight) exceeds its visible box (clientWidth/clientHeight) is having
// something cut off, regardless of whether overflow is visually hidden,
// scrollable, or just spilling past a sibling. This is the same signal
// DevTools uses to flag overflow, applied programmatically.
//
// Deliberate text-overflow:ellipsis truncation (Tailwind's `truncate`) is
// excluded on purpose -- that's a designed "show what fits, hide the rest
// gracefully" pattern, not the jagged mid-character clipping this check is
// meant to catch. An element opting into ellipsis is explicitly declaring
// "I may not show everything," so overflow there isn't a bug.
//
// A scrollable axis (overflow: auto/scroll) is excluded for the same reason:
// the content is reachable, just not all at once. The voting bar relies on
// this -- it is capped and scrolls on a phone rather than growing tall enough
// to push the table off screen.
// A few px of rounding slack absorbs sub-pixel font-metrics differences that
// don't correspond to any visible defect.
const TOLERANCE_PX = 4;

export async function checkOverflow(locator: Locator): Promise<OverflowResult> {
  return locator.evaluate((el, tolerance) => {
    const style = window.getComputedStyle(el);
    const isEllipsisTruncated = style.textOverflow === 'ellipsis' && style.overflow !== 'visible';
    const scrollsX = style.overflowX === 'auto' || style.overflowX === 'scroll';
    const scrollsY = style.overflowY === 'auto' || style.overflowY === 'scroll';
    return {
      overflowsHorizontally: !isEllipsisTruncated && !scrollsX && el.scrollWidth > el.clientWidth + tolerance,
      overflowsVertically: !scrollsY && el.scrollHeight > el.clientHeight + tolerance,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    };
  }, TOLERANCE_PX);
}

// Checks that `child`'s bounding box is fully contained within `container`'s
// -- catches a different failure mode than checkOverflow: content that fits
// its own box but pokes out past a parent it's supposed to stay inside of
// (e.g. an absolutely-positioned or transformed element like a lifted
// selected card).
export async function checkContained(child: Locator, container: Locator): Promise<boolean> {
  const [childBox, containerBox] = await Promise.all([child.boundingBox(), container.boundingBox()]);
  if (!childBox || !containerBox) throw new Error('checkContained: element not visible/attached');
  const tolerance = 1;
  return (
    childBox.x >= containerBox.x - tolerance &&
    childBox.y >= containerBox.y - tolerance &&
    childBox.x + childBox.width <= containerBox.x + containerBox.width + tolerance &&
    childBox.y + childBox.height <= containerBox.y + containerBox.height + tolerance
  );
}
