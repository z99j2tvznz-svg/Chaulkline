// Hand-written cases for the settled-table check (tools/reconcile.js), each with its expected answer.
// Rules: docs/baseline-rules.md.
const test = require('node:test');
const assert = require('node:assert');
const { observe, reconcile, newMemory } = require('../tools/reconcile.js');

// a settled look where the given balls are seen and named
const look = (nums, extra = {}) => ({ balls: nums.map(n => ({ x: n * 6 + 5, y: 10, num: n, score: 9 })), named: Object.fromEntries(nums.map(n => [n, { x: n * 6 + 5, y: 10 }])), unnamed: 0, ...extra });
const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
function racked() { return reconcile(newMemory(), look(ALL)).memory; }

test('rack start: seen balls present, unseen rack balls unconfirmed', () => {
  const { memory, trace } = reconcile(newMemory(), look([0, 1, 2, 3, 4, 5, 6, 7, 8]));
  assert.equal(memory.balls[9].status, 'unconfirmed');
  assert.equal(memory.balls[4].status, 'present');
  assert.deepEqual(trace.unresolved.map(u => u.ball), [9]);
});

test('a ball not seen, with nothing to explain it, stays on the table as unresolved', () => {
  const { memory, trace } = reconcile(racked(), look([0, 1, 2, 3, 4, 6, 7, 8, 9]));
  assert.equal(memory.balls[5].status, 'unconfirmed');
  assert.ok(trace.game.onTable.includes(5));
  assert.equal(trace.confirmed.length, 0);
  assert.equal(trace.unresolved[0].ball, 5);
});

test('pocket event inside the mouth, gone from the still table: confirmed pocketed', () => {
  const { memory, trace } = reconcile(racked(), look([0, 1, 2, 3, 4, 6, 7, 8, 9]), { pockets: [{ ball: 5, x: 77, y: 1, inMouth: true }] });
  assert.equal(memory.balls[5].status, 'pocketed');
  assert.deepEqual(trace.confirmed.map(c => [c.ball, c.change]), [[5, 'pocketed']]);
  assert.ok(!trace.game.onTable.includes(5));
});

test('heading toward a pocket but lost outside the mouth is not enough', () => {
  const { memory, trace } = reconcile(racked(), look([0, 1, 2, 3, 4, 6, 7, 8, 9]), { pockets: [{ ball: 5, x: 68, y: 6, inMouth: false }] });
  assert.equal(memory.balls[5].status, 'unconfirmed');
  assert.equal(trace.unresolved[0].possiblyPocketed, true);
});

test('a pocket event for a ball that is still seen changes nothing', () => {
  const { memory, trace } = reconcile(racked(), look(ALL), { pockets: [{ ball: 5, x: 77, y: 1, inMouth: true }] });
  assert.equal(memory.balls[5].status, 'present');
  assert.equal(trace.confirmed.length, 0);
  assert.equal(trace.unresolved.length, 1);
});

test('an unnumbered pocket event matches the only missing ball', () => {
  const { memory } = reconcile(racked(), look([0, 1, 2, 3, 4, 6, 7, 8, 9]), { pockets: [{ ball: null, x: 77, y: 1, inMouth: true }] });
  assert.equal(memory.balls[5].status, 'pocketed');
});

test('an unnumbered pocket event with two balls missing confirms neither', () => {
  const { memory } = reconcile(racked(), look([0, 1, 2, 3, 4, 7, 8, 9]), { pockets: [{ ball: null, x: 77, y: 1, inMouth: true }] });
  assert.equal(memory.balls[5].status, 'unconfirmed');
  assert.equal(memory.balls[6].status, 'unconfirmed');
});

test('table still moving: nothing is confirmed', () => {
  const { memory, trace } = reconcile(racked(), look([0, 1, 2, 3, 4, 6, 7, 8, 9], { settled: false }), { pockets: [{ ball: 5, x: 77, y: 1, inMouth: true }] });
  assert.equal(memory.balls[5].status, 'unconfirmed');
  assert.equal(trace.confirmed.length, 0);
});

test('a pocketed ball seen again is restored and the reversal is recorded', () => {
  let m = reconcile(racked(), look([0, 1, 2, 3, 4, 6, 7, 8, 9]), { pockets: [{ ball: 5, x: 77, y: 1, inMouth: true }] }).memory;
  const { memory, trace } = reconcile(m, look(ALL));
  assert.equal(memory.balls[5].status, 'present');
  assert.deepEqual(trace.reversed, [5]);
});

