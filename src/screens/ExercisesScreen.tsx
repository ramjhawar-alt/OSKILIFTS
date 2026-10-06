import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AuthInput } from '../components/AuthForm';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../contexts/AuthContext';
import { useWeightUnit } from '../contexts/ProfileContext';
import type { HistoryIndex } from '../domain/history';
import { computeRecords } from '../domain/prs';
import { formatWeight } from '../domain/units';
import { getHistory } from '../services/historyCache';
import type { RootStackParamList } from '../types/navigation';
import { getDateFromDateString } from '../utils/workoutFormat';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Exercises'>;

interface Row {
  key: string;
  name: string;
  lastDate: string;
  sessions: number;
  best: string | null;
}

export const ExercisesScreen = () => {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const unit = useWeightUnit();
  const [index, setIndex] = useState<HistoryIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getHistory(user.id)
        .then(({ index: loaded }) => {
          setIndex(loaded);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load your history.'))
        .finally(() => setLoading(false));
    }, [user]),
  );

  const rows = useMemo<Row[]>(() => {
    if (!index) return [];
    const result: Row[] = [];
    for (const [key, sessions] of index) {
      const records = computeRecords(sessions);
      const best = records.bestE1rm?.kg ?? records.heaviest?.kg ?? null;
      result.push({
        key,
        name: sessions[0].entry.exercise.name,
        lastDate: sessions[0].date,
        sessions: sessions.length,
        best:
          records.mostReps && !records.heaviest
            ? `${records.mostReps.reps} reps`
            : best !== null
              ? formatWeight(records.heaviest?.kg ?? best, unit)
              : null,
      });
    }
    result.sort((a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : a.name.localeCompare(b.name)));
    return result;
  }, [index, unit]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((row) => row.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.spinner} size="large" color="#2563eb" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AuthInput placeholder="Search your exercises" value={query} onChangeText={setQuery} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        style={styles.list}
        data={filtered}
        keyExtractor={(row) => row.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ExerciseDetail', { key: item.key, name: item.name })}
            accessibilityRole="button"
          >
            <View style={styles.rowText}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.sessions} session{item.sessions === 1 ? '' : 's'} · last{' '}
                {getDateFromDateString(item.lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            </View>
            {item.best ? <Text style={styles.best}>{item.best}</Text> : null}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {rows.length === 0 ? 'Log a workout to see your progress here.' : 'No exercises match.'}
          </Text>
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  spinner: { marginTop: 48 },
  list: { marginTop: 12 },
  error: { color: '#dc2626', fontSize: 14, marginTop: 8 },
  empty: { color: '#64748b', fontSize: 15, textAlign: 'center', marginTop: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  rowText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  meta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  best: { fontSize: 15, fontWeight: '700', color: '#003262' },
});
