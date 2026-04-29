const { getSupabase, isSupabaseConfigured } = require('./supabaseClient');

const PACIFIC = 'America/Los_Angeles';

let warnedMissingSupabase = false;

const WEEKDAY_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function getPacificParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(date);
  let weekday;
  let hour = 0;
  let minute = 0;
  parts.forEach((part) => {
    if (part.type === 'weekday') weekday = part.value;
    if (part.type === 'hour') hour = Number(part.value);
    if (part.type === 'minute') minute = Number(part.value);
  });
  return {
    dayOfWeek: WEEKDAY_TO_INDEX[weekday] ?? 0,
    hour,
    minute,
  };
}

async function insertSnapshotRow(row, attempt = 0) {
  const supabase = getSupabase();
  if (!supabase) {
    return false;
  }
  const { error } = await supabase.from('capacity_snapshots').insert(row);
  if (error) {
    console.error('[DataCollection] Supabase insert error:', error.message);
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      return insertSnapshotRow(row, attempt + 1);
    }
    return false;
  }
  return true;
}

/**
 * Persist a capacity snapshot (Pacific-local day/hour for analytics alignment).
 * @param {Object} status - { currentCount, maxCapacity, isOpen }
 */
async function storeCapacitySnapshot(status) {
  if (!status || typeof status.currentCount !== 'number') {
    return;
  }
  if (!isSupabaseConfigured()) {
    if (!warnedMissingSupabase) {
      console.warn(
        '[DataCollection] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set; snapshots not persisted.',
      );
      warnedMissingSupabase = true;
    }
    return;
  }

  const now = new Date();
  const { dayOfWeek, hour, minute } = getPacificParts(now);
  const maxCap = status.maxCapacity || 100;
  const pct = status.currentCount / maxCap;

  const row = {
    recorded_at: now.toISOString(),
    day_of_week: dayOfWeek,
    hour,
    minute,
    current_count: status.currentCount,
    max_capacity: maxCap,
    percentage: pct,
    is_open: status.isOpen !== false,
  };

  const ok = await insertSnapshotRow(row);
  if (ok) {
    console.log(
      `[DataCollection] Stored snapshot: ${row.current_count}/${row.max_capacity} @ Pacific ${hour}:${String(minute).padStart(2, '0')} DOW=${dayOfWeek}`,
    );
  }
}

/**
 * Load snapshots from the last `days` days for analytics (max ~50k rows server-side cap via range).
 */
async function getCapacitySnapshotsForAnalytics(days = 90) {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('capacity_snapshots')
    .select(
      'recorded_at, day_of_week, hour, minute, current_count, max_capacity, percentage, is_open',
    )
    .gte('recorded_at', since)
    .order('recorded_at', { ascending: true })
    .limit(50000);

  if (error) {
    console.error('[DataCollection] Supabase select error:', error.message);
    return [];
  }
  return (data || []).map((row) => ({
    timestamp: row.recorded_at,
    dayOfWeek: row.day_of_week,
    hour: row.hour,
    minute: row.minute,
    currentCount: row.current_count,
    maxCapacity: row.max_capacity,
    percentage: row.percentage,
    isOpen: row.is_open,
  }));
}

/** @deprecated Use getCapacitySnapshotsForAnalytics — kept for scripts expecting sync shape */
async function getCapacityData() {
  return getCapacitySnapshotsForAnalytics(90);
}

/**
 * Recent rows for debugging (last N by time desc).
 */
async function getRecentCapacityRows(limit = 100) {
  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from('capacity_snapshots')
    .select('*')
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[DataCollection] Supabase recent rows error:', error.message);
    return [];
  }
  return data || [];
}

module.exports = {
  storeCapacitySnapshot,
  getCapacitySnapshotsForAnalytics,
  getCapacityData,
  getRecentCapacityRows,
  getPacificParts,
};
