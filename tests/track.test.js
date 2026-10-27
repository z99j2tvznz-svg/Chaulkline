// V3 tracker (src/track.js) on made-up looks: names kept with the balls, shots, pockets, hidden balls, hands, taps, the
// measle cue ball against the 9. Each look is what the finder and reader would hand over, with a little position noise.
const test = require('node:test');
const assert = require('node:assert');
const { makeP } = require('../src/core.js');
const { makeTracker } = require('../src/track.js');

const P = makeP(7); // 78 x 39 in
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const noise = a => (rnd() - 0.5) * 2 * a;
// a reader result: sure of `num` (p), the rest spread out
function probs(num, p = 0.85, nb = 0.02) { const q = new Array(11).fill((1 - p - nb) / 9); q[num] = p; q[10] = nb; return q; }
// one look: balls [{num, x, y, hide?, p?, col?, nb?}], read = reader ran (only on balls marked still)
function look(tk, t, balls, read = true, jitter = 0.15) {
  const spots = balls.filter(b => !b.hide).map(b => {
    const x = b.x + noise(jitter), y = b.y + noise(jitter);
    return { x, y, px: x * 12, py: y * 12, r: 13, score: 0.8, p: read && !b.moving ? (b.p || probs(b.num, 0.85, b.nb || 0.02)) : null, kind: b.kind || ((b.nb || 0) >= 0.5 ? 'not_a_ball' : 'sure'), col: b.col || null };
  });
  return tk.update(t, spots, { read });
}
const names = tk => Object.fromEntries(tk.balls().filter(b => b.num != null).map(b => [b.num, [Math.round(b.x), Math.round(b.y), b.sure]]));
function settle(tk, t0, balls, secs = 2.5, dt = 0.1) { let t = t0; for (; t < t0 + secs; t += dt) look(tk, t, balls); return t; }

test('balls at rest are named once they have rested and been read', () => {
  const tk = makeTracker(P), balls = [{ num: 0, x: 20, y: 20 }, { num: 3, x: 40, y: 22 }, { num: 9, x: 55, y: 10 }, { num: 5, x: 60, y: 30 }];
  settle(tk, 0, balls);
  const n = names(tk);
  assert.deepStrictEqual(Object.keys(n).map(Number).sort((a, b) => a - b), [0, 3, 5, 9]);
  assert.ok(Object.values(n).every(v => v[2]), 'all sure');
  assert.strictEqual(tk.S.shots.length, 0); assert.strictEqual(tk.S.phase, 'still');
});

test('the wobble of resting spots is not motion: no shot, no hands', () => {
  const tk = makeTracker(P), balls = [{ num: 0, x: 20, y: 20 }, { num: 1, x: 70, y: 35 }, { num: 2, x: 10, y: 5 }];
  let t = 0; for (; t < 8; t += 0.1) look(tk, t, balls, true, 0.35);
  assert.strictEqual(tk.S.shots.length, 0); assert.strictEqual(tk.S.phase, 'still');
  assert.ok(!tk.S.events.some(e => e.k === 'hands'));
});

// a shot: the cue ball rolls into the 3, the 3 rolls into the top-right corner pocket (78, 39) and the cue ball stops
function playShot(tk, t, cue, three, extra, opts = {}) {
  const dt = opts.dt || 0.1, hit = { x: three.x - 2.25, y: three.y }, pk = { x: 78, y: 39 };
  // cue ball to the 3 at 50 in/s
  let d = Math.hypot(hit.x - cue.x, hit.y - cue.y), n = Math.ceil(d / (50 * dt));
  for (let i = 1; i <= n; i++) { const f = i / n; look(tk, t, [{ num: 0, x: cue.x + (hit.x - cue.x) * f, y: cue.y + (hit.y - cue.y) * f, moving: true }, { num: 3, ...three }, ...extra(t)], false); t += dt; }
  // the 3 to the pocket at 40 in/s, the cue ball drifts 6 in and stops; the 3 vanishes 2 in from the pocket
  const L3 = Math.hypot(pk.x - three.x, pk.y - three.y), m = Math.ceil((L3 - 2) / (40 * dt));
  for (let i = 1; i <= m; i++) {
    const f = i / m * (L3 - 2) / L3, c = Math.min(1, i / 3);
    look(tk, t, [{ num: 0, x: hit.x + 6 * c, y: hit.y, moving: c < 1 }, { num: 3, x: three.x + (pk.x - three.x) * f, y: three.y + (pk.y - three.y) * f, moving: true }, ...extra(t)], false); t += dt;
  }
  const rest = [{ num: 0, x: hit.x + 6, y: hit.y }];
  for (let i = 0; i < 30; i++) { look(tk, t, rest.concat(extra(t))); t += dt; }
  return t;
}

