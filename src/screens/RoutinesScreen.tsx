import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { NameRoutineModal } from '../components/NameRoutineModal';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../contexts/AuthContext';
import type { Routine } from '../domain/routines';
import {
  RoutinesUnavailableError,
  deleteRoutine,
  listRoutines,
  renameRoutine,
} from '../services/routineService';
import { confirmDiscardDraftIfAny } from '../services/startWorkout';
import type { RootStackParamList } from '../types/navigation';
import { confirmAction, showMessage } from '../utils/alert';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Routines'>;

function summarize(routine: Routine): string {
  const names = routine.entries.slice(0, 3).map((e) => e.exercise.name);
  const more = routine.entries.length - names.length;
  return names.join(', ') + (more > 0 ? ` +${more} more` : '');
}

export const RoutinesScreen = () => {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Routine | null>(null);

  const load = useCallback(async () => {
    try {
      setRoutines(await listRoutines());
      setError(null);
    } catch (err) {
      setError(err instanceof RoutinesUnavailableError ? err.message : err instanceof Error ? err.message : 'Unable to load routines.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const start = useCallback(
    async (routine: Routine) => {
      if (!(await confirmDiscardDraftIfAny(user?.id ?? ''))) return;
      navigation.navigate('LogWorkout', { routineId: routine.id });
    },
    [navigation, user],
  );

  const remove = useCallback(async (routine: Routine) => {
    const confirmed = await confirmAction({
      title: `Delete “${routine.name}”?`,
      message: 'Workouts you already logged are not affected.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteRoutine(routine.id);
      setRoutines((current) => current.filter((r) => r.id !== routine.id));
    } catch (err) {
      showMessage('Error', err instanceof Error ? err.message : 'Unable to delete.');
    }
  }, []);

  const rename = useCallback(
    async (name: string) => {
      if (!renaming) return;
      try {
        await renameRoutine(renaming.id, name);
        setRenaming(null);
        await load();
      } catch (err) {
        showMessage('Couldn’t rename', err instanceof Error ? err.message : 'Please try again.');
      }
    },
    [renaming, load],
  );

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.spinner} size="large" color="#2563eb" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardText}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.summary}>{summarize(item)}</Text>
              <Text style={styles.meta}>
                {item.entries.length} exercise{item.entries.length === 1 ? '' : 's'}
                {item.dayType ? ` · ${item.dayType.name}` : ''}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity style={styles.start} onPress={() => start(item)} accessibilityRole="button">
                <Text style={styles.startText}>Start</Text>
              </TouchableOpacity>
              <View style={styles.secondary}>
                <TouchableOpacity onPress={() => setRenaming(item)} accessibilityRole="button">
                  <Text style={styles.link}>Rename</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(item)} accessibilityRole="button">
                  <Text style={styles.delete}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          error ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No routines yet</Text>
              <Text style={styles.emptyText}>
                Finish a workout, then tap “Save as routine” on it. You can also save one while you’re logging.
                Routines remember your exercises and set types; weights come from what you lifted last time.
              </Text>
            </View>
          )
        }
      />
      <NameRoutineModal
        visible={renaming !== null}
        title="Rename routine"
        initialName={renaming?.name}
        confirmLabel="Rename"
        onClose={() => setRenaming(null)}
        onSave={rename}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  spinner: { marginTop: 48 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    gap: 12,
  },
  cardText: { flex: 1, gap: 2 },
  name: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  summary: { fontSize: 14, color: '#475569' },
  meta: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  actions: { alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  start: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 18 },
  startText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  secondary: { flexDirection: 'row', gap: 12 },
  link: { color: '#2563eb', fontSize: 13, fontWeight: '600' },
  delete: { color: '#dc2626', fontSize: 13, fontWeight: '600' },
  empty: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
});
