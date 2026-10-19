// Search planner v2 (src/search.js). Run: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert');
const ST = require('../src/state.js');
const S = require('../src/search.js');

const small = () => ST.manualState([[0, 44, 30], [1, 49, 40], [9, 30, 10]]);

test('search: the same table gives the same recommendation, and the state is untouched', () => {
  const s = small(), before = JSON.stringify(s);
  const a = S.recommend(s, { budget: 'phone' }), b = S.recommend(s, { budget: 'phone' });
  assert.deepStrictEqual(a.shot, b.shot); assert.strictEqual(a.pick, b.pick); assert.strictEqual(a.sims, b.sims);
  assert.strictEqual(JSON.stringify(s), before);
  assert.strictEqual(a.kind, 'proposal'); assert.strictEqual(a.validated, false);
  assert.ok(a.offense && a.safety, 'offense and safety are reported separately');
});

test('search: seeded stroke errors repeat exactly', () => {
  const shot = { angle: 0.3, speed: 100, a: 0.1, b: -0.2 };
  const x = S.noisy(shot, S.rng(42)), y = S.noisy(shot, S.rng(42)), z = S.noisy(shot, S.rng(43));
  assert.deepStrictEqual(x, y); assert.notDeepStrictEqual(x, z);
});

test('search: refuses to plan around a ball whose number is unsure', () => {
  const s = ST.makeState({ origin: 'camera', balls: [{ id: 0, x: 30, y: 25, conf: 1 }, { id: 1, x: 60, y: 25, conf: 0.4 }, { id: 9, x: 80, y: 40, conf: 1 }] });
  assert.match(S.recommend(s).error, /not every ball is confirmed/);
});

test('search: a 71 degree cut from 89 inches is reported as low-percentage and a safety is recommended', () => {
  const s = ST.manualState([[0, 90, 10], [1, 2.5, 30], [9, 60, 45]]), r = S.recommend(s, { budget: 'phone' });
  assert.strictEqual(r.pick, 'safety');
  assert.ok(r.offense.make < S.RULE.offenseMinMake);
  assert.ok(r.safety.pLegal >= S.RULE.safetyMinLegal);
});

test('search: the phone budget does less work than the server budget', () => {
  const s = small(), p = S.recommend(s, { budget: 'phone' }), v = S.recommend(s, { budget: 'server' });
  assert.ok(p.sims < v.sims, `${p.sims} < ${v.sims}`);
});
