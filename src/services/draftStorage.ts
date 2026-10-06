import AsyncStorage from '@react-native-async-storage/async-storage';

import { parseStoredDraft, serializeDraft, type DraftWorkout } from '../domain/draft';

// One in-progress NEW workout per user, so it survives a reload or closed tab.
// Edits of saved workouts are never drafted.
const keyFor = (userId: string) => `@oskilifts:draft:${userId}`;

export async function loadDraft(userId: string): Promise<DraftWorkout | null> {
  try {
    return parseStoredDraft(await AsyncStorage.getItem(keyFor(userId)));
  } catch (error) {
    console.error('[Draft] load failed:', error);
    return null;
  }
}

export async function saveDraft(userId: string, draft: DraftWorkout): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), serializeDraft(draft));
  } catch (error) {
    console.error('[Draft] save failed:', error);
  }
}

export async function clearDraft(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch (error) {
    console.error('[Draft] clear failed:', error);
  }
}
