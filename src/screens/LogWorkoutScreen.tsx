import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../types/navigation';
import {
  getWorkoutById,
  saveWorkout,
  getWorkoutDayTypes,
  saveCustomWorkoutDayType,
} from '../services/workoutStorage';
import { ExerciseSearch } from '../components/ExerciseSearch';
import { CustomDayTypeModal } from '../components/CustomDayTypeModal';
import type { Workout, WorkoutDayType, ExerciseEntry } from '../types/workout';

type LogWorkoutNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'LogWorkout'
>;

export const LogWorkoutScreen = () => {
  const navigation = useNavigation<LogWorkoutNavigationProp>();
  const route = useRoute();
  const params = route.params as { workoutId?: string; initialDate?: string };
  const workoutId = params?.workoutId;
  const initialDate = params?.initialDate;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(
    initialDate || new Date().toISOString().split('T')[0],
  );
  const [selectedDayType, setSelectedDayType] = useState<WorkoutDayType | null>(
    null,
  );
  const [dayTypes, setDayTypes] = useState<WorkoutDayType[]>([]);
  const [exercises, setExercises] = useState<ExerciseEntry[]>([]);
  const [notes, setNotes] = useState('');
  const [showDayTypeModal, setShowDayTypeModal] = useState(false);
  const [showExerciseSearch, setShowExerciseSearch] = useState(false);
  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(
    null,
  );

  const loadWorkoutData = useCallback(async () => {
    if (!workoutId) {
      // Load default day types for new workout
      const types = await getWorkoutDayTypes();
      setDayTypes(types);
      return;
    }

    setLoading(true);
    try {
      const workout = await getWorkoutById(workoutId);
      if (workout) {
        setWorkoutDate(workout.date.split('T')[0]);
        setSelectedDayType(workout.dayType);
        setExercises(workout.exercises);
        setNotes(workout.notes || '');
      }
      const types = await getWorkoutDayTypes();
      setDayTypes(types);
    } catch (error) {
      console.error('Error loading workout:', error);
      Alert.alert('Error', 'Failed to load workout data');
    } finally {
      setLoading(false);
    }
  }, [workoutId]);

  useEffect(() => {
    loadWorkoutData();
  }, [loadWorkoutData]);

  const handleAddExercise = () => {
    setEditingExerciseIndex(null);
    setShowExerciseSearch(true);
  };

  const handleExerciseSelect = (exercise: any, sets: number, reps: number | number[]) => {
    const newExercise: ExerciseEntry = {
      exercise,
      sets,
      reps,
    };

    if (editingExerciseIndex !== null) {
      const updated = [...exercises];
      updated[editingExerciseIndex] = newExercise;
      setExercises(updated);
      setEditingExerciseIndex(null);
    } else {
      setExercises([...exercises, newExercise]);
    }
    setShowExerciseSearch(false);
  };

  const handleEditExercise = (index: number) => {
    setEditingExerciseIndex(index);
    setShowExerciseSearch(true);
  };

  const handleRemoveExercise = (index: number) => {
    Alert.alert(
      'Remove Exercise',
      'Are you sure you want to remove this exercise?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = exercises.filter((_, i) => i !== index);
            setExercises(updated);
          },
        },
      ],
    );
  };

  const handleAddCustomDayType = async (name: string) => {
    try {
      const newDayType: WorkoutDayType = { name, isCustom: true };
      await saveCustomWorkoutDayType(newDayType);
      const types = await getWorkoutDayTypes();
      setDayTypes(types);
      setSelectedDayType(newDayType);
      setShowDayTypeModal(false);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add custom day type');
    }
  };

  const handleSave = async () => {
    if (!selectedDayType) {
      Alert.alert('Required', 'Please select a workout day type');
      return;
    }

    if (exercises.length === 0) {
      Alert.alert('Required', 'Please add at least one exercise');
      return;
    }

    setSaving(true);
    try {
      // Validate and normalize the date string (ensure it's YYYY-MM-DD format)
      const dateMatch = workoutDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!dateMatch) {
        Alert.alert('Invalid Date', 'Please enter a date in YYYY-MM-DD format');
        setSaving(false);
        return;
      }
      
      // Use the normalized date part to create ISO string at noon UTC
      // This ensures the date part (YYYY-MM-DD) is always preserved correctly
      // when we extract it with split('T')[0], regardless of timezone
      const normalizedDate = dateMatch[0]; // This is YYYY-MM-DD
      const dateString = `${normalizedDate}T12:00:00.000Z`;
      
      const workout: Workout = {
        id: workoutId || `workout-${Date.now()}`,
        date: dateString,
        dayType: selectedDayType,
        exercises,
        notes: notes.trim() || undefined,
      };

      await saveWorkout(workout);
      navigation.goBack();
    } catch (error) {
      console.error('Error saving workout:', error);
      Alert.alert('Error', 'Failed to save workout');
    } finally {
      setSaving(false);
    }
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
        <View style={styles.section}>
          <Text style={styles.label}>Date</Text>
          <TextInput
            style={styles.input}
            value={workoutDate}
            onChangeText={setWorkoutDate}
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Workout Day Type</Text>
            <TouchableOpacity
              onPress={() => setShowDayTypeModal(true)}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+ Custom</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.dayTypeScroll}
          >
            {dayTypes.map((type) => (
              <TouchableOpacity
                key={type.name}
                style={[
                  styles.dayTypeChip,
                  selectedDayType?.name === type.name && styles.dayTypeChipSelected,
                ]}
                onPress={() => setSelectedDayType(type)}
              >
                <Text
                  style={[
                    styles.dayTypeChipText,
                    selectedDayType?.name === type.name &&
                      styles.dayTypeChipTextSelected,
                  ]}
                >
                  {type.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Exercises</Text>
            <TouchableOpacity
              onPress={handleAddExercise}
              style={styles.addButton}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </TouchableOpacity>
          </View>

          {exercises.length === 0 ? (
            <View style={styles.emptyExercises}>
              <Text style={styles.emptyText}>No exercises added yet</Text>
            </View>
          ) : (
            exercises.map((entry, index) => (
              <View key={index} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>
                    {entry.exercise.name}
                  </Text>
                  <View style={styles.exerciseActions}>
                    <TouchableOpacity
                      onPress={() => handleEditExercise(index)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleRemoveExercise(index)}
                      style={[styles.actionButton, styles.removeButton]}
                    >
                      <Text
                        style={[
                          styles.actionButtonText,
                          styles.removeButtonText,
                        ]}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <Text style={styles.exerciseDetails}>
                  {entry.sets} sets ×{' '}
                  {Array.isArray(entry.reps)
                    ? entry.reps.join(', ')
                    : entry.reps}{' '}
                  reps
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Notes (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add any notes about your workout..."
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Workout</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {showExerciseSearch && (
        <ExerciseSearch
          visible={showExerciseSearch}
          onClose={() => {
            setShowExerciseSearch(false);
            setEditingExerciseIndex(null);
          }}
          onSelect={handleExerciseSelect}
          initialExercise={
            editingExerciseIndex !== null
              ? exercises[editingExerciseIndex]
              : undefined
          }
        />
      )}

      <CustomDayTypeModal
        visible={showDayTypeModal}
        onClose={() => setShowDayTypeModal(false)}
        onSave={handleAddCustomDayType}
      />
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
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  dayTypeScroll: {
    marginTop: 8,
  },
  dayTypeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dayTypeChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  dayTypeChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  dayTypeChipTextSelected: {
    color: '#ffffff',
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  emptyExercises: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
  },
  exerciseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  removeButton: {
    backgroundColor: '#fef2f2',
  },
  removeButtonText: {
    color: '#dc2626',
  },
  exerciseDetails: {
    fontSize: 14,
    color: '#64748b',
  },
  saveButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

