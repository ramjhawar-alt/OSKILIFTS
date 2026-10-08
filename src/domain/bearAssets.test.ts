import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = join(__dirname, '..', '..');

test('every bear stage has a picture, all 4:3 and light enough to ship', () => {
  const config = readFileSync(join(ROOT, 'src', 'config', 'bearImages.ts'), 'utf8');
  for (let stage = 1; stage <= 10; stage++) {
    const file = `stage-${String(stage).padStart(2, '0')}.jpg`;
    const path = join(ROOT, 'assets', 'bears', file);
    const size = statSync(path).size;
    assert.ok(size > 20_000 && size < 300_000, `${file} is ${size} bytes`);
    assert.ok(config.includes(`assets/bears/${file}`), `${file} is wired into bearImages.ts`);
    const jpg = readFileSync(path);
    assert.equal(jpg[0], 0xff, `${file} is a JPEG`);
    // read the frame size from the SOF marker
    let i = 2;
    let dims: [number, number] | null = null;
    while (i < jpg.length) {
      const marker = jpg[i + 1];
      const len = jpg.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xc2) {
        dims = [jpg.readUInt16BE(i + 7), jpg.readUInt16BE(i + 5)];
        break;
      }
      i += 2 + len;
    }
    assert.ok(dims, `${file} has a frame header`);
    assert.equal(dims[0] / dims[1], 4 / 3, `${file} is 4:3`);
  }
});

test('there is a picture for exactly the stages the app has', () => {
  const config = readFileSync(join(ROOT, 'src', 'config', 'bearImages.ts'), 'utf8');
  assert.equal((config.match(/source: require/g) || []).length, 10);
});