test('the cue ball back on the table after a scratch is ball in hand, not a reversal', () => {
  let m = reconcile(racked(), look([1, 2, 3, 4, 5, 6, 7, 8, 9]), { pockets: [{ ball: 0, x: 77, y: 1, inMouth: true }] }).memory;
  assert.equal(m.balls[0].status, 'pocketed');
  const { memory, trace } = reconcile(m, look(ALL));
  assert.equal(memory.balls[0].status, 'present');
  assert.equal(trace.reversed, undefined);
});

test('unnamed balls on the table: a missing number is never removed', () => {
  const { memory, trace } = reconcile(racked(), look([0, 1, 2, 3, 4, 6, 7, 8, 9], { unnamed: 1 }));
  assert.equal(memory.balls[5].status, 'unconfirmed');
  assert.match(trace.unresolved[0].why, /unnamed/);
});

test('the game moves on only from confirmed changes', () => {
  // the 1 is missing with no explanation: still the lowest ball, flagged unsure
  let r = reconcile(racked(), look([0, 2, 3, 4, 5, 6, 7, 8, 9]));
  assert.equal(r.trace.game.lowest, 1);
  assert.equal(r.trace.game.lowestSure, false);
  // the 9 possibly pocketed: rack not over
  r = reconcile(racked(), look([0, 1, 2, 3, 4, 5, 6, 7, 8]), { pockets: [{ ball: 9, x: 70, y: 5, inMouth: false }] });
  assert.equal(r.trace.game.rackOver, false);
  r = reconcile(racked(), look([0, 1, 2, 3, 4, 5, 6, 7, 8]), { pockets: [{ ball: 9, x: 77, y: 1, inMouth: true }] });
  assert.equal(r.trace.game.rackOver, true);
});

test('observe: a ball needs half the frames, "not a ball" spots are dropped, each number once', () => {
  const fr = t => ({ t, balls: [
    { x: 10, y: 10, rec: 3, p: 0.9, nb: 0 },             // the 3, every frame
    { x: 30, y: 10, rec: 3, p: 0.7, nb: 0 },             // a second "3", weaker: becomes unnamed
    { x: 50, y: 20, rec: 4, p: 0.9, nb: 0.8 },           // a hand: not a ball
  ].concat(t < 2 ? [{ x: 60, y: 30, rec: 6, p: 0.9, nb: 0 }] : [])  // seen in 2 of 10 frames: not counted
  });
  const o = observe(Array.from({ length: 10 }, (_, i) => fr(i)));
  assert.equal(o.balls.length, 2);
  assert.equal(o.named[3].x, 10);
  assert.equal(o.unnamed, 1);
});

// absence experiment (off unless ev.absence is given)
const ABS = (before, moved = true) => ({ pockets: [], absence: { before, movedFrom: () => moved } });
const NO5 = [0, 1, 2, 3, 4, 6, 7, 8, 9];
test('absence: off by default, a gone ball with no pocket event stays unresolved', () => {
  assert.equal(reconcile(racked(), look(NO5)).memory.balls[5].status, 'unconfirmed');
});
test('absence: named before, clear still after look, count fell by one, rolled away: confirmed pocketed', () => {
  const { memory, trace } = reconcile(racked(), look(NO5), ABS(look(ALL)));
  assert.equal(memory.balls[5].status, 'pocketed');
  assert.ok(trace.confirmed[0].absence);
});
test('absence: stays unresolved when any gate fails', () => {
  const st = (after, ev) => reconcile(racked(), after, ev).memory.balls[5].status;
  assert.equal(st(look(NO5), ABS(look(ALL), false)), 'unconfirmed');                           // never seen rolling away
  assert.equal(st(look(NO5, { unnamed: 1 }), ABS(look(ALL))), 'unconfirmed');                  // an unnamed spot could be it
  assert.equal(st(look(NO5, { settled: false }), ABS(look(ALL))), 'unconfirmed');              // still moving
  assert.equal(st(look(NO5), ABS(look([0, 1, 2, 3, 4, 6, 7, 8, 9]))), 'unconfirmed');          // not named before
  const extra = look(NO5); extra.balls.push({ x: 70, y: 30, num: null, score: 0 });
  assert.equal(st(extra, ABS(look(ALL))), 'unconfirmed');                                        // count did not fall
  assert.equal(reconcile(racked(), look([0, 1, 2, 3, 4, 8, 9]), ABS(look(ALL))).memory.balls[5].status, 'unconfirmed'); // 3 at once
});
