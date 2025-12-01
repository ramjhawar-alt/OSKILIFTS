const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CAPACITY_DATA_FILE = path.join(DATA_DIR, 'capacity_history.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Load existing capacity data from file
 * @returns {Array} Array of capacity snapshots
 */
function loadCapacityData() {
  try {
    if (fs.existsSync(CAPACITY_DATA_FILE)) {
      const data = fs.readFileSync(CAPACITY_DATA_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('[DataCollection] Error loading capacity data:', error);
  }
  return [];
}

/**
 * Save capacity data to file
 * @param {Array} data - Array of capacity snapshots
 */
function saveCapacityData(data) {
  try {
    fs.writeFileSync(CAPACITY_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('[DataCollection] Error saving capacity data:', error);
  }
}

/**
 * Store a capacity snapshot
 * @param {Object} status - Weight room status object with capacity info
 */
function storeCapacitySnapshot(status) {
  if (!status || typeof status.currentCount !== 'number') {
    return; // Skip invalid data
  }

  const snapshot = {
    timestamp: new Date().toISOString(),
    dayOfWeek: new Date().getDay(), // 0 = Sunday, 1 = Monday, etc.
    hour: new Date().getHours(),
    minute: new Date().getMinutes(),
    currentCount: status.currentCount,
    maxCapacity: status.maxCapacity || 100, // Default if not provided
    percentage: status.currentCount / (status.maxCapacity || 100),
    isOpen: status.isOpen !== false, // Default to true if not specified
  };

  const data = loadCapacityData();
  data.push(snapshot);

  // Keep only last 90 days of data to prevent file from growing too large
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const filteredData = data.filter(
    (entry) => new Date(entry.timestamp).getTime() > ninetyDaysAgo,
  );

  saveCapacityData(filteredData);
  console.log(`[DataCollection] Stored capacity snapshot: ${snapshot.currentCount}/${snapshot.maxCapacity} at ${snapshot.hour}:${snapshot.minute.toString().padStart(2, '0')}`);
}

/**
 * Get all capacity data
 * @returns {Array} Array of capacity snapshots
 */
function getCapacityData() {
  return loadCapacityData();
}

/**
 * Get capacity data for a specific time range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Array} Filtered capacity snapshots
 */
function getCapacityDataRange(startDate, endDate) {
  const data = loadCapacityData();
  const startTime = startDate.getTime();
  const endTime = endDate.getTime();

  return data.filter((entry) => {
    const entryTime = new Date(entry.timestamp).getTime();
    return entryTime >= startTime && entryTime <= endTime;
  });
}

module.exports = {
  storeCapacitySnapshot,
  getCapacityData,
  getCapacityDataRange,
};

