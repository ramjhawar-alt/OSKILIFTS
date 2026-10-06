import { loadDraft, clearDraft } from './draftStorage';
import { draftHasContent } from '../domain/draft';
import { confirmAction } from '../utils/alert';

/**
 * Before starting a different workout: if one is in progress, ask whether to
 * discard it. Resolves true when it's fine to proceed (and clears the draft).
 */
export async function confirmDiscardDraftIfAny(userId: string): Promise<boolean> {
  if (!userId) return true;
  const existing = await loadDraft(userId);
  if (!existing || !draftHasContent(existing)) return true;
  const replace = await confirmAction({
    title: 'Start a new workout?',
    message: 'You have a workout in progress. Starting a new one discards it.',
    confirmLabel: 'Discard and start new',
    destructive: true,
  });
  if (!replace) return false;
  await clearDraft(userId);
  return true;
}
