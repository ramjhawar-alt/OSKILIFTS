import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { ScreenContainer } from '../components/ScreenContainer';
import { RootStackParamList } from '../types/navigation';
import { fetchWeightRoomStatus } from '../services/api';
import type { WeightRoomHours, WeightRoomStatus } from '../types/api';

type HomeNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

const STATUS_COLORS = {
  go: '#16a34a',
  wait: '#dc2626',
};

export const HomeScreen = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const [status, setStatus] = useState<WeightRoomStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchWeightRoomStatus();
      setStatus(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load capacity data.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

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
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>UC Berkeley</Text>
          <Text style={styles.title}>RSF Weight Room</Text>
          <Text style={styles.subtitle}>
            Live Density data plus up-to-date class listings.
          </Text>
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
              {status?.message ? (
                <Text style={styles.cardHint}>{status.message}</Text>
              ) : null}
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

        <Text
          style={styles.link}
          onPress={() => navigation.navigate('Classes')}
        >
          View RSF classes →
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
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
    marginTop: 24,
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
    marginTop: 20,
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
});

