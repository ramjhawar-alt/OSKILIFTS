import { workoutStreak } from '../domain/streak';
import type { Workout } from '../types/workout';

/**
 * The current workout streak: training days in a row, where up to two rest days
 * between workouts don't break it (see src/domain/streak.ts).
 */
export function calculateWorkoutStreak(
  workouts: Pick<Workout, 'date'>[],
  today?: string,
): number {
  return workoutStreak(
    workouts.map((workout) => workout.date),
    today,
  );
}

/**
 * Get the bear stage (1-10) based on streak count
 * @param streak - Current workout streak (training days)
 * @returns Bear stage number (1-10)
 */
export function getBearStage(streak: number): number {
  if (streak === 0) return 1;
  if (streak <= 2) return 1;
  if (streak <= 4) return 2;
  if (streak <= 6) return 3;
  if (streak <= 9) return 4;
  if (streak <= 13) return 5;
  if (streak <= 19) return 6;
  if (streak <= 29) return 7;
  if (streak <= 44) return 8;
  if (streak <= 59) return 9;
  return 10; // 60+ days
}

/**
 * Get the streak required for the next stage
 * @param currentStage - Current bear stage
 * @returns Streak count needed for next stage, or null if max stage
 */
export function getStreakForNextStage(currentStage: number): number | null {
  const stageThresholds = [0, 3, 5, 7, 10, 14, 20, 30, 45, 60];
  if (currentStage >= 10) return null;
  return stageThresholds[currentStage];
}

/**
 * Get the stage-specific name for the bear
 * @param stage - Bear stage (1-10)
 * @returns Stage name
 */
export function getBearStageName(stage: number): string {
  const stageNames: Record<number, string> = {
    1: 'Baby Oski',
    2: 'Small Oski',
    3: 'Young Oski',
    4: 'Growing Oski',
    5: 'Strong Oski',
    6: 'Big Oski',
    7: 'Huge Oski',
    8: 'Massive Oski',
    9: 'Legendary Oski',
    10: 'MAX OSKI',
  };
  return stageNames[stage] || 'Baby Oski';
}

/**
 * Get motivational message based on streak and stage
 * @param streak - Current streak
 * @param stage - Current stage
 * @returns Motivational message
 */
export function getMotivationalMessage(streak: number, stage: number): string {
  if (streak === 0) {
    return "Start your journey! Log your first workout to grow your Oski!";
  }
  if (stage <= 2) {
    return "Keep it up! Your Oski is just getting started!";
  }
  if (stage <= 4) {
    return "Great progress! Your Oski is growing strong!";
  }
  if (stage <= 6) {
    return "Amazing consistency! Your Oski is getting big!";
  }
  if (stage <= 8) {
    return "Incredible dedication! Your Oski is a beast!";
  }
  if (stage === 9) {
    return "Almost there! Your Oski is nearly legendary!";
  }
  return "LEGENDARY! Your Oski is at maximum power! Go Bears!";
}

