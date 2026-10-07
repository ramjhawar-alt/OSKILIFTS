import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH, type ShareCardModel } from '../domain/shareCard';
import { getBearStageName } from '../services/bearStreakService';
import { OskiBearLiftingSVG } from './OskiBearLiftingSVG';

const BLUE = '#003262';
const BLUE_LIGHT = '#0b4a85';
const GOLD = '#FDB515';

/**
 * The image people post to Instagram: drawn at its real 1080x1920 size, then
 * captured to a PNG. Plain views and text only, so it renders the same on web
 * and native.
 */
export const ShareCard = forwardRef<View, { model: ShareCardModel }>(({ model }, ref) => (
  <View ref={ref} collapsable={false} style={styles.card}>
    <View style={styles.topRow}>
      <Text style={styles.brand}>OSKILIFTS</Text>
      <Text style={styles.date}>{model.dateLabel}</Text>
    </View>

    <View style={styles.bearPanel}>
      {/* The scene scales to its parent, so give it a box with its 1.6:1 shape. */}
      <View style={styles.bearScene}>
        <OskiBearLiftingSVG size={1} stage={model.bearStage} />
      </View>
      <Text style={styles.bearName}>{getBearStageName(model.bearStage)}</Text>
    </View>

    <View style={styles.titleBlock}>
      <Text style={styles.title} numberOfLines={1}>
        {model.title}
      </Text>
      {model.handle ? <Text style={styles.handle}>{model.handle}</Text> : null}
    </View>

    <View style={styles.lines}>
      {model.lines.map((line, index) => (
        <View key={`${line.name}-${index}`} style={styles.lineRow}>
          <View style={styles.lineName}>
            <Text style={styles.exercise} numberOfLines={1}>
              {line.name}
            </Text>
            {line.pr ? (
              <View style={styles.prPill}>
                <Text style={styles.prText}>PR</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.detail} numberOfLines={1}>
            {line.detail}
          </Text>
        </View>
      ))}
      {model.moreCount > 0 ? <Text style={styles.more}>+ {model.moreCount} more</Text> : null}
    </View>

    <View style={styles.stats}>
      {model.stats.map((stat) => (
        <View key={stat.label} style={styles.stat}>
          <Text style={styles.statValue} numberOfLines={1}>
            {stat.value}
          </Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            {stat.label}
          </Text>
        </View>
      ))}
    </View>

    <Text style={styles.footer}>oskilifts.com · built for Berkeley</Text>
  </View>
));
ShareCard.displayName = 'ShareCard';

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_WIDTH,
    height: SHARE_CARD_HEIGHT,
    backgroundColor: BLUE,
    paddingHorizontal: 80,
    paddingTop: 96,
    paddingBottom: 80,
    justifyContent: 'space-between',
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: GOLD, fontSize: 54, fontWeight: '800', letterSpacing: 6 },
  date: { color: '#cbd5e1', fontSize: 44, fontWeight: '600' },
  bearPanel: {
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: BLUE_LIGHT,
    borderRadius: 48,
    overflow: 'hidden',
    paddingBottom: 20,
  },
  bearScene: { width: 840, height: 525 },
  bearName: { color: GOLD, fontSize: 40, fontWeight: '700', letterSpacing: 2, marginTop: 16 },
  titleBlock: { gap: 8 },
  title: { color: '#fff', fontSize: 100, fontWeight: '800' },
  handle: { color: GOLD, fontSize: 46, fontWeight: '600' },
  lines: { gap: 4 },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    paddingVertical: 18,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.14)',
  },
  lineName: { flexDirection: 'row', alignItems: 'center', gap: 16, flexShrink: 1 },
  exercise: { color: '#fff', fontSize: 50, fontWeight: '700', flexShrink: 1 },
  prPill: { backgroundColor: GOLD, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4 },
  prText: { color: BLUE, fontSize: 34, fontWeight: '800' },
  detail: { color: '#cbd5e1', fontSize: 42, fontWeight: '500', flexShrink: 0 },
  more: { color: '#94a3b8', fontSize: 40, fontWeight: '600', paddingTop: 12 },
  stats: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, marginTop: 8 },
  stat: { flex: 1, alignItems: 'center', backgroundColor: BLUE_LIGHT, borderRadius: 32, paddingVertical: 28 },
  statValue: { color: GOLD, fontSize: 72, fontWeight: '800' },
  statLabel: { color: '#cbd5e1', fontSize: 30, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  footer: { color: '#94a3b8', fontSize: 38, fontWeight: '600', textAlign: 'center' },
});
