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
 * The press as a flipbook. `position` runs 0 (lockout) to 1 (bottom) along the bar's real
 * travel (see src/domain/pressFrames.ts). The rep is two continuous strokes (down, then
 * up) with only a beat at each end, so the bar is always moving. Each step moves to `to`
 * over `over` of a rep (fractions add up to 1); `ease` shapes it. Lowering is slower and
 * smoother than the drive back up.
 */
export interface PressStep {
  to: 0 | 1;
  over: number;
  ease: 'inOut' | 'out' | 'none';
}

export const PRESS_REP_MS = 1700;

export const PRESS_STEPS: PressStep[] = [
  { to: 1, over: 0.42, ease: 'inOut' }, // lower to the shoulders
  { to: 1, over: 0.05, ease: 'none' }, // a beat at the bottom
  { to: 0, over: 0.43, ease: 'out' }, // drive up to lockout
  { to: 0, over: 0.1, ease: 'none' }, // a beat at the top
];
