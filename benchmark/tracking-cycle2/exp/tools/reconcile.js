// Settled-table check for the offline baseline. Rules: docs/baseline-rules.md (sections 2 to 4), written before any
// footage was run. Two parts:
//   observe(frames)                - turn a second or so of finder output on a still table into the balls seen
//   reconcile(memory, obs, ev)     - update memory from one settled look plus the tracker's pocket evidence
// Plain JS, no dependencies. Units: table inches. Ball numbers: 0 = cue ball, 1 to 9.

const BALLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const OBS = { group: 1.5, share: 0.5, nb: 0.5, p: 0.6, minScore: 2, margin: 2 };
// absence experiment (off unless ev.absence is given; not part of the baseline rules): a missing ball with no pocket
// event inside a mouth is confirmed pocketed only when every one of these holds, otherwise it stays unconfirmed:
//   the look before this shot named it; the after look is settled with every spot named (none could be it);
//   the spot count fell by exactly the number of missing balls named before (no more balls missing than gone), and by
//   at most maxDrop (3 or more at once is a misread table, as in the old app); every missing ball was named before;
//   and a track rolled away from its spot (a ball that was only blocked from view or not found did not move)
const ABSENCE = { maxDrop: 2 };

// frames: [{ t, balls: [{ x, y, rec, p, nb }] }] from tools/clip-detect.js
// cycle 2 experiment whole (off unless opts.whole): whole-table naming. After the usual naming, a spot left unnamed
// (its number taken by a clearly surer spot, or too few confident looks) may still be named from its full reader
// probabilities averaged over the look (b.q, given that it is a ball), once the numbers held by surely named spots in the
// same look are removed: only if the remaining evidence for one number is at least WHOLE.p and at least WHOLE.margin
// times the next. A number held only narrowly is not removed for the spot that lost it: the holder's mean probability
// for it must be at least WHOLE.holder and at least WHOLE.holderGap above the losing spot's.
// Otherwise the spot stays unnamed. Each ball exists once; no rack or game rule and no earlier look is used.
const WHOLE = { p: 0.85, margin: 4, holder: 0.9, holderGap: 0.1, minLooks: 0.5 };
function observe(frames, opts = {}) {
  const groups = [];
  for (const fr of frames) for (const b of fr.balls) {
    let g = null, gd = OBS.group;
    for (const c of groups) { const d = Math.hypot(b.x - c.x, b.y - c.y); if (d < gd) { gd = d; g = c; } }
    if (!g) { g = { x: b.x, y: b.y, n: 0, frames: new Set(), nb: 0, nbN: 0, score: new Array(10).fill(0) }; groups.push(g); }
    g.x = (g.x * g.n + b.x) / (g.n + 1); g.y = (g.y * g.n + b.y) / (g.n + 1); g.n++; g.frames.add(fr.t);
    if (b.nb != null) { g.nb += b.nb; g.nbN++; }
    if (b.rec != null && b.p != null && b.p >= OBS.p && b.nb != null && b.nb < OBS.nb) g.score[b.rec] += b.p;
    if (opts.whole && b.q && b.nb != null && b.nb < OBS.nb) { g.q = g.q || new Array(10).fill(0); b.q.forEach((v, i) => { g.q[i] += v; }); g.qN = (g.qN || 0) + 1; }
  }
  const balls = groups.filter(g => g.frames.size >= OBS.share * frames.length && (!g.nbN || g.nb / g.nbN < OBS.nb)).map(g => {
    const order = BALLS.slice().sort((a, b) => g.score[b] - g.score[a]), top = order[0], s1 = g.score[top], s2 = g.score[order[1]];
    const sure = s1 >= OBS.minScore && s1 >= OBS.margin * s2;
    return { x: +g.x.toFixed(1), y: +g.y.toFixed(1), num: sure ? top : null, score: +s1.toFixed(1), seen: g.frames.size,
      ...(opts.whole ? { _q: g.qN ? g.q.map(v => v / g.qN) : null, _qN: g.qN || 0, _sc: g.score.slice() } : {}) };
  });
  // each number at most once: the higher total keeps it
  for (const n of BALLS) {
    const same = balls.filter(b => b.num === n).sort((a, b) => b.score - a.score);
    for (const b of same.slice(1)) { b.dupOf = n; b.num = null; }
  }
  if (opts.whole) {
    // numbers held by surely named spots; a number held only narrowly against a spot that lost it stays open
    let changed = true;
    while (changed) {
      changed = false;
      const held = new Set(balls.filter(b => b.num != null).map(b => b.num));
      const cands = [];
      for (const b of balls) {
        if (b.num != null || !b._q || b._qN < WHOLE.minLooks * frames.length) continue;
        if (b.dupOf != null) { const h = balls.find(o => o.num === b.dupOf); if (!h || !h._q || h._q[b.dupOf] < WHOLE.holder || h._q[b.dupOf] < b._q[b.dupOf] + WHOLE.holderGap) continue; }
        const rest = b._q.map((v, i) => held.has(i) ? 0 : v), tot = rest.reduce((a, v) => a + v, 0); if (tot <= 0) continue;
        const order = BALLS.slice().sort((i, j) => rest[j] - rest[i]), p1 = rest[order[0]] / tot, p2 = rest[order[1]] / tot;
        if (p1 >= WHOLE.p && p1 >= WHOLE.margin * p2) cands.push([p1, b, order[0]]);
      }
      // one at a time, the clearest first, so each name is judged against the names already given
      cands.sort((a, b) => b[0] - a[0]);
      if (cands.length) { const [p1, b, n] = cands[0]; if (!cands.some(c => c !== cands[0] && c[2] === n && c[0] >= p1 - 0.05)) { b.num = n; b.byWhole = +p1.toFixed(2); changed = true; } }
    }
    for (const b of balls) { delete b._q; delete b._qN; delete b._sc; }
  }
  // byWhole: names given by whole-table naming. They count as names for the table, but a look that needed them is not
  // clear enough for the absence rule (a confident misread elsewhere in the look would turn into a wrong pocket call)
  return { frames: frames.length, balls, named: Object.fromEntries(balls.filter(b => b.num != null).map(b => [b.num, b])), unnamed: balls.filter(b => b.num == null).length,
    ...(opts.whole ? { byWhole: balls.filter(b => b.byWhole != null).length } : {}) };
}

