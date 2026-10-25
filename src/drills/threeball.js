// Three-Ball Runout drill engine (cue ball + 1, 2, 3 anywhere, any order, any pocket).
// One pass over a continuous recording: the tracker (../perception/tracker.js) follows every ball, finds shots and
// pocket entries; each still stretch of the table is looked at (../perception/reconcile.js observe), and a persistent
// table memory is carried from look to look. Three layers are kept apart:
//   recognition  which number a spot looks like (the reader's own call, kept as "predicted", never forced to the set);
//   tracking     where each physical ball is now (last confirmed spot, last observed spot, visible, on the table);
//   events       shots, pocketed balls, misses, scratches, attempts and the drill score.
// Identity in a look comes, in order: player correction > reader > same spot as the ball's last confirmed spot >
// elimination inside the known set. A reader name that contradicts a ball that has not moved is not taken (the
// conflict is recorded). A ball not seen keeps its last confirmed state (hidden). A ball is pocketed only on a
// pocket entry inside a mouth plus gone from the still table, or on the absence rule (clear table, count fell, it
// rolled away); otherwise it stays "unsure". When names are missing but the count of object balls clearly fell with a
// pocket entry, the drill still counts "an object ball pocketed, number unknown".
// Attempts: a setup look with the cue ball and 3 object balls starts an attempt at the next shot; it ends when all
// three are pocketed (cleared), when the player marks a new attempt, or when balls are put back on the table.
// Plain JS, no dependencies beyond the perception modules, so the same file can run in the app later.
//   node threeball.js <detections json> [--marks t1,t2] [--corrections corr.json] [--out drill.json]
'use strict';
const { makeTracker, edgeFrames } = require('../perception/tracker.js');
const { observe, reconcile, newMemory } = require('../perception/reconcile.js');

const SET = [0, 1, 2, 3], OBJ = [1, 2, 3];
const TRACK = { version: 'v0.6', pocketHold: true, spotBack: true, lateStart: true, anonEntries: true, jawEdges: true, railEdges: true, bagSpots: true };
const D = { minStill: 1.0, gapBefore: 0.2, look: 1.0, minSeen: 0.8, hideGap: 0.5, sameSpot: 1.5, moveFrom: 1.5, moveAway: 3, conflictSpot: 1.0 };
const POCKET_NAMES = ['near-left corner', 'near side', 'near-right corner', 'far-left corner', 'far side', 'far-right corner'];
const r1 = v => +v.toFixed(1), r2 = v => +v.toFixed(2);

