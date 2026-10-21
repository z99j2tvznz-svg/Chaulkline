// Continuous-rack perception (cycle 3, offline, experimental). One pass over a whole rack recording, no hand-cut clips:
//   - the tracker (tracker.js) follows every ball through the whole recording once: shots, first ball, pocket losses;
//   - the table is looked at in each still stretch (nothing moved): the rack before the break, then after every shot,
//     up to the next shot. A ball seen clearly at any moment of a still stretch is still there when a hand or the body
//     covers it later (reconcile.js observe, period);
//   - the table state is carried S0 -> S1 -> ... with reconcile.js (pocket events, absence rule, guard);
//   - the rack start is completed at the first still table after the break: every ball seen there came from the rack,
//     plus every ball seen going in on the break; checked against the pack count from tools/rackprobe.py;
//   - every pocketed ball says how it is known: "observed entry" (lost inside a pocket mouth, with the pocket) or
//     "inferred from the table" (gone from a clear still table, pocket unknown). Pockets get the physical IDs P1-P6 once
//     the foot end is known (the end the rack was at); without it only the camera-relative pocket is given.
// Perception only: no game rule, no foul, no scoring. Plain JS, no dependencies.
//
//   node rack.js <whole-rack detections json> [--set 0,1,...,9] [--probe probe.json] [--opts '<json>'] [--out log.json]
// opts: { track: {tracker options}, pocketHold, period, whole, guard, probe } - see DEFAULTS; the baseline is
// { pocketHold: false, period: false, probe: false } (Cycle 2's look and pocket rules, run natively).
'use strict';
const fs = require('node:fs');
const { makeTracker, edgeFrames, TRACK_DEFAULTS } = require('./tracker.js');
const { observe, reconcile, newMemory, BALLS } = require('./reconcile.js');

const DEFAULTS = { track: { version: 'v0.6' }, pocketHold: true, period: true, whole: true, guard: true, probe: true, breakPots: false, breakTwoPass: false, minLater: 2, anonPockets: false,
  minStill: 1.0, gapBefore: 0.2, look: 1.0, creep: 0.75, minSeen: 0.8, hideGap: 0.5, moveFrom: 1.5, moveAway: 3, camShift: 1.5 };

// camera-relative pockets, the tracker's order: table x along the length (0 = the camera's left end for a side view),
// y across (0 = the camera's side). The table frame is a top view that is never mirrored (clip-detect / vision.js).
const POCKET_NAMES = ['near-left corner', 'near side', 'near-right corner', 'far-left corner', 'far side', 'far-right corner'];
// physical IDs, as seen from the head end looking at the foot end: P1 foot corner right, P2 foot corner left, P3 left
// side, P4 head corner left, P5 head corner right, P6 right side (Nackers 2026-10-21). Index = camera-relative pocket.
const PID = { x0: ['P2', 'P3', 'P4', 'P1', 'P6', 'P5'], xL: ['P5', 'P6', 'P1', 'P4', 'P3', 'P2'] };

