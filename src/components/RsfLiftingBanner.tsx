import { StyleSheet, Text, View } from 'react-native';

import { AnimatedOskiLifting } from './AnimatedOskiLifting';
import { useRsfPresence } from '../contexts/RsfPresenceContext';
import { useMyBearStage } from '../hooks/useMyBearStage';
import { getBearStageName } from '../services/bearStreakService';

/** A small lifting Oski at the top of the logging screen, only while you're at the RSF. */
export const RsfLiftingBanner = () => {
  const { status } = useRsfPresence();
  const stage = useMyBearStage();
  if (status !== 'at' || stage === null) return null;
  return (
    <View style={styles.banner}>
      <View style={styles.art}>
        <AnimatedOskiLifting stage={stage} mode="lift" />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>You’re at the RSF</Text>
        <Text style={styles.sub}>{getBearStageName(stage)} is lifting with you.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 16,
  },
  art: { width: 112, height: 84, borderRadius: 10, overflow: 'hidden' },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  sub: { fontSize: 13, color: '#64748b', marginTop: 2 },
});
