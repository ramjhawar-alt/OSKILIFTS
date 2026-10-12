import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Avatar } from '../components/Avatar';
import { InviteCard } from '../components/InviteCard';
import { LeaderboardCard } from '../components/LeaderboardCard';
import { LevelUpModal } from '../components/LevelUpModal';
import { OskiBear } from '../components/OskiBear';
import { RecapCard } from '../components/RecapCard';
import { RsfStrip } from '../components/RsfStrip';
import { WeeklyGoalCard } from '../components/WeeklyGoalCard';
import { PrimaryButton } from '../components/ui/Button';
import { SectionTitle } from '../components/ui/Card';
import { DarkScreen } from '../components/ui/DarkScreen';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import { draftHasContent } from '../domain/draft';
import { decideLevelUp, levelUpKey } from '../domain/levelUp';
import { useRsfData } from '../hooks/useRsfData';
import { useStartWorkout } from '../hooks/useStartWorkout';
import { calculateWorkoutStreak, getBearStage } from '../services/bearStreakService';
import { loadDraft } from '../services/draftStorage';
import { getWorkouts } from '../services/workoutStorage';
import { colors, type } from '../theme';
import { RootStackParamList } from '../types/navigation';
import type { Workout } from '../types/workout';
import { successHaptic } from '../utils/haptics';

const DEBUG_STREAK_KEY = '@oskilifts:debugStreak';
const DEBUG_TOTAL_WORKOUTS_KEY = '@oskilifts:debugTotalWorkouts';

type HomeNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

/** Today: your bear and streak front and centre, the Log button under it, the RSF at a glance. */
export const HomeScreen = () => {
  const navigation = useNavigation<HomeNavigationProp>();
  const { user } = useAuth();
  const { profile } = useProfile();
  const startWorkout = useStartWorkout();
  const rsf = useRsfData();
  const [refreshing, setRefreshing] = useState(false);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [streak, setStreak] = useState(0);
  const [totalWorkouts, setTotalWorkouts] = useState(0);
  const [hasDraft, setHasDraft] = useState(false);
  // Only real workout data can level you up (not the bear-preview override).
  const [realStreakLoaded, setRealStreakLoaded] = useState(false);
  const [levelUpStage, setLevelUpStage] = useState<number | null>(null);

  const loadWorkoutData = useCallback(async () => {
    try {
      // Check for debug override first
      const debugStreak = await AsyncStorage.getItem(DEBUG_STREAK_KEY);
      const debugTotalWorkouts = await AsyncStorage.getItem(DEBUG_TOTAL_WORKOUTS_KEY);

      if (debugStreak !== null) {
        setStreak(parseInt(debugStreak, 10));
        setTotalWorkouts(parseInt(debugTotalWorkouts || '10', 10));
        setRealStreakLoaded(false);
      } else {
        const allWorkouts = await getWorkouts();
        setWorkouts(allWorkouts);
        setStreak(calculateWorkoutStreak(allWorkouts));
        setTotalWorkouts(allWorkouts.length);
        setRealStreakLoaded(true);
      }
      if (user?.id) {
        const draft = await loadDraft(user.id).catch(() => null);
        setHasDraft(Boolean(draft && draftHasContent(draft)));
      }
    } catch (error) {
      console.error('Error loading workouts for bear:', error);
    }
  }, [user?.id]);

  // Show the level-up screen the first time this person reaches a new highest stage.
  useEffect(() => {
    if (!realStreakLoaded || !user?.id) return undefined;
    let active = true;
    (async () => {
      try {
        const key = levelUpKey(user.id);
        const decision = decideLevelUp(await AsyncStorage.getItem(key), getBearStage(streak));
        await AsyncStorage.setItem(key, String(decision.remember));
        if (active && decision.celebrate) {
          successHaptic();
          setLevelUpStage(decision.remember);
        }
      } catch {
        // the celebration is a nicety; never block the home screen on it
      }
    })();
    return () => {
      active = false;
    };
  }, [realStreakLoaded, streak, user?.id]);

  // Reload when the screen comes into focus (e.g., after saving a workout)
  useFocusEffect(
    useCallback(() => {
      loadWorkoutData();
    }, [loadWorkoutData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([rsf.refresh(), loadWorkoutData()]);
    setRefreshing(false);
  }, [rsf, loadWorkoutData]);

  return (
    <DarkScreen
      scroll
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
    >
      <View style={styles.topBar}>
        <View>
          <Text style={styles.eyebrow}>UC BERKELEY</Text>
          <Text style={styles.brand}>OSKILIFTS</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.getParent()?.navigate('MeTab' as never)}
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          hitSlop={8}
        >
          <Avatar name={profile?.displayName} username={profile?.username} size={42} />
        </TouchableOpacity>
      </View>

      <OskiBear streak={streak} totalWorkouts={totalWorkouts || workouts.length}>
        <PrimaryButton
          label={hasDraft ? 'Resume workout' : 'Log workout'}
          icon={<Ionicons name={hasDraft ? 'play' : 'barbell'} size={22} color={colors.onGold} />}
          onPress={startWorkout}
        />
      </OskiBear>

      <RsfStrip
        status={rsf.status}
        loading={rsf.loading}
        onPress={() => navigation.getParent()?.navigate('RsfTab' as never)}
      />

      <WeeklyGoalCard workoutDates={workouts.map((workout) => workout.date)} />

      <SectionTitle title="With friends" />
      <LeaderboardCard />
      <RecapCard />
      <InviteCard />

      <LevelUpModal stage={levelUpStage} onClose={() => setLevelUpStage(null)} />
    </DarkScreen>
  );
};

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: { ...type.eyebrow, color: colors.cyan },
  brand: { fontSize: 30, fontWeight: '900', letterSpacing: 1.5, color: colors.gold, marginTop: 2 },
});
