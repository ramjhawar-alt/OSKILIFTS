import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { inviteLabel } from '../domain/invite';
import { hasSharedInvite, markInviteShared, shareInvite } from '../services/inviteService';
import { showMessage } from '../utils/alert';

/** On Home until the person has shared their link once (after that it lives under Me). */
export const InviteCard = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [shared, setShared] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (user) hasSharedInvite(user.id).then(setShared);
    }, [user]),
  );

  if (!profile?.username || !user || shared !== false) return null;

  const share = async () => {
    setBusy(true);
    try {
      const result = await shareInvite(profile.username as string);
      if (result !== 'cancelled') {
        await markInviteShared(user.id);
        setShared(true);
        if (result === 'copied') showMessage('Link copied', 'Paste it in a text or DM to a friend.');
      }
    } catch (error) {
      showMessage('Couldn’t share', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Lift with friends</Text>
      <Text style={styles.body}>
        The feed, leaderboard and “friends heading to the RSF” are better with your people on it. Send them your link.
      </Text>
      <Text style={styles.link} selectable>
        {inviteLabel(profile.username)}
      </Text>
      <TouchableOpacity style={styles.primary} onPress={share} disabled={busy} accessibilityRole="button">
        <Text style={styles.primaryText}>Invite friends</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  title: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  body: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  link: { fontSize: 14, fontWeight: '700', color: '#003262' },
  primary: { backgroundColor: '#003262', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#FDB515', fontSize: 15, fontWeight: '700' },
});
