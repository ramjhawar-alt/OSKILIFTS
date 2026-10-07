import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Avatar } from '../components/Avatar';
import { SafetySheet, type SafetyTarget } from '../components/SafetySheet';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../contexts/AuthContext';
import {
  formatCommentTime,
  friendlyCommentError,
  mergeComments,
  remainingCharacters,
  validateCommentDraft,
} from '../domain/comments';
import {
  COMMENTS_PAGE_SIZE,
  addComment,
  deleteComment,
  getComments,
} from '../services/socialService';
import type { RootStackParamList } from '../types/navigation';
import type { WorkoutComment } from '../types/social';
import { confirmAction } from '../utils/alert';

type CommentsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Comments'>;

export const CommentsScreen = () => {
  const navigation = useNavigation<CommentsNavigationProp>();
  const { workoutId, canOpenProfiles } = useRoute().params as RootStackParamList['Comments'];
  const { user } = useAuth();

  const [comments, setComments] = useState<WorkoutComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [safetyTarget, setSafetyTarget] = useState<SafetyTarget | null>(null);
  const listRef = useRef<FlatList<WorkoutComment>>(null);
  // Set after posting; the next layout change scrolls the new comment into view.
  const scrollToEndOnLayout = useRef(false);
  // The last comment the SERVER returned. Pagination continues from here, not
  // from the end of the list, which may hold a comment I just posted.
  const cursorRef = useRef<{ createdAt: string; id: string } | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const page = await getComments(workoutId);
        if (!active) return;
        setComments(page);
        cursorRef.current = page.length > 0 ? page[page.length - 1] : null;
        setHasMore(page.length >= COMMENTS_PAGE_SIZE);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load comments.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [workoutId]);

  const loadMore = useCallback(async () => {
    const cursor = cursorRef.current;
    if (loading || loadingMore || !hasMore || !cursor) return;
    setLoadingMore(true);
    try {
      const page = await getComments(workoutId, cursor);
      if (page.length > 0) cursorRef.current = page[page.length - 1];
      setComments((current) => mergeComments(current, page));
      setHasMore(page.length >= COMMENTS_PAGE_SIZE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load more comments.');
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, workoutId]);

  const parsed = validateCommentDraft(draft);
  const remaining = remainingCharacters(draft);
  const canSend = parsed.ok && !posting;

  const send = useCallback(async () => {
    const result = validateCommentDraft(draft);
    if (!result.ok || posting) return;
    setPosting(true);
    setPostError(null);
    try {
      const created = await addComment(workoutId, result.body);
      scrollToEndOnLayout.current = true;
      setComments((current) => [...current, created]);
      setDraft('');
    } catch (err) {
      setPostError(err instanceof Error ? err.message : friendlyCommentError(''));
    } finally {
      setPosting(false);
    }
  }, [draft, posting, workoutId]);

  const remove = useCallback(async (comment: WorkoutComment) => {
    const confirmed = await confirmAction({
      title: 'Delete comment?',
      message: comment.body.length > 120 ? `${comment.body.slice(0, 120)}…` : comment.body,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteComment(comment.id);
      setComments((current) => current.filter((entry) => entry.id !== comment.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete that comment.');
    }
  }, []);

  const openProfile = useCallback(
    (userId: string) => {
      if (canOpenProfiles) navigation.push('UserProfile', { userId });
    },
    [canOpenProfiles, navigation],
  );

  const handleBlocked = useCallback((userId: string) => {
    setComments((current) => current.filter((comment) => comment.userId !== userId));
  }, []);

  if (loading) {
    return (
      <ScreenContainer>
        <ActivityIndicator style={styles.spinner} size="large" color="#2563eb" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={comments}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          onContentSizeChange={() => {
            if (scrollToEndOnLayout.current) {
              scrollToEndOnLayout.current = false;
              listRef.current?.scrollToEnd({ animated: true });
            }
          }}
          renderItem={({ item }) => {
            const mine = item.userId === user?.id;
            return (
              <View style={styles.comment}>
                <TouchableOpacity
                  disabled={!canOpenProfiles}
                  onPress={() => openProfile(item.userId)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open @${item.username}`}
                >
                  <Avatar name={item.displayName} username={item.username} size={36} />
                </TouchableOpacity>
                <View style={styles.commentBody}>
                  <View style={styles.commentHeader}>
                    <Text style={styles.author} numberOfLines={1}>
                      {item.displayName || item.username}
                    </Text>
                    <Text style={styles.time}>
                      @{item.username} · {formatCommentTime(item.createdAt)}
                    </Text>
                  </View>
                  <Text style={styles.text}>{item.body}</Text>
                  <View style={styles.actions}>
                    {item.canDelete ? (
                      <TouchableOpacity onPress={() => remove(item)} accessibilityRole="button">
                        <Text style={styles.action}>Delete</Text>
                      </TouchableOpacity>
                    ) : null}
                    {!mine ? (
                      <TouchableOpacity
                        onPress={() =>
                          setSafetyTarget({
                            kind: 'comment',
                            commentId: item.id,
                            userId: item.userId,
                            username: item.username,
                          })
                        }
                        accessibilityRole="button"
                      >
                        <Text style={styles.action}>Report</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>No comments yet. Say something nice.</Text>}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footer} color="#2563eb" /> : null
          }
        />

        {postError ? <Text style={styles.error}>{postError}</Text> : null}
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a comment…"
            placeholderTextColor="#94a3b8"
            multiline
            accessibilityLabel="Comment"
          />
          <TouchableOpacity
            style={[styles.send, !canSend && styles.sendDisabled]}
            onPress={send}
            disabled={!canSend}
            accessibilityRole="button"
          >
            {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Post</Text>}
          </TouchableOpacity>
        </View>
        {remaining !== null ? (
          <Text style={[styles.counter, remaining < 0 && styles.counterOver]}>
            {remaining >= 0 ? `${remaining} characters left` : `${-remaining} over the limit`}
          </Text>
        ) : null}
      </KeyboardAvoidingView>

      <SafetySheet
        target={safetyTarget}
        onClose={() => setSafetyTarget(null)}
        onBlocked={handleBlocked}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  spinner: { marginTop: 48 },
  footer: { marginVertical: 16 },
  error: { color: '#dc2626', fontSize: 14, marginBottom: 8 },
  empty: { color: '#64748b', fontSize: 15, textAlign: 'center', marginTop: 32 },
  comment: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  commentBody: { flex: 1, gap: 2 },
  commentHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  author: { fontSize: 15, fontWeight: '700', color: '#0f172a', flexShrink: 1 },
  time: { fontSize: 12, color: '#94a3b8', flexShrink: 0 },
  text: { fontSize: 15, color: '#1e293b', lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 2 },
  action: { fontSize: 13, color: '#64748b', fontWeight: '600' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0f172a',
  },
  send: {
    minWidth: 64,
    height: 44,
    backgroundColor: '#2563eb',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  sendDisabled: { opacity: 0.45 },
  sendText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  counter: { fontSize: 12, color: '#64748b', textAlign: 'right', marginTop: 4 },
  counterOver: { color: '#dc2626' },
});
