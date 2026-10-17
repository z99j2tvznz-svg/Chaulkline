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
  restHold: 0.7,      // s the table must be still before a shot can start
  shotSpeed: 10,      // in/s the cue ball must reach to count as a shot
  rackCount: 4,       // this many balls starting together without the cue ball first = racking/hands, not a shot
  pocketDist: 5.5,    // in from a pocket's mouth: a ball lost inside this went in
  pocketWait: 1.0,    // s a ball lost at a pocket must stay gone
  hiddenGate: 4.0,    // in: a hidden ball is found again if something turns up this close to where it was
  touchDist: 3.6,     // in between centres: cue ball "next to" another ball (2.25 in = touching)
  railBand: null,     // [ymin, ymax]: spots outside this band are on the rails (hands, legs, cushion), except at a pocket mouth
};

function makeTracker(table, opts = {}) {
  const O = { ...TRACK_DEFAULTS, ...opts }, [L, W] = table;
  const pockets = [[0, 0], [L / 2, -0.6], [L, 0], [0, W], [L / 2, W + 0.6], [L, W]];
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
    if (sp > O.moveSpeed) { if (tr.state !== 'moving') tr.movedAt = t; tr.state = 'moving'; }
    else { tr.state = 'resting'; tr.vx *= 0.5; tr.vy *= 0.5; }
  }

  function lose(tr) {
    if (!tr.real) { tr.state = 'gone'; return; }
    const px = tr.x + tr.vx * 0.05, py = tr.y + tr.vy * 0.05;
    if ((nearPocket(tr.x, tr.y) || nearPocket(px, py)) && (ballness(tr) >= 2 || tr.state === 'moving')) { tr.state = 'lostAtPocket'; tr.lostAt = t; }
    else tr.state = 'hidden';
    tr.vx = tr.vy = 0;
  }

  // a ball we trust: seen for a while and recognised as a ball. Short-lived spots (hands, legs behind the far rail,
  // cue tip) come and go and never get here.
  const isBall = tr => tr.real && ballness(tr) >= 2 && (t - tr.born >= 1.0 || tr.born === 0);
  function updateShot() {
    const real = tracks.filter(tr => isBall(tr) && (tr.state === 'resting' || tr.state === 'moving'));
    const moving = real.filter(tr => tr.state === 'moving');
    if (!moving.length) {
      if (!stillSince) stillSince = t;
      if (shot && !shot.end && t - stillSince > 1.0) shot.end = stillSince;
    } else stillSince = 0;
    if (shot && !shot.end) {
      // first ball hit: the first other ball to start moving that the cue ball had just reached
      const cue = tracks.find(tr => tr.id === shot.cue);
      if (shot.first === undefined && cue) for (const tr of moving) {
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
    const starters = moving.filter(tr => tr.movedAt !== lastShotAt && t - tr.movedAt <= 0.4 && speed(tr) > O.shotSpeed);
    if (!starters.length) return;
    const cue = starters.sort((a, b) => a.movedAt - b.movedAt)[0];
    lastShotAt = cue.movedAt;
    const others = moving.filter(tr => tr !== cue && tr.movedAt < cue.movedAt + 0.1);
    if (others.length >= O.rackCount - 1) { events.push({ k: 'notShot', t, why: 'many balls started together' }); return; }
    if (stillBefore(cue.movedAt) < O.restHold) { events.push({ k: 'notShot', t, why: 'table not still before' }); return; }
    const id = ident(cue);
    if (id != null && id !== 0 && cue.votes[id] > 3 * (cue.votes[0] + 1)) { events.push({ k: 'notShot', t, why: 'a numbered ball moved first' }); return; }
    shot = { t: cue.movedAt - 0.2, made: [], cue: cue.id };
    shots.push(shot); events.push({ k: 'shot', t: cue.movedAt, cue: cue.id });
  }
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
