// Table state and the experimental runout planner (src/state.js, src/runout.js). Run: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert');
const ST = require('../src/state.js');
const RO = require('../src/runout.js');

test('state: rejects impossible layouts', () => {
  assert.throws(() => ST.manualState([[0, 20, 20], [1, 21, 20]]), /overlap/);
  assert.throws(() => ST.manualState([[0, 20, 20], [0, 40, 20]]), /twice/);
  assert.throws(() => ST.manualState([[0, 0.5, 20]]), /off the playing surface/);
  assert.throws(() => ST.makeState({ balls: [{ id: 1, x: 30, y: 20, source: 'predicted' }] }), /authoritative/);
});

test('state: a prediction never changes the state it came from', () => {
  const s = ST.manualState([[0, 30, 25], [1, 60, 25]]), before = JSON.stringify(s);
  const pred = ST.predict(s, { angle: 0, speed: 60, a: 0, b: 0 });
  assert.strictEqual(JSON.stringify(s), before);
  assert.ok(Object.isFrozen(s) && Object.isFrozen(s.balls[0]));
  assert.throws(() => { 'use strict'; s.balls[0].x = 1; });
  assert.strictEqual(pred.kind, 'prediction'); assert.strictEqual(pred.validated, false);
  const h = ST.hypothetical(s, pred);
  assert.ok(ST.isAuthoritative(s)); assert.ok(!ST.isAuthoritative(h));
  assert.ok(h.balls.every(b => b.source === 'predicted'));
  assert.throws(() => ST.hypothetical(s, s), /not a prediction/);
});

test('state: balls whose identity is unsure are listed, and the runout planner will not guess', () => {
  const s = ST.makeState({ origin: 'camera', balls: [{ id: 0, x: 30, y: 25, conf: 1 }, { id: 1, x: 60, y: 25, conf: 0.5 }, { id: 9, x: 80, y: 40, conf: 0.99 }] });
  const lay = ST.plannerLayout(s);
  assert.deepStrictEqual(lay.doubtful, [1]); assert.strictEqual(lay.ok, false);
  assert.match(RO.backwardPlan(s).error, /not every ball is confirmed/);
});

test('backward plan: every chosen pocket has a clear lane, and the same layout gives the same plan', () => {
  const s = ST.manualState([[0, 25, 20], [1, 40, 30], [2, 70, 12], [9, 75, 32]]);
  const a = RO.backwardPlan(s), b = RO.backwardPlan(s), P = a.P;
  assert.deepStrictEqual(a.plan.map(q => q.id), [1, 2, 9]);
  assert.deepStrictEqual(a.plan.map(q => q.pocket), b.plan.map(q => q.pocket));
  a.plan.forEach((q, k) => {
    const tb = s.balls.find(x => x.id === q.id), rest = s.balls.filter(x => x.id >= q.id);
    assert.ok(RO.pocketOptions(tb, rest, P).some(o => o.pi === q.pocket), 'ball ' + q.id + ' pocket is reachable');
  });
});

test('runout: a simple 1-and-9 layout runs out in physics, the same way twice, and keeps the confirmed state untouched', () => {
  const s = ST.manualState([[0, 30, 25], [1, 55, 20], [9, 80, 30]]), before = JSON.stringify(s);
  const r1 = RO.runout(s), r2 = RO.runout(s);
  assert.strictEqual(r1.stop, 'rack done');
  assert.deepStrictEqual(r1.steps.map(x => [x.proposal.target, x.proposal.pocket]), r2.steps.map(x => [x.proposal.target, x.proposal.pocket]));
  assert.strictEqual(JSON.stringify(s), before);
  assert.ok(r1.steps.every(x => x.proposal.kind === 'proposal' && x.proposal.validated === false));
  assert.ok(r1.steps.slice(1).every(x => x.state.hypothetical));
});

test('runout: a hooked ball stops the plan with "a safety is needed" instead of inventing a shot', () => {
  // the 1 is frozen in the bottom-left corner area behind a wall of balls, cue ball on the far side
  const s = ST.manualState([[0, 90, 40], [1, 6, 6], [2, 10.5, 2], [3, 10.5, 6.5], [4, 10.5, 11], [5, 6, 11], [9, 50, 25]]);
  const r = RO.runout(s);
  assert.match(r.stop, /safety is needed/);
});
