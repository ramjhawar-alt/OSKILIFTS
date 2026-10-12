import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MAX_CONTENT_WIDTH } from './ui/DarkScreen';
import { colors, space } from '../theme';

type ScreenContainerProps = {
  children: ReactNode;
  style?: ViewStyle;
};

/** The standard dark screen shell: navy gradient, content in a phone-width column. */
export const ScreenContainer = ({ children, style }: ScreenContainerProps) => {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0A2347', colors.bg]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={[styles.content, style]}>{children}</View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safeArea: { flex: 1, width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  content: {
    flex: 1,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
});
