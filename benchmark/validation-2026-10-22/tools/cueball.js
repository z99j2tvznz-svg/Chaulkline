// Cue-ball drill reader (evaluation tool, no perception changes): runs the Cycle 4 tracker exactly as configured on a
// recording with only the cue ball on the table and reports, per shot, the tracked path and, per still period, the
// ball's resting position. Nothing here is tuned on the validation footage; the rules are the ones in
// ../PREREGISTRATION.md.
//   node cueball.js <detections json> [--track '<track options json>'] > out.json
const fs = require('fs'), path = require('path');
const { makeTracker, edgeFrames } = require('../../cycle4/exp/tools/tracker.js');
const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf(k); return i < 0 ? null : argv.splice(i, 2)[1]; };
const DEF = path.join(__dirname, '..', '..', 'cycle4', 'results', 'cycle4-track-options.json');
const TRACK = JSON.parse(opt('--track') || fs.readFileSync(DEF, 'utf8'));
const det = JSON.parse(fs.readFileSync(argv[0], 'utf8')), [L, W] = det.table, R = 1.125;
const STILL_MIN = 1.0, STILL_SPREAD = 0.3, GAP = 0.2;

const frames = edgeFrames(det.table, det.frames, TRACK), tr = makeTracker(det.table, TRACK);
// per frame: where the cue ball is: the trusted track seen in this frame with the most cue-ball votes (with only the cue
// ball on the table there is at most one such track; on a rack this picks the cue ball, used only for smoke tests)
const seen = [];
for (const fr of frames) {
  tr.step(fr);
  const live = tr.tracks.filter(k => k.real && k.t === fr.t && k.state !== 'pocketed');
  const b = live.sort((a, c) => (c.votes[0] || 0) - (a.votes[0] || 0) || c.hits - a.hits)[0];
  seen.push({ t: fr.t, moving: tr.moving(), b: b ? { x: b.x, y: b.y, track: b.id } : null });
}
const out = tr.finish();

// still periods: the ball seen and not moving for at least STILL_MIN s, every sighting within STILL_SPREAD in of the median
const med = a => { const s = a.slice().sort((u, v) => u - v); return s[s.length >> 1]; };
const stills = [];
for (let i = 0; i < seen.length;) {
  if (seen[i].moving || !seen[i].b) { i++; continue; }
  let j = i; const pts = [];
  while (j < seen.length && !seen[j].moving) {
    if (seen[j].b) {
      const p = [seen[j].b.x, seen[j].b.y];
      if (pts.length >= 5) { const mx = med(pts.map(q => q[0])), my = med(pts.map(q => q[1])); if (Math.hypot(p[0] - mx, p[1] - my) > STILL_SPREAD * 3) break; }
      pts.push(p);
    }
    j++;
  }
  const from = seen[i].t, to = seen[j - 1].t;
  if (to - from >= STILL_MIN && pts.length >= 10) {
    const mx = med(pts.map(q => q[0])), my = med(pts.map(q => q[1]));
    const spread = med(pts.map(q => Math.hypot(q[0] - mx, q[1] - my)));
    stills.push({ from: +from.toFixed(2), to: +to.toFixed(2), x: +mx.toFixed(2), y: +my.toFixed(2), sightings: pts.length, spread: +spread.toFixed(2), steady: spread <= STILL_SPREAD });
  }
  i = j;
}

// shots: the tracked path from the shot start to the first still period after it
const shots = out.shots.map(s => {
  const rest = stills.find(st => st.from > s.t);
  const end = rest ? rest.from : seen[seen.length - 1].t;
  const pts = seen.filter(f => f.t >= s.t - 0.05 && f.t <= end && f.b).map(f => [f.t, f.b.x, f.b.y]);
  const gaps = [];
  for (let k = 1; k < pts.length; k++) if (pts[k][0] - pts[k - 1][0] > GAP) gaps.push([+pts[k - 1][0].toFixed(2), +(pts[k][0] - pts[k - 1][0]).toFixed(2)]);
  let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]);
  // frame-to-frame speeds (in/s) while the path has no gap; initial speed = median of the first 5
  const sp = [];
  for (let k = 1; k < pts.length; k++) { const dt = pts[k][0] - pts[k - 1][0]; if (dt > 0 && dt <= GAP) sp.push([+pts[k][0].toFixed(3), +(Math.hypot(pts[k][1] - pts[k - 1][1], pts[k][2] - pts[k - 1][2]) / dt).toFixed(1)]); }
  const moving = sp.filter(v => v[1] > 2);
  const v0 = moving.length >= 5 ? med(moving.slice(0, 5).map(v => v[1])) : null;
  // nearest approach to each cushion line (ball centre to cushion line minus a ball radius = gap to the cushion)
  const gap = (f) => pts.length ? +Math.min(...pts.map(f)).toFixed(2) : null;
  return { t: +s.t.toFixed(2), late: !!s.late, rest: rest ? { x: rest.x, y: rest.y, at: rest.from, steady: rest.steady } : null, duration: rest ? +(rest.from - s.t).toFixed(2) : null,
    sightings: pts.length, gaps, complete: !gaps.length, pathLength: +len.toFixed(1), v0, speeds: sp,
    closest: { left: gap(p => p[1] - R), right: gap(p => L - R - p[1]), near: gap(p => p[2] - R), far: gap(p => W - R - p[2]) } };
});
process.stdout.write(JSON.stringify({ input: argv[0], table: det.table, track: TRACK, shots, stills, notShot: out.events.filter(e => e.k === 'notShot') }, null, 1));