test('a shot: cue ball first, the 3 pocketed in the right pocket, names kept', () => {
  const tk = makeTracker(P), cue = { x: 15, y: 15 }, three = { x: 50, y: 26 };
  const others = () => [{ num: 5, x: 30, y: 33 }, { num: 9, x: 62, y: 8 }];
  let t = settle(tk, 0, [{ num: 0, ...cue }, { num: 3, ...three }, ...others()]);
  t = playShot(tk, t, cue, three, others);
  assert.strictEqual(tk.S.shots.length, 1, JSON.stringify(tk.S.events.slice(-12)));
  const sh = tk.S.shots[0];
  assert.strictEqual(sh.cueNum, 0); assert.strictEqual(sh.firstNum, 3); assert.strictEqual(sh.scratch, false);
  assert.deepStrictEqual(sh.made.map(m => [m.num, m.pocket]), [[3, 5]]); // P.pockets[5] = top-right (78, 39)
  assert.deepStrictEqual(tk.S.gone, [3]);
  const n = names(tk); assert.ok(n[0] && n[5] && n[9] && !n[3], JSON.stringify(n));
});

test('a ball hidden behind the player during the shot keeps its spot and name', () => {
  const tk = makeTracker(P), cue = { x: 15, y: 15 }, three = { x: 50, y: 26 };
  let tHide0 = null;
  const others = t => [{ num: 5, x: 30, y: 33, hide: tHide0 != null && t >= tHide0 && t < tHide0 + 1.2 }, { num: 9, x: 62, y: 8 }];
  let t = settle(tk, 0, [{ num: 0, ...cue }, { num: 3, ...three }, ...others(0)]); tHide0 = t + 0.2;
  playShot(tk, t, cue, three, others);
  const five = tk.balls().find(b => b.num === 5); assert.ok(five, 'the 5 is still on the table');
  assert.ok(Math.hypot(five.x - 30, five.y - 33) < 1); assert.deepStrictEqual(tk.S.gone, [3]);
});

test('an arm sweeping over the table never becomes a ball and starts no shot', () => {
  const tk = makeTracker(P), balls = [{ num: 0, x: 20, y: 20 }, { num: 4, x: 40, y: 30 }];
  let t = settle(tk, 0, balls);
  for (let i = 0; i < 25; i++) { // two "spots" on a forearm crossing the table, then resting on the cloth for 0.4 s
    const ax = 10 + Math.min(i, 20) * 2.5;
    look(tk, t, balls.concat([{ num: 1, x: ax, y: 8, nb: 0.85, p: probs(1, 0.1, 0.85) }, { num: 2, x: ax + 3, y: 10, nb: 0.7, p: probs(2, 0.2, 0.7) }])); t += 0.1;
  }
  settle(tk, t, balls, 1.5);
  assert.strictEqual(tk.balls().length, 2); assert.strictEqual(tk.S.shots.length, 0);
});

test('several balls moving together (hands, racking) is not a shot', () => {
  const tk = makeTracker(P), balls = [0, 1, 2, 3, 4].map((num, i) => ({ num, x: 20 + i * 5, y: 20 }));
  let t = settle(tk, 0, balls);
  for (let i = 1; i <= 8; i++) { look(tk, t, balls.map(b => ({ ...b, x: b.x + i * 2, moving: true })), false); t += 0.1; }
  settle(tk, t, balls.map(b => ({ ...b, x: b.x + 16 })));
  assert.strictEqual(tk.S.shots.length, 0); assert.ok(tk.S.events.some(e => e.k === 'hands'));
});

