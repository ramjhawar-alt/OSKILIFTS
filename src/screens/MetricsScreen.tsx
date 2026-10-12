import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ScreenContainer } from '../components/ScreenContainer';
import { barHeights, percent, sumOf, trend, type AdminMetrics, type DailyPoint } from '../domain/metrics';
import { getAdminMetrics } from '../services/metricsService';
import { colors } from '../theme';

const RANGES = [7, 30, 90] as const;
const TREND_COLORS = { up: '#16a34a', down: '#dc2626', flat: '#64748b', new: '#16a34a' } as const;

const Stat = ({ label, value, note, color }: { label: string; value: string | number; note?: string; color?: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
    {note ? <Text style={[styles.statNote, color ? { color } : null]}>{note}</Text> : null}
  </View>
);

const Bars = ({ title, points, pick, color }: { title: string; points: DailyPoint[]; pick: (p: DailyPoint) => number; color: string }) => {
  const values = points.map(pick);
  const heights = barHeights(values);
  return (
    <View style={styles.chart}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartTotal}>{sumOf(values)} total</Text>
      </View>
      <View style={styles.bars} accessibilityLabel={`${title} per day, ${sumOf(values)} in total`}>
        {heights.map((h, i) => (
          <View key={points[i].day || i} style={styles.barSlot}>
            <View style={[styles.bar, { height: Math.max(2, Math.round(h * 60)), backgroundColor: color, opacity: values[i] > 0 ? 1 : 0.25 }]} />
          </View>
        ))}
      </View>
      {points.length > 0 ? (
        <View style={styles.axis}>
          <Text style={styles.axisText}>{points[0].day.slice(5)}</Text>
          <Text style={styles.axisText}>{points[points.length - 1].day.slice(5)}</Text>
        </View>
      ) : null}
    </View>
  );
};

const FunnelRow = ({ label, count, whole }: { label: string; count: number; whole: number }) => (
  <View style={styles.funnelRow}>
    <View style={styles.funnelText}>
      <Text style={styles.funnelLabel}>{label}</Text>
      <Text style={styles.funnelCount}>
        {count} <Text style={styles.funnelPct}>{percent(count, whole)}</Text>
      </Text>
    </View>
    <View style={styles.funnelTrack}>
      <View style={[styles.funnelFill, { width: `${whole > 0 ? Math.min(100, (count / whole) * 100) : 0}%` }]} />
    </View>
  </View>
);