function runThreeBall(det, o = {}) {
  const O = { ...D, ...o, track: { ...TRACK, ...(o.track || {}) } }, marks = (o.marks || []).slice().sort((a, b) => a - b), corr = o.corrections || [];
  const [L, W] = det.table, frames = edgeFrames(det.table, det.frames, O.track);
  const tr = makeTracker(det.table, O.track), moving = [], lookFrames = [], hist = new Map();
  for (const fr of frames) {
    tr.step(fr); moving.push(tr.moving()); lookFrames.push(tr.lookFrame(fr));
    for (const k of tr.tracks) if (k.real && k.t === fr.t) { let h = hist.get(k.id); if (!h) hist.set(k.id, h = []); h.push([fr.t, k.x, k.y]); }
  }
  const R = tr.finish(), end = frames.length ? frames[frames.length - 1].t : 0;
  const allShots = R.shots.slice().sort((a, b) => a.t - b.t);
  // still stretches
  const still = [];
  for (let i = 0; i < frames.length;) {
    if (moving[i]) { i++; continue; }
    let j = i; while (j + 1 < frames.length && !moving[j + 1]) j++;
    if (frames[j].t - frames[i].t >= O.minStill) still.push([i, j]);
    i = j + 1;
  }
  const pockets = [[0, 0], [L / 2, -0.6], [L, 0], [0, W], [L / 2, W + 0.6], [L, W]];
  const nearest = (x, y) => pockets.map((p, i) => [Math.hypot(x - p[0], y - p[1]), i]).sort((a, b) => a[0] - b[0])[0];
  const pevAll = R.events.filter(e => e.k === 'pocket').map(e => {
    const k = R.tracks.find(x => x.id === e.track) || {}, [d, i] = k.x != null ? nearest(k.x, k.y) : [null, null];
    return { ball: k.ball ?? e.ball ?? null, t: +e.t.toFixed(2), jaws: !!e.jaws, inMouth: d != null && d < 5.5, pocket: i, dist: d, track: e.track };
  });
  for (const e of R.events) if (e.k === 'entry?' && e.real) pevAll.push({ ball: null, t: +e.t.toFixed(2), jaws: false, inMouth: true, pocket: e.pocket, dist: e.dist, track: e.track, anon: true });
  const movedFrom = (t0, t1) => (x, y) => [...hist.values()].some(h => {
    let at = -1;
    for (const [t, px, py] of h) { if (t < t0 || t > t1) continue; const d = Math.hypot(px - x, py - y); if (d < O.moveFrom && at < 0) at = t; else if (at >= 0 && d >= O.moveAway) return true; }
    return false;
  });
  const cuePath = (t0, t1) => {
    const k = [...hist.entries()].find(([id]) => id === allShots.find(s => s.t === t0)?.cue);
    if (!k) return null;
    const p = k[1].filter(q => q[0] >= t0 - 0.05 && q[0] <= t1); let len = 0;
    for (let i = 1; i < p.length; i++) len += Math.hypot(p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]);
    return p.length > 1 ? { travel: r1(len), from: [r1(p[0][1]), r1(p[0][2])] } : null;
  };

  // one look: the last still stretch inside (t0, t1], else the last second before t1
  const OB = { whole: true, period: { minSeen: O.minSeen, hideGap: O.hideGap, look: O.look } };
  function lookIn(t0, t1) {
    const idx = []; for (let i = 0; i < frames.length; i++) if (frames[i].t > t0 && frames[i].t <= t1) idx.push(i);
    if (!idx.length) return null;
    const lastSec = idx.filter(i => frames[i].t >= t1 - O.look), settled = !lastSec.some(i => moving[i]);
    let use = lastSec;
    const s = still.filter(([a, b]) => frames[b].t > t0 && frames[a].t < t1).pop();
    if (settled && s) { const u = idx.filter(i => i >= s[0] && i <= s[1]); if (u.length) use = u; }
    const lf = use.map(i => lookFrames[i]), obs = observe(lf, OB);
    obs.settled = settled; obs.from = r2(frames[use[0]].t); obs.to = r2(frames[use[use.length - 1]].t);
    // picture position of each spot (for the review page), and the reader's own call kept apart from the drill's name
    for (const b of obs.balls) {
      let px = 0, py = 0, n = 0;
      for (const f of lf) for (const d of f.balls) if (d.px != null && Math.hypot(d.x - b.x, d.y - b.y) < 1.5) { px += d.px; py += d.py; n++; }
      if (n) { b.px = Math.round(px / n); b.py = Math.round(py / n); }
      b.predicted = b.num; b.src = b.num != null ? 'reader' : null;
      if (b.num != null && !SET.includes(b.num)) { b.outsideSet = b.num; b.num = null; b.src = null; }
    }
    obs.frameT = obs.to;
    return obs;
  }

  // naming inside the known set, from the memory (tracking) and the player's corrections
  function nameLook(obs, mem, tPrev) {
    const notes = [];
    // player corrections that fall in this look: nearest spot gets the number
    for (const c of corr) if (c.t >= obs.from - 0.05 && c.t <= obs.to + 0.05) {
      const b = obs.balls.slice().sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y))[0];
      if (!b || Math.hypot(b.x - c.x, b.y - c.y) > 3) { notes.push({ ball: c.ball, note: 'correction matched no spot' }); continue; }
      for (const o of obs.balls) if (o !== b && o.num === c.ball) { o.num = null; o.src = null; }
      if (b.num !== c.ball) notes.push({ ball: c.ball, note: 'player correction', was: b.num });
      b.num = c.ball; b.src = 'player';
    }
    // a reader name on a spot where another ball has sat still since its last confirmed sighting: tracking wins
    for (const b of obs.balls) if (b.src === 'reader') {
      for (const n of SET) {
        const m = mem[n]; if (n === b.num || !m || !m.lastConfirmed || m.onTable === 'no') continue;
        if (Math.hypot(m.lastConfirmed.x - b.x, m.lastConfirmed.y - b.y) < O.conflictSpot && !movedFrom(m.lastConfirmed.t, obs.to)(m.lastConfirmed.x, m.lastConfirmed.y)) {
          notes.push({ ball: n, note: 'reader called it ' + b.num + ', but ball ' + n + ' never left this spot: kept ' + n, conflict: true });
          b.num = n; b.src = 'same spot (reader disagreed)'; break;
        }
      }
    }
    // each number once: player > same spot > reader (higher score)
    const rank = b => b.src === 'player' ? 3 : b.src && b.src.startsWith('same spot') ? 2 : 1;
    for (const n of SET) { const same = obs.balls.filter(b => b.num === n).sort((a, c) => rank(c) - rank(a) || c.score - a.score); for (const b of same.slice(1)) { b.num = null; b.src = null; b.dupOf = n; } }
    // unnamed spot at a remembered ball's spot that has not moved since: same ball
    for (const b of obs.balls) if (b.num == null) {
      const n = SET.find(n => { const m = mem[n]; return m && m.lastConfirmed && m.onTable !== 'no' && !obs.balls.some(o => o.num === n)
        && Math.hypot(m.lastConfirmed.x - b.x, m.lastConfirmed.y - b.y) < O.sameSpot && !movedFrom(m.lastConfirmed.t, obs.to)(m.lastConfirmed.x, m.lastConfirmed.y); });
      if (n != null) { b.num = n; b.src = 'same spot'; }
    }
    // elimination: exactly one unnamed spot and exactly one remembered ball not seen, on a settled look, and the spot is
    // not where a pocketed ball went in: it is that ball (moved while unread)
    const un = obs.balls.filter(b => b.num == null), missing = SET.filter(n => mem[n] && mem[n].onTable !== 'no' && !obs.balls.some(b => b.num === n));
    if (obs.settled && un.length === 1 && missing.length === 1 && !(missing[0] !== 0 && un[0].predicted === 0)) { un[0].num = missing[0]; un[0].src = 'elimination'; notes.push({ ball: missing[0], note: 'named by elimination (the only unread spot, the only ball not seen)' }); }
    obs.named = Object.fromEntries(obs.balls.filter(b => b.num != null).map(b => [b.num, b]));
    obs.unnamed = obs.balls.filter(b => b.num == null).length;
    return notes;
  }

  // persistent memory, one record per expected ball
  const blank = () => Object.fromEntries(SET.map(n => [n, { expected: n, lastConfirmed: null, lastObserved: null, visible: false, onTable: 'unknown', pocketConfirmed: false, nameFrom: null }]));
  const out = { seconds: r2(end), frames: frames.length, table: det.table, attempts: [], betweenShots: [], looks: [], marks, recognition: [] };
  let mem = blank(), rmem = null, att = null, prevLook = null, phase = 'setup', lastObjCount = null;
  const remember = (obs, t) => {
    for (const n of SET) {
      const b = obs.named[n], m = mem[n];
      if (b) {
        m.lastObserved = { x: b.x, y: b.y, t: r2(b.lastSeen ?? t) }; m.visible = !b.hidden; m.nameFrom = b.src;
        if (!b.hidden) m.lastConfirmed = { x: b.x, y: b.y, t: r2(b.lastSeen ?? t) };
        if (m.onTable !== 'no') m.onTable = 'yes';
      } else m.visible = false;
    }
  };
  const snapshot = () => JSON.parse(JSON.stringify(mem));
  const objSpots = obs => obs.balls.filter(b => b.num !== 0).length;
  const isSetup = obs => obs && obs.settled && obs.balls.length >= 4 && objSpots(obs) >= 3;
  const startAttempt = (obs, why) => {
    mem = blank(); rmem = newMemory(SET); nameLook(obs, mem); remember(obs, obs.to);
    const a = reconcile(rmem, obs, { pockets: [], guard: true }, 'setup'); rmem = a.memory;
    for (const n of SET) mem[n].onTable = obs.named[n] ? 'yes' : 'unsure';
    att = { n: out.attempts.length + 1, startedBy: why, setup: { t: obs.to, from: obs.from, spots: obs.balls.map(b => ({ x: b.x, y: b.y, px: b.px, py: b.py, num: b.num, predicted: b.predicted, outsideSet: b.outsideSet, src: b.src })), unnamed: obs.unnamed },
      memory: snapshot(), shots: [], anonPocketed: 0 };
    out.attempts.push(att); phase = 'armed'; prevLook = obs; lastObjCount = objSpots(obs);
    out.recognition.push({ attempt: att.n, t: obs.to, kind: 'setup', spots: att.setup.spots });
  };
  const closeAttempt = why => { if (att && !att.end) { att.end = why; summarise(att); } att = null; phase = 'setup'; };

  // walk the recording: before the first shot, between shots, after the last
  const seq = allShots.map(s => s.t);
  const looks0 = lookIn(-1, (seq[0] ?? end) - O.gapBefore);
  if (isSetup(looks0)) startAttempt(looks0, 'setup look');
  for (let k = 0; k < allShots.length; k++) {
    const s = allShots[k], next = k + 1 < allShots.length ? allShots[k + 1].t : null, lookEnd = next != null ? next - O.gapBefore : end;
    // a player mark (New attempt) before this shot closes the attempt; the setup look before the shot opens the next
    const mk = marks.filter(m => m <= s.t && m > (k ? allShots[k - 1].t : -1));
    if (mk.length) { closeAttempt('player marked a new attempt'); const lk = lookIn(mk[mk.length - 1] - 0.01, s.t - O.gapBefore); if (lk && lk.balls.length >= 2) startAttempt(lk, 'player mark'); }
    const after = lookIn(s.t, lookEnd);
    if (phase === 'setup' || !att) {
      out.betweenShots.push({ t: r2(s.t), note: 'not in an attempt (setting up or between attempts)' });
      if (isSetup(after)) startAttempt(after, 'setup look');
      continue;
    }
    phase = 'shooting';
    const pev = pevAll.filter(e => e.t >= s.t - 0.3 && (next == null || e.t < next - 0.3));
    const shot = { n: att.shots.length + 1, t: r2(s.t), first: SET.includes(s.first) ? s.first : null, firstRead: s.first ?? null, late: !!s.late,
      pocketEntries: pev.map(e => ({ ball: e.ball, t: e.t, pocket: e.pocket != null ? POCKET_NAMES[e.pocket] : null, inMouth: e.inMouth, jaws: e.jaws })) };
    if (!after) { shot.result = 'unclear'; shot.why = 'no look before the next shot'; att.shots.push(shot); continue; }
    // balls put back during an attempt (count of object balls rose by 2+ on a clear table): a new attempt
    const objNow = objSpots(after);
    if (after.settled && lastObjCount != null && objNow >= lastObjCount + 2 && objNow >= 3) {
      closeAttempt('balls put back on the table'); startAttempt(after, 'balls put back'); out.betweenShots.push({ t: r2(s.t), note: 'reset shot/placement' }); continue;
    }
    const notes = nameLook(after, mem, prevLook && prevLook.to);
    const absence = prevLook ? { before: prevLook, movedFrom: movedFrom(s.t - 0.5, after.to) } : null;
    const b = reconcile(rmem, after, { pockets: pev, guard: true, ...(absence ? { absence } : {}) }, 'after shot ' + shot.n);
    rmem = b.memory; remember(after, after.to);
    const made = [];
    for (const c of b.trace.confirmed) {
      if (c.change === 'pocketed') {
        const e = pev.find(p => p.ball === c.ball) || (c.absence ? null : pev.find(p => p.ball == null));
        mem[c.ball].onTable = 'no'; mem[c.ball].pocketConfirmed = true; mem[c.ball].visible = false;
        mem[c.ball].pocketed = { shot: shot.n, attempt: att.n, how: c.absence ? 'gone from a clear still table' : 'seen going in', pocket: e && e.pocket != null ? POCKET_NAMES[e.pocket] : 'unknown' };
        made.push({ ball: c.ball, how: mem[c.ball].pocketed.how, pocket: mem[c.ball].pocketed.pocket });
      }
      if (c.change === 'back' && c.ball === 0) { mem[0].onTable = 'yes'; mem[0].pocketConfirmed = false; delete mem[0].pocketed; }
    }
    for (const u of b.trace.unresolved) if (u.ball != null && mem[u.ball] && mem[u.ball].onTable !== 'no') mem[u.ball].onTable = 'unsure';
    // object balls pocketed with no number: object-ball count on a settled table fell, pocket entries explain the drop,
    // and no named ball accounts for it
    const namedGone = made.filter(m => m.ball !== 0).length, drop = lastObjCount != null && after.settled ? lastObjCount - objNow : 0;
    const anonEntries = pev.filter(e => e.inMouth && (e.ball == null || !SET.includes(e.ball) || !made.some(m => m.ball === e.ball))).length;
    let anon = 0;
    if (drop > namedGone && anonEntries >= drop - namedGone && after.unnamed === 0 && !b.trace.unresolved.length) anon = drop - namedGone;
    shot.made = made.filter(m => m.ball !== 0); shot.anonPocketed = anon; att.anonPocketed += anon;
    shot.scratch = made.some(m => m.ball === 0) || !!s.scratch;
    if (shot.scratch) mem[0].onTable = 'no';
    const objMade = shot.made.length + anon;
    shot.result = objMade ? 'made' : b.trace.unresolved.some(u => u.ball !== 0 && u.possiblyPocketed) ? 'unclear' : 'miss';
    shot.unresolved = b.trace.unresolved.map(u => ({ ball: u.ball, why: u.why }));
    shot.identityNotes = notes;
    const cue = after.named[0];
    shot.cue = { rest: cue ? [r1(cue.x), r1(cue.y)] : null, ...(cuePath(s.t, after.from) || {}) };
    shot.look = { from: after.from, to: after.to, settled: after.settled, spots: after.balls.map(x => ({ x: x.x, y: x.y, px: x.px, py: x.py, num: x.num, predicted: x.predicted, outsideSet: x.outsideSet, src: x.src, hidden: !!x.hidden })) };
    shot.memory = snapshot();
    att.shots.push(shot); prevLook = after; if (after.settled) lastObjCount = objNow;
    out.recognition.push({ attempt: att.n, shot: shot.n, t: after.to, kind: 'after shot', spots: shot.look.spots });
    const gone = OBJ.filter(n => mem[n].pocketConfirmed).length + att.anonPocketed;
    if (gone >= 3) closeAttempt('cleared');
  }
  if (att) closeAttempt('recording ended');
  out.summary = { attempts: out.attempts.length, cleared: out.attempts.filter(a => a.cleared).length,
    bestClear: Math.min(...out.attempts.filter(a => a.cleared).map(a => a.shotsToClear), Infinity) };
  if (out.summary.bestClear === Infinity) out.summary.bestClear = null;
  return out;
}