test('a tap keeps its name against the reader and through a shot', () => {
  const tk = makeTracker(P), cue = { x: 15, y: 15 }, three = { x: 50, y: 26 };
  // the reader keeps calling the purple 4 a 7
  const others = () => [{ num: 4, x: 30, y: 33, p: probs(7, 0.7) }, { num: 9, x: 62, y: 8 }];
  let t = settle(tk, 0, [{ num: 0, ...cue }, { num: 3, ...three }, ...others()]);
  const four = tk.balls().find(b => Math.hypot(b.x - 30, b.y - 33) < 1); assert.strictEqual(four.num, 7);
  tk.pin(four.key, 4);
  t = playShot(tk, t, cue, three, others);
  const after = tk.balls().find(b => Math.hypot(b.x - 30, b.y - 33) < 1);
  assert.strictEqual(after.num, 4); assert.ok(after.sure); assert.ok(!tk.balls().some(b => b.num === 7));
});

test('measle cue ball vs the 9: the colour settles a close call', () => {
  const tk = makeTracker(P), close = (cue, nine) => { const q = new Array(11).fill(0.01); q[0] = cue; q[9] = nine; q[10] = 0.01; return q; };
  const balls = [{ num: 9, x: 20, y: 20, p: close(0.5, 0.42), col: { y: 0.22, r: 0, w: 0.5 } }, { num: 0, x: 40, y: 20, p: close(0.42, 0.5), col: { y: 0.0, r: 0.04, w: 0.7 } }];
  settle(tk, 0, balls);
  const n = names(tk); assert.deepStrictEqual([n[9] && n[9][0], n[0] && n[0][0]], [20, 40]);
});

test('touching balls: unsure reads do not count, so a bunch stays unnamed rather than guessed', () => {
  const unsure = n => { const q = probs(n, 0.45); return q; };
  const tk = makeTracker(P), balls = [{ num: 1, x: 40, y: 20, p: unsure(5) }, { num: 2, x: 42.25, y: 20, p: unsure(5) }].map(b => ({ ...b, kind: 'unsure' }));
  settle(tk, 0, balls);
  assert.ok(tk.balls().length === 2 && tk.balls().every(b => b.num == null), JSON.stringify(names(tk)));
});

test('a ball picked up by hand: its hidden copy lets go once the new spot holds the name', () => {
  const tk = makeTracker(P);
  let t = settle(tk, 0, [{ num: 0, x: 20, y: 20 }, { num: 6, x: 50, y: 20 }]);
  // the cue ball is lifted (gone from view) and set down elsewhere
  t = settle(tk, t, [{ num: 6, x: 50, y: 20 }], 1);
  t = settle(tk, t, [{ num: 0, x: 30, y: 30 }, { num: 6, x: 50, y: 20 }], 6);
  const cues = tk.balls().filter(b => b.num === 0);
  assert.strictEqual(cues.length, 1); assert.ok(Math.hypot(cues[0].x - 30, cues[0].y - 30) < 1);
  assert.strictEqual(tk.S.shots.length, 0);
});

test('a scratch: the cue ball rolls into a pocket and is called a scratch', () => {
  const tk = makeTracker(P), others = [{ num: 2, x: 30, y: 10 }, { num: 7, x: 45, y: 30 }];
  let t = settle(tk, 0, [{ num: 0, x: 50, y: 20 }, ...others]);
  const pk = { x: 78, y: 0 }; // bottom-right corner
  for (let i = 1; i <= 8; i++) { const f = i / 8 * 0.92; look(tk, t, [{ num: 0, x: 50 + 28 * f, y: 20 - 20 * f, moving: true }, ...others], false); t += 0.1; }
  settle(tk, t, others, 3);
  const sh = tk.S.shots[0]; assert.ok(sh, 'shot'); assert.strictEqual(sh.scratch, true);
  assert.deepStrictEqual(sh.made.map(m => [m.num, m.pocket]), [[0, 2]]);
});

