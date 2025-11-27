export interface WorkoutDayType {
  name: string;
  isCustom: boolean;
}

export interface Exercise {
  name: string;
  isCustom: boolean;
  muscleGroup?: string;
}

export interface ExerciseEntry {
  exercise: Exercise;
  sets: number;
  reps: number | number[]; // number if same reps all sets, array if different
}

export interface Workout {
  id: string;
  date: string; // ISO date string
  dayType: WorkoutDayType;
  exercises: ExerciseEntry[];
  notes?: string;
}

export type WorkoutHistory = Workout[];

