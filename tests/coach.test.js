// The coaching test's runout planner (src/v3/coach.js, V3.10): three balls ahead on a real layout (Nov 2, 20:54, rack 2:
// the 1, then the 2, then the 3), a ball not named still in the way, short runouts, and the planner in the page's worker.
const test = require('node:test'), assert = require('node:assert'), path = require('path');
const { makeP } = require('../src/core.js'), COACH = require('../src/v3/coach.js'), P = makeP(7);
const NOV2 = [{ n: 1, x: 55.9, y: 31.6 }, { n: 7, x: 61.3, y: 25.5 }, { n: 2, x: 41.6, y: 9.1 }, { n: 6, x: 38.6, y: 12.3 }, { n: 5, x: 27.0, y: 10.3 }, { n: 9, x: 7.9, y: 6.5 }, { n: 8, x: 67.3, y: 12.5 }, { n: 4, x: 19.1, y: 19.6 }, { n: 3, x: 71.5, y: 11.2 }, { n: 0, x: 43.0, y: 28.9 }];
const count = (r, v) => r.cells.filter(c => c === v).length;
test('three balls ahead on Nov 2 rack 2: the 1 top-right, the 2 bottom side, the 3 bottom-right; the 6 in the way, a wrong side', () => {
  const r = COACH.plan(NOV2, P);
  assert.strictEqual(r.A.pocket, 5); assert.ok([0, 1, 2].includes(r.B.pocket), 'the 2 in a bottom pocket: ' + r.B.pocket); assert.strictEqual(r.C.pocket, 2);
  // (V3.20: the 2 down the rail into the far corner is allowed: a big pocket at that angle, Dr. Dave BD Dec 2004)
  assert.ok(count(r, 1) + count(r, 5) + count(r, 2) > 20 && count(r, 4) > 50, '60%+ and grey: ' + [count(r, 1) + count(r, 5) + count(r, 2), count(r, 4)]);
  // V3.11: a real stroke from the simulation: the 1 goes in, the cue ball stays up, stops in the zone; a band for the pocket's width
  const st = r.path.stroke; assert.ok(st && st.power >= 1 && st.power <= 10 && Math.abs(st.tip) <= 0.5, JSON.stringify(st));
  assert.ok(r.path.shot === 'pot' && r.path.make > 0.5 && r.path.pts.length > 5 && r.path.fan, 'a pot with its percentages and a band: ' + JSON.stringify({ make: r.path.make, next: r.path.next }));
  assert.ok(COACH.gradeAt(r, r.spot[0], r.spot[1]) && COACH.gradeAt(r, r.spot[0], r.spot[1]) !== 'blocked', 'the spot in the zone');
  // behind the 6 for the side pocket (the plan may take the 2 in the corner instead, see above)
  if (r.B.pocket === 1) assert.strictEqual(COACH.gradeAt(r, 30, 20), 'blocked');
  console.log('plan ms', r.ms);
});
test('a ball not named for sure is still in the way; a short runout; the 9 alone', () => {
  const r0 = COACH.plan([{ n: 0, x: 20, y: 20 }, { n: 3, x: 40, y: 20 }, { n: 9, x: 60, y: 30 }], P), r1 = COACH.plan([{ n: 0, x: 20, y: 20 }, { n: 3, x: 40, y: 20 }, { n: 9, x: 60, y: 30 }, { n: 107, x: 30, y: 20 }], P);
  // an unnamed ball between the cue ball and the 3: not in the order, but in the way (no direct stroke on the 3)
  assert.deepStrictEqual(r1.order, [3, 9]); assert.ok(r0.path && r0.path.stroke, 'a stroke when clear'); assert.ok(!(r1.path && r1.path.shot === 'pot'), 'no straight pot through the unnamed ball (a kick or a safety instead): ' + (r1.path && r1.path.shot));
  assert.ok(r0.A.pocket != null && r0.B.pocket != null && r0.C === null);
  const r2 = COACH.plan([{ n: 0, x: 20, y: 20 }, { n: 9, x: 70, y: 34 }], P); assert.strictEqual(r2.B, null); assert.strictEqual(r2.A.pocket, 5);
  assert.ok(r2.path && r2.path.stroke, 'the last ball: still a line and a stroke');
  assert.strictEqual(COACH.plan([{ n: 0, x: 20, y: 20 }], P), null);
});
test('ball in hand after a scratch; a ball just behind the cue ball (Nov 8 19:32 shot 22)', () => {
  const h = COACH.plan([{ n: 3, x: 73.2, y: 11.4 }, { n: 4, x: 19, y: 19.7 }, { n: 6, x: 38.5, y: 12.4 }, { n: 9, x: 7.9, y: 6.6 }], P, { inHand: true });
  assert.ok(h.inHand && h.spot && h.A.pocket != null && h.path.make > 0.5, 'where to put the cue ball, with its percentages'); assert.ok(['green', 'lightgreen', 'yellow'].includes(COACH.gradeAt(h, h.spot[0], h.spot[1])));
  const j = COACH.plan([{ n: 4, x: 67.5, y: 21.5 }, { n: 7, x: 53.2, y: 0.7 }, { n: 0, x: 56.9, y: 4.6 }, { n: 9, x: 19.4, y: 12 }], P);
  assert.ok(j.jacked && j.path.stroke.tip >= -0.2 && j.path.stroke.power <= 6, 'cue raised: no real draw, no hard hit: ' + JSON.stringify(j.path.stroke));
});
test('the power test: a lone cue ball\'s speed from how far it went', () => {
  const sim = require('../src/core.js').simulate;
  for (const v of [40, 90, 180]) {
    const r = sim([{ id: 0, x: 10, y: 19.5 }], { angle: 0.1, speed: v, a: 0, b: 0 }, Object.assign({}, P, { pockets: [], cushionRoll: 0.6 }), { record: true, maxT: 40 }), q = r.paths[0]; let len = 0; for (let i = 1; i < q.length; i++) len += Math.hypot(q[i][1] - q[i - 1][1], q[i][2] - q[i - 1][2]);
    const got = COACH.speedFor([10, 19.5], [Math.cos(0.1), Math.sin(0.1)], len, P); assert.ok(Math.abs(got - v) / v < 0.05, v + ' -> ' + got);
  }
  assert.ok(Math.abs(COACH.powerOf(3.5) - 5) < 1e-9 && Math.abs(COACH.powerOf(0.9) - 1) < 1e-9); // Dr. Dave's speeds: medium 2-4 mph
});
test('the planner in the page, in a background worker from its own source, as the app runs it', { timeout: 120000 }, async () => {
  const { chromium } = require('playwright'), { serve } = require('./lib/serve.js');
  const srv = await serve(path.join(__dirname, '..')), browser = await chromium.launch();
  try {
    const page = await browser.newPage(), errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(srv.url + '/index.html'); await page.waitForFunction(() => window.crossOriginIsolated === true && window.__v3, null, { timeout: 30000 });
    const r = await page.evaluate(async balls => {
      const src = 'const clamp=' + clamp.toString() + ';' + stepBall.toString() + cushion.toString() + simulate.toString() + 'const COACH=(' + coachFactory.toString() + ')(simulate);onmessage=e=>postMessage(COACH.plan(e.data.balls,e.data.P));';
      const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))), P = makeP(7);
      return await new Promise(res => { w.onmessage = e => res(e.data); w.postMessage({ balls, P: JSON.parse(JSON.stringify(P)) }); });
    }, NOV2);
    assert.ok(r.A.pocket === 5 && r.path && r.path.stroke, 'the plan with a stroke from the worker');
    assert.ok(await page.isVisible('#coachBtn'), 'the Coaching test on the home screen');
    assert.deepStrictEqual(errors, []);
  } finally { await browser.close(); srv.close(); }
});
test('Nov 8 20:24 (V3.11.1): every layout of the session gives a stroke, ball in hand or "no clean pot", with a drawable cone', () => {
  const lays = require('./fixtures/v3/coach-20261108-2024.json'), fin = q => q.every(v => isFinite(v[0]) && isFinite(v[1]));
  for (const [i, balls] of lays.entries()) {
    const r = COACH.plan(balls, P, { inHand: !balls.some(b => b.n === 0) }); if (!r) continue;
    assert.ok(r.inHand || (r.path && r.path.stroke) || r.noShot, 'layout ' + (i + 1) + ': something to show');
    const cn = r.shapes && r.shapes.cone; if (cn) assert.ok(fin(cn.core) && cn.sides.every(fin) && isFinite(cn.r1), 'layout ' + (i + 1) + ': the cone is a shape');
  }
});
test('V3.12: there is always a plan: banks, kicks and safeties when no clean pot; percentages for each (Nov 8 20:24 layouts)', () => {
  const lays = require('./fixtures/v3/coach-20261108-2024.json'); const kinds = new Set();
  for (const balls of lays) {
    const r = COACH.plan(balls, P, { inHand: !balls.some(b => b.n === 0) }); if (!r || r.inHand) continue;
    assert.ok(r.path && r.path.stroke, 'a plan for the ' + r.A.n); kinds.add(r.path.shot);
    if (r.path.shot === 'safety') assert.ok(r.path.legal > 0.5 && r.path.opp < 0.6, 'a real safety: ' + JSON.stringify({ legal: r.path.legal, opp: r.path.opp }));
    else assert.ok(r.path.make > 0, 'a percentage to make');
  }
  assert.ok(kinds.has('pot') && [...kinds].some(k => k !== 'pot'), 'pots, and banks, kicks or safeties: ' + [...kinds]); // (V3.14: a safety only when no pot is 40%+)
  // a bank: the 3 hidden from every pocket but one off the top cushion
  const b = COACH.plan([{ n: 0, x: 20, y: 10 }, { n: 3, x: 39, y: 12 }, { n: 9, x: 60, y: 30 }, { n: 101, x: 39, y: 7 }, { n: 102, x: 45, y: 13 }, { n: 103, x: 33, y: 13 }], P);
  assert.ok(b.path && b.path.stroke, 'a plan when the 3 has no straight pot: ' + (b.path && b.path.shot));
});

