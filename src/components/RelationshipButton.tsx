import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';

import type { Relationship } from '../types/social';

const LABELS: Record<Exclude<Relationship, 'self'>, string> = {
  none: 'Follow',
  pending_out: 'Requested',
  following: 'Following',
  pending_in: 'Respond',
};

export const RelationshipButton = ({
  relationship,
  busy,
  onPress,
  friends,
  followBack,
}: {
  relationship: Exclude<Relationship, 'self'>;
  busy?: boolean;
  onPress: () => void;
  /** Mutual follows: shows "Friends" instead of "Following". */
  friends?: boolean;
  /** They follow me and I don't follow them: shows "Follow back". */
  followBack?: boolean;
}) => {
  const label =
    relationship === 'following' && friends
      ? 'Friends'
      : relationship === 'none' && followBack
        ? 'Follow back'
        : LABELS[relationship];
  const primary = relationship === 'none';
  return (
    <TouchableOpacity
      style={[styles.button, primary ? styles.primary : styles.secondary]}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
    >
      {busy ? (
        <ActivityIndicator size="small" color={primary ? '#fff' : '#2563eb'} />
      ) : (
        <Text style={[styles.text, primary ? styles.primaryText : styles.secondaryText]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    minWidth: 96,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: '#2563eb' },
  secondary: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  text: { fontSize: 14, fontWeight: '600' },
  primaryText: { color: '#fff' },
  secondaryText: { color: '#2563eb' },
});