function runRack(det, opts = {}) {
  const O = { ...DEFAULTS, ...opts, track: { ...DEFAULTS.track, ...(opts.track || {}) } };
  const [L, W] = det.table, frames = edgeFrames(det.table, det.frames, O.track);
  const tr = makeTracker(det.table, { ...O.track, ...(O.pocketHold ? { pocketHold: true } : {}), trace: true });
  const moving = [], hist = new Map();
  const lookFrames = [];
  for (const fr of frames) {
    tr.step(fr); moving.push(tr.moving()); lookFrames.push(tr.lookFrame(fr));
    for (const k of tr.tracks) if (k.real && k.t === fr.t) { let h = hist.get(k.id); if (!h) hist.set(k.id, h = []); h.push([fr.t, k.x, k.y]); }
  }
  const r = tr.finish(), shots = r.shots.slice().sort((a, b) => a.t - b.t), end = frames[frames.length - 1].t;
  // still stretches: runs of frames with no trusted ball moving, at least minStill s long
  const still = [];
  for (let i = 0; i < frames.length;) {
    if (moving[i]) { i++; continue; }
    let j = i; while (j + 1 < frames.length && !moving[j + 1]) j++;
    if (frames[j].t - frames[i].t >= O.minStill) still.push([i, j]);
    i = j + 1;
  }
  const OB = { ...(O.whole ? { whole: true } : {}), ...(O.period ? { period: { minSeen: O.minSeen, hideGap: O.hideGap, look: O.look } } : {}) };
  // the look for the gap (t0, t1): with period, the last still stretch inside it, from where it starts to t1; without,
  // the last `look` s before t1 (Cycle 2's look). settled: nothing moved in the last `look` s
  function lookIn(t0, t1) {
    const idx = frames.map((f, i) => i).filter(i => frames[i].t > t0 && frames[i].t <= t1);
    if (!idx.length) return null;
    const lastSec = idx.filter(i => frames[i].t >= t1 - O.look), settled = !lastSec.some(i => moving[i]);
    let use = lastSec;
    if (O.period && settled) {
      const s = still.filter(([a, b]) => frames[b].t > t0 && frames[a].t < t1).pop();
      if (s) {
        // a ball creeping to a stop below the moving speed: start once every ball is within `creep` in of where it ends up
        const ta = frames[s[0]].t, tb = Math.min(frames[s[1]].t, t1); let settle = ta;
        for (const h of hist.values()) { const p = h.filter(q => q[0] >= ta && q[0] <= tb); if (!p.length) continue; const f = p[p.length - 1];
          for (const q of p) if (Math.hypot(q[1] - f[1], q[2] - f[2]) > O.creep) settle = Math.max(settle, q[0]); }
        const u = idx.filter(i => i >= s[0] && i <= s[1] && frames[i].t > settle);
        if (u.length && frames[u[u.length - 1]].t - frames[u[0]].t >= O.look * 0.9) use = u;
      }
    }
    const o = observe(use.map(i => lookFrames[i]), OB); o.settled = settled; o.from = +frames[use[0]].t.toFixed(2); o.to = +frames[use[use.length - 1]].t.toFixed(2);
    return o;
  }
  // a ball rolled away from (x, y) between t0 and t1: some track passed within moveFrom of the spot and later was at
  // least moveAway from it (a ball only blocked from view did not move)
  const movedFrom = (t0, t1) => (x, y) => [...hist.values()].some(h => {
    let at = -1;
    for (const [t, px, py] of h) { if (t < t0 || t > t1) continue; const d = Math.hypot(px - x, py - y); if (d < O.moveFrom && at < 0) at = t; else if (at >= 0 && d >= O.moveAway) return true; }
    return false;
  });
  const pockets = TRACK_DEFAULTS.pockets || [[0, 0], [L / 2, -0.6], [L, 0], [0, W], [L / 2, W + 0.6], [L, W]];
  const nearest = (x, y) => pockets.map((p, i) => [Math.hypot(x - p[0], y - p[1]), i]).sort((a, b) => a[0] - b[0])[0];
  const pevAll = r.events.filter(e => e.k === 'pocket').map(e => {
    const k = r.tracks.find(x => x.id === e.track) || {}, [d, i] = k.x != null ? nearest(k.x, k.y) : [null, null];
    return { ball: k.ball ?? e.ball ?? null, x: k.x, y: k.y, t: +e.t.toFixed(2), jaws: !!e.jaws, inMouth: d != null && d < TRACK_DEFAULTS.pocketDist, pocket: i, dist: d, track: e.track };
  });
  // cycle 4 (anonEntries + anonPockets): a confirmed spot (seen 5+ times) lost while rolling inside a mouth is an entry with
  // no number. reconcile gives it to a missing ball only when it is the one missing ball and the one such entry
  if (O.anonPockets) for (const e of r.events) if (e.k === 'entry?' && e.real) pevAll.push({ ball: null, t: +e.t.toFixed(2), jaws: false, inMouth: true, pocket: e.pocket, dist: e.dist, track: e.track, anon: true });

  // orientation: the foot end is the end the rack (the pack) was at
  const probe = O.probe && O.probeData ? O.probeData : null, pack = probe && probe.packs && probe.packs[0] && probe.packs[0].isPack ? probe.packs[0] : null;
  const foot = pack ? pack.end : null;
  const pid = i => (foot && i != null ? PID[foot][i] : null);

  const log = { frames: frames.length, seconds: +end.toFixed(2), opts: { ...O, probeData: undefined }, orientation: foot ? { foot: foot === 'x0' ? 'camera-left end (x = 0)' : 'camera-right end (x = L)', from: 'rack position at the start', pack: pack && { centre: pack.centre, count: pack.count, match: pack.match } } : { foot: null, why: probe ? 'no pack found at the start' : 'no rack probe' },
    stillStretches: still.map(([a, b]) => [+frames[a].t.toFixed(2), +frames[b].t.toFixed(2)]), shots: [] };
  let mem = newMemory(O.set || BALLS);
  // S0: the rack look, the last still stretch before the first shot
  const t1 = shots.length ? shots[0].t - O.gapBefore : end;
  const rackLook = lookIn(-1, t1);
  // balls touching inside the pack are not read (the reader is unreliable on touching balls): present, name open
  if (rackLook && pack && O.packUnread !== false) for (const b of rackLook.balls) if (b.num != null && pack.grid.some(([x, y]) => Math.hypot(b.x - x, b.y - y) < 1.5)) {
    delete rackLook.named[b.num]; b.packRead = b.num; b.num = null; rackLook.unnamed++;
  }
  let prevLook = rackLook; const looks = [];
  if (rackLook) { const a = reconcile(mem, rackLook, { pockets: [], ...(O.guard ? { guard: true } : {}) }, 'rack'); mem = a.memory; log.rackLook = { from: rackLook.from, to: rackLook.to, seen: rackLook.balls.map(b => ({ num: b.num, x: b.x, y: b.y })), unresolved: a.trace.unresolved }; }
  shots.forEach((s, k) => {
    const next = k + 1 < shots.length ? shots[k + 1].t : null, lookEnd = next != null ? next - O.gapBefore : end;
    const pev = pevAll.filter(e => e.t >= s.t - 0.3 && (next == null || e.t < next - 0.3));
    const after = lookIn(s.t, lookEnd);
    const entry = { n: k + 1, t: +s.t.toFixed(2), first: s.first ?? null, look: after && { from: after.from, to: after.to, settled: after.settled, unnamed: after.unnamed, spots: after.balls.length },
      pocketEvents: pev.map(e => ({ ball: e.ball, t: e.t, pocket: e.pocket != null ? POCKET_NAMES[e.pocket] : null, inMouth: e.inMouth, jaws: e.jaws })), ...(s.late ? { lateStart: true } : {}) };
    looks.push(after);
    // break-pot accounting counts every spot either reader calls a ball (Challenger B's not-a-ball, nbB, when the input has
    // it): a ball on the rail that the frozen reader calls "not a ball" must not look like a ball gone
    if (k === 0 && O.breakPots && after) {
      const fi = frames.map((f, i) => i).filter(i => frames[i].t >= after.from && frames[i].t <= after.to);
      const incl = fi.map(i => ({ ...lookFrames[i], balls: lookFrames[i].balls.map(b => b.nbB != null && b.nbB < 0.5 && b.nb >= 0.5 ? { ...b, nb: b.nbB, rec: null, p: null, q: undefined } : b) }));
      log.breakLookAny = observe(incl, OB);
    }
    if (!after) { entry.note = 'no look before the next shot'; log.shots.push(entry); return; }
    const absence = prevLook ? { before: prevLook, movedFrom: movedFrom(s.t - 0.5, after.to) } : null;
    const b = reconcile(mem, after, { pockets: pev, ...(O.guard ? { guard: true } : {}), ...(absence ? { absence } : {}) }, 'after shot ' + (k + 1));
    mem = b.memory;
    entry.made = b.trace.confirmed.filter(c => c.change === 'pocketed').map(c => {
      const e = pev.find(p => p.ball === c.ball) || (c.absence ? null : pev.find(p => p.ball == null));
      return c.absence || !e ? { ball: c.ball, kind: 'inferred from the table', pocket: 'unknown', why: c.why }
        : { ball: c.ball, kind: 'observed entry', pocket: { camera: POCKET_NAMES[e.pocket], pid: log.cameraMoves ? 'unknown (the camera may have moved)' : pid(e.pocket) || 'unknown (orientation not known)', conf: e.jaws || e.dist < 3 ? 'high' : e.inMouth ? 'medium' : 'low' }, t: e.t };
    });
    entry.table = Object.fromEntries(Object.entries(mem.balls).map(([n, rec]) => {
      const seen = after.named[n];
      return [n, { status: rec.status, ...(seen ? { x: seen.x, y: seen.y } : {}), ...(seen && seen.hidden ? { hiddenSince: seen.lastSeen } : {}) }];
    }));
    entry.unresolved = b.trace.unresolved;
    // camera check: most balls are not touched by a shot and sit where they sat. If at least three balls named in both
    // looks, and at least 70% of them, all shifted the same way by more than camShift in, the phone has probably moved:
    // every table coordinate (and pocket ID) after this point is in doubt until the table is found again
    if (prevLook) {
      const d = [];
      for (const [n, p] of Object.entries(prevLook.named)) { const q = after.named[n]; if (q) d.push([q.x - p.x, q.y - p.y]); }
      const med = a => a.slice().sort((u, v) => u - v)[a.length >> 1], mx = d.length ? med(d.map(v => v[0])) : 0, my = d.length ? med(d.map(v => v[1])) : 0;
      if (d.length >= 3 && Math.hypot(mx, my) > O.camShift && d.filter(v => Math.hypot(v[0] - mx, v[1] - my) < 1).length >= 0.7 * d.length) {
        entry.cameraMoved = { shift: [+mx.toFixed(1), +my.toFixed(1)], balls: d.length }; (log.cameraMoves = log.cameraMoves || []).push({ shot: k + 1, shift: entry.cameraMoved.shift });
      }
    }
    if (k === 0) {
      // rack start completed at the first still table after the break
      const startBalls = {};
      for (const n of mem.set) {
        if (rackLook && rackLook.named[n]) startBalls[n] = 'seen and named at rack start';
        else if (O.probe && after.named[n]) startBalls[n] = 'came out of the rack on the break';
        else if (O.probe && entry.made.some(m => m.ball === n && m.kind === 'observed entry')) startBalls[n] = 'seen going in on the break';
        else startBalls[n] = 'not established';
      }
      const est = Object.values(startBalls).filter(v => v !== 'not established').length;
      let check = null;
      if (pack && rackLook) {
        // balls the rack look saw away from the pack (the cue ball) plus the pack's count
        const away = rackLook.balls.filter(b => !pack.grid.some(([x, y]) => Math.hypot(b.x - x, b.y - y) < 2.25)).length;
        check = { packCount: pack.count, seenAwayFromPack: away, expected: pack.count + away, established: est, agrees: pack.count + away === est };
      }
      log.start = { balls: startBalls, established: est, countCheck: check };
    }
    // second pass of breakPots: the break pots found by the first pass are out of play from the break on, so a later
    // ball gone can be matched to a pocket event by elimination (they no longer count as missing balls)
    if (k === 0 && O._breakIn) for (const n of O._breakIn) if (mem.balls[n] && mem.balls[n].status !== 'present') mem.balls[n] = { status: 'pocketed', why: 'pocketed on the break (inferred)' };
    log.shots.push(entry); prevLook = after;
  });
  if (O.breakPots) breakPots(log, looks, mem, r.events, shots);
  if (O.breakPots && O.breakTwoPass && !O._breakIn && log.breakPots.applied) {
    const again = runRack(det, { ...opts, _breakIn: log.breakPots.neverNamedLater });
    // keep the second pass only when it finds the same break pots (its own accounting is unchanged by construction)
    if (again.breakPots && again.breakPots.applied && JSON.stringify(again.breakPots.neverNamedLater) === JSON.stringify(log.breakPots.neverNamedLater)) { again.opts._breakIn = undefined; again.breakPots.twoPass = true; return again; }
    log.breakPots.twoPass = 'second pass disagreed: first pass kept';
  }
  if (log.breakLookAny) log.breakLookAny = { spots: log.breakLookAny.balls.length, named: Object.keys(log.breakLookAny.named).map(Number) };
  log.final = log.shots.length ? log.shots[log.shots.length - 1].table : null;
  return log;
}

