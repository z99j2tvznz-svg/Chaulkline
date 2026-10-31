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

// ---- V3.0.4: ghosts, one-look jumps, balls lying in a pocket ----
const settleE = (tk, t0, balls, secs, dt, empty) => { let t = t0; for (; t < t0 + secs; t += dt) tk.update(t, balls.map(b => ({ x: b.x, y: b.y, px: b.x * 12, py: b.y * 12, r: 13, score: 0.8, p: probs(b.num), kind: 'sure' })), { read: true, empty }); return t; };

test('a struck ball gone before the next look is not left as a ghost: its spot shows bare cloth, so it went in that shot', () => {
  const tk = makeTracker(P), others = [{ num: 5, x: 30, y: 33 }];
  let t = settleE(tk, 0, [{ num: 0, x: 20, y: 20 }, { num: 8, x: 40, y: 20 }, ...others], 3, 0.25, () => true);
  // the cue ball rolls into the 8; the 8 is never seen again (gone toward the far corner between looks); the cue ball stops
  for (const x of [24, 29, 34, 37, 38, 38.5, 38.5, 38.5]) { t = settleE(tk, t, [{ num: 0, x, y: 20 }, ...(x < 34 ? [{ num: 8, x: 40, y: 20 }] : []), ...others], 0.25, 0.25, () => true); }
  settleE(tk, t, [{ num: 0, x: 38.5, y: 20 }, ...others], 5, 0.25, () => true);
  assert.strictEqual(tk.S.shots.length, 1, JSON.stringify(tk.S.events.filter(e => e.k !== 'named').slice(-8)));
  assert.deepStrictEqual(tk.S.shots[0].made.map(m => m.num), [8]); assert.ok(!tk.balls().some(b => b.num === 8), 'no ghost of the 8');
  assert.deepStrictEqual(tk.S.notes.map(n => n.num), [8]);
});

test('the same ball hidden behind the player (its spot not cloth) stays where it was, with its name', () => {
  const tk = makeTracker(P), others = [{ num: 5, x: 30, y: 33 }];
  let t = settleE(tk, 0, [{ num: 0, x: 20, y: 20 }, { num: 8, x: 60, y: 20 }, ...others], 3, 0.25, () => true);
  t = settleE(tk, t, [{ num: 0, x: 20, y: 20 }, ...others], 6, 0.25, (x, y) => Math.hypot(x - 60, y - 20) < 3 ? false : true);
  const b8 = tk.balls().find(b => b.num === 8); assert.ok(b8 && b8.state === 'hidden', JSON.stringify(b8 && b8.state));
  assert.strictEqual(tk.S.shots.length, 0);
});

test('a ball taken off by hand with no shot since is cleared, not called in', () => {
  const tk = makeTracker(P);
  let t = settleE(tk, 0, [{ num: 0, x: 20, y: 20 }, { num: 4, x: 50, y: 25 }], 3, 0.25, () => true);
  t = settleE(tk, t, [{ num: 0, x: 20, y: 20 }], 4, 0.25, () => true);
  assert.ok(!tk.balls().some(b => b.num === 4)); assert.strictEqual(tk.S.shots.length, 0); assert.ok(tk.S.events.some(e => e.k === 'cleared' && e.num === 4));
});

// the cloth check can't see bare cloth under a ball: true everywhere but within 2 in of (cx, cy)
const clothBut = (cx, cy) => (x, y) => Math.hypot(x - cx, y - cy) >= 2;
test('a ball gone unseen whose spot another ball then sits on is in, not a hidden ball on top of it (Oct 30: the 5 under the 9)', () => {
  const tk = makeTracker(P), others = [{ num: 9, x: 60, y: 30 }];
  let t = settleE(tk, 0, [{ num: 0, x: 20, y: 20 }, { num: 5, x: 40, y: 20 }, ...others], 3, 0.25, () => true);
  // the cue ball rolls into the 5, the 5 is never seen again, the cue ball stops 1 in from where the 5 sat
  for (const x of [24, 29, 34, 37, 38.5, 39, 39, 39]) t = settleE(tk, t, [{ num: 0, x, y: 20 }, ...(x < 34 ? [{ num: 5, x: 40, y: 20 }] : []), ...others], 0.25, 0.25, clothBut(39, 20));
  t = settleE(tk, t, [{ num: 0, x: 39, y: 20 }, ...others], 6, 0.25, clothBut(39, 20));
  assert.strictEqual(tk.S.shots.length, 1);
  assert.deepStrictEqual(tk.S.shots[0].made.map(m => m.num), [5], JSON.stringify(tk.S.events.filter(e => e.k !== 'named').slice(-6)));
  assert.ok(!tk.balls().some(b => b.num === 5), 'no hidden 5 on the cue ball');
});

