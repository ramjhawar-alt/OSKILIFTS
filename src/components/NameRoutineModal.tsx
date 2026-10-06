import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { MAX_ROUTINE_NAME } from '../domain/routines';

export const NameRoutineModal = ({
  visible,
  title,
  initialName = '',
  confirmLabel = 'Save',
  onClose,
  onSave,
}: {
  visible: boolean;
  title: string;
  initialName?: string;
  confirmLabel?: string;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
}) => {
  const [name, setName] = useState(initialName);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setName(initialName);
  }, [visible, initialName]);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onSave(name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            style={styles.input}
            placeholder="Routine name"
            placeholderTextColor="#94a3b8"
            value={name}
            onChangeText={setName}
            maxLength={MAX_ROUTINE_NAME}
            autoFocus
            onSubmitEditing={submit}
          />
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.button, styles.cancel]} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.save, (!name.trim() || busy) && styles.saveDisabled]}
              onPress={submit}
              disabled={!name.trim() || busy}
            >
              <Text style={styles.saveText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  container: { backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a', marginBottom: 16 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 20,
  },
  actions: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancel: { backgroundColor: '#f1f5f9' },
  cancelText: { color: '#475569', fontSize: 16, fontWeight: '600' },
  save: { backgroundColor: '#2563eb' },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