// cycle 4 experiment breakPots (off by default): balls that went from the pack straight into a pocket on the break. Pack
// balls are not read (touching), so such a ball is never named and stays "not established" for the whole rack. It is
// counted pocketed on the break only when all of these agree (otherwise it stays open):
//   - the start count is known (pack count + balls away from the pack) and the first still table after the break is
//     settled; the balls missing from that table's spot count (every spot either reader calls a ball), less those seen
//     going in with their number, equal the balls never established; every unnamed spot there is a ball named later;
//   - the ball is never named in any later still table of the rack (at least minLater settled ones) and never seen
//     going in later with its number, so it was not simply hidden, unread or misread at the first look;
//   - something was seen entering a pocket mouth during the break (tracked or not). Entries are not counted per ball:
//     a ball flying out of the pack is often seen as several short spots, or not at all.
// The pocket stays unknown: the entries cannot be tied to numbers (candidate pockets are listed). Because it uses the
// whole rack, this is a hindsight result: every table from the break on is corrected when the rack has been seen.
function breakPots(log, looks, mem, events, shots) {
  const st = log.start && log.start.balls, cc = log.start && log.start.countCheck, a0 = looks[0];
  const res = { applied: false };
  log.breakPots = res;
  if (!st || !cc || !a0 || !shots.length) { res.why = 'no start count or no look after the break'; return; }
  const U = mem.set.filter(n => st[n] === 'not established');
  if (!U.length) { res.why = 'every ball established'; return; }
  // named in a later still table, or seen going in with its number later: it was on the table after the break
  const laterLooks = looks.slice(1).filter(Boolean), laterIn = n => log.shots.slice(1).some(e => (e.pocketEvents || []).some(p => p.ball === n));
  const namedLater = n => laterLooks.some(o => o.named[n]) || laterIn(n);
  const U2 = U.filter(n => !namedLater(n)), knownIn = mem.set.filter(n => st[n] === 'seen going in on the break').length;
  const any = log.breakLookAny || a0, gone = cc.expected - any.balls.length, settledLater = laterLooks.filter(o => o.settled).length;
  const t1 = shots.length > 1 ? shots[1].t : Infinity, bk = log.shots[0];
  const entries = events.filter(e => e.k === 'entry?' && e.t >= shots[0].t && e.t < t1), tracksIn = new Set(entries.map(e => e.track));
  const unmatched = (bk.pocketEvents || []).filter(e => e.ball == null || !bk.made || !bk.made.some(m => m.ball === e.ball)).length;
  Object.assign(res, { notEstablished: U, neverNamedLater: U2, startCount: cc.expected, spotsAfterBreak: any.balls.length, seenGoingIn: knownIn, gone,
    unnamedAfterBreak: any.balls.length - Object.keys(a0.named).length, laterSettledLooks: settledLater, entriesSeen: tracksIn.size + unmatched,
    candidatePockets: [...new Set(entries.map(e => POCKET_NAMES[e.pocket]))] });
  const checks = { settled: a0.settled !== false, count: U2.length >= 1 && gone - knownIn === U2.length, unnamed: any.balls.length - Object.keys(a0.named).length === U.length - U2.length,
    later: settledLater >= (log.opts.minLater || 2), entries: tracksIn.size + unmatched >= 1 };
  res.checks = checks;
  if (!Object.values(checks).every(Boolean)) { res.why = 'not every check agrees: left open'; return; }
  res.applied = true;
  for (const n of U2) st[n] = 'pocketed on the break (inferred)';
  for (const n of U.filter(n => !U2.includes(n))) st[n] = 'came out of the rack on the break (named later)';
  log.start.established = Object.values(st).filter(v => v !== 'not established').length; cc.established = log.start.established; cc.agrees = cc.expected === cc.established;
  const why = 'missing from the first still table after the break (count) and never seen in ' + settledLater + ' later still tables';
  bk.made = (bk.made || []).concat(U2.map(n => ({ ball: n, kind: 'inferred from the table', pocket: 'unknown', why, breakCount: true })));
  for (const e of log.shots) {
    if (!e.table) continue;
    for (const n of U2) if (e.table[n] && e.table[n].status !== 'present') e.table[n] = { status: 'pocketed', inferredBreakPot: true };
    if (e.unresolved) e.unresolved = e.unresolved.filter(u => !U2.includes(u.ball));
  }
}