test('a rolling ball lost in the middle of the table is hidden, never pocketed', () => {
  const tk = makeTracker(P), others = [{ num: 4, x: 60, y: 30 }];
  let t = settle(tk, 0, [{ num: 0, x: 10, y: 20 }, ...others]);
  for (let i = 1; i <= 5; i++) { look(tk, t, [{ num: 0, x: 10 + i * 5, y: 20, moving: true }, ...others], false); t += 0.1; }
  t = settle(tk, t, others, 2.5); // the cue ball vanished at (35, 20), behind the player
  assert.strictEqual(tk.S.shots.length, 1); assert.deepStrictEqual(tk.S.shots[0].made, []);
  const cue = tk.balls().find(b => b.num === 0); assert.ok(cue && cue.state === 'hidden');
  t = settle(tk, t, [{ num: 0, x: 38, y: 20 }, ...others], 2); // seen again a bit further on
  assert.strictEqual(tk.balls().filter(b => b.num === 0).length, 1);
});

test('a break: the cue ball alone first, then the rack scatters; one shot, first ball the head ball', () => {
  const tk = makeTracker(P), rack = [];
  const head = { x: 58, y: 19.5 }; let k = 1;
  for (let row = 0; row < 3; row++) for (let j = 0; j <= row; j++) rack.push({ num: k++, x: head.x + row * 1.95, y: head.y + (j - row / 2) * 2.25 });
  let t = settle(tk, 0, [{ num: 0, x: 20, y: 19.5 }, ...rack]);
  for (let i = 1; i <= 4; i++) { look(tk, t, [{ num: 0, x: 20 + i * 9, y: 19.5, moving: true }, ...rack], false); t += 0.1; }
  // the head ball leaves first, the rest scatter a look later
  look(tk, t, [{ num: 0, x: 56, y: 19.5, moving: true }, { ...rack[0], x: rack[0].x + 5, moving: true }, ...rack.slice(1)], false); t += 0.1;
  const out = rack.map((b, i) => ({ ...b, x: Math.min(74, b.x + 6 + i * 2), y: Math.min(36, Math.max(3, b.y + (i % 2 ? 9 : -9))) }));
  const from = rack.map((b, j) => j ? b : { ...b, x: b.x + 5 }); // the head ball is already 5 in on its way
  for (let i = 1; i <= 6; i++) { look(tk, t, [{ num: 0, x: 56 - i, y: 19.5, moving: true }, ...from.map((b, j) => ({ num: b.num, x: b.x + (out[j].x - b.x) * i / 6, y: b.y + (out[j].y - b.y) * i / 6, moving: true }))], false); t += 0.1; }
  settle(tk, t, [{ num: 0, x: 50, y: 19.5 }, ...out], 3);
  assert.strictEqual(tk.S.shots.length, 1, JSON.stringify(tk.S.events.filter(e => e.k !== 'named').slice(-8)));
  // here the reader was sure of the racked balls, so the head ball was named before it was hit
  assert.strictEqual(tk.S.shots[0].break, true); assert.strictEqual(tk.S.shots[0].firstNum, 1); assert.strictEqual(tk.S.shots[0].cueNum, 0);
  const n = names(tk); assert.ok([0, 1, 2, 3, 4, 5, 6].every(i => n[i]), JSON.stringify(n));
});

test('touching balls: a sure read still counts, each number once', () => {
  const tk = makeTracker(P), balls = [{ num: 3, x: 40, y: 20 }, { num: 6, x: 42.25, y: 20 }];
  settle(tk, 0, balls);
  const n = names(tk); assert.ok(n[3] && n[6], JSON.stringify(n));
});

