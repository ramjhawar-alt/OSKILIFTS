import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Avatar } from './Avatar';
import { useRsfPresence, type PresenceStatus } from '../contexts/RsfPresenceContext';
import { confirmAction, showMessage } from '../utils/alert';

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
      <Text style={styles.title}>Friends at the RSF</Text>

      {friendsAtRsf.length > 0 ? (
        <View style={styles.friends}>
          {friendsAtRsf.map((friend) => {
            const there = Math.max(1, Math.round((now.getTime() - Date.parse(friend.arrivedAt)) / 60000));
            return (
              <View key={friend.id} style={styles.friendRow}>
                <Avatar name={friend.displayName} username={friend.username} size={32} />
                <View style={styles.friendText}>
                  <Text style={styles.friendName} numberOfLines={1}>
                    {friend.displayName || friend.username}
                  </Text>
                  <Text style={styles.friendMeta} numberOfLines={1}>
                    @{friend.username} · at the RSF {there < 60 ? `${there} min` : `${Math.floor(there / 60)} hr`}
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
            <ActivityIndicator color={sharing ? '#fff' : '#2563eb'} />
          ) : (
            <Text style={[styles.toggleText, sharing && styles.toggleTextOn]}>{sharing ? 'On' : 'Off'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  friends: { gap: 10 },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendText: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  friendMeta: { fontSize: 12, color: '#64748b' },
  hint: { fontSize: 14, color: '#64748b' },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 12,
  },
  shareText: { flex: 1 },
  shareTitle: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  shareHint: { fontSize: 13, color: '#64748b', marginTop: 2 },
  toggle: {
    minWidth: 64,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toggleOn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  toggleText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  toggleTextOn: { color: '#fff' },
});
