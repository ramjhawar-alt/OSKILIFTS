import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import {
  getOperatingHoursForDay,
  pickHourTicks,
} from '../data/rsfWeightRoomHours';
import type { HourBucket, PeakHoursData } from '../services/peakHoursService';

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

function confidenceLabel(
  c: string | null | undefined,
): string | null {
  if (!c) return null;
  if (c === 'low') return 'Lower confidence (fewer samples in this hour)';
  if (c === 'medium') return 'Moderate confidence';
  return 'Higher confidence';
}

function barColor(avgPercent: number | null): string {
  if (avgPercent == null) return '#e2e8f0';
  if (avgPercent < 35) return '#86efac';
  if (avgPercent <= 65) return '#fcd34d';
  return '#fca5a5';
}

function barFillOpacity(confidence: string | null | undefined): number {
  if (confidence === 'low') return 0.55;
  if (confidence === 'medium') return 0.82;
  return 1;
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

type BarHitProps = {
  hour: number;
  width: number;
  height: number;
  marginRight: number;
  onHover: (hour: number | null) => void;
  onTogglePin: (hour: number) => void;
};

function BarHitTarget({
  hour,
  width,
  height,
  marginRight,
  onHover,
  onTogglePin,
}: BarHitProps) {
  const webHandlers =
    Platform.OS === 'web'
      ? ({
          onMouseEnter: () => onHover(hour),
          onMouseLeave: () => onHover(null),
        } as Record<string, unknown>)
      : {};

  return (
    <Pressable
      accessibilityLabel={`${formatHour12(hour)} occupancy`}
      onHoverIn={() => onHover(hour)}
      onHoverOut={() => onHover(null)}
      onPress={() => onTogglePin(hour)}
      {...webHandlers}
      style={[
        {
          width,
          height,
          marginRight,
          zIndex: 2,
        },
        Platform.OS === 'web' ? ({ cursor: 'crosshair' } as const) : null,
      ]}
    />
  );
}

type Props = {
  data: PeakHoursData | null;
  loading: boolean;
};

export function PeakHoursChart({ data, loading }: Props) {
  const [selectedDay, setSelectedDay] = useState(0);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [pinnedHour, setPinnedHour] = useState<number | null>(null);

  const screenW = Dimensions.get('window').width;
  const chartWidth = Math.max(280, screenW - 56);
  const chartHeight = 132;
  const gap = 2;

  useEffect(() => {
    if (data?.today != null) {
      setSelectedDay(data.today);
    }
  }, [data?.today]);

  useEffect(() => {
    setHoveredHour(null);
    setPinnedHour(null);
  }, [selectedDay]);

  const { hours: displayHours, label: hoursLabel } = useMemo(
    () => getOperatingHoursForDay(selectedDay),
    [selectedDay],
  );

  const barW =
    displayHours.length > 0
      ? (chartWidth - gap * (displayHours.length - 1)) / displayHours.length
      : 0;

  const series: HourBucket[] = useMemo(() => {
    if (!data?.byDay) return [];
    return data.byDay[String(selectedDay)] ?? [];
  }, [data?.byDay, selectedDay]);

  const selectedDaySummary = data?.perDaySummary?.[String(selectedDay)];

  const todayDow = data?.today ?? 0;

  const defaultDetailHour = useMemo(() => {
    if (!displayHours.length) return null;
    if (
      selectedDay === todayDow &&
      data?.currentHour != null &&
      displayHours.includes(data.currentHour)
    ) {
      return data.currentHour;
    }
    const peak = selectedDaySummary?.peakHour;
    if (peak != null && displayHours.includes(peak)) return peak;
    return displayHours[Math.floor(displayHours.length / 2)] ?? null;
  }, [
    displayHours,
    selectedDay,
    todayDow,
    data?.currentHour,
    selectedDaySummary?.peakHour,
  ]);

  const detailHour =
    hoveredHour ?? pinnedHour ?? defaultDetailHour ?? null;

  const showNowMarker =
    selectedDay === todayDow &&
    data?.hasEnoughData &&
    data.currentHour != null &&
    displayHours.includes(data.currentHour);

  const nowIndex = showNowMarker
    ? displayHours.indexOf(data!.currentHour!)
    : -1;
  const nowX =
    nowIndex >= 0
      ? nowIndex * (barW + gap) + barW / 2
      : -1;

  const tickHours = useMemo(
    () => pickHourTicks(displayHours),
    [displayHours],
  );

  const footerSamples = data?.totalSamples ?? 0;
  const oldestLabel = data?.dataRange?.oldest
    ? new Date(data.dataRange.oldest).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const detailBucket =
    detailHour != null
      ? series.find((x) => x.hour === detailHour)
      : undefined;

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

  const onTogglePin = (hour: number) => {
    setPinnedHour((p) => (p === hour ? null : hour));
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Peak hours</Text>
      <Text style={styles.lead}>
        Historical occupancy from snapshots — compare a typical weekday to what
        is happening live when you select today.
      </Text>

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

      {selectedDay === todayDow && rec && data.hasEnoughData ? (
        <View style={styles.liveBlock}>
          <Text style={styles.sectionLabel}>Live</Text>
          <Text style={styles.liveContext}>
            {FULL_DAYS[todayDow]} · {formatHour12(data.currentHour ?? 0)}{' '}
            Pacific
            {data.currentPercent != null
              ? ` · ~${data.currentPercent}% full (recent / typical)`
              : ''}
          </Text>
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
                Try around {formatHour12(rec.suggestedHour)}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {selectedDay !== todayDow ? (
        <View style={styles.recBannerMuted}>
          <Text style={styles.recHeadlineMuted}>
            Typical {FULL_DAYS[selectedDay]}
          </Text>
          <Text style={styles.recDetailMuted}>
            Select the {SHORT_DAYS[todayDow]} chip to open the Live section for
            today ({FULL_DAYS[todayDow]}). Everything below summarizes
            historical patterns for {FULL_DAYS[selectedDay]} only.
          </Text>
        </View>
      ) : null}

      {!data.hasEnoughData ? (
        <Text style={styles.placeholder}>
          {data.message ??
            "We're learning your gym's rhythm — check back soon."}
        </Text>
      ) : (
        <>
          <Text style={styles.sectionLabel}>
            Typical {FULL_DAYS[selectedDay]}
          </Text>
          <Text style={styles.hoursNote}>RSF weight room: {hoursLabel}</Text>
          <Text style={styles.barsExplainer}>
            One bar per clock hour while open. Axis ticks are spaced for
            readability; hover or tap a bar for the full breakdown.
          </Text>

          <View style={styles.chartWrap}>
            <View
              style={[styles.chartInner, { width: chartWidth, height: chartHeight }]}
            >
              <Svg
                pointerEvents="none"
                width={chartWidth}
                height={chartHeight}
                style={styles.chartSvg}
              >
                {displayHours.map((hour, i) => {
                  const bucket = series.find((b) => b.hour === hour);
                  const pct = bucket?.avgPercent;
                  const h =
                    pct != null
                      ? Math.max(4, (pct / 100) * (chartHeight - 8))
                      : 4;
                  const x = i * (barW + gap);
                  const y = chartHeight - h;
                  const active = detailHour === hour;
                  const fo = barFillOpacity(bucket?.confidence);
                  return (
                    <Rect
                      key={hour}
                      x={x}
                      y={y}
                      width={barW}
                      height={h}
                      rx={3}
                      fill={barColor(pct ?? null)}
                      fillOpacity={fo}
                      stroke={active ? '#6366f1' : 'transparent'}
                      strokeWidth={active ? 2 : 0}
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
              <View
                pointerEvents="box-none"
                style={[
                  StyleSheet.absoluteFillObject,
                  styles.hitLayer,
                  { flexDirection: 'row' },
                ]}
              >
                {displayHours.map((hour, i) => (
                  <BarHitTarget
                    key={`hit-${hour}`}
                    hour={hour}
                    width={barW}
                    height={chartHeight}
                    marginRight={i < displayHours.length - 1 ? gap : 0}
                    onHover={setHoveredHour}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </View>
            </View>

            <View style={styles.detailPanel}>
              <Text style={styles.detailTitle}>Selected hour</Text>
              {detailBucket && detailBucket.avgPercent != null ? (
                <>
                  <Text style={styles.detailMain}>
                    {formatHour12(detailHour!)} — ~{detailBucket.avgPercent}%
                    full
                  </Text>
                  {detailBucket.avgOccupancy != null ? (
                    <Text style={styles.detailLine}>
                      ~{detailBucket.avgOccupancy} people on average
                      {detailBucket.avgCapacity != null
                        ? ` (capacity ~${detailBucket.avgCapacity})`
                        : ''}
                    </Text>
                  ) : null}
                  {detailBucket.sampleCount != null ? (
                    <Text style={styles.detailLine}>
                      Based on {detailBucket.sampleCount} snapshot
                      {detailBucket.sampleCount === 1 ? '' : 's'} in this
                      (day, hour) cell
                    </Text>
                  ) : null}
                  {confidenceLabel(detailBucket.confidence) ? (
                    <Text style={styles.detailMuted}>
                      {confidenceLabel(detailBucket.confidence)}
                    </Text>
                  ) : null}
                  {detailBucket.weekPercentile != null ? (
                    <Text style={styles.detailLine}>
                      Week rank: busier than ~{detailBucket.weekPercentile}% of
                      open-hour slots in this dataset (0 = quietest, 100 =
                      busiest).
                    </Text>
                  ) : null}
                </>
              ) : detailHour != null ? (
                <Text style={styles.detailMuted}>
                  {formatHour12(detailHour)} — not enough samples in this cell
                  yet.
                </Text>
              ) : (
                <Text style={styles.detailMuted}>Select a bar to inspect.</Text>
              )}
            </View>

            <Text style={styles.hoverHint}>
              Hover (web) or tap a bar to pin. Dashed line: current time when
              viewing today.
            </Text>

            <View
              style={[
                styles.hourLabels,
                { width: chartWidth, maxWidth: chartWidth },
              ]}
            >
              {tickHours.map((hour) => (
                <Text key={hour} style={styles.hourTick}>
                  {formatHourShort(hour)}
                </Text>
              ))}
            </View>
          </View>

          {selectedDaySummary &&
          (selectedDaySummary.peakHour != null ||
            selectedDaySummary.quietHour != null) ? (
            <View style={styles.summaryRow}>
              {selectedDaySummary.peakHour != null ? (
                <Text style={styles.summaryText}>
                  {FULL_DAYS[selectedDay]} peaks around{' '}
                  {formatHour12(selectedDaySummary.peakHour)} (~
                  {selectedDaySummary.peakAvgPercent}% full
                  {selectedDaySummary.peakAvgOccupancy != null
                    ? `, ~${selectedDaySummary.peakAvgOccupancy} people avg`
                    : ''}
                  ).
                </Text>
              ) : null}
              {selectedDaySummary.quietHour != null ? (
                <Text style={styles.summaryText}>
                  Quietest hour: {formatHour12(selectedDaySummary.quietHour)}{' '}
                  (~{selectedDaySummary.quietAvgPercent}% full
                  {selectedDaySummary.quietAvgOccupancy != null
                    ? `, ~${selectedDaySummary.quietAvgOccupancy} people avg`
                    : ''}
                  ).
                </Text>
              ) : null}
              {selectedDaySummary.dayMeanPercent != null ? (
                <Text style={styles.summaryText}>
                  Day mean (open hours with data): ~{' '}
                  {selectedDaySummary.dayMeanPercent}% full
                </Text>
              ) : null}
              <Text style={styles.summaryFootnote}>
                Coverage: {selectedDaySummary.hoursWithData} /{' '}
                {selectedDaySummary.hoursOpen} open hours with enough samples ·{' '}
                {selectedDaySummary.daySampleCount.toLocaleString()} row
                snapshots for this weekday
              </Text>
              {data.busiestDay ? (
                <Text style={styles.summaryFootnote}>
                  Whole-week context: {data.busiestDay} is busiest on average
                  across all days in the dataset.
                </Text>
              ) : null}
            </View>
          ) : null}

          {data.insights && data.insights.length > 0 ? (
            <View style={styles.insightsSection}>
              <Text style={styles.sectionLabel}>What the data suggests</Text>
              {data.insights.map((line, i) => (
                <Text key={i} style={styles.insightBullet}>
                  • {line}
                </Text>
              ))}
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
    marginBottom: 6,
  },
  lead: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 19,
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 4,
  },
  liveBlock: {
    marginBottom: 14,
  },
  liveContext: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  hoursNote: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: '500',
  },
  barsExplainer: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 12,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  recBanner: {
    borderLeftWidth: 4,
    padding: 12,
    borderRadius: 12,
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
  recBannerMuted: {
    borderLeftWidth: 4,
    borderLeftColor: '#cbd5e1',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: '#f8fafc',
  },
  recHeadlineMuted: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  recDetailMuted: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
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
  chartInner: {
    position: 'relative',
  },
  chartSvg: {
    zIndex: 0,
  },
  hitLayer: {
    zIndex: 1,
  },
  detailPanel: {
    marginTop: 12,
    alignSelf: 'stretch',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  detailMain: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  detailLine: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 19,
    marginBottom: 4,
  },
  detailMuted: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 17,
    marginTop: 4,
    fontStyle: 'italic',
  },
  hoverHint: {
    marginTop: 8,
    fontSize: 11,
    color: '#94a3b8',
    alignSelf: 'stretch',
    textAlign: 'center',
  },
  hourLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: 6,
  },
  hourTick: {
    fontSize: 10,
    color: '#94a3b8',
  },
  insightsSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  insightBullet: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginBottom: 8,
  },
  summaryRow: {
    marginTop: 14,
    gap: 6,
  },
  summaryText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
  },
  summaryFootnote: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
    fontStyle: 'italic',
    lineHeight: 17,
  },
  footer: {
    marginTop: 12,
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
