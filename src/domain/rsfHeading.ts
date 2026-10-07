export const DEFAULT_HEADING_MINUTES = 90;

/** Whole minutes until `expiresAt`, never negative. */
export function minutesLeft(expiresAt: string, now: Date = new Date()): number {
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now.getTime()) / 60000));
}

/** "45 min left", "1 hr 20 min left", "2 hr left", or "ending now". */
export function timeLeftLabel(expiresAt: string, now: Date = new Date()): string {
  const minutes = minutesLeft(expiresAt, now);
  if (minutes <= 0) return 'ending now';
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr left` : `${hours} hr ${rest} min left`;
}

export interface CrowdSnapshot {
  status: string;
  isOpen: boolean;
  percent: number | null;
}

/** One sentence tying the status to what the crowd meter says right now. */
export function crowdLine(crowd: CrowdSnapshot | null): string | null {
  if (!crowd) return null;
  if (!crowd.isOpen) return 'The weight room is closed right now.';
  const label = crowd.status.toLowerCase();
  const full =
    crowd.percent !== null && Number.isFinite(crowd.percent) ? ` (${Math.round(crowd.percent)}% full)` : '';
  if (label.includes('wait')) return `It’s busy right now${full}.`;
  if (label.includes('go')) return `Good time to go${full}.`;
  return null;
}

/** "Maya is heading to the RSF", "Maya and Sam are…", "Maya, Sam and 3 others are…". */
export function friendsHeadingLine(names: string[]): string | null {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length === 0) return null;
  if (clean.length === 1) return `${clean[0]} is heading to the RSF`;
  if (clean.length === 2) return `${clean[0]} and ${clean[1]} are heading to the RSF`;
  const others = clean.length - 2;
  return `${clean[0]}, ${clean[1]} and ${others} ${others === 1 ? 'other' : 'others'} are heading to the RSF`;
}

export function friendlyHeadingError(message: string): string {
  if (message.includes('username_required')) return 'Choose a username first.';
  if (message.includes('not_authenticated')) return 'Please sign in again.';
  return message;
}
