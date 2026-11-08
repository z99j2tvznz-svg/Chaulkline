// Drills (src/v3/drills.js): every level's setup on the table and as cut as it says; a shot scored on where the balls
// really were; the level up on a make, down on a miss.
const test = require('node:test'), assert = require('node:assert');
const DRILL = require('../src/v3/drills.js'), { makeP } = require('../src/core.js');
const P = makeP(7), dia = P.L / 8;
// the phone at the side: diamonds from the left end, from the near rail (y = 0 near)
const view = (x, y) => [x * dia, y * dia];
const shot = (st, o = {}) => ({ before: [{ key: 1, num: 0, x: st.C[0], y: st.C[1] }, { key: 2, num: 3, x: st.O[0] + (o.off || 0), y: st.O[1] }], made: o.made === false ? [] : [{ key: 2, num: 3, pocket: o.pocket != null ? o.pocket : st.pocket }], after: [{ num: 0, x: (o.cueEnd || st.G)[0], y: (o.cueEnd || st.G)[1] }], scratch: !!o.scratch });

test('every level of every drill sets out on the table, as cut as it says', () => {
  for (const d of DRILL.LIST) d.levels.forEach((v, l) => {
    const st = DRILL.setup(d.id, l, P, view), on = p => p && p[0] >= P.R && p[1] >= P.R && p[0] <= P.L - P.R && p[1] <= P.W - P.R; // (the thin cut's ball is meant to sit almost against the rail)
    assert.ok(on(st.O) && on(st.C), d.id + ' ' + l + ' ' + JSON.stringify(st));
    const r = DRILL.score(st, shot(st), P); assert.ok(r.scored && r.made, d.id + ' ' + l);
    if (d.kind === 'cut' || d.kind === 'turn') assert.ok(Math.abs(r.cut - v) <= 1, d.id + ' ' + l + ' cut ' + r.cut);
  });
});

test('a shot scored: in the pocket it was for is made; another pocket, a scratch or no ball in is missed; off its ring it does not count', () => {
  const st = DRILL.setup('cut', 2, P, view);
  assert.strictEqual(DRILL.score(st, shot(st), P).made, true);
  assert.strictEqual(DRILL.score(st, shot(st, { pocket: (st.pocket + 1) % 6 }), P).made, false);
  assert.strictEqual(DRILL.score(st, shot(st, { scratch: true }), P).made, false);
  assert.strictEqual(DRILL.score(st, shot(st, { made: false }), P).made, false);
  assert.strictEqual(DRILL.score(st, shot(st, { off: 12 }), P).scored, false);
  // set out roughly: 3 in off the ring still counts, and the cut is the one really played
  const r = DRILL.score(st, shot(st, { off: 3 }), P); assert.ok(r.scored && r.cut !== 20, JSON.stringify(r));
});

test('the stop shot: in, and the cue ball within two balls of where it hit; the bank: into the far side pocket', () => {
  const st = DRILL.setup('stop', 1, P, view);
  assert.deepStrictEqual([DRILL.score(st, shot(st), P).made, DRILL.score(st, shot(st, { cueEnd: [st.G[0] - 8, st.G[1]] }), P).made], [true, false]);
  const bk = DRILL.setup('bank', 0, P, view); assert.strictEqual(P.pocketNames[bk.pocket], 'top side');
  assert.ok(bk.aimAt[1] < 0, 'aimed at the mirror of the pocket in the near cushion');
});

test('progressive: up a level on a make, down on a miss, within the drill', () => {
  assert.deepStrictEqual([DRILL.next('cut', 0, true), DRILL.next('cut', 0, false), DRILL.next('cut', 5, true), DRILL.next('cut', 3, false)], [1, 0, 5, 2]);
  const s = DRILL.summary([{ id: 'cut', level: 0, made: true }, { id: 'cut', level: 1, made: false }, { id: 'cut', level: 0, made: true }]);
  assert.deepStrictEqual(s.map(x => [x.id, x.tries, x.made, x.best]), [['cut', 3, 2, 0]]);
});

test('no drill is shot from where the phone stands (owner, Nov 3: the phone behind the near rail at the middle)', () => {
  for (const d of DRILL.LIST) d.levels.forEach((v, l) => {
    const st = DRILL.setup(d.id, l, P, view), u = [st.G[0] - st.C[0], st.G[1] - st.C[1]], n = Math.hypot(...u);
    // back along the cue from the cue ball to where it leaves the table: where the player stands
    let p = st.C.slice(); while (p[0] > 0 && p[1] > 0 && p[0] < P.L && p[1] < P.W) p = [p[0] - u[0] / n, p[1] - u[1] / n];
    const fromPhone = Math.hypot(p[0] - P.L / 2, p[1]) / dia;
    assert.ok(fromPhone >= 2, d.id + ' ' + st.word + ': stands ' + fromPhone.toFixed(1) + ' diamonds from the phone at ' + (p[0] / dia).toFixed(1) + ',' + (p[1] / dia).toFixed(1));
  });
});

test('the cut ladder: the cue ball stays put, the object ball comes round toward the end rail as the cut grows; thin cuts: the ball against the end rail', () => {
  const sts = DRILL.byId('cut').levels.map((v, l) => DRILL.setup('cut', l, P, view));
  assert.ok(sts.every(st => st.C[0] === sts[0].C[0] && st.C[1] === sts[0].C[1]));
  for (let i = 1; i < sts.length; i++) assert.ok(sts[i].O[0] > sts[i - 1].O[0], 'closer to the right end rail at each level');
  const th = DRILL.setup('thin', 0, P, view); assert.ok(P.L - th.O[0] < P.R + 0.5, 'against the end rail'); assert.strictEqual(P.pocketNames[th.pocket], 'bottom-right');
});

test('a late call of the object ball counts whatever pocket it guessed (Nov 8 10:48, 6: the 8 called in late, in the wrong pocket)', () => {
  const st = DRILL.setup('cut', 1, P, view), sh = shot(st, { pocket: (st.pocket + 2) % 6 });
  assert.strictEqual(DRILL.score(st, sh, P).made, false);
  sh.made[0].late = true; assert.strictEqual(DRILL.score(st, sh, P).made, true);
});
