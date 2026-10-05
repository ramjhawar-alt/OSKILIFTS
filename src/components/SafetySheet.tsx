import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  REPORT_REASONS,
  blockUser,
  submitReport,
  type ReportReason,
} from '../services/socialService';
import { confirmAction } from '../utils/alert';

export type SafetyTarget =
  | { kind: 'workout'; workoutId: string; userId: string; username: string | null }
  | { kind: 'profile'; userId: string; username: string | null };

type Mode = 'menu' | 'report' | 'done';

// Report / block sheet. Built on Modal (not Alert) so it works on the web build.
export const SafetySheet = ({
  target,
  onClose,
  onBlocked,
}: {
  target: SafetyTarget | null;
  onClose: () => void;
  onBlocked?: (userId: string) => void;
}) => {
  const [mode, setMode] = useState<Mode>('menu');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setMode('menu');
      setReason(null);
      setDetails('');
      setAlsoBlock(false);
      setBusy(false);
      setError(null);
    }
  }, [target]);

  if (!target) return null;
  const handle = target.username ? `@${target.username}` : 'this user';

  const handleBlock = async () => {
    const confirmed = await confirmAction({
      title: `Block ${handle}?`,
      message:
        'You won’t see each other’s profiles or workouts, and any follow connection between you is removed. You can unblock later from your profile.',
      confirmLabel: 'Block',
      destructive: true,
    });
    if (!confirmed) return;
    setBusy(true);
    setError(null);
    try {
      await blockUser(target.userId);
      onBlocked?.(target.userId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to block this user.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitReport = async () => {
    if (!reason) return;
    setBusy(true);
    setError(null);
    try {
      await submitReport(
        target.kind,
        target.kind === 'workout' ? target.workoutId : target.userId,
        reason,
        details,
      );
      if (alsoBlock) {
        await blockUser(target.userId);
        onBlocked?.(target.userId);
      }
      setMode('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send your report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {mode === 'menu' ? (
              <>
                <Text style={styles.title}>{handle}</Text>
                <TouchableOpacity style={styles.row} onPress={() => setMode('report')}>
                  <Text style={styles.rowText}>
                    Report {target.kind === 'workout' ? 'this workout' : 'this profile'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.row} onPress={handleBlock} disabled={busy}>
                  <Text style={[styles.rowText, styles.destructive]}>Block {handle}</Text>
                </TouchableOpacity>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <TouchableOpacity style={styles.cancel} onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {mode === 'report' ? (
              <>
                <Text style={styles.title}>Why are you reporting this?</Text>
                {REPORT_REASONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.row, reason === option.value && styles.rowSelected]}
                    onPress={() => setReason(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: reason === option.value }}
                  >
                    <Text style={styles.rowText}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
                <TextInput
                  style={styles.input}
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Add details (optional)"
                  placeholderTextColor="#94a3b8"
                  multiline
                  maxLength={1000}
                />
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setAlsoBlock((value) => !value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: alsoBlock }}
                >
                  <View style={[styles.box, alsoBlock && styles.boxChecked]}>
                    {alsoBlock ? <Text style={styles.check}>✓</Text> : null}
                  </View>
                  <Text style={styles.checkText}>Also block {handle}</Text>
                </TouchableOpacity>
                {error ? <Text style={styles.error}>{error}</Text> : null}
                <TouchableOpacity
                  style={[styles.submit, (!reason || busy) && styles.submitDisabled]}
                  onPress={handleSubmitReport}
                  disabled={!reason || busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.submitText}>Send report</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancel} onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : null}

            {mode === 'done' ? (
              <>
                <Text style={styles.title}>Thanks for letting us know</Text>
                <Text style={styles.body}>
                  We review reports within 24 hours and remove anything that breaks the
                  community guidelines.
                </Text>
                <TouchableOpacity style={styles.submit} onPress={onClose}>
                  <Text style={styles.submitText}>Done</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: '90%',
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  body: { fontSize: 15, color: '#475569', marginBottom: 16, lineHeight: 22 },
  row: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  rowSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  rowText: { fontSize: 16, color: '#0f172a', fontWeight: '500' },
  destructive: { color: '#dc2626' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    minHeight: 80,
    fontSize: 15,
    color: '#0f172a',
    marginTop: 4,
    textAlignVertical: 'top',
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  check: { color: '#fff', fontSize: 14, fontWeight: '800' },
  checkText: { fontSize: 15, color: '#334155' },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 8 },
  submit: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cancel: { paddingVertical: 12, alignItems: 'center' },
  cancelText: { color: '#64748b', fontSize: 15, fontWeight: '600' },
});
