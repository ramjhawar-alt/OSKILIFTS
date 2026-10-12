import * as Haptics from 'expo-haptics';

// Tiny taps that make the app feel native. Never throws (web and some devices have no haptics).
const safe = (run: () => Promise<void>) => {
  try {
    run().catch(() => undefined);
  } catch {
    // no haptics here
  }
};

export const tapHaptic = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
export const pressHaptic = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
export const successHaptic = () =>
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
export const selectHaptic = () => safe(() => Haptics.selectionAsync());
