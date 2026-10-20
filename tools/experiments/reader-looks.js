// Diagnostic (read only, Oct 20, 2026): what happens to each real ball in the settled-table looks, split the way the
// calibration experiment needs it. Runs tracker v0.6 and takes the same start and end looks as tools/score-racks.js.
// Per look with a known true table, the balls on the table that are not named right are shared out by count (truth
// has no positions):
//   1 rejected: a steady spot the reader called "not a ball" (the look drops it)
//   2 unnamed: a spot the look kept but could not name (reader unsure, or a surer spot took the number)
//   3 wrong: a spot named with a number that is not on the table
//   4 absent: no steady spot at all (not detected, filtered, flickering, hidden)
// plus extra: kept spots beyond the true count (non-balls the look accepted) and named right.
// True tables: verified rack inventories; with --scripted also the recorder's scripted layouts (not eye-checked, flagged).
//   node tools/experiments/reader-looks.js [--scripted] [--skip clip,clip] <dets>:<truth> [...] [--out file.json]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { makeTracker } = require('../tracker.js');
const { observe, BALLS, OBS } = require('../reconcile.js');
const argv = process.argv.slice(2), take = k => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null; };
const OUT = take('--out'), SKIP = new Set((take('--skip') || '').split(',').filter(Boolean));
const SCRIPTED = argv.includes('--scripted'); if (SCRIPTED) argv.splice(argv.indexOf('--scripted'), 1);
const T0 = 1.5, T1 = 0.2, LOOK = 1.0;
const yes = v => typeof v === 'string' && v.startsWith('yes');

function looks(file, T) {
  const d = JSON.parse(fs.readFileSync(file, 'utf8'));
  const frames = T.settleEnd != null ? d.frames.filter(fr => fr.t <= T.settleEnd) : d.frames;
  const tr = makeTracker(d.table, { version: 'v0.6' }), moving = [];
  for (const fr of frames) { tr.step(fr); moving.push(tr.moving()); }
  const r = tr.finish(), shotT = r.shots.length ? r.shots[0].t : null, end = frames[frames.length - 1].t;
  const bf = shotT != null ? frames.filter(fr => fr.t >= shotT - T0 && fr.t <= shotT - T1) : frames.filter(fr => fr.t <= LOOK);
  const ai = frames.map((_, i) => i).filter(i => frames[i].t >= end - LOOK), af = ai.map(i => frames[i]);
  return { before: bf.length >= 5 ? { obs: observe(bf), frames: bf } : null, after: { obs: observe(af), frames: af, settled: !ai.some(i => moving[i]) } };
}
// the look's grouping again, keeping what observe() throws away
function groups(frames) {
  const gs = [];
  for (const fr of frames) for (const b of fr.balls) {
    let g = null, gd = OBS.group;
    for (const c of gs) { const e = Math.hypot(b.x - c.x, b.y - c.y); if (e < gd) { gd = e; g = c; } }
    if (!g) { g = { x: b.x, y: b.y, n: 0, f: new Set(), nb: 0, nbN: 0 }; gs.push(g); }
    g.x = (g.x * g.n + b.x) / (g.n + 1); g.y = (g.y * g.n + b.y) / (g.n + 1); g.n++; g.f.add(fr.t); if (b.nb != null) { g.nb += b.nb; g.nbN++; }
  }
  return { rejected: gs.filter(g => g.f.size >= OBS.share * frames.length && g.nbN && g.nb / g.nbN >= OBS.nb).length };
}
function split(look, inv) {
  const on = [...inv], o = look.obs, N = on.length, C = on.filter(n => o.named[n]).length;
  const wrongSpots = o.balls.filter(b => b.num != null && !inv.has(b.num)).length, unnamedSpots = o.unnamed, rejectedSpots = groups(look.frames).rejected;
  let M = N - C; const take = k => { const v = Math.min(k, M); M -= v; return v; };
  const wrong = take(wrongSpots), unnamed = take(unnamedSpots), rejected = take(rejectedSpots), absent = M;
  const extra = Math.max(0, o.balls.length - N);
  return { N, named: C, rejected, unnamed, wrong, absent, extra, right: C === N && !wrongSpots };
}

const rows = [];
for (const pair of argv) {
  const [dir, truth] = pair.split(':'), TJ = JSON.parse(fs.readFileSync(truth, 'utf8')), session = path.basename(truth, '.json');
  const racks = TJ.racks || Object.keys(TJ.clips).sort().map(c => ({ name: c, clips: [c], start: TJ.clips[c].layout && TJ.clips[c].layout.length ? TJ.clips[c].layout : null, scripted: true }));
  for (const rack of racks) {
    let inv = new Set(rack.start || []);
    for (const c of rack.clips) {
      const T = TJ.clips[c] || {};
      for (const b of T.offCameraBefore || []) inv.delete(b);
      if (!inv.has(0) && rack.start && rack.start.includes(0)) inv.add(0);
      const before = new Set(inv), made = (T.made || []).concat(T.madeAfterClip || []), unsure = new Set(T.unsureBalls || []);
      for (const b of made) inv.delete(b);
      const after = new Set(inv);
      const ok = rack.start && (yes(T.verify && T.verify.state) || (SCRIPTED && rack.scripted && T.layout && T.layout.length && !T.shot));
      const f = path.join(dir, c + '.json');
      if (!ok || SKIP.has(c) || !fs.existsSync(f)) continue;
      const L = looks(f, T), strip = s => new Set([...s].filter(n => !unsure.has(n)));
      const base = { session, clip: c, step: T.step || null, scripted: !!rack.scripted };
      if (L.before) rows.push({ ...base, look: 'start', ...split(L.before, strip(before)) });
      if (L.after.settled) rows.push({ ...base, look: 'end', ...split(L.after, strip(after)) });
    }
  }
}
const K = ['N', 'named', 'rejected', 'unnamed', 'wrong', 'absent', 'extra', 'right'];
const sum = rs => Object.fromEntries(K.map(k => [k, rs.reduce((a, r) => a + +r[k], 0)]).concat([['looks', rs.length]]));
const out = {};
for (const s of [...new Set(rows.map(r => r.session))]) for (const look of ['start', 'end']) {
  const rs = rows.filter(r => r.session === s && r.look === look); if (!rs.length) continue;
  out[s + ' ' + look] = sum(rs);
}
for (const look of ['start', 'end']) out['ALL ' + look] = sum(rows.filter(r => r.look === look));
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(42) + Object.entries(v).map(([a, b]) => a + ' ' + b).join(', '));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ summary: out, rows }, null, 1));
