import { ReactNode } from 'react';
import { RefreshControlProps, ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, space } from '../../theme';

/** Largest width the app content takes on a big screen (the web): a phone-sized column. */
export const MAX_CONTENT_WIDTH = 560;

/**
 * Full-bleed dark screen with a faint blue glow at the top. `scroll` makes the content scroll
 * (with pull-to-refresh via `refreshControl`); otherwise children fill the screen.
 */
export const DarkScreen = ({
  children,
  scroll = false,
  refreshControl,
  contentStyle,
  bottomInset = 28,
}: {
  children: ReactNode;
  scroll?: boolean;
  refreshControl?: React.ReactElement<RefreshControlProps>;
  contentStyle?: ViewStyle;
  /** space under the last item */
  bottomInset?: number;
}) => (
  <View style={styles.root}>
    <LinearGradient
      colors={['#0A2347', colors.bg]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 0.55 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomInset }, contentStyle]}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.flex, styles.fill, contentStyle]}>
          <View style={[styles.column, styles.flex]}>{children}</View>
        </View>
      )}
    </SafeAreaView>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  flex: { flex: 1 },
  fill: { paddingHorizontal: space.lg },
  scrollContent: { paddingHorizontal: space.lg, paddingTop: space.sm, alignItems: 'center' },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: space.lg },
});
