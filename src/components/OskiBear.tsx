import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AnimatedOskiLifting } from './AnimatedOskiLifting';
import { Pill, ProgressBar } from './ui/Card';
import { useRsfPresence } from '../contexts/RsfPresenceContext';
import { bearModeFor, type BearMode } from '../domain/rsfFriends';
import {
  getBearStage,
  getBearStageName,
  getMotivationalMessage,
  getStreakForNextStage,
  WORKOUTS_PER_STAGE,
} from '../services/bearStreakService';
import { colors, glow, radius, space, type } from '../theme';

interface OskiBearProps {
  streak: number;
  totalWorkouts: number;
  /** Force a mode (the bear preview screen). Normally the bear lifts while you're at the RSF. */
  modeOverride?: BearMode;
  /** The main action, shown under the bear (the Log button on Today). */
  children?: React.ReactNode;
}

/** The hero: your bear at its level, your streak, and how close the next level is. */
export const OskiBear: React.FC<OskiBearProps> = ({ streak, totalWorkouts, modeOverride, children }) => {
  const { status, sharing } = useRsfPresence();
  const mode = modeOverride ?? bearModeFor(status);
  const stage = getBearStage(streak);
  const next = getStreakForNextStage(stage);
  const toGo = next === null ? 0 : Math.max(0, next - streak);
  const progress = next === null ? 1 : Math.min(1, Math.max(0, (streak - (stage - 1) * WORKOUTS_PER_STAGE) / WORKOUTS_PER_STAGE));
  const lifting = mode === 'lift';

  return (
    <LinearGradient
      colors={['#0B3A78', '#0A1F40', colors.surface]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={[styles.hero, lifting && glow(colors.gold, 0.35, 22)]}
    >
      <View style={styles.topRow}>
        <View style={styles.topText}>
          <Text style={styles.eyebrow}>YOUR OSKI</Text>
          <Text style={styles.name} numberOfLines={1}>
            {getBearStageName(stage)}
          </Text>
        </View>
        <Pill label={`STAGE ${stage}/10`} />
      </View>

      <View style={[styles.art, lifting && styles.artLifting]}>
        <AnimatedOskiLifting stage={stage} mode={mode} />
        {lifting ? (
          <View style={styles.liveTag}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>AT THE RSF · LIFTING</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <View style={styles.statValueRow}>
            <Ionicons name="flame" size={26} color={colors.gold} />
            <Text style={styles.statValue}>{streak}</Text>
          </View>
          <Text style={styles.statLabel}>WORKOUT STREAK</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>{totalWorkouts === 1 ? 'WORKOUT' : 'WORKOUTS'}</Text>
        </View>
      </View>

      <View style={styles.progress}>
        <ProgressBar value={progress} />
        <Text style={styles.progressText}>
          {next === null
            ? 'MAX OSKI. Keep the streak alive!'
            : `${toGo} more workout${toGo === 1 ? '' : 's'} to ${getBearStageName(stage + 1)}`}
        </Text>
      </View>

      <Text style={styles.message}>{getMotivationalMessage(streak, stage)}</Text>
      {!lifting && !sharing && !modeOverride ? (
        <Text style={styles.hint}>Turn on RSF sharing (RSF tab) and Oski lifts when you do.</Text>
      ) : null}

      {children}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: space.lg,
    gap: space.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  topText: { flex: 1 },
  eyebrow: { ...type.eyebrow, color: colors.cyan },
  name: { ...type.title, color: colors.text, marginTop: 2 },
  art: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  artLifting: { borderColor: colors.gold, borderWidth: 2 },
  liveTag: {
    position: 'absolute',
    left: space.sm,
    top: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(5,11,22,0.78)',
    borderRadius: radius.pill,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  liveText: { color: colors.text, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  stats: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statValue: { ...type.stat, color: colors.text },
  statLabel: { ...type.eyebrow, fontSize: 10, color: colors.textMuted, letterSpacing: 1.4 },
  divider: { width: 1, height: 44, backgroundColor: colors.border },
  progress: { gap: 6 },
  progressText: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  message: { color: colors.textMuted, fontSize: 13, textAlign: 'center', fontStyle: 'italic' },
  hint: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
});
