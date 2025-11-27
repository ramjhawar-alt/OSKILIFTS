import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  getBearStage,
  getStreakForNextStage,
  getMotivationalMessage,
  getBearStageName,
} from '../services/bearStreakService';
import { AnimatedOskiLifting } from './AnimatedOskiLifting';

interface OskiBearProps {
  streak: number;
  totalWorkouts: number;
}

export const OskiBear: React.FC<OskiBearProps> = ({ streak, totalWorkouts }) => {
  const stage = getBearStage(streak);
  const stageName = getBearStageName(stage);
  const nextStageStreak = getStreakForNextStage(stage);
  const message = getMotivationalMessage(streak, stage);

  // Calculate size multiplier based on stage - less aggressive at higher stages
  // Capped at 1.3 instead of 1.5 to prevent taking up too much space
  const sizeMultipliers: Record<number, number> = {
    1: 0.5,
    2: 0.6,
    3: 0.7,
    4: 0.8,
    5: 0.9,
    6: 1.0,
    7: 1.08,
    8: 1.15,
    9: 1.22,
    10: 1.3,
  };
  const bearSize = sizeMultipliers[stage] || 1.0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{stageName}</Text>
        <View style={styles.stageBadge}>
          <Text style={styles.stageText}>Stage {stage}/10</Text>
        </View>
      </View>

      <View style={styles.bearDisplay}>
        <View style={styles.bearWrapper}>
          <AnimatedOskiLifting size={bearSize} stage={stage} />
        </View>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={styles.statLabel}>
            {streak === 1 ? 'Day Streak' : 'Day Streak'}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{totalWorkouts}</Text>
          <Text style={styles.statLabel}>
            {totalWorkouts === 1 ? 'Workout' : 'Workouts'}
          </Text>
        </View>
      </View>

      {nextStageStreak !== null && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {nextStageStreak - streak} more day{nextStageStreak - streak !== 1 ? 's' : ''} to Stage {stage + 1}!
          </Text>
        </View>
      )}

      <View style={styles.messageContainer}>
        <Text style={styles.messageText}>{message}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
    marginBottom: 0,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: '#003262', // Berkeley blue
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
  },
  stageBadge: {
    backgroundColor: '#FDB515', // Berkeley gold
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0f172a',
  },
  bearDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
    height: 250, // Fixed height to ensure consistent centering space
    width: '100%',
    backgroundColor: 'transparent', // Remove any background
    overflow: 'hidden', // Prevent spillover
  },
  bearWrapper: {
    width: '100%',
    height: '100%', // Fill the bearDisplay container completely
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#003262', // Berkeley blue
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  progressContainer: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fef3c7', // Light gold
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDB515',
  },
  progressText: {
    fontSize: 12,
    color: '#92400e',
    fontWeight: '600',
    textAlign: 'center',
  },
  messageContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

