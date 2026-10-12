/** "12:34", or "1:02:09" once it passes an hour. Never negative. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Sets that have been checked off across the draft's exercises. */
export function countDoneSets(entries: { sets: { done: boolean }[] }[]): number {
  let done = 0;
  for (const entry of entries) for (const set of entry.sets) if (set.done) done += 1;
  return done;
}