test('V3.14: a ball a quarter inch in the way is a tight pot, not a safety; the zone is a fan of 30 degrees at most (Nov 9 20:32 rejects)', () => {
  const r1 = COACH.plan([{ n: 9, x: 11, y: 24.6 }, { n: 1, x: 60.7, y: 9.5 }, { n: 5, x: 20.5, y: 23.1 }, { n: 7, x: 41.8, y: 32.1 }, { n: 0, x: 26.1, y: 13.7 }, { n: 6, x: 23.6, y: 5.9 }, { n: 2, x: 28.1, y: 18.5 }, { n: 3, x: 57.9, y: 25.3 }, { n: 4, x: 37.5, y: 14.6 }], P);
  assert.ok(r1.path.shot === 'pot' && r1.path.tight && r1.path.tight.includes(4) && r1.path.make > 0.4, JSON.stringify({ shot: r1.path.shot, tight: r1.path.tight, make: r1.path.make }));
  assert.ok(r1.path.ob && r1.path.ob.length > 1, 'the object ball\'s line to the pocket');
  const r2 = COACH.plan([{ n: 9, x: 10.8, y: 24.8 }, { n: 5, x: 20.4, y: 23.2 }, { n: 7, x: 41.9, y: 32.3 }, { n: 0, x: 57.3, y: 27.4 }, { n: 6, x: 23.5, y: 5.9 }, { n: 2, x: 28.1, y: 18.6 }, { n: 4, x: 37.5, y: 14.7 }, { n: 3, x: 57.1, y: 22.4 }], P);
  assert.notStrictEqual(r2.path.shot, 'safety', 'a pot is there: ' + JSON.stringify({ shot: r2.path.shot, make: r2.path.make }));
  // (V3.18: the fan in rings along the good stretch of its line; V3.25: green at most 30 degrees on the correct side,
  // yellow at most 30 on the other and never past straight in)
  for (const r of [r1, r2]) if (r.zoneFan) { const z = r.zoneFan; assert.ok(z.rings.length >= 3 && z.rings.every(g => g.g >= 1.5 && g.g <= 30 && g.y >= 0 && g.y <= 30 && (Math.abs(z.phi) < 5 || g.y <= Math.abs(z.phi))) && z.r1 - z.r0 >= 4 && z.rm > z.r0 && z.rm < z.r1, JSON.stringify({ r0: z.r0, r1: z.r1, rm: z.rm, phi: z.phi, rings: z.rings.map(g => [g.g, g.y, g.q]) })); }
});

