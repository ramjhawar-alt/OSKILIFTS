import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { MAX_ROUTINE_NAME } from '../domain/routines';
import { colors } from '../theme';

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
            placeholderTextColor={colors.textFaint}
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,10,25,0.72)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  container: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  input: {
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    marginBottom: 20,
  },
  actions: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center' },
  cancel: { backgroundColor: colors.surfaceHi },
  cancelText: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  save: { backgroundColor: colors.gold },
  saveDisabled: { opacity: 0.5 },
  saveText: { color: colors.onGold, fontSize: 16, fontWeight: '600' },
});
