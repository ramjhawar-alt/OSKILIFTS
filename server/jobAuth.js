const crypto = require('crypto');

const MIN_SECRET_LENGTH = 24;

/**
 * Constant-time check of the shared secret the scheduler sends. A missing or
 * short secret on the server means the job endpoints are disabled, never open.
 */
function verifyJobSecret(provided, expected) {
  if (typeof expected !== 'string' || expected.length < MIN_SECRET_LENGTH) return false;
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

module.exports = { verifyJobSecret, MIN_SECRET_LENGTH };