test('V3.15: the spin and draw tests read the player\'s side spin and tip back from where the cue ball went', () => {
  const C = require('../src/core.js'), Pn = Object.assign({}, P, { cushionRoll: 0.6, pockets: [] });
  // a roll from the foot spot at the short cushion with side spin, seen at the tracker's few looks a second
  for (const a of [0.15, 0.25]) { // (the simulated turn levels off at about 20 degrees by a third of the radius)
    const r = C.simulate([{ id: 0, x: P.L * 0.75, y: P.W / 2 }], { angle: 0.02, speed: 3.2 * 17.6, a, b: 0 }, Pn, { record: true, maxT: 30 }), q = r.paths[0].filter((z, i) => i % 10 === 0).map(z => [z[1], z[2]]);
    const f = COACH.fitSpin(q, 3.2, P); assert.ok(f && Math.abs(f.a - a) < 0.06 && f.rail === 'right', a + ' -> ' + JSON.stringify(f));
  }
  // a straight draw shot: the tip and the speed back from where the cue ball and the object ball stopped
  const Pc = Object.assign({}, P, { cushionRoll: 0.6 });
  const r = C.simulate([{ id: 0, x: 30, y: 19.5 }, { id: 1, x: 50, y: 19.5 }], { angle: 0, speed: 6 * 17.6, a: 0, b: -0.4 }, Pc, { record: true, maxT: 30 });
  const c = r.final.find(z => z.id === 0), o = r.final.find(z => z.id === 1), oq = r.paths[1].map(z => [z[1], z[2]]); let len = 0; for (let i = 1; i < oq.length; i++) len += Math.hypot(oq[i][0] - oq[i - 1][0], oq[i][1] - oq[i - 1][1]);
  const d = COACH.fitDraw([30, 19.5], [c.x, c.y], [50, 19.5], [o.x, o.y], len, false, 4, P);
  assert.ok(d && Math.abs(d.b + 0.4) < 0.06 && Math.abs(d.mph - 6) < 0.6 && d.along < -20, JSON.stringify(d));
});

