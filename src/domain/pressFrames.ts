/**
 * Helpers for the shoulder-press flipbook: a stage has several pictures (lockout first,
 * bottom last) and the bar is at a different height in each. The animation moves a single
 * progress value from 0 (lockout) to 1 (bottom) along the bar's real travel, and each
 * picture fades in over the one before it around the point where the bar reaches it.
 */

/** Where each picture sits along the bar's travel: 0 for the first, 1 for the last. */
export function barKnots(barY: number[]): number[] {
  const n = barY.length;
  const uniform = (): number[] => barY.map((_, i) => (n > 1 ? i / (n - 1) : 0));
  if (n < 2 || barY.some((y) => !Number.isFinite(y))) return uniform();
  const travel = barY[n - 1] - barY[0];
  if (travel < 20) return uniform(); // the pictures barely differ: space them evenly
  let previous = 0;
  const knots = barY.map((y, i) => {
    if (i === 0) return 0;
    if (i === n - 1) return 1;
    // keep it in order and strictly inside (0, 1) so every picture gets a turn
    const value = Math.min(1, Math.max(previous, (y - barY[0]) / travel));
    previous = value;
    return value;
  });
  return knots;
}

export interface FadeWindow {
  input: number[];
  output: number[];
}

/**
 * One window per picture after the first: hidden until 30% of the way from the previous
 * knot, fully shown by 70%, so each picture is crisp for most of its stretch and only
 * blends near the hand-off (less ghosting than a straight cross-fade).
 */
export function fadeWindows(knots: number[]): FadeWindow[] {
  const windows: FadeWindow[] = [];
  for (let k = 1; k < knots.length; k++) {
    const a = knots[k - 1];
    const b = knots[k];
    const lo = a + (b - a) * 0.3;
    const hi = a + (b - a) * 0.7;
    windows.push({ input: [0, lo, hi, 1], output: [0, 0, 1, 1] });
  }
  return windows;
}
