const cheerio = require('cheerio');
require('dotenv').config();

const DENSITY_BASE_URL = 'https://api.density.io/v2';
const DENSITY_DISPLAY_ID =
  process.env.DENSITY_DISPLAY_ID || 'dsp_956223069054042646';
const DENSITY_SPACE_ID =
  process.env.DENSITY_SPACE_ID || 'spc_863128347956216317';
const DENSITY_SHARE_TOKEN =
  process.env.DENSITY_SHARE_TOKEN ||
  'shr_o69HxjQ0BYrY2FPD9HxdirhJYcFDCeRolEd744Uj88e';

const MBO_WIDGET_ID = process.env.MBO_WIDGET_ID || '3262';
const MBO_BASE_URL = 'https://widgets.mindbodyonline.com';
const PACIFIC_TIMEZONE = 'America/Los_Angeles';

const WEIGHTROOM_HOURS = {
  0: { open: '09:00', close: '22:00' }, // Sunday
  1: { open: '06:00', close: '23:00' }, // Monday
  2: { open: '06:00', close: '23:00' },
  3: { open: '06:00', close: '23:00' },
  4: { open: '06:00', close: '23:00' },
  5: { open: '06:00', close: '22:00' }, // Friday
  6: { open: '08:00', close: '22:00' }, // Saturday
};

const WEIGHTROOM_HOURS_DISPLAY = [
  { label: 'Mon – Thu', open: '6:00 AM', close: '11:00 PM' },
  { label: 'Fri', open: '6:00 AM', close: '10:00 PM' },
  { label: 'Sat', open: '8:00 AM', close: '10:00 PM' },
  { label: 'Sun', open: '9:00 AM', close: '10:00 PM' },
];

const cache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(
      `Request to ${url} failed with ${response.status}: ${body}`,
    );
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function densityFetch(path) {
  const url = `${DENSITY_BASE_URL}${path}`;
  return fetchJson(url, {
    headers: {
      Authorization: `Bearer ${DENSITY_SHARE_TOKEN}`,
    },
  });
}

function getPacificISODate(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PACIFIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

function getPacificDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const result = {};
  parts.forEach((part) => {
    if (part.type === 'weekday') result.weekday = part.value;
    if (part.type === 'hour') result.hour = Number(part.value);
    if (part.type === 'minute') result.minute = Number(part.value);
  });
  return result;
}

const WEEKDAY_TO_INDEX = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function minutesFromTimeString(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function isWithinOperatingHours(date = new Date()) {
  const parts = getPacificDateParts(date);
  const weekdayIndex = WEEKDAY_TO_INDEX[parts.weekday];
  const todayHours = WEIGHTROOM_HOURS[weekdayIndex];
  if (!todayHours) {
    return false;
  }
  const minutesNow = parts.hour * 60 + parts.minute;
  const opens = minutesFromTimeString(todayHours.open);
  const closes = minutesFromTimeString(todayHours.close);
  return minutesNow >= opens && minutesNow < closes;
}

function buildClosedMessage() {
  const windowText = WEIGHTROOM_HOURS_DISPLAY.map(
    (slot) => `${slot.label}: ${slot.open} – ${slot.close}`,
  ).join(' · ');
  return `The RSF weight room is currently closed. Regular hours — ${windowText}.`;
}

function withHoursPayload(payload) {
  return { ...payload, hours: WEIGHTROOM_HOURS_DISPLAY };
}

function toCache(key, ttlMs, loader) {
  return async () => {
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && now - cached.timestamp < ttlMs) {
      return cached.value;
    }
    const value = await loader();
    cache.set(key, { value, timestamp: now });
    return value;
  };
}

async function loadWeightRoomStatus() {
  const now = new Date();
  const openNow = isWithinOperatingHours(now);

  let displayData;
  try {
    displayData = await densityFetch(`/displays/${DENSITY_DISPLAY_ID}`);
  } catch (error) {
    if (!openNow) {
      return withHoursPayload({
        occupancy: 0,
        capacity: null,
        percent: null,
        status: 'Closed',
        message: buildClosedMessage(),
        updatedAt: now.toISOString(),
        isOpen: false,
      });
    }
    throw error;
  }

  let countData;
  try {
    countData = await densityFetch(`/spaces/${DENSITY_SPACE_ID}/count`);
  } catch (error) {
    if (!openNow) {
      return withHoursPayload({
        occupancy: 0,
        capacity:
          displayData?.dedicated_space?.safe_capacity ||
          displayData?.dedicated_space?.capacity ||
          null,
        percent: null,
        status: 'Closed',
        message: buildClosedMessage(),
        updatedAt: now.toISOString(),
        isOpen: false,
      });
    }

    return withHoursPayload({
      occupancy: 0,
      capacity:
        displayData?.dedicated_space?.safe_capacity ||
        displayData?.dedicated_space?.capacity ||
        null,
      percent: null,
      status: 'Capacity unavailable',
      message:
        'We can’t reach the Density sensors right now. Please try again shortly.',
      updatedAt: now.toISOString(),
      isOpen: true,
    });
  }

  const capacity =
    displayData?.dedicated_space?.safe_capacity ||
    displayData?.dedicated_space?.capacity ||
    null;
  const occupancy =
    countData?.count ?? displayData?.dedicated_space?.current_count ?? 0;
  const percent =
    capacity && capacity > 0 ? Math.round((occupancy / capacity) * 100) : null;
  const thresholdText =
    occupancy >= (capacity || Infinity)
      ? displayData?.at_or_above_threshold_text || 'Wait'
      : displayData?.below_threshold_text || 'Go';

  return withHoursPayload({
    occupancy,
    capacity,
    percent,
    status: thresholdText,
    message: displayData?.message || '',
    updatedAt: now.toISOString(),
    isOpen: openNow,
  });
}