test('V3.15: the plan uses the player\'s speeds, tips and draw; side spin is searched with everything else (Nov 9 21:33)', () => {
  // the 4 cut to the left with the zone back down by the cue ball: before, a follow up and down the table and 35% next
  const lay = [{ n: 0, x: 57.3, y: 6.9 }, { n: 4, x: 34.1, y: 30.3 }, { n: 7, x: 65.9, y: 18.4 }, { n: 9, x: 27.9, y: 10.1 }];
  const r = COACH.plan(lay, P);
  assert.ok(r.path && r.path.stroke && r.path.stroke.speed && r.path.next >= 0.45, JSON.stringify({ st: r.path && r.path.stroke, next: r.path && r.path.next }));
  const st = r.path.stroke; assert.ok(['soft', 'soft to medium', 'medium', 'medium to hard', 'hard'].includes(st.speed) && Number.isInteger(st.tips));
  // the player's own: speeds, a tip of side, the draw and follow they have
  const o = COACH.plan(lay, P, { speeds: [1.2, 2.5, 4.5], spinTip: 0.12, tipRange: { draw: -0.25, follow: 0.3 } }).path.stroke;
  assert.ok(o.mph <= 4.5 && o.tip >= -0.25 && o.tip <= 0.3 && Math.abs(o.side - o.tips * 0.12) < 0.01, JSON.stringify(o));
});

