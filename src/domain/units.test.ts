import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDistance,
  formatDuration,
  formatWeight,
  formatWeightValue,
  kgToLb,
  lbToKg,
  parseDistanceInput,
  parseDurationInput,
  parseWeightInput,
  roundKg,
  weightInputText,
} from './units';

test('135 lb round-trips exactly through kg storage', () => {
  assert.equal(formatWeightValue(lbToKg(135), 'lb'), '135');
  assert.equal(formatWeight(lbToKg(135), 'lb'), '135 lb');
});

test('every 0.25 lb and 0.25 kg step up to 1500 survives store -> display -> parse', () => {
  for (let i = 1; i <= 1500 * 4; i += 1) {
    const value = i / 4;
    for (const unit of ['lb', 'kg'] as const) {
      const kg = unit === 'lb' ? lbToKg(value) : roundKg(value);
      const shown = formatWeightValue(kg, unit);
      assert.equal(Number(shown), value, `${value} ${unit} displayed as ${shown}`);
      const parsed = parseWeightInput(shown, unit);
      if (kg <= 1500) assert.equal(parsed, kg, `${value} ${unit} re-parsed`);
    }
  }
});

test('display rules', () => {
  assert.equal(formatWeightValue(roundKg(45.3592), 'kg'), '45.36');
  assert.equal(formatWeightValue(60, 'lb'), '132.3');
  assert.equal(formatWeightValue(lbToKg(2.5), 'lb'), '2.5');
  assert.equal(formatWeightValue(1.25, 'kg'), '1.25');
  assert.equal(formatWeightValue(lbToKg(100), 'kg'), '45.36');
});

test('parseWeightInput accepts comma decimals and rejects junk', () => {
  assert.equal(parseWeightInput('135', 'lb'), lbToKg(135));
  assert.equal(parseWeightInput('62,5', 'kg'), 62.5);
  assert.equal(parseWeightInput(' 62.5 ', 'kg'), 62.5);
  assert.equal(parseWeightInput('.5', 'kg'), 0.5);
  for (const bad of ['', '  ', '0', '-5', 'abc', '1e3', '12.345', '1,000', '1500.01', '99999']) {
    assert.equal(parseWeightInput(bad, 'kg'), null, `"${bad}" should be rejected`);
  }
  assert.equal(parseWeightInput('1500', 'kg'), 1500);
  assert.equal(parseWeightInput('3307', 'lb'), null); // > 1500 kg
});

test('weightInputText prefills in the viewer unit and handles null', () => {
  assert.equal(weightInputText(null, 'lb'), '');
  assert.equal(weightInputText(lbToKg(225), 'lb'), '225');
});

test('kg <-> lb conversion constants', () => {
  assert.ok(Math.abs(kgToLb(0.45359237) - 1) < 1e-12);
  assert.equal(lbToKg(1), 0.4536);
});

test('distance follows the unit', () => {
  assert.equal(formatDistance(1609.344, 'lb'), '1 mi');
  assert.equal(formatDistance(5000, 'kg'), '5 km');
  assert.equal(parseDistanceInput('1', 'lb'), 1609.34);
  assert.equal(parseDistanceInput('5', 'kg'), 5000);
  assert.equal(parseDistanceInput('0', 'kg'), null);
});

test('durations', () => {
  assert.equal(formatDuration(90), '1:30');
  assert.equal(formatDuration(3723), '1:02:03');
  assert.equal(formatDuration(5), '0:05');
  assert.equal(parseDurationInput('90'), 90);
  assert.equal(parseDurationInput('1:30'), 90);
  assert.equal(parseDurationInput('1:02:03'), 3723);
  assert.equal(parseDurationInput('1:75'), null);
  assert.equal(parseDurationInput('abc'), null);
  assert.equal(parseDurationInput('0'), null);
  assert.equal(parseDurationInput(''), null);
});