/** Admin-only: how the app is doing. Counts only, from one database call. */
export const MetricsScreen = () => {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (range: number) => {
    try {
      setMetrics(await getAdminMetrics(range));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(days);
    }, [load, days]),
  );

  const pick = (range: (typeof RANGES)[number]) => {
    if (range === days) return;
    setDays(range);
    setLoading(true);
  };

  const t = metrics ? trend(metrics.totals.active7d, metrics.totals.activePrev7d) : null;

  return (
    <ScreenContainer>
      <View style={styles.segments}>
        {RANGES.map((range) => (
          <TouchableOpacity
            key={range}
            style={[styles.segment, days === range && styles.segmentActive]}
            onPress={() => pick(range)}
            accessibilityRole="tab"
            accessibilityState={{ selected: days === range }}
          >
            <Text style={[styles.segmentText, days === range && styles.segmentTextActive]}>{range} days</Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={styles.spinner} size="large" color={colors.gold} />
      ) : metrics ? (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load(days);
                setRefreshing(false);
              }}
            />
          }
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Now</Text>
            <View style={styles.statRow}>
              <Stat label="Users" value={metrics.totals.users} note={`${metrics.totals.onboarded} picked a username`} />
              <Stat label="Active this week" value={metrics.totals.active7d} note={t?.label} color={t ? TREND_COLORS[t.direction] : undefined} />
            </View>
            <View style={styles.statRow}>
              <Stat label="Workouts logged" value={metrics.totals.workouts} />
              <Stat label="Friendships & follows" value={metrics.totals.follows} />
            </View>
            <View style={styles.statRow}>
              <Stat label="Public accounts" value={metrics.totals.publicAccounts} note={percent(metrics.totals.publicAccounts, metrics.totals.users)} />
              <Stat label="Open reports" value={metrics.totals.openReports} />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>New users: what they did (last {metrics.days} days)</Text>
            <FunnelRow label="Signed up" count={metrics.funnel.signups} whole={metrics.funnel.signups} />
            <FunnelRow label="Picked a username" count={metrics.funnel.onboarded} whole={metrics.funnel.signups} />
            <FunnelRow label="Logged a workout" count={metrics.funnel.loggedWorkout} whole={metrics.funnel.signups} />
            <FunnelRow label="Followed someone" count={metrics.funnel.followedSomeone} whole={metrics.funnel.signups} />
            <FunnelRow label="Trained again a week or more later" count={metrics.funnel.returnedAfterWeek} whole={metrics.funnel.signups} />
            <Text style={styles.note}>The last row needs a week to fill in for recent signups.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Per day</Text>
            <Bars title="Sign-ups" points={metrics.daily} pick={(p) => p.signups} color={colors.gold} />
            <Bars title="Workouts logged" points={metrics.daily} pick={(p) => p.workouts} color={colors.success} />
            <Bars title="People who trained" points={metrics.daily} pick={(p) => p.active} color={colors.gold} />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Invites</Text>
            <View style={styles.statRow}>
              <Stat label={`Joined via a link (${metrics.days} days)`} value={metrics.invites.inPeriod} />
              <Stat label="All time" value={metrics.invites.total} />
            </View>
            {metrics.invites.top.length > 0 ? (
              <View style={styles.top}>
                <Text style={styles.statLabel}>Top inviters</Text>
                {metrics.invites.top.map((entry) => (
                  <Text key={entry.username} style={styles.topRow}>
                    @{entry.username} · {entry.count}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={styles.note}>No one has joined through an invite link yet.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Feature use</Text>
            <View style={styles.statRow}>
              <Stat label="On the leaderboard" value={metrics.adoption.leaderboard} />
              <Stat label="Weekly goals set" value={metrics.adoption.weeklyGoals} />
            </View>
            <View style={styles.statRow}>
              <Stat label="Recap email on" value={metrics.adoption.weeklyRecap} />
              <Stat label="Playing hoops now" value={metrics.adoption.hoopersNow} />
            </View>
            <View style={styles.statRow}>
              <Stat label="Heading to the RSF" value={metrics.adoption.headingNow} />
              <Stat label="At the RSF now" value={metrics.adoption.atRsfNow} />
            </View>
          </View>
        </ScrollView>
      ) : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  spinner: { marginTop: 48 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  content: { paddingBottom: 40, gap: 12 },
  segments: { flexDirection: 'row', backgroundColor: colors.surfaceHi, borderRadius: 10, padding: 4, marginBottom: 12 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: colors.cyan },
  card: { backgroundColor: colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: colors.border, gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  statRow: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 2 },
  statValue: { fontSize: 28, fontWeight: '800', color: colors.gold },
  statLabel: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  statNote: { fontSize: 12, color: colors.textMuted },
  note: { fontSize: 12, color: colors.textFaint },
  funnelRow: { gap: 4 },
  funnelText: { flexDirection: 'row', justifyContent: 'space-between' },
  funnelLabel: { fontSize: 14, color: colors.text, flex: 1, paddingRight: 8 },
  funnelCount: { fontSize: 14, fontWeight: '700', color: colors.text },
  funnelPct: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  funnelTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  funnelFill: { height: 8, borderRadius: 4, backgroundColor: colors.gold },
  chart: { gap: 6 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  chartTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  chartTotal: { fontSize: 12, color: colors.textMuted },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 2 },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  axisText: { fontSize: 10, color: colors.textFaint },
  top: { gap: 4 },
  topRow: { fontSize: 14, color: colors.text, fontWeight: '600' },
});