test('V3.16: the owner\'s spin and draw tests (Nov 9 22:20) give the cushion\'s grip, a tip, and the draw; a ball read into the cushion is on it', () => {
  const F = require('./fixtures/v3/stroke-tests-20261109-2220.json');
  const s = COACH.fitSpinAll(F.spin.map(q => ({ k: q.k, mph: F.power[q.L], turn: q.turn })), P);
  assert.ok(s.railMu >= 0.2 && s.railMu <= 0.3 && s.tip >= 0.11 && s.tip <= 0.17 && s.err < 7, JSON.stringify(s));
  // the draws: the soft and medium ones stopped dead (from 21 and 26 in away), the hard ones came back 3 and 4 ft; the object
  // ball of a hard draw is never seen moving (in the pocket before the next look): taken from where it was
  const mph = { soft: F.power.medium, medium: F.power.hard, hard: 1.5 * F.power.hard }, res = {};
  for (const d of F.draws) { const c = d.cue; res[d.n] = COACH.fitDraw(c[0], c[c.length - 1], d.ob, null, 0, true, mph[d.L], P, 'draw'); }
  assert.ok(res[63].b <= 0 && res[63].along > -4 && res[64].b <= 0 && res[64].along > -4, JSON.stringify(res));
  assert.ok(res[65].b < -0.4 && res[65].along < -30 && res[66].along < -30, JSON.stringify(res));
  // the 9 frozen on the rail read 0.3 in into the cushion: a pot along the rail, not a kick
  const r = COACH.plan([{ n: 0, x: 60.7, y: 15.7 }, { n: 9, x: 66.7, y: 0.8 }], P);
  assert.ok(r.path.shot === 'pot' && r.path.make > 0.6, JSON.stringify({ shot: r.path.shot, make: r.path.make }));
});

test('V3.16: a Fargo 550\'s aim, and a hard stroke costs make percentage', () => {
  const pk = P.pockets.reduce((b, q) => (q.x + q.y > b.x + b.y ? q : b)), a = Math.PI + 24 * Math.PI / 180, u = [Math.cos(a), -Math.abs(Math.sin(a))];
  const A = [pk.x + u[0] * 36, pk.y + u[1] * 36], cue = [A[0] + u[0] * (36 + 2 * P.R), A[1] + u[1] * (36 + 2 * P.R)];
  const r = COACH.plan([{ n: 0, x: cue[0], y: cue[1] }, { n: 9, x: A[0], y: A[1] }], P);
  assert.ok(r.path.make >= 0.55 && r.path.make <= 0.97, 'straight in, 3 ft and 3 ft: ' + r.path.make); // (was 0.44 with 0.2 degrees)
});

test('V3.17: the plan is made for a level (the player\'s Fargo plus 100): a stronger level makes more; very hard is there for a draw', () => {
  const pk = P.pockets.reduce((b, q) => (q.x + q.y > b.x + b.y ? q : b)), a = Math.PI + 24 * Math.PI / 180, u = [Math.cos(a), -Math.abs(Math.sin(a))];
  const A = [pk.x + u[0] * 36, pk.y + u[1] * 36], cue = [A[0] + u[0] * (36 + 2 * P.R), A[1] + u[1] * (36 + 2 * P.R)], lay = [{ n: 0, x: cue[0], y: cue[1] }, { n: 9, x: A[0], y: A[1] }];
  const hi = COACH.plan(lay, P, { level: 700 }).path.make, lo = COACH.plan(lay, P, { level: 400 }).path.make;
  assert.ok(hi > lo + 0.15, 'Fargo 700 ' + hi + ' against 400 ' + lo);
  const r = COACH.plan(lay, P, { level: 600 }); assert.ok(['soft', 'soft to medium', 'medium', 'medium to hard', 'hard', 'very hard'].includes(r.path.stroke.speed));
});

