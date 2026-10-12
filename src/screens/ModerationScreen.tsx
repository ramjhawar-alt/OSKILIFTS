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
import { colors } from '../theme';

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
        <ActivityIndicator style={styles.spinner} size="large" color={colors.gold} />
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
                    {busy ? <ActivityIndicator color={colors.gold} /> : null}
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
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  empty: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: 32 },
  segments: { flexDirection: 'row', backgroundColor: colors.surfaceHi, borderRadius: 10, padding: 4, marginBottom: 16 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  segmentTextActive: { color: colors.cyan },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { backgroundColor: colors.goldSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { color: colors.cyan, fontSize: 12, fontWeight: '700' },
  reason: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  age: { fontSize: 12, color: colors.textFaint },
  who: { fontSize: 13, color: colors.text },
  whoLabel: { color: colors.textMuted, fontWeight: '600' },
  link: { color: colors.cyan, fontWeight: '600' },
  warn: { fontSize: 12, color: colors.gold, fontWeight: '600' },
  quote: { backgroundColor: colors.surfaceHi, borderRadius: 8, padding: 10, gap: 4 },
  quoteText: { fontSize: 14, color: colors.text },
  details: { fontSize: 13, color: colors.textMuted },
  gone: { fontSize: 13, color: colors.textMuted, fontStyle: 'italic' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 4 },
  button: {
    backgroundColor: colors.surfaceHi,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  danger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  dangerText: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  status: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
});
