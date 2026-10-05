import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '../components/Avatar';
import { ScreenContainer } from '../components/ScreenContainer';
import { useRequests } from '../contexts/RequestsContext';
import {
  acceptFollowRequest,
  getBlockedUsers,
  getIncomingRequests,
  removeFollower,
  unblockUser,
} from '../services/socialService';
import type { RootStackParamList } from '../types/navigation';
import type { BlockedUser, FollowRequest } from '../types/social';
import { showMessage } from '../utils/alert';

type ConnectionsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Connections'>;
type Tab = 'requests' | 'blocked';

export const ConnectionsScreen = () => {
  const navigation = useNavigation<ConnectionsNavigationProp>();
  const route = useRoute();
  const { refreshPending } = useRequests();

  const [tab, setTab] = useState<Tab>(
    (route.params as { initialTab?: Tab } | undefined)?.initialTab ?? 'requests',
  );
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [incoming, blockedUsers] = await Promise.all([
        getIncomingRequests(),
        getBlockedUsers(),
      ]);
      setRequests(incoming);
      setBlocked(blockedUsers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const respond = useCallback(
    async (request: FollowRequest, accept: boolean) => {
      setBusyId(request.followerId);
      try {
        if (accept) await acceptFollowRequest(request.followerId);
        else await removeFollower(request.followerId);
        setRequests((current) => current.filter((r) => r.followerId !== request.followerId));
        refreshPending();
      } catch (err) {
        showMessage('Error', err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setBusyId(null);
      }
    },
    [refreshPending],
  );

  const unblock = useCallback(async (user: BlockedUser) => {
    setBusyId(user.userId);
    try {
      await unblockUser(user.userId);
      setBlocked((current) => current.filter((u) => u.userId !== user.userId));
    } catch (err) {
      showMessage('Error', err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusyId(null);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.spinner} size="large" color="#2563eb" />
      </ScreenContainer>
    );
  }

  const segments = (
    <View style={styles.segments}>
      {(
        [
          { value: 'requests', label: `Requests${requests.length ? ` (${requests.length})` : ''}` },
          { value: 'blocked', label: 'Blocked' },
        ] as { value: Tab; label: string }[]
      ).map((segment) => (
        <TouchableOpacity
          key={segment.value}
          style={[styles.segment, tab === segment.value && styles.segmentActive]}
          onPress={() => setTab(segment.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === segment.value }}
        >
          <Text style={[styles.segmentText, tab === segment.value && styles.segmentTextActive]}>
            {segment.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ScreenContainer>
      {segments}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {tab === 'requests' ? (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.followerId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.person}
                onPress={() => navigation.navigate('UserProfile', { userId: item.followerId })}
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
              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.accept}
                  onPress={() => respond(item, true)}
                  disabled={busyId === item.followerId}
                >
                  <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.decline}
                  onPress={() => respond(item, false)}
                  disabled={busyId === item.followerId}
                >
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No pending follow requests.</Text>}
        />
      ) : (
        <FlatList
          data={blocked}
          keyExtractor={(item) => item.userId}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <View style={[styles.row, styles.blockedRow]}>
              <View style={styles.person}>
                <Avatar name={item.displayName} username={item.username} />
                <View style={styles.text}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.displayName || item.username}
                  </Text>
                  <Text style={styles.username} numberOfLines={1}>
                    @{item.username}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.decline}
                onPress={() => unblock(item)}
                disabled={busyId === item.userId}
              >
                <Text style={styles.declineText}>Unblock</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>You haven’t blocked anyone.</Text>}
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  spinner: { marginTop: 48 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12 },
  empty: { color: '#64748b', fontSize: 15, textAlign: 'center', marginTop: 32 },
  segments: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  segmentTextActive: { color: '#2563eb' },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  blockedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  text: { flexShrink: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  username: { fontSize: 13, color: '#64748b' },
  actions: { flexDirection: 'row', gap: 8 },
  accept: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  decline: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexGrow: 1,
  },
  declineText: { color: '#475569', fontWeight: '600', fontSize: 15 },
});
