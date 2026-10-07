import type { HoopersStatus } from '../types/hoopers';
import { formatCommentTime } from './comments';

/** Same thresholds the old server used: up to 12 is easy, up to 20 is busy-ish, beyond that is full. */
export function crowdednessStatus(count: number): HoopersStatus {
  if (!Number.isFinite(count) || count <= 12) return 'Not Crowded';
  if (count <= 20) return 'Moderate';
  return 'Very Crowded';
}

/** "checked in just now" / "checked in 12m ago" / "checked in 1h ago". */
export function checkedInLabel(iso: string, now: Date = new Date()): string {
  const age = formatCommentTime(iso, now);
  if (age === '') return '';
  return age === 'just now' ? 'checked in just now' : `checked in ${age} ago`;
}

export function friendlyHoopersError(message: string): string {
  if (message.includes('username_required')) return 'Choose a username first.';
  if (message.includes('not_authenticated')) return 'Please sign in again.';
  return message;
}

/** "3 playing", "1 playing", "0 playing". */
export function playersLabel(count: number): string {
  return `${Math.max(0, Math.floor(count))} playing`;
}
