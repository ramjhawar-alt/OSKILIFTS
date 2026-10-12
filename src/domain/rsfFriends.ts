export type BearMode = 'lift' | 'idle';

/** The bear lifts while its owner is at the RSF (sharing on and inside the geofence), and breathes otherwise. */
export function bearModeFor(status: string): BearMode {
  return status === 'at' ? 'lift' : 'idle';
}

export interface FriendAtRsf {
  id: string;
  username: string;
  displayName: string | null;
  arrivedAt: string;
  expiresAt: string;
  /** their bear stage, 1-10 */
  stage: number;
}

export interface FriendAtRsfRow {
  id: string;
  username: string;
  display_name: string | null;
  arrived_at: string;
  expires_at: string;
  /** missing until migration 020 has been run */
  stage?: number | null;
}

/** A stage from the server, or 1 when it is missing or junk (never throws). */
export function safeStage(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(10, Math.max(1, Math.floor(n)));
}

export function mapFriendRow(row: FriendAtRsfRow): FriendAtRsf {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    arrivedAt: row.arrived_at,
    expiresAt: row.expires_at,
    stage: safeStage(row.stage),
  };
}

/** "5 min" or "2 hr": how long a friend has been at the RSF (at least 1 min). */
export function stayLabel(arrivedAt: string, nowMs: number): string {
  const arrived = Date.parse(arrivedAt);
  const minutes = Number.isFinite(arrived) ? Math.max(1, Math.round((nowMs - arrived) / 60000)) : 1;
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr`;
}
