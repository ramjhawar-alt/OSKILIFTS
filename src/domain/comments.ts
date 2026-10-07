export const MAX_COMMENT_LENGTH = 500;
export const COUNTER_THRESHOLD = 400;

// Whitespace plus the zero-width characters the server also refuses.
const INVISIBLE = /[\s​-‏⁠﻿]/g;

export type CommentDraft =
  | { ok: true; body: string }
  | { ok: false; reason: 'empty' | 'too_long' };

/** Mirrors the server's checks so people get instant feedback; the server stays the authority. */
export function validateCommentDraft(text: string): CommentDraft {
  const body = text.replace(/^\s+|\s+$/g, '');
  if (body.replace(INVISIBLE, '') === '') return { ok: false, reason: 'empty' };
  if (Array.from(body).length > MAX_COMMENT_LENGTH) return { ok: false, reason: 'too_long' };
  return { ok: true, body };
}

/** Characters left, shown only once the comment is getting long. */
export function remainingCharacters(text: string): number | null {
  const used = Array.from(text).length;
  return used >= COUNTER_THRESHOLD ? MAX_COMMENT_LENGTH - used : null;
}

/** Turns a server error code into something a person can act on. */
export function friendlyCommentError(message: string): string {
  if (message.includes('comment_not_allowed')) {
    return 'That comment isn’t allowed. Please keep it respectful.';
  }
  if (message.includes('comment_rate_limited')) {
    return 'You’re commenting too quickly. Try again in a bit.';
  }
  if (message.includes('too_many_comments_on_workout')) {
    return 'You’ve reached the comment limit on this workout.';
  }
  if (message.includes('comment_target_not_found')) {
    return 'This workout is no longer available.';
  }
  if (message.includes('comment_not_found')) {
    return 'That comment is already gone.';
  }
  if (message.includes('comment_too_long')) return 'Comments can be up to 500 characters.';
  if (message.includes('comment_empty')) return 'Write something first.';
  if (message.includes('username_required')) return 'Choose a username before commenting.';
  return message;
}

/** "1 comment", "12 comments", or null when there are none. */
export function commentCountLabel(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  return count === 1 ? '1 comment' : `${count} comments`;
}

/** Compact age for a comment: "just now", "5m", "3h", "2d", then "Oct 6". */
export function formatCommentTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now'; // includes small clock skew into the future
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface Ordered {
  id: string;
  createdAt: string;
}

function compareComments(a: Ordered, b: Ordered): number {
  const byTime = Date.parse(a.createdAt) - Date.parse(b.createdAt);
  if (byTime !== 0 && !Number.isNaN(byTime)) return byTime;
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Merges comment lists oldest-first without duplicates (a later copy of an id wins). */
export function mergeComments<T extends Ordered>(current: T[], incoming: T[]): T[] {
  const byId = new Map<string, T>();
  for (const comment of current) byId.set(comment.id, comment);
  for (const comment of incoming) byId.set(comment.id, comment);
  return [...byId.values()].sort(compareComments);
}
