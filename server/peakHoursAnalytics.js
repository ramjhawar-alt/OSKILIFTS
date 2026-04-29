const {
  getCapacitySnapshotsForAnalytics,
  getPacificParts,
} = require('./dataCollectionService');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Same operating windows as rsfService WEIGHTROOM_HOURS */
const WEIGHTROOM_HOURS = {
  0: { open: '09:00', close: '22:00' },
  1: { open: '06:00', close: '23:00' },
  2: { open: '06:00', close: '23:00' },
  3: { open: '06:00', close: '23:00' },
  4: { open: '06:00', close: '23:00' },
  5: { open: '06:00', close: '22:00' },
  6: { open: '08:00', close: '22:00' },
};

function minutesFromTimeString(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function isWeightRoomOpenPacific(date = new Date()) {
  const parts = getPacificParts(date);
  const hours = WEIGHTROOM_HOURS[parts.dayOfWeek];
  if (!hours) return false;
  const minutesNow = parts.hour * 60 + parts.minute;
  const opens = minutesFromTimeString(hours.open);
  const closes = minutesFromTimeString(hours.close);
  return minutesNow >= opens && minutesNow < closes;
}

function formatHour12(hour) {
  if (hour === null || hour === undefined) return '—';
  const period = hour >= 12 ? 'PM' : 'AM';
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}:00 ${period}`;
}

const DISPLAY_HOURS = [];
for (let h = 6; h <= 23; h += 1) DISPLAY_HOURS.push(h);

const MIN_TOTAL_SAMPLES = 20;
/** Minimum samples for a (dayOfWeek, hour) cell to count toward chart */
const MIN_CELL_SAMPLES = 5;

/**
 * At least one snapshot per calendar weekday (0–6) before showing the full chart UI.
 * @param {Array<{ dayOfWeek: number }>} rows
 */
function allWeekdaysHaveSnapshot(rows) {
  const days = new Set();
  rows.forEach((e) => {
    if (typeof e.dayOfWeek === 'number' && e.dayOfWeek >= 0 && e.dayOfWeek <= 6) {
      days.add(e.dayOfWeek);
    }
  });
  return days.size === 7;
}

/**
 * @returns {Promise<object>}
 */
async function analyzePeakHours() {
  const data = await getCapacitySnapshotsForAnalytics(90);

  const now = new Date();
  const pacific = getPacificParts(now);
  const todayDow = pacific.dayOfWeek;
  const currentHour = pacific.hour;

  if (data.length < MIN_TOTAL_SAMPLES) {
    return {
      hasEnoughData: false,
      hasData: false,
      peakHoursReady: false,
      message:
        data.length === 0
          ? "We're collecting gym traffic patterns — check back soon for peak hours."
          : `We're still learning your gym's rhythm (${data.length} samples so far). Peak charts unlock after more visits are recorded.`,
      totalSamples: data.length,
      today: todayDow,
      currentHour,
      currentPercent: null,
      byDay: {},
      busiest: null,
      bestTime: null,
      busiestDay: null,
      dataRange: null,
      recommendation: {
        verdict: 'collecting',
        headline: 'Building your chart',
        detail: 'Keep the app running — we save a snapshot every few minutes while the server is up.',
        suggestedHour: null,
      },
    };
  }

  if (!allWeekdaysHaveSnapshot(data)) {
    const daysSeen = new Set();
    data.forEach((e) => {
      if (typeof e.dayOfWeek === 'number' && e.dayOfWeek >= 0 && e.dayOfWeek <= 6) {
        daysSeen.add(e.dayOfWeek);
      }
    });
    const missing = [0, 1, 2, 3, 4, 5, 6].filter((d) => !daysSeen.has(d));
    const missingLabels = missing.map((d) => DAY_NAMES[d]).join(', ');
    return {
      hasEnoughData: false,
      hasData: false,
      peakHoursReady: false,
      daysCovered: daysSeen.size,
      missingWeekdays: missing.map((d) => DAY_NAMES[d]),
      message: `Peak hours are on the way. We need at least one snapshot on each day of the week (${daysSeen.size}/7 so far). Still collecting: ${missingLabels}.`,
      totalSamples: data.length,
      today: todayDow,
      currentHour,
      currentPercent: null,
      byDay: {},
      busiest: null,
      bestTime: null,
      busiestDay: null,
      dataRange: {
        oldest: data[0]?.timestamp,
        newest: data[data.length - 1]?.timestamp,
      },
      recommendation: {
        verdict: 'collecting',
        headline: 'Peak hours coming soon',
        detail: `We've seen ${daysSeen.size} of 7 weekdays in your data. Once every weekday has at least one reading, the full chart unlocks automatically.`,
        suggestedHour: null,
      },
    };
  }

  const openRows = data.filter((e) => e.isOpen);
  const pct = (entry) =>
    entry.percentage != null
      ? entry.percentage
      : entry.currentCount / (entry.maxCapacity || 100);

  /** @type {Record<string, Record<number, number[]>>} */
  const byDayHourBuckets = {};
  for (let d = 0; d < 7; d += 1) {
    byDayHourBuckets[d] = {};
    DISPLAY_HOURS.forEach((h) => {
      byDayHourBuckets[d][h] = [];
    });
  }

  openRows.forEach((entry) => {
    const d = entry.dayOfWeek;
    const h = entry.hour;
    if (byDayHourBuckets[d] && byDayHourBuckets[d][h] !== undefined) {
      byDayHourBuckets[d][h].push(pct(entry));
    }
  });

  /** @type {Record<string, Array<{ hour: number, avgPercent: number | null, sampleCount: number }>>} */
  const byDay = {};

  for (let d = 0; d < 7; d += 1) {
    byDay[String(d)] = DISPLAY_HOURS.map((hour) => {
      const samples = byDayHourBuckets[d][hour];
      const n = samples.length;
      if (n < MIN_CELL_SAMPLES) {
        return { hour, avgPercent: null, sampleCount: n };
      }
      const avg =
        samples.reduce((s, v) => s + v, 0) / samples.length;
      return {
        hour,
        avgPercent: Math.round(avg * 100),
        sampleCount: n,
      };
    });
  }

  // Global busiest / quietest hour (averaged across all days)
  const hourAgg = {};
  DISPLAY_HOURS.forEach((h) => {
    hourAgg[h] = [];
  });
  openRows.forEach((entry) => {
    hourAgg[entry.hour]?.push(pct(entry));
  });

  let busiestHour = null;
  let busiestAvg = -1;
  let bestHour = null;
  let bestAvg = 2;
  DISPLAY_HOURS.forEach((h) => {
    const arr = hourAgg[h];
    if (arr.length < 3) return;
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    if (avg > busiestAvg) {
      busiestAvg = avg;
      busiestHour = h;
    }
    if (avg < bestAvg && avg > 0) {
      bestAvg = avg;
      bestHour = h;
    }
  });

  const dayAgg = {};
  for (let d = 0; d < 7; d += 1) {
    dayAgg[d] = [];
  }
  openRows.forEach((entry) => {
    dayAgg[entry.dayOfWeek].push(pct(entry));
  });

  let busiestDay = null;
  let busiestDayAvg = -1;
  for (let d = 0; d < 7; d += 1) {
    const arr = dayAgg[d];
    if (arr.length < 5) continue;
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
    if (avg > busiestDayAvg) {
      busiestDayAvg = avg;
      busiestDay = d;
    }
  }

  const oldest = data[0]?.timestamp;
  const newest = data[data.length - 1]?.timestamp;

  // Latest snapshot for "current" hour (rough live-ish percent)
  const recentSameHour = openRows.filter((e) => {
    const ts = new Date(e.timestamp).getTime();
    return (
      e.dayOfWeek === todayDow &&
      e.hour === currentHour &&
      now.getTime() - ts < 45 * 60 * 1000
    );
  });
  let currentPercent = null;
  if (recentSameHour.length) {
    const last = recentSameHour[recentSameHour.length - 1];
    currentPercent = Math.round(pct(last) * 100);
  } else {
    const cell = byDay[String(todayDow)]?.find((x) => x.hour === currentHour);
    if (cell && cell.avgPercent != null) {
      currentPercent = cell.avgPercent;
    }
  }

  const recommendation = buildRecommendation({
    todayDow,
    currentHour,
    currentPercent,
    byDay,
    isOpen: isWeightRoomOpenPacific(now),
  });

  const busiestSlot =
    busiestHour !== null
      ? {
          hour: busiestHour,
          avgPercent: Math.round(busiestAvg * 100),
          label: formatHour12(busiestHour),
        }
      : null;
  const bestSlot =
    bestHour !== null
      ? {
          hour: bestHour,
          avgPercent: Math.round(bestAvg * 100),
          label: formatHour12(bestHour),
        }
      : null;

  return {
    hasEnoughData: true,
    hasData: true,
    peakHoursReady: true,
    daysCovered: 7,
    totalSamples: data.length,
    today: todayDow,
    currentHour,
    currentPercent,
    byDay,
    busiest: busiestSlot,
    bestTime: bestSlot,
    busiestDay: busiestDay !== null ? DAY_NAMES[busiestDay] : null,
    dataRange: {
      oldest,
      newest,
    },
    recommendation,
    // Human-readable lines for simple clients / README
    busiestText:
      busiestSlot != null
        ? `${busiestSlot.label} (avg ${busiestSlot.avgPercent}% full)`
        : 'N/A',
    bestTimeText:
      bestSlot != null
        ? `${bestSlot.label} (avg ${bestSlot.avgPercent}% full)`
        : 'N/A',
  };
}

