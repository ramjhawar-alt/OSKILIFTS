import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { HomeScreen } from '../screens/HomeScreen';
import { ClassesScreen } from '../screens/ClassesScreen';
import { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#f7f9fc',
  },
};

export const RootNavigator = () => {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator>
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'OSKILIFTS' }}
        />
        <Stack.Screen
          name="Classes"
          component={ClassesScreen}
          options={{ title: 'RSF Classes' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

