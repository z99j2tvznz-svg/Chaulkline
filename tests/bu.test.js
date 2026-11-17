// Billiard University Exam I (src/v3/bu.js, V3.22): the scoring by the document's own rules and examples, the layouts on
// the table, and each drill's success rule
const test = require('node:test'), assert = require('node:assert');
const BU = require('../src/v3/bu.js'), { makeP } = require('../src/core.js'), P = makeP(7);
const view = (dx, dy) => [dx * P.L / 8, dy * P.W / 4]; // (the player at the near rail, the left end on the left)
const T = s => [...s].map(ch => ch === '1');

test('progressive drills F1-F4 score as the BU document says', () => {
  // "you can stop if you make the first eight shots": 4,5,6 then 7 with five bonus makes; two misses could only take it to 5 + 5
  const a = BU.state('F1', T('11111111')); assert.ok(a.done && a.score === 10 && a.shot === 8, JSON.stringify(a));
  // "if you make the 10th shot at 6, the final position is 7; and if you miss the 10th shot at 6, the final position is 5"
  const six = T('110111010'); assert.strictEqual(BU.state('F2', six).pos, 6);
  assert.strictEqual(BU.state('F2', six.concat([true])).pos, 7); assert.strictEqual(BU.state('F2', six.concat([false])).pos, 5);
  // a success at 7 stays at 7 and earns a bonus point; a miss at 1 stays at 1; 10 at most
  const b = BU.state('F3', T('1110000000')); assert.ok(b.done && b.score === 1 && b.pos === 1, JSON.stringify(b));
  // four bonus makes at 7 with one miss: 10 certain after nine shots (7 - 1 + 4), so the drill stops there
  const c = BU.state('F4', T('111101111')); assert.ok(c.done && c.shot === 9 && c.bonus === 4 && c.score === 10, JSON.stringify(c));
  const e = BU.state('F4', T('1100110100')); assert.ok(e.done && e.pos === 4 && e.bonus === 0 && e.score === 4, JSON.stringify(e));
  // F5 always takes ten shots (no early stop in its rules)
  assert.ok(!BU.state('F5', T('11111111')).done && BU.state('F5', T('1111111111')).done);
  // the set-shot drills: a point each, 10, 20 and 20 shots; the exam's total and the Exam II level
  assert.ok(BU.state('F6', T('1101101111')).done && BU.state('F6', T('1101101111')).score === 8);
  assert.ok(!BU.state('F7', Array(19).fill(true)).done && BU.state('F8', Array(20).fill(false)).done);
  assert.deepStrictEqual(BU.total({ F1: 10, F2: 8, F3: 7, F4: 6, F5: 7, F6: 8, F7: 14, F8: 12 }), { total: 72, place: 'Doctorate' });
  assert.strictEqual(BU.total({ F1: 6, F2: 5, F3: 5, F4: 4, F5: 5, F6: 7, F7: 10, F8: 8 }).place, 'Masters');
  assert.strictEqual(BU.total({ F1: 3 }).place, 'Bachelors');
});

test('every layout is on the table, with the pockets and targets of the diagrams', () => {
  const on = p => p[0] >= P.R && p[0] <= P.L - P.R && p[1] >= P.R && p[1] <= P.W - P.R;
  const pk = (dx, dy) => P.pockets.findIndex(q => Math.hypot(q.x - dx * P.L / 8, q.y - dy * P.W / 4) < 1);
  for (const d of BU.DRILLS) {
    const n = d.kind === 'prog' ? 7 : d.n;
    for (let i = 0; i < n; i++) {
      const st = d.kind === 'prog' ? { pos: i + 1, shot: 0 } : { shot: i }, L = BU.layout(d.id, st, P, view);
      assert.ok(on(L.O) && (!L.C || on(L.C)), d.id + ' ' + i + ' on the table: ' + JSON.stringify({ O: L.O, C: L.C }));
      if (L.tball) assert.ok(on(L.tball));
    }
  }
  const f1 = BU.layout('F1', { pos: 4, shot: 0 }, P, view); assert.strictEqual(f1.pocket, pk(8, 0)); assert.ok(Math.abs(f1.C[0] - P.L / 2) < 0.01);
  // F2-F4 along the far rail into the far right corner; the stop shot's ghost ball straight behind the object ball
  const f2 = BU.layout('F2', { pos: 7, shot: 0 }, P, view); assert.strictEqual(f2.pocket, pk(8, 4)); assert.ok(Math.abs(f2.G[1] - f2.O[1]) < 1e-6 && f2.G[0] < f2.O[0]);
  const f3 = BU.layout('F3', { pos: 3, shot: 0 }, P, view); assert.ok(Math.abs(f3.O[0] - f3.C[0] - P.L / 8) < 0.01, 'a diamond apart');
  const f4 = BU.layout('F4', { pos: 2, shot: 0 }, P, view); assert.ok(Math.abs(f4.zone.x1 - f4.zone.x0 - 2 * P.L / 8) < 0.01 && Math.abs(f4.zone.y1 - P.W) < 0.01);
  // F5: target 1 at the 5th diamond straight to it, 4 against the end rail, 7 back at the 5th diamond off the end rail
  const t = p => BU.layout('F5', { pos: p, shot: 0 }, P, view);
  assert.strictEqual(t(1).rail, 'none'); assert.strictEqual(t(7).rail, 'end'); assert.strictEqual(t(4).rail, null);
  assert.ok(Math.abs((t(1).targets[0].x0 + t(1).targets[0].x1) / 2 - 5 * P.L / 8) < 0.01 && Math.abs(t(4).targets[0].x1 - P.L) < 0.01);
  assert.deepStrictEqual(t(7).targets[0], t(1).targets[0]); assert.strictEqual(t(1).pocket, pk(4, 0));
  // F6 ten different shots; F7 the rail balls in order, two tries each; F8 five targets, four tries each
  assert.strictEqual(new Set([...Array(10)].map((_, k) => JSON.stringify(BU.layout('F6', { shot: k }, P, view).O) + BU.layout('F6', { shot: k }, P, view).pocket)).size, 10);
  assert.strictEqual(BU.layout('F7', { shot: 3 }, P, view).tnum, 2); assert.strictEqual(BU.layout('F7', { shot: 19 }, P, view).tnum, 10);
  assert.strictEqual(BU.layout('F8', { shot: 4 }, P, view).tnum, 2); assert.strictEqual(BU.layout('F8', { shot: 0 }, P, view).pocket, pk(0, 4));
});

