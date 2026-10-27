// ---------- V3 ball tracker: every ball followed in table inches, names kept with the balls ----------
// Lessons from V2.x and the Oct 17-25 experiments, as rules this file keeps:
//   - A ball's name rides with the ball. It is read while the ball rests (next to another ball only a sure read counts), the reads
//     add up as votes, and the names are shared out over all balls at once (each number once). It is not re-guessed from
//     one picture, and a moving (blurred) ball is never read.
//   - A tap is the strongest evidence: a ball the player names keeps that name until it is pocketed or renamed.
//   - A ball that disappears is hidden (behind a player, the cue, another ball) and keeps its spot and name. It is pocketed
//     only when it was rolling and vanished at a pocket and stays gone.
//   - The ball that starts rolling on its own after a still table is the cue ball: the shot starts there. Several balls
//     starting together is hands or racking, not a shot.
//   - Something new counts as a ball only once it has rested in one spot, looked like a ball, for most looks over about a
//     second: an arm, a hand or the cue moves and the reader calls it "not a ball".
//   - When unsure, say unsure. Nothing here guesses a number to fill a gap.
// Input per look: track.update(t, spots) with t in seconds and spots [{x, y, px, py, r, score, p, kind, col}]: table inches
// (ball centre), picture position and radius, finder score, the reader's 11 probabilities (cue, 1-9, not a ball) when it
// ran on this look, and the colour shares {y, r, w}. Plain JS, no dependencies: runs in the app and in Node tests.
function makeTracker(P, opts) {
  const O = Object.assign({
    moveSpeed: 8,       // in/s: a ball lost faster than this may have been heading into a pocket
    shotSpeed: 4,       // in/s the first ball must reach for a shot (a soft tap-in is a shot too)
    moveDist: 1.2,      // in a resting ball must leave its spot by to be rolling (the finder's spot wobbles a few tenths)
    stopSpan: 0.3,      // s a rolling ball must stay within stopDist in to be resting again
    stopDist: 0.8,
    stillHold: 0.5,     // s every ball must rest before a shot can start
    endHold: 1.2,       // s every ball must rest for the shot to be over
    gateRest: 1.6,      // in: a resting ball is looked for this close to where it was
    gateMove: 4,        // in around the predicted spot of a rolling ball, plus gateMoveK of its travel this look
    gateMoveK: 0.6,
    launchGate: 18,     // in: how far a resting ball may have gone by the next look once it is struck
    hiddenGate: 2.5,    // in: a hidden ball is found again if a spot turns up this close to where it was
    pocketZone: 4,      // in past a pocket's circle: a rolling ball lost inside it is going into that pocket
    pocketWait: 1.0,    // s a ball lost at a pocket must stay gone to count as pocketed
    newRest: 0.9,       // s something new must rest on one spot before it counts as a ball
    newShare: 0.7,      // share of looks it must be seen in over that time
    newNb: 0.5,         // its average "not a ball" from the reader must stay under this
    touchPx: 2.3,       // spot radii between centres: closer than this, the reader's crop also shows the neighbour
    voteKeep: 0.94,     // each new vote: old votes count this much less, so later evidence can win
    nameBonus: 0.25,    // a ball keeps its name unless another fits better by this much (average log-probability)
    rackCount: 3,       // this many balls starting to move on the same look without one first = hands or racking
    cueVote: 3,         // the first mover of a shot counts as this many votes for the cue ball
    ids: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  }, opts || {});
  const R = P.R, L = P.L, W = P.W, EPS = 1e-4;
  let keyN = 0;
  const S = { t: 0, tracks: [], phase: 'still', stillSince: null, shot: null, shots: [], gone: [], events: [], lastNames: '' };
  const ev = (k, d) => { const e = Object.assign({ t: +S.t.toFixed(2), k }, d); S.events.push(e); if (S.events.length > 3000) S.events.splice(0, 300); return e; };
  const live = tr => tr.state !== 'gone' && tr.state !== 'dropped';
  const ballsNow = () => S.tracks.filter(tr => tr.ok && live(tr));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const speed = tr => Math.hypot(tr.vx, tr.vy);

  // ---- assignment: min-cost matching on a rectangular cost matrix (Infinity = not allowed) ----
  function assign(cost, nr, nc) {
    const n = Math.max(nr, nc), BIG = 1e6, a = [];
    for (let i = 0; i < n; i++) { const row = new Float64Array(n); for (let j = 0; j < n; j++) { const c = i < nr && j < nc ? cost[i][j] : BIG; row[j] = isFinite(c) ? c : BIG; } a.push(row); }
    const u = new Float64Array(n + 1), v = new Float64Array(n + 1), p = new Int32Array(n + 1), way = new Int32Array(n + 1);
    for (let i = 1; i <= n; i++) {
      p[0] = i; let j0 = 0; const minv = new Float64Array(n + 1).fill(Infinity), used = new Uint8Array(n + 1);
      do {
        used[j0] = 1; const i0 = p[j0]; let delta = Infinity, j1 = 0;
        for (let j = 1; j <= n; j++) if (!used[j]) { const cur = a[i0 - 1][j - 1] - u[i0] - v[j]; if (cur < minv[j]) { minv[j] = cur; way[j] = j0; } if (minv[j] < delta) { delta = minv[j]; j1 = j; } }
        for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const out = new Array(nr).fill(-1);
    for (let j = 1; j <= n; j++) { const i = p[j] - 1, c = j - 1; if (i < nr && c < nc && a[i][c] < BIG) out[i] = c; }
    return out;
  }

  function newTrack(sp, t) {
    return { key: ++keyN, x: sp.x, y: sp.y, vx: 0, vy: 0, state: 'new', ok: false, firstT: t, seenT: t, looks: 1, seen: 1, nbSum: sp.p ? sp.p[10] : 0, nbN: sp.p ? 1 : 0,
      restX: sp.x, restY: sp.y, restSince: t, votes: new Float64Array(O.ids.length), nVotes: 0, num: null, sure: false, pin: null, lostT: null, pocket: null, sp };
  }
  function pocketNear(x, y) {
    let best = null, bd = 1e9; for (let i = 0; i < P.pockets.length; i++) { const pk = P.pockets[i], d = Math.hypot(x - pk.x, y - pk.y) - pk.r; if (d < bd) { bd = d; best = i; } }
    return { i: best, d: bd };
  }
  // the pocket a rolling ball was heading into when it was lost: near one now, or reaching one within its next 0.3 s
  function pocketFor(tr) {
    const now = pocketNear(tr.x, tr.y); if (now.d <= O.pocketZone) return now.i;
    const v = speed(tr); if (v < O.moveSpeed) return null;
    for (const dt of [0.1, 0.2, 0.3]) { const q = pocketNear(tr.x + tr.vx * dt, tr.y + tr.vy * dt); if (q.d <= O.pocketZone) return q.i; }
    return null;
  }

  // ---- one look ----
  function update(t, spotsIn, info) {
    const dt = S.t ? Math.max(0.02, t - S.t) : 0.1; S.t = t; info = info || {};
    // spots on the cloth only (a ball's centre is at least a radius in from the cushion; balls in a pocket bag, on the
    // rail or on the floor fall outside), and one spot per ball (the finder can put two boxes on one ball in a bunch)
    const m = 0.8, spots = [];
    for (const sp of spotsIn.slice().sort((a, b) => (b.score || 0) - (a.score || 0))) {
      if (sp.x < R - m || sp.y < R - m || sp.x > L - R + m || sp.y > W - R + m) continue;
      if (spots.some(q => Math.hypot(q.px - sp.px, q.py - sp.py) < 0.5 * Math.min(q.r, sp.r))) continue;
      spots.push(sp);
    }
    const act = S.tracks.filter(live), used = new Array(spots.length).fill(false), matched = new Map();
    // where each ball should be now. A rolling ball cannot pass through a resting one: if its path this look runs into one,
    // it is expected at the contact point (without this the cue ball's track took the struck ball's spot: a name swap)
    const rest = act.filter(tr => tr.ok && tr.state === 'rest'), struck = new Map(); // resting ball -> direction it is knocked
    const pred = tr => {
      if (tr.state !== 'moving') return { x: tr.x, y: tr.y, g: O.gateRest };
      const ex = tr.x + tr.vx * dt, ey = tr.y + tr.vy * dt, len = Math.hypot(ex - tr.x, ey - tr.y) || 1e-6, ux = (ex - tr.x) / len, uy = (ey - tr.y) / len;
      let stop = len;
      for (const o of rest) {
        if (o === tr) continue; const ax = o.x - tr.x, ay = o.y - tr.y, along = ax * ux + ay * uy, side = Math.abs(ax * uy - ay * ux);
        if (along <= 0 || side >= 2 * R) continue; const c = along - Math.sqrt(4 * R * R - side * side);
        if (c < stop) { stop = Math.max(0, c); const cx = tr.x + ux * stop, cy = tr.y + uy * stop, d = Math.hypot(o.x - cx, o.y - cy) || 1; struck.set(o, { ux: (o.x - cx) / d, uy: (o.y - cy) / d }); }
      }
      if (stop < len) { tr.contactT = t; return { x: tr.x + ux * stop, y: tr.y + uy * stop, g: O.gateMove }; }
      return { x: ex, y: ey, g: O.gateMove + O.gateMoveK * len };
    };
    // pass 1: every visible ball near where it should be
    const p1 = act.filter(tr => tr.state !== 'hidden' && tr.state !== 'pending');
    if (p1.length && spots.length) {
      const Q = p1.map(pred); // (fills struck)
      // a resting ball the rolling one reaches this look may already be on its way: forward along the line of centres
      const cost = p1.map((tr, i) => { const q = Q[i], k = struck.get(tr); return spots.map(sp => {
        const d = Math.hypot(sp.x - q.x, sp.y - q.y); if (d <= q.g) return d;
        if (k && d <= O.launchGate && (sp.x - tr.x) * k.ux + (sp.y - tr.y) * k.uy > 0.5 * d) return 0.5 + 0.1 * d;
        return Infinity; }); });
      assign(cost, p1.length, spots.length).forEach((j, i) => { if (j >= 0) { matched.set(p1[i], j); used[j] = true; } });
    }
    // pass 2: a resting ball that was just struck can be far from where it sat; a ball lost at a pocket or hidden can come back
    const p2 = act.filter(tr => !matched.has(tr) && tr.ok), free = spots.map((s, j) => j).filter(j => !used[j]);
    if (p2.length && free.length) {
      const cost = p2.map(tr => free.map(j => {
        const sp = spots[j], d = dist(sp, tr);
        if (tr.state === 'hidden' || tr.state === 'pending') return d <= O.hiddenGate + (tr.state === 'pending' ? 1.5 : 0) ? d : Infinity;
        if (tr.state === 'rest' || tr.state === 'moving') return d <= O.launchGate ? d + 2 : Infinity; // a far jump costs more than any near match
        return Infinity;
      }));
      assign(cost, p2.length, free.length).forEach((c, i) => { if (c >= 0) { matched.set(p2[i], free[c]); used[free[c]] = true; } });
    }
    // matched balls: position, speed, resting or rolling. A resting ball is rolling once it has left its spot by moveDist
    // (the spot wobbles by a few tenths of an inch from look to look, which must not count); a rolling ball rests again
    // once it has stayed within stopDist for stopSpan seconds.
    for (const [tr, j] of matched) {
      const sp = spots[j], was = tr.state, lastT = tr.seenT, gap = Math.max(0.02, t - lastT);
      // after a contact the old speed says nothing (a head-on hit stops the cue ball dead): take this look's speed alone
      const vx = (sp.x - tr.x) / gap, vy = (sp.y - tr.y) / gap, k = was === 'moving' && tr.contactT !== t ? 0.6 : 1;
      tr.vx = k * vx + (1 - k) * tr.vx; tr.vy = k * vy + (1 - k) * tr.vy;
      tr.x = sp.x; tr.y = sp.y; tr.sp = sp; tr.seenT = t; tr.seen++; tr.lostT = null;
      (tr.hist = tr.hist || []).push({ t, x: sp.x, y: sp.y }); while (tr.hist.length && t - tr.hist[0].t > 1) tr.hist.shift();
      if (sp.p) { tr.nbSum += sp.p[10]; tr.nbN++; }
      if (was === 'pending') { ev('back', { key: tr.key, num: tr.num }); tr.pocket = null; }
      const away = Math.hypot(tr.x - tr.restX, tr.y - tr.restY);
      if (was === 'hidden') { tr.state = 'rest'; tr.restX = tr.x; tr.restY = tr.y; tr.restSince = t; tr.vx = tr.vy = 0; } // found again where it was hidden
      else if (was === 'rest' || (was === 'new' && tr.restSince != null)) {
        if (away > O.moveDist) { tr.state = was === 'new' ? 'new' : 'moving'; tr.movedT = t; tr.restSince = null; tr.vx = (tr.x - tr.restX) / gap; tr.vy = (tr.y - tr.restY) / gap; }
        else { tr.restX += 0.2 * (tr.x - tr.restX); tr.restY += 0.2 * (tr.y - tr.restY); tr.vx = tr.vy = 0; }
      } else {
        // rolling (or a new spot not yet resting): resting once the last stopSpan seconds stayed within stopDist
        const h = tr.hist.filter(q => t - q.t <= O.stopSpan + 0.01);
        const span = h.length >= 2 && t - h[0].t >= O.stopSpan - 0.01 ? Math.max(...h.map(q => Math.hypot(q.x - tr.x, q.y - tr.y))) : 1e9;
        if (span <= O.stopDist) { if (was === 'moving') tr.state = 'rest'; tr.restSince = h[0].t; tr.restX = tr.x; tr.restY = tr.y; tr.vx = tr.vy = 0; }
      }
    }
    // balls not seen this look
    for (const tr of act) {
      if (matched.has(tr)) continue; tr.looks++;
      if (!tr.ok) { if (t - tr.seenT > 0.6) { tr.state = 'dropped'; } continue; }
      if (tr.state === 'pending') { if (t - tr.lostT >= O.pocketWait) pocketed(tr); continue; }
      if (tr.state === 'hidden') continue;
      const pk = tr.state === 'moving' ? pocketFor(tr) : null;
      tr.lostT = t;
      if (pk != null) { tr.state = 'pending'; tr.pocket = pk; ev('lost_at_pocket', { key: tr.key, num: tr.num, pocket: pk }); }
      else { tr.state = 'hidden'; tr.vx = tr.vy = 0; }
    }
    for (const tr of act) if (matched.has(tr)) tr.looks++;
    // new spots: start a candidate; it becomes a ball once it rests and looks like one
    spots.forEach((sp, j) => { if (!used[j]) { const tr = newTrack(sp, t); S.tracks.push(tr); } });
    for (const tr of S.tracks) {
      if (tr.ok || tr.state !== 'new') continue;
      const age = t - tr.firstT, share = tr.seen / Math.max(1, tr.looks), nb = tr.nbN ? tr.nbSum / tr.nbN : 0.5;
      if (age > 6 && !tr.ok) { tr.state = 'dropped'; continue; }
      const rested = tr.restSince != null && t - tr.restSince >= O.newRest;
      const clash = ballsNow().some(o => dist(o, tr) < 1.6 * R);
      if (rested && share >= O.newShare && nb < O.newNb && tr.nbN >= 2 && !clash) { tr.ok = true; tr.state = 'rest'; ev('ball', { key: tr.key, at: [+tr.x.toFixed(1), +tr.y.toFixed(1)] }); }
    }
    S.tracks = S.tracks.filter(tr => tr.state !== 'dropped');
    if (info.read) votes(spots, matched);
    phase(t);
    name();
    return S;
  }

  function pocketed(tr) {
    tr.state = 'gone'; tr.goneT = t0(); const d = { key: tr.key, num: tr.num, sure: tr.sure, pocket: tr.pocket };
    if (tr.num != null && !S.gone.includes(tr.num)) S.gone.push(tr.num);
    ev('pocketed', d); if (S.shot) S.shot.made.push(d);
  }
  const t0 = () => S.t;

  // ---- reader votes: resting balls on their own only ----
  function votes(spots, matched) {
    for (const [tr, j] of matched) {
      const sp = spots[j]; if (!tr.ok || !sp.p || tr.state !== 'rest' || sp.kind === 'not_a_ball') continue;
      // next to another ball the crop shows both: only a sure read counts there (the Oct 20 benchmark: on balls within 2.5
      // radii of another the reader was sure 8 times, all right, and unsure or "not a ball" the other 104 times)
      if (sp.kind !== 'sure' && spots.some((q, i) => i !== j && Math.hypot(q.px - sp.px, q.py - sp.py) < O.touchPx * Math.max(q.r, sp.r))) continue;
      const p = sp.p.slice(0, 10), s = p.reduce((a, b) => a + b, 0) || 1;
      // the owner's cue ball (white, red dots) and the 9 (white, yellow stripe): the colour shares settle a close call
      if (sp.col) {
        const top2 = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, 2).map(x => x[1]).sort().join();
        if (top2 === '0,9') { if (sp.col.y >= 0.1) { p[9] += p[0] * 0.8; p[0] *= 0.2; } else if (sp.col.y < 0.04 && sp.col.w >= 0.35) { p[0] += p[9] * 0.8; p[9] *= 0.2; } }
      }
      for (let i = 0; i < tr.votes.length; i++) tr.votes[i] = tr.votes[i] * O.voteKeep + Math.log(p[O.ids[i]] / s + EPS);
      tr.nVotes = tr.nVotes * O.voteKeep + 1;
    }
  }
  function voteFor(tr, id, w) { const i = O.ids.indexOf(id); for (let k = 0; k < tr.votes.length; k++) tr.votes[k] += w * Math.log(k === i ? 0.9 : 0.1 / (O.ids.length - 1)); tr.nVotes += w; }

  // ---- names: shared out over all balls at once ----
  function name() {
    const balls = ballsNow(), pinned = new Map();
    for (const tr of balls) if (tr.pin != null) pinned.set(tr.pin, tr);
    const free = O.ids.filter(id => !pinned.has(id) && !S.gone.includes(id));
    const open = balls.filter(tr => tr.pin == null && tr.nVotes >= 1.5);
    for (const tr of balls) if (tr.pin != null) { tr.num = tr.pin; tr.sure = true; }
    for (const tr of balls) if (tr.pin == null && tr.nVotes < 1.5 && tr.num != null && (pinned.has(tr.num) || S.gone.includes(tr.num))) { tr.num = null; tr.sure = false; }
    if (open.length && free.length) {
      const avg = tr => id => tr.votes[O.ids.indexOf(id)] / tr.nVotes;
      // a ball hidden for more than 1.5 s gives way to a visible one that fits the same number (it was picked up)
      const hid = tr => tr.state === 'hidden' && S.t - (tr.lostT || S.t) > 1.5 ? 0.7 : 0;
      // one "no number" column per ball, at the cost of a 20% fit: a ball is left unnamed rather than given a poor number
      const NONE = -Math.log(0.2), cost = open.map(tr => free.map(id => -avg(tr)(id) - (tr.num === id ? O.nameBonus : 0) + hid(tr)).concat(open.map(() => NONE)));
      const got = assign(cost, open.length, free.length + open.length);
      open.forEach((tr, i) => {
        const id = got[i] >= 0 && got[i] < free.length ? free[got[i]] : null, pr = id == null ? 0 : Math.exp(avg(tr)(id));
        // a ball whose best fit is poor stays unnamed rather than take a number it does not look like
        if (id == null || pr < 0.2) { if (tr.num != null) ev('unnamed', { key: tr.key, was: tr.num }); tr.num = null; tr.sure = false; return; }
        if (tr.num !== id) ev('named', { key: tr.key, num: id, was: tr.num, p: +pr.toFixed(2) });
        tr.num = id; tr.sure = pr >= 0.6;
      });
    }
    // a hidden ball whose number another ball now clearly holds was picked up (ball in hand, cleared by hand): let it go
    for (const tr of balls) if (tr.state === 'hidden' && tr.num == null && tr.nVotes >= 1.5) { if (S.t - (tr.lostT || S.t) > 3) tr.state = 'dropped'; }
    S.tracks = S.tracks.filter(tr => tr.state !== 'dropped');
  }

  // ---- shots ----
  function phase(t) {
    const balls = ballsNow(), moving = balls.filter(tr => tr.state === 'moving'), pend = balls.filter(tr => tr.state === 'pending');
    if (S.phase === 'still' || S.phase === 'hands') {
      if (!moving.length && !pend.length) { if (S.stillSince == null) S.stillSince = t; if (S.phase === 'hands' && t - S.stillSince >= O.stillHold) { S.phase = 'still'; ev('still', {}); } }
      else if (S.phase === 'still') {
        const armed = S.stillSince != null && t - S.stillSince >= O.stillHold;
        // the first look with motion: one ball rolling on its own (or two, when the cue ball reached the first ball within
        // one look; then the cue ball is the one the votes say, else the one that went further)
        const fresh = moving.filter(tr => tr.movedT === t);
        if (armed && fresh.length >= 1 && fresh.length < O.rackCount && fresh.length === moving.length && Math.max(...fresh.map(speed)) >= O.shotSpeed) {
          const cueOf = tr => tr.pin === 0 ? 9 : tr.nVotes ? tr.votes[O.ids.indexOf(0)] / tr.nVotes : -9;
          const cue = fresh.length === 1 ? fresh[0] : fresh.slice().sort((a, b) => (cueOf(b) - cueOf(a)) || (Math.hypot(b.x - b.restX, b.y - b.restY) - Math.hypot(a.x - a.restX, a.y - a.restY)))[0];
          startShot(cue, t); if (fresh.length === 2) { S.shot.first = fresh.find(tr => tr !== cue).key; }
        } else { S.phase = 'hands'; ev('hands', { n: moving.length, armed }); }
        S.stillSince = null;
      } else S.stillSince = null;
    } else if (S.phase === 'shot') {
      const sh = S.shot;
      // first ball hit: the first other ball to start rolling while the cue ball is next to it
      if (sh.first == null) {
        const cue = S.tracks.find(tr => tr.key === sh.cueKey), went = moving.filter(tr => tr.key !== sh.cueKey && tr.movedT === t);
        if (cue && went.length) { const f = went.sort((a, b) => dist(a, cue) - dist(b, cue))[0]; sh.first = f.key; sh.firstNumAt = f.num; ev('first_hit', { key: f.key, num: f.num }); }
      }
      if (!moving.length && !pend.length) { if (S.stillSince == null) S.stillSince = t; if (t - S.stillSince >= O.endHold) endShot(t); }
      else S.stillSince = null;
    }
  }
  function startShot(tr, t) {
    S.phase = 'shot'; S.stillSince = null;
    if (tr.pin == null) voteFor(tr, 0, O.cueVote);
    // a break: five or more balls packed together (each touching another) when the shot starts
    const packed = ballsNow().filter(a => a !== tr && ballsNow().some(b => b !== a && b !== tr && dist(a, b) < 2 * R + 0.5)).length;
    S.shot = { n: S.shots.length + 1, t0: t, cueKey: tr.key, cueNum: tr.num, first: null, made: [], before: snapshot(), break: packed >= 5 };
    ev('shot', { n: S.shot.n, key: tr.key, num: tr.num, break: S.shot.break });
  }
  function endShot(t) {
    const sh = S.shot; sh.t1 = t; sh.after = snapshot();
    const keyNum = k => { const tr = S.tracks.find(x => x.key === k); return tr ? tr.num : null; };
    // the first ball's number as it was when hit; on a break the pack scatters too fast to follow each ball at this look
    // rate, so a first ball not named before the hit stays unknown rather than take whatever its track ends on
    sh.firstNum = sh.first == null ? null : sh.firstNumAt != null ? sh.firstNumAt : sh.break ? null : keyNum(sh.first); sh.cueNum = keyNum(sh.cueKey);
    sh.scratch = sh.made.some(m => m.key === sh.cueKey);
    for (const m of sh.made) if (m.num == null) m.num = keyNum(m.key);
    sh.hidden = ballsNow().filter(tr => tr.state === 'hidden').length;
    S.shots.push(sh); S.shot = null; S.phase = 'still'; S.stillSince = t;
    ev('shot_end', { n: sh.n, made: sh.made.map(m => m.num), scratch: sh.scratch, first: sh.firstNum, hidden: sh.hidden });
    return sh;
  }
  function snapshot() { return ballsNow().map(tr => ({ key: tr.key, num: tr.num, sure: tr.sure, x: +tr.x.toFixed(2), y: +tr.y.toFixed(2), state: tr.state })); }

  // ---- the player ----
  function pin(key, id) {
    const tr = S.tracks.find(x => x.key === key); if (!tr) return false;
    for (const o of ballsNow()) if (o !== tr && (o.pin === id || o.num === id)) { o.pin = o.pin === id ? null : o.pin; o.num = null; o.sure = false; if (o.state === 'hidden') o.state = 'dropped'; }
    const gi = S.gone.indexOf(id); if (gi >= 0) S.gone.splice(gi, 1); // the player says it is on the table
    tr.pin = id; tr.num = id; tr.sure = true; tr.ok = true; if (tr.state === 'new') tr.state = 'rest';
    ev('tap', { key: tr.key, num: id }); name(); return true;
  }
  function notBall(key) { const tr = S.tracks.find(x => x.key === key); if (!tr) return false; tr.state = 'dropped'; tr.ok = false; ev('not_ball', { key, num: tr.num }); S.tracks = S.tracks.filter(x => x !== tr); name(); return true; }
  function inPocket(key) { const tr = S.tracks.find(x => x.key === key); if (!tr) return false; tr.pocket = null; ev('tap_pocketed', { key, num: tr.num }); pocketed(tr); name(); return true; }
  function newRack() { for (const tr of S.tracks) tr.state = 'dropped'; S.tracks = []; S.gone = []; S.phase = 'hands'; S.stillSince = null; S.shot = null; ev('new_rack', {}); }

  return { S, O, update, pin, notBall, inPocket, newRack, balls: ballsNow, snapshot };
}
if (typeof module !== 'undefined') module.exports = { makeTracker };
