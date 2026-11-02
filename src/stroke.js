// The stroke from the side (V3.2, owner Nov 2): in the watcher's small picture of the table (320 px wide, every frame) the
// cue is a straight line of "not cloth" pointing at the cue ball. Each frame gives where the cue ball is, which way the cue
// points and how far its tip is from the ball. Over the frames before a shot that distance goes in and out (the practice
// strokes), rests at the back (the pause), and closes to nothing as the ball leaves (the strike); after it the tip goes on
// past where the ball sat (the follow-through). Built and checked on the owner's stroke test of Nov 1, 12:58 (54 clips
// from the side). Pure functions: the app feeds its frames, tools/v3/stroke.js the clips of a debug file.
const STROKE = (() => {
  const D2 = Math.PI / 180;
  const sat = (r, g, b) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx ? (mx - mn) / mx : 0; };
  const white = (r, g, b) => r > 150 && g > 150 && b > 150 && sat(r, g, b) < 0.28;
  // the cue ball near where it was: the middle of the white pixels within reach px of it
  function findBall(d, w, h, at, reach) {
    let sx = 0, sy = 0, n = 0; const x0 = Math.max(0, Math.round(at[0] - reach)), x1 = Math.min(w - 1, Math.round(at[0] + reach)), y0 = Math.max(0, Math.round(at[1] - reach)), y1 = Math.min(h - 1, Math.round(at[1] + reach));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const o = (y * w + x) * 4; if (white(d[o], d[o + 1], d[o + 2])) { sx += x; sy += y; n++; } }
    return n >= 3 ? { x: sx / n, y: sy / n, n } : null;
  }
  // the cue: the direction from the ball with the longest unbroken run of not-cloth (1 px either side of the ray), from
  // just outside the ball out to len px; the run must be long (a ball on the way is a short one). tip = where the run starts.
  function findCue(d, w, h, b, isCloth, rBall, len, around, inside) {
    const off = (x, y) => { const xi = Math.round(x), yi = Math.round(y); return xi < 0 || yi < 0 || xi >= w || yi >= h || (inside && !inside(xi, yi)); };
    const nc = (x, y) => { const xi = Math.round(x), yi = Math.round(y); if (off(x, y)) return false; const o = (yi * w + xi) * 4; return !isCloth(d[o], d[o + 1], d[o + 2]); };
    let best = null;
    const angs = []; if (around != null) for (let a = -12; a <= 12; a += 2) angs.push(around + a); else for (let a = 0; a < 360; a += 3) angs.push(a);
    for (const a of angs) {
      const cx = Math.cos(a * D2), cy = Math.sin(a * D2); let run = 0, start = null, bestRun = 0, bestStart = null, gap = 0;
      for (let r = rBall + 1; r <= len; r += 1) {
        const x = b.x + cx * r, y = b.y + cy * r; if (off(x, y)) break; // only over the cloth: the rails are not the cue
        const hit = nc(x, y) || nc(x - cy, y + cx) || nc(x + cy, y - cx);
        if (hit) { if (run === 0) start = r; run += 1 + gap; gap = 0; if (run > bestRun) { bestRun = run; bestStart = start; } }
        else if (run > 0 && gap < 1) gap++; // a pixel's gap (the shaft is thin and pale near the tip)
        else { run = 0; gap = 0; }
      }
      if (bestRun >= 14 && (!best || bestRun > best.run || (bestRun === best.run && bestStart < best.tip))) best = { ang: ((a % 360) + 360) % 360, run: bestRun, tip: bestStart };
    }
    return best;
  }
  // the tip along the cue's line measured from the ball's resting spot: from far up the cue toward the spot and past it,
  // where the unbroken not-cloth ends (negative: past the spot). After the strike the ball is gone from there.
  function tipAlong(d, w, h, r0, ang, isCloth, len, inside) {
    const c = Math.cos(ang * D2), s = Math.sin(ang * D2), nc = (x, y) => { const xi = Math.round(x), yi = Math.round(y); if (xi < 0 || yi < 0 || xi >= w || yi >= h || (inside && !inside(xi, yi))) return false; const o = (yi * w + xi) * 4; return !isCloth(d[o], d[o + 1], d[o + 2]); };
    let r = len, seen = false, gap = 0, tip = null;
    for (; r >= -40; r--) { const x = r0[0] + c * r, y = r0[1] + s * r, hit = nc(x, y) || nc(x - s, y + c) || nc(x + s, y - c); if (hit) { seen = true; gap = 0; tip = r; } else if (seen && ++gap > 2) break; }
    return seen ? tip : null;
  }
  // one frame: the ball (followed from where it was) and the cue
  function observe(img, w, h, prev, isCloth, opt) {
    const o = Object.assign({ rBall: 3, len: 70, reach: 5 }, opt), d = img.data || img;
    const b = findBall(d, w, h, prev.ball, o.reach) || (prev.ball && { x: prev.ball[0], y: prev.ball[1], lost: true });
    if (!b) return { ball: null, cue: null };
    const cue = findCue(d, w, h, b, isCloth, o.rBall, o.len, prev.ang, o.inside) || (prev.ang != null ? findCue(d, w, h, b, isCloth, o.rBall, o.len, null, o.inside) : null);
    const ang = cue ? cue.ang : prev.ang, tip0 = ang != null && prev.rest ? tipAlong(d, w, h, prev.rest, ang, isCloth, o.len, o.inside) : null;
    // fb: the cue ball followed where it is heading (V3.7: a ball sent off fast leaves the near search in one frame; ahead
    // of its way, it stays found, so the way it went can be read)
    const pv = prev.fb ? [prev.fb[0] + (prev.fv ? prev.fv[0] : 0), prev.fb[1] + (prev.fv ? prev.fv[1] : 0)] : prev.ball, fbb = pv && (findBall(d, w, h, pv, o.reach) || findBall(d, w, h, pv, Math.max(8, o.rBall * 3.5)));
    const fb = fbb ? [fbb.x, fbb.y] : null, fv = fb && prev.fb ? [(fb[0] - prev.fb[0]) * 0.7 + (prev.fv ? prev.fv[0] : 0) * 0.3, (fb[1] - prev.fb[1]) * 0.7 + (prev.fv ? prev.fv[1] : 0) * 0.3] : [0, 0];
    return { ball: [b.x, b.y], lost: !!b.lost, ang: cue ? cue.ang : null, tip: cue ? cue.tip : null, tip0, run: cue ? cue.run : 0, fb, fv };
  }
  // A shot or a ball moved with the cue (V3.7, owner Nov 2: tell what is a shot). On a shot the cue ball leaves along the
  // cue, away from the butt. Seen from the side (the cue within 12 degrees of level in the picture, held steady at the
  // ball), a cue ball that sets off sideways, 45 to 110 degrees off the cue's line, was pushed or raked, not struck.
  // Checked on Nov 1 20:06 and 21:18 (85 real shots, 7 moves): see DESIGN NOTES, V3.7.0. Hands,
  // rakes from the far side and sweeps along the cue's line it does not tell; for those the player says "Not a shot".
  // A ball first seen going back toward the butt (more than 110 degrees off) is the tip's white ferrule in the backswing:
  // looked past.
  // obs: [{ t, fb, ang }] (observe), at: when the shot was seen to start (ms), toTable(px, py) -> table inches.
  function moveCheck(obs, at, toTable) {
    const angd = (a, b) => ((a - b) % 360 + 540) % 360 - 180, T = q => toTable(q.fb[0], q.fb[1]), dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i]; if (!o.fb || o.t < at - 2000 || o.t > at + 300) continue;
      const pre = obs.slice(0, i).filter(q => q.fb && o.t - q.t >= 250 && o.t - q.t <= 900).map(T); if (pre.length < 3) continue; // (a push creeps off its spot: where it rested is looked for a little before)
      const med = k => { const v = pre.map(p => p[k]).sort((a, b) => a - b); return v[v.length >> 1]; }, R0 = [med(0), med(1)];
      if (pre.some(p => dist(p, R0) > 0.6) || dist(T(o), R0) <= 0.7 || obs.slice(i, i + 4).some(q => q.fb && dist(T(q), R0) <= 0.7)) continue;
      const j = obs.slice(i, i + 15).find(q => q.fb && dist(T(q), R0) >= 1.5), p0 = obs.slice(0, i).reverse().find(q => q.fb);
      const cues = obs.filter(q => q.ang != null && q.t >= o.t - 1100 && q.t <= o.t - 80).map(q => q.ang);
      if (!j || !p0 || cues.length < 5) return { move: false, why: 'unread' };
      const a0 = cues.reduce((b, a) => cues.filter(c => Math.abs(angd(a, c)) <= 6).length > cues.filter(c => Math.abs(angd(b, c)) <= 6).length ? a : b, cues[0]);
      const share = cues.filter(c => Math.abs(angd(a0, c)) <= 8).length / cues.length, level = Math.min(Math.abs(angd(a0, 0)), Math.abs(angd(a0, 180)));
      const off = Math.round(angd(Math.atan2(j.fb[1] - p0.fb[1], j.fb[0] - p0.fb[0]) / D2, a0 + 180));
      if (Math.abs(off) > 110) continue; // the ferrule (seen at 130 to 180 degrees on Nov 1 20:06)
      const read = share >= 0.8 && level <= 12; // (a cue 18 degrees off level came down from the far side on a real shot, 20:06 shot 20)
      return { move: read && Math.abs(off) >= 45, off, cue: a0, read, why: read ? 'side' : 'not side' };
    }
    return { move: false, why: 'no start' };
  }
  // a whole shot: obs = [{ t (ms), ball, ang, tip }] from before the strike to after it; toTable(px, py) gives table inches
  function summarize(obs, toTable) {
    const rest = obs.find(q => q.ball && !q.lost); if (!rest) return null;
    const r0 = rest.ball, moved = q => q.ball && !q.lost && Math.hypot(q.ball[0] - r0[0], q.ball[1] - r0[1]) > 2.5;
    // the strike: the first frame the ball has left its spot (and stays away)
    let k = obs.findIndex((q, i) => moved(q) && obs.slice(i, i + 3).every(z => !z.ball || z.lost || moved(z)));
    const noMove = k < 0; if (noMove) k = obs.length; // (the strike may still show from the cue, below)
    // the tip's distance in inches from the ball's spot, along the cue (toTable at the ball's spot and at the tip)
    const T0 = toTable(r0[0], r0[1]), inch = q => { if (q.tip == null || q.ang == null) return null; const c = Math.cos(q.ang * D2), s = Math.sin(q.ang * D2), bx = q.ball ? q.ball[0] : r0[0], by = q.ball ? q.ball[1] : r0[1]; const p = toTable(bx + c * q.tip, by + s * q.tip), b = toTable(bx, by); return Math.hypot(p[0] - b[0], p[1] - b[1]); };
    const pre = obs.slice(0, k).map((q, idx) => ({ t: q.t, d: inch(q), ang: q.ang, idx })).filter(q => q.d != null);
    if (pre.length < 5) return noMove ? { strike: null } : { strike: obs[k].t, strokes: null };
    // smooth (median of 3) and find the turns: the tip going back then coming forward, each at least 1 in
    const ds = pre.map((q, i) => { const a = pre.slice(Math.max(0, i - 1), i + 2).map(z => z.d).sort((x, y) => x - y); return a[a.length >> 1]; });
    // the turns: a zigzag with 1 in of give. 'back' = the tip at its furthest from the ball, 'front' = at its nearest
    const turns = []; let trend = 0, lv = ds[0], li = 0;
    for (let i = 1; i < ds.length; i++) {
      if (trend <= 0 && ds[i] >= lv + 1) { if (trend < 0) turns.push({ i: li, kind: 'front' }); trend = 1; lv = ds[i]; li = i; }
      else if (trend >= 0 && ds[i] <= lv - 1) { if (trend > 0) turns.push({ i: li, kind: 'back' }); trend = -1; lv = ds[i]; li = i; }
      else if (trend > 0 ? ds[i] > lv : trend < 0 ? ds[i] < lv : false) { lv = ds[i]; li = i; }
    }
    let backs = turns.filter(x => x.kind === 'back'); const last = backs[backs.length - 1];
    // the strike, from the cue: the tip back at the ball after the last backswing. A ball hit hard is gone in one frame,
    // and the white ferrule on the tip left on its spot passed for the ball for a second (Nov 1, 20:06: 7 hard shots had
    // the strike after the app saw the shot start)
    if (last) { const lo = Math.min(...ds.slice(0, last.i + 1)), j = ds.findIndex((v, i) => i > last.i && v <= lo + 1);
      if (j > 0 && pre[j].idx < k) { k = pre[j].idx; pre.length = j + 1; ds.length = j + 1; } }
    if (k >= obs.length) return { strike: null };
    // a practice stroke goes back at least 2 in from where the tip rested before it (a waggle is not one)
    const amp = b => { const f = turns.filter(x => x.kind === 'front' && x.i < b.i).pop(); return ds[b.i] - (f ? ds[f.i] : Math.min(...ds.slice(0, b.i + 1))); };
    backs = backs.filter(b => b === last || amp(b) >= 2);
    // the pause: how long the tip stayed within half an inch of its last backswing
    let pause = null; if (last) { let a = last.i, b = last.i; while (a > 0 && Math.abs(ds[a - 1] - ds[last.i]) <= 0.5) a--; while (b < ds.length - 1 && Math.abs(ds[b + 1] - ds[last.i]) <= 0.5) b++; pause = (pre[b].t - pre[a].t) / 1000; }
    const angs = pre.slice(-8).map(q => q.ang).filter(a => a != null), cueAng = angs.length ? angs.sort((x, y) => x - y)[angs.length >> 1] : null;
    // after the strike: the cue ball's way on the table, the cue's, and the tip past the ball's spot (follow-through)
    const later = obs.slice(k, k + 6).filter(q => q.ball && !q.lost), bEnd = later.length ? later[later.length - 1].ball : null;
    let off = null; if (bEnd && cueAng != null) { const B1 = toTable(bEnd[0], bEnd[1]), c = Math.cos(cueAng * D2), s = Math.sin(cueAng * D2), Cq = toTable(r0[0] + c * 20, r0[1] + s * 20);
      const ball = Math.atan2(B1[1] - T0[1], B1[0] - T0[0]), cue = Math.atan2(T0[1] - Cq[1], T0[0] - Cq[0]); off = ((ball - cue) / D2 + 540) % 360 - 180; }
    // follow-through: the furthest the tip went past the ball's spot in the half second after the strike
    let follow = null; for (const q of obs.slice(k).filter(q => q.t - obs[k].t <= 500)) if (q.tip0 != null && q.tip0 < 0 && cueAng != null) {
      const c = Math.cos(cueAng * D2), s = Math.sin(cueAng * D2), P = toTable(r0[0] + c * q.tip0, r0[1] + s * q.tip0); follow = Math.max(follow || 0, Math.hypot(P[0] - T0[0], P[1] - T0[1])); }
    const addr = last ? turns.filter(x => x.kind === 'front' && x.i < last.i).pop() : null, back = last ? ds[last.i] - (addr ? ds[addr.i] : Math.min(...ds.slice(0, last.i + 1))) : null;
    return { strike: obs[k].t, strokes: Math.max(0, backs.length - 1), backLen: back != null ? +back.toFixed(1) : null, pause: pause != null ? +pause.toFixed(2) : null, offLine: off != null ? +off.toFixed(1) : null, follow: follow != null ? +follow.toFixed(1) : null, curve: pre.map((q, i) => [q.t, +ds[i].toFixed(2)]) };
  }
  // cloth for the stroke: the cloth's hue AND close to its colour (the shaft over the cloth, a pixel wide in the small
  // picture, only pales or darkens it: s and v drop, the hue stays). cl = the cloth as the app measured it ({ h, s, v })
  const clothTest = (cl, rgb2hsv) => (r, g, b) => { const [h, s, v] = rgb2hsv(r, g, b), dh = Math.abs(((h - cl.h) % 360 + 540) % 360 - 180); return dh < 28 && s >= (cl.s || 0.85) - 0.12 && v * (v > 1 ? 1 : 255) >= (cl.v || 0.95) * 255 - 40; };
  return { observe, summarize, moveCheck, findBall, findCue, clothTest };
})();
if (typeof module !== 'undefined') module.exports = STROKE;
