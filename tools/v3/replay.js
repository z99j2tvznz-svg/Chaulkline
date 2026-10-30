// Replay the looks of a V3 debug log (log.json, or a tests/fixtures/v3/session-*.json) through src/track.js and print the
// shots. The log keeps each spot's table position, number and kind, not the reader's 11 probabilities, so those are rebuilt
// (sure: 0.9 on the number; unsure: 0.5; not a ball: 0.8 not-a-ball). Shot timing and pocket calls depend on positions only.
// usage: node tools/v3/replay.js <log.json> [--events]
const fs = require('fs'), path = require('path');
const { makeP } = require(path.join(__dirname, '../../src/core.js')), { makeTracker } = require(path.join(__dirname, '../../src/track.js'));
// The player's actions during the session (New rack, taps) are applied at their times: a tap renames the ball nearest to
// where it was tapped, "Not a ball" and "It went in" go to the ball with the number the live app had on it.
function actions(d) {
  const ev = (d.events || []).filter(e => ['new_rack', 'tap', 'tap_not', 'tap_pocketed'].includes(e.k)), tev = (d.tracker || []).filter(e => e.k === 'not_ball' || e.k === 'tap_pocketed');
  let i = 0; return ev.map(e => (e.k === 'tap_not' || e.k === 'tap_pocketed') ? { ...e, num: (tev[i++] || {}).num } : e);
}
function replay(d, ft, opts, o2) {
  const P = makeP(ft || (d.header && d.header.ft) || 7), tk = makeTracker(P, opts), acts = (o2 && o2.noActions) ? [] : actions(d);
  // where a ball lying in a pocket shows up, from the camera in the log's header (as the app does once the table is set)
  const h = d.header; if (h && h.quad && h.picture) {
    global.D2R = global.D2R || Math.PI / 180; const { makeCam } = require(path.join(__dirname, '../../src/core.js')), V = require(path.join(__dirname, '../../src/vision.js')), { L, Wd } = V.tableDims(h.ft || 7);
    tk.setBags(require(path.join(__dirname, '../../src/v3/cloth.js')).pocketBags(makeCam(V.tableCornersFor(h.rot || 0, L, Wd), h.quad, h.picture[0], h.picture[1], (h.lens || 0.86) * Math.max(h.picture[0], h.picture[1]), [h.picture[0] / 2, h.picture[1] / 2]), P));
  }
  const apply = a => {
    if (a.k === 'new_rack') return tk.newRack();
    tk.touched(); // a tap on the screen (the app tells the tracker on every touch)
    const bs = tk.S.tracks.filter(tr => tr.ok && tr.state !== 'gone' && tr.state !== 'dropped');
    if (a.k === 'tap') { let b = null, bd = 3; for (const tr of bs) { const q = Math.hypot(tr.x - a.at[0], tr.y - a.at[1]); if (q < bd) { bd = q; b = tr; } } if (b) tk.pin(b.key, a.num); return; }
    const b = bs.find(tr => tr.num === a.num); if (!b) return;
    if (a.k === 'tap_not') tk.notBall(b.key); else tk.inPocket(b.key);
  };
  const emp = o2 && o2.empty ? o2.empty : (!o2 || !o2.noEmpty) && d.cloth ? require('./photos.js').emptyFromMaps(d.cloth) : null;
  const probs = (n, k) => { const q = new Array(11).fill(0); if (k === 'n') { q[10] = 0.8; q[n] = 0.2; return q; } const top = k === 's' ? 0.9 : 0.5; q.fill((1 - top - 0.01) / 9); q[n] = top; q[10] = 0.01; return q; };
  for (const L of d.looks) {
    while (acts.length && acts[0].t <= L[0]) apply(acts.shift());
    const spots = L[5].map(([x, y, num, kind, score]) => ({ x, y, px: x * 20, py: y * 20, r: 13.5, score, kind: kind === 's' ? 'sure' : kind === 'u' ? 'unsure' : kind === 'n' ? 'not_a_ball' : null, p: num == null ? null : probs(num, kind) }));
    // the log has no camera frames: the bare-cloth check uses the shot pictures' cloth maps kept in the fixture (photos.js)
    tk.update(L[0] / 1000, spots, { read: spots.some(s => s.p), empty: emp ? emp(L[0] / 1000) : null });
  }
  return tk;
}
if (require.main === module) {
  const tk = replay(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  for (const s of tk.S.shots) console.log('shot', s.n, (s.t1 - s.t0).toFixed(1) + ' s', 'made', s.made.map(m => m.num), s.scratch ? 'scratch' : '', 'first', s.firstNum);
  if (process.argv.includes('--events')) for (const e of tk.S.events) if (e.k !== 'named' && e.k !== 'ball') console.log(JSON.stringify(e));
}
module.exports = { replay };
