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
    cueFirst: true,     // a shot starts with the cue ball: a first mover that is not, with the cue ball still elsewhere, is a hand
    setupDrop: true,    // till a rack's first real shot, the cue ball rolling on its own (nothing else moved, nothing in) is a hand
    autoRack: true,     // only the cue ball left, still for rackHold s after a shot: the rack is done (see phase)
    rackHold: 2,
    cueWait: 2,         // s more, at most, while something new may be the cue ball called in (see cueComing)
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
    cueVeto: 0.7,       // a far jump (launch, refind) is refused when they disagree by more than this
    emptyLooks: 3,      // a hidden ball whose spot shows bare cloth on this many looks in a row ...
    emptyHold: 1.5,     // ... and that has been gone this many s is not there any more (see clearGone)
    afterHold: 1.0,     // s after a shot ends before a ball gone from it is counted in (the moved balls are named again first)
    newcomerWait: 8,    // s it waits longer while a ball not yet named, that turned up since, could be the same one
    jawZone: 1.2,       // in past a pocket's circle: a ball resting this deep in the mouth that vanishes in a shot went in
    jumpGap: 0.45,      // s: a ball seen again this soon after it vanished, far off and reading the same, jumped there in one look
    jumpSpeed: 20,      // in/s it must have covered that distance at, at least
    readReach: 150,     // in/s: a rolling ball read as its own number this look can be this far from its last spot
    readCost: 2.5,      // in-equivalent cost of a sure read of another number on a ball's spot (any pair, the 9 and the cue ball too)
    touchHold: 0.7,     // s after a finger on the screen before a shot can start
    sitOn: 1.5,         // in: a hidden ball this close to a ball that has sat still for sitHold s is not there (see sitsOn)
    sitHold: 2,
    bagScore: 0.6,      // a spot on a pocket's bag line (see setBags) scoring under this is a ball lying in that pocket
    bagDist: 1.5,       // in from the line
    bags: [],
    ids: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  }, opts || {});
  const R = P.R, L = P.L, W = P.W, EPS = 1e-4;
  let keyN = 0;
  const S = { t: 0, tracks: [], phase: 'still', stillSince: null, shot: null, shots: [], gone: [], events: [], lastNames: '', bagT: {}, bagNew: {}, notes: [], say: [], touchT: -9, rackAt: 0, setup: true }; // notes: made balls found after their shot ended, for the app to tell; say: rack done / not a shot, for the app
  const ev = (k, d) => { const e = Object.assign({ t: +S.t.toFixed(2), k }, d); S.events.push(e); if (S.events.length > 3000) S.events.splice(0, 300); return e; };
  const live = tr => tr.state !== 'gone' && tr.state !== 'dropped';
  const ballsNow = () => S.tracks.filter(tr => tr.ok && live(tr));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const speed = tr => Math.hypot(tr.vx, tr.vy);
  // White or not: the one thing about a ball that stays readable when it is blurred. A ball's whiteness comes from its tap
  // or its votes; a spot's from the reader on this look (cue share among the ball classes). In a collision the cue ball
  // often blurs out for a look and the struck ball's track grabbed the white spot left behind (Oct 27: the cue ball called
  // in, the struck ball left on the table), so matching weighs this. The 9 counts as white here: the owner's 9 is a white
  // ball with a yellow band, and the reader takes the cue ball for the 9 now and then (Oct 26: the resting cue ball read
  // "9, sure" once and its own track refused the spot). Cue ball or 9 is settled by the votes and the colour shares.
  const wIds = [O.ids.indexOf(0), O.ids.indexOf(9)].filter(i => i >= 0);
  const whiteOf = tr => tr.pin === 0 || tr.pin === 9 ? 1 : tr.pin != null ? 0 : tr.nVotes >= 1.5 ? wIds.reduce((a, i) => a + Math.exp(tr.votes[i] / tr.nVotes), 0) : null;
  const whiteSp = sp => sp.p && sp.p[10] < 0.5 ? (sp.p[0] + sp.p[9]) / (1 - sp.p[10]) : null; // a blurred "not a ball" read says nothing
  const topNum = p => { let b = 0; for (let i = 1; i < 10; i++) if (p[i] > p[b]) b = i; return b; };
  const wGap = (tr, sp) => { const a = whiteOf(tr), b = whiteSp(sp); return a == null || b == null ? 0 : Math.abs(a - b); };
  // The reader also runs on rolling balls, and on the owner's phone it is sure of most of them even blurred (Oct 28: on a
  // hard hit, 3,124 of 3,215 spots during shots read "sure"). The finder saw the balls on almost every look; the tracker
  // lost them, because they had gone further, or off a cushion, than it allowed for. A sure read of a ball's own number
  // ties a spot to it; a sure read of another number (not one the reader mixes up with it) rules the spot out for a ball
  // in motion. The 9 is read as the cue ball or the 1 now and then (white with a yellow band).
  const readOf = sp => sp.kind === 'sure' && sp.p ? topNum(sp.p) : null;
  const named = tr => tr.num != null && (tr.pin != null || tr.sure);
  const mixed = (a, b) => (a === 9 && (b === 0 || b === 1)) || (b === 9 && (a === 0 || a === 1));
  const readSame = (tr, sp) => named(tr) && readOf(sp) === tr.num;
  const readOther = (tr, sp) => { const r = readOf(sp); return named(tr) && r != null && r !== tr.num && !mixed(r, tr.num); };

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
      restX: sp.x, restY: sp.y, restSince: t, hist: [{ t, x: sp.x, y: sp.y }], votes: new Float64Array(O.ids.length), nVotes: 0, num: null, sure: false, pin: null, lostT: null, pocket: null, sp,
      rd: readOf(sp) == null ? [] : [readOf(sp)] };
  }
  function bagOf(sp) {
    for (const b of O.bags) { const dx = b.bx - b.ax, dy = b.by - b.ay, u = Math.max(0, Math.min(1, ((sp.x - b.ax) * dx + (sp.y - b.ay) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(sp.x - b.ax - u * dx, sp.y - b.ay - u * dy) <= O.bagDist) return b.i; }
    return null;
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
      // a ball lying in a far pocket: not on the table, but a sign that a ball went into that pocket
      const bag = (sp.score == null ? 1 : sp.score) < O.bagScore ? bagOf(sp) : null;
      if (bag != null) { if (!(t - (S.bagT[bag] || -9) < 1.5)) { S.bagNew[bag] = t; ev('in_pocket_seen', { pocket: bag }); } S.bagT[bag] = t; continue; }
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
      // off a cushion it comes back the other way (Oct 28: the cue ball hit hard went across the table and back four
      // times, and was lost at every cushion), unless it is heading into a pocket
      const bx = ex < R ? 2 * R - ex : ex > L - R ? 2 * (L - R) - ex : ex, by = ey < R ? 2 * R - ey : ey > W - R ? 2 * (W - R) - ey : ey;
      if ((bx !== ex || by !== ey) && pocketNear(ex, ey).d > 2) return { x: bx, y: by, g: O.gateMove + O.gateMoveK * len };
      return { x: ex, y: ey, g: O.gateMove + O.gateMoveK * len };
    };
    // pass 1: every visible ball near where it should be
    const p1 = act.filter(tr => tr.state !== 'hidden' && tr.state !== 'pending');
    // the cue ball out of sight, or gone from its resting spot this very look (struck hard, it is already somewhere else)
    const cueTr = act.find(tr => tr.ok && tr.num === 0), cueAway = !cueTr || cueTr.state === 'hidden' || cueTr.state === 'pending' ||
      (cueTr.state === 'rest' && !spots.some(sp => Math.hypot(sp.x - cueTr.x, sp.y - cueTr.y) <= O.gateRest));
    // (only when one spot alone reads as the cue ball: a shaken or blurred look can read two balls that way)
    const oneCue = spots.filter(sp => readOf(sp) === 0).length === 1;
    const notCue = (tr, sp) => tr.state === 'rest' && cueAway && oneCue && readOf(sp) === 0 && named(tr) && tr.num !== 0 && (tr.num === 9 ? cueTr && cueTr.state === 'rest' : whiteOf(tr) != null && whiteOf(tr) < 0.2);
    const readPen = (tr, sp) => named(tr) && readOf(sp) != null && readOf(sp) !== tr.num ? O.readCost : 0;
    for (const tr of act) if (tr.state === 'new' && tr.restSince == null && tr.hist && tr.hist.length >= 2) { const a = tr.hist[tr.hist.length - 2], b = tr.hist[tr.hist.length - 1], g = Math.max(0.02, b.t - a.t); tr.vx = (b.x - a.x) / g; tr.vy = (b.y - a.y) / g; }
    if (p1.length && spots.length) {
      const Q = p1.map(pred); // (fills struck)
      // a resting ball the rolling one reaches this look may already be on its way: forward along the line of centres
      const cost = p1.map((tr, i) => { const q = Q[i], k = struck.get(tr); return spots.map(sp => {
        const d = Math.hypot(sp.x - q.x, sp.y - q.y), w = wGap(tr, sp);
        // for a rolling ball, a sure read of the other colour is not this ball, even close by (Oct 27: the cue ball drew back
        // off the 2, gone into the corner before the next look, and the 2's track took the cue ball: "cue in"). Not for a
        // resting ball on its own spot: one sure misread there (the 9 read "7") would push it off.
        if (tr.state === 'moving' && sp.kind === 'sure' && (w > O.cueVeto || readOther(tr, sp))) return Infinity;
        // the cue ball, unseen (behind the cue or a hand) and struck hard, can reach a resting ball before the next look;
        // that ball is gone from its spot by then and the cue ball sits there (Oct 28: the 8's track took the cue ball and the
        // shot was followed as the 8 struck). A sure white read on the spot of a ball that is not white is not that ball.
        // The 9 too, when the cue ball has just left its spot (Oct 29: the cue ball went 17 in to the 9 between two looks)
        if (notCue(tr, sp)) return Infinity;
        // A sure read of another number costs a match, even for the 9 and the cue ball, which the reader mixes up now and then:
        // alone on its spot a ball still takes it, but a ball arriving there read as itself wins it (Oct 29: the cue ball hit
        // the 9 hard and sat on the 9's spot by the next look, read "cue ball"; the 9's track took it, and the cue ball's
        // track then took the 9 rolling away: the 9 going in was called a scratch, three times)
        const rp = readPen(tr, sp);
        if (d <= q.g) return d + O.cueCost * w + rp;
        // a rolling ball read as its own number: further on than the prediction allows (faster, or off a cushion)
        if (tr.state === 'moving' && readSame(tr, sp) && dist(sp, tr) <= O.readReach * dt + O.gateMove) return O.gateMove + 0.5 * Math.min(d, dist(sp, tr)) + O.cueCost * w;
        if (k && d <= O.launchGate && (sp.x - tr.x) * k.ux + (sp.y - tr.y) * k.uy > 0.5 * d && w <= O.cueVeto) return 0.5 + 0.1 * d + O.cueCost * w + rp;
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
        if (tr.state === 'rest' || tr.state === 'moving') {
          if (notCue(tr, sp)) return Infinity;
          if (d <= O.launchGate) return d + 2 + O.cueCost * w + readPen(tr, sp); // a far jump costs more than any near match
          // the cue ball struck hard is past the launch gate by the next look (Oct 28: 27 in in 0.28 s, next to the 9 it hit)
          return tr.num === 0 && readSame(tr, sp) && d <= O.readReach * dt + O.gateMove ? d + 2 + O.cueCost * w : Infinity;
        }
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
      if (!tr.ok && sp.p && sp.kind === 'sure') (tr.rd = tr.rd || []).push(topNum(sp.p));
      tr.emptyN = 0;
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
      if (tr.state === 'pending') { if (t - tr.lostT >= O.pocketWait || S.bagNew[tr.pocket] >= tr.lostT - 0.3) pocketed(tr); continue; }
      if (tr.state === 'hidden') continue;
      let pk = tr.state === 'moving' ? pocketFor(tr) : null, hit = null;
      // a resting ball by a pocket that vanished just as another ball reached it was knocked in before the next look
      // (Oct 27: the 6, 3 in from the corner, gone in one look; it was left "hidden" and the shot showed nothing made).
      // Closer than two radii is not a hit but two touching balls found as one.
      // The direction it was knocked is kept either way: it says which pocket it could have reached (see clearGone).
      if (tr.state === 'rest') {
        const near = pocketNear(tr.x, tr.y);
        const still = new Set([...matched].filter(([o]) => o.state === 'rest').map(([, j]) => j));
        spots.forEach((sp, j) => { const d = Math.hypot(sp.x - tr.x, sp.y - tr.y); if (!hit && !still.has(j) && d <= 2 * R + 2.5 && d >= 2 * R - 0.2) hit = { ux: (tr.x - sp.x) / d, uy: (tr.y - sp.y) / d }; });
        if (!hit && struck.get(tr)) hit = struck.get(tr);
        if (S.shot && hit && near.d <= O.pocketZone) pk = near.i;
        // sitting in the mouth of a pocket: gone in a shot is in (Oct 27: the 1 in the jaws, hit by the cue ball)
        if (S.shot && pk == null && near.d <= O.jawZone) pk = near.i;
      }
      tr.lostT = t; tr.vLost = tr.state === 'moving' ? speed(tr) : 0; tr.knock = hit;
      if (pk != null) { tr.state = 'pending'; tr.pocket = pk; ev('lost_at_pocket', { key: tr.key, num: tr.num, pocket: pk }); }
      else { tr.state = 'hidden'; tr.vx = tr.vy = 0; tr.onBall = ballsNow().some(o => o !== tr && o.state === 'rest' && dist(o, tr) < O.sitOn); }
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
    clearGone(t, info.empty);
    phase(t);
    name();
    return S;
  }

  // A hard-hit ball can be 2 ft from its spot by the next look (Oct 27: the cue ball went 24 in in 0.26 s): its resting track
  // goes hidden and the rolling ball shows up as something new, so no shot started. When a new spot has been seen twice,
  // rolling, and exactly one ball went hidden just before it appeared, from a spot the new one could have come from at its
  // speed, they are the same ball: the hidden one takes over and is rolling from then on.
  // A ball can also jump in one look and stop (Oct 27: the cue ball went 20 in into the 5 between two looks and sat
  // still; no shot was seen and the 5 stayed a ghost): a new spot that turns up at once, far off, and reads like a ball
  // that vanished just before, is that ball. It counts as rolling, so a shot starts, dated back to when it was last seen.
  // And a rolling spot read twice, sure, as the number of a ball that is lost (hidden, lost at a pocket, or called in during
  // this shot) is that ball, however long ago and far off it was lost: each number is on one ball only (Oct 28: the 8, hit
  // hard, was lost at once and found again 60 in away, read "8", rolling back along the cushion).
  function relink(t) {
    for (const nw of S.tracks) {
      if (nw.ok || nw.state !== 'new' || nw.seen < 2 || !nw.hist || nw.hist.length < 2) continue;
      const first = nw.hist[0], v = Math.hypot(nw.vx, nw.vy), rolling = nw.restSince == null && v >= O.shotSpeed * 2;
      const rd = nw.rd || [], r = rd.length >= 2 && rd.every(x => x === rd[0]) ? rd[0] : null;
      const byRead = rolling && r != null ? S.tracks.filter(o => o.ok && o.num === r && named(o) && (o.state === 'hidden' || o.state === 'pending' || (o.state === 'gone' && S.shot && o.goneT >= S.shot.t0))) : [];
      if (nw.seen !== 2 && byRead.length !== 1) continue;
      let cand;
      if (byRead.length === 1) cand = byRead;
      else if (rolling) {
        // reach: a struck ball is fastest at first (up to well over 100 in/s), so its speed now says little about how far it got
        cand = ballsNow().filter(o => o.state === 'hidden' && o.lostT != null && first.t - o.lostT >= -0.05 && first.t - o.lostT <= 0.8 &&
          Math.hypot(first.x - o.x, first.y - o.y) <= Math.max(v, 80) * (first.t - o.lostT + 0.3) + 6);
      } else {
        const rd = nw.rd || [];
        cand = ballsNow().filter(o => { const d = Math.hypot(first.x - o.x, first.y - o.y), gap = first.t - o.seenT;
          if (!(o.state === 'hidden' && o.lostT != null && first.t - o.lostT >= -0.05 && first.t - o.lostT <= O.jumpGap && d >= 3 && d / Math.max(0.05, gap) >= O.jumpSpeed)) return false;
          // it must read like that ball: its number, or (an unnamed ball) white or not the same
          if (o.num != null) return rd.includes(o.num);
          const a = whiteOf(o); return rd.length > 0 && nw.wN > 0 && (a == null || Math.abs(a - nw.wS / nw.wN) <= O.cueVeto); });
      }
      // two balls went hidden (the cue ball and the ball it sent out of sight): white or not tells which one this is
      if (cand.length > 1 && nw.wN) { const w = nw.wS / nw.wN; for (let i = cand.length - 1; i >= 0; i--) { const a = whiteOf(cand[i]); if (a != null && Math.abs(a - w) > O.cueVeto) cand.splice(i, 1); } }
      // a lost ball read as some other number is not this one
      if (r != null) { cand = cand.filter(o => !(named(o) && o.num !== r && !mixed(o.num, r))); if (cand.some(o => o.num === r)) cand = cand.filter(o => o.num === r); }
      if (cand.length !== 1) continue;
      const o = cand[0];
      if (o.state === 'gone') { // called in a moment ago, but it is rolling on: it did not go in
        const i = S.shot.made.findIndex(m => m.key === o.key); if (i >= 0) S.shot.made.splice(i, 1);
        const g = S.gone.indexOf(o.num); if (g >= 0) S.gone.splice(g, 1); o.pocket = null; ev('back', { key: o.key, num: o.num });
      }
      // the cue ball, unseen when it was struck, found rolling just after a shot started: the ball that started it was the
      // one it hit (Oct 28: the 9, knocked an inch, started the shot; the cue ball was found the next look)
      if (S.shot && o.num === 0 && S.shot.cueKey !== o.key && t - S.shot.t0 <= 1) {
        const prev = S.tracks.find(x => x.key === S.shot.cueKey); if (prev && S.shot.cueVoted) voteFor(prev, 0, -O.cueVote);
        if (S.shot.first == null && prev) { S.shot.first = prev.key; S.shot.firstNumAt = prev.num; ev('first_hit', { key: prev.key, num: prev.num }); }
        S.shot.cueKey = o.key; S.shot.cueNum = 0;
      }
      const from = { x: o.x, y: o.y, t: o.seenT, lost: o.lostT }; ev('relink', { key: o.key, num: o.num, from: [+o.x.toFixed(1), +o.y.toFixed(1)], to: [+nw.x.toFixed(1), +nw.y.toFixed(1)], jump: !rolling });
      const jv = rolling ? null : { vx: (first.x - from.x) / Math.max(0.05, first.t - from.t), vy: (first.y - from.y) / Math.max(0.05, first.t - from.t) };
      Object.assign(o, { x: nw.x, y: nw.y, vx: jv ? jv.vx : nw.vx, vy: jv ? jv.vy : nw.vy, state: 'moving', movedT: t, restSince: null, lostT: null, seenT: t, sp: nw.sp, hist: nw.hist.slice(), emptyN: 0, jumpFrom: jv ? from.t : null, relinkLost: from.lost });
      nw.state = 'dropped';
    }
    S.tracks = S.tracks.filter(tr => tr.state !== 'dropped');
  }

  // A hidden ball is kept where it was, but not forever: when its spot shows bare cloth (the app looks at the picture there:
  // not the ball, not an arm) on several looks in a row, it is not there. Gone during a shot, or hidden when one started,
  // it went in that shot (Oct 27: a struck ball gone before the next look stayed a dashed ghost for the rest of the rack,
  // 9 of the 13 balls in that were missed). Gone with no shot since, it was taken off by hand. Without the picture check
  // (info.empty) nothing is cleared, except a hidden ball sitting on another one (see sitsOn).
  function clearGone(t, empty) {
    if (S.phase === 'shot') return;
    const bs = ballsNow();
    for (const tr of bs) {
      if (tr.state !== 'hidden' || tr.lostT == null) continue;
      const e = sitsOn(tr, bs, t) || (empty ? empty(tr.x, tr.y) : null); if (e === true) tr.emptyN = (tr.emptyN || 0) + 1; else if (e === false) tr.emptyN = 0;
      if (tr.emptyN < O.emptyLooks || t - tr.lostT < O.emptyHold) continue;
      const sh = S.shots.find(s => s.t1 >= tr.lostT && (tr.lostT >= s.t0 - 0.6 || s.before.some(b => b.key === tr.key && b.state === 'hidden')));
      if (sh && t - sh.t1 < O.afterHold) continue;
      // a ball not yet named that turned up since this one vanished may be this one, knocked across the table (Oct 27: the
      // 3 went from the far rail to the near one in a scratch shot and was called in): give the reader time to name it.
      // A newcomer of the other colour (the cue ball put back after a scratch) does not hold this up.
      const wo = whiteOf(tr), newcomer = ballsNow().some(o => o !== tr && o.state !== 'hidden' && o.firstT >= tr.lostT - 0.5 && (o.num == null || !o.sure) &&
        (wo == null || whiteOf(o) == null || Math.abs(whiteOf(o) - wo) <= O.cueVeto));
      if (sh && newcomer && t - sh.t1 < O.newcomerWait) continue;
      if (!sh || tr.num == null) { tr.state = 'dropped'; ev('cleared', { key: tr.key, num: tr.num }); continue; }
      lateIn(tr, sh, t);
    }
    S.tracks = S.tracks.filter(tr => tr.state !== 'dropped');
  }
  // a ball found to have gone in after its shot ended
  function lateIn(tr, sh, t, pocket) {
    // which pocket: the one it was knocked toward, if one lies that way; else not known
    if (pocket == null && tr.knock) { let best = 0.9; P.pockets.forEach((pk, i) => { const dx = pk.x - tr.x, dy = pk.y - tr.y, d = Math.hypot(dx, dy) || 1, c = (dx * tr.knock.ux + dy * tr.knock.uy) / d; if (c > best) { best = c; pocket = i; } }); }
    // or the one pocket a ball was newly seen lying in since the shot started
    if (pocket == null) { const ks = Object.keys(S.bagNew).filter(k => S.bagNew[k] >= sh.t0 && !sh.made.some(m => m.pocket === +k)); if (ks.length === 1) pocket = +ks[0]; }
    tr.state = 'gone'; tr.goneT = t; const d = { key: tr.key, num: tr.num, sure: tr.sure, pocket, late: true };
    if (tr.num !== 0 && !S.gone.includes(tr.num)) S.gone.push(tr.num); // the cue ball comes back (see pocketed)
    sh.made.push(d); if (tr.key === sh.cueKey || tr.num === 0) sh.scratch = true; sh.updated = t;
    ev('made_late', { n: sh.n, key: tr.key, num: tr.num, pocket }); S.notes.push({ n: sh.n, num: tr.num, pocket, scratch: tr.num === 0 });
  }

  // New rack or End session: the last shot's calls are settled now, not left waiting (Oct 30: the 9, the last ball of the
  // rack, went in unseen and New rack came before it was called). A shot still on ends; a ball lost at a pocket, or one
  // in play that went out of sight during the last shot, is in; a pocket entry nobody was followed into is counted now;
  // and a number on the table before the last shot that no ball holds now went in, when the count of balls says so (one
  // fewer for each, and no unnamed ball on the table that could be it).
  function finish() {
    const t = S.t;
    if (S.shot) endShot(t);
    if (S.shots.length <= S.rackAt) return;
    const sh = S.shots[S.shots.length - 1];
    for (const tr of ballsNow()) {
      if (tr.num == null || tr.lostT == null || tr.lostT > sh.t1 || tr.lostT < sh.t0 - 0.6) continue;
      if (tr.state === 'pending') lateIn(tr, sh, t, tr.pocket);
      else if (tr.state === 'hidden' && (tr.vLost || tr.knock)) lateIn(tr, sh, t);
    }
    if (S.recon) { S.recon.t = 0; reconcile(t); }
    // balls taken off or moved by hand since (racking): the count says nothing about the shot
    if (S.events.some(e => (e.k === 'cleared' || e.k === 'hands') && e.t > sh.t1)) return;
    const bs = ballsNow(), held = new Set(bs.filter(b => b.num != null).map(b => b.num)), done = new Set(sh.made.map(m => m.num));
    const missing = [...new Set(sh.before.filter(b => b.num != null && b.num !== 0).map(b => b.num))].filter(n => !held.has(n) && !done.has(n) && !S.gone.includes(n));
    const objBefore = sh.before.filter(b => b.num !== 0).length, objNow = bs.filter(b => b.num !== 0).length, objIn = sh.made.filter(m => m.num !== 0).length;
    // a ball not named before it vanished: the numbers nobody holds and not yet in, when there are just as many (Oct 29:
    // the 9, unnamed, the last ball of the rack, with 1 to 8 in)
    const k = objBefore - objIn - objNow, unnamed = sh.before.filter(b => b.num == null).length;
    const nums = missing.length ? missing : k <= unnamed ? O.ids.filter(n => n !== 0 && !held.has(n) && !done.has(n) && !S.gone.includes(n)) : [];
    ev('finish', { n: sh.n, nums, objBefore, objNow, objIn });
    if (!nums.length || bs.some(b => b.num == null) || nums.length !== k) return;
    for (const num of nums) { const d = { key: null, num, sure: false, pocket: null, inferred: true }; sh.made.push(d); S.gone.push(num); ev('made_inferred', { n: sh.n, num, pocket: null }); S.notes.push({ n: sh.n, num, pocket: null }); }
    sh.updated = t;
  }

  // Two balls can't be closer than 2.25 in, so a hidden ball under 1.5 in from a ball that sits there is not there: the
  // cloth check never sees bare cloth under the other ball, so it counts as bare (Oct 30: the 5 went in unseen and stayed
  // a hidden 5 on the 9, which showed as the 5 for five shots). Only when it is plain: the rack has been broken (in a rack
  // two touching balls can be found as one spot between them), the ball there has rested and been seen for sitHold s,
  // reads sure as another number and has no other ball within 3 in, and the hidden ball was not already on a resting ball
  // when it went out of sight (then its last spot was that ball seen twice and where it really is is not known: Oct 26,
  // the 8 rolled behind the 3 and two spots on the 3 pulled it there; the rule would have called it in).
  function sitsOn(g, bs, t) {
    if (g.num == null || g.onBall || S.shots.length <= S.rackAt) return false;
    return bs.some(v => v !== g && v.state === 'rest' && v.sure && v.num != null && v.num !== g.num && dist(v, g) < O.sitOn &&
      t - v.restSince >= O.sitHold && t - v.seenT < 0.3 && !bs.some(o => o !== v && o !== g && o.state !== 'hidden' && dist(o, v) < 3));
  }

  function pocketed(tr) {
    tr.state = 'gone'; tr.goneT = t0(); const d = { key: tr.key, num: tr.num, sure: tr.sure, pocket: tr.pocket };
    // a scratch: the cue ball is taken out and put back, so its number stays free for the ball put down (Oct 27: after the
    // first scratch the cue ball was never named again, a "?" for the rest of the rack, since 0 counted as pocketed)
    if (tr.num != null && tr.num !== 0 && !S.gone.includes(tr.num)) S.gone.push(tr.num);
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
        // sure of it among the numbers still free: once the 1 is in, a far-rail 9 read "1" half the time is still the 9
        // (Oct 28: the 9 sat by the far rail for most of the rack and kept going between sure and unsure)
        const prFree = id == null ? 0 : pr / free.reduce((a, f) => a + Math.exp(avg(tr)(f)), 0);
        // a ball whose best fit is poor stays unnamed rather than take a number it does not look like
        if (id == null || pr < 0.2) { if (tr.num != null) ev('unnamed', { key: tr.key, was: tr.num }); tr.num = null; tr.sure = false; return; }
        if (tr.num !== id) ev('named', { key: tr.key, num: id, was: tr.num, p: +pr.toFixed(2) });
        tr.num = id; tr.sure = pr >= 0.6 || prFree >= 0.8;
      });
    }
    // a hidden ball whose number another ball now clearly holds was picked up (ball in hand, cleared by hand): let it go
    for (const tr of balls) if (tr.state === 'hidden' && tr.num == null && tr.nVotes >= 1.5) { if (S.t - (tr.lostT || S.t) > 3) tr.state = 'dropped'; }
    // the cue ball named on the table while the shot is still on: it did not go in, whatever was called, and it is the cue
    // ball of this shot (Oct 27: the cue ball lost by a corner was called in, and found again before the shot ended; the 3,
    // seen first when the cue ball was not, was taken for the cue ball and its pot called a scratch)
    const c0 = S.shot && balls.find(tr => tr.num === 0 && tr.sure && tr.state !== 'hidden');
    if (c0) {
      const was = S.tracks.find(x => x.key === S.shot.cueKey);
      if (S.shot.cueKey !== c0.key && (!was || was.state === 'gone' || was.num !== 0)) { S.shot.cueKey = c0.key; ev('cue_ball', { n: S.shot.n, key: c0.key }); }
      for (let i = S.shot.made.length - 1; i >= 0; i--) if (S.shot.made[i].num === 0 && S.shot.made[i].key !== c0.key) { ev('back', { key: S.shot.made[i].key, num: 0 }); S.shot.made.splice(i, 1); }
    }
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
    missing.forEach((num, i) => { const e = sh.anon[i], d = { key: null, num, sure: false, pocket: missing.length === 1 ? e.pocket : null, inferred: true }; sh.made.push(d); S.gone.push(num); ev('made_inferred', { n: sh.n, num, pocket: d.pocket }); S.notes.push({ n: sh.n, num, pocket: d.pocket }); });
    sh.updated = t;
  }

  // ---- shots ----
  function phase(t) {
    reconcile(t);
    // the rack is done when only the cue ball is left (owner, Oct 31): New rack by itself, a few seconds before the owner
    // would press it (every rack end in the recordings). A hidden or unnamed ball still on the table holds it back, and
    // the button stays for the rest (a 9 made early in 9-ball)
    if (O.autoRack && S.phase === 'still' && !S.setup && !S.recon && S.shots.length > S.rackAt && S.stillSince != null && t - S.stillSince >= O.rackHold &&
      ballsNow().every(b => b.num === 0 && b.sure && b.state !== 'hidden')) { ev('rack_done', { n: S.shots.length }); S.say.push({ k: 'rack_done' }); newRack(); return; }
    const balls = ballsNow(), moving = balls.filter(tr => tr.state === 'moving'), pend = balls.filter(tr => tr.state === 'pending');
    if (S.phase === 'still' || S.phase === 'hands') {
      if (!moving.length && !pend.length) { if (S.stillSince == null) S.stillSince = t; if (S.phase === 'hands' && t - S.stillSince >= O.stillHold) { S.phase = 'still'; ev('still', {}); } }
      else if (S.phase === 'still') {
        // a finger on the screen shakes the phone: every ball seems to move a little for a look (Oct 28: a tap to rename the 9
        // moved the balls about an inch, and a shot was counted)
        const armed = S.stillSince != null && t - S.stillSince >= O.stillHold && !(t - S.touchT < O.touchHold);
        // the first look with motion: one ball rolling on its own (or two, when the cue ball reached the first ball within
        // one look; then the cue ball is the one the votes say, else the one that went further)
        const fresh = moving.filter(tr => tr.movedT === t);
        if (armed && fresh.length >= 1 && fresh.length < O.rackCount && fresh.length === moving.length && Math.max(...fresh.map(speed)) >= O.shotSpeed) {
          const cueOf = tr => tr.pin === 0 ? 9 : tr.nVotes ? tr.votes[O.ids.indexOf(0)] / tr.nVotes : -9;
          const cue = fresh.length === 1 ? fresh[0] : fresh.slice().sort((a, b) => (cueOf(b) - cueOf(a)) || (Math.hypot(b.x - b.restX, b.y - b.restY) - Math.hypot(a.x - a.restX, a.y - a.restY)))[0];
          // the cue ball named and sitting still elsewhere: a ball moved by hand, not a shot (Oct 30, 23:17: balls set out and
          // spread with the cue shaft for the next rack were counted as shots; a shot always starts with the cue ball)
          const q0 = O.cueFirst && cue.pin !== 0 && !(cue.num === 0 && cue.sure) && balls.find(b => b !== cue && b.num === 0 && b.sure && b.state === 'rest' && b.seenT === t && dist(b, cue) > 2 * R + 1.5 && Math.hypot(b.restX - cue.restX, b.restY - cue.restY) > 2 * R + 1.5);
          if (q0) { S.phase = 'hands'; ev('hands', { n: moving.length, armed, notCue: cue.key }); S.say.push({ k: 'not_shot', num: cue.num }); }
          else { startShot(cue, t); if (fresh.length === 2) { S.shot.first = fresh.find(tr => tr !== cue).key; } }
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
      if (!moving.length && !pend.length) { if (S.stillSince == null) S.stillSince = t; if (t - S.stillSince >= O.endHold && !(t - S.stillSince < O.endHold + O.cueWait && cueComing(sh, t))) endShot(t); }
      else S.stillSince = null;
    }
  }
  // The cue ball called in, and something just seen that is not yet a named ball, white or not known, since it was lost:
  // it may be the cue ball, found again away from the pocket; the shot waits for it to be named (Oct 30, 17:46: the cue
  // ball lost by the side pocket turned up 10 in away and was confirmed a ball a third of a second after the shot ended,
  // a scratch called). Named the cue ball, it takes back the call (see name).
  function cueComing(sh, t) {
    const cue = S.tracks.find(x => x.key === sh.cueKey); if (!cue || cue.state !== 'gone' || cue.lostT == null) return false;
    const wc = whiteOf(cue);
    return S.tracks.some(o => live(o) && o.state !== 'hidden' && (!o.ok || o.num == null) && t - o.seenT < 0.4 && o.firstT >= cue.lostT - 0.3 &&
      (wc == null || whiteOf(o) == null || Math.abs(whiteOf(o) - wc) <= O.cueVeto));
  }
  function startShot(tr, t) {
    S.phase = 'shot'; S.stillSince = null;
    const cueFit = tr.nVotes >= 3 ? Math.exp(tr.votes[O.ids.indexOf(0)] / tr.nVotes) : 1;
    const cueVoted = tr.pin == null && cueFit >= 0.05; if (cueVoted) voteFor(tr, 0, O.cueVote);
    // a break: five or more balls packed together (each touching another) when the shot starts
    const packed = ballsNow().filter(a => a !== tr && ballsNow().some(b => b !== a && b !== tr && dist(a, b) < 2 * R + 0.5)).length;
    // (back: at most 1 s, since a ball found again by its read may have been lost long before)
    const t0 = tr.jumpFrom != null && tr.movedT === t ? tr.jumpFrom : t, back = tr.movedT === t && tr.relinkLost != null ? Math.max(t - 1, Math.min(t0, tr.relinkLost)) : t0; tr.jumpFrom = tr.relinkLost = null;
    S.shot = { n: S.shots.length + 1, t0, cueKey: tr.key, cueNum: tr.num, first: null, made: [], anon: [], before: snapshot(), break: packed >= 5, cueVoted };
    ev('shot', { n: S.shot.n, key: tr.key, num: tr.num, break: S.shot.break });
    // a shot seen late (the cue ball found again only after it jumped): a ball that vanished since it started, by a pocket
    // and struck or in the jaws, went in (Oct 27: the 1 in the jaws, gone the same look the cue ball reached it)
    if (back < t) for (const b of ballsNow()) {
      if (b.state !== 'hidden' || !(b.lostT >= back - 0.05) || b.vLost) continue; const near = pocketNear(b.x, b.y);
      if (near.d <= O.jawZone || (b.knock && near.d <= O.pocketZone)) { b.state = 'pending'; b.pocket = near.i; ev('lost_at_pocket', { key: b.key, num: b.num, pocket: near.i }); }
    }
  }
  // anything but the cue ball changed in a shot: a ball on the table before it moved, went out of sight, or is gone
  // (its track dropped or replaced); something not yet confirmed a ball moved; or a new one turned up (Oct 27 replays:
  // struck balls found again as new tracks, rack balls not yet confirmed when the first shot came)
  function othersChanged(sh) {
    const was = sh.before.filter(b => b.key !== sh.cueKey);
    if (was.some(b => { const tr = S.tracks.find(x => x.key === b.key); return !tr || !live(tr) || tr.state !== 'rest' || tr.movedT >= sh.t0 || tr.lostT >= sh.t0 || Math.hypot(tr.x - b.rx, tr.y - b.ry) > O.moveDist; })) return true;
    return S.tracks.some(o => o.key !== sh.cueKey && (o.movedT >= sh.t0 || o.lostT >= sh.t0 || (live(o) && o.firstT >= sh.t0 && o.seen >= 2)));
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
    // till the rack's first real shot (after New rack, and at the start): the cue ball rolled on its own, nothing else moved
    // or went out of sight and nothing went in, is the cue ball put in place by hand (Oct 30, 23:17: before rack 1)
    if (O.setupDrop && S.setup && !sh.made.length && !sh.anon.length && !othersChanged(sh)) {
      S.shot = null; S.phase = 'still'; S.stillSince = t; ev('not_shot', { t0: sh.t0 }); S.say.push({ k: 'not_shot', num: 0 }); return null;
    }
    S.setup = false;
    S.shots.push(sh); S.shot = null; S.phase = 'still'; S.stillSince = t;
    if (sh.anon.length) S.recon = { sh, t: t + O.reconWait };
    ev('shot_end', { n: sh.n, made: sh.made.map(m => m.num), scratch: sh.scratch, first: sh.firstNum, hidden: sh.hidden });
    return sh;
  }
  // (rx, ry: the spot the ball last rested on; for the cue ball at a shot's start, where it was struck from)
  function snapshot() { return ballsNow().map(tr => ({ key: tr.key, num: tr.num, sure: tr.sure, x: +tr.x.toFixed(2), y: +tr.y.toFixed(2), rx: +tr.restX.toFixed(2), ry: +tr.restY.toFixed(2), state: tr.state })); }

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
  function newRack() { finish(); for (const tr of S.tracks) tr.state = 'dropped'; S.tracks = []; S.gone = []; S.rackAt = S.shots.length; S.recon = null; S.setup = true; S.phase = 'hands'; S.stillSince = null; S.shot = null; ev('new_rack', {}); }

  function setBags(b) { O.bags = b || []; }
  function touched() { S.touchT = S.t; }
  return { S, O, update, pin, notBall, inPocket, newRack, finish, setBags, touched, balls: ballsNow, snapshot };
}
if (typeof module !== 'undefined') module.exports = { makeTracker };
