import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { formatRemaining } from '../domain/restTimer';
import { colors, glow, radius, space } from '../theme';

export const RestTimerBar = ({
  remainingMs,
  onAdjust,
  onSkip,
}: {
  remainingMs: number;
  onAdjust: (deltaSeconds: number) => void;
  onSkip: () => void;
}) => {
  const over = remainingMs <= 0;
  return (
    <View style={[styles.bar, over && styles.barOver]} accessibilityLiveRegion="polite">
      <Text style={styles.label}>{over ? 'Rest over' : 'Rest'}</Text>
      <Text style={styles.time}>{over ? '0:00' : formatRemaining(remainingMs)}</Text>
      <View style={styles.actions}>
        {!over ? (
          <>
            <TouchableOpacity onPress={() => onAdjust(-15)} style={styles.button} accessibilityLabel="Subtract 15 seconds">
              <Text style={styles.buttonText}>−15</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onAdjust(15)} style={styles.button} accessibilityLabel="Add 15 seconds">
              <Text style={styles.buttonText}>+15</Text>
            </TouchableOpacity>
          </>
        ) : null}
        <TouchableOpacity onPress={onSkip} style={[styles.button, styles.skip]} accessibilityRole="button">
          <Text style={styles.buttonText}>{over ? 'Dismiss' : 'Skip'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surfaceHi,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    ...glow(colors.gold, 0.25, 14),
  },
  barOver: { backgroundColor: colors.successSoft, borderColor: colors.success },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  time: { color: colors.text, fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  button: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.pill, minHeight: 40, paddingHorizontal: 14, justifyContent: 'center' },
  skip: { backgroundColor: 'rgba(253,181,21,0.22)' },
  buttonText: { color: colors.text, fontSize: 14, fontWeight: '800' },
});
