/**
 * ASCII art representations of Oski the Bear at different growth stages
 * Each stage represents a different size/age of the bear based on workout consistency
 */

// Legacy bear art (kept for fallback, but primary display uses SVG)
export const OSKI_BEAR_ART: string[] = [
  // Stage 1: Baby Oski (0-2 days)
  `     🐻
   Baby Oski`,

  // Stage 2: Small Oski (3-4 days)
  `    🐻🐻
   Small Oski`,

  // Stage 3: Young Oski (5-6 days)
  `   🐻🐻🐻
  Young Oski`,

  // Stage 4: Growing Oski (7-9 days)
  `  🐻🐻🐻🐻
 Growing Oski`,

  // Stage 5: Strong Oski (10-13 days)
  ` 🐻🐻🐻🐻🐻
 Strong Oski`,

  // Stage 6: Big Oski (14-19 days)
  `🐻🐻🐻🐻🐻🐻
  Big Oski`,

  // Stage 7: Huge Oski (20-29 days)
  `🐻🐻🐻🐻🐻🐻🐻
  Huge Oski`,

  // Stage 8: Massive Oski (30-44 days)
  `🐻🐻🐻🐻🐻🐻🐻🐻
  Massive Oski`,

  // Stage 9: Legendary Oski (45-59 days)
  `🐻🐻🐻🐻🐻🐻🐻🐻🐻
  Legendary Oski`,

  // Stage 10: MAX Oski (60+ days)
  `🐻🐻🐻🐻🐻🐻🐻🐻🐻🐻
     MAX OSKI`,
];

/**
 * Get the bear art for a specific stage
 * @param stage - Bear stage (1-10)
 * @returns ASCII art string for the bear
 */
export function getBearArt(stage: number): string {
  const index = Math.max(0, Math.min(stage - 1, OSKI_BEAR_ART.length - 1));
  return OSKI_BEAR_ART[index];
}

