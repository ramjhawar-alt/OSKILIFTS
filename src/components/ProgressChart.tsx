import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { buildChartModel } from '../domain/chart';
import type { ProgressPoint } from '../domain/prs';

const HEIGHT = 220;
const FONT = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});
const PADDING = { left: 48, right: 14, top: 14, bottom: 28 };
const HIT = 36;

function shortDate(time: number): string {
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export const ProgressChart = ({
  data,
  formatValue,
  formatTick,
  summary,
}: {
  /** Values already in the viewer's display unit, so axis ticks land on round numbers. */
  data: ProgressPoint[];
  /** Full text for tooltips and screen readers, e.g. "215.5 lb". */
  formatValue: (value: number) => string;
  /** Compact text for axis labels, e.g. "215.5". */
  formatTick: (value: number) => string;
  /** Spoken summary for screen readers, e.g. "Estimated 1RM, 12 sessions, 185 to 225 lb". */
  summary: string;
}) => {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);

  const model = useMemo(() => buildChartModel(data, width, HEIGHT, PADDING), [data, width]);
  const shown = pinned ?? active;
  const tip = shown !== null ? model.points[shown] : null;

  return (
    <View
      style={styles.wrap}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessible
      accessibilityLabel={summary}
    >
      {width > 0 ? (
        <>
          <Svg width={width} height={HEIGHT}>
            {model.yTicks.map((tick) => (
              <React.Fragment key={tick.value}>
                <Line x1={PADDING.left} x2={width - PADDING.right} y1={tick.y} y2={tick.y} stroke="#e2e8f0" strokeWidth={1} />
                <SvgText x={PADDING.left - 6} y={tick.y + 4} fontSize={11} fontFamily={FONT} fill="#64748b" textAnchor="end">
                  {formatTick(tick.value)}
                </SvgText>
              </React.Fragment>
            ))}
            {model.xLabels.map((label, i) => (
              <SvgText
                key={label.time}
                x={label.x}
                y={HEIGHT - 8}
                fontSize={11}
                fontFamily={FONT}
                fill="#64748b"
                textAnchor={i === 0 && model.xLabels.length > 1 ? 'start' : i === model.xLabels.length - 1 && model.xLabels.length > 1 ? 'end' : 'middle'}
              >
                {shortDate(label.time)}
              </SvgText>
            ))}
            {model.points.length > 1 ? (
              <Polyline
                points={model.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#2563eb"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ) : null}
            {model.points.map((p, i) => (
              <Circle
                key={p.source.date}
                cx={p.x}
                cy={p.y}
                r={shown === i ? 7 : p.source.isRecord ? 6 : 4.5}
                fill={p.source.isRecord ? '#f59e0b' : '#2563eb'}
                stroke="#ffffff"
                strokeWidth={2}
              />
            ))}
          </Svg>

          {model.points.map((p, i) => (
            <Pressable
              key={p.source.date}
              style={[styles.hit, { left: p.x - HIT / 2, top: p.y - HIT / 2 }]}
              onHoverIn={() => setActive(i)}
              onHoverOut={() => setActive(null)}
              onPress={() => setPinned((current) => (current === i ? null : i))}
              accessibilityRole="button"
              accessibilityLabel={`${shortDate(p.source.time)}: ${formatValue(p.source.value)}${p.source.isRecord ? ', personal record' : ''}`}
            />
          ))}

          {tip ? (
            <View
              pointerEvents="none"
              style={[styles.tooltip, { left: Math.min(Math.max(tip.x - 56, 4), width - 116), top: Math.max(tip.y - 52, 0) }]}
            >
              <Text style={styles.tooltipValue}>{formatValue(tip.source.value)}</Text>
              <Text style={styles.tooltipDate}>
                {shortDate(tip.source.time)}
                {tip.source.isRecord ? ' · PR' : ''}
              </Text>
            </View>
          ) : null}
        </>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%', height: HEIGHT },
  hit: { position: 'absolute', width: HIT, height: HIT, borderRadius: HIT / 2 },
  tooltip: {
    position: 'absolute',
    width: 112,
    backgroundColor: '#0f172a',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tooltipValue: { color: '#fff', fontSize: 14, fontWeight: '700' },
  tooltipDate: { color: '#cbd5e1', fontSize: 11, marginTop: 1 },
});