// set: the balls this rack (or drill layout) starts with; 9-ball by default
function newMemory(set = BALLS) { return { balls: {}, rack: true, set: set.slice() }; }
const clone = m => JSON.parse(JSON.stringify(m));
const onTable = rec => rec && (rec.status === 'present' || rec.status === 'unconfirmed');

// memory: { balls: { n: { status, x, y, why } }, rack: true when a rack has just started }
// obs: from observe(), plus settled: false when something was still moving (R5)
// ev: { pockets: [{ ball, x, y, jaws, inMouth }] } - the tracker's pocket events in this clip, with the ball's last
//     seen spot and whether that spot is inside the pocket mouth zone
function reconcile(memory, obs, ev = { pockets: [] }, label = '') {
  const prev = clone(memory), mem = clone(memory), trace = { label, prev: summary(prev), seen: obs.balls.map(b => ({ num: b.num, x: b.x, y: b.y, score: b.score })),
    unnamed: obs.unnamed, settled: obs.settled !== false, pocketEvents: ev.pockets, proposed: [], confirmed: [], unresolved: [] };
  const missing = BALLS.filter(n => onTable(mem.balls[n]) && !obs.named[n]);
  // match pocket events to missing balls: by number first, then the only missing ball for an event with no usable number
  const used = new Set(), evFor = {};
  for (const p of ev.pockets) if (p.ball != null && missing.includes(p.ball) && !used.has(p)) { evFor[p.ball] = p; used.add(p); }
  const left = missing.filter(n => !evFor[n]), loose = ev.pockets.filter(p => !used.has(p) && (p.ball == null || !missing.includes(p.ball)));
  if (loose.length === 1 && left.length === 1) { evFor[left[0]] = loose[0]; used.add(loose[0]); }

  // R1 / R7: balls seen
  for (const [k, b] of Object.entries(obs.named)) {
    const n = +k, r = mem.balls[n];
    if (!r) { mem.balls[n] = { status: 'present', x: b.x, y: b.y, why: mem.rack ? 'seen at rack start' : 'appeared' }; if (!mem.rack) trace.confirmed.push({ ball: n, change: 'appeared', why: 'seen, not in memory' }); continue; }
    if (r.status === 'pocketed' || r.status === 'left') {
      const why = n === 0 ? 'cue ball back on the table (ball in hand)' : 'seen again after it was counted pocketed';
      trace.confirmed.push({ ball: n, change: n === 0 ? 'back' : 'reversed', why }); if (n !== 0) trace.reversed = (trace.reversed || []).concat(n);
    }
    mem.balls[n] = { status: 'present', x: b.x, y: b.y, why: 'seen', ...((r.contested || (n !== 0 && (r.status === 'pocketed' || r.status === 'left'))) && ev.guard ? { contested: true } : {}) };
  }
  // R7: at rack start the rack's balls that were not seen are expected but unconfirmed
  if (mem.rack) for (const n of mem.set || BALLS) if (!mem.balls[n]) { mem.balls[n] = { status: 'unconfirmed', why: 'in the rack, not seen at rack start' }; trace.unresolved.push({ ball: n, why: 'not seen at rack start' }); }
  // missing balls: R2 to R6
  // cycle 2 experiment shotLocal (off unless A.shotLocal): the absence evidence is judged only on the balls the look
  // before this shot named. Balls already uncertain from an earlier shot (not seen in that look either) stay uncertain
  // and no longer block it
  // cycle 2 experiment guard (off unless ev.guard): a ball seen again after it was counted pocketed (not the cue ball,
  // which comes back in hand) has a doubtful name in this rack: its absence is never used to confirm a pocket
  const A = ev.absence, cand = (A && A.shotLocal ? missing.filter(n => A.before.named[n]) : missing);
  const doubtful = n => ev.guard && prev.balls[n] && prev.balls[n].contested;
  // cycle 2 experiment reappear (off unless A.reappear): a known ball not seen in the look before the shot but named in
  // the still look after it (it was behind the shooter) is counted as come back, so the count must fall by the missing
  // balls minus the balls that came back. Every spot after must be named (unnamed 0), so each one is accounted for
  const back = A && A.reappear && A.before ? Object.keys(obs.named).map(Number).filter(n => !A.before.named[n] && prev.balls[n] && onTable(prev.balls[n])) : [];
  const absOk = A && A.before && obs.settled !== false && obs.unnamed === 0 && !obs.byWhole && !A.before.byWhole && (() => {
    const drop = A.before.balls.length - obs.balls.length + back.length;
    // shotLocal 'explained': the other missing balls must already be possibly pocketed (lost at a pocket in an earlier
    // shot); a ball that was simply never seen still blocks the rule, as in v0.6
    const others = missing.filter(n => !A.before.named[n]);
    return (A.shotLocal === 'explained' ? others.every(n => prev.balls[n] && prev.balls[n].maybeIn) : A.shotLocal || missing.every(n => A.before.named[n])) && drop === cand.length && cand.length >= 1 && cand.length <= ABSENCE.maxDrop && (!A.reappear || A.before.unnamed === 0 || !back.length);
  })();
  for (const n of missing) {
    const r = mem.balls[n], p = evFor[n];
    if (p) trace.proposed.push({ ball: n, change: 'pocketed', evidence: p.jaws ? 'seen in the jaws' : p.inMouth ? 'lost inside the pocket mouth' : 'lost heading toward a pocket, outside the mouth' });
    if (p && A && A.shotLocal === 'explained') r.maybeIn = true;
    if (obs.settled === false) { r.status = 'unconfirmed'; r.why = 'not seen; table not settled'; trace.unresolved.push({ ball: n, why: 'not seen and the table was still moving', possiblyPocketed: !!p }); continue; }
    if (p && (p.jaws || p.inMouth)) { r.status = 'pocketed'; r.why = 'pocket event inside the mouth and gone from the still table'; trace.confirmed.push({ ball: n, change: 'pocketed', why: r.why }); continue; }
    if (absOk && cand.includes(n) && !doubtful(n) && A.movedFrom(A.before.named[n].x, A.before.named[n].y)) {
      r.status = 'pocketed'; r.why = 'gone from a clear still table: named before, count fell by the missing balls, it rolled away' + (A.delayed ? ' (seen at the next still table)' : '');
      trace.confirmed.push({ ball: n, change: 'pocketed', why: r.why, absence: true }); continue;
    }
    r.status = 'unconfirmed';
    r.why = p ? 'possibly pocketed: last seen heading to a pocket outside the mouth' : obs.unnamed ? 'not seen; may be one of the unnamed balls' : 'not seen, nothing explains it';
    trace.unresolved.push({ ball: n, why: r.why, possiblyPocketed: !!p });
  }
  for (const p of ev.pockets) if (!used.has(p)) trace.unresolved.push({ ball: p.ball, why: p.ball != null && obs.named[p.ball] ? 'pocket event, but the ball is still on the table' : 'pocket event that matches no missing ball' });
  mem.rack = false;
  trace.after = summary(mem); trace.game = game(mem);
  return { memory: mem, trace };
}

function summary(mem) { return Object.fromEntries(Object.entries(mem.balls).map(([n, r]) => [n, r.status])); }

// R9: the 9-ball state, from confirmed changes only
function game(mem) {
  const on = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(n => onTable(mem.balls[n]));
  const lowest = on.length ? on[0] : null;
  return { onTable: on, lowest, lowestSure: lowest != null && on.filter(n => n <= lowest).every(n => mem.balls[n].status === 'present'),
    rackOver: mem.balls[9] && mem.balls[9].status === 'pocketed' };
}

if (typeof module !== 'undefined') module.exports = { observe, reconcile, newMemory, game, onTable, BALLS, OBS, ABSENCE };
