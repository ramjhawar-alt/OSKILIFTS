import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { formatRemaining } from '../domain/restTimer';

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
    gap: 12,
    backgroundColor: '#0f172a',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 8,
  },
  barOver: { backgroundColor: '#15803d' },
  label: { color: '#cbd5e1', fontSize: 13, fontWeight: '600' },
  time: { color: '#ffffff', fontSize: 22, fontWeight: '800', fontVariant: ['tabular-nums'], flex: 1 },
  actions: { flexDirection: 'row', gap: 8 },
  button: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  skip: { backgroundColor: 'rgba(255,255,255,0.28)' },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