test('before the break a hidden ball next to another is left alone: in a rack two touching balls can be found as one', () => {
  const tk = makeTracker(P);
  // racking: a hand covers the 5 and slides balls about; the 3 ends against it (found 1.2 in off, as one spot can be)
  const cue = { num: 0, x: 20, y: 20 };
  let t = settleE(tk, 0, [cue, { num: 5, x: 40, y: 20 }, { num: 3, x: 46, y: 20 }, { num: 4, x: 50, y: 30 }, { num: 6, x: 55, y: 10 }], 3, 0.25, () => true);
  t = settleE(tk, t, [cue, { num: 3, x: 46, y: 20 }, { num: 4, x: 50, y: 30 }, { num: 6, x: 55, y: 10 }], 1, 0.25, () => false);
  for (let k = 1; k <= 4; k++) t = settleE(tk, t, [cue, { num: 3, x: 46 - 1.2 * k, y: 20 }, { num: 4, x: 50 + 3 * k, y: 30 }, { num: 6, x: 55 + 3 * k, y: 10 }], 0.25, 0.25, () => false);
  t = settleE(tk, t, [cue, { num: 3, x: 41.2, y: 20 }, { num: 4, x: 62, y: 30 }, { num: 6, x: 67, y: 10 }], 5, 0.25, clothBut(41.2, 20));
  const b5 = tk.balls().find(b => b.num === 5); assert.ok(b5 && b5.state === 'hidden', JSON.stringify(b5 && b5.state));
  assert.strictEqual(tk.S.shots.length, 0);
});

test('the cue ball that jumps 20 in between two looks and stops starts a shot (Oct 27: the 5 at 5:58)', () => {
  const tk = makeTracker(P), others = [{ num: 9, x: 34, y: 6 }, { num: 7, x: 67, y: 21 }];
  let t = settleE(tk, 0, [{ num: 0, x: 30, y: 9 }, { num: 5, x: 53, y: 24 }, ...others], 3, 0.25, () => true);
  t = settleE(tk, t, [{ num: 0, x: 51, y: 23 }, { num: 5, x: 53.2, y: 24.4 }, ...others], 0.25, 0.25, () => true);
  t = settleE(tk, t, [{ num: 0, x: 50, y: 25 }, ...others], 0.25, 0.25, () => true);
  t = settleE(tk, t, [{ num: 0, x: 49, y: 27 }, ...others], 0.25, 0.25, () => true);
  settleE(tk, t, [{ num: 0, x: 48, y: 28 }, ...others], 5, 0.25, () => true);
  assert.strictEqual(tk.S.shots.length, 1, JSON.stringify(tk.S.events.filter(e => e.k !== 'named').slice(-8)));
  assert.deepStrictEqual(tk.S.shots[0].made.map(m => m.num), [5]); assert.strictEqual(tk.S.shots[0].scratch, false);
});

test('a ball seen lying in a far pocket is not a ball on the table: the ball that went there is in, not "back"', () => {
  const tk = makeTracker(P, { bags: [{ i: 5, ax: 75.8, ay: 33.5, bx: 73.3, by: 27.1 }] });
  let t = settleE(tk, 0, [{ num: 0, x: 40, y: 20 }, { num: 7, x: 63, y: 19 }], 3, 0.25);
  const path = [[[46, 20], [63, 19]], [[52, 20], [63, 19]], [[58, 19.5], [63, 19]], [[60, 19], [67, 26]], [[61, 19], [72, 32]], [[61.5, 19], [75.5, 37]], [[62, 19]], [[62, 19]]];
  for (const p of path) { tk.update(t, p.map(q => ({ x: q[0], y: q[1], px: q[0] * 12, py: q[1] * 12, r: 13, score: 0.8, p: null })), { read: false }); t += 0.25; }
  // from now on the 7 shows up dimly in the pocket, mapped to 76, 33 (score 0.4)
  for (let i = 0; i < 20; i++) { tk.update(t, [{ x: 62, y: 19, px: 744, py: 228, r: 13, score: 0.8, p: probs(0), kind: 'sure' }, { x: 76, y: 33, px: 912, py: 396, r: 13, score: 0.4, p: probs(7), kind: 'sure' }], { read: true }); t += 0.25; }
  assert.strictEqual(tk.S.shots.length, 1); assert.deepStrictEqual(tk.S.shots[0].made.map(m => [m.num, m.pocket]), [[7, 5]]);
  assert.ok(!tk.S.events.some(e => e.k === 'back'), 'no "back"'); assert.ok(!tk.balls().some(b => b.num === 7));
});

