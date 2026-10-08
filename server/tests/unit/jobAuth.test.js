const assert = require('node:assert/strict');
const test = require('node:test');
const { verifyJobSecret } = require('../../jobAuth');

const SECRET = 'a'.repeat(40);

test('accepts exactly the right secret', () => {
  assert.equal(verifyJobSecret(SECRET, SECRET), true);
});

test('rejects wrong, empty and non-string values', () => {
  assert.equal(verifyJobSecret('b'.repeat(40), SECRET), false);
  assert.equal(verifyJobSecret(SECRET + 'x', SECRET), false);
  assert.equal(verifyJobSecret('', SECRET), false);
  assert.equal(verifyJobSecret(undefined, SECRET), false);
  assert.equal(verifyJobSecret(null, SECRET), false);
  assert.equal(verifyJobSecret(['a'], SECRET), false);
});

test('a missing or short server secret disables the endpoints instead of opening them', () => {
  assert.equal(verifyJobSecret('', ''), false);
  assert.equal(verifyJobSecret('x', undefined), false);
  assert.equal(verifyJobSecret('short', 'short'), false);
  assert.equal(verifyJobSecret('a'.repeat(23), 'a'.repeat(23)), false);
  assert.equal(verifyJobSecret('a'.repeat(24), 'a'.repeat(24)), true);
});
