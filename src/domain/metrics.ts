export interface DailyPoint {
  day: string;
  signups: number;
  workouts: number;
  active: number;
}

export interface AdminMetrics {
  days: number;
  totals: {
    users: number;
    onboarded: number;
    publicAccounts: number;
    workouts: number;
    active7d: number;
    activePrev7d: number;
    follows: number;
    openReports: number;
  };
  adoption: {
    leaderboard: number;
    weeklyRecap: number;
    weeklyGoals: number;
    hoopersNow: number;
    atRsfNow: number;
    headingNow: number;
  };
  funnel: {
    signups: number;
    onboarded: number;
    loggedWorkout: number;
    followedSomeone: number;
    returnedAfterWeek: number;
  };
  invites: { total: number; inPeriod: number; top: { username: string; count: number }[] };
  daily: DailyPoint[];
}

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
};
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** Turns the server's JSON into a safe shape. Never throws; anything odd becomes zero. */
export function parseMetrics(raw: unknown): AdminMetrics {
  const root = obj(raw);
  const totals = obj(root.totals);
  const adoption = obj(root.adoption);
  const funnel = obj(root.funnel);
  const invites = obj(root.invites);
  const daily = Array.isArray(root.daily) ? root.daily : [];
  const top = Array.isArray(invites.top) ? invites.top : [];
  return {
    days: num(root.days),
    totals: {
      users: num(totals.users),
      onboarded: num(totals.onboarded),
      publicAccounts: num(totals.public_accounts),
      workouts: num(totals.workouts),
      active7d: num(totals.active_7d),
      activePrev7d: num(totals.active_prev_7d),
      follows: num(totals.follows),
      openReports: num(totals.open_reports),
    },
    adoption: {
      leaderboard: num(adoption.leaderboard),
      weeklyRecap: num(adoption.weekly_recap),
      weeklyGoals: num(adoption.weekly_goals),
      hoopersNow: num(adoption.hoopers_now),
      atRsfNow: num(adoption.at_rsf_now),
      headingNow: num(adoption.heading_now),
    },
    funnel: {
      signups: num(funnel.signups),
      onboarded: num(funnel.onboarded),
      loggedWorkout: num(funnel.logged_workout),
      followedSomeone: num(funnel.followed_someone),
      returnedAfterWeek: num(funnel.returned_after_week),
    },
    invites: {
      total: num(invites.total),
      inPeriod: num(invites.in_period),
      top: top
        .slice(0, 5)
        .map((entry) => obj(entry))
        .filter((entry) => typeof entry.username === 'string')
        .map((entry) => ({ username: String(entry.username).slice(0, 20), count: num(entry.count) })),
    },
    daily: daily.slice(0, 90).map((entry) => {
      const point = obj(entry);
      return {
        day: typeof point.day === 'string' ? point.day.slice(0, 10) : '',
        signups: num(point.signups),
        workouts: num(point.workouts),
        active: num(point.active),
      };
    }),
  };
}

/** "37%", or "—" when there is nothing to divide by. */
export function percent(part: number, whole: number): string {
  if (!whole || whole <= 0) return '—';
  return `${Math.round((Math.min(part, whole) / whole) * 100)}%`;
}

export type Trend = { direction: 'up' | 'down' | 'flat' | 'new'; label: string };

/** This week versus last week: "up 3 (+50%)", "down 2", "same", or "new" when last week was zero. */
export function trend(current: number, previous: number): Trend {
  if (current === previous) return { direction: 'flat', label: 'same as last week' };
  if (previous === 0) return { direction: 'new', label: `up ${current} from none last week` };
  const delta = current - previous;
  const pct = Math.round((Math.abs(delta) / previous) * 100);
  return delta > 0
    ? { direction: 'up', label: `up ${delta} (+${pct}%) vs last week` }
    : { direction: 'down', label: `down ${-delta} (-${pct}%) vs last week` };
}

/** Bar heights from 0..1, so the tallest bar fills the chart (and an all-zero series stays flat). */
export function barHeights(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((value) => (max > 0 ? value / max : 0));
}

export function sumOf(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function friendlyMetricsError(message: string): string {
  if (message.includes('not_admin')) return 'Only admins can see this.';
  return message;
}
