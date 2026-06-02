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

  const { hours: displayHours } = useMemo(
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

  const detailBucket =
    detailHour != null
      ? series.find((x) => x.hour === detailHour)
      : undefined;

  const isToday = selectedDay === todayDow;

  const onTogglePin = (hour: number) => {
    setPinnedHour((p) => (p === hour ? null : hour));
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Peak Hours</Text>
        <View style={styles.skeletonLine} />
        <View style={styles.skeletonLineShort} />
        <View style={styles.skeletonChart} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Peak Hours</Text>
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
        <Text style={styles.title}>Peak Hours</Text>
        <Text style={styles.comingSoonHeadline}>Coming soon</Text>
        <Text style={styles.placeholder}>
          {data.message ??
            "We're logging traffic for each day of the week — the full chart unlocks automatically once every day has data."}
        </Text>
        {data.daysCovered != null ? (
          <View style={styles.progressRow}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round((data.daysCovered / 7) * 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressLabel}>{data.daysCovered}/7 days</Text>
          </View>
        ) : null}
      </View>
    );
  }

  const hasStats =
    selectedDaySummary &&
    (selectedDaySummary.peakHour != null ||
      selectedDaySummary.quietHour != null ||
      selectedDaySummary.dayMeanPercent != null);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>Peak Hours</Text>
        {isToday ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveBadgeText}>Live</Text>
          </View>
        ) : null}
      </View>

      {/* Color legend */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#86efac' }]} />
          <Text style={styles.legendText}>Quiet</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#fcd34d' }]} />
          <Text style={styles.legendText}>Moderate</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#fca5a5' }]} />
          <Text style={styles.legendText}>Busy</Text>
        </View>
      </View>

      {/* Day selector */}
      <View style={styles.dayRow}>
        {SHORT_DAYS.map((label, idx) => {
          const active = selectedDay === idx;
          const isCurrentDay = idx === todayDow;
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
              {isCurrentDay && !active ? (
                <View style={styles.todayDot} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {!data.hasEnoughData ? (
        <Text style={styles.placeholder}>
          {data.message ?? "We're learning your gym's rhythm — check back soon."}
        </Text>
      ) : (
        <>
          {/* Bar chart */}
          <View style={styles.chartWrap}>
            <View
              style={[
                styles.chartInner,
                { width: chartWidth, height: chartHeight },
              ]}
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

            {/* Hour axis labels */}
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

          {/* Tapped / hovered bar detail */}
          {detailHour != null ? (
            <View style={styles.detailPanel}>
              {detailBucket && detailBucket.avgPercent != null ? (
                <>
                  <Text style={styles.detailTime}>
                    {formatHour12(detailHour)}
                  </Text>
                  <View style={styles.detailRight}>
                    <Text
                      style={[
                        styles.detailPercent,
                        { color: barColor(detailBucket.avgPercent) === '#86efac' ? '#16a34a' : barColor(detailBucket.avgPercent) === '#fcd34d' ? '#92400e' : '#dc2626' },
                      ]}
                    >
                      ~{detailBucket.avgPercent}% full
                    </Text>
                    {detailBucket.avgOccupancy != null ? (
                      <Text style={styles.detailPeople}>
                        ~{detailBucket.avgOccupancy} people avg
                      </Text>
                    ) : null}
                  </View>
                </>
              ) : (
                <>
                  <Text style={styles.detailTime}>
                    {formatHour12(detailHour)}
                  </Text>
                  <Text style={styles.detailPeople}>Not enough data yet</Text>
                </>
              )}
            </View>
          ) : null}

          {/* Day stats chips */}
          {hasStats ? (
            <View style={styles.statsRow}>
              {selectedDaySummary!.peakHour != null ? (
                <View style={[styles.statChip, styles.statChipBusy]}>
                  <Text style={styles.statLabel}>Peak</Text>
                  <Text style={styles.statValue}>
                    {formatHourShort(selectedDaySummary!.peakHour)}
                  </Text>
                  <Text style={styles.statSub}>
                    ~{selectedDaySummary!.peakAvgPercent}%
                  </Text>
                </View>
              ) : null}
              {selectedDaySummary!.quietHour != null ? (
                <View style={[styles.statChip, styles.statChipQuiet]}>
                  <Text style={styles.statLabel}>Best time</Text>
                  <Text style={styles.statValue}>
                    {formatHourShort(selectedDaySummary!.quietHour)}
                  </Text>
                  <Text style={styles.statSub}>
                    ~{selectedDaySummary!.quietAvgPercent}%
                  </Text>
                </View>
              ) : null}
              {selectedDaySummary!.dayMeanPercent != null ? (
                <View style={[styles.statChip, styles.statChipNeutral]}>
                  <Text style={styles.statLabel}>Typical avg</Text>
                  <Text style={styles.statValue}>
                    {selectedDaySummary!.dayMeanPercent}%
                  </Text>
                  <Text style={styles.statSub}>full</Text>
                </View>
              ) : null}
            </View>
          ) : null}

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
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#16a34a',
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  dayChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
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
  todayDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#6366f1',
    marginTop: 2,
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
  detailPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  detailTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  detailRight: {
    alignItems: 'flex-end',
  },
  detailPercent: {
    fontSize: 14,
    fontWeight: '700',
  },
  detailPeople: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statChip: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 2,
  },
  statChipBusy: {
    backgroundColor: '#fff1f2',
  },
  statChipQuiet: {
    backgroundColor: '#f0fdf4',
  },
  statChipNeutral: {
    backgroundColor: '#f8fafc',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  statSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
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
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 999,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
  },
  skeletonLine: {
    height: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    width: '70%',
  },
  skeletonLineShort: {
    height: 12,
    backgroundColor: '#e2e8f0',
    borderRadius: 6,
    width: '45%',
  },
  skeletonChart: {
    height: 132,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
  },
});
