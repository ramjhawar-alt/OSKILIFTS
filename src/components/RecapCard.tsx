import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getEmailPrefs, setWeeklyDigest, type EmailPrefs } from '../services/emailPrefsService';
import { showMessage } from '../utils/alert';
import { cardBase, colors } from '../theme';

/** One-time, one-tap question on Home: want a Sunday recap email? Never shown again once answered. */
export const RecapCard = () => {
  const [prefs, setPrefs] = useState<EmailPrefs | null>(null);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getEmailPrefs().then(setPrefs);
    }, []),
  );

  if (!prefs || prefs.decided) return null;

  const answer = async (on: boolean) => {
    setBusy(true);
    try {
      await setWeeklyDigest(on);
      setPrefs({ weeklyDigest: on, decided: true });
      if (on) {
        showMessage('Recap turned on', 'You’ll get one email on Sunday evenings, only when something happened. You can turn it off any time under Me.');
      }
    } catch (error) {
      showMessage('Couldn’t save that', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Get a Sunday recap?</Text>
      <Text style={styles.body}>
        One short email a week with your new followers and likes. Only when something happened, and never an email per
        event.
      </Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.primary} onPress={() => answer(true)} disabled={busy} accessibilityRole="button">
          {busy ? <ActivityIndicator color={colors.gold} /> : <Text style={styles.primaryText}>Yes, email me</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => answer(false)} disabled={busy} accessibilityRole="button">
          <Text style={styles.secondaryText}>No thanks</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { ...cardBase },
  title: { fontSize: 18, fontWeight: '700', color: colors.text },
  body: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primary: { flex: 1, backgroundColor: colors.goldSoft, borderWidth: 1, borderColor: colors.gold, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  primaryText: { color: colors.gold, fontSize: 15, fontWeight: '700' },
  secondary: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
});
