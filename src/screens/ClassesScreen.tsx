import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ScreenContainer } from '../components/ScreenContainer';
import { fetchClassSchedule } from '../services/api';
import type { ClassDay, ClassScheduleResponse } from '../types/api';

const ALL_FILTER = 'All';

export const ClassesScreen = () => {
  const [schedule, setSchedule] = useState<ClassScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>(ALL_FILTER);
  const [error, setError] = useState<string | null>(null);

  const loadSchedule = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchClassSchedule();
      setSchedule(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load class schedule.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadSchedule();
    setRefreshing(false);
  }, [loadSchedule]);

  const categories = useMemo(() => {
    if (!schedule) {
      return [ALL_FILTER];
    }
    const unique = new Set<string>();
    schedule.days.forEach((day) =>
      day.sessions.forEach((session) => {
        if (session.category) {
          unique.add(session.category.trim());
        }
      }),
    );
    return [ALL_FILTER, ...Array.from(unique)];
  }, [schedule]);

  const filteredDays = useMemo(() => {
    if (!schedule) {
      return [];
    }
    return schedule.days
      .map<ClassDay>((day) => ({
        ...day,
        sessions: day.sessions.filter((session) => {
          if (selectedCategory === ALL_FILTER) return true;
          return (
            session.category?.trim().toLowerCase() ===
            selectedCategory.toLowerCase()
          );
        }),
      }))
      .filter((day) => day.sessions.length > 0);
  }, [schedule, selectedCategory]);

  const renderDay = ({ item }: { item: ClassDay }) => (
    <View style={styles.dayCard}>
      <Text style={styles.dayLabel}>{item.label}</Text>
      {item.sessions.map((session) => (
        <View key={session.id ?? session.name} style={styles.sessionCard}>
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionName}>{session.name}</Text>
            {session.isCancelled ? (
              <Text style={styles.cancelled}>Cancelled</Text>
            ) : null}
          </View>
          <Text style={styles.sessionTime}>
            {formatTime(session.startTimeLocal)} –{' '}
            {formatTime(session.endTimeLocal)}
          </Text>
          <Text style={styles.sessionMeta}>
            {session.instructor} • {session.location}
          </Text>
          {session.description ? (
            <Text style={styles.sessionDescription}>{session.description}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={styles.title}>RSF Classes</Text>
        <Text style={styles.subtitle}>
          Group X, cardio, and mind & body classes directly from the MindBody
          schedule.
        </Text>
      </View>

      <View style={styles.filterRow}>
        {categories.map((category) => {
          const isActive = category === selectedCategory;
          return (
            <TouchableOpacity
              key={category}
              onPress={() => setSelectedCategory(category)}
              style={[
                styles.filterChip,
                isActive && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  isActive && styles.filterChipTextActive,
                ]}
              >
                {category}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filteredDays}
          keyExtractor={(day) => day.date}
          renderItem={renderDay}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.stateContainer}>
              <Text style={styles.emptyText}>
                No classes match this filter. Try another category.
              </Text>
            </View>
          }
        />
      )}
    </ScreenContainer>
  );
};

function formatTime(value: string | null) {
  if (!value) {
    return '—';
  }
  const date = new Date(`${value}:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const styles = StyleSheet.create({
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 16,
    color: '#475569',
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CBD5F5',
    backgroundColor: '#fff',
  },
  filterChipActive: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  filterChipText: {
    color: '#1e293b',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 80,
    gap: 16,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    gap: 12,
  },
  dayLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  sessionCard: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  sessionTime: {
    fontSize: 14,
    color: '#475569',
  },
  sessionMeta: {
    fontSize: 14,
    color: '#64748b',
  },
  sessionDescription: {
    fontSize: 13,
    color: '#475569',
  },
  cancelled: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  stateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#475569',
    textAlign: 'center',
  },
});

