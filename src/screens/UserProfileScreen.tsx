import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '../components/Avatar';
import { FeedWorkoutCard } from '../components/FeedWorkoutCard';
import { RelationshipButton } from '../components/RelationshipButton';
import { SafetySheet, type SafetyTarget } from '../components/SafetySheet';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { useRequests } from '../contexts/RequestsContext';
import { SUPPORT_EMAIL } from '../config/legal';
import { calculateWorkoutStreak } from '../services/bearStreakService';
import {
  FEED_PAGE_SIZE,
  acceptFollowRequest,
  attachCommentCounts,
  deleteMyAccount,
  setWeightUnit,
  setAccountPublic,
  followUser,
  getProfileSummary,
  getUserWorkouts,
  likeWorkout,
  removeFollower,
  unfollowUser,
  unlikeWorkout,
} from '../services/socialService';
import type { RootStackParamList } from '../types/navigation';
import type { FeedItem, ProfileSummary } from '../types/social';
import { getEmailPrefs, setWeeklyDigest } from '../services/emailPrefsService';
import { confirmAction, showMessage } from '../utils/alert';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'UserProfile'>;

export const UserProfileScreen = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const route = useRoute();
  const { user, signOut } = useAuth();
  const { pendingCount, refreshPending, isAdmin, adminOpenCount } = useRequests();
  const { profile, setProfile } = useProfile();

  const routeUserId = (route.params as { userId?: string } | undefined)?.userId;
  const userId = routeUserId ?? user?.id ?? '';

  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyTarget, setSafetyTarget] = useState<SafetyTarget | null>(null);
  const [workouts, setWorkouts] = useState<FeedItem[]>([]);
  const [hasMoreWorkouts, setHasMoreWorkouts] = useState(false);
  const [loadingMoreWorkouts, setLoadingMoreWorkouts] = useState(false);
  const [recapOn, setRecapOn] = useState<boolean | null>(null); // null: not available yet

  const load = useCallback(async () => {
    try {
      const loaded = await getProfileSummary(userId);
      setSummary(loaded);
      setError(null);
      if (loaded && loaded.workoutCount !== null) {
        const page = await attachCommentCounts(await getUserWorkouts(userId));
        setWorkouts(page);
        setHasMoreWorkouts(page.length >= FEED_PAGE_SIZE);
      } else {
        setWorkouts([]);
        setHasMoreWorkouts(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load this profile.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshPending();
      getEmailPrefs().then((prefs) => setRecapOn(prefs ? prefs.weeklyDigest : null));
    }, [load, refreshPending]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: summary?.username ? `@${summary.username}` : 'Profile',
    });
  }, [navigation, summary?.username]);

  const streak = useMemo(
    () =>
      summary?.workoutDates
        ? calculateWorkoutStreak(summary.workoutDates.map((date) => ({ date })))
        : null,
    [summary?.workoutDates],
  );

  const loadMoreWorkouts = useCallback(async () => {
    if (loadingMoreWorkouts || !hasMoreWorkouts || workouts.length === 0) return;
    const last = workouts[workouts.length - 1];
    setLoadingMoreWorkouts(true);
    try {
      const page = await attachCommentCounts(
        await getUserWorkouts(userId, { createdAt: last.createdAt, id: last.id }),
      );
      setWorkouts((current) => {
        const seen = new Set(current.map((item) => item.id));
        return [...current, ...page.filter((item) => !seen.has(item.id))];
      });
      setHasMoreWorkouts(page.length >= FEED_PAGE_SIZE);
    } catch (err) {
      showMessage('Error', err instanceof Error ? err.message : 'Unable to load more workouts.');
    } finally {
      setLoadingMoreWorkouts(false);
    }
  }, [hasMoreWorkouts, loadingMoreWorkouts, userId, workouts]);

  const toggleLike = useCallback(async (item: FeedItem) => {
    const nextLiked = !item.likedByMe;
    const apply = (liked: boolean, delta: number) =>
      setWorkouts((current) =>
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
      showMessage('Error', err instanceof Error ? err.message : 'Unable to update your like.');
    }
  }, []);

  const changeVisibility = useCallback(
    async (makePublic: boolean) => {
      if (!profile || profile.isPublic === makePublic) return;
      const confirmed = await confirmAction({
        title: makePublic ? 'Make your account public?' : 'Make your account private?',
        message: makePublic
          ? 'Anyone at Berkeley will be able to follow you without approval, see your profile and followers, and see the workouts you share. Your shared workouts can appear on Explore. Requests waiting on you will be approved. Workouts marked Only me stay hidden.'
          : 'Only followers you approve will see your shared workouts. People who already follow you keep following.',
        confirmLabel: makePublic ? 'Make public' : 'Make private',
      });
      if (!confirmed) return;
      const previous = profile;
      setProfile({ ...profile, isPublic: makePublic }); // optimistic
      try {
        await setAccountPublic(makePublic);
        await load();
      } catch (err) {
        setProfile(previous);
        showMessage('Couldn’t change your account', err instanceof Error ? err.message : 'Please try again.');
      }
    },
    [load, profile, setProfile],
  );

  const run = useCallback(
    async (action: () => Promise<void>) => {
      setBusy(true);
      try {
        await action();
        await load();
        refreshPending();
      } catch (err) {
        showMessage('Error', err instanceof Error ? err.message : 'Something went wrong.');
      } finally {
        setBusy(false);
      }
    },
    [load, refreshPending],
  );

  const handleRelationshipPress = useCallback(async () => {
    if (!summary) return;
    if (summary.relationship === 'none') {
      await run(async () => {
        await followUser(summary.id);
      });
    } else if (summary.relationship === 'pending_out' || summary.relationship === 'following') {
      const following = summary.relationship === 'following';
      const confirmed = await confirmAction({
        title: following ? 'Unfollow?' : 'Cancel request?',
        message: summary.username ? `@${summary.username}` : undefined,
        confirmLabel: following ? 'Unfollow' : 'Cancel request',
        destructive: true,
      });
      if (confirmed) await run(() => unfollowUser(summary.id));
    }
  }, [run, summary]);

  const changeUnit = useCallback(
    async (unit: 'lb' | 'kg') => {
      if (!profile || profile.weightUnit === unit) return;
      const previous = profile;
      setProfile({ ...profile, weightUnit: unit }); // optimistic
      try {
        await setWeightUnit(unit);
      } catch (err) {
        setProfile(previous);
        showMessage('Couldn’t change units', err instanceof Error ? err.message : 'Please try again.');
      }
    },
    [profile, setProfile],
  );

  const toggleRecap = useCallback(async () => {
    if (recapOn === null) return;
    const next = !recapOn;
    setRecapOn(next); // optimistic
    try {
      await setWeeklyDigest(next);
    } catch (err) {
      setRecapOn(!next);
      showMessage('Couldn’t change that', err instanceof Error ? err.message : 'Please try again.');
    }
  }, [recapOn]);

  const handleDeleteAccount = useCallback(async () => {
    const confirmed = await confirmAction({
      title: 'Delete your account?',
      message:
        'This permanently deletes your profile, workouts, follows and likes. This can’t be undone.',
      confirmLabel: 'Delete account',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteMyAccount();
      await signOut().catch(() => undefined);
    } catch (err) {
      showMessage('Error', err instanceof Error ? err.message : 'Unable to delete your account.');
    }
  }, [signOut]);

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.spinner} size="large" color="#2563eb" />
      </ScreenContainer>
    );
  }

  if (!summary) {
    return (
      <ScreenContainer>
        <Text style={styles.empty}>{error ?? 'This profile isn’t available.'}</Text>
      </ScreenContainer>
    );
  }

  const isSelf = summary.relationship === 'self';
  const canSeeWorkouts = summary.workoutCount !== null;
  // Same rule the server enforces for get_connections: yourself or people you follow.
  const canSeeLists = isSelf || summary.relationship === 'following';
  const openList = (kind: 'followers' | 'following') =>
    navigation.push('FollowList', { userId: summary.id, kind, username: summary.username });

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={styles.content}
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
      >
        <View style={styles.card}>
          <Avatar name={summary.displayName} username={summary.username} size={72} />
          <Text style={styles.name}>{summary.displayName || summary.username}</Text>
          <Text style={styles.username}>@{summary.username}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge2, summary.isPublic ? styles.badgePublic : styles.badgePrivate]}>
              <Text style={[styles.badge2Text, summary.isPublic ? styles.badgePublicText : styles.badgePrivateText]}>
                {summary.isPublic ? 'Public' : 'Private'}
              </Text>
            </View>
            {summary.relationship === 'following' && summary.followsYou ? (
              <View style={[styles.badge2, styles.badgeFriends]}>
                <Text style={[styles.badge2Text, styles.badgeFriendsText]}>Friends</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.stats}>
            <Stat
              label="Followers"
              value={summary.followerCount}
              onPress={canSeeLists ? () => openList('followers') : undefined}
            />
            <Stat
              label="Following"
              value={summary.followingCount}
              onPress={canSeeLists ? () => openList('following') : undefined}
            />
            {canSeeWorkouts ? <Stat label="Workouts" value={summary.workoutCount ?? 0} /> : null}
            {streak !== null ? <Stat label="Day streak" value={streak} /> : null}
          </View>

          {!isSelf && summary.relationship !== 'pending_in' ? (
            <RelationshipButton
              relationship={summary.relationship as Exclude<typeof summary.relationship, 'self' | 'pending_in'>}
              busy={busy}
              onPress={handleRelationshipPress}
              friends={summary.relationship === 'following' && summary.followsYou}
              followBack={summary.relationship === 'none' && summary.followsYou}
            />
          ) : null}

          {summary.relationship === 'pending_in' ? (
            <View style={styles.respondRow}>
              <TouchableOpacity
                style={styles.accept}
                disabled={busy}
                onPress={() => run(() => acceptFollowRequest(summary.id))}
              >
                <Text style={styles.acceptText}>Accept request</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.decline}
                disabled={busy}
                onPress={() => run(() => removeFollower(summary.id))}
              >
                <Text style={styles.declineText}>Decline</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isSelf && !canSeeWorkouts ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>This account is private</Text>
            <Text style={styles.noticeText}>
              {summary.relationship === 'pending_out'
                ? 'Your request is waiting for approval. You’ll see their workouts once they accept.'
                : 'Send a follow request to see their workouts once they approve you.'}
            </Text>
          </View>
        ) : null}

        {canSeeWorkouts ? (
          <View style={styles.workoutsSection}>
            <Text style={styles.sectionTitle}>Workouts</Text>
            {workouts.length === 0 ? (
              <Text style={styles.empty}>
                {isSelf ? 'You haven’t logged a workout yet.' : 'No shared workouts yet.'}
              </Text>
            ) : (
              workouts.map((item) => (
                <FeedWorkoutCard
                  key={item.id}
                  item={item}
                  hideAuthor
                  onPressAuthor={() => undefined}
                  onToggleLike={toggleLike}
                  onOpenComments={(entry) =>
                    navigation.navigate('Comments', { workoutId: entry.id, canOpenProfiles: true })
                  }
                  onMore={
                    isSelf
                      ? undefined
                      : (entry) =>
                          setSafetyTarget({
                            kind: 'workout',
                            workoutId: entry.id,
                            userId: entry.userId,
                            username: entry.username,
                          })
                  }
                />
              ))
            )}
            {hasMoreWorkouts ? (
              <TouchableOpacity style={styles.moreButton} onPress={loadMoreWorkouts} disabled={loadingMoreWorkouts}>
                {loadingMoreWorkouts ? (
                  <ActivityIndicator color="#2563eb" />
                ) : (
                  <Text style={styles.moreButtonText}>Show more</Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {!isSelf ? (
          <TouchableOpacity
            onPress={() =>
              setSafetyTarget({ kind: 'profile', userId: summary.id, username: summary.username })
            }
            style={styles.reportLink}
          >
            <Text style={styles.reportLinkText}>Report or block</Text>
          </TouchableOpacity>
        ) : null}

        {isSelf && profile ? (
          <View style={styles.unitsRow}>
            <View style={styles.visibilityText}>
              <Text style={styles.menuLabel}>Account</Text>
              <Text style={styles.unitsHint}>
                {profile.isPublic
                  ? 'Public: anyone at Berkeley can follow you and see your shared workouts'
                  : 'Private: people need your approval to follow you'}
              </Text>
            </View>
            <View style={styles.unitsToggle}>
              {([false, true] as const).map((makePublic) => (
                <TouchableOpacity
                  key={String(makePublic)}
                  style={[styles.unitsOption, profile.isPublic === makePublic && styles.unitsOptionActive]}
                  onPress={() => changeVisibility(makePublic)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: profile.isPublic === makePublic }}
                >
                  <Text style={[styles.unitsText, profile.isPublic === makePublic && styles.unitsTextActive]}>
                    {makePublic ? 'Public' : 'Private'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {isSelf && recapOn !== null ? (
          <View style={styles.unitsRow}>
            <View style={styles.visibilityText}>
              <Text style={styles.menuLabel}>Weekly recap email</Text>
              <Text style={styles.unitsHint}>
                {recapOn ? 'On: one email on Sunday evenings, only if something happened' : 'Off: we never email you about activity'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.recapToggle, recapOn && styles.recapToggleOn]}
              onPress={toggleRecap}
              accessibilityRole="switch"
              accessibilityState={{ checked: recapOn }}
              aria-checked={recapOn}
              accessibilityLabel="Weekly recap email"
            >
              <Text style={[styles.recapToggleText, recapOn && styles.recapToggleTextOn]}>{recapOn ? 'On' : 'Off'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isSelf && profile ? (
          <View style={styles.unitsRow}>
            <View>
              <Text style={styles.menuLabel}>Units</Text>
              <Text style={styles.unitsHint}>Weights and distances you see</Text>
            </View>
            <View style={styles.unitsToggle}>
              {(['lb', 'kg'] as const).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[styles.unitsOption, profile.weightUnit === unit && styles.unitsOptionActive]}
                  onPress={() => changeUnit(unit)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: profile.weightUnit === unit }}
                >
                  <Text style={[styles.unitsText, profile.weightUnit === unit && styles.unitsTextActive]}>
                    {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {isSelf ? (
          <View style={styles.menu}>
            <MenuRow
              label="Follow requests"
              badge={pendingCount}
              onPress={() => navigation.navigate('Connections', { initialTab: 'requests' })}
            />
            {isAdmin ? (
              <MenuRow
                label="Moderation"
                badge={adminOpenCount}
                onPress={() => navigation.navigate('Moderation')}
              />
            ) : null}
            <MenuRow label="Find people" onPress={() => navigation.navigate('SearchUsers')} />
            <MenuRow
              label="Blocked users"
              onPress={() => navigation.navigate('Connections', { initialTab: 'blocked' })}
            />
            <MenuRow label="Community guidelines" onPress={() => navigation.navigate('Guidelines')} />
            <MenuRow
              label="Contact support"
              onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            />
            <MenuRow
              label="Sign out"
              onPress={() => signOut().catch((e) => console.error('Sign out failed:', e))}
            />
            <MenuRow label="Delete account" destructive onPress={handleDeleteAccount} />
          </View>
        ) : null}
      </ScrollView>
      <SafetySheet
        target={isSelf ? null : safetyTarget}
        onClose={() => setSafetyTarget(null)}
        onBlocked={() => navigation.goBack()}
      />
    </ScreenContainer>
  );
};

const Stat = ({
  label,
  value,
  onPress,
}: {
  label: string;
  value: number;
  onPress?: () => void;
}) => {
  const content = (
    <>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={styles.stat}>{content}</View>;
  return (
    <TouchableOpacity
      style={styles.stat}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${value} ${label.toLowerCase()}, view list`}
    >
      {content}
    </TouchableOpacity>
  );
};

const MenuRow = ({
  label,
  badge,
  destructive,
  onPress,
}: {
  label: string;
  badge?: number;
  destructive?: boolean;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.menuRow} onPress={onPress} accessibilityRole="button">
    <Text style={[styles.menuLabel, destructive && styles.menuDestructive]}>{label}</Text>
    {badge ? (
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{badge}</Text>
      </View>
    ) : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  spinner: { marginTop: 48 },
  content: { paddingBottom: 48, gap: 16 },
  empty: { color: '#64748b', fontSize: 15, textAlign: 'center', marginTop: 32 },
  error: { color: '#dc2626', fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  name: { fontSize: 22, fontWeight: '700', color: '#0f172a', marginTop: 4 },
  username: { fontSize: 15, color: '#64748b' },
  badges: { flexDirection: 'row', gap: 8 },
  badge2: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badge2Text: { fontSize: 12, fontWeight: '700' },
  badgePublic: { backgroundColor: '#dcfce7' },
  badgePublicText: { color: '#15803d' },
  badgePrivate: { backgroundColor: '#f1f5f9' },
  badgePrivateText: { color: '#475569' },
  badgeFriends: { backgroundColor: '#fef3c7' },
  badgeFriendsText: { color: '#92400e' },
  visibilityText: { flex: 1, paddingRight: 12 },
  recapToggle: {
    minWidth: 64,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  recapToggleOn: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  recapToggleText: { fontSize: 14, fontWeight: '700', color: '#475569' },
  recapToggleTextOn: { color: '#fff' },
  workoutsSection: { gap: 4 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  moreButton: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20 },
  moreButtonText: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
  stats: { flexDirection: 'row', gap: 24, marginVertical: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700', color: '#003262' },
  statLabel: { fontSize: 12, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  respondRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
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
  notice: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 16,
    gap: 4,
  },
  noticeTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  noticeText: { fontSize: 14, color: '#64748b' },
  reportLink: { alignSelf: 'center', paddingVertical: 8 },
  reportLinkText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  unitsRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitsHint: { fontSize: 13, color: '#64748b', marginTop: 2 },
  unitsToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
  },
  unitsOption: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 8 },
  unitsOptionActive: { backgroundColor: '#fff' },
  unitsText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  unitsTextActive: { color: '#2563eb' },
  menu: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuLabel: { fontSize: 16, color: '#0f172a', fontWeight: '500' },
  menuDestructive: { color: '#dc2626' },
  badge: {
    backgroundColor: '#dc2626',
    borderRadius: 10,
    minWidth: 20,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
