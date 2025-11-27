import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Workout,
  WorkoutDayType,
  Exercise,
} from '../types/workout';
import {
  DEFAULT_WORKOUT_DAY_TYPES,
  DEFAULT_EXERCISES,
} from '../data/workoutDefaults';

const WORKOUTS_KEY = '@oskilifts:workouts';
const CUSTOM_DAY_TYPES_KEY = '@oskilifts:customDayTypes';
const CUSTOM_EXERCISES_KEY = '@oskilifts:customExercises';

// Workout operations
export async function saveWorkout(workout: Workout): Promise<void> {
  try {
    const workouts = await getWorkouts();
    const existingIndex = workouts.findIndex((w) => w.id === workout.id);
    
    if (existingIndex >= 0) {
      workouts[existingIndex] = workout;
    } else {
      workouts.push(workout);
    }
    
    // Sort by date (newest first)
    workouts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(workouts));
  } catch (error) {
    console.error('Error saving workout:', error);
    throw error;
  }
}

export async function getWorkouts(): Promise<Workout[]> {
  try {
    const data = await AsyncStorage.getItem(WORKOUTS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting workouts:', error);
    return [];
  }
}

export async function getWorkoutsByDateRange(
  startDate: Date,
  endDate: Date,
): Promise<Workout[]> {
  try {
    const workouts = await getWorkouts();
    const start = startDate.getTime();
    const end = endDate.getTime();
    
    return workouts.filter((workout) => {
      const workoutDate = new Date(workout.date).getTime();
      return workoutDate >= start && workoutDate <= end;
    });
  } catch (error) {
    console.error('Error getting workouts by date range:', error);
    return [];
  }
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  try {
    const workouts = await getWorkouts();
    const filtered = workouts.filter((w) => w.id !== workoutId);
    await AsyncStorage.setItem(WORKOUTS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error deleting workout:', error);
    throw error;
  }
}

export async function getWorkoutById(workoutId: string): Promise<Workout | null> {
  try {
    const workouts = await getWorkouts();
    return workouts.find((w) => w.id === workoutId) || null;
  } catch (error) {
    console.error('Error getting workout by id:', error);
    return null;
  }
}

// Workout day type operations
export async function getWorkoutDayTypes(): Promise<WorkoutDayType[]> {
  try {
    const customTypes = await getCustomWorkoutDayTypes();
    return [...DEFAULT_WORKOUT_DAY_TYPES, ...customTypes];
  } catch (error) {
    console.error('Error getting workout day types:', error);
    return DEFAULT_WORKOUT_DAY_TYPES;
  }
}

export async function getCustomWorkoutDayTypes(): Promise<WorkoutDayType[]> {
  try {
    const data = await AsyncStorage.getItem(CUSTOM_DAY_TYPES_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting custom day types:', error);
    return [];
  }
}

export async function saveCustomWorkoutDayType(
  dayType: WorkoutDayType,
): Promise<void> {
  try {
    const customTypes = await getCustomWorkoutDayTypes();
    
    // Check for duplicates
    if (
      customTypes.some((t) => t.name.toLowerCase() === dayType.name.toLowerCase()) ||
      DEFAULT_WORKOUT_DAY_TYPES.some(
        (t) => t.name.toLowerCase() === dayType.name.toLowerCase(),
      )
    ) {
      throw new Error('Workout day type already exists');
    }
    
    customTypes.push(dayType);
    await AsyncStorage.setItem(CUSTOM_DAY_TYPES_KEY, JSON.stringify(customTypes));
  } catch (error) {
    console.error('Error saving custom day type:', error);
    throw error;
  }
}

// Exercise database operations
export async function getExerciseDatabase(): Promise<Exercise[]> {
  try {
    const customExercises = await getCustomExercises();
    return [...DEFAULT_EXERCISES, ...customExercises];
  } catch (error) {
    console.error('Error getting exercise database:', error);
    return DEFAULT_EXERCISES;
  }
}

export async function getCustomExercises(): Promise<Exercise[]> {
  try {
    const data = await AsyncStorage.getItem(CUSTOM_EXERCISES_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error getting custom exercises:', error);
    return [];
  }
}

export async function saveCustomExercise(exercise: Exercise): Promise<void> {
  try {
    const customExercises = await getCustomExercises();
    
    // Check for duplicates
    if (
      customExercises.some(
        (e) => e.name.toLowerCase() === exercise.name.toLowerCase(),
      ) ||
      DEFAULT_EXERCISES.some(
        (e) => e.name.toLowerCase() === exercise.name.toLowerCase(),
      )
    ) {
      throw new Error('Exercise already exists');
    }
    
    customExercises.push(exercise);
    await AsyncStorage.setItem(CUSTOM_EXERCISES_KEY, JSON.stringify(customExercises));
  } catch (error) {
    console.error('Error saving custom exercise:', error);
    throw error;
  }
}

