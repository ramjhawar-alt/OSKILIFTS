import { Linking, ScrollView, StyleSheet, Text } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL } from '../config/legal';

const RULES = [
  'Be respectful. No harassment, bullying, threats, hate speech or discrimination.',
  'Keep it appropriate. No sexual, graphic or violent content in usernames, display names, workout notes or comments.',
  'Be yourself. No impersonating other people or Cal/RecWell staff.',
  'Respect privacy. Don’t share anyone else’s personal information.',
  'No spam, scams, or attempts to mislead other users.',
];

export const GuidelinesScreen = () => (
  <ScreenContainer>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Community Guidelines</Text>
      <Text style={styles.body}>
        OSKILIFTS is for the Berkeley community. There is no tolerance for
        objectionable content or abusive users.
      </Text>
      {RULES.map((rule) => (
        <Text key={rule} style={styles.rule}>
          • {rule}
        </Text>
      ))}
      <Text style={styles.heading}>Reporting and blocking</Text>
      <Text style={styles.body}>
        You can report any profile or workout and block any user. Reports are
        reviewed within 24 hours, and content or accounts that break these rules
        are removed.
      </Text>
      <Text style={styles.heading}>Contact</Text>
      <Text style={styles.body}>
        Questions or concerns:{' '}
        <Text style={styles.link} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}>
          {SUPPORT_EMAIL}
        </Text>
      </Text>
      <Text style={styles.body}>
        <Text style={styles.link} onPress={() => Linking.openURL(TERMS_URL)}>
          Terms
        </Text>
        {'  ·  '}
        <Text style={styles.link} onPress={() => Linking.openURL(PRIVACY_URL)}>
          Privacy Policy
        </Text>
      </Text>
    </ScrollView>
  </ScreenContainer>
);

const styles = StyleSheet.create({
  content: { paddingBottom: 48, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#0f172a' },
  heading: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginTop: 8 },
  body: { fontSize: 15, color: '#475569', lineHeight: 22 },
  rule: { fontSize: 15, color: '#0f172a', lineHeight: 22 },
  link: { color: '#2563eb', fontWeight: '600' },
});
