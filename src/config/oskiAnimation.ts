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

