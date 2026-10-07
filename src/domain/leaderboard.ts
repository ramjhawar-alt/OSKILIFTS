export interface BoardRow {
  id: string;
  username: string;
  displayName: string | null;
  days: number;
  isMe: boolean;
}

export interface RankedRow extends BoardRow {
  rank: number;
}

/** "1, 2, 2, 4" style ranking: people with the same days share a rank. */
export function rankRows(rows: BoardRow[]): RankedRow[] {
  const sorted = [...rows].sort((a, b) => b.days - a.days || a.username.localeCompare(b.username));
  return sorted.map((row) => ({
    ...row,
    rank: sorted.findIndex((other) => other.days === row.days) + 1,
  }));
}

export function daysLabel(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/** Monday of the week containing `now` (local time), at midnight. */
export function weekStart(now: Date): Date {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sinceMonday = (start.getDay() + 6) % 7; // Sunday = 0 -> 6
  start.setDate(start.getDate() - sinceMonday);
  return start;
}

/** "Oct 5 – Oct 11". */
export function weekRangeLabel(now: Date): string {
  const start = weekStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}`;
}

export function friendlyLeaderboardError(message: string): string {
  if (message.includes('username_required')) return 'Choose a username first.';
  if (message.includes('not_authenticated')) return 'Please sign in again.';
  return message;
}
