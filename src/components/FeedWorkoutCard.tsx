import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Avatar } from './Avatar';
import { PrChips } from './PrChips';
import { useWeightUnit } from '../contexts/ProfileContext';
import type { FeedItem } from '../types/social';
import { formatExerciseEntry, getDateFromISOString } from '../utils/workoutFormat';

const COLLAPSED_COUNT = 3;

export const FeedWorkoutCard = ({
  item,
  onPressAuthor,
  onToggleLike,
  onMore,
}: {
  item: FeedItem;
  onPressAuthor: (userId: string) => void;
  onToggleLike?: (item: FeedItem) => void;
  onMore?: (item: FeedItem) => void;
}) => {
  const unit = useWeightUnit();
  const [expanded, setExpanded] = useState(false);
  const date = getDateFromISOString(item.date).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const visible = expanded ? item.exercises : item.exercises.slice(0, COLLAPSED_COUNT);
  const hidden = item.exercises.length - visible.length;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.author}
          onPress={() => onPressAuthor(item.userId)}
          accessibilityRole="button"
        >
          <Avatar name={item.displayName} username={item.username} />
          <View style={styles.authorText}>
            <Text style={styles.name} numberOfLines={1}>
              {item.displayName || item.username}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              @{item.username} · {date}
            </Text>
          </View>
        </TouchableOpacity>
        {onMore ? (
          <TouchableOpacity onPress={() => onMore(item)} accessibilityLabel="More options">
            <Text style={styles.more}>•••</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>{item.dayType.name}</Text>
      </View>

      {visible.map((entry, index) => (
        <View key={`${entry.exercise.name}-${index}`} style={styles.exerciseRow}>
          <View style={styles.exerciseTitle}>
            <Text style={styles.exerciseName} numberOfLines={1}>
              {entry.exercise.name}
            </Text>
            <PrChips prs={entry.prs} />
          </View>
          <Text style={styles.exerciseDetail}>{formatExerciseEntry(entry, unit)}</Text>
        </View>
      ))}
      {hidden > 0 ? (
        <TouchableOpacity onPress={() => setExpanded(true)}>
          <Text style={styles.link}>Show {hidden} more</Text>
        </TouchableOpacity>
      ) : null}
      {expanded && item.exercises.length > COLLAPSED_COUNT ? (
        <TouchableOpacity onPress={() => setExpanded(false)}>
          <Text style={styles.link}>Show less</Text>
        </TouchableOpacity>
      ) : null}

      {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}

      {onToggleLike ? (
        <TouchableOpacity
          style={styles.likeRow}
          onPress={() => onToggleLike(item)}
          accessibilityRole="button"
          accessibilityState={{ selected: item.likedByMe }}
        >
          <Text style={[styles.likeText, item.likedByMe && styles.liked]}>
            {item.likedByMe ? '♥' : '♡'} {item.likeCount}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  authorText: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  meta: { fontSize: 13, color: '#64748b' },
  more: { fontSize: 18, color: '#64748b', paddingHorizontal: 8 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  badgeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 2,
  },
  exerciseTitle: { flex: 1, gap: 4 },
  exerciseName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
  exerciseDetail: { fontSize: 14, color: '#475569' },
  link: { color: '#2563eb', fontSize: 14, fontWeight: '600' },
  notes: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#334155',
  },
  likeRow: { paddingTop: 4, alignSelf: 'flex-start' },
  likeText: { fontSize: 16, color: '#64748b', fontWeight: '600' },
  liked: { color: '#dc2626' },
});