test('the owner\'s V3.0.3 session (Oct 27, 22:27) replayed with the cloth check on its pictures: 39 of 41 shots right, nothing called in that was not', () => {
  const { score } = require('../tools/v3/score.js');
  const r = score(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures/v3/session-20261027-2227.json'), 'utf8')));
  // live V3.0.3: 28 of these 41 right, 13 balls in missed, 1 false scratch
  assert.strictEqual(r.shots, 41); assert.ok(r.right >= 39, JSON.stringify(r.rows.filter(x => !x.right))); assert.strictEqual(r.falsePots, 0);
});

test('a ball knocked across the table and found again unnamed is not called in by the ghost rule (Oct 27: the 3 in a scratch shot)', () => {
  const tk = makeTracker(P), sp = (num, x, y, p = 0.85, kind = 'sure') => ({ x, y, px: x * 12, py: y * 12, r: 13, score: 0.8, p: probs(num, p), kind });
  let t = settleE(tk, 0, [{ num: 0, x: 40, y: 15 }, { num: 3, x: 24, y: 30 }, { num: 8, x: 60, y: 20 }], 3, 0.25, () => true);
  // the cue ball rolls up to the 3 and stops; the 3 is never seen moving and turns up on the near rail, read unsure
  for (const [x, y] of [[36, 19], [31, 23], [27, 27], [26.5, 27.5], [26.5, 27.5]]) { tk.update(t, [sp(0, x, y), ...(x > 30 ? [sp(3, 24, 30)] : []), sp(8, 60, 20)], { read: true, empty: () => true }); t += 0.25; }
  for (let i = 0; i < 32; i++) { tk.update(t, [sp(0, 26.5, 27.5), sp(8, 60, 20), sp(3, 30, 2.5, 0.4, 'unsure')], { read: true, empty: () => true }); t += 0.25; }
  assert.strictEqual(tk.S.shots.length, 1);
  assert.ok(!tk.S.shots[0].made.some(m => m.num === 3), 'the 3 was called in: ' + JSON.stringify(tk.S.events.filter(e => e.k !== 'named').slice(-8)));
});

test('the owner\'s V3.0.4 session (Oct 27, 23:38) replayed: all 31 real shots right, and the cue ball is named again by itself after every scratch', () => {
  const { score } = require('../tools/v3/score.js'), { replay } = require('../tools/v3/replay.js');
  const d = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures/v3/session-20261027-2338.json'), 'utf8'));
  const r = score(d); assert.ok(r.right >= 31, JSON.stringify(r.rows.filter(x => !x.right))); assert.strictEqual(r.falsePots, 0);
  // without the owner's taps: after each real scratch the cue ball put back gets its name from the reader (live V3.0.4
  // left it "?" for the rest of the rack)
  const tk = replay(d, null, null, { noActions: true }), E = tk.S.events;
  for (const t of [184.2, 323.6]) assert.ok(E.some(e => e.k === 'named' && e.num === 0 && e.t > t && e.t < t + 20), 'cue ball not named again after ' + t);
});

// ---- V3.0.6: hard hits (Oct 28): the reader is sure of most rolling balls, so a sure read ties a lost ball to its spot ----
const spR = (num, x, y, kind = 'sure', p = 0.85) => ({ x, y, px: x * 12, py: y * 12, r: 13, score: 0.8, p: probs(num, p), kind });

test('a hard hit: the cue ball, unseen behind the cue, reaches the 8 before the next look; the 8 is lost and found 40 in away, read "8"', () => {
  const tk = makeTracker(P);
  let t = settleE(tk, 0, [{ num: 0, x: 70, y: 10 }, { num: 8, x: 10, y: 12 }, { num: 9, x: 25, y: 24 }], 3, 0.25, () => true);
  // the cue ball behind the player's hand for a while
  for (let i = 0; i < 8; i++) { tk.update(t, [spR(8, 10, 12), spR(9, 25, 24)], { read: true }); t += 0.25; }
  // struck: next look it is where the 8 was, and the 8 is gone; then the cue ball rolls off the cushion and the 8 shows up
  // rolling back along the near cushion, 50 in away
  const looks = [[spR(0, 10.5, 12.5), spR(9, 25, 24)], [spR(0, 3, 19), spR(9, 25, 24)], [spR(0, 10, 23), spR(9, 25, 24)], [spR(0, 18, 26), spR(9, 25, 24), spR(8, 70, 4)],
    [spR(0, 25, 30), spR(9, 25, 24), spR(8, 58, 4, 'unsure')], [spR(0, 32, 33), spR(9, 25, 24), spR(8, 48, 4)], [spR(0, 36, 34), spR(9, 25, 24), spR(8, 40, 4)], [spR(0, 38, 33), spR(9, 25, 24), spR(8, 35, 4)]];
  for (const L of looks) { tk.update(t, L, { read: true }); t += 0.25; }
  for (let i = 0; i < 16; i++) { tk.update(t, [spR(0, 38.5, 33), spR(9, 25, 24), spR(8, 33, 4)], { read: true }); t += 0.25; }
  assert.strictEqual(tk.S.shots.length, 1); const sh = tk.S.shots[0];
  assert.strictEqual(sh.cueNum, 0, 'the shot was followed as the 8 struck'); assert.deepStrictEqual(sh.made, []); assert.ok(!sh.scratch);
  const n = names(tk); assert.ok(n[8] && Math.abs(n[8][0] - 33) <= 1 && n[0] && Math.abs(n[0][0] - 38) <= 1, JSON.stringify(n));
});

test('a ball hit hard off a cushion is still the same ball: the prediction comes back off the cushion', () => {
  const tk = makeTracker(P);
  let t = settleE(tk, 0, [{ num: 0, x: 30, y: 20 }, { num: 4, x: 60, y: 30 }], 3, 0.25, () => true);
  // the cue ball at 55 in/s straight at the near cushion and back up (reads off: blurred), the 4 still
  const path = [[30, 20], [30, 6.3], [30, 9.8], [30, 23.5], [30, 33], [30, 35.5], [30, 36], [30, 36], [30, 36], [30, 36]];
  const keys = new Set();
  for (const [x, y] of path) { tk.update(t, [{ x, y, px: x * 12, py: y * 12, r: 13, score: 0.8, p: null, kind: null }, spR(4, 60, 30)], { read: false }); t += 0.25; for (const b of tk.balls()) if (Math.abs(b.x - x) < 1 && Math.abs(b.y - y) < 1) keys.add(b.key); }
  for (let i = 0; i < 12; i++) { tk.update(t, [spR(0, 30, 36), spR(4, 60, 30)], { read: true }); t += 0.25; }
  assert.strictEqual(keys.size, 1, 'the cue ball was lost at the cushion and followed as something new');
  assert.strictEqual(tk.S.shots.length, 1); assert.deepStrictEqual(tk.S.shots[0].made, []);
});

test('a finger on the screen shakes every ball a little for a look: not a shot', () => {
  const tk = makeTracker(P), balls = [{ num: 0, x: 69, y: 19 }, { num: 8, x: 8, y: 11 }, { num: 2, x: 10, y: 36 }, { num: 9, x: 14, y: 27 }];
  let t = settleE(tk, 0, balls, 3, 0.25, () => true);
  tk.touched(); tk.update(t, [spR(0, 69.6, 19.8), spR(8, 7.4, 11.8), spR(2, 9, 37), spR(9, 13.4, 27.8)], { read: true }); t += 0.25;
  for (let i = 0; i < 12; i++) { tk.update(t, balls.map(b => spR(b.num, b.x, b.y)), { read: true }); t += 0.25; }
  assert.strictEqual(tk.S.shots.length, 0);
});

test('the owner\'s V3.0.5 session (Oct 28, 17:10, 8-ball practice, rack 2 hit hard) replayed: all 25 real shots right, no false pot or scratch', () => {
  const { score } = require('../tools/v3/score.js');
  const r = score(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures/v3/session-20261028-1710.json'), 'utf8')));
  // live V3.0.5: 22 of the 25 right (the 8 and the cue ball called in on a bank shot, the 9 and the cue ball after a hard hit,
  // the 8 into the corner missed); a tap to rename the 9 counted as a shot
  assert.strictEqual(r.shots, 25); assert.ok(r.right >= 25, JSON.stringify(r.rows.filter(x => !x.right))); assert.strictEqual(r.falsePots, 0);
  assert.ok(r.extraShots <= 3, 'extra shots ' + r.extra);
});

test('the owner\'s V3.0.6 session (Oct 28, 18:08, one rack of 8-ball practice) replayed: all 14 real shots right, as live', () => {
  const { score } = require('../tools/v3/score.js');
  const r = score(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures/v3/session-20261028-1808.json'), 'utf8')));
  assert.strictEqual(r.shots, 14); assert.strictEqual(r.right, 14, JSON.stringify(r.rows.filter(x => !x.right))); assert.strictEqual(r.falsePots, 0);
});

test('a shot\'s "before" keeps where each ball rested, so the cue ball\'s path can start where it was struck from', () => {
  const tk = makeTracker(P);
  let t = settleE(tk, 0, [{ num: 0, x: 20, y: 20 }, { num: 3, x: 50, y: 20 }], 3, 0.25, () => true);
  for (const x of [26, 33, 40, 46.5, 46.5, 46.5, 46.5, 46.5, 46.5, 46.5, 46.5]) { tk.update(t, [spR(0, x, 20), spR(3, x > 46 ? 60 : 50, 20)], { read: true }); t += 0.25; }
  const b = tk.S.shots[0].before.find(q => q.num === 0); assert.ok(Math.abs(b.rx - 20) < 0.5 && Math.abs(b.x - 26) < 0.5, JSON.stringify(b));
});

test('which way the table runs comes from the outline\'s shape through the lens (Oct 29: from the end rail it was turned)', () => {
  global.D2R = global.D2R || Math.PI / 180; const { rotByShape } = require('../src/v3/cloth.js'), f = W => 0.72 * W;
  // sideways at the side rail (the owner's outlines): corners 0-1 are a long rail
  for (const q of [[[453, 523], [1412, 523], [1629, 759], [199, 771]], [[459.7, 373.3], [1493, 373.3], [1751.5, 662.5], [214.4, 662.5]]]) { const r = rotByShape(q, 1920, 1080, f(1920)); assert.strictEqual(r.rot, 0); assert.ok(Math.abs(r.ratio - 2) < 0.1, r.ratio); }
  // upright at the end rail (Oct 29, corners set by hand, and the automatic outline): corners 0-1 are a short rail
  for (const q of [[[318.3, 816], [673.4, 818.5], [921.3, 1337.2], [104.7, 1326.5]], [[293.3, 824.6], [731.9, 833.5], [1022.4, 1366.4], [32, 1366.8]]]) assert.strictEqual(rotByShape(q, 1080, 1920, f(1920)).rot, 1);
});

test('the owner\'s V3.0.9 session (Oct 29, 17:02, 4 racks sideways) replayed: the 9 hit hard no longer turns into a scratch', () => {
  const { score } = require('../tools/v3/score.js');
  const r = score(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures/v3/session-20261029-1702.json'), 'utf8')));
  // live V3.0.9: 46 of 51 right; three times the 9 going in was called a scratch (the cue ball and 9 tracks swapped)
  assert.strictEqual(r.shots, 51); assert.ok(r.right >= 48, JSON.stringify(r.rows.filter(x => !x.right))); assert.strictEqual(r.falsePots, 0);
});

test('the owner\'s V3.0.10 session (Oct 29, 17:50, 3 racks upright at the end rail) replays without losing ground', () => {
  const { score } = require('../tools/v3/score.js');
  const r = score(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures/v3/session-20261029-1750.json'), 'utf8')));
  // live V3.0.10: 42 of 44 right. The replay scores lower (37): this log keeps only "sure" or "unsure" for each read, not
  // how sure, and a replay makes every sure read 90%; from V3.0.11 the log keeps the reader's shares
  assert.strictEqual(r.shots, 44); assert.ok(r.right >= 37, JSON.stringify(r.rows.filter(x => !x.right))); assert.ok(r.falsePots <= 2);
});

test('the owner\'s V3.0.12 session (Oct 30, 18:21, 2 racks, the reader\'s shares logged) replays close to live', () => {
  const { score } = require('../tools/v3/score.js');
  const r = score(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'fixtures/v3/session-20261030-1821.json'), 'utf8')));
  // live V3.0.12: 26 of 28 right, nothing called in that was not
  assert.ok(r.right >= 25, JSON.stringify(r.rows.filter(x => !x.right))); assert.ok(r.falsePots <= 1);
});
