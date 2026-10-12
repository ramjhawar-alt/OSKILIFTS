import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AnimatedOskiLifting } from './AnimatedOskiLifting';
import { stayLabel, type FriendAtRsf } from '../domain/rsfFriends';
import { getBearStageName } from '../services/bearStreakService';

/** One friend at the RSF: their bear lifting, their name, and how long they've been there. */
export const FriendAtRsfRow = ({
  friend,
  nowMs,
  onPress,
}: {
  friend: FriendAtRsf;
  nowMs: number;
  onPress: () => void;
}) => (
  <TouchableOpacity
    style={styles.row}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={`${friend.displayName || friend.username}, ${getBearStageName(friend.stage)}`}
  >
    <View style={styles.art}>
      <AnimatedOskiLifting stage={friend.stage} mode="lift" />
    </View>
    <View style={styles.text}>
      <Text style={styles.name} numberOfLines={1}>
        {friend.displayName || friend.username}
      </Text>
      <Text style={styles.handle} numberOfLines={1}>
        @{friend.username}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        {getBearStageName(friend.stage)} · here {stayLabel(friend.arrivedAt, nowMs)}
      </Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 10,
  },
  art: { width: 128, height: 96, borderRadius: 10, overflow: 'hidden' },
  text: { flex: 1 },
  name: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  handle: { fontSize: 13, color: '#64748b', marginTop: 1 },
  meta: { fontSize: 13, color: '#003262', fontWeight: '600', marginTop: 6 },
});
