import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ProgressChart } from '../components/ProgressChart';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../contexts/AuthContext';
import { useWeightUnit } from '../contexts/ProfileContext';
import { filterRange, type Range } from '../domain/chart';
import { formatExerciseEntry } from '../domain/format';
import type { Session } from '../domain/history';
import { computeRecords, metricsFor, progressSeries, type ProgressMetric, type SetRecord } from '../domain/prs';
import { formatWeightValue, formatWeight } from '../domain/units';
import { getHistory } from '../services/historyCache';
import type { RootStackParamList } from '../types/navigation';
import { getDateFromDateString } from '../utils/workoutFormat';

type Nav = NativeStackNavigationProp<RootStackParamList, 'ExerciseDetail'>;

const RANGES: Range[] = ['3M', '6M', '1Y', 'All'];
const METRIC_LABEL: Record<ProgressMetric, string> = { e1rm: 'Est. 1RM', weight: 'Heaviest', reps: 'Reps' };

function dateLabel(date: string): string {
  return getDateFromDateString(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const ExerciseDetailScreen = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const { key, name } = route.params as { key: string; name: string };
  const { user } = useAuth();
  const unit = useWeightUnit();

  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('6M');
  const [metricChoice, setMetricChoice] = useState<ProgressMetric | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      getHistory(user.id)
        .then(({ index }) => {
          setSessions(index.get(key) ?? []);
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load your history.'));
    }, [user, key]),
  );

  const type = sessions?.[0]?.entry.exercise.type ?? 'weight_reps';
  const metrics = metricsFor(type);
  const metric: ProgressMetric | null = metricChoice && metrics.includes(metricChoice) ? metricChoice : metrics[0] ?? null;

  const records = useMemo(() => (sessions ? computeRecords(sessions) : null), [sessions]);
  const series = useMemo(
    () => (sessions && metric ? progressSeries(sessions, metric) : []),
    [sessions, metric],
  );
  const visible = useMemo(() => filterRange(series, range, Date.now()), [series, range]);

  const formatMetric = useCallback(
    (value: number) => (metric === 'reps' ? String(Math.round(value)) : formatWeightValue(value, unit)),
    [metric, unit],
  );

  if (!sessions) {
    return (
      <ScreenContainer>
        {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator style={styles.spinner} size="large" color="#2563eb" />}
      </ScreenContainer>
    );
  }

  const setText = (record: SetRecord | null) =>
    record && record.kg !== null ? `${formatWeight(record.kg, unit)} × ${record.reps}` : record?.reps ? `${record.reps} reps` : '—';

  const cards: { label: string; value: string; sub?: string }[] = [];
  if (records) {
    if (type === 'weight_reps' || type === 'bodyweight_reps') {
      if (type === 'bodyweight_reps') cards.push({ label: 'Most reps', value: records.mostReps ? String(records.mostReps.reps) : '—', sub: records.mostReps ? dateLabel(records.mostReps.date) : undefined });
      cards.push({ label: type === 'bodyweight_reps' ? 'Heaviest added' : 'Heaviest', value: setText(records.heaviest), sub: records.heaviest ? dateLabel(records.heaviest.date) : undefined });
      if (type === 'weight_reps') cards.push({ label: 'Est. 1RM', value: records.bestE1rm?.e1rm != null ? formatWeight(records.bestE1rm.e1rm, unit) : '—', sub: records.bestE1rm ? `from ${setText(records.bestE1rm)}` : undefined });
      if (type === 'weight_reps') cards.push({ label: 'Best set volume', value: records.bestVolume?.kg != null ? formatWeight(records.bestVolume.kg * (records.bestVolume.reps as number), unit) : '—', sub: records.bestVolume ? setText(records.bestVolume) : undefined });
    }
    cards.push({ label: 'Sessions', value: String(records.sessions), sub: records.lastDate ? `last ${dateLabel(records.lastDate)}` : undefined });
  }

  const summary = metric
    ? `${METRIC_LABEL[metric]}, ${visible.length} sessions${
        visible.length > 0 ? `, from ${formatMetric(visible[0].value)} to ${formatMetric(visible[visible.length - 1].value)}` : ''
      }`
    : '';

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{name}</Text>

        {sessions.length === 0 ? <Text style={styles.empty}>No sessions logged yet.</Text> : null}

        <View style={styles.cards}>
          {cards.map((card) => (
            <View key={card.label} style={styles.card}>
              <Text style={styles.cardLabel}>{card.label}</Text>
              <Text style={styles.cardValue}>{card.value}</Text>
              {card.sub ? <Text style={styles.cardSub}>{card.sub}</Text> : null}
            </View>
          ))}
        </View>

        {metric ? (
          <View style={styles.chartCard}>
            <View style={styles.toggleRow}>
              <View style={styles.segment}>
                {metrics.map((m) => (
                  <TouchableOpacity key={m} style={[styles.segmentItem, metric === m && styles.segmentActive]} onPress={() => setMetricChoice(m)} accessibilityRole="radio" accessibilityState={{ selected: metric === m }}>
                    <Text style={[styles.segmentText, metric === m && styles.segmentTextActive]}>{METRIC_LABEL[m]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.segment}>
                {RANGES.map((r) => (
                  <TouchableOpacity key={r} style={[styles.segmentItem, range === r && styles.segmentActive]} onPress={() => setRange(r)} accessibilityRole="radio" accessibilityState={{ selected: range === r }}>
                    <Text style={[styles.segmentText, range === r && styles.segmentTextActive]}>{r}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {visible.length >= 2 ? (
              <ProgressChart data={visible} formatValue={formatMetric} summary={summary} />
            ) : (
              <Text style={styles.chartEmpty}>
                {series.length < 2
                  ? 'Log this exercise at least twice with weight to see a trend.'
                  : 'Not enough sessions in this range. Try a longer one.'}
              </Text>
            )}
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>History</Text>
        {sessions.slice(0, 60).map((session) => (
          <TouchableOpacity
            key={`${session.workoutId}-${session.createdAt}`}
            style={styles.historyRow}
            onPress={() => navigation.navigate('WorkoutDetail', { workoutId: session.workoutId })}
            accessibilityRole="button"
          >
            <Text style={styles.historyDate}>{dateLabel(session.date)}</Text>
            <Text style={styles.historySets}>{formatExerciseEntry(session.entry, unit)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  spinner: { marginTop: 48 },
  error: { color: '#dc2626', fontSize: 14 },
  content: { paddingBottom: 48, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#0f172a' },
  empty: { color: '#64748b', fontSize: 15 },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { flexGrow: 1, flexBasis: '45%', backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  cardLabel: { fontSize: 12, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardValue: { fontSize: 20, fontWeight: '800', color: '#003262', marginTop: 4 },
  cardSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  chartCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#e2e8f0', gap: 12 },
  toggleRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  segment: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
  segmentItem: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  segmentTextActive: { color: '#2563eb' },
  chartEmpty: { color: '#64748b', fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  historyRow: { backgroundColor: '#fff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 4 },
  historyDate: { fontSize: 13, fontWeight: '700', color: '#475569' },
  historySets: { fontSize: 15, color: '#0f172a' },
});
