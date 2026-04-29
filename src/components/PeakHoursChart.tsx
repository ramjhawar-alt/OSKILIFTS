import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import type { HourBucket, PeakHoursData } from '../services/peakHoursService';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

const SHORT_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const FULL_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function barColor(avgPercent: number | null): string {
  if (avgPercent == null) return '#e2e8f0';
  if (avgPercent < 35) return '#86efac';
  if (avgPercent <= 65) return '#fcd34d';
  return '#fca5a5';
}

function verdictStyles(verdict: string | undefined) {
  switch (verdict) {
    case 'best_now':
      return { bg: '#f3e8ff', border: '#9333ea', accent: '#7c3aed' };
    case 'go_now':
      return { bg: '#ecfdf5', border: '#16a34a', accent: '#15803d' };
    case 'wait':
      return { bg: '#fef2f2', border: '#dc2626', accent: '#b91c1c' };
    case 'closed':
      return { bg: '#f8fafc', border: '#64748b', accent: '#475569' };
    default:
      return { bg: '#f8fafc', border: '#94a3b8', accent: '#475569' };
  }
}

type Props = {
  data: PeakHoursData | null;
  loading: boolean;
};

export function PeakHoursChart({ data, loading }: Props) {
  const [selectedDay, setSelectedDay] = useState(0);

  const screenW = Dimensions.get('window').width;
  const chartWidth = Math.max(280, screenW - 56);
  const chartHeight = 132;
  const gap = 2;
  const barW = (chartWidth - gap * (HOURS.length - 1)) / HOURS.length;

  useEffect(() => {
    if (data?.today != null) {
      setSelectedDay(data.today);
    }
  }, [data?.today]);

  const series: HourBucket[] = useMemo(() => {
    if (!data?.byDay) return [];
    return data.byDay[String(selectedDay)] ?? [];
  }, [data?.byDay, selectedDay]);

  const todayDow = data?.today ?? 0;
  const showNowMarker =
    selectedDay === todayDow &&
    data?.hasEnoughData &&
    data.currentHour != null &&
    data.currentHour >= 6 &&
    data.currentHour <= 23;

  const nowIndex = showNowMarker ? data!.currentHour! - 6 : -1;
  const nowX =
    nowIndex >= 0
      ? nowIndex * (barW + gap) + barW / 2
      : -1;

  const footerSamples = data?.totalSamples ?? 0;
  const oldestLabel = data?.dataRange?.oldest
    ? new Date(data.dataRange.oldest).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Peak hours</Text>
        <View style={styles.skeletonLine} />
        <View style={styles.skeletonLineShort} />
        <View style={styles.skeletonChart} />
        <Text style={styles.footerMuted}>Loading patterns…</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Peak hours</Text>
        <Text style={styles.placeholder}>No data yet.</Text>
      </View>
    );
  }

  const chartUnlocked =
    data.peakHoursReady === true ||
    (data.peakHoursReady === undefined && data.hasEnoughData);

  if (!chartUnlocked) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Peak hours</Text>
        <Text style={styles.comingSoonHeadline}>Peak hours coming soon</Text>
        <Text style={styles.placeholder}>
          {data.message ??
            "We're logging traffic for each day of the week. Once we have at least one snapshot on every weekday, the full chart appears here automatically."}
        </Text>
        {data.totalSamples != null ? (
          <Text style={styles.footer}>
            {data.totalSamples.toLocaleString()} snapshot
            {data.totalSamples === 1 ? '' : 's'} collected so far.
          </Text>
        ) : null}
        {data.daysCovered != null && data.daysCovered < 7 ? (
          <Text style={styles.footerMuted}>
            Weekday coverage: {data.daysCovered}/7
          </Text>
        ) : null}
      </View>
    );
  }

  const rec = data.recommendation;
  const vs = verdictStyles(rec?.verdict);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Peak hours</Text>
      <Text style={styles.subtitle}>
        Typical foot traffic on {FULL_DAYS[selectedDay] ?? 'this day'}
      </Text>

      {rec ? (
        <View
          style={[
            styles.recBanner,
            { backgroundColor: vs.bg, borderLeftColor: vs.border },
          ]}
        >
          <Text style={[styles.recHeadline, { color: vs.accent }]}>
            {rec.headline}
          </Text>
          <Text style={styles.recDetail}>{rec.detail}</Text>
          {rec.verdict === 'wait' && rec.suggestedHour != null ? (
            <Text style={styles.recHint}>
              Try around{' '}
              {formatHour12(rec.suggestedHour)}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!data.hasEnoughData ? (
        <Text style={styles.placeholder}>
          {data.message ??
            "We're learning your gym's rhythm — check back soon."}
        </Text>
      ) : (
        <>
          <View style={styles.dayRow}>
            {SHORT_DAYS.map((label, idx) => {
              const active = selectedDay === idx;
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => setSelectedDay(idx)}
                  style={[styles.dayChip, active && styles.dayChipActive]}
                >
                  <Text
                    style={[styles.dayChipText, active && styles.dayChipTextActive]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.chartWrap}>
            <Svg width={chartWidth} height={chartHeight}>
              {HOURS.map((hour, i) => {
                const bucket = series.find((b) => b.hour === hour);
                const pct = bucket?.avgPercent;
                const h =
                  pct != null ? Math.max(4, (pct / 100) * (chartHeight - 8)) : 4;
                const x = i * (barW + gap);
                const y = chartHeight - h;
                return (
                  <Rect
                    key={hour}
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={3}
                    fill={barColor(pct ?? null)}
                  />
                );
              })}
              {nowIndex >= 0 && nowX >= 0 ? (
                <Line
                  x1={nowX}
                  y1={4}
                  x2={nowX}
                  y2={chartHeight - 2}
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />
              ) : null}
            </Svg>
            <View style={styles.hourLabels}>
              {HOURS.filter((_, i) => i % 3 === 0).map((hour) => (
                <Text key={hour} style={styles.hourTick}>
                  {formatHourShort(hour)}
                </Text>
              ))}
            </View>
          </View>

          {data.busiestText || data.bestTimeText ? (
            <View style={styles.summaryRow}>
              {data.busiestText ? (
                <Text style={styles.summaryText}>Busy: {data.busiestText}</Text>
              ) : null}
              {data.bestTimeText ? (
                <Text style={styles.summaryText}>Quiet: {data.bestTimeText}</Text>
              ) : null}
              {data.busiestDay ? (
                <Text style={styles.summaryText}>
                  Busiest day: {data.busiestDay}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Text style={styles.footer}>
            Based on {footerSamples.toLocaleString()} snapshot
            {footerSamples === 1 ? '' : 's'}
            {oldestLabel ? ` since ${oldestLabel}` : ''}.
          </Text>
        </>
      )}
    </View>
  );
}

function formatHour12(hour: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:00 ${period}`;
}

function formatHourShort(hour: number): string {
  const period = hour >= 12 ? 'p' : 'a';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}${period}`;
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  recBanner: {
    borderLeftWidth: 4,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  recHeadline: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  recDetail: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  recHint: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    marginRight: 6,
    marginBottom: 6,
  },
  dayChipActive: {
    backgroundColor: '#0f172a',
  },
  dayChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  dayChipTextActive: {
    color: '#fff',
  },
  chartWrap: {
    alignItems: 'center',
  },
  hourLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
    marginTop: 6,
  },
  hourTick: {
    fontSize: 10,
    color: '#94a3b8',
  },
  summaryRow: {
    marginTop: 12,
    gap: 4,
  },
  summaryText: {
    fontSize: 13,
    color: '#475569',
  },
  footer: {
    marginTop: 10,
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  footerMuted: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
  },
  placeholder: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  comingSoonHeadline: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  skeletonLine: {
    height: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    marginBottom: 8,
    width: '70%',
  },
  skeletonLineShort: {
    height: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    marginBottom: 16,
    width: '45%',
  },
  skeletonChart: {
    height: 132,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
});