// cycle 4 experiment: rack boundaries in one recording. During play the number of balls on the table never goes up
// (only the cue ball comes back, in hand). A re-rack puts the potted balls back. So a new rack is suspected where a still
// table holds at least riseBy more spots than the fewest seen on a still table since the last shot; the old rack ends
// where that low still table ends (cut). The suspicion is only accepted when a pack is then found before a break
// (tools/racks.py runs rackprobe.py on the still tables after the cut). This only proposes; racks.py decides.
function findRacks(det, opts = {}) {
  const O = { ...DEFAULTS, ...opts, track: { ...DEFAULTS.track, ...(opts.track || {}) }, riseBy: opts.riseBy || 2 };
  const frames = edgeFrames(det.table, det.frames, O.track), tr = makeTracker(det.table, { ...O.track, ...(O.pocketHold ? { pocketHold: true } : {}) }), moving = [];
  for (const fr of frames) { tr.step(fr); moving.push(tr.moving()); }
  const shots = tr.finish().shots.map(s => +s.t.toFixed(2)).sort((a, b) => a - b), still = [];
  for (let i = 0; i < frames.length;) {
    if (moving[i]) { i++; continue; }
    let j = i; while (j + 1 < frames.length && !moving[j + 1]) j++;
    if (frames[j].t - frames[i].t >= O.minStill) {
      const o = observe(frames.slice(i, j + 1), { whole: true, period: { minSeen: O.minSeen, hideGap: O.hideGap, look: O.look } });
      still.push({ from: +frames[i].t.toFixed(2), to: +frames[j].t.toFixed(2), spots: o.balls.length });
    }
    i = j + 1;
  }
  const cuts = [];
  let low = null, since = -Infinity;
  for (const st of still) {
    // low: the still table with the fewest spots since the last shot; a rise only counts after a shot of this rack
    if (!low || shots.some(t => t > low.from && t <= st.to)) { low = st; continue; }
    if (st.spots - low.spots >= O.riseBy && shots.some(t => t > since && t <= low.to)) { cuts.push({ cut: low.to, low: low.spots, risenTo: st.spots, at: st.from }); since = low.to; low = st; }
    else if (st.spots < low.spots) low = st;
  }
  return { shots, still, cuts };
}

if (require.main === module) {
  const argv = process.argv.slice(2), arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d; };
  if (argv[0] === '--find-racks') { const out = findRacks(JSON.parse(fs.readFileSync(argv[1], 'utf8')), JSON.parse(arg('--opts', '{}'))); console.log(JSON.stringify(out)); return; }
  const set = arg('--set', null), probe = arg('--probe', null), opts = JSON.parse(arg('--opts', '{}')), out = arg('--out', null);
  const det = JSON.parse(fs.readFileSync(argv[0], 'utf8'));
  const log = runRack(det, { ...opts, ...(set ? { set: set.split(',').map(Number) } : {}), ...(probe ? { probeData: JSON.parse(fs.readFileSync(probe, 'utf8')) } : {}) });
  if (out) fs.writeFileSync(out, JSON.stringify(log, null, 1));
  for (const s of log.shots) console.log(`shot ${s.n} ${s.t}s first ${s.first} made ${JSON.stringify(s.made)} open ${(s.unresolved || []).map(u => u.ball + ':' + u.why).join('; ')}`);
  if (log.start) console.log('start', JSON.stringify(log.start));
}
module.exports = { runRack, findRacks, PID, POCKET_NAMES };
