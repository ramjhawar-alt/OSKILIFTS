import { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AuthButton,
  AuthError,
  AuthInput,
  AuthLayout,
  AuthLink,
} from '../../components/AuthForm';
import { useAuth } from '../../contexts/AuthContext';
import { TERMS_URL } from '../../config/legal';
import type { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export const SignUpScreen = ({ navigation }: Props) => {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const needsConfirmation = await signUp(email, password);
      // With "Confirm email" on, there's no session until the link is clicked.
      // If confirmation is off, the auth listener swaps in the main app itself.
      if (needsConfirmation) {
        navigation.replace('CheckYourEmail', { email: email.trim().toLowerCase() });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Only @berkeley.edu emails can sign up. We'll email you a link to confirm it's yours."
    >
      <AuthInput
        placeholder="you@berkeley.edu"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
      />
      <AuthInput
        placeholder="Password (8+ characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <AuthInput
        placeholder="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        onSubmitEditing={handleSubmit}
      />
      <AuthError message={error} />
      <Text style={styles.terms}>
        By creating an account you agree to the{' '}
        <Text style={styles.termsLink} onPress={() => Linking.openURL(TERMS_URL)}>
          Terms
        </Text>
        . You’ll review the community guidelines next.
      </Text>
      <AuthButton
        label="Create account"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!email || !password || !confirmPassword}
      />
      <AuthLink
        label="Already have an account? Sign in"
        onPress={() => navigation.navigate('SignIn')}
      />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  terms: { fontSize: 13, color: '#64748b' },
  termsLink: { color: '#1d4ed8', fontWeight: '600' },
});