async function fetchClassMarkup(startDateISO) {
  const url = new URL(
    `${MBO_BASE_URL}/widgets/schedules/${MBO_WIDGET_ID}/load_markup`,
  );
  url.searchParams.set('options[start_date]', startDateISO);
  return fetchJson(url.toString());
}

function parseSessionsFromHtml(html, scheduleDataMap = {}) {
  const $ = cheerio.load(html);
  const days = [];

  $('.bw-widget__day').each((_, dayEl) => {
    const $day = $(dayEl);
    const label = $day.find('.bw-widget__date').text().trim();
    const dateClass =
      ($day.find('.bw-widget__date').attr('class') || '').match(/date-(\d{4}-\d{2}-\d{2})/);
    const isoDate = dateClass ? dateClass[1] : null;
    if (!isoDate) {
      return;
    }
    const sessions = [];
    $day.find('.bw-session').each((__, sessionEl) => {
      const $session = $(sessionEl);
      const sessionId = $session.attr('id');
      // Use mbo-class-id to match with schedule data (this is the key in scheduleData.contents)
      const mboClassId = $session.attr('data-bw-widget-mbo-class-id');
      const start = $session.find('time.hc_starttime').attr('datetime');
      const end = $session.find('time.hc_endtime').attr('datetime');
      const description = $session
        .find('.bw-session__description')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();
      const location = $session
        .find('.bw-session__room')
        .text()
        .replace(/Room:/i, '')
        .trim();
      const instructor = $session.find('.bw-session__staff').text().trim();
      const category = $session.find('.bw-session__type').text().trim();
      const name = $session.find('.bw-session__name').text().trim();
      
      // Check cancellation status: prefer schedule data JSON, fallback to HTML
      let isCancelled = false;
      if (mboClassId && scheduleDataMap[mboClassId]) {
        isCancelled = scheduleDataMap[mboClassId].isCanceled === true;
      } else {
        // Fallback to HTML parsing
        const cancelledEl = $session.find('.bw-session__canceled');
        const cancelledText = cancelledEl.text().trim();
        isCancelled =
          cancelledEl.length > 0 &&
          cancelledText.toLowerCase().includes('cancel');
      }

      sessions.push({
        id: $session.attr('id'),
        name,
        category,
        instructor,
        startTimeLocal: start || null,
        endTimeLocal: end || null,
        timeZone: PACIFIC_TIMEZONE,
        location: location || 'UC Berkeley Rec Sports',
        description,
        isCancelled,
      });
    });

    days.push({
      date: isoDate,
      label,
      sessions,
    });
  });

  return days;
}

async function loadGroupFitnessSchedule(startDateISO) {
  const payload = await fetchClassMarkup(startDateISO);
  const htmlContent = payload?.class_sessions || payload?.contents;
  if (!htmlContent) {
    return { startDate: startDateISO, days: [] };
  }

  // Extract schedule data JSON from embedded script tags
  let scheduleDataMap = {};
  try {
    const scheduleDataMatch = htmlContent.match(
      /scheduleData\s*=\s*({[\s\S]*?})\s*$/m,
    );
    if (scheduleDataMatch) {
      const dataStr = scheduleDataMatch[1];
      // Extract all session IDs and their isCanceled status
      // Pattern: "sessionId":{"...","isCanceled":true/false,"...
      const sessionMatches = dataStr.matchAll(
        /"(\d+)"\s*:\s*\{[^}]*"isCanceled"\s*:\s*(true|false)/g,
      );
      for (const match of sessionMatches) {
        const sessionId = match[1];
        const isCanceled = match[2] === 'true';
        scheduleDataMap[sessionId] = { isCanceled };
      }
    }
  } catch (e) {
    // If parsing fails, continue with HTML-only parsing
    console.warn('Could not parse schedule data JSON:', e.message);
  }

  const days = parseSessionsFromHtml(htmlContent, scheduleDataMap);

  return {
    startDate: startDateISO,
    days,
  };
}

function cachedClasses(startDateISO) {
  return toCache(
    `classes:${startDateISO}`,
    5 * 60 * 1000,
    () => loadGroupFitnessSchedule(startDateISO),
  )();
}

module.exports = {
  fetchWeightRoomStatus: toCache('weightroom', 30 * 1000, loadWeightRoomStatus),
  fetchGroupFitnessSchedule: cachedClasses,
  getPacificISODate,
  sleep,
};

