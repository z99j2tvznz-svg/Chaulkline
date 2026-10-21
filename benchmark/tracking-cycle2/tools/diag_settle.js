// Cycle 2 diagnostic (read-only): for every real-shot clip whose after look is "not settled" under v0.6, what was moving
// in the last second: each moving track's speed, how far it really travelled over the last second, how long before the
// clip end the table was last moving, and whether the table had a still second earlier after the shot.
//   node diag_settle.js <dets root (6 session folders)> <truth dir> <out.json>
const fs = require('node:fs'), path = require('node:path');
const { makeTracker } = require('../exp/tools/tracker.js');
const [ROOT, TRUTH, OUT] = process.argv.slice(2);
const SESS = { 'v04-oct16': '2026-10-16_evening_V2.3.3', 'v04-firstspot': '2026-10-17_2151_V2.3.3_firstspot', 'v04-otherside': '2026-10-17_1500_V2.3.3_otherside',
  'rec-20261017-1730': 'rec-20261017-1730', 'rec-20261018-2310': 'rec-20261018-2310', 'rec-20261019-1710': 'rec-20261019-1710' };
const rows = [];
for (const [d, t] of Object.entries(SESS)) {
  const TJ = JSON.parse(fs.readFileSync(path.join(TRUTH, t + '.json'), 'utf8'));
  for (const f of fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.json')).sort()) {
    const clip = f.slice(0, -5), T = TJ.clips[clip] || {}; if (!(T.shot || (T.more && T.more.length))) continue;
    const D = JSON.parse(fs.readFileSync(path.join(ROOT, d, f), 'utf8')), tr = makeTracker(D.table, { version: 'v0.6' }), mv = [];
    for (const fr of D.frames) { tr.step(fr); mv.push(tr.movingTracks().map(k => ({ id: k.id, x: k.x, y: k.y, path: k.path.slice(-40) }))); }
    const res = tr.finish(), end = D.frames[D.frames.length - 1].t, ai = D.frames.map((fr, i) => i).filter(i => D.frames[i].t >= end - 1.0);
    const moving = ai.filter(i => mv[i].length);
    if (!moving.length) continue;
    const ids = [...new Set(moving.flatMap(i => mv[i].map(k => k.id)))];
    const tracks = ids.map(id => {
      const k = res.tracks.find(x => x.id === id) || {}, live = tr.tracks.find(x => x.id === id);
      const p = live.path.filter(q => q[0] >= end - 1.0), net = p.length > 1 ? Math.hypot(p[p.length - 1][1] - p[0][1], p[p.length - 1][2] - p[0][2]) : 0;
      let len = 0; for (let i = 1; i < p.length; i++) len += Math.hypot(p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]);
      const p2 = live.path.filter(q => q[0] >= end - 0.3), net2 = p2.length > 1 ? Math.hypot(p2[p2.length - 1][1] - p2[0][1], p2[p2.length - 1][2] - p2[0][2]) : 0;
      return { id, ball: k.ball, at: [+live.x.toFixed(1), +live.y.toFixed(1)], netLast1s: +net.toFixed(2), pathLast1s: +len.toFixed(2), netLast03s: +net2.toFixed(2), framesMoving: moving.filter(i => mv[i].some(m => m.id === id)).length };
    });
    const lastMovingAt = D.frames[moving[moving.length - 1]].t, firstMovingInLook = D.frames[moving[0]].t;
    // longest still stretch after the first shot (does a still table exist earlier, after the shot?)
    const shotT = res.shots.length ? res.shots[0].t : 0; let best = 0, run0 = null;
    D.frames.forEach((fr, i) => { if (fr.t < shotT + 1) return; if (!mv[i].length) { if (run0 == null) run0 = fr.t; best = Math.max(best, fr.t - run0); } else run0 = null; });
    rows.push({ session: d, clip, seconds: +end.toFixed(2), shots: res.shots.map(s => +s.t.toFixed(2)), lookFrames: ai.length, movingFrames: moving.length,
      secondsStillAtEnd: +(end - lastMovingAt).toFixed(2), firstMovingInLook: +(end - firstMovingInLook).toFixed(2), longestStillAfterShot: +best.toFixed(2), tracks, madeAfterClip: T.madeAfterClip || [] });
  }
}
fs.writeFileSync(OUT, JSON.stringify(rows, null, 1));
for (const r of rows) console.log(r.session.padEnd(18), r.clip.padEnd(9), 'len', r.seconds, 'movingFrames', r.movingFrames + '/' + r.lookFrames, 'stillAtEnd', r.secondsStillAtEnd, 'longestStill', r.longestStillAfterShot,
  r.tracks.map(k => `[${k.ball ?? '?'} net1s ${k.netLast1s} path ${k.pathLast1s} net.3 ${k.netLast03s} @${k.at}]`).join(' '), r.madeAfterClip.length ? 'MADE-AFTER ' + r.madeAfterClip : '');