test('V3.18: closer leaves; the zone a long fan of graded rings along the leave\'s line, its middle the target (Nov 10 22:54)', () => {
  // the 5 then the 7: V3.17 left the cue ball 58 in from the 7 for an easy pot; now it plays for shape nearer it
  const lay = [{ n: 9, x: 22.8, y: 0.9 }, { n: 7, x: 62.7, y: 27.9 }, { n: 5, x: 13.6, y: 8.3 }, { n: 0, x: 55.1, y: 16 }];
  const r = COACH.plan(lay, P, { speeds: [3.1, 5, 7.5], spinTip: 0.14, railMu: 0.25, level: 600 });
  assert.ok(r.zoneFan && r.zoneFan.rings.length >= 3 && r.target, 'a fan and a target');
  // (V3.20: no fixed best distance, from the sources; the leave's distance counts through the next shot's make)
  const z = r.zoneFan, B = lay.find(b => b.n === r.B.n), dT = Math.hypot(r.target[0] - B.x, r.target[1] - B.y);
  // (V3.25: the fan's line is the ideal one; the target stays the middle of the good stretch on the planned leave's line,
  // the same line when the two are about as good)
  if (z.onLine) assert.ok(Math.abs(dT - z.rm) < 1.5 && z.rm > z.r0 && z.rm < z.r1, 'the target is the middle of the good stretch: ' + JSON.stringify({ dT, r0: z.r0, r1: z.r1, rm: z.rm }));
  assert.ok(COACH.fanGrade(z, r.target[0], r.target[1]) || !z.onLine, 'the target in the fan');
});

test('V3.22: a hanger read inside the pocket\'s edge is a pot; other balls the stroke moves come with their paths; routine pots are simple', () => {
  // Nov 16 18:02: the 6 in the jaws of the top-right corner read at (76.1, 38.9); no plan at all
  const h = COACH.plan([{ n: 8, x: 44.1, y: 2.3 }, { n: 9, x: 67.3, y: 30.4 }, { n: 6, x: 76.1, y: 38.9 }, { n: 7, x: 9, y: 32.9 }, { n: 0, x: 34.9, y: 33.6 }], P);
  assert.ok(h.path && h.path.shot === 'pot' && h.path.make > 0.8, JSON.stringify(h.path && { shot: h.path.shot, make: h.path.make }));
  // a ball resting in the jaws does not drop by itself in the simulation; struck, it does
  const C = require('../src/core.js'), still = C.simulate([{ id: 0, x: 20, y: 20 }, { id: 6, x: 76.1, y: 37.855 }], { angle: Math.PI, speed: 30, a: 0, b: 0 }, P, { maxT: 4 });
  assert.ok(!still.pocketed.some(q => q.id === 6), 'a hanger stays until it is hit');
  // the cue ball straight into the 5 behind the 1: the 5's path is in the plan
  const o = COACH.plan([{ n: 0, x: 20, y: 19.5 }, { n: 1, x: 50, y: 30 }, { n: 5, x: 30, y: 19.5 }, { n: 9, x: 60, y: 8 }], P);
  assert.ok(o.path && Array.isArray(o.path.others), 'others listed');
  // Nov 16 18:02: the 1 into the top-left corner was played at break speed round three cushions; now a simple stroke
  const s = COACH.plan([{ n: 0, x: 22.5, y: 6.6 }, { n: 8, x: 44.1, y: 2.1 }, { n: 4, x: 41.4, y: 35.5 }, { n: 9, x: 67.3, y: 30.1 }, { n: 3, x: 29.9, y: 19.5 }, { n: 6, x: 22.2, y: 20.6 }, { n: 1, x: 10.8, y: 21.5 }, { n: 7, x: 9.3, y: 32.7 }, { n: 2, x: 47.1, y: 13.4 }, { n: 5, x: 8.7, y: 8 }], P);
  assert.ok(s.path.stroke.speed !== 'very hard' && s.path.tier <= 1, JSON.stringify({ st: s.path.stroke, tier: s.path.tier }));
});

