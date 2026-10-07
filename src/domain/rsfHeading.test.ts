import assert from 'node:assert/strict';
import test from 'node:test';

import { crowdLine, friendlyHeadingError, friendsHeadingLine, minutesLeft, timeLeftLabel } from './rsfHeading';

const now = new Date('2026-10-06T20:00:00Z');
const at = (minutes: number) => new Date(now.getTime() + minutes * 60000).toISOString();

test('minutes left rounds up and never goes negative', () => {
  assert.equal(minutesLeft(at(45), now), 45);
  assert.equal(minutesLeft(new Date(now.getTime() + 30500).toISOString(), now), 1);
  assert.equal(minutesLeft(at(-5), now), 0);
  assert.equal(minutesLeft('garbage', now), 0);
});

test('time left reads naturally', () => {
  assert.equal(timeLeftLabel(at(-1), now), 'ending now');
  assert.equal(timeLeftLabel(at(1), now), '1 min left');
  assert.equal(timeLeftLabel(at(59), now), '59 min left');
  assert.equal(timeLeftLabel(at(60), now), '1 hr left');
  assert.equal(timeLeftLabel(at(80), now), '1 hr 20 min left');
  assert.equal(timeLeftLabel(at(180), now), '3 hr left');
});

test('crowd line follows the meter', () => {
  assert.equal(crowdLine(null), null);
  assert.equal(crowdLine({ status: 'Go', isOpen: true, percent: 42.4 }), 'Good time to go (42% full).');
  assert.equal(crowdLine({ status: 'Wait', isOpen: true, percent: 91 }), 'It’s busy right now (91% full).');
  assert.equal(crowdLine({ status: 'Go', isOpen: true, percent: null }), 'Good time to go.');
  assert.equal(crowdLine({ status: 'Go', isOpen: false, percent: 10 }), 'The weight room is closed right now.');
  assert.equal(crowdLine({ status: 'Capacity unavailable', isOpen: true, percent: null }), null);
});

test('friends line handles one, two and many', () => {
  assert.equal(friendsHeadingLine([]), null);
  assert.equal(friendsHeadingLine(['  ']), null);
  assert.equal(friendsHeadingLine(['Maya']), 'Maya is heading to the RSF');
  assert.equal(friendsHeadingLine(['Maya', 'Sam']), 'Maya and Sam are heading to the RSF');
  assert.equal(friendsHeadingLine(['Maya', 'Sam', 'Lee']), 'Maya, Sam and 1 other are heading to the RSF');
  assert.equal(friendsHeadingLine(['Maya', 'Sam', 'Lee', 'Jo', 'Al']), 'Maya, Sam and 3 others are heading to the RSF');
});

test('error messages', () => {
  assert.match(friendlyHeadingError('username_required'), /username/);
  assert.equal(friendlyHeadingError('boom'), 'boom');
});