function summarise(a) {
  const s = a.shots;
  a.shotsTaken = s.length;
  a.pocketed = s.reduce((n, x) => n + (x.made ? x.made.length : 0) + (x.anonPocketed || 0), 0);
  a.misses = s.filter(x => x.result === 'miss').length;
  a.unclear = s.filter(x => x.result === 'unclear').length;
  a.scratches = s.filter(x => x.scratch).length;
  a.cleared = a.end === 'cleared';
  a.shotsToClear = a.cleared ? s.length : null;
  a.perfect = a.cleared && s.length === 3 && !a.scratches;
  a.order = s.flatMap(x => (x.made || []).map(m => m.ball));
}

if (typeof module !== 'undefined') module.exports = { runThreeBall, SET };

if (typeof require !== 'undefined' && require.main === module) {
  const fs = require('fs'), argv = process.argv.slice(2), arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null; };
  const marks = arg('--marks'), corrections = arg('--corrections'), outPath = arg('--out');
  const det = JSON.parse(fs.readFileSync(argv[0], 'utf8'));
  const res = runThreeBall(det, { marks: marks ? marks.split(',').map(Number) : [], corrections: corrections ? JSON.parse(fs.readFileSync(corrections, 'utf8')) : [] });
  if (outPath) fs.writeFileSync(outPath, JSON.stringify(res, null, 1));
  for (const a of res.attempts) {
    console.log(`attempt ${a.n} (${a.startedBy}, setup ${a.setup.t}s): ${a.end}; shots ${a.shotsTaken}, pocketed ${a.pocketed}, misses ${a.misses}, unclear ${a.unclear}, scratches ${a.scratches}${a.cleared ? ', cleared in ' + a.shotsToClear : ''}`);
    for (const s of a.shots) console.log(`  shot ${s.n} ${s.t}s first ${s.first} ${s.result} made ${JSON.stringify(s.made || [])}${s.anonPocketed ? ' +' + s.anonPocketed + ' unnamed' : ''}${s.scratch ? ' SCRATCH' : ''} cue ${JSON.stringify(s.cue)}`);
  }
  console.log('between attempts:', res.betweenShots.length, 'shots');
}
