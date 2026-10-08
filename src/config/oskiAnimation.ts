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
 * Each step moves to `to` over `over` of a rep (the fractions add up to 1); a step to
 * the same frame it is already on is a hold. A rep starts and ends at lockout. Lowering
 * is a touch slower than pressing, and each swap is a quick fade rather than a cut.
 */
export interface PressStep {
  to: 0 | 1 | 2;
  over: number;
}

export const PRESS_STEPS: PressStep[] = [
  { to: 0, over: 0.2 }, // hold at the top
  { to: 1, over: 0.08 }, // lower to the middle
  { to: 1, over: 0.05 },
  { to: 2, over: 0.08 }, // lower to the shoulders
  { to: 2, over: 0.2 }, // pause at the bottom
  { to: 1, over: 0.06 }, // drive up through the middle
  { to: 1, over: 0.03 },
  { to: 0, over: 0.06 }, // lock out
  { to: 0, over: 0.24 }, // hold overhead before the next rep
];
