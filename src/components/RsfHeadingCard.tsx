import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { Avatar } from './Avatar';
import {
  crowdLine,
  friendsHeadingLine,
  timeLeftLabel,
  type CrowdSnapshot,
} from '../domain/rsfHeading';
import {
  clearHeading,
  getFriendsHeading,
  getMyHeading,
  setHeading,
  type FriendHeading,
} from '../services/rsfStatusService';
import { showMessage } from '../utils/alert';

const REFRESH_MS = 60_000;

/** "Heading to the RSF": tell your friends you're on your way, and see who else is. */
export const RsfHeadingCard = ({ crowd }: { crowd: CrowdSnapshot | null }) => {
  const [mine, setMine] = useState<string | null>(null);
  const [friends, setFriends] = useState<FriendHeading[]>([]);
  const [busy, setBusy] = useState(false);
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const [myExpiry, others] = await Promise.all([getMyHeading(), getFriendsHeading()]);
    setMine(myExpiry);
    setFriends(others);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Keep "min left" fresh and drop statuses that expired while the screen was open.
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((value) => value + 1);
      load();
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  const now = new Date();
  const stillActive = (expiresAt: string) => Date.parse(expiresAt) > now.getTime();
  const myActive = mine && stillActive(mine) ? mine : null;
  const visibleFriends = friends.filter((friend) => stillActive(friend.expiresAt));
  const crowdSentence = crowdLine(crowd);
  const friendsSentence = friendsHeadingLine(
    visibleFriends.map((friend) => friend.displayName || friend.username),
  );

  const toggle = async () => {
    setBusy(true);
    try {
      if (myActive) {
        await clearHeading();
        setMine(null);
      } else {
        setMine(await setHeading());
      }
      setFriends(await getFriendsHeading());
    } catch (error) {
      showMessage('Couldn’t update your status', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Heading to the RSF?</Text>
      {crowdSentence ? <Text style={styles.crowd}>{crowdSentence}</Text> : null}

      {myActive ? (
        <View style={styles.activeRow}>
          <View style={styles.activeText}>
            <Text style={styles.activeTitle}>You’re heading to the RSF</Text>
            <Text style={styles.activeMeta}>Friends can see this · {timeLeftLabel(myActive, now)}</Text>
          </View>
          <TouchableOpacity style={styles.secondary} onPress={toggle} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#2563eb" /> : <Text style={styles.secondaryText}>Cancel</Text>}
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.primary} onPress={toggle} disabled={busy} accessibilityRole="button">
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>I’m heading to the RSF</Text>
          )}
        </TouchableOpacity>
      )}

      {friendsSentence ? (
        <View style={styles.friends}>
          <Text style={styles.friendsLine}>{friendsSentence}</Text>
          {visibleFriends.map((friend) => (
            <View key={friend.id} style={styles.friendRow}>
              <Avatar name={friend.displayName} username={friend.username} size={32} />
              <View style={styles.friendText}>
                <Text style={styles.friendName} numberOfLines={1}>
                  {friend.displayName || friend.username}
                </Text>
                <Text style={styles.friendMeta} numberOfLines={1}>
                  @{friend.username} · {timeLeftLabel(friend.expiresAt, now)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.hint}>
          Only friends see this: people you follow who follow you back. None of yours are heading over right now.
        </Text>
      )}
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
  crowd: { fontSize: 14, color: '#475569' },
  primary: { backgroundColor: '#003262', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#FDB515', fontSize: 16, fontWeight: '700' },
  activeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  activeText: { flex: 1 },
  activeTitle: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  activeMeta: { fontSize: 13, color: '#64748b', marginTop: 2 },
  secondary: {
    minWidth: 84,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryText: { color: '#2563eb', fontWeight: '600', fontSize: 15 },
  friends: { gap: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  friendsLine: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  friendText: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  friendMeta: { fontSize: 12, color: '#64748b' },
  hint: { fontSize: 13, color: '#64748b' },
});
