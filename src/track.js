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
    newRest: 0.6,       // s something new must rest on one spot before it counts as a ball
    newShare: 0.7,      // share of looks it must be seen in over that time
    newNb: 0.5,         // its average "not a ball" from the reader must stay under this
    touchPx: 2.3,       // spot radii between centres: closer than this, the reader's crop also shows the neighbour
    voteKeep: 0.94,     // each new vote: old votes count this much less, so later evidence can win
    nameBonus: 0.25,    // a ball keeps its name unless another fits better by this much (average log-probability)
    rackCount: 3,       // this many balls starting to move on the same look without one first = hands or racking
    cueVote: 1.5,       // the first mover of a shot counts as this many votes for the cue ball (unless its reads clearly say otherwise)
    reread: 0.3,        // after a shot, the votes of every ball that moved count this much: it is read again at rest
    reconWait: 2.5,
    cueCost: 10,        // in-equivalent cost per unit of white/not-white mismatch between a ball and a spot (see whiteness)
    cueVeto: 0.7,       // a far jump (launch, refind) is refused when they disagree by more than this     // s after a shot ends, once the moved balls are read again, unfollowed pocket entries are matched up
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
  // White or not: the one thing about a ball that stays readable when it is blurred. A ball's whiteness comes from its tap
  // or its votes; a spot's from the reader on this look (cue share among the ball classes). In a collision the cue ball
  // often blurs out for a look and the struck ball's track grabbed the white spot left behind (Oct 27: the cue ball called
  // in, the struck ball left on the table), so matching weighs this.
  const whiteOf = tr => tr.pin === 0 ? 1 : tr.pin != null ? 0 : tr.nVotes >= 1.5 ? Math.exp(tr.votes[O.ids.indexOf(0)] / tr.nVotes) : null;
  const whiteSp = sp => sp.p && sp.p[10] < 0.5 ? sp.p[0] / (1 - sp.p[10]) : null; // a blurred "not a ball" read says nothing
  const wGap = (tr, sp) => { const a = whiteOf(tr), b = whiteSp(sp); return a == null || b == null ? 0 : Math.abs(a - b); };

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
    return { key: ++keyN, x: sp.x, y: sp.y, vx: 0, vy: 0, state: 'new', ok: false, firstT: t, seenT: t, looks: 1, seen: 1, nbSum: sp.p ? sp.p[10] : 0, nbN: sp.p ? 1 : 0, wS: whiteSp(sp) || 0, wN: whiteSp(sp) == null ? 0 : 1,
      restX: sp.x, restY: sp.y, restSince: t, hist: [{ t, x: sp.x, y: sp.y }], votes: new Float64Array(O.ids.length), nVotes: 0, num: null, sure: false, pin: null, lostT: null, pocket: null, sp };
  }
  function pocketNear(x, y) {
    let best = null, bd = 1e9; for (let i = 0; i < P.pockets.length; i++) { const pk = P.pockets[i], d = Math.hypot(x - pk.x, y - pk.y) - pk.r; if (d < bd) { bd = d; best = i; } }
    return { i: best, d: bd };
  }
  // the pocket a rolling ball was heading into when it was lost: near one now, or reaching one before the next look or two
  // (the phone looks every 0.23 s; a ball at 60 in/s is 14 in further on by then). Straight on, slowing; not through a cushion.
  function pocketFor(tr) {
    const now = pocketNear(tr.x, tr.y); if (now.d <= O.pocketZone) return now.i;
    const v = speed(tr); if (v < O.moveSpeed) return null;
    for (let dt = 0.05; dt <= 0.5; dt += 0.05) {
      const k = Math.max(0, 1 - 0.1 * dt), x = tr.x + tr.vx * dt * k, y = tr.y + tr.vy * dt * k, q = pocketNear(x, y);
      if (q.d <= O.pocketZone - 1.5) return q.i;
      if (x < -1 || y < -1 || x > L + 1 || y > W + 1) break; // it would have hit a cushion first
    }
    return null;
  }

  // ---- one look ----
  function update(t, spotsIn, info) {
    const dt = S.t ? Math.max(0.02, t - S.t) : 0.1; S.t = t; info = info || {};
    // spots on the cloth only (balls in a pocket bag, on the rail or on the floor fall outside), and one spot per ball (the
    // finder can put two boxes on one ball in a bunch). A ball's centre is at least a radius in from the cushion, but the
    // outline can be an inch off (Oct 27: the 9 frozen to the near rail came out 0.3 in from it, was dropped as "off the
    // cloth" every other look, lost its name and could not be tapped), so the margin is wide, except near the pockets.
    const spots = [];
    for (const sp of spotsIn.slice().sort((a, b) => (b.score || 0) - (a.score || 0))) {
      const m = pocketNear(sp.x, sp.y).d < 3 ? R + 0.6 : R + 1.2; // at a pocket a ball in the mouth can sit right on the line
      if (sp.x < R - m || sp.y < R - m || sp.x > L - R + m || sp.y > W - R + m) continue;
      if (spots.some(q => Math.hypot(q.px - sp.px, q.py - sp.py) < 0.5 * Math.min(q.r, sp.r))) continue;
      spots.push(sp);
    }
    const act = S.tracks.filter(live), used = new Array(spots.length).fill(false), matched = new Map();
    // where each ball should be now. A rolling ball cannot pass through a resting one: if its path this look runs into one,
    // it is expected at the contact point (without this the cue ball's track took the struck ball's spot: a name swap)
    const rest = act.filter(tr => tr.ok && tr.state === 'rest'), struck = new Map(); // resting ball -> direction it is knocked
    const pred = tr => {
      // a new spot that is rolling (a ball seen again mid-roll, a ball just set down) is followed like a rolling ball
      if (tr.state === 'new' && tr.restSince == null && tr.seen >= 2) return { x: tr.x + tr.vx * dt, y: tr.y + tr.vy * dt, g: O.gateMove + O.gateMoveK * speed(tr) * dt };
      if (tr.state !== 'moving') return { x: tr.x, y: tr.y, g: O.gateRest };
      const ex = tr.x + tr.vx * dt, ey = tr.y + tr.vy * dt, len = Math.hypot(ex - tr.x, ey - tr.y) || 1e-6, ux = (ex - tr.x) / len, uy = (ey - tr.y) / len;
      let stop = len;
      for (const o of rest) {
        if (o === tr) continue; const ax = o.x - tr.x, ay = o.y - tr.y, along = ax * ux + ay * uy, side = Math.abs(ax * uy - ay * ux);
        if (along <= 0 || side >= 2 * R) continue; const c = along - Math.sqrt(4 * R * R - side * side);
        if (c < stop) { stop = Math.max(0, c); const cx = tr.x + ux * stop, cy = tr.y + uy * stop, d = Math.hypot(o.x - cx, o.y - cy) || 1; struck.set(o, { ux: (o.x - cx) / d, uy: (o.y - cy) / d }); }
      }
      if (stop < len) { tr.contactT = t; tr.contactP = { x: tr.x + ux * stop, y: tr.y + uy * stop }; return { x: tr.contactP.x, y: tr.contactP.y, g: O.gateMove }; }
      return { x: ex, y: ey, g: O.gateMove + O.gateMoveK * len };
    };
    // pass 1: every visible ball near where it should be
    const p1 = act.filter(tr => tr.state !== 'hidden' && tr.state !== 'pending');
    for (const tr of act) if (tr.state === 'new' && tr.restSince == null && tr.hist && tr.hist.length >= 2) { const a = tr.hist[tr.hist.length - 2], b = tr.hist[tr.hist.length - 1], g = Math.max(0.02, b.t - a.t); tr.vx = (b.x - a.x) / g; tr.vy = (b.y - a.y) / g; }
    if (p1.length && spots.length) {
      const Q = p1.map(pred); // (fills struck)
      // a resting ball the rolling one reaches this look may already be on its way: forward along the line of centres
      const cost = p1.map((tr, i) => { const q = Q[i], k = struck.get(tr); return spots.map(sp => {
        const d = Math.hypot(sp.x - q.x, sp.y - q.y), w = wGap(tr, sp); if (d <= q.g) return d + O.cueCost * w;
        if (k && d <= O.launchGate && (sp.x - tr.x) * k.ux + (sp.y - tr.y) * k.uy > 0.5 * d && w <= O.cueVeto) return 0.5 + 0.1 * d + O.cueCost * w;
        return Infinity; }); });
      assign(cost, p1.length, spots.length).forEach((j, i) => { if (j >= 0) { matched.set(p1[i], j); used[j] = true; } });
    }
    // pass 2: a resting ball that was just struck can be far from where it sat; a ball lost at a pocket or hidden can come back
    // (and a spot seen once, just now, may be a ball already rolling fast: its next spot can be well away)
    const p2 = act.filter(tr => !matched.has(tr) && (tr.ok || (tr.state === 'new' && tr.seen === 1 && t - tr.firstT < 0.5))), free = spots.map((s, j) => j).filter(j => !used[j]);
    if (p2.length && free.length) {
      const cost = p2.map(tr => free.map(j => {
        const sp = spots[j], d = dist(sp, tr), w = wGap(tr, sp); if (w > O.cueVeto) return Infinity;
        // lost while rolling: it may have rolled on while unseen, up to its speed times the time since (Oct 27: the cue
        // ball lost near a corner and seen again 8 in on was taken for something new, and then called pocketed)
        if (tr.knock && tr.state === 'pending' && (sp.x - tr.x) * tr.knock.ux + (sp.y - tr.y) * tr.knock.uy < -0.5) return Infinity; // a knocked ball goes away from what hit it
        if (tr.state === 'hidden' || tr.state === 'pending') { const reach = O.hiddenGate + (tr.vLost || 0) * Math.min(1.5, S.t - (tr.lostT || S.t)) + (tr.state === 'pending' ? 1.5 : 0); return d <= Math.min(24, reach) ? d + O.cueCost * w : Infinity; }
        if (tr.state === 'rest' || tr.state === 'moving') return d <= O.launchGate ? d + 2 + O.cueCost * w : Infinity; // a far jump costs more than any near match
        if (tr.state === 'new') return d <= 30 ? d + 3 : Infinity;
        return Infinity;
      }));
      assign(cost, p2.length, free.length).forEach((c, i) => { if (c >= 0) { matched.set(p2[i], free[c]); used[free[c]] = true; } });
    }
    // a rolling ball whose path this look ran into a resting ball that has now moved (or vanished) hit it, wherever the
    // prediction put the contact: the speeds below are then measured from the contact
    for (const [tr, j] of matched) {
      if (tr.state !== 'moving' || tr.contactT === t) continue;
      const sp = spots[j], len = Math.hypot(sp.x - tr.x, sp.y - tr.y); if (len < 2 * R) continue; const ux = (sp.x - tr.x) / len, uy = (sp.y - tr.y) / len;
      let best = null;
      for (const o of rest) {
        if (o === tr) continue; const m = matched.get(o); if (m != null && Math.hypot(spots[m].x - o.x, spots[m].y - o.y) <= O.moveDist) continue;
        const ax = o.x - tr.x, ay = o.y - tr.y, along = ax * ux + ay * uy, side = Math.abs(ax * uy - ay * ux);
        if (along <= 0 || side >= 2 * R) continue; const c = along - Math.sqrt(4 * R * R - side * side);
        if (c <= len + R && (!best || c < best.c)) best = { c, o };
      }
      if (best) { const c = Math.max(0, Math.min(len, best.c)); tr.contactT = t; tr.contactP = { x: tr.x + ux * c, y: tr.y + uy * c }; if (!struck.has(best.o)) struck.set(best.o, null); }
    }
    // matched balls: position, speed, resting or rolling. A resting ball is rolling once it has left its spot by moveDist
    // (the spot wobbles by a few tenths of an inch from look to look, which must not count); a rolling ball rests again
    // once it has stayed within stopDist for stopSpan seconds.
    for (const [tr, j] of matched) {
      const sp = spots[j], was = tr.state, lastT = tr.seenT, gap = Math.max(0.02, t - lastT);
      // after a contact the old speed says nothing (a head-on hit stops the cue ball dead): take this look's speed alone
      // nor after a cushion: a speed that turned round is taken as it is (Oct 27: the cue ball came back off the end rail
      // and its smoothed speed still pointed at the rail, so its track took a ball resting there instead)
      // Both balls' speeds are then measured from the contact, taken as halfway through the gap (Oct 27: the cue ball kept
      // its speed into the 4 and the 4 half its real speed, so the next look swapped them and the 4 going in was "cue in")
      const c = tr.contactT === t && tr.contactP, from = c || tr, g2 = c ? gap / 2 : gap;
      const vx = (sp.x - from.x) / g2, vy = (sp.y - from.y) / g2, k = was === 'moving' && !c && vx * tr.vx + vy * tr.vy > 0 ? 0.6 : 1;
      tr.vx = k * vx + (1 - k) * tr.vx; tr.vy = k * vy + (1 - k) * tr.vy;
      tr.x = sp.x; tr.y = sp.y; tr.sp = sp; tr.seenT = t; tr.seen++; tr.lostT = null;
      (tr.hist = tr.hist || []).push({ t, x: sp.x, y: sp.y }); while (tr.hist.length && t - tr.hist[0].t > 1) tr.hist.shift();
      if (sp.p) { tr.nbSum += sp.p[10]; tr.nbN++; } if (whiteSp(sp) != null) { tr.wS += whiteSp(sp); tr.wN++; }
      // seen again after it was lost at a pocket: it did not go in (yet); back to rolling, and the rest test below decides
      if (was === 'pending') { ev('back', { key: tr.key, num: tr.num }); tr.pocket = null; tr.state = 'moving'; }
      const away = Math.hypot(tr.x - tr.restX, tr.y - tr.restY);
      if (was === 'hidden') { tr.state = 'rest'; tr.restX = tr.x; tr.restY = tr.y; tr.restSince = t; tr.vx = tr.vy = 0; } // found again where it was hidden
      else if (was === 'rest' || (was === 'new' && tr.restSince != null)) {
        if (away > O.moveDist) { const g3 = struck.has(tr) ? gap / 2 : gap; tr.state = was === 'new' ? 'new' : 'moving'; tr.movedT = t; tr.restSince = null; tr.vx = (tr.x - tr.restX) / g3; tr.vy = (tr.y - tr.restY) / g3; }
        else { tr.restX += 0.2 * (tr.x - tr.restX); tr.restY += 0.2 * (tr.y - tr.restY); tr.vx = tr.vy = 0; }
      } else {
        // rolling (or a new spot not yet resting): resting once it stayed within stopDist for at least stopSpan seconds,
        // measured over as many looks as that takes (the owner's phone looks every 0.23 s: two looks in a row never
        // spanned 0.3 s, so a stopped ball stayed "rolling" until it happened to be hidden)
        let i = tr.hist.length - 1; while (i > 0 && t - tr.hist[i].t < O.stopSpan - 0.01) i--;
        const h = tr.hist.slice(i), span = h.length >= 2 && t - h[0].t >= O.stopSpan - 0.01 ? Math.max(...h.map(q => Math.hypot(q.x - tr.x, q.y - tr.y))) : 1e9;
        if (span <= O.stopDist) { if (was === 'moving') tr.state = 'rest'; tr.restSince = h[0].t; tr.restX = tr.x; tr.restY = tr.y; tr.vx = tr.vy = 0; }
      }
    }
    // balls not seen this look
    for (const tr of act) {
      if (matched.has(tr)) continue; tr.looks++;
      if (!tr.ok) {
        // something not yet confirmed as a ball, rolling, lost at a pocket during a shot: a ball going in that the tracker
        // could not follow (in a collision two tracks can swap, and the real ball shows up only once or twice). Noted;
        // which ball it was is worked out by counting once the table is still (see reconcile). Seen once, by a pocket, is enough.
        if (S.shot && !tr.anon && tr.seen <= 4 && tr.nbN < 2) { const near = pocketNear(tr.x, tr.y), pk = near.d <= O.pocketZone ? near.i : speed(tr) >= O.moveSpeed ? pocketFor(tr) : null; if (pk != null) { tr.anon = true; S.shot.anon.push({ pocket: pk, t, at: [+tr.x.toFixed(1), +tr.y.toFixed(1)] }); ev('anon_entry', { pocket: pk, at: [+tr.x.toFixed(1), +tr.y.toFixed(1)] }); } }
        if (t - tr.seenT > 0.6) { tr.state = 'dropped'; } continue;
      }
      if (tr.state === 'pending') { if (t - tr.lostT >= O.pocketWait) pocketed(tr); continue; }
      if (tr.state === 'hidden') continue;
      let pk = tr.state === 'moving' ? pocketFor(tr) : null, hit = null;
      // a resting ball by a pocket that vanished just as another ball reached it was knocked in before the next look
      // (Oct 27: the 6, 3 in from the corner, gone in one look; it was left "hidden" and the shot showed nothing made).
      // Closer than two radii is not a hit but two touching balls found as one.
      if (tr.state === 'rest' && S.shot) {
        const near = pocketNear(tr.x, tr.y);
        const still = new Set([...matched].filter(([o]) => o.state === 'rest').map(([, j]) => j));
        if (near.d <= O.pocketZone) spots.forEach((sp, j) => { const d = Math.hypot(sp.x - tr.x, sp.y - tr.y); if (!hit && !still.has(j) && d <= 2 * R + 2.5 && d >= 2 * R - 0.2) { pk = near.i; hit = { ux: (tr.x - sp.x) / d, uy: (tr.y - sp.y) / d }; } });
      }
      tr.lostT = t; tr.vLost = tr.state === 'moving' ? speed(tr) : 0; tr.knock = hit;
      if (pk != null) { tr.state = 'pending'; tr.pocket = pk; ev('lost_at_pocket', { key: tr.key, num: tr.num, pocket: pk }); }
      else { tr.state = 'hidden'; tr.vx = tr.vy = 0; }
    }
    for (const tr of act) if (matched.has(tr)) tr.looks++;
    relink(t);
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

  // A hard-hit ball can be 2 ft from its spot by the next look (Oct 27: the cue ball went 24 in in 0.26 s): its resting track
  // goes hidden and the rolling ball shows up as something new, so no shot started. When a new spot has been seen twice,
  // rolling, and exactly one ball went hidden just before it appeared, from a spot the new one could have come from at its
  // speed, they are the same ball: the hidden one takes over and is rolling from then on.
  function relink(t) {
    for (const nw of S.tracks) {
      if (nw.ok || nw.state !== 'new' || nw.restSince != null || nw.seen !== 2 || !nw.hist || nw.hist.length < 2) continue;
      const v = Math.hypot(nw.vx, nw.vy); if (v < O.shotSpeed * 2) continue;
      // reach: a struck ball is fastest at first (up to well over 100 in/s), so its speed now says little about how far it got
      const first = nw.hist[0], cand = ballsNow().filter(o => o.state === 'hidden' && o.lostT != null && first.t - o.lostT >= -0.05 && first.t - o.lostT <= 0.8 &&
        Math.hypot(first.x - o.x, first.y - o.y) <= Math.max(v, 80) * (first.t - o.lostT + 0.3) + 6);
      // two balls went hidden (the cue ball and the ball it sent out of sight): white or not tells which one this is
      if (cand.length > 1 && nw.wN) { const w = nw.wS / nw.wN; for (let i = cand.length - 1; i >= 0; i--) { const a = whiteOf(cand[i]); if (a != null && Math.abs(a - w) > O.cueVeto) cand.splice(i, 1); } }
      if (cand.length !== 1) continue;
      const o = cand[0]; ev('relink', { key: o.key, num: o.num, from: [+o.x.toFixed(1), +o.y.toFixed(1)], to: [+nw.x.toFixed(1), +nw.y.toFixed(1)] });
      Object.assign(o, { x: nw.x, y: nw.y, vx: nw.vx, vy: nw.vy, state: 'moving', movedT: t, restSince: null, lostT: null, seenT: t, sp: nw.sp, hist: nw.hist.slice() });
      nw.state = 'dropped';
    }
    S.tracks = S.tracks.filter(tr => tr.state !== 'dropped');
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

  // ---- after a shot: balls that went in unfollowed, by counting ----
  // A pocket entry by something the tracker could not follow (anon) is a made ball whose name was lost. Once the moved balls
  // have been read again at rest: the numbers on the table before the shot that no ball holds now, and that were not
  // already counted in, went in. Only when the count matches the entries exactly; otherwise nothing is inferred.
  function reconcile(t) {
    const R0 = S.recon; if (!R0 || t < R0.t) return; S.recon = null; const sh = R0.sh;
    if (S.phase !== 'still') return; // another shot already started: leave it
    const held = new Set(ballsNow().filter(b => b.num != null).map(b => b.num)), done = new Set(sh.made.map(m => m.num));
    const missing = [...new Set(sh.before.filter(b => b.num != null && b.num !== 0).map(b => b.num))].filter(n => !held.has(n) && !done.has(n) && !S.gone.includes(n));
    // a "made" call on a ball whose number is still on the table (a name swap) frees one entry for a missing number
    const wrong = sh.made.filter(m => m.num != null && held.has(m.num) && m.num !== 0);
    ev('reconcile', { n: sh.n, anon: sh.anon.length, missing, wrong: wrong.map(m => m.num) });
    if (!missing.length || missing.length !== sh.anon.length) return;
    missing.forEach((num, i) => { const e = sh.anon[i], d = { key: null, num, sure: false, pocket: missing.length === 1 ? e.pocket : null, inferred: true }; sh.made.push(d); S.gone.push(num); ev('made_inferred', { n: sh.n, num, pocket: d.pocket }); });
    sh.updated = t;
  }

  // ---- shots ----
  function phase(t) {
    reconcile(t);
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
    const cueFit = tr.nVotes >= 3 ? Math.exp(tr.votes[O.ids.indexOf(0)] / tr.nVotes) : 1;
    if (tr.pin == null && cueFit >= 0.05) voteFor(tr, 0, O.cueVote);
    // a break: five or more balls packed together (each touching another) when the shot starts
    const packed = ballsNow().filter(a => a !== tr && ballsNow().some(b => b !== a && b !== tr && dist(a, b) < 2 * R + 0.5)).length;
    S.shot = { n: S.shots.length + 1, t0: t, cueKey: tr.key, cueNum: tr.num, first: null, made: [], anon: [], before: snapshot(), break: packed >= 5 };
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
    // every ball that moved is read again now that it rests: two tracks can swap balls in a collision or a near miss, and
    // old votes would keep the wrong name for many looks (Oct 27: the 3's track became the "cue ball"). A tap on a ball
    // that then moved becomes strong votes instead of a fixed name, so a swap cannot carry it to the wrong ball.
    for (const tr of ballsNow()) {
      if (!(tr.movedT >= sh.t0)) continue;
      for (let i = 0; i < tr.votes.length; i++) tr.votes[i] *= O.reread; tr.nVotes *= O.reread;
      if (tr.pin != null) { const id = tr.pin; tr.pin = null; voteFor(tr, id, 4); }
    }
    S.shots.push(sh); S.shot = null; S.phase = 'still'; S.stillSince = t;
    if (sh.anon.length) S.recon = { sh, t: t + O.reconWait };
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
