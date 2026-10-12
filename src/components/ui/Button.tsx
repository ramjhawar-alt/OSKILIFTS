import { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, glow, radius, space, TOUCH } from '../../theme';
import { pressHaptic, tapHaptic } from '../../utils/haptics';

/** The main action: gold gradient with a soft glow. One per screen. */
export const PrimaryButton = ({
  label,
  onPress,
  icon,
  busy,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  busy?: boolean;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    activeOpacity={0.88}
    onPress={() => {
      pressHaptic();
      onPress();
    }}
    disabled={disabled || busy}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[styles.primaryWrap, glow(colors.gold, 0.45, 16), (disabled || busy) && styles.dim]}
  >
    <LinearGradient colors={[colors.gold, colors.goldDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
      {busy ? (
        <ActivityIndicator color={colors.onGold} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={styles.primaryText}>{label}</Text>
        </View>
      )}
    </LinearGradient>
  </TouchableOpacity>
);

/** A quieter outlined button for secondary actions. */
export const GhostButton = ({ label, onPress, icon }: { label: string; onPress: () => void; icon?: ReactNode }) => (
  <TouchableOpacity
    activeOpacity={0.8}
    onPress={() => {
      tapHaptic();
      onPress();
    }}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={styles.ghost}
  >
    <View style={styles.row}>
      {icon}
      <Text style={styles.ghostText}>{label}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  primaryWrap: { borderRadius: radius.pill },
  primary: { minHeight: TOUCH + 8, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  primaryText: { color: colors.onGold, fontSize: 17, fontWeight: '800', letterSpacing: 0.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ghost: {
    minHeight: TOUCH,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  ghostText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  dim: { opacity: 0.55 },
});
