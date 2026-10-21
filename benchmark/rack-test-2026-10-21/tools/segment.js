// Cut one continuous rack's detections into per-shot pieces, using only the system's own shot starts, so the unchanged
// Cycle 2 rack scorer (one shot per clip) can score a continuous recording. Truth is never read here.
//   node segment.js <rack detections .json> <tracker options json> <out dir> [--cut settle]
// One tracker pass over the whole rack finds the shot starts s1..sn. Piece k runs from (s_k - 0.3 - PRE) to
// (s_{k+1} - 0.3), so its last second is the still table just before the next shot and its start includes the still
// table before its own shot; the first piece starts at the beginning, the last ends at the end of the recording.
// Times are kept as in the recording. --cut settle instead ends piece k one still second after its shot settles (the
// first moment after s_k + 1 s with no ball moving for the last 1.0 s), so its after look is the table just after the
// balls stop rather than while the player gets down for the next shot; never later than s_{k+1} - 0.3.
const fs = require('node:fs'), path = require('node:path');
const { makeTracker } = require('../../tracking-cycle2/exp/tools/tracker.js');
const args = process.argv.slice(2), SETTLE = args.includes('--cut') && args[args.indexOf('--cut') + 1] === 'settle';
const [DET, OPTS, OUT] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--cut'), PRE = 3.0, GAP = 0.3, STILL = 1.0;
const d = JSON.parse(fs.readFileSync(DET, 'utf8')), opts = JSON.parse(OPTS); delete opts.x; delete opts.absence;
const tr = makeTracker(d.table, opts), moving = []; for (const fr of d.frames) { tr.step(fr); moving.push(tr.moving()); }
const shots = tr.finish().shots.map(s => +s.t.toFixed(2)), end = d.frames[d.frames.length - 1].t;
fs.mkdirSync(OUT, { recursive: true });
const settleAfter = s => { let still = null; for (let i = 0; i < d.frames.length; i++) { const t = d.frames[i].t; if (t < s + 1) continue;
  if (moving[i]) still = null; else if (still == null) still = t; else if (t - still >= STILL) return t; } return end; };
const pieces = shots.map((s, k) => { const next = k + 1 < shots.length ? shots[k + 1] - GAP : end;
  return { from: k ? s - GAP - PRE : 0, to: SETTLE ? Math.min(next, settleAfter(s)) : next, shot: s }; });
if (!pieces.length) pieces.push({ from: 0, to: end, shot: null });
pieces.forEach((p, k) => {
  const name = 'clip' + String(k + 1).padStart(3, '0');
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify({ ...d, piece: p, frames: d.frames.filter(f => f.t >= p.from && f.t <= p.to) }));
});
fs.writeFileSync(path.join(OUT, 'pieces.json'), JSON.stringify({ shots, pieces }, null, 1));
console.log(shots.length + ' system shots at ' + shots.join(', '));
