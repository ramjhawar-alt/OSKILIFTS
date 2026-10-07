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
import { SafetySheet, type SafetyTarget } from '../components/SafetySheet';
import {
  FEED_PAGE_SIZE,
  attachCommentCounts,
  getExplore,
  getFeed,
  likeWorkout,
  unlikeWorkout,
} from '../services/socialService';
import type { RootStackParamList } from '../types/navigation';
import type { FeedItem } from '../types/social';

type FeedNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Feed'>;

type FeedMode = 'following' | 'explore';

const FETCHERS = {
  following: getFeed,
  explore: getExplore,
} as const;

export const FeedScreen = () => {
  const navigation = useNavigation<FeedNavigationProp>();
  const { refreshPending } = useRequests();

  const [mode, setMode] = useState<FeedMode>('following');
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadingMoreRef = useRef(false);
  const [safetyTarget, setSafetyTarget] = useState<SafetyTarget | null>(null);

  // A tab switch (or refresh) while a request is in flight must win, so every
  // response checks it still belongs to the latest request.
  const requestRef = useRef(0);

  const loadFirstPage = useCallback(async () => {
    const request = (requestRef.current += 1);
    try {
      const page = await attachCommentCounts(await FETCHERS[mode]());
      if (request !== requestRef.current) return;
      setItems(page);
      setHasMore(page.length === FEED_PAGE_SIZE);
      setError(null);
    } catch (err) {
      if (request !== requestRef.current) return;
      setError(err instanceof Error ? err.message : 'Unable to load your feed.');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [mode]);

  const switchMode = useCallback(
    (next: FeedMode) => {
      if (next === mode) return;
      setMode(next);
      setItems([]);
      setHasMore(true);
      setError(null);
      setLoading(true);
    },
    [mode],
  );

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
      const page = await attachCommentCounts(
        await FETCHERS[mode]({ createdAt: last.createdAt, id: last.id }),
      );
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
  }, [hasMore, items, mode]);

  const openProfile = useCallback(
    (userId: string) => navigation.navigate('UserProfile', { userId }),
    [navigation],
  );

  const toggleLike = useCallback(async (item: FeedItem) => {
    const nextLiked = !item.likedByMe;
    const apply = (liked: boolean, delta: number) =>
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, likedByMe: liked, likeCount: Math.max(0, entry.likeCount + delta) }
            : entry,
        ),
      );
    apply(nextLiked, nextLiked ? 1 : -1);
    try {
      if (nextLiked) await likeWorkout(item.id);
      else await unlikeWorkout(item.id);
    } catch (err) {
      apply(item.likedByMe, nextLiked ? -1 : 1);
      setError(err instanceof Error ? err.message : 'Unable to update your like.');
    }
  }, []);

  const handleBlocked = useCallback((userId: string) => {
    setItems((current) => current.filter((entry) => entry.userId !== userId));
  }, []);

  const segments = (
    <View style={styles.segments}>
      {(
        [
          { value: 'following', label: 'Following' },
          { value: 'explore', label: 'Explore' },
        ] as { value: FeedMode; label: string }[]
      ).map((segment) => (
        <TouchableOpacity
          key={segment.value}
          style={[styles.segment, mode === segment.value && styles.segmentActive]}
          onPress={() => switchMode(segment.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: mode === segment.value }}
        >
          <Text style={[styles.segmentText, mode === segment.value && styles.segmentTextActive]}>
            {segment.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <ScreenContainer>
      {segments}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!loading ? (
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedWorkoutCard
            item={item}
            onPressAuthor={openProfile}
            onToggleLike={toggleLike}
            onOpenComments={(entry) =>
              navigation.navigate('Comments', { workoutId: entry.id, canOpenProfiles: true })
            }
            onMore={(entry) =>
              setSafetyTarget({
                kind: 'workout',
                workoutId: entry.id,
                userId: entry.userId,
                username: entry.username,
              })
            }
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator color="#2563eb" /> : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {mode === 'explore' ? 'Nothing to explore yet' : 'Your feed is empty'}
            </Text>
            <Text style={styles.emptyText}>
              {mode === 'explore'
                ? 'Workouts from public accounts show up here. Be the first: make your account public from your profile.'
                : 'Follow other Berkeley lifters to see their workouts here. Public accounts accept right away; private ones need to approve you.'}
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
      ) : null}
      <SafetySheet
        target={safetyTarget}
        onClose={() => setSafetyTarget(null)}
        onBlocked={handleBlocked}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 4,
    marginBottom: 12,
  },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  segmentTextActive: { color: '#2563eb' },
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
