import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '../screens/HomeScreen';
import { RsfHubScreen } from '../screens/RsfHubScreen';
import { AppTabBar } from '../components/AppTabBar';
import { colors } from '../theme';
import { ClassesScreen } from '../screens/ClassesScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { LogWorkoutScreen } from '../screens/LogWorkoutScreen';
import { WorkoutDetailScreen } from '../screens/WorkoutDetailScreen';
import { HoopersScreen } from '../screens/HoopersScreen';
import { BearDebugScreen } from '../screens/BearDebugScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { SignUpScreen } from '../screens/auth/SignUpScreen';
import { CheckYourEmailScreen } from '../screens/auth/CheckYourEmailScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { SetUsernameScreen } from '../screens/onboarding/SetUsernameScreen';
import { GuidelinesScreen } from '../screens/GuidelinesScreen';
import { AuthButton, AuthLayout, AuthLink } from '../components/AuthForm';
import { FeedScreen } from '../screens/FeedScreen';
import { SearchUsersScreen } from '../screens/SearchUsersScreen';
import { UserProfileScreen } from '../screens/UserProfileScreen';
import { ConnectionsScreen } from '../screens/ConnectionsScreen';
import { FollowListScreen } from '../screens/FollowListScreen';
import { CommentsScreen } from '../screens/CommentsScreen';
import { MetricsScreen } from '../screens/MetricsScreen';
import { FriendsAtRsfScreen } from '../screens/FriendsAtRsfScreen';
import { ModerationScreen } from '../screens/ModerationScreen';
import { ExercisesScreen } from '../screens/ExercisesScreen';
import { RoutinesScreen } from '../screens/RoutinesScreen';
import { ExerciseDetailScreen } from '../screens/ExerciseDetailScreen';
import { HeaderLink } from '../components/HeaderLink';
import { RequestsProvider, useRequests } from '../contexts/RequestsContext';
import { InviteHandler } from '../components/InviteHandler';
import { RsfPresenceProvider } from '../contexts/RsfPresenceContext';
import { navigationRef } from './navigationRef';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { isProfileComplete } from '../types/social';
import {
  AuthStackParamList,
  OnboardingStackParamList,
  RootStackParamList,
  TabParamList,
} from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const OnboardingStack = createNativeStackNavigator<OnboardingStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f7f9fc',
  },
};

const stackScreenOptions = {
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: '#f7f9fc' },
};

/**
 * Every screen you can open from anywhere. Each tab's stack includes the whole set, so a
 * profile, a workout or the logging screen opens inside whichever tab you are on (and the
 * back button returns to where you were).
 */
const commonScreens = () => (
  <Stack.Group>
    <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ title: 'Profile' }} />
    <Stack.Screen name="SearchUsers" component={SearchUsersScreen} options={{ title: 'Find people' }} />
    <Stack.Screen name="Connections" component={ConnectionsScreen} options={{ title: 'Follow requests' }} />
    <Stack.Screen
      name="FollowList"
      component={FollowListScreen}
      options={({ route }) => ({ title: route.params.kind === 'followers' ? 'Followers' : 'Following' })}
    />
    <Stack.Screen name="Comments" component={CommentsScreen} options={{ title: 'Comments' }} />
    <Stack.Screen name="Moderation" component={ModerationScreen} options={{ title: 'Moderation' }} />
    <Stack.Screen name="Metrics" component={MetricsScreen} options={{ title: 'Metrics' }} />
    <Stack.Screen name="BearDebug" component={BearDebugScreen} options={{ title: 'Bear stages' }} />
    <Stack.Screen name="FriendsAtRsf" component={FriendsAtRsfScreen} options={{ title: 'At the RSF' }} />
    <Stack.Screen name="Guidelines" component={GuidelinesScreen} options={{ title: 'Community Guidelines' }} />
    <Stack.Screen
      name="Workouts"
      component={WorkoutsScreen}
      options={({ navigation }) => ({
        title: 'Workout history',
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
            <HeaderLink label="Routines" onPress={() => navigation.navigate('Routines')} />
            <HeaderLink label="Exercises" onPress={() => navigation.navigate('Exercises')} />
          </View>
        ),
      })}
    />
    <Stack.Screen name="LogWorkout" component={LogWorkoutScreen} options={{ title: 'Log Workout' }} />
    <Stack.Screen name="WorkoutDetail" component={WorkoutDetailScreen} options={{ title: 'Workout Details' }} />
    <Stack.Screen name="Exercises" component={ExercisesScreen} options={{ title: 'Exercises' }} />
    <Stack.Screen name="Routines" component={RoutinesScreen} options={{ title: 'Routines' }} />
    <Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} options={{ title: 'Exercise' }} />
    <Stack.Screen name="Classes" component={ClassesScreen} options={{ title: 'RSF Classes' }} />
    <Stack.Screen name="Hoopers" component={HoopersScreen} options={{ title: 'HOOPERS' }} />
  </Stack.Group>
);

const HomeStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'OSKILIFTS', headerShown: false }} />
    {commonScreens()}
  </Stack.Navigator>
);

const FeedStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen
      name="Feed"
      component={FeedScreen}
      options={({ navigation }) => ({
        title: 'Feed',
        headerRight: () => <HeaderLink label="Find people" onPress={() => navigation.navigate('SearchUsers')} />,
      })}
    />
    {commonScreens()}
  </Stack.Navigator>
);

const RsfStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="RsfHub" component={RsfHubScreen} options={{ title: 'RSF', headerShown: false }} />
    {commonScreens()}
  </Stack.Navigator>
);

const MeStack = () => (
  <Stack.Navigator screenOptions={stackScreenOptions}>
    <Stack.Screen name="MeProfile" component={UserProfileScreen} options={{ title: 'Me' }} />
    {commonScreens()}
  </Stack.Navigator>
);

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="SignIn" component={SignInScreen} />
    <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    <AuthStack.Screen name="CheckYourEmail" component={CheckYourEmailScreen} />
    <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </AuthStack.Navigator>
);

const OnboardingNavigator = () => (
  <OnboardingStack.Navigator>
    <OnboardingStack.Screen
      name="SetUsername"
      component={SetUsernameScreen}
      options={{ headerShown: false }}
    />
    <OnboardingStack.Screen
      name="Guidelines"
      component={GuidelinesScreen}
      options={{ title: 'Community Guidelines' }}
    />
  </OnboardingStack.Navigator>
);

const ProfileErrorScreen = ({ message }: { message: string }) => {
  const { signOut } = useAuth();
  const { refreshProfile } = useProfile();
  return (
    <AuthLayout title="Couldn’t load your profile" subtitle={message}>
      <AuthButton label="Try again" onPress={refreshProfile} />
      <AuthLink label="Sign out" onPress={() => signOut().catch(() => undefined)} />
    </AuthLayout>
  );
};

const LoadingView = () => (
  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
    <ActivityIndicator size="large" color={colors.gold} />
  </View>
);

const NoScreen = () => null;

const TabsWithBadge = () => {
  const { pendingCount, adminOpenCount } = useRequests();
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} badges={{ MeTab: pendingCount + adminOpenCount }} />}
    >
      <Tab.Screen name="HomeTab" component={HomeStack} options={{ title: 'Today' }} />
      <Tab.Screen name="FeedTab" component={FeedStack} options={{ title: 'Feed' }} />
      <Tab.Screen name="LogTab" component={NoScreen} options={{ title: 'Log' }} />
      <Tab.Screen name="RsfTab" component={RsfStack} options={{ title: 'RSF' }} />
      <Tab.Screen name="MeTab" component={MeStack} options={{ title: 'Me' }} />
    </Tab.Navigator>
  );
};

const MainTabs = () => (
  <RequestsProvider>
    <RsfPresenceProvider>
      <InviteHandler />
      <TabsWithBadge />
    </RsfPresenceProvider>
  </RequestsProvider>
);

export const RootNavigator = () => {
  const { session, initializing } = useAuth();
  const { profile, profileLoading, profileError } = useProfile();

  let content;
  if (initializing) {
    content = <LoadingView />;
  } else if (!session) {
    content = <AuthNavigator />;
  } else if (profileLoading) {
    content = <LoadingView />;
  } else if (profileError || !profile) {
    content = <ProfileErrorScreen message={profileError ?? 'Please try again.'} />;
  } else if (!isProfileComplete(profile)) {
    content = <OnboardingNavigator />;
  } else {
    content = <MainTabs />;
  }

  return (
    <NavigationContainer ref={navigationRef} theme={navigationTheme}>
      {content}
    </NavigationContainer>
  );
};

