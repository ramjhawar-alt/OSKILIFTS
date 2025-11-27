export type RootStackParamList = {
  Home: undefined;
  Classes: undefined;
  Workouts: undefined;
  LogWorkout: { workoutId?: string; initialDate?: string };
  WorkoutDetail: { workoutId: string };
  Hoopers: undefined;
  BearDebug: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  ClassesTab: undefined;
  WorkoutsTab: undefined;
  HoopersTab: undefined;
};

