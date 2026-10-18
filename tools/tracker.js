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
};

function makeTracker(table, opts = {}) {
  const O = { ...TRACK_DEFAULTS, ...opts }, [L, W] = table;
  const pockets = O.pockets || [[0, 0], [L / 2, -0.6], [L, 0], [0, W], [L / 2, W + 0.6], [L, W]];
  const nearPocket = (x, y) => pockets.some(p => Math.hypot(x - p[0], y - p[1]) < O.pocketDist);
  let nextId = 1, tracks = [], t = 0, stillSince = 0, shot = null;
  const shots = [], events = [];

  function ident(tr) {
    // the number this ball has been recognised as most, counting only confident looks
    let best = null, bv = 0;
    tr.votes.forEach((v, i) => { if (v > bv) { bv = v; best = i; } });
    return bv >= 2 ? best : null;
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
  function step(frame) {
    const dt = Math.max(1e-3, frame.t - t); t = frame.t;
    const onCloth = b => !O.railBand || (b.y >= O.railBand[0] && b.y <= O.railBand[1]) || b.x < 4.5 || b.x > L - 4.5 || Math.abs(b.x - L / 2) < 3;
    const dets = frame.balls.filter(onCloth).map(b => ({ ...b, used: false }));
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
    for (const [, tr, j] of pairs) { if (matched.has(tr) || dets[j].used) continue; matched.add(tr); dets[j].used = true; see(tr, dets[j]); }
    // a ball that is suddenly struck can jump several inches between frames (the clips drop frames): give live balls
    // that found nothing a second, wider look, closest pairs first
    const far = [];
    for (const tr of live) if (!matched.has(tr) && ballness(tr) >= O.minVotes) dets.forEach((d, j) => {
      if (d.used) return; const dd = Math.hypot(d.x - tr.x, d.y - tr.y);
      if (dd < O.launchGate && (d.rec == null || ident(tr) == null || d.rec === ident(tr) || d.nb > 0.5 || d.p < 0.6)) far.push([dd, tr, j]);
    });
    far.sort((a, b) => a[0] - b[0]);
    for (const [, tr, j] of far) { if (matched.has(tr) || dets[j].used) continue; matched.add(tr); dets[j].used = true; see(tr, dets[j]); }
    for (const tr of tracks) if (tr.state === 'hidden' || tr.state === 'lostAtPocket') {
      let bj = -1, bd = O.hiddenGate;
      dets.forEach((d, j) => { if (!d.used) { const dd = Math.hypot(d.x - tr.x, d.y - tr.y); if (dd < bd) { bd = dd; bj = j; } } });
      if (bj >= 0) { dets[bj].used = true; matched.add(tr); see(tr, dets[bj]); }
    }
    for (const tr of live) if (!matched.has(tr)) lose(tr);
    for (const d of dets) if (!d.used) {
      const tr = { id: nextId++, x: d.x, y: d.y, vx: 0, vy: 0, t, born: t, hits: 0, votes: new Array(10).fill(0), state: 'resting', real: false, path: [], lostAt: null, movedAt: null };
      tracks.push(tr); see(tr, d);
    }
    // a ball that rolled into a pocket and stopped where the camera still sees it, sitting in the pocket
    for (const tr of tracks) if (tr.state === 'resting' && isBall(tr) && tr.movedAt != null && t - tr.movedAt < 3
      && pockets.some(p => Math.hypot(tr.x - p[0], tr.y - p[1]) < O.inJaws) && travelled(tr, tr.movedAt - 0.3) >= 6) {
      tr.state = 'pocketed';
      const ev = { k: 'pocket', t, track: tr.id, ball: ident(tr), jaws: true };
      events.push(ev); if (shot) shot.made.push(ev);
    }
    // a ball lost at a pocket that stays gone went in
    for (const tr of tracks) if (tr.state === 'lostAtPocket' && t - tr.lostAt >= O.pocketWait) {
      tr.state = 'pocketed';
      const ev = { k: 'pocket', t: tr.lostAt, track: tr.id, ball: ident(tr) };
      events.push(ev); if (shot) shot.made.push(ev);
    }
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
    if (tr.path.length > 600) tr.path.shift();
    if (!tr.real && tr.hits >= O.confirmHits) tr.real = true;
    const sp = speed(tr);
    // only trust the number on a ball that is standing still (moving balls are blurred)
    if (sp === 0 && d.rec != null && d.nb != null && d.nb < 0.5 && d.p >= 0.6) tr.votes[d.rec] += d.p;
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
  function lose(tr) {
    if (!tr.real) { tr.state = 'gone'; return; }
    const px = tr.x + tr.vx * 0.05, py = tr.y + tr.vy * 0.05;
    if (ballness(tr) >= O.minVotes && tr.lastMoving != null && t - tr.lastMoving < 0.6 && travelled(tr, tr.movedAt - 0.3) >= 1.5 && headingIn(tr)) { tr.state = 'lostAtPocket'; tr.lostAt = t; }
    else tr.state = 'hidden';
    tr.vx = tr.vy = 0;
  }

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
    for (const tr of tracks) if (tr.state === 'lostAtPocket' && t - tr.lostAt >= 0.3) {
      tr.state = 'pocketed'; const ev = { k: 'pocket', t: tr.lostAt, track: tr.id, ball: ident(tr), late: true };
      events.push(ev); if (shot) shot.made.push(ev);
    }
    // a ball counted in that shows up again later (picked up by hand, or it was only behind someone) was not in
    for (const ev of events.filter(e => e.k === 'pocket')) {
      const tr = tracks.find(x => x.id === ev.track), b = tr ? ident(tr) : ev.ball; if (b == null) continue;
      if (tracks.some(x => x !== tr && x.born > ev.t && x.state !== 'pocketed' && isBall(x) && ident(x) === b && x.votes[b] >= 5)) ev.undone = true;
    }
    for (let i = events.length - 1; i >= 0; i--) if (events[i].undone) events.splice(i, 1);
    for (const s of shots) s.made = s.made.filter(e => !e.undone);
    const cue = cueTrack();
    for (const s of shots) {
      s.made = s.made.map(e => ({ ...e, ball: tracks.find(tr => tr.id === e.track) ? ident(tracks.find(tr => tr.id === e.track)) : e.ball }));
      s.scratch = s.made.some(e => e.track === s.cue);
    }
    return { shots, events, cueId: cue && cue.id, tracks: tracks.filter(tr => tr.real).map(tr => ({ id: tr.id, ball: ident(tr), state: tr.state, x: +tr.x.toFixed(1), y: +tr.y.toFixed(1) })) };
  }

  return { step: stepLogged, finish, get tracks() { return tracks; } };
}

if (typeof module !== 'undefined') module.exports = { makeTracker, TRACK_DEFAULTS };
