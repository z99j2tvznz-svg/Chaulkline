// The coaching test's runout planner (src/v3/coach.js, V3.10): three balls ahead on a real layout (Nov 2, 20:54, rack 2:
// the 1, then the 2, then the 3), a ball not named still in the way, short runouts, and the planner in the page's worker.
const test = require('node:test'), assert = require('node:assert'), path = require('path');
const { makeP } = require('../src/core.js'), COACH = require('../src/v3/coach.js'), P = makeP(7);
const NOV2 = [{ n: 1, x: 55.9, y: 31.6 }, { n: 7, x: 61.3, y: 25.5 }, { n: 2, x: 41.6, y: 9.1 }, { n: 6, x: 38.6, y: 12.3 }, { n: 5, x: 27.0, y: 10.3 }, { n: 9, x: 7.9, y: 6.5 }, { n: 8, x: 67.3, y: 12.5 }, { n: 4, x: 19.1, y: 19.6 }, { n: 3, x: 71.5, y: 11.2 }, { n: 0, x: 43.0, y: 28.9 }];
const count = (r, v) => r.cells.filter(c => c === v).length;
test('three balls ahead on Nov 2 rack 2: the 1 top-right, the 2 bottom side, the 3 bottom-right; the 6 in the way, a wrong side', () => {
  const r = COACH.plan(NOV2, P);
  assert.strictEqual(r.A.pocket, 5); assert.ok([1, 2].includes(r.B.pocket), 'the 2 in the bottom side or corner: ' + r.B.pocket); assert.strictEqual(r.C.pocket, 2);
  assert.ok(count(r, 1) + count(r, 5) + count(r, 2) > 20 && count(r, 4) > 50, '60%+ and grey: ' + [count(r, 1) + count(r, 5) + count(r, 2), count(r, 4)]);
  // V3.11: a real stroke from the simulation: the 1 goes in, the cue ball stays up, stops in the zone; a band for the pocket's width
  const st = r.path.stroke; assert.ok(st && st.power >= 1 && st.power <= 10 && Math.abs(st.tip) <= 0.5, JSON.stringify(st));
  assert.ok(r.path.shot === 'pot' && r.path.make > 0.5 && r.path.pts.length > 5 && r.path.fan, 'a pot with its percentages and a band: ' + JSON.stringify({ make: r.path.make, next: r.path.next }));
  assert.ok(COACH.gradeAt(r, r.spot[0], r.spot[1]) && COACH.gradeAt(r, r.spot[0], r.spot[1]) !== 'blocked', 'the spot in the zone');
  assert.strictEqual(COACH.gradeAt(r, 30, 20), 'blocked'); // behind the 6
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
  for (const r of [r1, r2]) if (r.zoneFan) { const z = r.zoneFan; assert.ok(z.lo + z.hi <= 30 && z.lo >= 2 && z.hi >= 2 && z.r1 - z.r0 >= 6, JSON.stringify(z)); }
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
