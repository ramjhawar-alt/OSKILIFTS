import type { WorkoutDayType, Exercise } from '../types/workout';

export const DEFAULT_WORKOUT_DAY_TYPES: WorkoutDayType[] = [
  { name: 'Legs', isCustom: false },
  { name: 'Push', isCustom: false },
  { name: 'Pull', isCustom: false },
  { name: 'Back/Bi', isCustom: false },
  { name: 'Chest/Tri', isCustom: false },
  { name: 'Full Body', isCustom: false },
  { name: 'Cardio', isCustom: false },
  { name: 'Rest', isCustom: false },
];

export const DEFAULT_EXERCISES: Exercise[] = [
  // Legs
  { name: 'Squat', isCustom: false, muscleGroup: 'Legs' },
  { name: 'Deadlift', isCustom: false, muscleGroup: 'Legs' },
  { name: 'Leg Press', isCustom: false, muscleGroup: 'Legs' },
  { name: 'Romanian Deadlift', isCustom: false, muscleGroup: 'Legs' },
  { name: 'Leg Curl', isCustom: false, muscleGroup: 'Legs' },
  { name: 'Leg Extension', isCustom: false, muscleGroup: 'Legs' },
  { name: 'Lunges', isCustom: false, muscleGroup: 'Legs' },
  { name: 'Calf Raise', isCustom: false, muscleGroup: 'Legs' },
  { name: 'Bulgarian Split Squat', isCustom: false, muscleGroup: 'Legs' },
  { name: 'Hip Thrust', isCustom: false, muscleGroup: 'Legs' },
  
  // Chest
  { name: 'Bench Press', isCustom: false, muscleGroup: 'Chest' },
  { name: 'Incline Bench Press', isCustom: false, muscleGroup: 'Chest' },
  { name: 'Dumbbell Press', isCustom: false, muscleGroup: 'Chest' },
  { name: 'Incline Dumbbell Press', isCustom: false, muscleGroup: 'Chest' },
  { name: 'Chest Fly', isCustom: false, muscleGroup: 'Chest' },
  { name: 'Push-ups', isCustom: false, muscleGroup: 'Chest' },
  { name: 'Dips', isCustom: false, muscleGroup: 'Chest' },
  { name: 'Cable Fly', isCustom: false, muscleGroup: 'Chest' },
  
  // Back
  { name: 'Pull-ups', isCustom: false, muscleGroup: 'Back' },
  { name: 'Lat Pulldown', isCustom: false, muscleGroup: 'Back' },
  { name: 'Barbell Row', isCustom: false, muscleGroup: 'Back' },
  { name: 'Dumbbell Row', isCustom: false, muscleGroup: 'Back' },
  { name: 'Cable Row', isCustom: false, muscleGroup: 'Back' },
  { name: 'T-Bar Row', isCustom: false, muscleGroup: 'Back' },
  { name: 'Face Pull', isCustom: false, muscleGroup: 'Back' },
  { name: 'Shrugs', isCustom: false, muscleGroup: 'Back' },
  
  // Shoulders
  { name: 'Overhead Press', isCustom: false, muscleGroup: 'Shoulders' },
  { name: 'Lateral Raise', isCustom: false, muscleGroup: 'Shoulders' },
  { name: 'Front Raise', isCustom: false, muscleGroup: 'Shoulders' },
  { name: 'Rear Delt Fly', isCustom: false, muscleGroup: 'Shoulders' },
  { name: 'Arnold Press', isCustom: false, muscleGroup: 'Shoulders' },
  { name: 'Upright Row', isCustom: false, muscleGroup: 'Shoulders' },
  
  // Biceps
  { name: 'Barbell Curl', isCustom: false, muscleGroup: 'Biceps' },
  { name: 'Dumbbell Curl', isCustom: false, muscleGroup: 'Biceps' },
  { name: 'Hammer Curl', isCustom: false, muscleGroup: 'Biceps' },
  { name: 'Cable Curl', isCustom: false, muscleGroup: 'Biceps' },
  { name: 'Preacher Curl', isCustom: false, muscleGroup: 'Biceps' },
  { name: 'Concentration Curl', isCustom: false, muscleGroup: 'Biceps' },
  
  // Triceps
  { name: 'Tricep Dip', isCustom: false, muscleGroup: 'Triceps' },
  { name: 'Overhead Extension', isCustom: false, muscleGroup: 'Triceps' },
  { name: 'Tricep Pushdown', isCustom: false, muscleGroup: 'Triceps' },
  { name: 'Close Grip Bench Press', isCustom: false, muscleGroup: 'Triceps' },
  { name: 'Skull Crusher', isCustom: false, muscleGroup: 'Triceps' },
  { name: 'Diamond Push-ups', isCustom: false, muscleGroup: 'Triceps' },
  
  // Core
  { name: 'Plank', isCustom: false, muscleGroup: 'Core' },
  { name: 'Crunches', isCustom: false, muscleGroup: 'Core' },
  { name: 'Russian Twist', isCustom: false, muscleGroup: 'Core' },
  { name: 'Leg Raises', isCustom: false, muscleGroup: 'Core' },
  { name: 'Mountain Climbers', isCustom: false, muscleGroup: 'Core' },
  { name: 'Dead Bug', isCustom: false, muscleGroup: 'Core' },
  
  // Cardio
  { name: 'Running', isCustom: false, muscleGroup: 'Cardio' },
  { name: 'Cycling', isCustom: false, muscleGroup: 'Cardio' },
  { name: 'Rowing', isCustom: false, muscleGroup: 'Cardio' },
  { name: 'Elliptical', isCustom: false, muscleGroup: 'Cardio' },
  { name: 'Stair Climber', isCustom: false, muscleGroup: 'Cardio' },
];