test('V3.25: the zone\'s line is the ideal one, green on the side with more angle, yellow on the side toward straight in (owner, Nov 18)', () => {
  // Nov 17 22:50 shot 19's layout: the 2 in the top-left, then the 3 to the bottom-right
  const lay = [{ n: 2, x: 20.6, y: 23.6 }, { n: 3, x: 51.2, y: 15.6 }, { n: 4, x: 66.4, y: 25.9 }, { n: 5, x: 13.4, y: 8.1 }, { n: 0, x: 29.9, y: 17.8 }];
  for (const L0 of [lay, NOV2]) {
    const r = COACH.plan(L0, P, { speeds: [3.1, 5, 7.5], level: 600 }), z = r.zoneFan; if (!z) continue;
    assert.ok(Math.abs(z.s) === 1 && isFinite(z.a0) && isFinite(z.back), JSON.stringify({ s: z.s, phi: z.phi }));
    // the green side is the side away from straight in (when the ideal has an angle)
    if (Math.abs(z.phi) >= 5) assert.strictEqual(z.s, Math.sign(z.phi), 'green on the side with more angle: ' + JSON.stringify({ s: z.s, phi: z.phi }));
    // a spot on the ideal line in the middle of the fan is green; one just to the green side green, just to the yellow side yellow
    const ring = z.rings[Math.floor(z.rings.length / 2)], at = (d, rr) => [z.from[0] + rr * Math.cos(z.a0 + z.s * d * Math.PI / 180), z.from[1] + rr * Math.sin(z.a0 + z.s * d * Math.PI / 180)];
    assert.strictEqual(COACH.fanGrade(z, ...at(0, ring.r)), 'green');
    assert.strictEqual(COACH.fanGrade(z, ...at(Math.min(ring.g, 6) * 0.8, ring.r)), 'green');
    if (ring.y >= 3) assert.strictEqual(COACH.fanGrade(z, ...at(-ring.y * 0.7, ring.r)), 'yellow');
    assert.strictEqual(COACH.fanGrade(z, ...at(0, z.r1 + 12)), null, 'past the fan');
    assert.strictEqual(COACH.fanGrade(z, ...at(ring.g + 25, ring.r)), null, 'beside it');
  }
});