test('a break on an unread rack: the first ball stays unknown rather than take whatever its track ends on', () => {
  const tk = makeTracker(P), rack = [], unsure = n => ({ p: probs(n, 0.45), kind: 'unsure' });
  let k = 1; for (let row = 0; row < 3; row++) for (let j = 0; j <= row; j++) rack.push({ num: k++, x: 58 + row * 1.95, y: 19.5 + (j - row / 2) * 2.25, ...unsure(k - 1) });
  let t = settle(tk, 0, [{ num: 0, x: 20, y: 19.5 }, ...rack]);
  for (let i = 1; i <= 4; i++) { look(tk, t, [{ num: 0, x: 20 + i * 9, y: 19.5, moving: true }, ...rack], false); t += 0.1; }
  look(tk, t, [{ num: 0, x: 56, y: 19.5, moving: true }, { ...rack[0], x: rack[0].x + 5, moving: true }, ...rack.slice(1)], false); t += 0.1;
  const out = rack.map((b, i) => ({ num: b.num, x: Math.min(74, b.x + 6 + i * 2), y: Math.min(36, Math.max(3, b.y + (i % 2 ? 9 : -9))) }));
  const from = rack.map((b, j) => j ? b : { ...b, x: b.x + 5 });
  for (let i = 1; i <= 6; i++) { look(tk, t, [{ num: 0, x: 56 - i, y: 19.5, moving: true }, ...from.map((b, j) => ({ num: b.num, x: b.x + (out[j].x - b.x) * i / 6, y: b.y + (out[j].y - b.y) * i / 6, moving: true }))], false); t += 0.1; }
  settle(tk, t, [{ num: 0, x: 50, y: 19.5 }, ...out], 3);
  assert.strictEqual(tk.S.shots.length, 1); assert.strictEqual(tk.S.shots[0].break, true); assert.strictEqual(tk.S.shots[0].firstNum, null);
  const n = names(tk); assert.ok([0, 1, 2, 3, 4, 5, 6].every(i => n[i]), 'named once spread: ' + JSON.stringify(n));
});

// The owner's phone looked every 0.23 s (V3.0.1, Oct 27). At that pace two looks never spanned the 0.3 s a ball must hold
// still, so stopped balls stayed "rolling" and shots ran on for 20-40 s.
test('at the phone\'s look rate (0.23 s) a shot ends soon after the balls stop', () => {
  const tk = makeTracker(P), cue = { x: 15, y: 15 }, three = { x: 50, y: 26 };
  const others = () => [{ num: 5, x: 30, y: 33 }, { num: 9, x: 62, y: 8 }];
  let t = settle(tk, 0, [{ num: 0, ...cue }, { num: 3, ...three }, ...others()], 3, 0.23);
  t = playShot(tk, t, cue, three, others, { dt: 0.23 });
  assert.strictEqual(tk.S.shots.length, 1, JSON.stringify(tk.S.events.filter(e => e.k !== 'named').slice(-8)));
  const sh = tk.S.shots[0]; assert.ok(sh.t1 - sh.t0 < 6, 'shot lasted ' + (sh.t1 - sh.t0).toFixed(1) + ' s');
  assert.deepStrictEqual(sh.made.map(m => m.num), [3]);
});

test('a ball lost for a moment at a pocket and seen again is rolling, not "going in": the shot ends, no false pocket', () => {
  const tk = makeTracker(P), others = [{ num: 4, x: 40, y: 30 }];
  let t = settle(tk, 0, [{ num: 0, x: 60, y: 8 }, ...others], 3, 0.23);
  // the cue ball rolls toward the bottom-right corner, vanishes twice near it, and stops 5 in short of the pocket
  const path = [[64, 6], [68, 4.5], null, [71, 3.5], null, [72, 3.2], [72.3, 3.1], [72.3, 3.1], [72.3, 3.1], [72.3, 3.1]];
  for (const p of path) { look(tk, t, (p ? [{ num: 0, x: p[0], y: p[1], moving: true }] : []).concat(others), false); t += 0.23; }
  settle(tk, t, [{ num: 0, x: 72.3, y: 3.1 }, ...others], 3, 0.23);
  assert.strictEqual(tk.S.shots.length, 1); assert.deepStrictEqual(tk.S.shots[0].made, []); assert.deepStrictEqual(tk.S.gone, []);
  const cue = tk.balls().find(b => b.num === 0); assert.ok(cue && cue.state === 'rest', JSON.stringify(cue && cue.state));
});

test('the owner\'s V3.0.1 session (Oct 26, 23:12) replayed: every shot ends within 8 s, nothing called in while it sits there', () => {
  const { replay } = require('../tools/v3/replay.js');
  const d = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures/v3/session-20261026-2312.json'), 'utf8')), tk = replay(d);
  assert.ok(tk.S.shots.length >= 6, 'shots: ' + tk.S.shots.length); // live V3.0.1 merged them into 4 that ran 11-40 s
  for (const s of tk.S.shots) assert.ok(s.t1 - s.t0 <= 8, 'shot ' + s.n + ' lasted ' + (s.t1 - s.t0).toFixed(1) + ' s');
  assert.ok(!tk.S.events.some(e => e.k === 'pocketed' && tk.S.events.some(f => f.k === 'back' && f.key === e.key && f.t > e.t - 3 && f.t < e.t)), 'a ball seen again was then called in');
});

