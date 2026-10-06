import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { exerciseKey } from '../domain/entry';
import { showMessage } from '../utils/alert';
import type { Exercise, ExerciseType } from '../types/workout';

type ExerciseSearchProps = {
  visible: boolean;
  onClose: () => void;
  /** Called with every selected exercise (or the single tapped one in `single` mode). */
  onPick: (exercises: Exercise[]) => void;
  single?: boolean;
};

// A pure picker: choosing an exercise only adds it; sets, reps and weight are
// entered on the workout screen.
export const ExerciseSearch = ({ visible, onClose, onPick, single }: ExerciseSearchProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [selected, setSelected] = useState<Map<string, Exercise>>(new Map());

  const loadExercises = useCallback(async () => {
    try {
      setLoading(true);
      setExercises(await getExerciseDatabase());
    } catch (error) {
      console.error('Error loading exercises:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadExercises();
    } else {
      setSearchQuery('');
      setSelected(new Map());
    }
  }, [visible, loadExercises]);

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return query ? exercises.filter((e) => e.name.toLowerCase().includes(query)) : exercises;
  }, [exercises, searchQuery]);

  const toggle = (exercise: Exercise) => {
    if (single) {
      onPick([exercise]);
      return;
    }
    setSelected((current) => {
      const next = new Map(current);
      const key = exerciseKey(exercise.name);
      if (next.has(key)) next.delete(key);
      else next.set(key, exercise);
      return next;
    });
  };

  const handleAddCustom = async (name: string, type: ExerciseType) => {
    try {
      const created: Exercise = { name, isCustom: true, type };
      await saveCustomExercise(created);
      await loadExercises();
      setShowCustomModal(false);
      if (single) onPick([created]);
      else setSelected((current) => new Map(current).set(exerciseKey(name), created));
    } catch (error: any) {
      showMessage('Error', error.message || 'Failed to add custom exercise');
    }
  };

  const confirm = () => {
    onPick(Array.from(selected.values()));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{single ? 'Replace exercise' : 'Add exercises'}</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button">
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercises..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity style={styles.customButton} onPress={() => setShowCustomModal(true)}>
              <Text style={styles.customButtonText}>+ Custom</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator style={styles.loader} color="#2563eb" />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => `${item.isCustom ? 'c' : 'd'}:${exerciseKey(item.name)}`}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => {
                const isSelected = selected.has(exerciseKey(item.name));
                return (
                  <TouchableOpacity
                    style={[styles.item, isSelected && styles.itemSelected]}
                    onPress={() => toggle(item)}
                    accessibilityRole={single ? 'button' : 'checkbox'}
                    accessibilityState={single ? undefined : { checked: isSelected }}
                  >
                    <View style={styles.itemText}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>
                        {[item.muscleGroup, item.isCustom ? 'Custom' : null].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    {!single ? (
                      <Text style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                        {isSelected ? '✓' : ''}
                      </Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={<Text style={styles.empty}>No exercises match. Tap “+ Custom” to add one.</Text>}
            />
          )}

          {!single ? (
            <TouchableOpacity
              style={[styles.doneButton, selected.size === 0 && styles.doneButtonDisabled]}
              onPress={confirm}
              disabled={selected.size === 0}
            >
              <Text style={styles.doneText}>
                {selected.size === 0 ? 'Select exercises' : `Add ${selected.size} exercise${selected.size === 1 ? '' : 's'}`}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <CustomExerciseModal
        visible={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        onSave={handleAddCustom}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
    minHeight: '60%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  closeText: { fontSize: 16, color: '#2563eb', fontWeight: '600' },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  customButton: { justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#f1f5f9', borderRadius: 8 },
  customButtonText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  loader: { marginVertical: 24 },
  list: { flexGrow: 0, flexShrink: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 6,
  },
  itemSelected: { backgroundColor: '#eff6ff', borderColor: '#2563eb' },
  itemText: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  itemMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    textAlign: 'center',
    lineHeight: 21,
    color: '#fff',
    fontWeight: '800',
  },
  checkboxSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  empty: { color: '#64748b', textAlign: 'center', marginTop: 24 },
  doneButton: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  doneButtonDisabled: { opacity: 0.5 },
  doneText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