test('V3.25: the stroke read back from the balls\' ways: too hard with less draw, and a miss overcut or undercut', () => {
  const C = require('../src/core.js'), Pp = Object.assign({}, P, { cushionRoll: 0.6, railMu: 0.25, pocketSpeed: 0.012 });
  // a cut into the bottom-left corner: the 5 near the corner, the cue ball up the table
  const balls = [{ n: 0, x: 14, y: 26 }, { n: 5, x: 8, y: 9 }, { n: 7, x: 52, y: 17.4 }, { n: 9, x: 66.9, y: 14 }];
  const init = balls.map(b => ({ id: b.n, x: b.x, y: b.y })), pk = 0, A5 = balls[1], cue = balls[0];
  const run = (ang, v, b) => C.simulate(init, { angle: ang, speed: v, a: 0, b }, Pp, { record: true, only: new Set([0, 5]), maxT: 9 });
  // the aim that pots it at the plan's stroke (middle of the window)
  const ang0 = Math.atan2(A5.y - cue.y, A5.x - cue.x); let lo = null, hi = null;
  for (let k = -150; k <= 150; k++) { const r = run(ang0 + k * 0.05 * Math.PI / 180, 3.2 * 17.6, -0.3); const z = r.pocketed.find(w => w.id === 5); if (r.firstHit === 5 && z && z.pocket === pk && !r.pocketed.some(w => w.id === 0)) { if (lo == null) lo = k; hi = k; } }
  assert.ok(lo != null, 'a pot at the plan\'s stroke'); const aimOk = ang0 + (lo + hi) / 2 * 0.05 * Math.PI / 180;
  // what a camera at three looks a second sees (to a tenth of an inch)
  const look = (r, id) => { const q = r.paths[id] || [], out = []; for (let t = 0; t <= q[q.length - 1][0] + 0.34; t += 0.33) { let z = q[0]; for (const w of q) if (w[0] <= t) z = w; out.push([t, Math.round(z[1] * 10) / 10, Math.round(z[2] * 10) / 10]); } const e = q[q.length - 1]; out.push([e[0] + 0.3, Math.round(e[1] * 10) / 10, Math.round(e[2] * 10) / 10]); return out; };
  const plan = { v: 3.2 * 17.6, a: 0, b: -0.3, pk, speed: 'medium' };
  // 1. played 30% harder with a centre ball (no draw): made, and the read says too hard, not enough draw
  const real = run(aimOk, 3.2 * 17.6 * 1.3, 0); assert.ok(real.pocketed.some(w => w.id === 5), 'made as played');
  const cb = look(real, 0), f = COACH.fitStroke(balls, P, 5, plan, { ob: [], cb: cb.map(z => [z[1], z[2]]), cbT: cb.map(z => z[0]), made: pk }, { railMu: 0.25 });
  // (harder with no draw and a little softer with follow stop an inch apart here, each look within an inch: the read may
  // not be sure of the speed, and then says nothing of it; never too soft, and the draw it is sure of)
  assert.ok(f && f.v > 0.9 && f.v < 1.45 && f.b > -0.1 && f.err < 2, JSON.stringify(f));
  const w = COACH.strokeWords(f, plan, true, [1.6, 3.2, 6]); assert.ok(w.read && w.words.includes('not enough draw') && !w.words.some(x => /^too soft/.test(x)) && !w.cut, JSON.stringify(w));
  if (f.sure.speed) assert.ok(w.words.some(x => /^too hard/.test(x)), JSON.stringify(w));
  // 2. aimed a degree and a half thinner: missed, overcut; a degree and a half fuller: undercut
  const dir = Math.sign(aimOk - ang0) || 1;
  for (const [d, want] of [[1.5, 'overcut'], [-1.5, 'undercut']]) {
    const r2 = run(aimOk + dir * d * Math.PI / 180, plan.v, plan.b); if (r2.pocketed.some(z => z.id === 5) || r2.firstHit !== 5) continue;
    const c2 = look(r2, 0), o2 = look(r2, 5), f2 = COACH.fitStroke(balls, P, 5, plan, { ob: o2.map(z => [z[1], z[2]]), cb: c2.map(z => [z[1], z[2]]), cbT: c2.map(z => z[0]), made: null }, { railMu: 0.25 });
    assert.ok(f2 && f2.cut === want, d + ': ' + JSON.stringify(f2));
    assert.ok(COACH.strokeWords(f2, plan, false, null).words[0] === want);
  }
  // 3. a stroke read badly says nothing of speed or tip
  assert.deepStrictEqual(COACH.strokeWords({ v: 1.5, b: 0.4, mph: 5, err: 6, obErr: 0.5, cut: null }, plan, true, null).words, []);
  assert.strictEqual(COACH.speedWordOf(5, [3.1, 5, 7.5]), 'medium'); assert.strictEqual(COACH.speedWordOf(3.9, [3.1, 5, 7.5]), 'soft to medium');
});
