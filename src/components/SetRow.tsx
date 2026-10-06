import React, { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { DraftAction, DraftSet } from '../domain/draft';
import type { SetHint } from '../domain/history';
import type { ExerciseType } from '../types/workout';

const KIND_LETTER: Record<string, string> = { warmup: 'W', drop: 'D', failure: 'F' };

export interface SetRowProps {
  entryId: string;
  set: DraftSet;
  /** 1-based number among working sets (ignored for warm-up rows). */
  workingNumber: number;
  type: ExerciseType;
  complete: boolean;
  hint: SetHint | null;
  dispatch: React.Dispatch<DraftAction>;
}

type TextField = 'weightText' | 'repsText' | 'secText' | 'distText';

const SetRowBase = ({ entryId, set, workingNumber, type, complete, hint, dispatch }: SetRowProps) => {
  const patch = useCallback(
    (field: TextField, value: string) =>
      dispatch({ type: 'patchSet', entryId, setId: set.id, patch: { [field]: value } }),
    [dispatch, entryId, set.id],
  );
  const toggle = useCallback(() => {
    // An incomplete row with a previous-session hint is completed from it
    // ("same as last time" in one tap); otherwise a normal toggle.
    if (!set.done && !complete && hint) {
      dispatch({ type: 'applyHint', entryId, setId: set.id, hint, overwrite: false, complete: true });
    } else {
      dispatch({ type: 'toggleDone', entryId, setId: set.id });
    }
  }, [dispatch, entryId, set.id, set.done, complete, hint]);
  const copyHint = useCallback(() => {
    if (hint) dispatch({ type: 'applyHint', entryId, setId: set.id, hint, overwrite: true, complete: false });
  }, [dispatch, entryId, set.id, hint]);
  const cycle = useCallback(
    () => dispatch({ type: 'cycleKind', entryId, setId: set.id }),
    [dispatch, entryId, set.id],
  );

  const kindLetter = KIND_LETTER[set.kind];
  const label = kindLetter ?? String(workingNumber);

  const field = (
    key: TextField,
    value: string,
    placeholder: string,
    mode: 'decimal' | 'numeric' | 'text',
    accessibilityLabel: string,
  ) => (
    <TextInput
      style={[styles.input, set.done && styles.inputDone]}
      value={value}
      onChangeText={(text) => patch(key, text)}
      placeholder={placeholder}
      placeholderTextColor={hint ? '#94a3b8' : '#cbd5e1'}
      inputMode={mode}
      keyboardType={mode === 'decimal' ? 'decimal-pad' : mode === 'numeric' ? 'number-pad' : 'numbers-and-punctuation'}
      selectTextOnFocus
      maxLength={9}
      accessibilityLabel={accessibilityLabel}
    />
  );

  return (
    <View style={[styles.row, set.done && styles.rowDone]}>
      <Pressable
        style={[styles.badge, kindLetter ? styles.badgeSpecial : null]}
        onPress={cycle}
        accessibilityRole="button"
        accessibilityLabel={`Set ${label}, tap to change set type`}
      >
        <Text style={[styles.badgeText, kindLetter ? styles.badgeTextSpecial : null]}>{label}</Text>
      </Pressable>

      <Pressable
        style={styles.previous}
        onPress={copyHint}
        disabled={!hint}
        accessibilityRole="button"
        accessibilityLabel={hint ? `Previous ${hint.summary}. Tap to copy` : 'No previous session'}
      >
        <Text style={[styles.previousText, !hint && styles.previousEmpty]} numberOfLines={1}>
          {hint ? hint.summary : '—'}
        </Text>
      </Pressable>

      {type === 'duration' ? (
        <View style={styles.cell}>{field('secText', set.secText, hint?.secText || 'm:ss', 'text', 'Time')}</View>
      ) : null}

      {type === 'distance_duration' ? (
        <>
          <View style={styles.cell}>{field('distText', set.distText, hint?.distText || '0', 'decimal', 'Distance')}</View>
          <View style={styles.cell}>{field('secText', set.secText, hint?.secText || 'm:ss', 'text', 'Time')}</View>
        </>
      ) : null}

      {type === 'weight_reps' || type === 'bodyweight_reps' ? (
        <>
          <View style={styles.cell}>
            {field('weightText', set.weightText, hint?.weightText || (type === 'bodyweight_reps' ? 'BW' : '0'), 'decimal', 'Weight')}
          </View>
          <View style={styles.cell}>{field('repsText', set.repsText, hint?.repsText || '0', 'numeric', 'Reps')}</View>
        </>
      ) : null}

      <Pressable
        style={[styles.check, set.done && styles.checkDone, !set.done && !complete && !hint && styles.checkDisabled]}
        onPress={toggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: set.done, disabled: !set.done && !complete && !hint }}
        accessibilityLabel={set.done ? 'Completed. Tap to undo' : 'Mark set complete'}
        hitSlop={6}
      >
        <Text style={[styles.checkMark, set.done && styles.checkMarkDone]}>✓</Text>
      </Pressable>
    </View>
  );
};

// Memoized: with stable ids and a stable dispatch, only the row being edited re-renders.
export const SetRow = memo(SetRowBase);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  rowDone: { backgroundColor: '#ecfdf5' },
  badge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeSpecial: { backgroundColor: '#fef3c7' },
  badgeText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  badgeTextSpecial: { color: '#b45309' },
  previous: { width: 62, height: 40, alignItems: 'center', justifyContent: 'center' },
  previousText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
  previousEmpty: { color: '#cbd5e1' },
  cell: { flex: 1 },
  input: {
    height: 40,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    paddingHorizontal: 4,
  },
  inputDone: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  check: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: '#16a34a' },
  checkDisabled: { opacity: 0.45 },
  checkMark: { fontSize: 18, fontWeight: '800', color: '#64748b' },
  checkMarkDone: { color: '#ffffff' },
});
