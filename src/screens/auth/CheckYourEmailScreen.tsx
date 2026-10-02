import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { AuthButton, AuthLayout } from '../../components/AuthForm';
import type { AuthStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<AuthStackParamList, 'CheckYourEmail'>;

export const CheckYourEmailScreen = ({ navigation, route }: Props) => (
  <AuthLayout
    title="Check your email"
    subtitle={`We sent a confirmation link to ${route.params.email}. Open it, then come back here and sign in.`}
  >
    <Text style={styles.hint}>
      Can't find it? Check your spam folder. The link only needs to be used once.
    </Text>
    <AuthButton
      label="Back to sign in"
      onPress={() => navigation.navigate('SignIn')}
    />
  </AuthLayout>
);

const styles = StyleSheet.create({
  hint: { fontSize: 14, color: '#64748b' },
});
