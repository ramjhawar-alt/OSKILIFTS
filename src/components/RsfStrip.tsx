import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from './Avatar';
import { Card } from './ui/Card';
import { useRsfPresence } from '../contexts/RsfPresenceContext';
import { crowdTone } from '../hooks/useRsfData';
import { colors, space, type } from '../theme';
import type { WeightRoomStatus } from '../types/api';

const TONES = {
  go: { color: colors.success, label: 'Good time to go' },
  wait: { color: colors.warning, label: 'Busy right now' },
  closed: { color: colors.danger, label: 'Closed' },
} as const;

/** The RSF at a glance on Today: how full it is, and which friends are there. One tap opens the RSF tab. */
export const RsfStrip = ({
  status,
  loading,
  onPress,
}: {
  status: WeightRoomStatus | null;
  loading: boolean;
  onPress: () => void;
}) => {
  const { friendsAtRsf } = useRsfPresence();
  const tone = TONES[crowdTone(status)];
  const percent = status?.percent;
  const shown = friendsAtRsf.slice(0, 3);
  const extra = friendsAtRsf.length - shown.length;

  return (
    <Card onPress={onPress} accessibilityLabel="Open the RSF tab" style={styles.card}>
      <View style={[styles.dot, { backgroundColor: tone.color, shadowColor: tone.color }]} />
      <View style={styles.text}>
        <Text style={styles.eyebrow}>RSF WEIGHT ROOM</Text>
        <Text style={styles.headline} numberOfLines={1}>
          {loading && !status ? 'Checking the RSF…' : tone.label}
          {status?.isOpen && percent !== null && percent !== undefined ? `  ·  ${percent}% full` : ''}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {friendsAtRsf.length === 0
            ? 'No friends there right now'
            : `${friendsAtRsf.length} friend${friendsAtRsf.length === 1 ? '' : 's'} lifting there`}
        </Text>
      </View>
      {friendsAtRsf.length > 0 ? (
        <View style={styles.avatars}>
          {shown.map((friend, i) => (
            <View key={friend.id} style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : -10 }]}>
              <Avatar name={friend.displayName} username={friend.username} size={30} />
            </View>
          ))}
          {extra > 0 ? <Text style={styles.extra}>+{extra}</Text> : null}
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 12, height: 12, borderRadius: 6, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  text: { flex: 1, gap: 2 },
  eyebrow: { ...type.eyebrow, fontSize: 10, color: colors.textMuted, letterSpacing: 1.6 },
  headline: { color: colors.text, fontSize: 16, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 13 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: { borderRadius: 16, borderWidth: 2, borderColor: colors.surface },
  extra: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginLeft: 6 },
});
