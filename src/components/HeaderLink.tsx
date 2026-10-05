import { StyleSheet, Text, TouchableOpacity } from 'react-native';

export const HeaderLink = ({
  label,
  onPress,
  badge,
}: {
  label: string;
  onPress: () => void;
  badge?: number;
}) => (
  <TouchableOpacity onPress={onPress} style={styles.button} accessibilityRole="button">
    <Text style={styles.text}>
      {label}
      {badge ? ` (${badge})` : ''}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  button: { paddingHorizontal: 12, paddingVertical: 6 },
  text: { color: '#2563eb', fontSize: 16, fontWeight: '600' },
});
