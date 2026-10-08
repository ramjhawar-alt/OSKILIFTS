/**
 * Animation configuration for Oski overhead press
 */

export interface OverheadPressConfig {
  duration: number; // Duration in milliseconds per rep
  movementRange: number; // Percentage of height for movement (0-1)
}

export const OVERHEAD_PRESS: OverheadPressConfig = {
  duration: 2500, // 2.5 seconds per rep
  movementRange: 0.08, // 8% of height - subtle movement
};


/**
 * The press as a flipbook through three pictures: 0 = lockout, 1 = middle, 2 = bottom.
 * The rep is two continuous strokes (down, then up) with only a beat at each end, so the
 * bar is always moving. Each step moves to `to` over `over` of a rep (fractions add up to
 * 1); `ease` shapes it. Lowering is slower and smoother than the drive back up.
 */
export interface PressStep {
  to: 0 | 1 | 2;
  over: number;
  ease: 'inOut' | 'out' | 'none';
}

export const PRESS_REP_MS = 1700;

export const PRESS_STEPS: PressStep[] = [
  { to: 2, over: 0.42, ease: 'inOut' }, // lower, through the middle, to the shoulders
  { to: 2, over: 0.05, ease: 'none' }, // a beat at the bottom
  { to: 0, over: 0.43, ease: 'out' }, // drive up through the middle to lockout
  { to: 0, over: 0.1, ease: 'none' }, // a beat at the top
];

/**
 * How visible the middle and bottom pictures are at each position, so a picture stays
 * crisp for most of its stretch and only blends near the hand-off (less ghosting than a
 * straight cross-fade). Inputs are positions 0-2, outputs are opacities.
 */
export const PRESS_FADE = {
  middle: { input: [0, 0.3, 0.7, 2], output: [0, 0, 1, 1] },
  bottom: { input: [0, 1.3, 1.7, 2], output: [0, 0, 1, 1] },
};
