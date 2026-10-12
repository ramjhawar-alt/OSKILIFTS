import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Avatar } from './Avatar';
import { useRsfPresence, type PresenceStatus } from '../contexts/RsfPresenceContext';
import { stayLabel } from '../domain/rsfFriends';
import type { RootStackParamList } from '../types/navigation';
import { confirmAction, showMessage } from '../utils/alert';
import { cardBase, colors } from '../theme';

const CONSENT =
  'OSKILIFTS will check your location only while the app is open. If you’re at the RSF, your friends (people you follow who follow you back) can see that you’re there. Your exact location is never sent or saved, only “at the RSF”. Turn this off any time.';

function describe(status: PresenceStatus): string {
  switch (status) {
    case 'starting':
      return 'Checking your location…';
    case 'at':
      return 'You’re at the RSF. Friends can see this.';
    case 'away':
      return 'You’re not at the RSF, so nothing is shared.';
    case 'denied':
      return 'Location is blocked. Allow it in your browser or phone settings, then turn this on again.';
    case 'unavailable':
      return 'This device can’t share its location.';
    default:
      return '';
  }
}

/** Opt-in "at the RSF" sharing, plus which friends are there right now. */
export const RsfPresenceCard = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { sharing, status, friendsAtRsf, enable, disable } = useRsfPresence();
  const [busy, setBusy] = useState(false);
  const now = new Date();

  const toggle = async () => {
    setBusy(true);
    try {
      if (sharing) {
        await disable();
        return;
      }
      const confirmed = await confirmAction({
        title: 'Share when you’re at the RSF?',
        message: CONSENT,
        confirmLabel: 'Turn on',
      });
      if (!confirmed) return;
      const result = await enable();
      if (result === 'denied') {
        showMessage('Location is blocked', describe('denied'));
      } else if (result === 'unavailable') {
        showMessage('Location unavailable', describe('unavailable'));
      }
    } finally {
      setBusy(false);
    }
  };

  const note = describe(status);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Friends at the RSF</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('FriendsAtRsf')}
          accessibilityRole="button"
          accessibilityLabel="See everyone at the RSF"
        >
          <Text style={styles.seeAll}>
            {friendsAtRsf.length > 0 ? `${friendsAtRsf.length} here · See all ›` : 'See all ›'}
          </Text>
        </TouchableOpacity>
      </View>

      {friendsAtRsf.length > 0 ? (
        <View style={styles.friends}>
          {friendsAtRsf.map((friend) => {
            return (
              <View key={friend.id} style={styles.friendRow}>
                <Avatar name={friend.displayName} username={friend.username} size={32} />
                <View style={styles.friendText}>
                  <Text style={styles.friendName} numberOfLines={1}>
                    {friend.displayName || friend.username}
                  </Text>
                  <Text style={styles.friendMeta} numberOfLines={1}>
                    @{friend.username} · at the RSF {stayLabel(friend.arrivedAt, now.getTime())}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.hint}>None of your friends are at the RSF right now.</Text>
      )}

      <View style={styles.shareRow}>
        <View style={styles.shareText}>
          <Text style={styles.shareTitle}>Share when I’m here</Text>
          <Text style={styles.shareHint}>
            {sharing || status === 'denied' || status === 'unavailable'
              ? note
              : 'Off. Friends only. Checked only while the app is open.'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.toggle, sharing && styles.toggleOn]}
          onPress={toggle}
          disabled={busy}
          accessibilityRole="switch"
          accessibilityState={{ checked: sharing }}
          aria-checked={sharing}
          accessibilityLabel="Share when I’m at the RSF"
        >
          {busy ? (
            <ActivityIndicator color={sharing ? colors.onGold : colors.gold} />
          ) : (
            <Text style={[styles.toggleText, sharing && styles.toggleTextOn]}>{sharing ? 'On' : 'Off'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { ...cardBase },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  seeAll: { fontSize: 13, fontWeight: '700', color: colors.cyan },
  friends: { gap: 10 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendText: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '600', color: colors.text },
  friendMeta: { fontSize: 12, color: colors.textMuted },
  hint: { fontSize: 14, color: colors.textMuted },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
  },
  shareText: { flex: 1 },
  shareTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  shareHint: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  toggle: {
    minWidth: 64,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleOn: { backgroundColor: colors.success, borderColor: colors.success },
  toggleText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  toggleTextOn: { color: colors.onGold },
});
