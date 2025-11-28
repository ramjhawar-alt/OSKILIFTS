import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../types/navigation';
import { fetchWeightRoomStatus } from '../services/api';
import { getPeakHours } from '../services/peakHoursService';
import { OskiBear } from '../components/OskiBear';
import { calculateWorkoutStreak } from '../services/bearStreakService';
import { getWorkouts } from '../services/workoutStorage';
import type { WeightRoomHours, WeightRoomStatus } from '../types/api';
import type { Workout } from '../types/workout';

const DEBUG_STREAK_KEY = '@oskilifts:debugStreak';
const DEBUG_TOTAL_WORKOUTS_KEY = '@oskilifts:debugTotalWorkouts';

type HomeNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const STATUS_COLORS = {
  go: '#16a34a',
  wait: '#dc2626',
};

export const HomeScreen = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const [status, setStatus] = useState<WeightRoomStatus | null>(null);
  const [loading, setLoading] = useState(false); // Start as false - cached data loads instantly
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);

  const loadData = useCallback(async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setError(null);
      }
      // This will return cached data immediately if available, then fetch fresh data in background
      const data = await fetchWeightRoomStatus(true);
      setStatus(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load capacity data.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkoutData = useCallback(async () => {
    try {
      // Check for debug override first
      const debugStreak = await AsyncStorage.getItem(DEBUG_STREAK_KEY);
      const debugTotalWorkouts = await AsyncStorage.getItem(DEBUG_TOTAL_WORKOUTS_KEY);
      
      if (debugStreak !== null) {
        // Use debug values
        setStreak(parseInt(debugStreak, 10));
        setTotalWorkouts(parseInt(debugTotalWorkouts || '10', 10));
      } else {
        // Use real workout data
        const allWorkouts = await getWorkouts();
        setWorkouts(allWorkouts);
        const currentStreak = calculateWorkoutStreak(allWorkouts);
        setStreak(currentStreak);
        setTotalWorkouts(allWorkouts.length);
      }
    } catch (error) {
      console.error('Error loading workouts for bear:', error);
    }
  }, []);

  useEffect(() => {
    // Load cached data immediately (no loading spinner), then refresh in background
    loadData(false); // Don't show loading spinner for cached data
    loadWorkoutData();
  }, [loadData, loadWorkoutData]);

  // Reload workout data when screen comes into focus (e.g., after saving a workout)
  useFocusEffect(
    useCallback(() => {
      loadWorkoutData();
    }, [loadWorkoutData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadWorkoutData()]);
    setRefreshing(false);
  }, [loadData, loadWorkoutData]);

  const statusColor = useMemo(() => {
    const label = status?.status?.toLowerCase() || '';
    if (label.includes('wait')) {
      return STATUS_COLORS.wait;
    }
    return STATUS_COLORS.go;
  }, [status?.status]);

  const percentText =
    status?.percent !== null && status?.percent !== undefined
      ? `${status.percent}%`
      : '—';

  const updatedLabel = status?.updatedAt
    ? `Updated ${new Date(status.updatedAt).toLocaleTimeString()}`
    : '';

  const renderHours = (hours: WeightRoomHours[]) =>
    hours.map((slot) => (
      <View key={slot.label} style={styles.hoursRow}>
        <Text style={styles.hoursLabel}>{slot.label}</Text>
        <Text style={styles.hoursValue}>
          {slot.open} – {slot.close}
        </Text>
      </View>
    ));

  return (
    <ScreenContainer>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>UC Berkeley</Text>
          <Text style={styles.title}>RSF Weight Room</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusPill, { backgroundColor: statusColor }]}>
              <Text style={styles.statusPillText}>
                {status?.status || 'Loading'}
              </Text>
            </View>
            {updatedLabel ? (
              <Text style={styles.timestamp}>{updatedLabel}</Text>
            ) : null}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color="#0f172a" />
          ) : error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : (
            <>
              <Text style={styles.capacityLabel}>Current Occupancy</Text>
              <Text style={styles.capacityValue}>
                {status?.occupancy ?? '—'}
                {status?.capacity ? ` / ${status.capacity}` : ''}
              </Text>
              <Text style={styles.percentValue}>{percentText} full</Text>
            </>
          )}
        </View>

        {status && !status.isOpen ? (
          <View style={styles.closedNotice}>
            <Text style={styles.closedTitle}>
              The RSF weight room is currently closed.
            </Text>
            <Text style={styles.closedSubtitle}>Regular hours</Text>
            {renderHours(status.hours ?? [])}
          </View>
        ) : null}

        <TouchableOpacity
          onLongPress={() => navigation.navigate('BearDebug')}
          activeOpacity={1}
        >
          <OskiBear streak={streak} totalWorkouts={totalWorkouts || workouts.length} />
        </TouchableOpacity>

        <View style={styles.peakHoursCard}>
          <Text style={styles.peakHoursTitle}>Peak Hours</Text>
          {getPeakHours().hasData ? (
            <>
              <Text style={styles.peakHoursText}>
                Usually busiest: {getPeakHours().busiest}
              </Text>
              <Text style={styles.peakHoursText}>
                Best time to go: {getPeakHours().bestTime}
              </Text>
            </>
          ) : (
            <Text style={styles.peakHoursPlaceholder}>
              {getPeakHours().message}
            </Text>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  header: {
    gap: 4,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
  },
  card: {
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#94a3b8',
  },
  capacityLabel: {
    fontSize: 14,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  capacityValue: {
    fontSize: 48,
    fontWeight: '700',
    color: '#0f172a',
  },
  percentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  cardHint: {
    fontSize: 14,
    color: '#94a3b8',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
  },
  closedNotice: {
    marginTop: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 8,
  },
  closedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#991b1b',
  },
  closedSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b91c1c',
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#fecaca',
    paddingVertical: 6,
  },
  hoursLabel: {
    fontSize: 14,
    color: '#7f1d1d',
    fontWeight: '600',
  },
  hoursValue: {
    fontSize: 14,
    color: '#7f1d1d',
  },
  link: {
    marginTop: 32,
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
  },
  peakHoursCard: {
    marginTop: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  peakHoursTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  peakHoursText: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 8,
    lineHeight: 20,
  },
  peakHoursPlaceholder: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

