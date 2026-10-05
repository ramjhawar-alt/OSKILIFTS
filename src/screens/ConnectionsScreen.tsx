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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '../components/Avatar';
import { ScreenContainer } from '../components/ScreenContainer';
import { useRequests } from '../contexts/RequestsContext';
import {
  acceptFollowRequest,
  getIncomingRequests,
  removeFollower,
} from '../services/socialService';
import type { RootStackParamList } from '../types/navigation';
import type { FollowRequest } from '../types/social';
import { showMessage } from '../utils/alert';

type ConnectionsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Connections'>;

export const ConnectionsScreen = () => {
  const navigation = useNavigation<ConnectionsNavigationProp>();
  const { refreshPending } = useRequests();
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await getIncomingRequests());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load requests.');
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
        data={requests}
        keyExtractor={(item) => item.followerId}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
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
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  spinner: { marginTop: 48 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12 },
  empty: { color: '#64748b', fontSize: 15, textAlign: 'center', marginTop: 32 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  text: { flex: 1 },
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
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  declineText: { color: '#475569', fontWeight: '600', fontSize: 15 },
});
