// Cushion-filter diagnostic (read-only). Inputs: a detections folder made with `clip-detect.js --rejected` (so each
// clip has clipNNN-rejected.json: the detector boxes the pocket and cushion rules threw away, read by the same number
// reader). Reports:
//  1. the rejected boxes, split by how far outside the cushion line they map and whether the reader calls them a ball
//  2. for every analysed frame where a tracked ball was moving but not seen (the frozen tracker, default settings):
//     a kept detection near where it could be (association failure), only a rejected box there (filter), a pocket
//     nearby (it dropped), or nothing at all (detector miss)
//   node tools/experiments/cushion-diag.js <detections folder with -rejected files> [--out file.json]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { makeTracker } = require('../tracker.js');
const DIR = process.argv[2], oi = process.argv.indexOf('--out'), OUT = oi > 0 ? process.argv[oi + 1] : null;
const L = 78, W = 39, R = 1.125, PK = [[0, 0], [L / 2, -0.6], [L, 0], [0, W], [L / 2, W + 0.6], [L, W]];
const outside = b => Math.max(0.6 * R - b.x, b.x - (L - 0.6 * R), 0.6 * R - b.y, b.y - (W - 0.6 * R), 0);   // inches past the line
const band = d => d <= 1 ? '0-1 in' : d <= 3 ? '1-3 in' : d <= 10 ? '3-10 in' : 'over 10 in';
const CATS = ['association', 'newTrack', 'takenByOther', 'cushionOnly', 'pocketFilterOnly', 'dropped', 'detectorMiss'];
const rej = { total: 0, byWhy: {}, cushion: {} }, gaps = { movingFrames: 0, seen: 0, association: 0, takenByOther: 0, newTrack: 0, cushionOnly: 0, pocketFilterOnly: 0, dropped: 0, detectorMiss: 0 }, perClip = {};
for (const f of fs.readdirSync(DIR).filter(f => /^clip\d+\.json$/.test(f)).sort()) {
  const clip = f.replace('.json', ''), d = JSON.parse(fs.readFileSync(path.join(DIR, f))), RJ = JSON.parse(fs.readFileSync(path.join(DIR, clip + '-rejected.json')));
  for (const fr of RJ) for (const b of fr) {
    rej.total++; rej.byWhy[b.why] = (rej.byWhy[b.why] || 0) + 1;
    if (b.why !== 'cushion') continue;
    const k = band(outside(b)), ball = b.nb != null && b.nb < 0.5 ? 'reader: ball' : 'reader: not a ball';
    rej.cushion[k] = rej.cushion[k] || {}; rej.cushion[k][ball] = (rej.cushion[k][ball] || 0) + 1;
  }
  const tr = makeTracker(d.table, { trace: true }); for (const fr of d.frames) tr.step(fr); const r = tr.finish();
  const pc = perClip[clip] = { movingFrames: 0, seen: 0, association: 0, takenByOther: 0, newTrack: 0, cushionOnly: 0, pocketFilterOnly: 0, dropped: 0, detectorMiss: 0 };
  // which detections some track took, per frame
  const taken = d.frames.map(() => new Map()), born = new Map(r.trace.tracks.map(t => [t.id, t.born]));
  for (const t of r.trace.tracks) for (const [tt, det] of t.samples) if (det >= 0) taken[Math.round(tt * d.fps)].set(det, t.id);
  for (const t of r.trace.tracks.filter(t => t.isBall)) {
    let on = false, last = null, prev = null;
    const lastSeenT = Math.max(...t.samples.filter(x => x[1] >= 0).map(x => x[0]));
    for (const [tt, det, , st, x, y] of t.samples) {
      if (st === 'moving') on = true; else if (st === 'resting' || st === 'pocketed' || st === 'gone') on = false;
      if (det >= 0) { prev = last; last = [tt, x, y]; }
      if (!on) continue;
      pc.movingFrames++;
      if (det >= 0) { pc.seen++; continue; }
      const after = tt > lastSeenT;   // never seen again from here (pocketed, or lost for good)
      if (after) pc.afterLast = (pc.afterLast || 0) + 1;
      const was = { ...pc };
      const f = Math.round(tt * d.fps), dt = tt - last[0], sp = prev && last[0] > prev[0] ? Math.hypot(last[1] - prev[1], last[2] - prev[2]) / (last[0] - prev[0]) : 0;
      const reach = Math.min(30, 4 + 1.2 * sp * dt), near = b => Math.hypot(b.x - last[1], b.y - last[2]) < reach;
      // other tracks' or no track's detections near where this ball could be: the tracker did not join them to it
      // a detection nobody took near where this ball could be: the tracker did not join it (association failure);
      // only detections other tracks took: hidden behind or merged with another ball, or the other track is wrong
      if (d.frames[f].balls.some((b, i) => near(b) && !taken[f].has(i))) pc.association++;
      // ...by a track started after this ball was last seen: the same ball carried on under a new track (identity break)
      else if (d.frames[f].balls.some((b, i) => near(b) && born.get(taken[f].get(i)) > last[0] - 1e-6)) pc.newTrack++;
      else if (d.frames[f].balls.some(near)) pc.takenByOther++;
      else if ((RJ[f] || []).some(b => b.why === 'cushion' && near(b))) pc.cushionOnly++;
      else if ((RJ[f] || []).some(b => b.why === 'pocket' && near(b))) pc.pocketFilterOnly++;
      else if (PK.some(p => Math.hypot(p[0] - last[1], p[1] - last[2]) < 6)) pc.dropped++;
      else pc.detectorMiss++;
      for (const k of CATS) if (pc[k] !== was[k]) { const b = after ? 'afterLast' : 'gapThenSeen'; pc[b + ':' + k] = (pc[b + ':' + k] || 0) + 1; }
    }
  }
  for (const k of Object.keys(pc)) gaps[k] = (gaps[k] || 0) + pc[k];
}
const unseen = gaps.movingFrames - gaps.seen, pct = v => (100 * v / unseen).toFixed(1) + '%';
console.log('rejected boxes', rej.total, JSON.stringify(rej.byWhy)); console.log('cushion rejects by distance past the line:', JSON.stringify(rej.cushion));
console.log(`moving-ball frames ${gaps.movingFrames}, seen ${gaps.seen} (${(100 * gaps.seen / gaps.movingFrames).toFixed(1)}%), not seen ${unseen}:`);
console.log(`  of the not-seen frames, ${gaps.afterLast} (${pct(gaps.afterLast)}) come after the ball's last sighting (it never comes back)`);
console.log('  split:', JSON.stringify(Object.fromEntries(Object.entries(gaps).filter(([k]) => k.includes(':')).sort())));
for (const k of ['association', 'newTrack', 'takenByOther', 'cushionOnly', 'pocketFilterOnly', 'dropped', 'detectorMiss']) console.log(`  ${k}: ${gaps[k]} (${pct(gaps[k])})`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ rejected: rej, gaps, perClip }, null, 1));
