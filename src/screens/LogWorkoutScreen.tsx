import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CustomDayTypeModal } from '../components/CustomDayTypeModal';
import { ExerciseCard } from '../components/ExerciseCard';
import { ExerciseSearch } from '../components/ExerciseSearch';
import { NameRoutineModal } from '../components/NameRoutineModal';
import { RestTimerBar } from '../components/RestTimerBar';
import { ScreenContainer } from '../components/ScreenContainer';
import { PrimaryButton } from '../components/ui/Button';
import { MAX_CONTENT_WIDTH } from '../components/ui/DarkScreen';
import { countDoneSets, formatElapsed } from '../domain/workoutClock';
import { colors, radius, space, type as typeScale } from '../theme';
import { tapHaptic } from '../utils/haptics';
import { useAuth } from '../contexts/AuthContext';
import { RsfLiftingBanner } from '../components/RsfLiftingBanner';
import { useProfile, useWeightUnit } from '../contexts/ProfileContext';
import { isValidDateString, localDateString, toStoredWorkoutDate } from '../domain/dates';
import {
  convertDraftUnit,
  countUncheckedWithData,
  createDraft,
  draftFromWorkout,
  draftHasContent,
  draftReducer,
  draftToEntries,
  MAX_DRAFT_ENTRIES,
} from '../domain/draft';
import { exerciseKey } from '../domain/entry';
import { lastPerformance, sessionsBefore, type HistoryIndex } from '../domain/history';
import { PR_LABEL, stampPrs } from '../domain/prs';
import { draftFromRoutine, routineEntriesFromDraft } from '../domain/routines';
import { createRoutine, getRoutine, markRoutineUsed } from '../services/routineService';
import {
  adjustRest,
  formatRemaining,
  idleTimer,
  nextPreset,
  remainingMs,
  shouldAlert,
  startRest,
  type RestTimer,
} from '../domain/restTimer';
import { clearDraft, loadDraft, saveDraft } from '../services/draftStorage';
import { getHistory } from '../services/historyCache';
import {
  DEFAULT_REST_SETTINGS,
  loadRestSettings,
  saveRestSettings,
  type RestSettings,
} from '../services/restSettings';
import { playRestOver, primeRestAlert } from '../utils/restAlert';
import {
  getWorkoutById,
  getWorkoutDayTypes,
  saveCustomWorkoutDayType,
  saveWorkout,
} from '../services/workoutStorage';
import { RootStackParamList } from '../types/navigation';
import type { Exercise, Workout, WorkoutDayType, WorkoutVisibility } from '../types/workout';
import { confirmAction, showMessage } from '../utils/alert';

type LogWorkoutNavigationProp = NativeStackNavigationProp<RootStackParamList, 'LogWorkout'>;

type PickerMode = { kind: 'add' } | { kind: 'replace'; entryId: string } | null;

const AUTOSAVE_MS = 400;

/** Elapsed time, exercises and sets done: the workout at a glance, ticking once a second. */
const WorkoutStats = ({ startedAt, entries }: { startedAt: number; entries: { sets: { done: boolean }[] }[] }) => {
  const [clock, setClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={styles.stats}>
      <View style={styles.stat}>
        <Ionicons name="timer-outline" size={18} color={colors.cyan} />
        <Text style={styles.statValue}>{formatElapsed(clock - startedAt)}</Text>
        <Text style={styles.statLabel}>TIME</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.stat}>
        <Ionicons name="barbell-outline" size={18} color={colors.cyan} />
        <Text style={styles.statValue}>{entries.length}</Text>
        <Text style={styles.statLabel}>{entries.length === 1 ? 'EXERCISE' : 'EXERCISES'}</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.stat}>
        <Ionicons name="checkmark-done" size={18} color={colors.success} />
        <Text style={styles.statValue}>{countDoneSets(entries)}</Text>
        <Text style={styles.statLabel}>SETS DONE</Text>
      </View>
    </View>
  );
};

