import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../types/navigation';
import {
  getWorkoutById,
  deleteWorkout,
} from '../services/workoutStorage';
import type { Workout } from '../types/workout';
import { formatReps, formatSet, getDateFromISOString } from '../utils/workoutFormat';
import { confirmAction, showMessage } from '../utils/alert';
import { useWeightUnit } from '../contexts/ProfileContext';
import { PrChips } from '../components/PrChips';

type WorkoutDetailNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'WorkoutDetail'
>;

export const WorkoutDetailScreen = () => {
  const navigation = useNavigation<WorkoutDetailNavigationProp>();
  const unit = useWeightUnit();
  const route = useRoute();
  const workoutId = (route.params as { workoutId: string }).workoutId;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const loadWorkout = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getWorkoutById(workoutId);
      setWorkout(data);
    } catch (error) {
      console.error('Error loading workout:', error);
      showMessage('Error', 'Failed to load workout');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [workoutId, navigation]);

  useEffect(() => {
    loadWorkout();
  }, [loadWorkout]);

  const handleEdit = () => {
    if (workout) {
      navigation.navigate('LogWorkout', { workoutId: workout.id });
    }
  };

  const handleDelete = async () => {
    const confirmed = await confirmAction({
      title: 'Delete Workout',
      message: 'Are you sure you want to delete this workout? This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      setDeleting(true);
      await deleteWorkout(workoutId);
      navigation.goBack();
    } catch (error) {
      console.error('Error deleting workout:', error);
      showMessage('Error', 'Failed to delete workout');
    } finally {
      setDeleting(false);
    }
  };

  if (loading || deleting) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </ScreenContainer>
    );
  }

  if (!workout) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <Text style={styles.errorText}>Workout not found</Text>
        </View>
      </ScreenContainer>
    );
  }

  const workoutDate = getDateFromISOString(workout.date);

  return (
    <ScreenContainer>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.dateText}>
              {workoutDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
          <View style={styles.dayTypeBadge}>
            <Text style={styles.dayTypeText}>{workout.dayType.name}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Exercises</Text>
          {workout.exercises.map((entry, index) => (
            <View key={index} style={styles.exerciseCard}>
              <TouchableOpacity
                onPress={() => navigation.navigate('ExerciseDetail', { key: entry.key, name: entry.exercise.name })}
                accessibilityRole="link"
                accessibilityLabel={`${entry.exercise.name} progress`}
              >
                <Text style={styles.exerciseName}>{entry.exercise.name}</Text>
              </TouchableOpacity>
              <PrChips prs={entry.prs} />
              {entry.legacy && !entry.touched ? (
                <View style={styles.exerciseDetails}>
                  <Text style={styles.detailText}>
                    Sets: <Text style={styles.detailValue}>{entry.legacy.sets}</Text>
                  </Text>
                  <Text style={styles.detailText}>
                    Reps:{' '}
                    <Text style={styles.detailValue}>
                      {formatReps(entry.legacy.reps)}
                    </Text>
                  </Text>
                </View>
              ) : (
                <View style={styles.setList}>
                  {entry.sets.map((set, setIndex) => {
                    const label =
                      set.kind === 'warmup' ? 'W' : set.kind === 'drop' ? 'D' : set.kind === 'failure' ? 'F' : String(
                        entry.sets.slice(0, setIndex + 1).filter((s) => s.kind !== 'warmup').length,
                      );
                    return (
                      <View key={setIndex} style={styles.setLine}>
                        <Text style={styles.setLabel}>{label}</Text>
                        <Text style={styles.detailValue}>
                          {formatSet(set, entry.exercise.type, unit)}
                          {set.kg !== null && entry.exercise.type !== 'duration' ? ` ${unit}` : ''}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          ))}
        </View>

        {workout.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{workout.notes}</Text>
            </View>
          </View>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={handleEdit}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDelete}
          >
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  setList: { gap: 6, marginTop: 4 },
  setLine: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  setLabel: {
    width: 28,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#f1f5f9',
    borderRadius: 6,
    paddingVertical: 3,
  },
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    color: '#64748b',
  },
  dayTypeBadge: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dayTypeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 12,
  },
  exerciseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  exerciseDetails: {
    flexDirection: 'row',
    gap: 16,
  },
  detailText: {
    fontSize: 14,
    color: '#64748b',
  },
  detailValue: {
    fontWeight: '600',
    color: '#0f172a',
  },
  notesCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  notesText: {
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: '#2563eb',
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
  },
});