test('a ball by a pocket that vanishes the look the cue ball reaches it was knocked in (Oct 27: the 6, 3 in from the corner)', () => {
  const tk = makeTracker(P), others = [{ num: 8, x: 18.7, y: 36 }, { num: 3, x: 20.7, y: 13.3 }];
  let t = settle(tk, 0, [{ num: 0, x: 44, y: 10.9 }, { num: 6, x: 74.5, y: 35.4 }, ...others], 3, 0.25);
  // the cue ball at about 45 in/s; the 6 is gone the look it gets there, and the cue ball comes back off the end rail
  const cue = [[51.9, 17.2], [66.5, 28.5], [75.9, 32.8], [72.4, 30.6], [69.8, 28.8], [66.8, 26.9], [64.1, 24.9], [61.8, 23.3], [60.5, 22.4], [60, 22], [60, 22]];
  cue.forEach(([x, y], i) => { look(tk, t, [{ num: 0, x, y, moving: true }, ...(i < 2 ? [{ num: 6, x: 74.5, y: 35.4 }] : []), ...others], true, 0.1); t += 0.25; });
  settle(tk, t, [{ num: 0, x: 60, y: 22 }, ...others], 4, 0.25);
  assert.strictEqual(tk.S.shots.length, 1, JSON.stringify(tk.S.events.filter(e => e.k !== 'named').slice(-10)));
  assert.deepStrictEqual(tk.S.shots[0].made.map(m => [m.num, m.pocket]), [[6, 5]]); assert.strictEqual(tk.S.shots[0].scratch, false);
});

test('the cue ball into the 4 faster than it was rolling: no swap, the 4 goes in, not the cue ball (Oct 27, 3:52)', () => {
  const tk = makeTracker(P), others = [{ num: 5, x: 67.3, y: 24.8 }, { num: 7, x: 20.6, y: 13.2 }, { num: 6, x: 52.6, y: 3.1 }];
  let t = settle(tk, 0, [{ num: 0, x: 60.6, y: 27.6 }, { num: 4, x: 33.9, y: 12.2 }, ...others], 3, 0.25);
  // the owner's looks: the 4 is knocked toward the bottom-left corner (0, 0) and gone after two looks; the cue ball rolls on to 42, 2.7
  const cue = [[50.8, 21.8], [36.1, 12.1], [37.2, 10.4], [38.3, 8.7], [39.3, 7], [40.1, 5.8], [40.7, 4.7], [41.5, 3.6], [42, 2.7], [42, 2.7]], four = [[33.9, 12.2], [28.7, 10], [15.2, 5.2]];
  cue.forEach(([x, y], i) => { look(tk, t, [{ num: 0, x, y, moving: true }, ...(four[i] ? [{ num: 4, x: four[i][0], y: four[i][1], moving: i > 0 }] : []), ...others], true, 0.1); t += 0.25; });
  settle(tk, t, [{ num: 0, x: 42, y: 2.7 }, ...others], 4, 0.25);
  assert.strictEqual(tk.S.shots.length, 1, JSON.stringify(tk.S.events.filter(e => e.k !== 'named').slice(-10)));
  const sh = tk.S.shots[0]; assert.deepStrictEqual(sh.made.map(m => m.num), [4]); assert.strictEqual(sh.scratch, false); assert.strictEqual(sh.firstNum, 4);
});

test('the owner\'s V3.0.2 session (Oct 26, 23:50) replayed against the pictures: 17 of 18 shots right, nothing called in that was not', () => {
  const { score } = require('../tools/v3/score.js');
  const r = score(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures/v3/session-20261026-2350.json'), 'utf8')));
  // the one left: the 8 at 7:37, sent out of sight behind the cue ball and never seen again. Live V3.0.2 got 11 right.
  assert.strictEqual(r.shots, 18); assert.ok(r.right >= 17, JSON.stringify(r.rows.filter(x => !x.right))); assert.strictEqual(r.falsePots, 0);
});
