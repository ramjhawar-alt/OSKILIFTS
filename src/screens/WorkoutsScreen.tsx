import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar } from 'react-native-calendars';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../types/navigation';
import { getWorkouts, getWorkoutsByDateRange } from '../services/workoutStorage';
import type { Workout } from '../types/workout';

type WorkoutsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Workouts'
>;

// Helper function to get date from ISO string, preserving the date part
function getDateFromISOString(isoString: string): Date {
  const datePart = isoString.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Helper function to get date from YYYY-MM-DD string, preserving the date part
function getDateFromDateString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const WorkoutsScreen = () => {
  const navigation = useNavigation<WorkoutsNavigationProp>();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );

  const loadWorkouts = useCallback(async () => {
    try {
      setLoading(true);
      const allWorkouts = await getWorkouts();
      setWorkouts(allWorkouts);
    } catch (error) {
      console.error('Error loading workouts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkouts();
  }, [loadWorkouts]);

  // Reload workouts when screen comes into focus (e.g., after saving a workout)
  useFocusEffect(
    useCallback(() => {
      loadWorkouts();
    }, [loadWorkouts])
  );

  // Create marked dates for calendar
  const markedDates = workouts.reduce((acc, workout) => {
    const date = workout.date.split('T')[0];
    acc[date] = {
      marked: true,
      dotColor: '#2563eb',
      selected: date === selectedDate,
      selectedColor: '#2563eb',
    };
    return acc;
  }, {} as Record<string, any>);

  // Mark selected date
  if (selectedDate && !markedDates[selectedDate]) {
    markedDates[selectedDate] = {
      selected: true,
      selectedColor: '#2563eb',
    };
  }

  const workoutsForSelectedDate = workouts.filter(
    (w) => w.date.split('T')[0] === selectedDate,
  );

  const handleDateSelect = (day: { dateString: string }) => {
    setSelectedDate(day.dateString);
  };

  const handleLogWorkout = () => {
    navigation.navigate('LogWorkout', { initialDate: selectedDate });
  };

  const handleWorkoutPress = (workoutId: string) => {
    navigation.navigate('WorkoutDetail', { workoutId });
  };

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Workout History</Text>
        </View>

        <View style={styles.bearInfoCard}>
          <Text style={styles.bearInfoTitle}>Grow Your Oski Bear</Text>
          <Text style={styles.bearInfoText}>
            The more workouts you log and the more consistent you are, the bigger your Oski bear will get! Log consecutive days of workouts to level up your bear through 10 stages. Your bear grows with your dedication!
          </Text>
        </View>

        <Calendar
          current={selectedDate}
          onDayPress={handleDateSelect}
          markedDates={markedDates}
          theme={{
            selectedDayBackgroundColor: '#2563eb',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#2563eb',
            dayTextColor: '#0f172a',
            textDisabledColor: '#cbd5e1',
            dotColor: '#2563eb',
            selectedDotColor: '#ffffff',
            arrowColor: '#2563eb',
            monthTextColor: '#0f172a',
            textDayFontWeight: '500',
            textMonthFontWeight: '700',
            textDayHeaderFontWeight: '600',
          }}
          style={styles.calendar}
        />

        <View style={styles.workoutsSection}>
          <Text style={styles.sectionTitle}>
            {workoutsForSelectedDate.length > 0
              ? `Workouts on ${getDateFromDateString(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}`
              : `No workouts on ${getDateFromDateString(selectedDate).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                })}`}
          </Text>

          {workoutsForSelectedDate.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                No workouts logged for this date.
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={handleLogWorkout}
              >
                <Text style={styles.emptyButtonText}>Log a workout</Text>
              </TouchableOpacity>
            </View>
          ) : (
            workoutsForSelectedDate.map((workout) => (
              <TouchableOpacity
                key={workout.id}
                style={styles.workoutCard}
                onPress={() => handleWorkoutPress(workout.id)}
              >
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutDayType}>
                    {workout.dayType.name}
                  </Text>
                  <Text style={styles.workoutTime}>
                    {getDateFromISOString(workout.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <Text style={styles.workoutExercises}>
                  {workout.exercises.length} exercise
                  {workout.exercises.length !== 1 ? 's' : ''}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0f172a',
  },
  bearInfoCard: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#FDB515',
  },
  bearInfoTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  bearInfoText: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    textAlign: 'center',
  },
  calendar: {
    borderRadius: 12,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  workoutsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  workoutCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutDayType: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  workoutTime: {
    fontSize: 14,
    color: '#64748b',
  },
  workoutExercises: {
    fontSize: 14,
    color: '#64748b',
  },
});

