import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import {
  MAX_GOAL_DAYS,
  MIN_GOAL_DAYS,
  progressMessage,
  weekProgress,
  weekStreak,
} from '../domain/weeklyGoal';
import { getWeeklyGoal, setWeeklyGoal } from '../services/weeklyGoalService';
import { showMessage } from '../utils/alert';

const DAY_OPTIONS = Array.from({ length: MAX_GOAL_DAYS - MIN_GOAL_DAYS + 1 }, (_, i) => MIN_GOAL_DAYS + i);

/** A private target for days trained each week, with progress and a streak of weeks hit. */
export const WeeklyGoalCard = ({ workoutDates }: { workoutDates: string[] }) => {
  const [goal, setGoal] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setGoal(await getWeeklyGoal());
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Re-render when the day (and so possibly the week) changes while the app stays open.
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const choose = async (days: number | null) => {
    setBusy(true);
    try {
      await setWeeklyGoal(days);
      setGoal(days);
      setEditing(false);
    } catch (error) {
      showMessage('Couldn’t save your goal', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;

  const picker = (
    <View style={styles.picker}>
      <Text style={styles.hint}>Days per week you want to train:</Text>
      <View style={styles.chips}>
        {DAY_OPTIONS.map((days) => (
          <TouchableOpacity
            key={days}
            style={[styles.chip, goal === days && styles.chipActive]}
            onPress={() => choose(days)}
            disabled={busy}
            accessibilityRole="radio"
            accessibilityState={{ selected: goal === days }}
            accessibilityLabel={`${days} ${days === 1 ? 'day' : 'days'} per week`}
          >
            <Text style={[styles.chipText, goal === days && styles.chipTextActive]}>{days}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {busy ? <ActivityIndicator color="#2563eb" /> : null}
      {goal !== null ? (
        <TouchableOpacity onPress={() => choose(null)} disabled={busy} accessibilityRole="button">
          <Text style={styles.link}>Remove my goal</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (goal === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Weekly goal</Text>
        {editing ? (
          picker
        ) : (
          <>
            <Text style={styles.hint}>Set a target for how many days you want to train each week. Only you see it.</Text>
            <TouchableOpacity style={styles.primary} onPress={() => setEditing(true)} accessibilityRole="button">
              <Text style={styles.primaryText}>Set a weekly goal</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  const now = new Date();
  const progress = weekProgress(workoutDates, goal, now);
  const streak = weekStreak(workoutDates, goal, now);
  const fraction = Math.min(1, progress.done / goal);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly goal</Text>
        <TouchableOpacity onPress={() => setEditing((value) => !value)} accessibilityRole="button">
          <Text style={styles.link}>{editing ? 'Done' : 'Change'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.big}>
        {progress.done} <Text style={styles.bigOf}>of {goal} {goal === 1 ? 'day' : 'days'} this week</Text>
      </Text>
      <View
        style={styles.track}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: goal, now: Math.min(progress.done, goal) }}
        aria-valuemin={0}
        aria-valuemax={goal}
        aria-valuenow={Math.min(progress.done, goal)}
        aria-label={`${progress.done} of ${goal} days this week`}
      >
        <View style={[styles.fill, progress.complete && styles.fillDone, { width: `${fraction * 100}%` }]} />
      </View>
      <Text style={[styles.message, progress.complete && styles.messageDone]}>{progressMessage(progress)}</Text>
      {streak > 0 ? (
        <Text style={styles.streak}>
          🔥 {streak} {streak === 1 ? 'week' : 'weeks'} in a row
        </Text>
      ) : null}

      {editing ? picker : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  hint: { fontSize: 14, color: '#64748b' },
  link: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  primary: { backgroundColor: '#003262', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#FDB515', fontSize: 16, fontWeight: '700' },
  big: { fontSize: 32, fontWeight: '800', color: '#003262' },
  bigOf: { fontSize: 15, fontWeight: '600', color: '#64748b' },
  track: { height: 12, borderRadius: 6, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6, backgroundColor: '#2563eb' },
  fillDone: { backgroundColor: '#16a34a' },
  message: { fontSize: 14, color: '#475569' },
  messageDone: { color: '#16a34a', fontWeight: '700' },
  streak: { fontSize: 14, fontWeight: '700', color: '#b45309' },
  picker: { gap: 10 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: { backgroundColor: '#003262', borderColor: '#003262' },
  chipText: { fontSize: 16, fontWeight: '700', color: '#475569' },
  chipTextActive: { color: '#FDB515' },
});
