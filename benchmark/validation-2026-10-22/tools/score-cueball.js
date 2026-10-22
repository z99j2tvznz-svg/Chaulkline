// Scores the cue-ball tests against the player's tape measurements, exactly as ../PREREGISTRATION.md fixes it.
//   node score-cueball.js <truth json> <A out> <B out> <C out> <D out>      (outs = cueball.js results; "-" = not recorded)
// truth json: { "cloth": [length, width] (in, cushion nose to cushion nose),
//   "A": [{"id":"A1","L":10,"N":9.5}, ...], "B": [{"id":"B1","R":18,"N":9,"in":true}, ...],
//   "C": [{"id":"C1","gap":2.5,"touched":"no"}, ...], "D": [{"id":"D1","group":"soft","L":40,"N":19,"rails":0}, ...] }
// Measurements are cushion nose to the nearest ball edge; rail letters L R N F = left, right, near, far. "skip" events
// are simply left out of the list.
const fs = require('fs');
const [tPath, ...outs] = process.argv.slice(2), T = JSON.parse(fs.readFileSync(tPath, 'utf8'));
const run = outs.map(p => p && p !== '-' ? JSON.parse(fs.readFileSync(p, 'utf8')) : null);
const R = 1.125, [CL, CW] = T.cloth, SYS = [78, 39], ZONE_R = 4.5, BORDER = 0.5, CONTACT = 0.5;
// truth centre in real inches, x from the left cushion, y from the near cushion
const centre = m => ({ x: m.L != null ? m.L + R : CL - R - m.R, y: m.N != null ? m.N + R : CW - R - m.F });
// system position scaled from the assumed 78 x 39 to the measured cloth (unscaled kept too)
const scaled = p => ({ x: p.x * CL / SYS[0], y: p.y * CW / SYS[1] });
const med = a => { const s = a.slice().sort((u, v) => u - v), n = s.length; return n ? (n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const stats = e => e.length ? { n: e.length, mean: +(e.reduce((a, b) => a + b, 0) / e.length).toFixed(2), median: +med(e).toFixed(2), worst: +Math.max(...e).toFixed(2) } : { n: 0 };
const region = c => (c.x < 1.5 * R + 0.5 || c.x > CL - 1.5 * R - 0.5 || c.y < 1.5 * R + 0.5 || c.y > CW - 1.5 * R - 0.5) ? 'cushion' : Math.hypot(c.x - CL / 2, c.y - CW / 2) < 6 ? 'centre' : c.y < CW / 2 ? 'near half' : 'far half';
const res = { cloth: T.cloth, scaledFrom: SYS };

// position errors for one matched pair
function err(truth, sys) { const s = scaled(sys); return { truth: { x: +truth.x.toFixed(2), y: +truth.y.toFixed(2) }, system: { x: +s.x.toFixed(2), y: +s.y.toFixed(2) },
  error: +Math.hypot(s.x - truth.x, s.y - truth.y).toFixed(2), errorUnscaled: +Math.hypot(sys.x - truth.x, sys.y - truth.y).toFixed(2), region: region(truth) }; }

// A: still periods in order, one per placement. A still period that matches no placement is reported, never dropped
// silently: the placements are matched in order to the steady still periods that are not the ball in the hand
if (run[0] && T.A) {
  const st = run[0].stills.filter(s => s.steady), rows = [];
  let k = 0;
  for (const a of T.A) {
    const c = centre(a);
    // the next steady still period within 6 in of the measured spot; periods skipped on the way are reported
    let j = k; while (j < st.length && Math.hypot(scaled(st[j]).x - c.x, scaled(st[j]).y - c.y) > 6) j++;
    if (j >= st.length) { rows.push({ id: a.id, truth: c, found: false }); continue; }
    rows.push({ id: a.id, ...err(c, st[j]), skippedStills: j - k }); k = j + 1;
  }
  res.A = { rows, all: stats(rows.filter(r => r.error != null).map(r => r.error)),
    byRegion: Object.fromEntries(['near half', 'far half', 'centre', 'cushion'].map(g => [g, stats(rows.filter(r => r.region === g && r.error != null).map(r => r.error))])) };
}

// B to D: shots in order; the k-th listed event is matched to the k-th system shot. Extra shots = false, missing = missed
function shotsFor(i, list) {
  const sh = run[i] ? run[i].shots : [], rows = list.map((e, k) => ({ e, s: sh[k] || null }));
  return { rows, detected: Math.min(sh.length, list.length), missed: Math.max(0, list.length - sh.length), false: Math.max(0, sh.length - list.length),
    complete: sh.slice(0, list.length).filter(s => s.complete).length, restFound: sh.slice(0, list.length).filter(s => s.rest).length };
}
if (run[1] && T.B) {
  const m = shotsFor(1, T.B), Z = T.zone ? centre(T.zone) : { x: 6 * CL / 8, y: CW / 2 };
  const rows = m.rows.map(({ e, s }) => {
    const c = centre(e), d = Math.hypot(c.x - Z.x, c.y - Z.y), r = { id: e.id, truthDist: +d.toFixed(2), truthIn: d <= ZONE_R, playerIn: e.in, borderline: Math.abs(d - ZONE_R) <= BORDER };
    if (!s || !s.rest) return { ...r, system: null };
    const q = err(c, s.rest), sd = Math.hypot(q.system.x - Z.x, q.system.y - Z.y);
    return { ...r, ...q, systemDist: +sd.toFixed(2), systemIn: sd <= ZONE_R, travelTruth: e.fromS != null ? e.fromS : null, pathLength: s.pathLength };
  });
  const clear = rows.filter(r => r.system !== null && !r.borderline);
  res.B = { detected: m.detected, missed: m.missed, false: m.false, complete: m.complete, rows, restError: stats(rows.filter(r => r.error != null).map(r => r.error)),
    distanceError: stats(rows.filter(r => r.systemDist != null).map(r => Math.abs(r.systemDist - r.truthDist))),
    zone: { correct: clear.filter(r => r.systemIn === r.truthIn).length, wrong: clear.filter(r => r.systemIn !== r.truthIn).length, borderline: rows.filter(r => r.borderline).length },
    spreadTruth: stats(rows.map(r => r.truthDist)) };
}
if (run[2] && T.C) {
  const m = shotsFor(2, T.C), Rail = CL - R;
  const rows = m.rows.map(({ e, s }) => {
    const r = { id: e.id, gapTruth: e.gap, touchedTruth: e.touched };
    if (!s) return { ...r, system: null };
    const gapSys = s.rest ? +(Rail - scaled(s.rest).x).toFixed(2) : null;
    const sysTouched = s.closest.right != null && s.closest.right * CL / SYS[0] <= CONTACT;
    return { ...r, gapSystem: gapSys, gapError: gapSys != null ? +Math.abs(gapSys - e.gap).toFixed(2) : null, touchedSystem: sysTouched, closestRight: s.closest.right, complete: s.complete, gaps: s.gaps };
  });
  const sure = rows.filter(r => r.touchedSystem != null && (r.touchedTruth === 'yes' || r.touchedTruth === 'no'));
  res.C = { detected: m.detected, missed: m.missed, false: m.false, complete: m.complete, rows, gapError: stats(rows.filter(r => r.gapError != null).map(r => r.gapError)),
    contact: { correct: sure.filter(r => r.touchedSystem === (r.touchedTruth === 'yes')).length, wrong: sure.filter(r => r.touchedSystem !== (r.touchedTruth === 'yes')).length, playerUnsure: rows.filter(r => r.touchedTruth === 'unsure').length } };
}
if (run[3] && T.D) {
  const m = shotsFor(3, T.D);
  const rows = m.rows.map(({ e, s }) => { const c = centre(e), r = { id: e.id, group: e.group, railsTruth: e.rails };
    return !s || !s.rest ? { ...r, system: null } : { ...r, ...err(c, s.rest), v0: s.v0, duration: s.duration, pathLength: s.pathLength, complete: s.complete, gaps: s.gaps.length }; });
  const by = g => rows.filter(r => r.group === g && r.system !== null), rng = (a, k) => a.length ? [Math.min(...a.map(r => r[k])), Math.max(...a.map(r => r[k]))] : null;
  const groups = Object.fromEntries(['soft', 'medium', 'firm'].map(g => [g, { v0: rng(by(g).filter(r => r.v0 != null), 'v0'), pathLength: rng(by(g), 'pathLength'), duration: rng(by(g), 'duration') }]));
  // separated: the soft, medium and firm ranges do not overlap, in that order
  const sep = k => { const a = ['soft', 'medium', 'firm'].map(g => groups[g][k]); return a.every(Boolean) && a[0][1] < a[1][0] && a[1][1] < a[2][0]; };
  res.D = { detected: m.detected, missed: m.missed, false: m.false, complete: m.complete, rows, restError: stats(rows.filter(r => r.error != null).map(r => r.error)), groups,
    separated: { v0: sep('v0'), pathLength: sep('pathLength'), duration: sep('duration') } };
}
process.stdout.write(JSON.stringify(res, null, 1));
