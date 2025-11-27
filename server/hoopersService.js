// In-memory storage for active basketball check-ins
// Format: Map<userId, { checkedInAt: timestamp, expiresAt: timestamp }>
const activeCheckIns = new Map();

const CHECK_IN_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Check in a user for basketball
 * @param {string} userId - Unique user identifier
 * @returns {Object} Check-in result
 */
function checkIn(userId) {
  const now = Date.now();
  const expiresAt = now + CHECK_IN_TIMEOUT_MS;
  
  activeCheckIns.set(userId, {
    checkedInAt: now,
    expiresAt: expiresAt,
  });
  
  return {
    userId,
    checkedInAt: now,
    expiresAt: expiresAt,
  };
}

/**
 * Check out a user from basketball
 * @param {string} userId - Unique user identifier
 * @returns {boolean} True if user was checked in, false otherwise
 */
function checkOut(userId) {
  return activeCheckIns.delete(userId);
}

/**
 * Get the current count of active players (excluding expired)
 * @returns {number} Count of active players
 */
function getActiveCount() {
  const now = Date.now();
  cleanupExpired();
  
  return activeCheckIns.size;
}

/**
 * Get crowdedness status based on player count
 * @param {number} count - Number of active players
 * @returns {string} Status: 'Not Crowded', 'Moderate', or 'Very Crowded'
 */
function getCrowdednessStatus(count) {
  if (count <= 12) {
    return 'Not Crowded';
  } else if (count <= 20) {
    return 'Moderate';
  } else {
    return 'Very Crowded';
  }
}

/**
 * Remove expired check-ins
 */
function cleanupExpired() {
  const now = Date.now();
  for (const [userId, data] of activeCheckIns.entries()) {
    if (data.expiresAt < now) {
      activeCheckIns.delete(userId);
    }
  }
}

/**
 * Check if a user is currently checked in
 * @param {string} userId - Unique user identifier
 * @returns {boolean} True if user is checked in and not expired
 */
function isCheckedIn(userId) {
  const checkIn = activeCheckIns.get(userId);
  if (!checkIn) {
    return false;
  }
  
  if (checkIn.expiresAt < Date.now()) {
    activeCheckIns.delete(userId);
    return false;
  }
  
  return true;
}

module.exports = {
  checkIn,
  checkOut,
  getActiveCount,
  getCrowdednessStatus,
  cleanupExpired,
  isCheckedIn,
};

