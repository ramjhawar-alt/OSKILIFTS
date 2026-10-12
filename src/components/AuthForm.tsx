import { ReactNode, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedOskiLifting } from './AnimatedOskiLifting';
import { colors, glow, radius, space, TOUCH, type } from '../theme';
import { pressHaptic, tapHaptic } from '../utils/haptics';

/** The sign-in / sign-up shell: dark Berkeley navy, Oski lifting up top, a clean form below. */
export const AuthLayout = ({
  title,
  subtitle,
  children,
  hero = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  hero?: boolean;
}) => (
  <View style={styles.root}>
    <LinearGradient
      colors={['#0B2A57', colors.bg]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 0.6 }}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
    <SafeAreaView style={styles.flex}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {hero ? (
            <View style={styles.hero}>
              <AnimatedOskiLifting stage={1} mode="lift" />
            </View>
          ) : null}
          <Text style={styles.brand}>OSKILIFTS</Text>
          <Text style={styles.eyebrow}>BUILT FOR UC BERKELEY</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.form}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>
);

export const AuthInput = (props: TextInputProps) => {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      autoCapitalize="none"
      autoCorrect={false}
      selectionColor={colors.gold}
      {...props}
      onFocus={(event) => {
        setFocused(true);
        props.onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        props.onBlur?.(event);
      }}
      style={[styles.input, focused && styles.inputFocused, props.style]}
    />
  );
};

export const AuthButton = ({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) => (
  <TouchableOpacity
    activeOpacity={0.88}
    onPress={() => {
      pressHaptic();
      onPress();
    }}
    disabled={disabled || loading}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[styles.buttonWrap, glow(colors.gold, 0.4, 14), (disabled || loading) && styles.buttonDisabled]}
  >
    <LinearGradient colors={[colors.gold, colors.goldDeep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
      {loading ? <ActivityIndicator color={colors.onGold} /> : <Text style={styles.buttonText}>{label}</Text>}
    </LinearGradient>
  </TouchableOpacity>
);

export const AuthLink = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <TouchableOpacity
    onPress={() => {
      tapHaptic();
      onPress();
    }}
    style={styles.link}
    accessibilityRole="button"
  >
    <Text style={styles.linkText}>{label}</Text>
  </TouchableOpacity>
);

export const AuthError = ({ message }: { message: string | null }) =>
  message ? <Text style={styles.error}>{message}</Text> : null;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: space.xxl,
    paddingVertical: space.xxl,
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  hero: {
    alignSelf: 'center',
    width: 220,
    height: 165,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.gold,
    marginBottom: space.xl,
    ...glow(colors.gold, 0.35, 20),
  },
  brand: { fontSize: 34, fontWeight: '900', letterSpacing: 2, color: colors.gold, textAlign: 'center' },
  eyebrow: { ...type.eyebrow, color: colors.cyan, textAlign: 'center', marginTop: 4, marginBottom: space.xl },
  title: { ...type.title, color: colors.text },
  subtitle: { fontSize: 15, color: colors.textMuted, marginTop: space.sm, lineHeight: 21 },
  form: { marginTop: space.xl, gap: space.md },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: TOUCH + 4,
    fontSize: 16,
    color: colors.text,
  },
  inputFocused: { borderColor: colors.gold },
  buttonWrap: { borderRadius: radius.pill, marginTop: space.xs },
  button: { minHeight: TOUCH + 6, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.onGold, fontSize: 17, fontWeight: '800' },
  link: { alignItems: 'center', paddingVertical: space.md, minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.cyan, fontSize: 15, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
});
