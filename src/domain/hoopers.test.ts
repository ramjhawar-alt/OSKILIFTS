import assert from 'node:assert/strict';
import test from 'node:test';

import { checkedInLabel, crowdednessStatus, friendlyHoopersError, playersLabel } from './hoopers';

test('crowd level thresholds match the old server', () => {
  assert.equal(crowdednessStatus(0), 'Not Crowded');
  assert.equal(crowdednessStatus(12), 'Not Crowded');
  assert.equal(crowdednessStatus(13), 'Moderate');
  assert.equal(crowdednessStatus(20), 'Moderate');
  assert.equal(crowdednessStatus(21), 'Very Crowded');
  assert.equal(crowdednessStatus(NaN), 'Not Crowded');
});

test('check-in age wording', () => {
  const now = new Date('2026-10-06T20:00:00Z');
  assert.equal(checkedInLabel('2026-10-06T19:59:50Z', now), 'checked in just now');
  assert.equal(checkedInLabel('2026-10-06T19:48:00Z', now), 'checked in 12m ago');
  assert.equal(checkedInLabel('2026-10-06T18:30:00Z', now), 'checked in 1h ago');
  assert.equal(checkedInLabel('nonsense', now), '');
});

test('labels and errors', () => {
  assert.equal(playersLabel(3), '3 playing');
  assert.equal(playersLabel(-2), '0 playing');
  assert.match(friendlyHoopersError('username_required'), /username/);
  assert.equal(friendlyHoopersError('x'), 'x');
});
