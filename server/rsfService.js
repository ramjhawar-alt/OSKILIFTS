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

// RecWell moved group fitness registration off the old MindBody widget onto
// their Innosoft Fusion storefront (shop.rs.berkeley.edu). There is no public
// MindBody schedule for RSF classes anymore, so we scrape the Fusion site
// instead.
const RS_SHOP_BASE_URL = process.env.RS_SHOP_BASE_URL || 'https://shop.rs.berkeley.edu';
const RS_SHOP_GROUP_FITNESS_CLASSIFICATION_ID =
  process.env.RS_SHOP_GROUP_FITNESS_CLASSIFICATION_ID ||
  '00000000-0000-0000-0000-000000026002';
const PACIFIC_TIMEZONE = 'America/Los_Angeles';

/** RSF facility hours per RecWell (recwell.berkeley.edu/rsf-hours). Summer 2026: 5/16–8/22. */
const WEIGHTROOM_HOURS = {
  0: { open: '08:00', close: '20:00' }, // Sunday 8a–8p
  1: { open: '07:00', close: '20:00' }, // Mon–Fri 7a–8p
  2: { open: '07:00', close: '20:00' },
  3: { open: '07:00', close: '20:00' },
  4: { open: '07:00', close: '20:00' },
  5: { open: '07:00', close: '20:00' },
  6: { open: '08:00', close: '18:00' }, // Saturday 8a–6p
};

const WEIGHTROOM_HOURS_DISPLAY = [
  { label: 'Mon – Fri', open: '7:00 AM', close: '8:00 PM' },
  { label: 'Sat', open: '8:00 AM', close: '6:00 PM' },
  { label: 'Sun', open: '8:00 AM', close: '8:00 PM' },
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

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const error = new Error(
      `Request to ${url} failed with ${response.status}: ${body}`,
    );
    error.status = response.status;
    throw error;
  }
  return response.text();
}

function categoryFromProgramName(name) {
  const match = name.match(/^(.*?)\s+at\s+the\s+/i);
  return (match ? match[1] : name).trim();
}

function formatDayLabel(isoDate) {
  const probe = new Date(`${isoDate}T12:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PACIFIC_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(probe);
}

async function fetchProgramCatalog() {
  const html = await fetchText(
    `${RS_SHOP_BASE_URL}/Program?classificationId=${RS_SHOP_GROUP_FITNESS_CLASSIFICATION_ID}`,
  );
  const $ = cheerio.load(html);
  const programs = [];
  $('.program-list-item').each((_, el) => {
    const $el = $(el);
    const href = $el.find('a.img-link').attr('href') || '';
    const idMatch = href.match(/courseId=([0-9a-fA-F-]{36})/);
    const name = $el.find('.program-list-item-title').text().trim();
    if (idMatch && name && !/test program/i.test(name)) {
      programs.push({ id: idMatch[1], name });
    }
  });
  return programs;
}

// #progDesc holds the class blurb plus boilerplate (cancellation notices,
// registration/check-in instructions) with no separate markup boundary, so
// trim everything from the first boilerplate heading onward.
function trimDescriptionBoilerplate(text) {
  const boilerplateMarkers = ['Canceled classes for', 'Group Fitness Classes'];
  let cutoff = text.length;
  boilerplateMarkers.forEach((marker) => {
    const index = text.indexOf(marker);
    if (index !== -1 && index < cutoff) {
      cutoff = index;
    }
  });
  return text.slice(0, cutoff).trim();
}

async function fetchProgramDescription(programId) {
  try {
    const html = await fetchText(
      `${RS_SHOP_BASE_URL}/Program/GetProgramDetails?courseId=${programId}`,
    );
    const $ = cheerio.load(html);
    const text = $('#progDesc').text().replace(/\s+/g, ' ').trim();
    return trimDescriptionBoilerplate(text);
  } catch (error) {
    return '';
  }
}

async function fetchProgramSessions(program) {
  const [instancesHtml, description] = await Promise.all([
    fetchText(
      `${RS_SHOP_BASE_URL}/Program/GetProgramInstances?programID=${program.id}`,
    ),
    fetchProgramDescription(program.id),
  ]);

  const $ = cheerio.load(instancesHtml);
  const raw = $('#ApptInfo').attr('value');
  if (!raw) {
    return [];
  }

  let instances;
  try {
    instances = JSON.parse(raw);
  } catch (error) {
    return [];
  }

  const category = categoryFromProgramName(program.name);

  return instances.map((instance) => ({
    id: instance.ID,
    name: program.name,
    category,
    instructor: instance.InstructorFirstNameLastInitial || '',
    startTimeLocal: instance.StartDate ? instance.StartDate.slice(0, 16) : null,
    endTimeLocal: instance.EndDate ? instance.EndDate.slice(0, 16) : null,
    timeZone: PACIFIC_TIMEZONE,
    location: instance.Location || 'UC Berkeley Rec Sports',
    description,
    isCancelled: false,
  }));
}

async function loadGroupFitnessSchedule(startDateISO) {
  const programs = await fetchProgramCatalog();
  const results = await Promise.allSettled(
    programs.map((program) => fetchProgramSessions(program)),
  );

  const sessionsByDate = new Map();
  results.forEach((result) => {
    if (result.status !== 'fulfilled') {
      return;
    }
    result.value.forEach((session) => {
      const date = session.startTimeLocal ? session.startTimeLocal.slice(0, 10) : null;
      if (!date || date < startDateISO) {
        return;
      }
      if (!sessionsByDate.has(date)) {
        sessionsByDate.set(date, []);
      }
      sessionsByDate.get(date).push(session);
    });
  });

  const days = Array.from(sessionsByDate.keys())
    .sort()
    .map((date) => ({
      date,
      label: formatDayLabel(date),
      sessions: sessionsByDate
        .get(date)
        .sort((a, b) => (a.startTimeLocal || '').localeCompare(b.startTimeLocal || '')),
    }));

  return { startDate: startDateISO, days };
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

