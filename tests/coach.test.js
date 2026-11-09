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
    const r = sim([{ id: 0, x: 10, y: 19.5 }], { angle: 0.1, speed: v, a: 0, b: 0 }, Object.assign({}, P, { pockets: [] }), { record: true, maxT: 40 }), q = r.paths[0]; let len = 0; for (let i = 1; i < q.length; i++) len += Math.hypot(q[i][1] - q[i - 1][1], q[i][2] - q[i - 1][2]);
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
  assert.ok(kinds.has('pot') && kinds.has('safety'), 'pots and safeties: ' + [...kinds]);
  // a bank: the 3 hidden from every pocket but one off the top cushion
  const b = COACH.plan([{ n: 0, x: 20, y: 10 }, { n: 3, x: 39, y: 12 }, { n: 9, x: 60, y: 30 }, { n: 101, x: 39, y: 7 }, { n: 102, x: 45, y: 13 }, { n: 103, x: 33, y: 13 }], P);
  assert.ok(b.path && b.path.stroke, 'a plan when the 3 has no straight pot: ' + (b.path && b.path.shot));
});
