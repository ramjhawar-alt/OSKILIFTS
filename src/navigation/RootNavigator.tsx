import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { HomeScreen } from '../screens/HomeScreen';
import { ClassesScreen } from '../screens/ClassesScreen';
import { WorkoutsScreen } from '../screens/WorkoutsScreen';
import { LogWorkoutScreen } from '../screens/LogWorkoutScreen';
import { WorkoutDetailScreen } from '../screens/WorkoutDetailScreen';
import { HoopersScreen } from '../screens/HoopersScreen';
import { BearDebugScreen } from '../screens/BearDebugScreen';
import { RootStackParamList, TabParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f7f9fc',
  },
};

// Home Tab Stack
const HomeStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'OSKILIFTS', headerShown: false }}
      />
      <Stack.Screen
        name="Classes"
        component={ClassesScreen}
        options={{ title: 'RSF Classes' }}
      />
      <Stack.Screen
        name="BearDebug"
        component={BearDebugScreen}
        options={{ title: 'Bear Debug Preview' }}
      />
    </Stack.Navigator>
  );
};

// Workouts Tab Stack
const WorkoutsStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Workouts"
        component={WorkoutsScreen}
        options={{ title: 'My Workouts' }}
      />
      <Stack.Screen
        name="LogWorkout"
        component={LogWorkoutScreen}
        options={{ title: 'Log Workout' }}
      />
      <Stack.Screen
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{ title: 'Workout Details' }}
      />
    </Stack.Navigator>
  );
};

// Classes Tab Stack
const ClassesStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Classes"
        component={ClassesScreen}
        options={{ title: 'RSF Classes' }}
      />
    </Stack.Navigator>
  );
};

// Hoopers Tab Stack
const HoopersStack = () => {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Hoopers"
        component={HoopersScreen}
        options={{ title: 'HOOPERS' }}
      />
    </Stack.Navigator>
  );
};

export const RootNavigator = () => {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#2563eb',
          tabBarInactiveTintColor: '#64748b',
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={HomeStack}
          options={{
            title: 'Home',
            tabBarIcon: () => null,
          }}
        />
        <Tab.Screen
          name="ClassesTab"
          component={ClassesStack}
          options={{
            title: 'Classes',
            tabBarIcon: () => null,
          }}
        />
        <Tab.Screen
          name="WorkoutsTab"
          component={WorkoutsStack}
          options={{
            title: 'Workouts',
            tabBarIcon: () => null,
          }}
        />
        <Tab.Screen
          name="HoopersTab"
          component={HoopersStack}
          options={{
            title: 'HOOPERS',
            tabBarIcon: () => null,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

