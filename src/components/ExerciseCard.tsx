import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SetRow } from './SetRow';
import { isRowComplete, type DraftAction, type DraftEntry } from '../domain/draft';
import type { WeightUnit } from '../domain/units';
import { hintForRow } from '../domain/history';
import type { SetData } from '../types/workout';
import { colors, radius, space } from '../theme';
import { tapHaptic } from '../utils/haptics';

const HEADERS: Record<DraftEntry['exercise']['type'], (unit: WeightUnit) => string[]> = {
  weight_reps: (unit) => [`WEIGHT (${unit})`, 'REPS'],
  bodyweight_reps: (unit) => [`+${unit}`, 'REPS'],
  duration: () => ['TIME'],
  distance_duration: (unit) => [unit === 'lb' ? 'MILES' : 'KM', 'TIME'],
};

export interface ExerciseCardProps {
  entry: DraftEntry;
  unit: WeightUnit;
  dispatch: React.Dispatch<DraftAction>;
  /** Sets from the last earlier session of this exercise (stable reference), if any. */
  previousSets: SetData[] | null;
  onReplace: (entryId: string) => void;
  onRemove: (entryId: string) => void;
}

const ExerciseCardBase = ({ entry, unit, dispatch, previousSets, onReplace, onRemove }: ExerciseCardProps) => {
  let working = 0;
  const headers = HEADERS[entry.exercise.type](unit);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <Text style={styles.name} numberOfLines={2}>
            {entry.exercise.name}
          </Text>
          {entry.exercise.muscleGroup ? (
            <Text style={styles.muscle}>{entry.exercise.muscleGroup}</Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => onReplace(entry.id)} accessibilityRole="button">
            <Text style={styles.link}>Replace</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onRemove(entry.id)} accessibilityRole="button">
            <Text style={styles.remove}>Remove</Text>
          </TouchableOpacity>
        </View>
      </View>

      {entry.legacy && !entry.touched ? (
        <Text style={styles.legacyNote}>Logged before weights were tracked. Edit a set to add weight.</Text>
      ) : null}

      <View style={styles.columns}>
        <Text style={[styles.columnLabel, styles.setColumn]}>SET</Text>
        <Text style={[styles.columnLabel, styles.previousColumn]}>PREV</Text>
        {headers.map((label) => (
          <Text key={label} style={[styles.columnLabel, styles.flexColumn]}>
            {label}
          </Text>
        ))}
        <Text style={[styles.columnLabel, styles.checkColumn]}>✓</Text>
      </View>

      {entry.sets.map((set, rowIndex) => {
        if (set.kind !== 'warmup') working += 1;
        return (
          <SetRow
            key={set.id}
            entryId={entry.id}
            set={set}
            workingNumber={working}
            type={entry.exercise.type}
            complete={isRowComplete(entry.exercise.type, set, unit)}
            hint={
              previousSets
                ? hintForRow(previousSets, entry.sets, rowIndex, entry.exercise.type, unit)
                : null
            }
            dispatch={dispatch}
          />
        );
      })}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.addSet}
          onPress={() => {
            tapHaptic();
            dispatch({ type: 'addSet', entryId: entry.id });
          }}
          accessibilityRole="button"
        >
          <Text style={styles.addSetText}>+ Add set</Text>
        </TouchableOpacity>
        {entry.sets.length > 1 ? (
          <TouchableOpacity
            onPress={() => dispatch({ type: 'removeLastSet', entryId: entry.id })}
            accessibilityRole="button"
          >
            <Text style={styles.removeSet}>Remove last set</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

export const ExerciseCard = memo(ExerciseCardBase);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    marginBottom: space.md,
    gap: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md, marginBottom: 4 },
  titleBlock: { flex: 1 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
  muscle: { fontSize: 12, color: colors.cyan, marginTop: 2, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  headerActions: { alignItems: 'flex-end', gap: 8 },
  link: { color: colors.cyan, fontSize: 13, fontWeight: '700' },
  remove: { color: colors.danger, fontSize: 13, fontWeight: '700' },
  legacyNote: { fontSize: 12, color: colors.textMuted, backgroundColor: colors.surfaceHi, padding: 8, borderRadius: 8 },
  columns: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  columnLabel: { fontSize: 10, fontWeight: '800', color: colors.textFaint, textAlign: 'center', letterSpacing: 1 },
  setColumn: { width: 36 },
  previousColumn: { width: 62 },
  flexColumn: { flex: 1 },
  checkColumn: { width: 48 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  addSet: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: 'center',
  },
  addSetText: { color: colors.gold, fontSize: 14, fontWeight: '800' },
  removeSet: { color: colors.textMuted, fontSize: 13, fontWeight: '600', padding: 8 },
});
