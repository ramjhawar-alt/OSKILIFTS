import type { ExerciseType } from '../types/workout';

export const EXERCISE_TYPES: ExerciseType[] = [
  'weight_reps',
  'bodyweight_reps',
  'duration',
  'distance_duration',
];

export const EXERCISE_TYPE_LABELS: Record<ExerciseType, string> = {
  weight_reps: 'Weight & reps',
  bodyweight_reps: 'Bodyweight reps',
  duration: 'Duration',
  distance_duration: 'Distance & time',
};

export function isExerciseType(value: unknown): value is ExerciseType {
  return typeof value === 'string' && (EXERCISE_TYPES as string[]).includes(value);
}

const BODYWEIGHT = [
  'push-ups',
  'pull-ups',
  'dips',
  'tricep dip',
  'diamond push-ups',
  'crunches',
  'russian twist',
  'leg raises',
  'mountain climbers',
  'dead bug',
];
const DURATION = ['plank', 'elliptical', 'stair climber'];
const DISTANCE = ['running', 'cycling', 'rowing'];

const DEFAULT_TYPES = new Map<string, ExerciseType>([
  ...BODYWEIGHT.map((name): [string, ExerciseType] => [name, 'bodyweight_reps']),
  ...DURATION.map((name): [string, ExerciseType] => [name, 'duration']),
  ...DISTANCE.map((name): [string, ExerciseType] => [name, 'distance_duration']),
]);

/** Type for the built-in exercises, by lowercased name; undefined if not one of them. */
export function defaultTypeForName(name: string): ExerciseType | undefined {
  return DEFAULT_TYPES.get(name.trim().toLowerCase());
}
