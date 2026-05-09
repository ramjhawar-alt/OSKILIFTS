/**
 * RSF facility hours (Pacific), aligned with server/rsfService.js WEIGHTROOM_HOURS
 * and RecWell published RSF schedule.
 */
export const WEIGHT_ROOM_HOURS_BY_DOW: Record<
  number,
  { open: string; close: string }
> = {
  0: { open: '08:00', close: '23:00' },
  1: { open: '07:00', close: '23:00' },
  2: { open: '07:00', close: '23:00' },
  3: { open: '07:00', close: '23:00' },
  4: { open: '07:00', close: '23:00' },
  5: { open: '07:00', close: '23:00' },
  6: { open: '08:00', close: '18:00' },
};

export const WEIGHT_ROOM_HOURS_LABEL: Record<number, string> = {
  0: 'Sun 8a–11p',
  1: 'Mon 7a–11p',
  2: 'Tue 7a–11p',
  3: 'Wed 7a–11p',
  4: 'Thu 7a–11p',
  5: 'Fri 7a–11p',
  6: 'Sat 8a–6p',
};

/** Clock hours [start..end] that fall inside operating window (inclusive). */
export function getOperatingHoursForDay(dayOfWeek: number): {
  hours: number[];
  label: string;
} {
  const spec = WEIGHT_ROOM_HOURS_BY_DOW[dayOfWeek] ?? {
    open: '06:00',
    close: '23:00',
  };
  const [openH] = spec.open.split(':').map(Number);
  const [closeH, closeM] = spec.close.split(':').map(Number);
  // e.g. close 23:00 → last bucket we chart is hour 22 (10–11p); close 22:00 → through 21
  const endInclusive = closeM === 0 ? closeH - 1 : closeH;
  const hours: number[] = [];
  for (let h = openH; h <= endInclusive && h <= 23; h += 1) {
    hours.push(h);
  }
  return {
    hours,
    label: WEIGHT_ROOM_HOURS_LABEL[dayOfWeek] ?? `${openH}:00–${closeH}:00`,
  };
}

/** A few tick labels spread across the hour list */
export function pickHourTicks(hours: number[]): number[] {
  if (hours.length === 0) return [];
  if (hours.length <= 5) return [...hours];
  const picks = new Set<number>();
  picks.add(hours[0]);
  picks.add(hours[Math.floor(hours.length / 4)]);
  picks.add(hours[Math.floor(hours.length / 2)]);
  picks.add(hours[Math.floor((3 * hours.length) / 4)]);
  picks.add(hours[hours.length - 1]);
  return [...picks].sort((a, b) => a - b);
}
