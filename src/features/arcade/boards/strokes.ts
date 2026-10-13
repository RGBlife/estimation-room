// Four hand-drawn lines across a three by three grid, in a 300 by 300 box.
export const GRID_LINES = 'M101 14c-2 90 2 182-1 272M199 12c2 92-2 184 1 275M14 100c92-3 182 2 272-1M12 199c93 3 184-2 275 2';

// A stroke through a winning three, a little past each end.
export function strike(line: number[]): string {
  const centre = (cell: number) => [(cell % 3) * 100 + 50, Math.floor(cell / 3) * 100 + 50];
  const [a, b] = [centre(line[0]), centre(line[2])];
  const dx = (b[0] - a[0]) * 0.18, dy = (b[1] - a[1]) * 0.18;
  return `M${a[0] - dx} ${a[1] - dy}L${b[0] + dx} ${b[1] + dy}`;
}
