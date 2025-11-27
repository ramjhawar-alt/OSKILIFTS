import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {
  getExerciseDatabase,
  saveCustomExercise,
} from '../services/workoutStorage';
import { CustomExerciseModal } from './CustomExerciseModal';
import type { Exercise, ExerciseEntry } from '../types/workout';

type ExerciseSearchProps = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise, sets: number, reps: number | number[]) => void;
  initialExercise?: ExerciseEntry;
};

export const ExerciseSearch = ({
  visible,
  onClose,
  onSelect,
  initialExercise,
}: ExerciseSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [sets, setSets] = useState(
    initialExercise?.sets.toString() || '3',
  );
  const [reps, setReps] = useState(
    Array.isArray(initialExercise?.reps)
      ? initialExercise.reps.join(', ')
      : initialExercise?.reps.toString() || '10',
  );

  const loadExercises = useCallback(async () => {
    try {
      setLoading(true);
      const allExercises = await getExerciseDatabase();
      setExercises(allExercises);
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadExercises();
      if (initialExercise) {
        setSets(initialExercise.sets.toString());
        setReps(
          Array.isArray(initialExercise.reps)
            ? initialExercise.reps.join(', ')
            : initialExercise.reps.toString(),
        );
      }
    } else {
      setSearchQuery('');
      setSets('3');
      setReps('10');
    }
  }, [visible, initialExercise, loadExercises]);

  const filteredExercises = exercises.filter((exercise) =>
    exercise.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleExerciseSelect = (exercise: Exercise) => {
    const setsNum = parseInt(sets, 10);
    const repsValue = reps.includes(',')
      ? reps.split(',').map((r) => parseInt(r.trim(), 10))
      : parseInt(reps, 10);

    if (isNaN(setsNum) || (typeof repsValue === 'number' && isNaN(repsValue))) {
      alert('Please enter valid numbers for sets and reps');
      return;
    }

    onSelect(exercise, setsNum, repsValue);
  };

  const handleAddCustomExercise = async (name: string) => {
    try {
      const newExercise: Exercise = { name, isCustom: true };
      await saveCustomExercise(newExercise);
      await loadExercises();
      setShowCustomModal(false);
      setSearchQuery(name);
    } catch (error: any) {
      alert(error.message || 'Failed to add custom exercise');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {initialExercise ? 'Edit Exercise' : 'Add Exercise'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchSection}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity
              style={styles.addCustomButton}
              onPress={() => setShowCustomModal(true)}
            >
              <Text style={styles.addCustomButtonText}>+ Custom</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : (
            <FlatList
              data={filteredExercises}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.exerciseItem}
                  onPress={() => handleExerciseSelect(item)}
                >
                  <Text style={styles.exerciseName}>{item.name}</Text>
                  {item.muscleGroup && (
                    <Text style={styles.muscleGroup}>{item.muscleGroup}</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>
                    No exercises found. Try adding a custom exercise.
                  </Text>
                </View>
              }
              style={styles.exerciseList}
            />
          )}

          <View style={styles.inputSection}>
            <View style={styles.inputRow}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Sets</Text>
                <TextInput
                  style={styles.numberInput}
                  value={sets}
                  onChangeText={setSets}
                  keyboardType="numeric"
                  placeholder="3"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reps</Text>
                <TextInput
                  style={styles.numberInput}
                  value={reps}
                  onChangeText={setReps}
                  keyboardType="numeric"
                  placeholder="10 or 10, 8, 6"
                />
              </View>
            </View>
            <Text style={styles.inputHint}>
              For different reps per set, separate with commas (e.g., 10, 8, 6)
            </Text>
          </View>
        </View>
      </View>

      <CustomExerciseModal
        visible={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSave={handleAddCustomExercise}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#64748b',
  },
  searchSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  addCustomButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  addCustomButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  exerciseList: {
    maxHeight: 300,
  },
  exerciseItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  muscleGroup: {
    fontSize: 12,
    color: '#64748b',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  inputSection: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  numberInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inputHint: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
  },
  centered: {
    padding: 40,
    alignItems: 'center',
  },
});