test('each drill\'s rule: pocket, scratch, the stop on the ghost ball, the box, the targets, the end rail, the rail ball', () => {
  const L = (id, st) => BU.layout(id, st, P, view);
  const f1 = L('F1', { pos: 4, shot: 0 });
  assert.ok(BU.judge(f1, { obIn: true, obPocket: f1.pocket, scratch: true }).ok, 'F1 allows a scratch');
  assert.ok(!BU.judge(f1, { obIn: true, obPocket: (f1.pocket + 1) % 6 }).ok, 'the wrong pocket');
  assert.ok(BU.judge(f1, { obIn: true, obPocket: null }).ok, 'a pocket not seen counts');
  const f2 = L('F2', { pos: 4, shot: 0 });
  assert.ok(BU.judge(f2, { obIn: true, obPocket: f2.pocket, cueEnd: [f2.G[0] - 2, f2.G[1]] }).ok, 'overlapping the ghost ball');
  assert.ok(!BU.judge(f2, { obIn: true, obPocket: f2.pocket, cueEnd: [f2.G[0] - 4, f2.G[1]] }).ok, 'short of it');
  const f4 = L('F4', { pos: 4, shot: 0 }), z = f4.zone;
  assert.ok(BU.judge(f4, { obIn: true, cueEnd: [(z.x0 + z.x1) / 2, (z.y0 + z.y1) / 2] }).ok && !BU.judge(f4, { obIn: true, cueEnd: [z.x0 - 0.5, z.y1 - 2] }).ok, 'the centre inside the box');
  const t7 = L('F5', { pos: 7, shot: 0 }), r = t7.targets[0], mid = [(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2];
  assert.ok(!BU.judge(t7, { obIn: true, cueEnd: mid, cuePath: [[40, 17], mid] }).ok, 'target 7 must come off the end rail');
  assert.ok(BU.judge(t7, { obIn: true, cueEnd: mid, cuePath: [[40, 17], [P.L - P.R, 19], mid] }).ok);
  const t1 = L('F5', { pos: 1, shot: 0 });
  assert.ok(!BU.judge(t1, { obIn: true, cueEnd: mid, cuePath: [[40, 17], [P.L - P.R, 19], mid] }).ok, 'target 1 straight to it');
  assert.ok(BU.judge(t1, { obIn: true, cueEnd: [r.x0 - P.R + 0.2, mid[1]], cuePath: [] }).ok, 'overlapping the paper counts');
  const w = L('F7', { shot: 0 });
  assert.ok(BU.judge(w, { obIn: true, targetMoved: true }).ok && !BU.judge(w, { obIn: true, targetMoved: false }).ok && !BU.judge(w, { obIn: false, targetMoved: true }).ok);
  const g = L('F8', { shot: 8 }), q = g.targets[0];
  assert.ok(BU.judge(g, { obIn: true, cueEnd: [(q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2] }).ok && !BU.judge(g, { obIn: true, scratch: true, cueEnd: [(q.x0 + q.x1) / 2, (q.y0 + q.y1) / 2] }).ok);
});
