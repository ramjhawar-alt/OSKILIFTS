import React, { memo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SetRow } from './SetRow';
import { isRowComplete, type DraftAction, type DraftEntry } from '../domain/draft';
import type { WeightUnit } from '../domain/units';
import { hintForRow } from '../domain/history';
import type { SetData } from '../types/workout';

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
        <Text style={[styles.columnLabel, styles.previousColumn]}>PREVIOUS</Text>
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
          onPress={() => dispatch({ type: 'addSet', entryId: entry.id })}
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
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  titleBlock: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  muscle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  headerActions: { alignItems: 'flex-end', gap: 6 },
  link: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  remove: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
  legacyNote: { fontSize: 12, color: '#64748b', backgroundColor: '#f8fafc', padding: 8, borderRadius: 6 },
  columns: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  columnLabel: { fontSize: 11, fontWeight: '700', color: '#94a3b8', textAlign: 'center' },
  setColumn: { width: 36 },
  previousColumn: { width: 62 },
  flexColumn: { flex: 1 },
  checkColumn: { width: 40 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  addSet: { backgroundColor: '#f1f5f9', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  addSetText: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  removeSet: { color: '#64748b', fontSize: 13, fontWeight: '600' },
});
