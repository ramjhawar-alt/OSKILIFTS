import { useState } from 'react';
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

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export const SignInScreen = ({ navigation }: Props) => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="OSKILIFTS is for UC Berkeley students. Use your @berkeley.edu email."
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
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        autoComplete="current-password"
        onSubmitEditing={handleSubmit}
      />
      <AuthError message={error} />
      <AuthButton
        label="Sign in"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!email || !password}
      />
      <AuthLink
        label="Forgot password?"
        onPress={() => navigation.navigate('ForgotPassword')}
      />
      <AuthLink
        label="New here? Create an account"
        onPress={() => navigation.navigate('SignUp')}
      />
    </AuthLayout>
  );
};
