export type RootStackParamList = {
  Home: undefined;
  Classes: undefined;
  Workouts: undefined;
  LogWorkout: { workoutId?: string; initialDate?: string };
  WorkoutDetail: { workoutId: string };
  Hoopers: undefined;
  BearDebug: undefined;
  Feed: undefined;
  SearchUsers: undefined;
  UserProfile: { userId?: string } | undefined;
  Connections: undefined;
  Guidelines: undefined;
};

export type AuthStackParamList = {
  SignIn: undefined;
  SignUp: undefined;
  CheckYourEmail: { email: string };
  ForgotPassword: undefined;
};

export type OnboardingStackParamList = {
  SetUsername: undefined;
  Guidelines: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  FeedTab: undefined;
  ClassesTab: undefined;
  WorkoutsTab: undefined;
  HoopersTab: undefined;
};

