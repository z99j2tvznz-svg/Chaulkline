// New ball tracker (test version, offline). Follows every ball the whole time instead of comparing the table before
// and after a shot. Each ball is resting, moving, hidden or pocketed:
//   - a ball is pocketed only when it disappears close to a pocket and does not come back there;
//     a ball that disappears anywhere else is hidden (behind a player or the cue) and stays on the table;
//   - a shot starts when the cue ball starts rolling on its own after the table was still;
//     many balls starting together without the cue ball (racking, hands) is not a shot;
//   - the first ball hit is the first other ball to start moving while the cue ball is next to it.
// Plain JS with no dependencies so the same file can later go into the app. Units: table inches and seconds,
// x along the table (0..L), y across (0..W). Input per frame: { t, balls: [{ x, y, rec, p, nb }] } from the finder.

const TRACK_DEFAULTS = {
  ballR: 1.125,
  gate: 3.0,          // in: how far a resting ball may be found from where it was
  gateSpeedK: 1.6,    // extra gate per in of expected travel this frame
  confirmHits: 5,     // frames seen before a new spot counts as a ball
  moveSpeed: 6,       // in/s: faster than this = moving
  restHold: 0.5,      // s the table must be still before a shot can start
  shotSpeed: 10,      // in/s the cue ball must reach to count as a shot
  hiddenStart: false, // also start a shot when a still ball is hit by a ball that was hidden until it was already rolling
  rackCount: 4,       // this many balls starting together without the cue ball first = racking/hands, not a shot
  pocketDist: 5.5,    // in from a pocket's mouth: a ball lost inside this went in
  pocketReach: 12,    // in: a fast ball lost this far out, running straight at a pocket, went in
  pocketWait: 1.0,    // s a ball lost at a pocket must stay gone
  minVotes: 10,       // recogniser votes before a spot counts as a ball
  goodShare: 0.6,     // share of looks the recogniser must call a ball
  launchGate: 12,     // in: how far a struck ball may jump between two frames
  hiddenGate: 4.0,    // in: a hidden ball is found again if something turns up this close to where it was
  touchDist: 3.6,     // in between centres: cue ball "next to" another ball (2.25 in = touching)
  pockets: null,      // pocket mouths in table inches, when the outline is known to be off
  inJaws: 1.5,        // in: a ball that stops this close to a pocket mouth is in the pocket (seen sitting in it)
  railBand: null,     // [ymin, ymax]: spots outside this band are on the rails (hands, legs, cushion), except at a pocket mouth
  // experiment (off by default, so the frozen baselines are unchanged): a ball lost while rolling is looked for along
  // its predicted path for coastTime s, and keeps its identity if a spot turns up there. 'line': straight on, slowing
  // by coastDecel; 'cushion': the same, bouncing off the cushions (restitution coastBounce)
  coast: null,
  coastTime: 0.5,     // s a lost rolling ball is followed along its predicted path
  coastGate: 3.0,     // in around the predicted spot, plus coastGateK per in/s of speed
  coastGateK: 0.05,
  coastDecel: 5,      // in/s^2 rolling slow-down
  coastBounce: 0.7,   // share of the speed into a cushion that comes back out
  // experiment (off by default): a struck ball that misses one match goes hidden at its old spot, and a fast ball
  // is already further than hiddenGate from it when it is seen again, so it came back as a new, unnamed track.
  // With relink, a ball hidden for at most relinkTime s takes a new spot up to relinkGate in away, but only when
  // nothing else could explain it: one candidate spot, no other ball that is unaccounted for (recently hidden, or
  // missing its spot this frame) within reach of that spot, and
  // the spot not sitting where another hidden ball was, the spot looking like a ball, and (for a ball that was rolling)
  // ahead of it and within reach. The number on the spot is ignored (moving balls are blurred).
  relink: false,
  relinkTime: 0.25,
  relinkGate: 12,
  // experiment (off by default): when a rolling ball reaches a resting one, nearest-first matching can hand the
  // resting ball's track the hitter's spot and the other way round (a swap). With contact, the two spots are shared
  // out by collision physics instead: the struck ball can only leave forward along the line of centres (its spot
  // within contactLat in of that line and not more than contactBack in behind where it sat), and the hitter's spot
  // must be further back along that line than the struck ball's. Of the pairs that fit, the one closest to where each
  // ball should be wins, and the struck ball takes the hitter's speed along that line. When the struck ball has no spot
  // of its own but one sits just behind it, the two are merged in the picture: it is held where it sat. When the two
  // spots are less than contactSure in apart along that line, the call is kept but both balls' names become uncertain
  // until each is read again while resting.
  contact: false,
  contactLat: 1.5,
  contactSure: 1.0,
  contactBack: 0.6,
  // trace (off by default): also return what every decision rested on (finish().trace) - per frame and track the
  // matched detection or none, identity votes over time, the evidence behind pocket calls. Read-only: it never
  // changes a decision (tests/record.test.js checks that on every session).
  trace: false,
  // experiment (off by default, so the frozen baselines are unchanged): only one ball on the table can be the cue ball,
  // for game play (drills may use another ball as the cue ball: the scorer turns it on per clip with oneCue: 'play').
  // When several tracks read as the cue ball, one keeps the name and the others are left unnamed: never renamed to
  // another number on weak evidence. After a scratch, only a ball placed afterwards can become the cue ball.
  oneCue: false,
  // cycle 3 experiment (off by default): pocket hold. A ball lost inside a pocket mouth is back on the table only when it
  // is seen there steadily again (in at least holdShare of the frames over holdTime s: a ball sitting in the jaws), or
  // seen outside every mouth. Glimpses inside the mouth (a ball lying in a far pocket, jaw shading, the ball on its way
  // down) do not undo the loss: if it is lost again, it is still the ball lost at that pocket, at the time it was first lost.
  pocketHold: false,
  holdTime: 1.0,
  holdShare: 0.6,
};

