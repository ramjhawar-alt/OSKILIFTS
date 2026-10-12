import { StyleSheet, Text, View } from 'react-native';

import { PR_LABEL } from '../domain/prs';
import type { PrKind } from '../types/workout';
import { colors } from '../theme';

export const PrChips = ({ prs }: { prs: PrKind[] }) => {
  if (prs.length === 0) return null;
  return (
    <View style={styles.row} accessibilityLabel={`Personal record: ${prs.map((p) => PR_LABEL[p]).join(', ')}`}>
      {prs.map((pr) => (
        <View key={pr} style={styles.chip}>
          <Text style={styles.text}>🏆 {PR_LABEL[pr]}</Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: colors.goldSoft, borderRadius: 10, paddingVertical: 2, paddingHorizontal: 8 },
  text: { color: colors.gold, fontSize: 12, fontWeight: '700' },
});
