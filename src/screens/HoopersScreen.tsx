import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  getHoopersStatus,
  checkIn,
  checkOut,
  getOrCreateUserId,
  getCheckInStatus,
} from '../services/hoopersService';
import type { HoopersData } from '../types/hoopers';

export const HoopersScreen = () => {
  const [status, setStatus] = useState<HoopersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadUserId = useCallback(async () => {
    try {
      const id = await getOrCreateUserId();
      setUserId(id);
      return id;
    } catch (error) {
      console.error('Error loading user ID:', error);
      return null;
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      setError(null);
      const data = await getHoopersStatus();
      setStatus(data);
    } catch (error: any) {
      console.error('Error loading hoopers status:', error);
      setError(error.message || 'Failed to load basketball status');
    }
  }, []);

  const loadCheckInStatus = useCallback(async (id: string) => {
    try {
      const response = await getCheckInStatus(id);
      setCheckedIn(response.checkedIn);
    } catch (error) {
      console.error('Error loading check-in status:', error);
      // Don't set error state here, just log it
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    const id = await loadUserId();
    if (id) {
      await Promise.all([loadStatus(), loadCheckInStatus(id)]);
    } else {
      await loadStatus();
    }
    setLoading(false);
  }, [loadUserId, loadStatus, loadCheckInStatus]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && !checkingIn) {
        loadStatus();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading, checkingIn, loadStatus]);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadStatus();
        loadCheckInStatus(userId);
      }
    }, [userId, loadStatus, loadCheckInStatus])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  }, [loadAllData]);

  const handleCheckIn = async () => {
    if (!userId) {
      const id = await loadUserId();
      if (!id) {
        Alert.alert('Error', 'Unable to create user ID. Please try again.');
        return;
      }
      setUserId(id);
    }

    const idToUse = userId || (await loadUserId());
    if (!idToUse) {
      Alert.alert('Error', 'Unable to get user ID. Please try again.');
      return;
    }

    setCheckingIn(true);
    try {
      setError(null);
      const response = await checkIn(idToUse);
      setCheckedIn(true);
      setStatus({ count: response.count, status: response.status });
      Alert.alert('Checked In!', 'You\'re now marked as playing basketball.');
    } catch (error: any) {
      console.error('Error checking in:', error);
      Alert.alert('Error', error.message || 'Failed to check in. Please try again.');
    } finally {
      setCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!userId) {
      return;
    }

    setCheckingIn(true);
    try {
      setError(null);
      const response = await checkOut(userId);
      setCheckedIn(false);
      setStatus({ count: response.count, status: response.status });
      Alert.alert('Checked Out!', 'You\'re no longer marked as playing basketball.');
    } catch (error: any) {
      console.error('Error checking out:', error);
      Alert.alert('Error', error.message || 'Failed to check out. Please try again.');
    } finally {
      setCheckingIn(false);
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

  if (loading && !status) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading basketball status...</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>HOOPERS</Text>
          <Text style={styles.subtitle}>RSF Basketball Court Status</Text>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={loadStatus}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {status && (
          <>
            <View style={styles.statusCard}>
              <Text style={styles.countLabel}>People Playing</Text>
              <Text style={styles.countValue}>{status.count}</Text>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: getStatusBgColor(status.status),
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: getStatusColor(status.status) },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: getStatusColor(status.status) },
                  ]}
                >
                  {status.status}
                </Text>
              </View>
            </View>

            <View style={styles.actionSection}>
              {checkedIn ? (
                <>
                  <View style={styles.checkedInBadge}>
                    <Text style={styles.checkedInText}>✓ You're checked in</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.checkOutButton]}
                    onPress={handleCheckOut}
                    disabled={checkingIn}
                  >
                    {checkingIn ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.actionButtonText}>
                        I'm Done Playing
                      </Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.actionButton, styles.checkInButton]}
                  onPress={handleCheckIn}
                  disabled={checkingIn}
                >
                  {checkingIn ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.actionButtonText}>
                      I'm Playing Basketball
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>How it works</Text>
              <Text style={styles.infoText}>
                • Tap "I'm Playing Basketball" when you start playing{'\n'}
                • Tap "I'm Done Playing" when you finish{'\n'}
                • You'll be automatically removed after 1 hour{'\n'}
                • Status updates every 30 seconds
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

