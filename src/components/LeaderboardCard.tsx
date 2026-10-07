import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Avatar } from './Avatar';
import { daysLabel, rankRows, weekRangeLabel } from '../domain/leaderboard';
import {
  getLeaderboard,
  joinLeaderboard,
  leaveLeaderboard,
  type LeaderboardState,
} from '../services/leaderboardService';
import { confirmAction, showMessage } from '../utils/alert';

const CONSENT =
  'Friends who have joined will see how many days you trained each week, even if your workouts are Private. They won’t see which workouts, weights, or exercises. You’ll only see the board while you’re on it. You can leave any time.';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/** Friends-only, opt-in: who trained on the most different days this week. */
export const LeaderboardCard = () => {
  const [state, setState] = useState<LeaderboardState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState(await getLeaderboard());
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const join = async () => {
    const confirmed = await confirmAction({
      title: 'Join the weekly leaderboard?',
      message: CONSENT,
      confirmLabel: 'Join',
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      await joinLeaderboard();
      await load();
    } catch (error) {
      showMessage('Couldn’t join', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setBusy(true);
    try {
      await leaveLeaderboard();
      await load();
    } catch (error) {
      showMessage('Couldn’t leave', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Hidden until we know it works (e.g. before the database update is applied).
  if (!loaded || !state) return null;

  const ranked = rankRows(state.rows);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Weekly leaderboard</Text>
        <Text style={styles.week}>{weekRangeLabel(new Date())}</Text>
      </View>

      {!state.joined ? (
        <>
          <Text style={styles.hint}>
            See which of your friends trained the most days this week. Friends only, and only for people who
            join.
          </Text>
          <TouchableOpacity style={styles.primary} onPress={join} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#FDB515" /> : <Text style={styles.primaryText}>Join the leaderboard</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          {ranked.map((row) => (
            <View key={row.id} style={[styles.row, row.isMe && styles.rowMe]}>
              <Text style={styles.rank}>{MEDALS[row.rank] ?? `${row.rank}`}</Text>
              <Avatar name={row.displayName} username={row.username} size={32} />
              <View style={styles.rowText}>
                <Text style={styles.name} numberOfLines={1}>
                  {row.isMe ? 'You' : row.displayName || row.username}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  @{row.username}
                </Text>
              </View>
              <Text style={styles.days}>{daysLabel(row.days)}</Text>
            </View>
          ))}
          {ranked.length <= 1 ? (
            <Text style={styles.hint}>
              None of your friends have joined yet. Friends are people you follow who follow you back.
            </Text>
          ) : null}
          <TouchableOpacity onPress={leave} disabled={busy} accessibilityRole="button" style={styles.leave}>
            <Text style={styles.leaveText}>Leave the leaderboard</Text>
          </TouchableOpacity>
        </>
      )}
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
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  week: { fontSize: 13, color: '#64748b' },
  hint: { fontSize: 14, color: '#64748b' },
  primary: { backgroundColor: '#003262', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#FDB515', fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 8, borderRadius: 10 },
  rowMe: { backgroundColor: '#eff6ff' },
  rank: { width: 28, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#475569' },
  rowText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 12, color: '#64748b' },
  days: { fontSize: 15, fontWeight: '700', color: '#003262' },
  leave: { alignSelf: 'flex-start', paddingVertical: 6 },
  leaveText: { color: '#64748b', fontSize: 13, fontWeight: '600' },
});
