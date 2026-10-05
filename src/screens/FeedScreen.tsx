import { useCallback, useRef, useState } from 'react';
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

import { FeedWorkoutCard } from '../components/FeedWorkoutCard';
import { ScreenContainer } from '../components/ScreenContainer';
import { useRequests } from '../contexts/RequestsContext';
import { FEED_PAGE_SIZE, getFeed } from '../services/socialService';
import type { RootStackParamList } from '../types/navigation';
import type { FeedItem } from '../types/social';

type FeedNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feed'>;

export const FeedScreen = () => {
  const navigation = useNavigation<FeedNavigationProp>();
  const { refreshPending } = useRequests();

  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);

  const loadFirstPage = useCallback(async () => {
    try {
      const page = await getFeed();
      setItems(page);
      setHasMore(page.length === FEED_PAGE_SIZE);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your feed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFirstPage();
      refreshPending();
    }, [loadFirstPage, refreshPending]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadFirstPage(), refreshPending()]);
    setRefreshing(false);
  }, [loadFirstPage, refreshPending]);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || items.length === 0) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const last = items[items.length - 1];
      const page = await getFeed({ createdAt: last.createdAt, id: last.id });
      setItems((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.filter((item) => !seen.has(item.id))];
      });
      setHasMore(page.length === FEED_PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load more.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, items]);

  const openProfile = useCallback(
    (userId: string) => navigation.navigate('UserProfile', { userId }),
    [navigation],
  );

  if (loading) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedWorkoutCard item={item} onPressAuthor={openProfile} />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#2563eb" /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your feed is empty</Text>
            <Text style={styles.emptyText}>
              Follow other Berkeley lifters to see their workouts here. They’ll need to
              approve your request first.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate('SearchUsers')}
            >
              <Text style={styles.buttonText}>Find people</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingBottom: 32, flexGrow: 1 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12 },
  empty: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
