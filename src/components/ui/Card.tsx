import { ReactNode } from 'react';
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

import { colors, radius, space, type } from '../../theme';
import { tapHaptic } from '../../utils/haptics';

/** A dark "glass" card: raised surface, hairline border, generous radius. */
export const Card = ({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) =>
  onPress ? (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      style={[styles.card, style]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </TouchableOpacity>
  ) : (
    <View style={[styles.card, style]}>{children}</View>
  );

export const SectionTitle = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <View style={styles.sectionRow}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action && onAction ? (
      <TouchableOpacity onPress={onAction} accessibilityRole="button" hitSlop={10}>
        <Text style={styles.sectionAction}>{action}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

export const Pill = ({ label, color = colors.gold, soft = colors.goldSoft }: { label: string; color?: string; soft?: string }) => (
  <View style={[styles.pill, { backgroundColor: soft, borderColor: color }]}>
    <Text style={[styles.pillText, { color }]}>{label}</Text>
  </View>
);

export const ProgressBar = ({ value, color = colors.gold }: { value: number; color?: string }) => (
  <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}>
    <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: color }]} />
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionTitle: { ...type.heading, color: colors.text },
  sectionAction: { ...type.small, color: colors.gold, fontWeight: '700' },
  pill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
