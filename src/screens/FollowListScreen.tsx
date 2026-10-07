import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '../components/Avatar';
import { RelationshipButton } from '../components/RelationshipButton';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  CONNECTIONS_PAGE_SIZE,
  followUser,
  getConnections,
  unfollowUser,
} from '../services/socialService';
import type { RootStackParamList } from '../types/navigation';
import type { ConnectionUser, Relationship } from '../types/social';
import { confirmAction, showMessage } from '../utils/alert';

type FollowListNavigationProp = NativeStackNavigationProp<RootStackParamList, 'FollowList'>;

export const FollowListScreen = () => {
  const navigation = useNavigation<FollowListNavigationProp>();
  const { userId, kind } = useRoute().params as RootStackParamList['FollowList'];

  const [users, setUsers] = useState<ConnectionUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A refresh that starts while a page is loading must win, so every response
  // checks it still belongs to the latest request.
  const requestRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const request = (requestRef.current += 1);
    try {
      const page = await getConnections(userId, kind);
      if (request !== requestRef.current) return;
      setUsers(page);
      setHasMore(page.length >= CONNECTIONS_PAGE_SIZE);
      setError(null);
    } catch (err) {
      if (request !== requestRef.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load this list.');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [userId, kind]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || refreshing || !hasMore || users.length === 0) return;
    const last = users[users.length - 1];
    const request = requestRef.current;
    setLoadingMore(true);
    try {
      const page = await getConnections(userId, kind, { createdAt: last.createdAt, id: last.id });
      if (request !== requestRef.current) return;
      setUsers((current) => {
        const seen = new Set(current.map((user) => user.id));
        return [...current, ...page.filter((user) => !seen.has(user.id))];
      });
      setHasMore(page.length >= CONNECTIONS_PAGE_SIZE);
    } catch (err) {
      if (request !== requestRef.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load more.');
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, refreshing, hasMore, users, userId, kind]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadFirstPage();
    setRefreshing(false);
  }, [loadFirstPage]);

  const setRelationship = useCallback((id: string, relationship: Relationship) => {
    setUsers((current) =>
      current.map((user) => (user.id === id ? { ...user, relationship } : user)),
    );
  }, []);

  const openProfile = useCallback(
    (id: string) => navigation.push('UserProfile', { userId: id }),
    [navigation],
  );

  const handlePress = useCallback(
    async (user: ConnectionUser) => {
      if (user.relationship === 'pending_in') {
        openProfile(user.id);
        return;
      }
      setBusyId(user.id);
      try {
        if (user.relationship === 'none') {
          await followUser(user.id);
          setRelationship(user.id, 'pending_out');
        } else {
          const following = user.relationship === 'following';
          const confirmed = await confirmAction({
            title: following ? 'Unfollow?' : 'Cancel request?',
            message: `@${user.username}`,
            confirmLabel: following ? 'Unfollow' : 'Cancel request',
            destructive: true,
          });
          if (!confirmed) return;
          await unfollowUser(user.id);
          setRelationship(user.id, 'none');
        }
      } catch (err) {
        showMessage('Error', err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setBusyId(null);
      }
    },
    [openProfile, setRelationship],
  );

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.spinner} size="large" color="#2563eb" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity
              style={styles.person}
              onPress={() => openProfile(item.id)}
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
          <Text style={styles.empty}>
            {kind === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
          </Text>
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.footer} color="#2563eb" /> : null
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  spinner: { marginTop: 48 },
  footer: { marginVertical: 16 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12 },
  empty: { color: '#64748b', fontSize: 15, textAlign: 'center', marginTop: 32 },
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
});