// tracker versions: v0.4 is the frozen baseline (the defaults above); v0.5 adds the collision-identity options (relink and
// contact, approved 2026-10-20). Pick one with { version: 'v0.5' }; options given beside it still win.
// v0.6 (approved 2026-10-20) is v0.5 plus the absence rule, which only the settled-table check reads (score-racks.js,
// reconcile.js): the tracker itself runs exactly as v0.5. v0.6 is scored on detections made with
// clip-detect.js --outline-check keep-first (the outline correction).
const TRACK_VERSIONS = { 'v0.4': {}, 'v0.5': { relink: true, contact: true }, 'v0.6': { relink: true, contact: true, absence: true } };

function makeTracker(table, opts = {}) {
  if (opts.version && !TRACK_VERSIONS[opts.version]) throw new Error('unknown tracker version ' + opts.version);
  const O = { ...TRACK_DEFAULTS, ...(opts.version ? TRACK_VERSIONS[opts.version] : {}), ...opts }, [L, W] = table;
  const pockets = O.pockets || [[0, 0], [L / 2, -0.6], [L, 0], [0, W], [L / 2, W + 0.6], [L, W]];
  const nearPocket = (x, y) => pockets.some(p => Math.hypot(x - p[0], y - p[1]) < O.pocketDist);
  let nextId = 1, tracks = [], t = 0, stillSince = 0, shot = null, cueHolder = null, cueLostAt = null;
  const shots = [], events = [];
  const TR = O.trace ? { frames: 0, tracks: new Map(), pocketEvidence: [], undone: [], now: null } : null;
  const trk = tr => { let e = TR.tracks.get(tr.id); if (!e) TR.tracks.set(tr.id, e = { tr, id: null, idChanges: [], samples: [] }); return e; };
  const mark = (tr, j, how) => { if (TR) TR.now.set(tr.id, [j, how]); };

  function rawIdent(tr) {
    // the number this ball has been recognised as most, counting only confident looks (after an unsure contact,
    // only the looks since then)
    let best = null, bv = 0;
    const base = tr.unsure ? tr.unsure.votes : null;
    tr.votes.forEach((v, i) => { const w = base ? v - base[i] : v; if (w > bv) { bv = w; best = i; } });
    return bv >= 2 ? best : null;
  }
  function ident(tr) {
    const id = rawIdent(tr);
    if (!O.oneCue || id !== 0 || tr.state === 'pocketed') return id;
    // one cue ball: one track holds the name. It keeps it while it is still on the table; another track that reads as
    // the cue ball takes it over only with clearly more reader evidence: half as many cue-ball votes again (so two balls
    // read alike do not swap the name every frame). Being struck is not evidence: in a game, striking an object ball is
    // a foul for the rules layer, not a reason to rename it
    const ok = o => o && o.real && o.state !== 'pocketed' && o.state !== 'gone' && rawIdent(o) === 0;
    const h = tracks.find(o => o.id === cueHolder);
    if (!ok(h)) {
      // the holder left the table. After a scratch (pocketed, or lost at a pocket) no ball already on the table takes
      // the name, only one put down after it (ball in hand): until then there is no cue ball rather than a wrong one
      if (h && cueLostAt == null) cueLostAt = h.state === 'pocketed' ? Math.min(h.lostAt ?? h.t, h.t) : -1;   // when it was last seen
      if (cueLostAt != null && cueLostAt >= 0 && tr.born <= cueLostAt) return null;
      cueHolder = tr.id; cueLostAt = null;
    } else if (h !== tr && tr.votes[0] > 1.5 * h.votes[0] + 5) cueHolder = tr.id;
    return cueHolder === tr.id ? 0 : null;
  }
  function cueTrack() {
    let best = null, bv = 1.5;
    for (const tr of tracks) if (tr.real && tr.state !== 'pocketed' && tr.votes[0] > bv && ident(tr) === 0) { bv = tr.votes[0]; best = tr; }
    return best;
  }
  // speed over the last ~0.2 s, counted only when the ball really travels one way (two spots flickering back and
  // forth, or a spot jittering in place, is not movement)
  function speed(tr) {
    const h = tr.path; if (h.length < 3) return 0;
    const b = h[h.length - 1]; let a = null, m = null;
    for (let i = h.length - 2; i >= 0; i--) { if (b[0] - h[i][0] >= 0.18) { a = h[i]; m = h[Math.round((i + h.length - 1) / 2)]; break; } }
    if (!a) return 0;
    const d = Math.hypot(b[1] - a[1], b[2] - a[2]), d1 = Math.hypot(m[1] - a[1], m[2] - a[2]), d2 = Math.hypot(b[1] - m[1], b[2] - m[2]);
    if (d < 1.2 || d1 + d2 > d * 1.5) return 0;
    return d / (b[0] - a[0]);
  }
  const ballness = tr => tr.votes.reduce((a, v) => a + v, 0);
  // how far a ball got from where it was at time `from`
  function travelled(tr, from) {
    const p0 = tr.path.find(p => p[0] >= from); return p0 ? Math.hypot(tr.x - p0[1], tr.y - p0[2]) : 0;
  }
  let frameN = 0;
  function step(frame) {
    const dt = Math.max(1e-3, frame.t - t); t = frame.t; frameN++;
    const onCloth = b => !O.railBand || (b.y >= O.railBand[0] && b.y <= O.railBand[1]) || b.x < 4.5 || b.x > L - 4.5 || Math.abs(b.x - L / 2) < 3;
    const dets = frame.balls.filter(onCloth).map(b => ({ ...b, used: false }));
    if (TR) { TR.frames++; TR.now = new Map(); TR.idx = frame.balls.filter(onCloth).map(b => frame.balls.indexOf(b)); }
    // match live tracks first (closest pairs first), then hidden ones
    const live = tracks.filter(tr => tr.state === 'resting' || tr.state === 'moving');
    const pairs = [];
    for (const tr of live) {
      const px = tr.x + tr.vx * (t - tr.t), py = tr.y + tr.vy * (t - tr.t);
      const g = O.gate + O.gateSpeedK * Math.hypot(tr.vx, tr.vy) * (t - tr.t);
      dets.forEach((d, j) => { const dd = Math.hypot(d.x - px, d.y - py); if (dd < g) pairs.push([dd, tr, j]); });
    }
    pairs.sort((a, b) => a[0] - b[0]);
    const matched = new Set();
    if (O.contact) contacts(live, dets, matched);
    for (const [, tr, j] of pairs) { if (matched.has(tr) || dets[j].used) continue; matched.add(tr); dets[j].used = true; mark(tr, j, 'near'); see(tr, dets[j]); }
    // a ball that is suddenly struck can jump several inches between frames (the clips drop frames): give live balls
    // that found nothing a second, wider look, closest pairs first
    const far = [];
    for (const tr of live) if (!matched.has(tr) && ballness(tr) >= O.minVotes) dets.forEach((d, j) => {
      if (d.used) return; const dd = Math.hypot(d.x - tr.x, d.y - tr.y);
      if (dd < O.launchGate && (d.rec == null || ident(tr) == null || d.rec === ident(tr) || d.nb > 0.5 || d.p < 0.6)) far.push([dd, tr, j]);
    });
    far.sort((a, b) => a[0] - b[0]);
    for (const [, tr, j] of far) { if (matched.has(tr) || dets[j].used) continue; matched.add(tr); dets[j].used = true; mark(tr, j, 'launch'); see(tr, dets[j]); }
    // experiment: balls lost while rolling, looked for where they should be now
    if (O.coast) for (const tr of tracks) if (tr.coast && (tr.state === 'hidden' || tr.state === 'lostAtPocket')) {
      const c = tr.coast, dtc = t - c.t0;
      if (dtc > O.coastTime) { tr.coast = null; continue; }
      const [qx, qy, qs] = predict(c, dtc), g = O.coastGate + O.coastGateK * qs, id = ident(tr);
      let bj = -1, bd = g;
      dets.forEach((d, j) => {
        if (d.used) return;
        // never take a spot the reader is sure is another ball
        if (id != null && d.rec != null && d.rec !== id && d.nb != null && d.nb < 0.5 && d.p >= 0.8) return;
        const dd = Math.hypot(d.x - qx, d.y - qy); if (dd < bd) { bd = dd; bj = j; } });
      if (bj >= 0) { dets[bj].used = true; matched.add(tr); tr.coast = null; tr.vx = c.vx; tr.vy = c.vy; tr.state = 'moving'; tr.coasted = (tr.coasted || 0) + 1; mark(tr, bj, 'coast'); see(tr, dets[bj]); }
    }
    for (const tr of tracks) if (tr.state === 'hidden' || tr.state === 'lostAtPocket') {
      let bj = -1, bd = O.hiddenGate;
      const hold = O.pocketHold && tr.state === 'lostAtPocket';
      dets.forEach((d, j) => { if (!d.used) { const dd = Math.hypot(d.x - tr.x, d.y - tr.y); if (dd < bd) { bd = dd; bj = j; } } });
      if (bj >= 0) {
        if (hold && !tr.mouth) tr.mouth = { lostAt: tr.lostAt, first: t, frame: frameN, hits: 0 };
        dets[bj].used = true; matched.add(tr); mark(tr, bj, 'refound'); see(tr, dets[bj]);
      }
    }
    if (O.relink) {
      const recent = tracks.filter(tr => tr.state === 'hidden' && tr.real && !matched.has(tr) && tr.hiddenAt != null && t - tr.hiddenAt <= O.relinkTime);
      const hiddenAll = tracks.filter(tr => tr.state === 'hidden' && !matched.has(tr));
      for (const tr of recent) {
        const cand = dets.map((d, j) => [Math.hypot(d.x - tr.x, d.y - tr.y), j]).filter(([dd, j]) => !dets[j].used && dd < O.relinkGate && relinkFits(tr, dets[j], dd));
        if (cand.length !== 1) { relinkSkip(tr, cand.length ? 'several spots' : null); continue; }
        const d = dets[cand[0][1]];
        // another ball that lost its spot this frame or recently could be it just as well: keep both uncertain
        if (recent.some(o => o !== tr && Math.hypot(d.x - o.x, d.y - o.y) < O.relinkGate)
          || live.some(o => o.real && !matched.has(o) && Math.hypot(d.x - o.x, d.y - o.y) < O.relinkGate)) { relinkSkip(tr, 'another ball could be it'); continue; }
        if (hiddenAll.some(o => o !== tr && Math.hypot(d.x - o.x, d.y - o.y) < O.hiddenGate)) { relinkSkip(tr, 'spot is where another hidden ball sat'); continue; }
        d.used = true; matched.add(tr); tr.relinked = (tr.relinked || 0) + 1; mark(tr, cand[0][1], 'relink'); see(tr, d);
      }
    }
    for (const tr of live) if (!matched.has(tr)) lose(tr);
    for (const d of dets) if (!d.used) {
      const tr = { id: nextId++, x: d.x, y: d.y, vx: 0, vy: 0, t, born: t, hits: 0, votes: new Array(10).fill(0), state: 'resting', real: false, path: [], lostAt: null, movedAt: null };
      tracks.push(tr); if (TR) mark(tr, dets.indexOf(d), 'new'); see(tr, d);
    }
    // a ball that rolled into a pocket and stopped where the camera still sees it, sitting in the pocket
    for (const tr of tracks) if (tr.state === 'resting' && isBall(tr) && tr.movedAt != null && t - tr.movedAt < 3
      && pockets.some(p => Math.hypot(tr.x - p[0], tr.y - p[1]) < O.inJaws) && travelled(tr, tr.movedAt - 0.3) >= 6) {
      tr.state = 'pocketed';
      if (TR) { const p = pockets.reduce((a, q) => Math.hypot(tr.x - q[0], tr.y - q[1]) < Math.hypot(tr.x - a[0], tr.y - a[1]) ? q : a);
        TR.pocketEvidence.push({ track: tr.id, t, rule: 'stopped in the jaws', at: [tr.x, tr.y], pocket: pockets.indexOf(p), dist: Math.hypot(tr.x - p[0], tr.y - p[1]), frames: tr.path.filter(q => q[0] >= tr.movedAt - 0.3).map(q => q[0]) }); }
      const ev = { k: 'pocket', t, track: tr.id, ball: ident(tr), jaws: true };
      events.push(ev); if (shot) shot.made.push(ev);
    }
    // a ball lost at a pocket that stays gone went in
    for (const tr of tracks) if (tr.state === 'lostAtPocket' && t - (tr.goneSince ?? tr.lostAt) >= O.pocketWait) {
      tr.state = 'pocketed';
      const ev = { k: 'pocket', t: tr.lostAt, track: tr.id, ball: ident(tr) };
      events.push(ev); if (shot) shot.made.push(ev);
    }
    if (TR) for (const tr of tracks) { const m = TR.now.get(tr.id); trk(tr).samples.push([t, m ? TR.idx[m[0]] : -1, m ? m[1] : null, tr.state, tr.x, tr.y]); }
    // forget spots that never became balls
    tracks = tracks.filter(tr => tr.real || t - tr.t < 0.5);
    updateShot();
  }

  function see(tr, d) {
    const gap = t - tr.t;
    if (tr.hits > 0 && gap > 0) {
      const k = Math.min(1, 0.5 + gap * 3);
      tr.vx = tr.vx * (1 - k) + (d.x - tr.x) / gap * k; tr.vy = tr.vy * (1 - k) + (d.y - tr.y) / gap * k;
    }
    tr.x = d.x; tr.y = d.y; tr.t = t; tr.hits++; tr.path.push([t, d.x, d.y]);
    // pocket hold: seen as a ball for holdTime s, or as a ball outside every mouth, it is back on the table
    if (tr.mouth) {
      tr.mouth.hits++;
      if (!nearPocket(d.x, d.y) && (d.nb == null || d.nb < 0.5)) tr.mouth = null;
      else if (t - tr.mouth.first >= O.holdTime && tr.mouth.hits >= O.holdShare * (frameN - tr.mouth.frame + 1)) tr.mouth = null;
    }
    if (tr.path.length > 600) tr.path.shift();
    if (!tr.real && tr.hits >= O.confirmHits) tr.real = true;
    const sp = speed(tr);
    // only trust the number on a ball that is standing still (moving balls are blurred)
    if (sp === 0 && d.rec != null && d.nb != null && d.nb < 0.5 && d.p >= 0.6) tr.votes[d.rec] += d.p;
    if (TR) { const e = trk(tr), id = ident(tr); if (id !== e.id) { e.idChanges.push({ t, from: e.id, to: id, votes: tr.votes.map(v => +v.toFixed(2)) }); e.id = id; } }
    if (sp === 0) { tr.still = (tr.still || 0) + 1; if (d.nb != null && d.nb < 0.3) tr.good = (tr.good || 0) + 1; }
    if (sp > O.moveSpeed) { if (tr.state !== 'moving') { tr.movedAt = t; tr.peak = 0; } tr.state = 'moving'; tr.lastMoving = t; tr.peak = Math.max(tr.peak || 0, sp); }
    else { tr.state = 'resting'; tr.vx *= 0.5; tr.vy *= 0.5; }
  }

  // was the ball heading into that pocket when it vanished? (a ball that vanishes behind a player standing at a
  // corner is usually going somewhere else, or not moving at all)
  function headingIn(tr) {
    const h = tr.path, b = h[h.length - 1], a = h.filter(p => p[0] <= b[0] - 0.3).pop(); if (!a) return false;
    const vx = b[1] - a[1], vy = b[2] - a[2], v = Math.hypot(vx, vy); if (v / (b[0] - a[0]) < 3) return false;
    const sp = v / (b[0] - a[0]);
    return pockets.some(p => {
      const dx = p[0] - b[1], dy = p[1] - b[2], d = Math.hypot(dx, dy), cos = (vx * dx + vy * dy) / (v * d);
      // close to the pocket and going its way, or further out but running fast straight at it (dark balls fade
      // into the pocket's shadow before they reach it)
      return (d < O.pocketDist && (d < 1.5 || cos > 0.4)) || (d < O.pocketReach && cos > 0.95 && sp > 10 && ident(tr) !== 0);
    });
  }
  // where a ball lost while rolling should be dt s later (straight on, slowing; with 'cushion' also bouncing)
  function predict(c, dt) {
    let x = c.x, y = c.y, vx = c.vx, vy = c.vy; const R = O.ballR, n = Math.max(1, Math.ceil(dt / 0.01)), h = dt / n;
    for (let i = 0; i < n; i++) {
      const sp = Math.hypot(vx, vy); if (sp < 0.5) break;
      const k = Math.max(0, sp - O.coastDecel * h) / sp; vx *= k; vy *= k; x += vx * h; y += vy * h;
      if (O.coast === 'cushion') {
        if (x < R) { x = 2 * R - x; vx = -vx * O.coastBounce; } else if (x > L - R) { x = 2 * (L - R) - x; vx = -vx * O.coastBounce; }
        if (y < R) { y = 2 * R - y; vy = -vy * O.coastBounce; } else if (y > W - R) { y = 2 * (W - R) - y; vy = -vy * O.coastBounce; }
      }
    }
    return [x, y, Math.hypot(vx, vy)];
  }
  // trace only: what a "lost heading into a pocket" call rested on (the same quantities headingIn() looks at)
  function lostEvidence(tr) {
    const h = tr.path, b = h[h.length - 1], a = h.filter(p => p[0] <= b[0] - 0.3).pop(), vx = b[1] - a[1], vy = b[2] - a[2], v = Math.hypot(vx, vy);
    const ps = pockets.map((p, i) => { const dx = p[0] - b[1], dy = p[1] - b[2], d = Math.hypot(dx, dy); return { pocket: i, dist: d, cos: (vx * dx + vy * dy) / (v * d) }; });
    const best = ps.sort((u, w) => u.dist - w.dist)[0];
    return { track: tr.id, t, rule: best.dist < O.pocketDist ? 'lost inside the pocket mouth zone' : 'lost running fast straight at a pocket', lastSeen: [b[0], b[1], b[2]],
      speed: v / (b[0] - a[0]), heading: Math.atan2(vy, vx) * 180 / Math.PI, pocket: best.pocket, dist: best.dist, cos: best.cos, frames: h.filter(p => p[0] >= a[0]).map(p => p[0]) };
  }
  function lose(tr) {
    if (!tr.real) { tr.state = 'gone'; return; }
    if (O.coast && tr.state === 'moving' && Math.hypot(tr.vx, tr.vy) > O.moveSpeed) tr.coast = { t0: tr.t, x: tr.x, y: tr.y, vx: tr.vx, vy: tr.vy };
    const px = tr.x + tr.vx * 0.05, py = tr.y + tr.vy * 0.05;
    // lost again while held at the mouth: it is the ball lost at that pocket (event time = the first loss), and it must
    // now stay gone pocketWait s from this loss
    if (tr.mouth) { tr.state = 'lostAtPocket'; tr.lostAt = tr.mouth.lostAt; tr.goneSince = t; tr.vx = tr.vy = 0; return; }
    if (ballness(tr) >= O.minVotes && tr.lastMoving != null && t - tr.lastMoving < 0.6 && travelled(tr, tr.movedAt - 0.3) >= 1.5 && headingIn(tr)) { tr.state = 'lostAtPocket'; tr.lostAt = t; if (TR) TR.pocketEvidence.push(lostEvidence(tr)); }
    else { tr.state = 'hidden'; tr.hiddenAt = t; tr.hiddenV = [tr.vx, tr.vy]; }
    tr.vx = tr.vy = 0;
  }
  // a spot a recently hidden ball could have got to: it looks like a ball, and a ball that was rolling when it was lost
  // went on ahead (within 60 degrees of its heading) and no further than its speed allows; a ball lost while sitting
  // still (struck, then missed in the next frame) may have gone any way
  function relinkFits(tr, d, dd) {
    if (d.nb != null && d.nb >= 0.5) return false;
    const [vx, vy] = tr.hiddenV || [0, 0], v = Math.hypot(vx, vy);
    if (v <= O.moveSpeed) return true;
    return (vx * (d.x - tr.x) + vy * (d.y - tr.y)) / (v * dd) > 0.5 && dd <= v * (t - tr.t) * 1.5 + O.gate;
  }
  function contacts(live, dets, matched) {
    for (const m of live) {
      const sp = Math.hypot(m.vx, m.vy); if (!m.real || m.state !== 'moving' || sp <= O.moveSpeed) continue;
      const dtm = t - m.t, mx = m.x + m.vx * dtm, my = m.y + m.vy * dtm;
      // only the first resting ball in its path can be the one it hits: the nearest one it reaches, and no other
      let tried = false;
      for (const r of live.slice().sort((a, b) => Math.hypot(a.x - m.x, a.y - m.y) - Math.hypot(b.x - m.x, b.y - m.y))) {
        if (matched.has(m)) break;
        if (r === m || !r.real || r.state !== 'resting' || matched.has(r)) continue;
        if (r.struckAt != null && t - r.struckAt < 0.5) continue;  // already struck: ordinary matching follows it now
        // where the resting ball sits: its average spot over the last half second (one spot can be off by an inch)
        const rp = r.path.filter(p => p[0] >= t - 0.5), rx = rp.length ? rp.reduce((a, p) => a + p[1], 0) / rp.length : r.x, ry = rp.length ? rp.reduce((a, p) => a + p[2], 0) / rp.length : r.y;
        // closest the hitter's centre gets to the resting ball between its last spot and where it should be now
        const ux = mx - m.x, uy = my - m.y, uu = ux * ux + uy * uy, k = uu ? Math.max(0, Math.min(1, ((rx - m.x) * ux + (ry - m.y) * uy) / uu)) : 0;
        const qx = m.x + k * ux, qy = m.y + k * uy, dq = Math.hypot(rx - qx, ry - qy);
        if (dq > O.touchDist) continue;
        if (tried) break; tried = true;
        // line of centres at contact (straight on: the hitter's heading)
        let nx = rx - qx, ny = ry - qy; const nn = Math.hypot(nx, ny);
        if (nn < 0.5) { nx = m.vx / sp; ny = m.vy / sp; } else { nx /= nn; ny /= nn; }
        const cx = rx - nx * 2 * O.ballR, cy = ry - ny * 2 * O.ballR, reach = O.gate + sp * dtm * 1.2;
        const ds = dets.map((d, j) => j).filter(j => !dets[j].used && Math.min(Math.hypot(dets[j].x - rx, dets[j].y - ry), Math.hypot(dets[j].x - cx, dets[j].y - cy)) < reach);
        if (ds.length < 2) continue;
        // the hitter takes the spot closest to either where it should be (a glancing hit or a near miss) or the contact
        // point (a full hit stops it there); never a spot further along the line of centres than the struck ball's
        const mfit = j => Math.min(Math.hypot(dets[j].x - mx, dets[j].y - my), Math.hypot(dets[j].x - cx, dets[j].y - cy));
        const along = j => (dets[j].x - rx) * nx + (dets[j].y - ry) * ny, off = j => Math.abs((dets[j].x - rx) * ny - (dets[j].y - ry) * nx);
        // the struck ball can only go forward along that line
        const forR = ds.filter(j => off(j) <= O.contactLat && along(j) >= -O.contactBack);
        const dr = j => Math.hypot(dets[j].x - rx, dets[j].y - ry);
        if (!forR.length && ds.some(j => along(j) < -O.contactBack && dr(j) < 1.5 * O.ballR) && !ds.some(j => along(j) > 0 && dr(j) < O.gate)) {
          // no spot of its own and one just behind it: the two are merged in the picture. Hold it where it sat; the
          // hitter takes its best spot
          const mj = ds.sort((a, b) => mfit(a) - mfit(b))[0];
          matched.add(r); matched.add(m); dets[mj].used = true; mark(m, mj, 'contact'); see(m, dets[mj]); continue;
        }
        // of the pairs that fit (the hitter's spot behind the struck ball's), the one where both spots sit closest to
        // where each ball should be
        let rj = -1, mj = -1, best = Infinity;
        for (const a of forR) for (const b of ds) if (b !== a && along(b) < along(a)) {
          const c = dr(a) + mfit(b); if (c < best) { best = c; rj = a; mj = b; }
        }
        if (rj < 0) continue;
        if (along(rj) - along(mj) < O.contactSure) for (const [a, b] of [[r, m], [m, r]]) { a.unsure = { with: b.id, t, votes: a.votes.slice() }; if (TR) (TR.contactUnsure = TR.contactUnsure || []).push({ t, track: a.id, with: b.id }); }
        const vn = m.vx * nx + m.vy * ny, mvx = m.vx, mvy = m.vy;
        matched.add(r); matched.add(m); dets[rj].used = dets[mj].used = true;
        mark(r, rj, 'contact'); see(r, dets[rj]); mark(m, mj, 'contact'); see(m, dets[mj]);
        if (along(rj) >= O.contactBack && vn > 0) {
          // struck: it takes the hitter's speed along the line of centres and the hitter keeps only the rest, so the
          // next frames' ordinary matching looks for each ball where physics sends it
          r.struckAt = t; r.vx = nx * vn; r.vy = ny * vn; m.vx = mvx - nx * vn; m.vy = mvy - ny * vn;
          if (r.state !== 'moving') { r.movedAt = t; r.peak = 0; } r.state = 'moving'; r.lastMoving = t;
        }
      }
    }
  }
  // trace only: why a recently hidden ball was not re-linked
  function relinkSkip(tr, why) { if (TR && why) (TR.relinkSkips = TR.relinkSkips || []).push({ t, track: tr.id, why }); }

  // a ball we trust: seen for a while and recognised as a ball. Short-lived spots (hands, legs behind the far rail,
  // cue tip) come and go and never get here.
  // and mostly looking like a ball (spots the recogniser keeps calling "not a ball" are hands, legs, cushion)
  const isBall = tr => tr.real && ballness(tr) >= O.minVotes && (t - tr.born >= 1.0 || tr.born === 0) && (tr.good || 0) >= O.goodShare * (tr.still || 0);
  function updateShot() {
    const real = tracks.filter(tr => isBall(tr) && (tr.state === 'resting' || tr.state === 'moving'));
    const moving = real.filter(tr => tr.state === 'moving');
    if (!moving.length) {
      if (!stillSince) stillSince = t;
      if (shot && !shot.end && t - stillSince > 1.0) shot.end = stillSince;
    } else stillSince = 0;
    if (shot && !shot.end && !shot.checked && t > shot.t + 1.2) {
      // a struck cue ball does not come back to where it sat. When it seems to, the "roll" was the cue stick's tip
      // being taken for the ball during practice strokes: not a shot.
      shot.checked = true;
      const cue = tracks.find(tr => tr.id === shot.cue), r0 = shot.from;
      if (cue && r0 && cue.path.some(p => p[0] > shot.t + 0.8 && Math.hypot(p[1] - r0[0], p[2] - r0[1]) < 1.5) && !shot.made.length) {
        shots.splice(shots.indexOf(shot), 1); events.push({ k: 'notShot', t, why: 'cue ball came back (practice stroke)' }); shot = null; return;
      }
    }
    if (shot && !shot.end) {
      // first ball hit: the first other ball to start moving that the cue ball had just reached
      const cue = tracks.find(tr => tr.id === shot.cue);
      if (shot.first === undefined && cue) for (const tr of moving.slice().sort((a, b) => a.movedAt - b.movedAt)) {
        if (tr === cue || tr.movedAt < shot.t) continue;
        const rest = tr.path.filter(p => p[0] < tr.movedAt - 0.2).pop(); if (!rest) continue;
        const near = cue.path.some(p => p[0] >= tr.movedAt - 0.5 && p[0] <= tr.movedAt + 0.05 && Math.hypot(p[1] - rest[1], p[2] - rest[2]) < O.touchDist);
        if (!near) continue;
        shot.first = ident(tr); shot.firstTrack = tr.id; break;
      }
      return;
    }
    // a new shot: the table was still, then one ball starts rolling fast on its own. That ball is the cue ball,
    // whatever the recogniser thinks of it, unless it is clearly a numbered ball (then hands are moving balls).
    // the shooter's arm or body often hides the cue ball until it is already rolling. Then the shot shows as a
    // still ball being hit by a fast ball that came from nowhere.
    if (O.hiddenStart) for (const ob of moving) {
      if (ob.movedAt === lastShotAt || t - ob.movedAt > 0.3 || stillBefore(ob.movedAt) < O.restHold) continue;
      const rest = ob.path.filter(p => p[0] < ob.movedAt - 0.2).pop(); if (!rest) continue;
      const hitter = tracks.find(tr => tr !== ob && tr.hits >= 3 && t - tr.born < 2 && tr.path.length >= 3
        && tr.path.some(p => p[0] >= ob.movedAt - 0.5 && p[0] <= ob.movedAt + 0.05 && Math.hypot(p[1] - rest[1], p[2] - rest[2]) < O.touchDist + 1)
        && Math.hypot(tr.path[tr.path.length - 1][1] - tr.path[0][1], tr.path[tr.path.length - 1][2] - tr.path[0][2]) >= 4);
      if (!hitter) continue;
      lastShotAt = ob.movedAt;
      shot = { t: hitter.born, made: [], cue: hitter.id, first: ident(ob), firstTrack: ob.id, hidden: true };
      shots.push(shot); events.push({ k: 'shot', t: hitter.born, cue: hitter.id, hiddenStart: true });
      return;
    }
    const starters = moving.filter(tr => tr.movedAt !== lastShotAt && t - tr.movedAt <= 0.6 && speed(tr) > O.shotSpeed && rolledFromRest(tr));
    if (!starters.length) return;
    const cue = starters.sort((a, b) => a.movedAt - b.movedAt)[0];
    lastShotAt = cue.movedAt;
    const others = moving.filter(tr => tr !== cue && tr.movedAt < cue.movedAt + 0.1);
    if (others.length >= O.rackCount - 1) { events.push({ k: 'notShot', t, why: 'many balls started together' }); return; }
    if (stillBefore(cue.movedAt) < O.restHold) { events.push({ k: 'notShot', t, why: 'table not still before' }); return; }
    const id = ident(cue);
    if (O.numberedFirstIsHands && id != null && id !== 0 && cue.votes[id] > 3 * (cue.votes[0] + 1)) { events.push({ k: 'notShot', t, why: 'a numbered ball moved first' }); return; }
    const rs = cue.path.filter(p => p[0] < cue.movedAt - 0.25).pop();
    shot = { t: cue.movedAt - 0.2, made: [], cue: cue.id, from: rs ? [rs[1], rs[2]] : null };
    shots.push(shot); events.push({ k: 'shot', t: cue.movedAt, cue: cue.id });
  }
  // a struck ball sat still in one place first, then runs off in a near-straight line. Hands, legs and the cue
  // stick make spots that appear, jump about or crawl.
  function rolledFromRest(tr) {
    const st = tr.movedAt - 0.25, before = tr.path.filter(p => p[0] < st && p[0] >= st - O.restHold);
    if (before.length < O.restHold * 8) return why(tr, 'few looks before');
    // where it sat: the middle of its recent spots (the cue stick and hand near the ball add stray spots)
    const med = a => a.slice().sort((u, v) => u - v)[a.length >> 1];
    const r0 = [0, med(before.map(p => p[1])), med(before.map(p => p[2]))];
    if (before.filter(p => Math.hypot(p[1] - r0[1], p[2] - r0[2]) <= 1.0).length < 0.7 * before.length) return why(tr, 'not still before');
    const after = tr.path.filter(p => p[0] >= st && p[0] <= st + 0.45);
    if (after.length < 4) return false;
    let len = 0; for (let i = 1; i < after.length; i++) len += Math.hypot(after[i][1] - after[i - 1][1], after[i][2] - after[i - 1][2]);
    // it must really travel: a struck cue ball can stop on an object ball within a few inches, so count the whole
    // way it went, not just how far it ended up
    if (len < 3) return why(tr, 'short run');
    // and keep rolling: seen at several places along the way, not one hop between two spots (which is the track
    // swapping onto a neighbouring ball or a stray spot)
    let maxStep = 0, places = 0;
    for (let i = 1; i < after.length; i++) { const st2 = Math.hypot(after[i][1] - after[i - 1][1], after[i][2] - after[i - 1][2]); maxStep = Math.max(maxStep, st2); if (st2 > 0.3) places++; }
    if (maxStep > 0.6 * len || places < 2) {
      // one exception: the ball was hidden (the shooter's arm) and reappears already rolling. Then the big step is
      // the first one, and it keeps going the same way afterwards.
      const i0 = after.findIndex((p, i) => i > 0 && Math.hypot(p[1] - after[i - 1][1], p[2] - after[i - 1][2]) > 0.3);
      const a = after[i0 - 1], b = after[i0], e = after[after.length - 1];
      const ok = i0 > 0 && Math.hypot(b[1] - a[1], b[2] - a[2]) === maxStep && after.length - i0 >= 3 && (() => {
        const ux = b[1] - a[1], uy = b[2] - a[2], wx = e[1] - b[1], wy = e[2] - b[2], w = Math.hypot(wx, wy);
        return w >= 2 && (ux * wx + uy * wy) / (Math.hypot(ux, uy) * w) > 0.7;
      })();
      if (!ok) return why(tr, 'hop');
    }
    return true;
  }
  function why(tr, w) { if (O.debug) events.push({ k: 'reject', t, track: tr.id, why: w }); return false; }
  let lastShotAt = null;
  const stillLog = [];
  // how long the table had been still just before time `at`
  function stillBefore(at) {
    for (let i = stillLog.length - 1; i >= 0; i--) { const [a, b] = stillLog[i]; if (a <= at && b >= at - 0.2) return at - a; if (b < at - 0.2) break; }
    return 0;
  }
  // record still periods (start, end) so a shot can check the table was still before it
  function stepLogged(frame) {
    step(frame);
    const moving = tracks.some(tr => isBall(tr) && tr.state === 'moving');
    const last = stillLog[stillLog.length - 1];
    if (!moving) { if (last && last[1] >= t - 0.1) last[1] = t; else stillLog.push([t, t]); }
  }

  function finish() {
    // balls still waiting at a pocket when the clip ends count as in
    for (const tr of tracks) if (tr.state === 'lostAtPocket' && t - (tr.goneSince ?? tr.lostAt) >= 0.3) {
      tr.state = 'pocketed'; const ev = { k: 'pocket', t: tr.lostAt, track: tr.id, ball: ident(tr), late: true };
      events.push(ev); if (shot) shot.made.push(ev);
    }
    // a ball counted in that shows up again later (picked up by hand, or it was only behind someone) was not in
    for (const ev of events.filter(e => e.k === 'pocket')) {
      const tr = tracks.find(x => x.id === ev.track), b = tr ? ident(tr) : ev.ball; if (b == null) continue;
      if (tracks.some(x => x !== tr && x.born > ev.t && x.state !== 'pocketed' && isBall(x) && ident(x) === b && x.votes[b] >= 5)) ev.undone = true;
    }
    if (TR) for (const e of events) if (e.undone) TR.undone.push({ ...e, why: 'the same number was seen on the table again later' });
    for (let i = events.length - 1; i >= 0; i--) if (events[i].undone) events.splice(i, 1);
    for (const s of shots) s.made = s.made.filter(e => !e.undone);
    const cue = cueTrack();
    for (const s of shots) {
      s.made = s.made.map(e => ({ ...e, ball: tracks.find(tr => tr.id === e.track) ? ident(tracks.find(tr => tr.id === e.track)) : e.ball }));
      s.scratch = s.made.some(e => e.track === s.cue);
    }
    const out = { shots, events, cueId: cue && cue.id, tracks: tracks.filter(tr => tr.real).map(tr => ({ id: tr.id, ball: ident(tr), state: tr.state, x: +tr.x.toFixed(1), y: +tr.y.toFixed(1) })) };
    if (TR) out.trace = { frames: TR.frames, pocketEvidence: TR.pocketEvidence, undone: TR.undone, ...(TR.relinkSkips ? { relinkSkips: TR.relinkSkips } : {}), ...(TR.contactUnsure ? { contactUnsure: TR.contactUnsure } : {}),
      spotsNeverBalls: [...TR.tracks.values()].filter(e => !e.tr.real).length,
      tracks: [...TR.tracks.values()].filter(e => e.tr.real).map(e => ({ id: e.tr.id, born: e.tr.born, ball: ident(e.tr), state: e.tr.state, votes: e.tr.votes.map(v => +v.toFixed(2)),
        isBall: isBall(e.tr), idChanges: e.idChanges, samples: e.samples })) };
    return out;
  }

  // moving(): is any trusted ball moving right now (read-only; used by the baseline's settled-table check)
  return { step: stepLogged, finish, moving: () => tracks.some(tr => isBall(tr) && tr.state === 'moving'), get tracks() { return tracks; },
    // cycle 2 diagnostics (read-only): the trusted balls moving right now
    movingTracks: () => tracks.filter(tr => isBall(tr) && tr.state === 'moving') };
}

if (typeof module !== 'undefined') module.exports = { makeTracker, TRACK_DEFAULTS, TRACK_VERSIONS };
