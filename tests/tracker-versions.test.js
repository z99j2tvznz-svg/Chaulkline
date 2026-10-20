// Tracker versions: v0.4 (the frozen baseline) is exactly the defaults; v0.5 is v0.4 plus relink and contact.
// The real-footage check needs the project data folder (CHALKLINE_DATA) and is skipped without it.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path');
const { makeTracker, TRACK_VERSIONS } = require('../tools/tracker.js');

const DATA = process.env.CHALKLINE_DATA || '/mnt/project-files/chalkline-data';
const DETS = path.join(DATA, 'evidence', 'rec-20261018-2310', 'detections'), HAVE = fs.existsSync(DETS);
const run = (d, opts) => { const tr = makeTracker(d.table, opts); for (const fr of d.frames) tr.step(fr); return JSON.stringify(tr.finish()); };

test('tracker versions: v0.5 is v0.4 plus relink and contact; unknown versions are refused', () => {
  assert.deepStrictEqual(TRACK_VERSIONS['v0.4'], {});
  assert.deepStrictEqual(TRACK_VERSIONS['v0.5'], { relink: true, contact: true });
  assert.deepStrictEqual(TRACK_VERSIONS['v0.6'], { relink: true, contact: true, absence: true });
  assert.throws(() => makeTracker([78, 39], { version: 'v9' }), /unknown tracker version/);
});

test('tracker versions on real clips: v0.4 is byte-identical to the defaults, v0.5 to relink + contact', { skip: !HAVE }, () => {
  for (const f of fs.readdirSync(DETS).slice(0, 6)) {
    const d = JSON.parse(fs.readFileSync(path.join(DETS, f)));
    assert.strictEqual(run(d, { version: 'v0.4' }), run(d, {}), f);
    assert.strictEqual(run(d, { version: 'v0.5' }), run(d, { relink: true, contact: true }), f);
    assert.strictEqual(run(d, { version: 'v0.6' }), run(d, { version: 'v0.5' }), f); // absence is not a tracker option
  }
});
