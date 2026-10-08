import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { loadPendingInvite, onPendingInvite } from '../services/inviteService';

/** On the sign-in and sign-up screens: tells a visitor who invited them. */
export const InviteBanner = () => {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      loadPendingInvite().then((pending) => {
        if (active) setUsername(pending ? pending.username : null);
      });
    };
    refresh();
    const unsubscribe = onPendingInvite(refresh);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (!username) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.title}>@{username} invited you</Text>
      <Text style={styles.body}>Create your account to follow them and see their workouts.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 2,
  },
  title: { fontSize: 15, fontWeight: '800', color: '#78350f' },
  body: { fontSize: 13, color: '#92400e' },
});
