import { normalizeEntries } from './entry';

export type ReportStatus = 'open' | 'reviewed' | 'actioned' | 'dismissed';
export type ReportTarget = 'workout' | 'profile' | 'comment';
export type ResolveAction = 'dismiss' | 'reviewed' | 'remove';

export interface AdminReport {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  createdAt: string;
  reporterUsername: string | null;
  reportedUserId: string | null;
  reportedUsername: string | null;
  snapshot: unknown;
  reportsAgainstUser: number;
  targetExists: boolean;
}

const REASON_LABELS: Record<string, string> = {
  harassment: 'Harassment or bullying',
  hate: 'Hate speech',
  sexual: 'Sexual or graphic content',
  spam: 'Spam or scam',
  impersonation: 'Impersonation',
  other: 'Something else',
};

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? 'Something else';
}

export const TARGET_LABELS: Record<ReportTarget, string> = {
  workout: 'Workout',
  profile: 'Profile',
  comment: 'Comment',
};

/** What "Remove" does for each kind of report (null: removal isn't offered). */
export function removeLabel(target: ReportTarget): string | null {
  if (target === 'comment') return 'Delete comment';
  if (target === 'workout') return 'Hide workout';
  return null;
}

export function removeConfirmation(target: ReportTarget): string {
  return target === 'comment'
    ? 'This permanently deletes the comment.'
    : 'This sets the workout to “Only me”. The owner keeps their data and can see it, but nobody else can.';
}

function clip(text: string, max: number): string {
  const chars = Array.from(text.replace(/\s+/g, ' ').trim());
  return chars.length <= max ? chars.join('') : `${chars.slice(0, max - 1).join('')}…`;
}

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? clip(value, max) : '';
}

/**
 * The reported content as a few plain lines. The snapshot is jsonb copied from
 * somebody else's content, so nothing in it is trusted: every field is checked,
 * stringified and clipped.
 */
export function summarizeSnapshot(target: ReportTarget, snapshot: unknown): string[] {
  const data = snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot) ? (snapshot as Record<string, unknown>) : {};
  if (target === 'comment') {
    const body = asText(data.body, 300);
    return body ? [`“${body}”`] : ['(no text saved)'];
  }
  if (target === 'profile') {
    const lines = [asText(data.display_name, 60), asText(data.username, 40) ? `@${asText(data.username, 40)}` : ''].filter(Boolean);
    return lines.length > 0 ? lines : ['(nothing saved)'];
  }
  const dayType = data.day_type && typeof data.day_type === 'object' ? asText((data.day_type as Record<string, unknown>).name, 60) : '';
  const lines: string[] = [];
  if (dayType) lines.push(dayType);
  const names = normalizeEntries(data.exercises)
    .slice(0, 5)
    .map((entry) => clip(entry.exercise.name, 40));
  if (names.length > 0) lines.push(names.join(', '));
  const notes = asText(data.notes, 300);
  if (notes) lines.push(`Notes: “${notes}”`);
  return lines.length > 0 ? lines : ['(nothing saved)'];
}

export function friendlyModerationError(message: string): string {
  if (message.includes('not_admin')) return 'Only admins can do that.';
  if (message.includes('cannot_remove_profile')) return 'Profiles can’t be removed here. Handle them in the dashboard.';
  if (message.includes('report_not_found')) return 'That report no longer exists.';
  return message;
}
