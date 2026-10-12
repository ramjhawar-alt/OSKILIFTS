import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH } from './ui/DarkScreen';
import { useStartWorkout } from '../hooks/useStartWorkout';
import { colors, glow, space } from '../theme';
import { selectHaptic } from '../utils/haptics';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  HomeTab: { label: 'Today', icon: 'flash-outline', iconOn: 'flash' },
  FeedTab: { label: 'Feed', icon: 'people-outline', iconOn: 'people' },
  RsfTab: { label: 'RSF', icon: 'barbell-outline', iconOn: 'barbell' },
  MeTab: { label: 'Me', icon: 'person-outline', iconOn: 'person' },
};

/**
 * The floating bottom bar: Today, Feed, a big gold Log button in the middle (the thing you
 * do most, always one thumb-tap away), RSF, and Me.
 */
export const AppTabBar = ({ state, descriptors, navigation, badges }: BottomTabBarProps & { badges?: Record<string, number> }) => {
  const insets = useSafeAreaInsets();
  const startWorkout = useStartWorkout();

  // The logging screen needs the whole screen (keyboard, long forms), so the bar steps aside.
  const focusedName = getFocusedRouteNameFromRoute(state.routes[state.index]);
  if (focusedName === 'LogWorkout') return null;

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    if (route.name === 'LogTab') {
      return (
        <View key={route.key} style={styles.centerSlot}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={startWorkout}
            accessibilityRole="button"
            accessibilityLabel="Log a workout"
            style={[styles.logWrap, glow(colors.gold, 0.6, 18)]}
          >
            <LinearGradient colors={[colors.gold, colors.goldDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.log}>
              <Ionicons name="add" size={34} color={colors.onGold} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      );
    }
    const meta = TABS[route.name];
    if (!meta) return null;
    const focused = state.index === index;
    const badge = badges?.[route.name] ?? 0;
    const onPress = () => {
      // The stack inside a tab listens for this event to pop back to its first screen when you
      // tap the tab you are already on.
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        selectHaptic();
        navigation.navigate(route.name as never);
      }
    };
    return (
      <TouchableOpacity
        key={route.key}
        style={styles.tab}
        onPress={onPress}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel ?? meta.label}
        activeOpacity={0.7}
      >
        <View>
          <Ionicons name={focused ? meta.iconOn : meta.icon} size={24} color={focused ? colors.gold : colors.textFaint} />
          {badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, focused && styles.labelOn]}>{meta.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      <View style={styles.bar}>{state.routes.map(renderTab)}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  // In normal flow (not floating over the screens) so every screen, old or new, ends above the bar.
  outer: { alignItems: 'center', paddingHorizontal: space.md, paddingTop: space.sm, backgroundColor: colors.bg, zIndex: 10, overflow: 'visible' },
  bar: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(8,20,38,0.96)',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.sm,
    height: 68,
    ...glow('#000', 0.5, 22),
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  label: { fontSize: 11, fontWeight: '700', color: colors.textFaint, letterSpacing: 0.3 },
  labelOn: { color: colors.gold },
  centerSlot: { width: 76, alignItems: 'center', justifyContent: 'center' },
  logWrap: { marginTop: -34, borderRadius: 34 },
  log: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.bg },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
