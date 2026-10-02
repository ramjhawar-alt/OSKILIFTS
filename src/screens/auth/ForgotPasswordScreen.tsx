import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AuthButton,
  AuthError,
  AuthInput,
  AuthLayout,
  AuthLink,
} from '../../components/AuthForm';
import { useAuth } from '../../contexts/AuthContext';
import type { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export const ForgotPasswordScreen = ({ navigation }: Props) => {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your @berkeley.edu email and we'll send you a reset link."
    >
      <AuthInput
        placeholder="you@berkeley.edu"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        textContentType="username"
        autoComplete="email"
        onSubmitEditing={handleSubmit}
      />
      <AuthError message={error} />
      {sent ? (
        <Text style={styles.success}>
          If an account exists for that email, a reset link is on its way.
        </Text>
      ) : null}
      <AuthButton
        label="Send reset link"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!email}
      />
      <AuthLink
        label="Back to sign in"
        onPress={() => navigation.navigate('SignIn')}
      />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  success: { color: '#16a34a', fontSize: 14 },
});
