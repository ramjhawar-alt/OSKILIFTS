import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
} from 'react-native';

import {
  EXERCISE_TYPES,
  EXERCISE_TYPE_LABELS,
} from '../domain/exerciseTypes';
import type { ExerciseType } from '../types/workout';

type CustomExerciseModalProps = {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, type: ExerciseType) => void;
};

export const CustomExerciseModal = ({
  visible,
  onClose,
  onSave,
}: CustomExerciseModalProps) => {
  const [name, setName] = useState('');
  const [type, setType] = useState<ExerciseType>('weight_reps');

  const reset = () => {
    setName('');
    setType('weight_reps');
  };

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim().slice(0, 80), type);
      reset();
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Add Custom Exercise</Text>
          <TextInput
            style={styles.input}
            placeholder="Exercise name"
            value={name}
            onChangeText={setName}
            maxLength={80}
            autoFocus
          />
          <Text style={styles.label}>How do you track it?</Text>
          <View style={styles.chips}>
            {EXERCISE_TYPES.map((option) => (
              <TouchableOpacity
                key={option}
                style={[styles.chip, type === option && styles.chipSelected]}
                onPress={() => setType(option)}
                accessibilityRole="radio"
                accessibilityState={{ selected: type === option }}
              >
                <Text style={[styles.chipText, type === option && styles.chipTextSelected]}>
                  {EXERCISE_TYPE_LABELS[option]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton, !name.trim() && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!name.trim()}
            >
              <Text style={styles.saveButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 16,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#475569', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#475569' },
  chipTextSelected: { color: '#ffffff' },
  actions: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f1f5f9' },
  cancelButtonText: { color: '#475569', fontSize: 16, fontWeight: '600' },
  saveButton: { backgroundColor: '#2563eb' },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