function buildRecommendation({
  todayDow,
  currentHour,
  currentPercent,
  byDay,
  isOpen,
}) {
  if (!isOpen) {
    return {
      verdict: 'closed',
      headline: 'Weight room closed',
      detail: 'Check hours on the home screen — come back when the floor is open.',
      suggestedHour: null,
    };
  }

  const todaySeries = byDay[String(todayDow)] || [];
  const cell = todaySeries.find((x) => x.hour === currentHour);
  const typical = cell?.avgPercent;

  const validHours = todaySeries.filter((x) => x.avgPercent != null);
  const quietest =
    validHours.length > 0
      ? validHours.reduce((a, b) => (a.avgPercent <= b.avgPercent ? a : b))
      : null;

  if (typical == null) {
    return {
      verdict: 'go_now',
      headline: 'Heads up',
      detail:
        "We don't have enough samples for this exact hour yet — floors are usually quieter outside mid-afternoon.",
      suggestedHour: quietest?.hour ?? null,
    };
  }

  if (quietest && currentHour === quietest.hour && typical <= 40) {
    return {
      verdict: 'best_now',
      headline: 'Best time window',
      detail: `Around ${formatHour12(
        quietest.hour,
      )} is typically one of the lighter slots (${quietest.avgPercent}% full).`,
      suggestedHour: null,
    };
  }

  if (typical <= 35) {
    return {
      verdict: 'best_now',
      headline: 'Usually quiet right now',
      detail: `Historically ~${typical}% full around ${formatHour12(currentHour)}.`,
      suggestedHour: null,
    };
  }

  if (typical <= 55) {
    return {
      verdict: 'go_now',
      headline: 'Reasonable time',
      detail: `Typically ~${typical}% full — expect some crowds but usually workable.`,
      suggestedHour: null,
    };
  }

  if (typical > 65 && quietest && quietest.hour > currentHour) {
    return {
      verdict: 'wait',
      headline: 'Usually busy now',
      detail: `Around ${typical}% full historically. Quieter window often starts near ${formatHour12(
        quietest.hour,
      )}.`,
      suggestedHour: quietest.hour,
    };
  }

  if (typical > 65) {
    return {
      verdict: 'wait',
      headline: 'Peak traffic',
      detail: `This hour trends ~${typical}% full. Try early morning or late evening another day.`,
      suggestedHour: quietest?.hour ?? null,
    };
  }

  return {
    verdict: 'go_now',
    headline: 'Okay to go',
    detail: `Typically ~${typical}% full — use your judgment.`,
    suggestedHour: null,
  };
}

module.exports = {
  analyzePeakHours,
};
