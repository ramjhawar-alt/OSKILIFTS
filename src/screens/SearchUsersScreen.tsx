import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { AuthInput } from '../components/AuthForm';
import { Avatar } from '../components/Avatar';
import { RelationshipButton } from '../components/RelationshipButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { followUser, searchProfiles, unfollowUser } from '../services/socialService';
import type { RootStackParamList } from '../types/navigation';
import type { Relationship, SearchResult } from '../types/social';
import { confirmAction, showMessage } from '../utils/alert';

type SearchNavigationProp = NativeStackNavigationProp<RootStackParamList, 'SearchUsers'>;

export const SearchUsersScreen = () => {
  const navigation = useNavigation<SearchNavigationProp>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const trimmed = query.trim().toLowerCase();

  useEffect(() => {
    if (trimmed.length < 2) {
      setResults([]);
      setSearching(false);
      setError(null);
      return undefined;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await searchProfiles(trimmed);
        if (active) {
          setResults(found);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Search failed.');
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [trimmed]);

  const setRelationship = useCallback((id: string, relationship: Relationship) => {
    setResults((current) =>
      current.map((result) => (result.id === id ? { ...result, relationship } : result)),
    );
  }, []);

  const handlePress = useCallback(
    async (result: SearchResult) => {
      if (result.relationship === 'pending_in') {
        navigation.navigate('UserProfile', { userId: result.id });
        return;
      }
      setBusyId(result.id);
      try {
        if (result.relationship === 'none') {
          await followUser(result.id);
          setRelationship(result.id, 'pending_out');
        } else {
          const confirmed = await confirmAction({
            title: result.relationship === 'following' ? 'Unfollow?' : 'Cancel request?',
            message: `@${result.username}`,
            confirmLabel: result.relationship === 'following' ? 'Unfollow' : 'Cancel request',
            destructive: true,
          });
          if (!confirmed) return;
          await unfollowUser(result.id);
          setRelationship(result.id, 'none');
        }
      } catch (err) {
        showMessage('Error', err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setBusyId(null);
      }
    },
    [navigation, setRelationship],
  );

  return (
    <ScreenContainer>
      <AuthInput
        placeholder="Search by username"
        value={query}
        onChangeText={setQuery}
        autoFocus
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        style={styles.list}
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.person}
              onPress={() => navigation.navigate('UserProfile', { userId: item.id })}
              accessibilityRole="button"
            >
              <Avatar name={item.displayName} username={item.username} />
              <View style={styles.text}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.displayName || item.username}
                </Text>
                <Text style={styles.username} numberOfLines={1}>
                  @{item.username}
                </Text>
              </View>
            </TouchableOpacity>
            {item.relationship !== 'self' ? (
              <RelationshipButton
                relationship={item.relationship}
                busy={busyId === item.id}
                onPress={() => handlePress(item)}
              />
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          searching ? (
            <ActivityIndicator style={styles.spinner} color="#2563eb" />
          ) : (
            <Text style={styles.hint}>
              {trimmed.length < 2
                ? 'Type at least 2 characters of a username.'
                : 'No one found. Usernames are matched from the start.'}
            </Text>
          )
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  list: { marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  text: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  username: { fontSize: 13, color: '#64748b' },
  hint: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 24 },
  spinner: { marginTop: 24 },
  error: { color: '#dc2626', fontSize: 14, marginTop: 8 },
});
