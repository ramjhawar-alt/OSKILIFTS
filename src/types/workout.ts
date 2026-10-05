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

export type WorkoutVisibility = 'followers' | 'private';

export interface Workout {
  id: string;
  date: string; // ISO date string
  dayType: WorkoutDayType;
  exercises: ExerciseEntry[];
  notes?: string;
  // Who besides you can see it. Absent on workouts not yet loaded from the
  // server; saveWorkout then leaves the stored value alone on edit.
  visibility?: WorkoutVisibility;
}

export type WorkoutHistory = Workout[];

