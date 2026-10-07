import { useState } from 'react';
import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import {
  AuthButton,
  AuthError,
  AuthInput,
  AuthLayout,
  AuthLink,
} from '../../components/AuthForm';
import { useAuth } from '../../contexts/AuthContext';
import { useProfile } from '../../contexts/ProfileContext';
import { PRIVACY_URL, TERMS_URL } from '../../config/legal';
import { acceptTerms, claimProfile } from '../../services/socialService';
import type { OnboardingStackParamList } from '../../types/navigation';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SetUsername'>;

export const SetUsernameScreen = ({ navigation }: Props) => {
  const { signOut } = useAuth();
  const { profile, setProfile } = useProfile();
  const hasUsername = Boolean(profile?.username);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [agreed, setAgreed] = useState(false);
  // Private is preselected: nobody becomes public without choosing it.
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const updated = hasUsername
        ? await acceptTerms()
        : await claimProfile(username, displayName, isPublic);
      // The gate in RootNavigator swaps to the main app once this is complete.
      setProfile(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = agreed && (hasUsername || (username.length >= 3 && displayName.trim().length > 0));

  return (
    <AuthLayout
      title={hasUsername ? 'Review our terms' : 'Pick your username'}
      subtitle={
        hasUsername
          ? 'We updated our terms: accounts can now be Public or Private (yours stays Private), and there is a new Explore feed. Please review and accept to keep using OSKILIFTS.'
          : 'This is how other Berkeley students will find you. Usernames can’t be changed later.'
      }
    >
      {!hasUsername ? (
        <>
          <AuthInput
            placeholder="username (letters, numbers, _)"
            value={username}
            onChangeText={(text) => setUsername(text.toLowerCase())}
            maxLength={20}
            textContentType="username"
          />
          <AuthInput
            placeholder="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
            maxLength={40}
          />
          <View style={styles.choiceGroup} accessibilityRole="radiogroup">
            <Text style={styles.choiceTitle}>Who can follow you?</Text>
            {(
              [
                {
                  value: false,
                  title: 'Private',
                  body: 'People send a request and you approve them. Only approved followers see your workouts.',
                },
                {
                  value: true,
                  title: 'Public',
                  body: 'Anyone at Berkeley can follow you and see the workouts you share, and they can appear on Explore.',
                },
              ] as const
            ).map((option) => (
              <TouchableOpacity
                key={option.title}
                style={[styles.choice, isPublic === option.value && styles.choiceSelected]}
                onPress={() => setIsPublic(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isPublic === option.value }}
              >
                <Text style={styles.choiceName}>{option.title}</Text>
                <Text style={styles.choiceBody}>{option.body}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.choiceHint}>You can change this any time from your profile.</Text>
          </View>
        </>
      ) : null}

      <TouchableOpacity
        style={styles.agreeRow}
        onPress={() => setAgreed((value) => !value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
      >
        <View style={[styles.box, agreed && styles.boxChecked]}>
          {agreed ? <Text style={styles.check}>✓</Text> : null}
        </View>
        <Text style={styles.agreeText}>
          I agree to the{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL)}>
            Terms
          </Text>
          ,{' '}
          <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>
            Privacy Policy
          </Text>{' '}
          and{' '}
          <Text style={styles.link} onPress={() => navigation.navigate('Guidelines')}>
            Community Guidelines
          </Text>
          . There is no tolerance for objectionable content or abusive behavior.
        </Text>
      </TouchableOpacity>

      <AuthError message={error} />
      <AuthButton
        label={hasUsername ? 'Accept and continue' : 'Continue'}
        onPress={handleSubmit}
        loading={submitting}
        disabled={!canSubmit}
      />
      <AuthLink label="Sign out" onPress={() => signOut().catch(() => undefined)} />
    </AuthLayout>
  );
};

const styles = StyleSheet.create({
  choiceGroup: { gap: 8 },
  choiceTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  choice: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  choiceSelected: { borderColor: '#1d4ed8', backgroundColor: '#eff6ff' },
  choiceName: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  choiceBody: { fontSize: 13, color: '#475569', lineHeight: 18 },
  choiceHint: { fontSize: 12, color: '#64748b' },
  agreeRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginTop: 4 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94a3b8',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxChecked: { backgroundColor: '#1d4ed8', borderColor: '#1d4ed8' },
  check: { color: '#fff', fontSize: 14, fontWeight: '800' },
  agreeText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 20 },
  link: { color: '#1d4ed8', fontWeight: '600' },
});
