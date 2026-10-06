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

import { CustomDayTypeModal } from '../components/CustomDayTypeModal';
import { ExerciseCard } from '../components/ExerciseCard';
import { ExerciseSearch } from '../components/ExerciseSearch';
import { NameRoutineModal } from '../components/NameRoutineModal';
import { RestTimerBar } from '../components/RestTimerBar';
import { ScreenContainer } from '../components/ScreenContainer';
import { useAuth } from '../contexts/AuthContext';
import { useWeightUnit } from '../contexts/ProfileContext';
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

export const LogWorkoutScreen = () => {
  const navigation = useNavigation<LogWorkoutNavigationProp>();
  const route = useRoute();
  const unit = useWeightUnit();
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

  return (
    <ScreenContainer>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.section}>
            <Text style={styles.label}>Date</Text>
            <TextInput
              style={styles.input}
              value={draft.date}
              onChangeText={(date) => dispatch({ type: 'setMeta', patch: { date } })}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94a3b8"
              maxLength={10}
            />
          </View>

          <View style={styles.restRow}>
            <Text style={styles.restLabel}>Rest timer</Text>
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
          {rest.endsAt !== null ? (
            <RestTimerBar
              remainingMs={remainingMs(rest, now)}
              onAdjust={(delta) => setRest((current) => adjustRest(current, Date.now(), delta))}
              onSkip={() => setRest(idleTimer())}
            />
          ) : null}

          <View style={[styles.section, styles.afterRest]}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Workout Day Type</Text>
              <TouchableOpacity onPress={() => setShowDayTypeModal(true)} style={styles.addButton}>
                <Text style={styles.addButtonText}>+ Custom</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {dayTypes.map((type) => {
                const selected = draft.dayType?.name === type.name;
                return (
                  <TouchableOpacity
                    key={type.name}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => dispatch({ type: 'setMeta', patch: { dayType: type } })}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{type.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Exercises</Text>
            {draft.entries.length === 0 ? (
              <View style={styles.emptyExercises}>
                <Text style={styles.emptyText}>No exercises yet. Add one to start logging sets.</Text>
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
              onPress={() => setPicker({ kind: 'add' })}
              disabled={draft.entries.length >= MAX_DRAFT_ENTRIES}
            >
              <Text style={styles.addExerciseText}>+ Add exercises</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={draft.notes}
              onChangeText={(notes) => dispatch({ type: 'setMeta', patch: { notes } })}
              placeholder="Add any notes about your workout..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={4}
              maxLength={2000}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Who can see this</Text>
            <View style={styles.visibilityRow}>
              {(
                [
                  { value: 'followers', label: 'Followers' },
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
                ? 'Shown in your approved followers’ feeds, including your notes.'
                : 'Only you can see this workout.'}
            </Text>
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

          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>{draft.editingId ? 'Save changes' : 'Save Workout'}</Text>
            )}
          </TouchableOpacity>

          {draft.entries.length > 0 ? (
            <TouchableOpacity style={styles.discard} onPress={() => setNamingRoutine(true)} accessibilityRole="button">
              <Text style={styles.routineLink}>Save as routine</Text>
            </TouchableOpacity>
          ) : null}

          {!draft.editingId && draftHasContent(draft) ? (
            <TouchableOpacity style={styles.discard} onPress={handleDiscard} accessibilityRole="button">
              <Text style={styles.discardText}>Discard workout</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
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
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { marginBottom: 24 },
  afterRest: { marginTop: 16 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  restLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  restToggle: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#f1f5f9' },
  restToggleOn: { backgroundColor: '#dcfce7' },
  restToggleText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  restToggleTextOn: { color: '#15803d' },
  restDuration: { fontSize: 13, fontWeight: '600', color: '#2563eb' },
  label: { fontSize: 16, fontWeight: '600', color: '#0f172a', marginBottom: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
  },
  textArea: { minHeight: 100, paddingTop: 12 },
  visibilityRow: { flexDirection: 'row', gap: 8 },
  visibilityHint: { fontSize: 13, color: '#64748b', marginTop: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#64748b' },
  chipTextSelected: { color: '#ffffff' },
  addButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, backgroundColor: '#f1f5f9' },
  addButtonText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
  emptyExercises: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    marginBottom: 12,
  },
  emptyText: { fontSize: 14, color: '#64748b' },
  addExercise: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  addExerciseDisabled: { opacity: 0.5 },
  addExerciseText: { color: '#2563eb', fontSize: 16, fontWeight: '700' },
  warning: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  warningText: { flex: 1, fontSize: 14, color: '#92400e' },
  warningAction: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  saveButton: { backgroundColor: '#2563eb', padding: 16, borderRadius: 8, alignItems: 'center' },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  discard: { alignItems: 'center', paddingVertical: 16 },
  discardText: { color: '#dc2626', fontSize: 15, fontWeight: '600' },
  routineLink: { color: '#2563eb', fontSize: 15, fontWeight: '600' },
});
