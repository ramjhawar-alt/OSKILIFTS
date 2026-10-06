export const REST_PRESETS_SEC = [60, 90, 120, 180, 300];
export const DEFAULT_REST_SEC = 120;
export const MIN_REST_SEC = 5;
export const MAX_REST_SEC = 1800;

export interface RestTimer {
  /** epoch ms when the rest ends; null when no rest is running */
  endsAt: number | null;
  /** guards the "rest over" alert so it fires once per rest */
  alerted: boolean;
}

export const idleTimer = (): RestTimer => ({ endsAt: null, alerted: false });

export function startRest(now: number, seconds: number): RestTimer {
  return { endsAt: now + clampSeconds(seconds) * 1000, alerted: false };
}

export function clampSeconds(seconds: number): number {
  return Math.min(MAX_REST_SEC, Math.max(MIN_REST_SEC, Math.round(seconds)));
}

/** Remaining time derived from timestamps, so throttled timers never drift. */
export function remainingMs(timer: RestTimer, now: number): number {
  return timer.endsAt === null ? 0 : Math.max(0, timer.endsAt - now);
}

export function adjustRest(timer: RestTimer, now: number, deltaSeconds: number): RestTimer {
  if (timer.endsAt === null) return timer;
  const remaining = Math.max(0, timer.endsAt - now);
  const next = Math.max(0, remaining + deltaSeconds * 1000);
  return { endsAt: now + next, alerted: next > 0 ? false : timer.alerted };
}

export function isFinished(timer: RestTimer, now: number): boolean {
  return timer.endsAt !== null && now >= timer.endsAt;
}

/** True exactly once when a running rest crosses zero. */
export function shouldAlert(timer: RestTimer, now: number): boolean {
  return isFinished(timer, now) && !timer.alerted;
}

export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** The next longer preset, wrapping around to the shortest. */
export function nextPreset(current: number): number {
  return REST_PRESETS_SEC.find((preset) => preset > current) ?? REST_PRESETS_SEC[0];
}
