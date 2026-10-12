import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { PeakHoursChart } from '../components/PeakHoursChart';
import { RsfHeadingCard } from '../components/RsfHeadingCard';
import { RsfPresenceCard } from '../components/RsfPresenceCard';
import { Card, Pill, ProgressBar, SectionTitle } from '../components/ui/Card';
import { DarkScreen } from '../components/ui/DarkScreen';
import { useRsfPresence } from '../contexts/RsfPresenceContext';
import { crowdTone, useRsfData } from '../hooks/useRsfData';
import { colors, radius, space, type } from '../theme';
import type { RootStackParamList } from '../types/navigation';

const TONES = {
  go: { color: colors.success, soft: colors.successSoft, label: 'GOOD TIME TO GO' },
  wait: { color: colors.warning, soft: 'rgba(251,191,36,0.14)', label: 'BUSY' },
  closed: { color: colors.danger, soft: colors.dangerSoft, label: 'CLOSED' },
} as const;

/** Everything about the gym in one place: live crowd, who's there, when it's quiet, classes, hoops. */
export const RsfHubScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { status, loading, error, peakHours, peakHoursLoading, refresh } = useRsfData({ withPeakHours: true });
  const { refreshFriends } = useRsfPresence();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshFriends()]);
    setRefreshing(false);
  }, [refresh, refreshFriends]);

  const tone = TONES[crowdTone(status)];
  const percent = status?.percent ?? null;

  return (
    <DarkScreen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      <View>
        <Text style={styles.eyebrow}>UC BERKELEY</Text>
        <Text style={styles.title}>RSF</Text>
      </View>

      <Card style={styles.crowd}>
        <View style={styles.crowdTop}>
          <Text style={styles.crowdLabel}>WEIGHT ROOM RIGHT NOW</Text>
          <Pill label={tone.label} color={tone.color} soft={tone.soft} />
        </View>
        {error && !status ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <Text style={styles.percent}>{loading && !status ? '…' : percent !== null ? `${percent}%` : '—'}</Text>
            <ProgressBar value={(percent ?? 0) / 100} color={tone.color} />
            <Text style={styles.occupancy}>
              {status ? `${status.occupancy}${status.capacity ? ` of ${status.capacity}` : ''} people` : ' '}
              {status?.updatedAt ? `  ·  updated ${new Date(status.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
            </Text>
          </>
        )}
        {status && !status.isOpen && status.hours?.length ? (
          <View style={styles.hours}>
            <Text style={styles.hoursTitle}>Hours</Text>
            {status.hours.map((slot) => (
              <View key={slot.label} style={styles.hoursRow}>
                <Text style={styles.hoursLabel}>{slot.label}</Text>
                <Text style={styles.hoursValue}>
                  {slot.open} – {slot.close}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <View style={styles.tiles}>
        <Card style={styles.tile} onPress={() => navigation.navigate('Classes')} accessibilityLabel="Open RSF classes">
          <Ionicons name="calendar" size={26} color={colors.cyan} />
          <Text style={styles.tileTitle}>Classes</Text>
          <Text style={styles.tileSub}>Today's schedule</Text>
        </Card>
        <Card style={styles.tile} onPress={() => navigation.navigate('Hoopers')} accessibilityLabel="Open Hoopers">
          <Ionicons name="basketball" size={26} color={colors.gold} />
          <Text style={styles.tileTitle}>Hoopers</Text>
          <Text style={styles.tileSub}>Who's playing</Text>
        </Card>
      </View>

      <SectionTitle title="Friends and plans" />
      <RsfHeadingCard
        crowd={
          status ? { status: status.status, isOpen: status.isOpen, percent: status.percent } : null
        }
      />
      <RsfPresenceCard />

      <SectionTitle title="When it's quiet" />
      <PeakHoursChart data={peakHours} loading={peakHoursLoading} />
    </DarkScreen>
  );
};

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: colors.cyan },
  title: { ...type.display, color: colors.text, marginTop: 2 },
  crowd: { gap: space.md, borderColor: colors.borderStrong },
  crowdTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  crowdLabel: { ...type.eyebrow, fontSize: 10, color: colors.textMuted, letterSpacing: 1.6, flexShrink: 1 },
  percent: { fontSize: 64, fontWeight: '800', letterSpacing: -2, color: colors.text, fontVariant: ['tabular-nums'] },
  occupancy: { color: colors.textMuted, fontSize: 13 },
  error: { color: colors.danger, fontSize: 14 },
  hours: { gap: 4, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md },
  hoursTitle: { color: colors.text, fontWeight: '700', fontSize: 14, marginBottom: 2 },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between' },
  hoursLabel: { color: colors.textMuted, fontSize: 13 },
  hoursValue: { color: colors.text, fontSize: 13, fontWeight: '600' },
  tiles: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, gap: 4, borderRadius: radius.lg },
  tileTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 6 },
  tileSub: { color: colors.textMuted, fontSize: 12 },
});
