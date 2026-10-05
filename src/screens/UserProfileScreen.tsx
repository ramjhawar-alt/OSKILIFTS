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
import { RelationshipButton } from '../components/RelationshipButton';
import { SafetySheet } from '../components/SafetySheet';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../contexts/AuthContext';
import { useRequests } from '../contexts/RequestsContext';
import { SUPPORT_EMAIL } from '../config/legal';
import { calculateWorkoutStreak } from '../services/bearStreakService';
import {
  acceptFollowRequest,
  deleteMyAccount,
  followUser,
  getProfileSummary,
  removeFollower,
  unfollowUser,
} from '../services/socialService';
import type { RootStackParamList } from '../types/navigation';
import type { ProfileSummary } from '../types/social';
import { confirmAction, showMessage } from '../utils/alert';

type ProfileNavigationProp = NativeStackNavigationProp<RootStackParamList, 'UserProfile'>;

export const UserProfileScreen = () => {
  const navigation = useNavigation<ProfileNavigationProp>();
  const route = useRoute();
  const { user, signOut } = useAuth();
  const { pendingCount, refreshPending } = useRequests();

  const routeUserId = (route.params as { userId?: string } | undefined)?.userId;
  const userId = routeUserId ?? user?.id ?? '';

  const [summary, setSummary] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setSummary(await getProfileSummary(userId));
      setError(null);
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
      await run(() => followUser(summary.id));
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

          <View style={styles.stats}>
            <Stat label="Followers" value={summary.followerCount} />
            <Stat label="Following" value={summary.followingCount} />
            {canSeeWorkouts ? <Stat label="Workouts" value={summary.workoutCount ?? 0} /> : null}
            {streak !== null ? <Stat label="Day streak" value={streak} /> : null}
          </View>

          {!isSelf && summary.relationship !== 'pending_in' ? (
            <RelationshipButton
              relationship={summary.relationship as Exclude<typeof summary.relationship, 'self' | 'pending_in'>}
              busy={busy}
              onPress={handleRelationshipPress}
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
                : 'Follow this person to see their workouts once they approve you.'}
            </Text>
          </View>
        ) : null}

        {!isSelf ? (
          <TouchableOpacity onPress={() => setSafetyOpen(true)} style={styles.reportLink}>
            <Text style={styles.reportLinkText}>Report or block</Text>
          </TouchableOpacity>
        ) : null}

        {isSelf ? (
          <View style={styles.menu}>
            <MenuRow
              label="Follow requests"
              badge={pendingCount}
              onPress={() => navigation.navigate('Connections', { initialTab: 'requests' })}
            />
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
        target={
          safetyOpen && !isSelf
            ? { kind: 'profile', userId: summary.id, username: summary.username }
            : null
        }
        onClose={() => setSafetyOpen(false)}
        onBlocked={() => navigation.goBack()}
      />
    </ScreenContainer>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

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