export const LogWorkoutScreen = () => {
  const navigation = useNavigation<LogWorkoutNavigationProp>();
  const route = useRoute();
  const unit = useWeightUnit();
  const { profile } = useProfile();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const params = route.params as
    | { workoutId?: string; initialDate?: string; resume?: boolean; routineId?: string }
    | undefined;
  const workoutId = params?.workoutId;
  const resume = params?.resume === true;
  const routineId = params?.routineId;

  const [draft, dispatch] = useReducer(
    draftReducer,
    undefined,
    () => createDraft({ date: params?.initialDate || localDateString(), unit }),
  );
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dayTypes, setDayTypes] = useState<WorkoutDayType[]>([]);
  const [showDayTypeModal, setShowDayTypeModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const insets = useSafeAreaInsets();
  const [picker, setPicker] = useState<PickerMode>(null);
  const [namingRoutine, setNamingRoutine] = useState(false);
  const [history, setHistory] = useState<HistoryIndex | null>(null);
  const [editingCreatedAt, setEditingCreatedAt] = useState<string | undefined>();
  const [restSettings, setRestSettings] = useState<RestSettings>(DEFAULT_REST_SETTINGS);
  const [rest, setRest] = useState<RestTimer>(idleTimer());
  const [now, setNow] = useState(Date.now());

  // ---------------------------------------------------------------------
  // load: day types, then either the workout being edited, a resumed draft,
  // or nothing (a fresh draft was created above)
  // ---------------------------------------------------------------------
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const types = await getWorkoutDayTypes();
        if (active) setDayTypes(types);

        if (workoutId) {
          const workout = await getWorkoutById(workoutId);
          if (!active) return;
          if (workout) {
            dispatch({ type: 'replaceDraft', draft: draftFromWorkout(workout, unit) });
            setEditingCreatedAt(workout.createdAt);
          }
          else showMessage('Error', 'Workout not found');
        } else if (routineId) {
          const routine = await getRoutine(routineId);
          if (!active) return;
          if (routine) {
            dispatch({
              type: 'replaceDraft',
              draft: draftFromRoutine(routine, { unit, date: params?.initialDate || localDateString() }),
            });
          } else {
            showMessage('Routine not found', 'Starting an empty workout instead.');
          }
        } else if (resume && userId) {
          const stored = await loadDraft(userId);
          if (active && stored) {
            dispatch({ type: 'replaceDraft', draft: convertDraftUnit(stored, unit) });
          }
        }
      } catch (error) {
        console.error('Error loading workout:', error);
        showMessage('Error', 'Failed to load workout data');
      } finally {
        if (active) setReady(true);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutId, resume, routineId, userId]);

  // ---------------------------------------------------------------------
  // previous-session hints: one cached strict fetch, never blocks logging
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    getHistory(userId)
      .then(({ index }) => active && setHistory(index))
      .catch((error) => console.error('[History] hints unavailable:', error));
    return () => {
      active = false;
    };
  }, [userId]);

  const hintDate = isValidDateString(draft.date) ? draft.date : localDateString();
  const previousFor = useCallback(
    (name: string) =>
      history
        ? lastPerformance(
            history,
            exerciseKey(name),
            { date: hintDate, createdAt: editingCreatedAt },
            draft.editingId,
          )?.entry.sets ?? null
        : null,
    [history, hintDate, editingCreatedAt, draft.editingId],
  );

  // ---------------------------------------------------------------------
  // rest timer: starts when a set gets checked; derived from timestamps
  // ---------------------------------------------------------------------
  useEffect(() => {
    loadRestSettings().then(setRestSettings);
  }, []);

  const doneCount = useMemo(
    () => draft.entries.reduce((sum, entry) => sum + entry.sets.filter((s) => s.done).length, 0),
    [draft.entries],
  );
  const lastDoneCount = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (lastDoneCount.current !== null && doneCount > lastDoneCount.current && restSettings.enabled) {
      primeRestAlert();
      setRest(startRest(Date.now(), restSettings.seconds));
      setNow(Date.now());
    }
    lastDoneCount.current = doneCount;
  }, [doneCount, ready, restSettings]);

  useEffect(() => {
    if (rest.endsAt === null) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 250);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      clearInterval(timer);
      appState.remove();
    };
  }, [rest.endsAt]);

  useEffect(() => {
    if (shouldAlert(rest, now)) {
      playRestOver();
      setRest((current) => ({ ...current, alerted: true }));
    }
  }, [rest, now]);

  const updateRestSettings = useCallback((next: RestSettings) => {
    setRestSettings(next);
    saveRestSettings(next);
    if (!next.enabled) setRest(idleTimer());
  }, []);

  // ---------------------------------------------------------------------
  // draft persistence (new workouts only): debounced, flushed on background
  // ---------------------------------------------------------------------
  const latestDraft = useRef(draft);
  latestDraft.current = draft;
  const persist = useRef(true);

  useEffect(() => {
    if (!ready || !userId || draft.editingId || !persist.current) return undefined;
    if (!draftHasContent(draft)) return undefined;
    const timer = setTimeout(() => saveDraft(userId, draft), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [draft, ready, userId]);

  useEffect(() => {
    const flush = () => {
      const current = latestDraft.current;
      if (persist.current && userId && !current.editingId && draftHasContent(current)) {
        saveDraft(userId, current);
      }
    };
    const appState = AppState.addEventListener('change', (state) => {
      if (state !== 'active') flush();
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', flush);
    }
    return () => {
      appState.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('pagehide', flush);
        document.removeEventListener('visibilitychange', flush);
      }
      flush();
    };
  }, [userId]);

  // ---------------------------------------------------------------------
  // handlers
  // ---------------------------------------------------------------------
  const handlePick = useCallback(
    (exercises: Exercise[]) => {
      if (picker?.kind === 'replace' && exercises[0]) {
        dispatch({ type: 'replaceExercise', entryId: picker.entryId, exercise: exercises[0] });
      } else if (exercises.length > 0) {
        dispatch({ type: 'addEntries', exercises });
      }
      setPicker(null);
    },
    [picker],
  );

  const handleRemove = useCallback(async (entryId: string) => {
    const confirmed = await confirmAction({
      title: 'Remove exercise',
      message: 'Remove this exercise and its sets?',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (confirmed) dispatch({ type: 'removeEntry', entryId });
  }, []);

  const handleReplace = useCallback((entryId: string) => setPicker({ kind: 'replace', entryId }), []);

  const handleAddCustomDayType = async (name: string) => {
    try {
      const newDayType: WorkoutDayType = { name, isCustom: true };
      await saveCustomWorkoutDayType(newDayType);
      setDayTypes(await getWorkoutDayTypes());
      dispatch({ type: 'setMeta', patch: { dayType: newDayType } });
      setShowDayTypeModal(false);
    } catch (error: any) {
      showMessage('Error', error.message || 'Failed to add custom day type');
    }
  };

  const handleSaveAsRoutine = async (name: string) => {
    try {
      const entries = routineEntriesFromDraft(draft);
      await createRoutine({ name, dayType: draft.dayType, entries });
      setNamingRoutine(false);
      showMessage('Routine saved', `“${name.trim()}” is in your Routines. Start it any time from the Workouts tab.`);
    } catch (error) {
      showMessage('Couldn’t save routine', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleDiscard = async () => {
    const confirmed = await confirmAction({
      title: 'Discard workout?',
      message: 'This clears everything you entered.',
      confirmLabel: 'Discard',
      destructive: true,
    });
    if (!confirmed) return;
    persist.current = false;
    if (userId) await clearDraft(userId);
    navigation.goBack();
  };

  const handleSave = async () => {
    if (!draft.dayType) {
      showMessage('Required', 'Please select a workout day type');
      return;
    }
    if (!isValidDateString(draft.date)) {
      showMessage('Invalid Date', 'Please enter a date in YYYY-MM-DD format');
      return;
    }
    const converted = draftToEntries(draft);
    if (converted.errors.length > 0) {
      showMessage('Check your workout', converted.errors.slice(0, 4).join('\n'));
      return;
    }

    setSaving(true);
    try {
      // Stamp personal records against everything logged before this workout.
      // If history can't be loaded we save without badges rather than guess.
      let entries = converted.entries;
      if (userId) {
        try {
          const { index } = await getHistory(userId, { force: true });
          entries = stampPrs(entries, (key) =>
            sessionsBefore(index, key, { date: draft.date, createdAt: editingCreatedAt }, draft.editingId),
          );
        } catch (historyError) {
          console.error('[PR] skipping PR detection:', historyError);
        }
      }

      const workout: Workout = {
        id: draft.editingId || `workout-${Date.now()}`,
        date: toStoredWorkoutDate(draft.date),
        dayType: draft.dayType,
        exercises: entries,
        notes: draft.notes.trim() || undefined,
        visibility: draft.visibility,
      };
      await saveWorkout(workout);
      if (draft.routineId) markRoutineUsed(draft.routineId);
      persist.current = false;
      if (userId && !draft.editingId) await clearDraft(userId);
      const records = entries
        .filter((entry) => entry.prs.length > 0)
        .map((entry) => `${entry.exercise.name}: ${entry.prs.map((pr) => PR_LABEL[pr]).join(', ')}`);
      if (records.length > 0) showMessage('New personal record! 🏆', records.join('\n'));
      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving workout:', error);
      const tooBig = error?.code === '23514';
      showMessage('Error', tooBig ? 'This workout is too large to save.' : 'Failed to save workout');
    } finally {
      setSaving(false);
    }
  };

  if (!ready) {
    return (
      <ScreenContainer>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </ScreenContainer>
    );
  }

  const unchecked = countUncheckedWithData(draft);
  const visibilityLabel =
    draft.visibility === 'followers' ? (profile?.isPublic ? 'Everyone' : 'Followers') : 'Only me';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0A2347', colors.bg]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.45 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.column}>
            <RsfLiftingBanner />
            <WorkoutStats startedAt={draft.startedAt} entries={draft.entries} />

            <View>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Day type</Text>
                <TouchableOpacity onPress={() => setShowDayTypeModal(true)} style={styles.addButton} accessibilityRole="button">
                  <Text style={styles.addButtonText}>+ Custom</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {dayTypes.map((dayType) => {
                  const selected = draft.dayType?.name === dayType.name;
                  return (
                    <TouchableOpacity
                      key={dayType.name}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => {
                        tapHaptic();
                        dispatch({ type: 'setMeta', patch: { dayType } });
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{dayType.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View>
              <Text style={styles.label}>Exercises</Text>
              {draft.entries.length === 0 ? (
                <View style={styles.emptyExercises}>
                  <Ionicons name="barbell" size={34} color={colors.gold} />
                  <Text style={styles.emptyTitle}>Start your workout</Text>
                  <Text style={styles.emptyText}>Add an exercise, then log each set. Last time's numbers show up as hints.</Text>
                </View>
              ) : (
                draft.entries.map((entry) => (
                  <ExerciseCard
                    key={entry.id}
                    entry={entry}
                    unit={draft.unit}
                    dispatch={dispatch}
                    previousSets={previousFor(entry.exercise.name)}
                    onReplace={handleReplace}
                    onRemove={handleRemove}
                  />
                ))
              )}
              <TouchableOpacity
                style={[styles.addExercise, draft.entries.length >= MAX_DRAFT_ENTRIES && styles.addExerciseDisabled]}
                onPress={() => {
                  tapHaptic();
                  setPicker({ kind: 'add' });
                }}
                disabled={draft.entries.length >= MAX_DRAFT_ENTRIES}
                accessibilityRole="button"
              >
                <Ionicons name="add-circle" size={22} color={colors.gold} />
                <Text style={styles.addExerciseText}>Add exercises</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.details}>
              <TouchableOpacity
                style={styles.detailsHeader}
                onPress={() => {
                  tapHaptic();
                  setShowDetails((value) => !value);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: showDetails }}
              >
                <View style={styles.flex}>
                  <Text style={styles.detailsTitle}>Details</Text>
                  <Text style={styles.detailsSummary} numberOfLines={1}>
                    {draft.date} · {visibilityLabel} · Rest {restSettings.enabled ? formatRemaining(restSettings.seconds * 1000) : 'off'}
                  </Text>
                </View>
                <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
              </TouchableOpacity>

              {showDetails ? (
                <View style={styles.detailsBody}>
                  <View>
                    <Text style={styles.fieldLabel}>Date</Text>
                    <TextInput
                      style={styles.input}
                      value={draft.date}
                      onChangeText={(date) => dispatch({ type: 'setMeta', patch: { date } })}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor={colors.textFaint}
                      selectionColor={colors.gold}
                      maxLength={10}
                    />
                  </View>

                  <View style={styles.restRow}>
                    <Text style={styles.fieldLabel}>Rest timer</Text>
                    <TouchableOpacity
                      style={[styles.restToggle, restSettings.enabled && styles.restToggleOn]}
                      onPress={() => updateRestSettings({ ...restSettings, enabled: !restSettings.enabled })}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: restSettings.enabled }}
                    >
                      <Text style={[styles.restToggleText, restSettings.enabled && styles.restToggleTextOn]}>
                        {restSettings.enabled ? 'On' : 'Off'}
                      </Text>
                    </TouchableOpacity>
                    {restSettings.enabled ? (
                      <TouchableOpacity
                        onPress={() => updateRestSettings({ ...restSettings, seconds: nextPreset(restSettings.seconds) })}
                        accessibilityRole="button"
                        accessibilityLabel="Change rest duration"
                      >
                        <Text style={styles.restDuration}>{formatRemaining(restSettings.seconds * 1000)} · change</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Notes (optional)</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      value={draft.notes}
                      onChangeText={(notes) => dispatch({ type: 'setMeta', patch: { notes } })}
                      placeholder="How did it feel?"
                      placeholderTextColor={colors.textFaint}
                      selectionColor={colors.gold}
                      multiline
                      numberOfLines={4}
                      maxLength={2000}
                      textAlignVertical="top"
                    />
                  </View>

                  <View>
                    <Text style={styles.fieldLabel}>Who can see this</Text>
                    <View style={styles.visibilityRow}>
                      {(
                        [
                          { value: 'followers', label: profile?.isPublic ? 'Everyone' : 'Followers' },
                          { value: 'private', label: 'Only me' },
                        ] as { value: WorkoutVisibility; label: string }[]
                      ).map((option) => (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.chip, draft.visibility === option.value && styles.chipSelected]}
                          onPress={() => dispatch({ type: 'setMeta', patch: { visibility: option.value } })}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: draft.visibility === option.value }}
                        >
                          <Text style={[styles.chipText, draft.visibility === option.value && styles.chipTextSelected]}>
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <Text style={styles.visibilityHint}>
                      {draft.visibility === 'followers'
                        ? profile?.isPublic
                          ? 'Your account is public: anyone at Berkeley can see this, including your notes, and it can appear on Explore.'
                          : 'Shown in your approved followers’ feeds, including your notes.'
                        : 'Only you can see this workout.'}
                    </Text>
                  </View>

                  <View style={styles.moreActions}>
                    {draft.entries.length > 0 ? (
                      <TouchableOpacity onPress={() => setNamingRoutine(true)} accessibilityRole="button" style={styles.moreAction}>
                        <Text style={styles.routineLink}>Save as routine</Text>
                      </TouchableOpacity>
                    ) : null}
                    {!draft.editingId && draftHasContent(draft) ? (
                      <TouchableOpacity onPress={handleDiscard} accessibilityRole="button" style={styles.moreAction}>
                        <Text style={styles.discardText}>Discard workout</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              ) : null}
            </View>

            {unchecked > 0 ? (
              <View style={styles.warning}>
                <Text style={styles.warningText}>
                  {unchecked} set{unchecked === 1 ? '' : 's'} with numbers {unchecked === 1 ? 'isn’t' : 'aren’t'}{' '}
                  checked and won’t be saved.
                </Text>
                <TouchableOpacity onPress={() => dispatch({ type: 'checkAllValid' })} accessibilityRole="button">
                  <Text style={styles.warningAction}>Check all</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </ScrollView>

        <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <View style={styles.dockInner}>
            {rest.endsAt !== null ? (
              <RestTimerBar
                remainingMs={remainingMs(rest, now)}
                onAdjust={(delta) => setRest((current) => adjustRest(current, Date.now(), delta))}
                onSkip={() => setRest(idleTimer())}
              />
            ) : null}
            <PrimaryButton
              label={draft.editingId ? 'Save changes' : 'Finish workout'}
              icon={<Ionicons name="checkmark-circle" size={22} color={colors.onGold} />}
              onPress={handleSave}
              busy={saving}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {picker ? (
        <ExerciseSearch
          visible
          single={picker.kind === 'replace'}
          onClose={() => setPicker(null)}
          onPick={handlePick}
        />
      ) : null}

      <NameRoutineModal
        visible={namingRoutine}
        title="Save as routine"
        initialName={draft.dayType?.name ?? ''}
        onClose={() => setNamingRoutine(false)}
        onSave={handleSaveAsRoutine}
      />

      <CustomDayTypeModal
        visible={showDayTypeModal}
        onClose={() => setShowDayTypeModal(false)}
        onSave={handleAddCustomDayType}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xl, alignItems: 'center' },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: space.lg },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { ...typeScale.eyebrow, fontSize: 9, color: colors.textMuted, letterSpacing: 1.2 },
  statDivider: { width: 1, height: 34, backgroundColor: colors.border },
  label: { ...typeScale.heading, color: colors.text, marginBottom: space.sm },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
  chips: { gap: space.sm, paddingRight: space.lg },
  chip: {
    paddingHorizontal: space.lg,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  chipSelected: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  chipTextSelected: { color: colors.onGold },
  addButton: { paddingHorizontal: space.md, minHeight: 36, justifyContent: 'center' },
  addButtonText: { fontSize: 14, fontWeight: '800', color: colors.gold },
  emptyExercises: {
    padding: space.xl,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    marginBottom: space.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginTop: 4 },
  emptyText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  addExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.pill,
    minHeight: 52,
  },
  addExerciseDisabled: { opacity: 0.5 },
  addExerciseText: { color: colors.gold, fontSize: 16, fontWeight: '800' },
  details: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: 60 },
  detailsTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  detailsSummary: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  detailsBody: { gap: space.lg, paddingHorizontal: space.lg, paddingBottom: space.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.lg },
  input: {
    backgroundColor: colors.bgRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 48,
    fontSize: 16,
    color: colors.text,
  },
  textArea: { minHeight: 100, paddingTop: space.md },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  restToggle: { paddingHorizontal: space.md, minHeight: 36, justifyContent: 'center', borderRadius: radius.pill, backgroundColor: colors.surfaceHi },
  restToggleOn: { backgroundColor: colors.successSoft },
  restToggleText: { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  restToggleTextOn: { color: colors.success },
  restDuration: { fontSize: 13, fontWeight: '700', color: colors.cyan },
  visibilityRow: { flexDirection: 'row', gap: space.sm },
  visibilityHint: { fontSize: 13, color: colors.textMuted, marginTop: space.sm, lineHeight: 18 },
  moreActions: { flexDirection: 'row', justifyContent: 'space-between' },
  moreAction: { minHeight: 44, justifyContent: 'center' },
  routineLink: { color: colors.cyan, fontSize: 15, fontWeight: '700' },
  discardText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
  warning: {
    backgroundColor: colors.goldSoft,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    padding: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  warningText: { flex: 1, fontSize: 14, color: colors.text },
  warningAction: { fontSize: 14, fontWeight: '800', color: colors.gold },
  dock: {
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: 'rgba(5,11,22,0.96)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dockInner: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, gap: space.sm },
});
