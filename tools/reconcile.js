// Settled-table check for the offline baseline. Rules: docs/baseline-rules.md (sections 2 to 4), written before any
// footage was run. Two parts:
//   observe(frames)                - turn a second or so of finder output on a still table into the balls seen
//   reconcile(memory, obs, ev)     - update memory from one settled look plus the tracker's pocket evidence
// Plain JS, no dependencies. Units: table inches. Ball numbers: 0 = cue ball, 1 to 9.

const BALLS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const OBS = { group: 1.5, share: 0.5, nb: 0.5, p: 0.6, minScore: 2, margin: 2 };

// frames: [{ t, balls: [{ x, y, rec, p, nb }] }] from tools/clip-detect.js
function observe(frames) {
  const groups = [];
  for (const fr of frames) for (const b of fr.balls) {
    let g = null, gd = OBS.group;
    for (const c of groups) { const d = Math.hypot(b.x - c.x, b.y - c.y); if (d < gd) { gd = d; g = c; } }
    if (!g) { g = { x: b.x, y: b.y, n: 0, frames: new Set(), nb: 0, nbN: 0, score: new Array(10).fill(0) }; groups.push(g); }
    g.x = (g.x * g.n + b.x) / (g.n + 1); g.y = (g.y * g.n + b.y) / (g.n + 1); g.n++; g.frames.add(fr.t);
    if (b.nb != null) { g.nb += b.nb; g.nbN++; }
    if (b.rec != null && b.p != null && b.p >= OBS.p && b.nb != null && b.nb < OBS.nb) g.score[b.rec] += b.p;
  }
  const balls = groups.filter(g => g.frames.size >= OBS.share * frames.length && (!g.nbN || g.nb / g.nbN < OBS.nb)).map(g => {
    const order = BALLS.slice().sort((a, b) => g.score[b] - g.score[a]), top = order[0], s1 = g.score[top], s2 = g.score[order[1]];
    const sure = s1 >= OBS.minScore && s1 >= OBS.margin * s2;
    return { x: +g.x.toFixed(1), y: +g.y.toFixed(1), num: sure ? top : null, score: +s1.toFixed(1), seen: g.frames.size };
  });
  // each number at most once: the higher total keeps it
  for (const n of BALLS) {
    const same = balls.filter(b => b.num === n).sort((a, b) => b.score - a.score);
    for (const b of same.slice(1)) { b.dupOf = n; b.num = null; }
  }
  return { frames: frames.length, balls, named: Object.fromEntries(balls.filter(b => b.num != null).map(b => [b.num, b])), unnamed: balls.filter(b => b.num == null).length };
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
    mem.balls[n] = { status: 'present', x: b.x, y: b.y, why: 'seen' };
  }
  // R7: at rack start the rack's balls that were not seen are expected but unconfirmed
  if (mem.rack) for (const n of mem.set || BALLS) if (!mem.balls[n]) { mem.balls[n] = { status: 'unconfirmed', why: 'in the rack, not seen at rack start' }; trace.unresolved.push({ ball: n, why: 'not seen at rack start' }); }
  // missing balls: R2 to R6
  for (const n of missing) {
    const r = mem.balls[n], p = evFor[n];
    if (p) trace.proposed.push({ ball: n, change: 'pocketed', evidence: p.jaws ? 'seen in the jaws' : p.inMouth ? 'lost inside the pocket mouth' : 'lost heading toward a pocket, outside the mouth' });
    if (obs.settled === false) { r.status = 'unconfirmed'; r.why = 'not seen; table not settled'; trace.unresolved.push({ ball: n, why: 'not seen and the table was still moving', possiblyPocketed: !!p }); continue; }
    if (p && (p.jaws || p.inMouth)) { r.status = 'pocketed'; r.why = 'pocket event inside the mouth and gone from the still table'; trace.confirmed.push({ ball: n, change: 'pocketed', why: r.why }); continue; }
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

if (typeof module !== 'undefined') module.exports = { observe, reconcile, newMemory, game, onTable, BALLS, OBS };
