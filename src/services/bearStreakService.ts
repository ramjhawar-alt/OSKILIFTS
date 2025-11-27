import type { Workout } from '../types/workout';

/**
 * Calculate the current workout streak (consecutive days with at least one workout)
 * @param workouts - Array of all workouts, sorted by date
 * @returns Number of consecutive days with workouts
 */
export function calculateWorkoutStreak(workouts: Workout[]): number {
  if (workouts.length === 0) {
    return 0;
  }

  // Sort workouts by date (newest first)
  const sortedWorkouts = [...workouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  // Get unique dates (YYYY-MM-DD) from workouts
  const workoutDates = new Set<string>();
  sortedWorkouts.forEach((workout) => {
    const dateStr = workout.date.split('T')[0]; // Extract YYYY-MM-DD
    workoutDates.add(dateStr);
  });

  // Convert to sorted array of dates
  const dates = Array.from(workoutDates)
    .map((d) => new Date(d + 'T12:00:00.000Z'))
    .sort((a, b) => b.getTime() - a.getTime());

  if (dates.length === 0) {
    return 0;
  }

  // Start from today and work backwards
  const today = new Date();
  today.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues

  // Check if today or yesterday has a workout
  const todayStr = today.toISOString().split('T')[0];
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const mostRecentWorkoutDate = dates[0];
  const mostRecentWorkoutStr = mostRecentWorkoutDate.toISOString().split('T')[0];

  // If most recent workout is not today or yesterday, streak is broken
  if (mostRecentWorkoutStr !== todayStr && mostRecentWorkoutStr !== yesterdayStr) {
    return 0;
  }

  // Calculate consecutive days
  let streak = 0;
  let currentDate = new Date(today);

  // If most recent workout was yesterday, start from yesterday
  if (mostRecentWorkoutStr === yesterdayStr && mostRecentWorkoutStr !== todayStr) {
    currentDate = new Date(yesterday);
    streak = 1;
  } else if (mostRecentWorkoutStr === todayStr) {
    streak = 1;
  }

  // Check backwards for consecutive days
  for (let i = 1; i < dates.length; i++) {
    const expectedDate = new Date(currentDate);
    expectedDate.setDate(expectedDate.getDate() - 1);
    expectedDate.setHours(12, 0, 0, 0);

    const workoutDate = new Date(dates[i]);
    workoutDate.setHours(12, 0, 0, 0);

    const expectedStr = expectedDate.toISOString().split('T')[0];
    const workoutStr = workoutDate.toISOString().split('T')[0];

    if (expectedStr === workoutStr) {
      streak++;
      currentDate = new Date(expectedDate);
    } else {
      // Gap found, streak is broken
      break;
    }
  }

  return streak;
}

/**
 * Get the bear stage (1-10) based on streak count
 * @param streak - Current workout streak in days
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

