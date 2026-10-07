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

import { ScreenContainer } from '../components/ScreenContainer';
import { useRequests } from '../contexts/RequestsContext';
import { formatCommentTime } from '../domain/comments';
import {
  TARGET_LABELS,
  reasonLabel,
  removeConfirmation,
  removeLabel,
  summarizeSnapshot,
  type AdminReport,
  type ResolveAction,
} from '../domain/moderation';
import { listReports, resolveReport } from '../services/moderationService';
import type { RootStackParamList } from '../types/navigation';
import { confirmAction, showMessage } from '../utils/alert';

type ModerationNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Moderation'>;
type Tab = 'open' | 'resolved';

export const ModerationScreen = () => {
  const navigation = useNavigation<ModerationNavigationProp>();
  const { refreshPending } = useRequests();
  const [tab, setTab] = useState<Tab>('open');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (which: Tab) => {
      try {
        setReports(await listReports(which));
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load reports.');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [load, tab]),
  );

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    setTab(next);
    setReports([]);
    setLoading(true);
  };

  const act = useCallback(
    async (report: AdminReport, action: ResolveAction) => {
      if (action === 'remove') {
        const confirmed = await confirmAction({
          title: removeLabel(report.targetType) ?? 'Remove',
          message: removeConfirmation(report.targetType),
          confirmLabel: removeLabel(report.targetType) ?? 'Remove',
          destructive: true,
        });
        if (!confirmed) return;
      }
      setBusyId(report.id);
      try {
        await resolveReport(report.id, action);
        // Other open reports on the same thing were closed too, so reload.
        await load(tab);
        refreshPending();
      } catch (err) {
        showMessage('Couldn’t update the report', err instanceof Error ? err.message : 'Please try again.');
      } finally {
        setBusyId(null);
      }
    },
    [load, refreshPending, tab],
  );

  const openReported = (report: AdminReport) => {
    if (report.reportedUserId) navigation.navigate('UserProfile', { userId: report.reportedUserId });
  };

  return (
    <ScreenContainer>
      <View style={styles.segments}>
        {(['open', 'resolved'] as Tab[]).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.segment, tab === value && styles.segmentActive]}
            onPress={() => switchTab(value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
          >
            <Text style={[styles.segmentText, tab === value && styles.segmentTextActive]}>
              {value === 'open' ? 'Open' : 'Resolved'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={styles.spinner} size="large" color="#2563eb" />
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load(tab);
                setRefreshing(false);
              }}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'open' ? 'No open reports. Nothing to review right now.' : 'No resolved reports yet.'}
            </Text>
          }
          renderItem={({ item }) => {
            const remove = removeLabel(item.targetType);
            const busy = busyId === item.id;
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{TARGET_LABELS[item.targetType]}</Text>
                  </View>
                  <Text style={styles.reason}>{reasonLabel(item.reason)}</Text>
                  <Text style={styles.age}>{formatCommentTime(item.createdAt)}</Text>
                </View>

                <Text style={styles.who}>
                  <Text style={styles.whoLabel}>Reported: </Text>
                  <Text onPress={() => openReported(item)} style={styles.link}>
                    @{item.reportedUsername ?? 'deleted user'}
                  </Text>
                  {'   '}
                  <Text style={styles.whoLabel}>By: </Text>@{item.reporterUsername ?? 'deleted user'}
                </Text>
                {item.reportsAgainstUser > 1 ? (
                  <Text style={styles.warn}>{item.reportsAgainstUser} reports against this person in total</Text>
                ) : null}

                <View style={styles.quote}>
                  {summarizeSnapshot(item.targetType, item.snapshot).map((line, index) => (
                    <Text key={index} style={styles.quoteText}>
                      {line}
                    </Text>
                  ))}
                </View>
                {item.details ? <Text style={styles.details}>Reporter said: “{item.details}”</Text> : null}
                {!item.targetExists ? <Text style={styles.gone}>The reported content no longer exists.</Text> : null}

                {item.status === 'open' ? (
                  <View style={styles.actions}>
                    {remove && item.targetExists ? (
                      <TouchableOpacity
                        style={[styles.button, styles.danger]}
                        onPress={() => act(item, 'remove')}
                        disabled={busy}
                        accessibilityRole="button"
                      >
                        <Text style={styles.dangerText}>{remove}</Text>
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      style={styles.button}
                      onPress={() => act(item, 'dismiss')}
                      disabled={busy}
                      accessibilityRole="button"
                    >
                      <Text style={styles.buttonText}>Dismiss</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.button}
                      onPress={() => act(item, 'reviewed')}
                      disabled={busy}
                      accessibilityRole="button"
                    >
                      <Text style={styles.buttonText}>Mark reviewed</Text>
                    </TouchableOpacity>
                    {busy ? <ActivityIndicator color="#2563eb" /> : null}
                  </View>
                ) : (
                  <Text style={styles.status}>Outcome: {item.status}</Text>
                )}
              </View>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  spinner: { marginTop: 48 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 12 },
  empty: { color: '#64748b', fontSize: 15, textAlign: 'center', marginTop: 32 },
  segments: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderRadius: 10, padding: 4, marginBottom: 16 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: '#fff' },
  segmentText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  segmentTextActive: { color: '#2563eb' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { backgroundColor: '#e0e7ff', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { color: '#3730a3', fontSize: 12, fontWeight: '700' },
  reason: { flex: 1, fontSize: 15, fontWeight: '700', color: '#0f172a' },
  age: { fontSize: 12, color: '#94a3b8' },
  who: { fontSize: 13, color: '#334155' },
  whoLabel: { color: '#64748b', fontWeight: '600' },
  link: { color: '#2563eb', fontWeight: '600' },
  warn: { fontSize: 12, color: '#b45309', fontWeight: '600' },
  quote: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, gap: 4 },
  quoteText: { fontSize: 14, color: '#1e293b' },
  details: { fontSize: 13, color: '#475569' },
  gone: { fontSize: 13, color: '#64748b', fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  button: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonText: { color: '#334155', fontSize: 14, fontWeight: '600' },
  danger: { backgroundColor: '#fee2e2', borderColor: '#fecaca' },
  dangerText: { color: '#b91c1c', fontSize: 14, fontWeight: '700' },
  status: { fontSize: 13, color: '#64748b', fontWeight: '600' },
});
