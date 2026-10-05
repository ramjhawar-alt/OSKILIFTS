import { StyleSheet, Text, View } from 'react-native';

const PALETTE = ['#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#003262'];

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export const Avatar = ({
  name,
  username,
  size = 40,
}: {
  name?: string | null;
  username?: string | null;
  size?: number;
}) => {
  const label = (name || username || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colorFor(username || name || '?') },
      ]}
    >
      <Text style={[styles.letter, { fontSize: size * 0.45 }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  letter: { color: '#fff', fontWeight: '700' },
});
