import { getBearStageName, getStreakForNextStage } from '../services/bearStreakService';

export const MAX_STAGE = 10;

/** Where the highest stage a person has reached is remembered on this device. */
export function levelUpKey(userId: string): string {
  return `@oskilifts:maxStage:${userId}`;
}

function parseStage(stored: string | null): number | null {
  if (stored === null) return null;
  const n = Number(stored);
  return Number.isInteger(n) && n >= 1 && n <= MAX_STAGE ? n : null;
}

export interface LevelUpDecision {
  /** show the "level up" screen now */
  celebrate: boolean;
  /** the highest stage to remember afterwards */
  remember: number;
}

/**
 * Celebrate only a new personal high. The first time we ever see someone (nothing stored)
 * we just remember where they are, so people who already had a streak when this shipped
 * don't get a surprise screen, and a streak that breaks and rebuilds doesn't repeat it.
 */
export function decideLevelUp(stored: string | null, current: number): LevelUpDecision {
  const now = Math.min(MAX_STAGE, Math.max(1, Math.floor(current) || 1));
  const before = parseStage(stored);
  if (before === null) return { celebrate: false, remember: now };
  if (now > before) return { celebrate: true, remember: now };
  return { celebrate: false, remember: before };
}

export interface LevelUpCopy {
  title: string;
  name: string;
  stageLabel: string;
  next: string;
}

export function levelUpCopy(stage: number): LevelUpCopy {
  const s = Math.min(MAX_STAGE, Math.max(1, Math.floor(stage) || 1));
  const target = getStreakForNextStage(s);
  return {
    title: s === MAX_STAGE ? 'MAX LEVEL!' : 'LEVEL UP!',
    name: getBearStageName(s),
    stageLabel: `Stage ${s} of ${MAX_STAGE}`,
    next:
      target === null
        ? 'You made it to the top. Keep that streak alive!'
        : `Next up: ${getBearStageName(s + 1)} at a ${target}-workout streak.`,
  };
}
