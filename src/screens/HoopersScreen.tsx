import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar } from '../components/Avatar';
import { ScreenContainer } from '../components/ScreenContainer';
import { checkedInLabel, crowdednessStatus } from '../domain/hoopers';
import { timeLeftLabel } from '../domain/rsfHeading';
import {
  checkIn,
  checkOut,
  getCourt,
  type CourtSnapshot,
} from '../services/hoopersCheckinService';
import type { RootStackParamList } from '../types/navigation';
import { showMessage } from '../utils/alert';

type HoopersNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Hoopers'>;

const REFRESH_MS = 30_000;

export const HoopersScreen = () => {
  const navigation = useNavigation<HoopersNavigationProp>();
  const [court, setCourt] = useState<CourtSnapshot | null>(null);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A response from before the latest toggle/refresh must not overwrite it.
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const request = (requestRef.current += 1);
    try {
      const snapshot = await getCourt(friendsOnly);
      if (request !== requestRef.current) return;
      setCourt(snapshot);
      setError(null);
    } catch (err) {
      if (request !== requestRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load basketball status');
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, [friendsOnly]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Auto-refresh every 30 seconds (also drops check-ins that expired meanwhile).
  useEffect(() => {
    const interval = setInterval(() => {
      if (!busy) load();
    }, REFRESH_MS);
    return () => clearInterval(interval);
  }, [busy, load]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const toggleCheckIn = async () => {
    if (!court) return;
    setBusy(true);
    try {
      if (court.myCheckInEndsAt) await checkOut();
      else await checkIn();
      await load();
    } catch (err) {
      showMessage(
        court.myCheckInEndsAt ? 'Couldn’t check out' : 'Couldn’t check in',
        err instanceof Error ? err.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const getStatusColor = (statusText: string) => {
    switch (statusText) {
      case 'Not Crowded':
        return '#16a34a'; // green
      case 'Moderate':
        return '#eab308'; // yellow
      case 'Very Crowded':
        return '#dc2626'; // red
      default:
        return '#64748b'; // gray
    }
  };

  const getStatusBgColor = (statusText: string) => {
    switch (statusText) {
      case 'Not Crowded':
        return '#dcfce7'; // light green
      case 'Moderate':
        return '#fef9c3'; // light yellow
      case 'Very Crowded':
        return '#fee2e2'; // light red
      default:
        return '#f1f5f9'; // light gray
    }
  };

  if (loading && !court) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading basketball status...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const crowd = court ? crowdednessStatus(court.count) : null;
  const checkedIn = Boolean(court?.myCheckInEndsAt);
  const now = new Date();

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>HOOPERS</Text>
          <Text style={styles.subtitle}>RSF Basketball Court Status</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={load}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {court && crowd && (
          <>
            <View style={styles.statusCard}>
              <Text style={styles.countLabel}>People Playing</Text>
              <Text style={styles.countValue}>{court.count}</Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusBgColor(crowd) }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(crowd) }]} />
                <Text style={[styles.statusText, { color: getStatusColor(crowd) }]}>{crowd}</Text>
              </View>
            </View>

            <View style={styles.actionSection}>
              {checkedIn ? (
                <View style={styles.checkedInBadge}>
                  <Text style={styles.checkedInText}>
                    ✓ You’re checked in · {timeLeftLabel(court.myCheckInEndsAt as string, now)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.consent}>
                  Checking in shows your username to everyone at Berkeley for up to an hour, even if
                  your account is private. Don’t want that? Just don’t check in.
                </Text>
              )}
              <TouchableOpacity
                style={[styles.actionButton, checkedIn ? styles.checkOutButton : styles.checkInButton]}
                onPress={toggleCheckIn}
                disabled={busy}
                accessibilityRole="button"
              >
                {busy ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.actionButtonText}>
                    {checkedIn ? 'I’m Done Playing' : 'I’m Playing Basketball'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.listSection}>
              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>Who’s playing</Text>
                <View style={styles.toggle}>
                  {([false, true] as const).map((onlyFriends) => (
                    <TouchableOpacity
                      key={String(onlyFriends)}
                      style={[styles.toggleOption, friendsOnly === onlyFriends && styles.toggleOptionActive]}
                      onPress={() => setFriendsOnly(onlyFriends)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: friendsOnly === onlyFriends }}
                    >
                      <Text style={[styles.toggleText, friendsOnly === onlyFriends && styles.toggleTextActive]}>
                        {onlyFriends ? 'Friends' : 'Everyone'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {court.hoopers.length === 0 ? (
                <Text style={styles.emptyList}>
                  {friendsOnly
                    ? 'None of your friends are playing right now. Friends are people you follow who follow you back.'
                    : checkedIn
                      ? 'Nobody else has checked in yet.'
                      : 'Nobody has checked in yet.'}
                </Text>
              ) : (
                court.hoopers.map((hooper) => (
                  <TouchableOpacity
                    key={hooper.id}
                    style={styles.hooperRow}
                    onPress={() => navigation.navigate('UserProfile', { userId: hooper.id })}
                    accessibilityRole="button"
                    accessibilityLabel={`Open @${hooper.username}`}
                  >
                    <Avatar name={hooper.displayName} username={hooper.username} />
                    <View style={styles.hooperText}>
                      <Text style={styles.hooperName} numberOfLines={1}>
                        {hooper.displayName || hooper.username}
                      </Text>
                      <Text style={styles.hooperMeta} numberOfLines={1}>
                        @{hooper.username} · {checkedInLabel(hooper.checkedInAt, now)}
                      </Text>
                    </View>
                    {hooper.isFriend ? (
                      <View style={styles.friendPill}>
                        <Text style={styles.friendPillText}>Friend</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>How it works</Text>
              <Text style={styles.infoText}>
                • Tap “I’m Playing Basketball” when you start playing{'\n'}
                • Tap “I’m Done Playing” when you finish{'\n'}
                • You’re removed automatically after 1 hour{'\n'}
                • The list updates every 30 seconds
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  errorContainer: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    fontSize: 14,
    color: '#dc2626',
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#dc2626',
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  countLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
    fontWeight: '500',
  },
  countValue: {
    fontSize: 64,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionSection: {
    marginBottom: 24,
  },
  checkedInBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  checkedInText: {
    color: '#16a34a',
    fontSize: 14,
    fontWeight: '600',
  },
  actionButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkInButton: {
    backgroundColor: '#2563eb',
  },
  checkOutButton: {
    backgroundColor: '#64748b',
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  listSection: { marginBottom: 24 },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  listTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a' },
  toggle: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 3 },
  toggleOption: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8 },
  toggleOptionActive: { backgroundColor: '#fff' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  toggleTextActive: { color: '#2563eb' },
  hooperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  hooperText: { flex: 1 },
  hooperName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  hooperMeta: { fontSize: 13, color: '#64748b' },
  friendPill: { backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  friendPillText: { color: '#92400e', fontSize: 12, fontWeight: '700' },
  emptyList: { color: '#64748b', fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  consent: { fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 18 },
  infoSection: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
});

