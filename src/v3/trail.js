// A ball's trail through what the camera did not see (V3.23, owner Nov 17: on a hard shot the cue ball's trail was drawn
// straight from where it started to wherever it was next found, even when that way made no sense: "as it picks up the
// ball and notices that it is moving, start drawing from there and then understand how it got there"). At two or three
// looks a second a ball struck hard covers 3 to 6 feet between looks, off the ball it hits and off cushions. Each gap of
// more than a few inches between the places the ball was seen is filled the way a ball really goes: in straight lines,
// off the object ball it hit first (the cue ball meets it at the ghost ball: the object ball's spot less two radii back
// along the way the object ball went) and off up to two cushions (mirror images of where it was found). Of those ways,
// the one kept arrives going the way the ball was next seen going, leaves going the way it was last seen going, and fits
// the time between the looks (a ball slows down: it cannot have covered the gap slower than it was then seen to move);
// fewer cushions win a tie. The places the ball was seen are kept as they are; only the gaps get new points (fill: true).
const TRAIL = (() => {
  const GAP = 8, VMAX = 500, D = 180 / Math.PI; // (a gap: over 8 in between looks; no ball goes faster than 500 in/s, about 28 mph)
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], len = v => Math.hypot(v[0], v[1]), dist = (a, b) => len(sub(a, b));
  const ang = (u, v) => { const lu = len(u), lv = len(v); if (lu < 1e-9 || lv < 1e-9) return 0; return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv)))) * D; };
  // the cushions as lines the ball's centre meets: x = R, x = L - R, y = R, y = W - R
  function lines(P) { const R = P.R; return [{ ax: 0, v: R }, { ax: 0, v: P.L - R }, { ax: 1, v: R }, { ax: 1, v: P.W - R }]; }
  const mirror = (p, l) => l.ax === 0 ? [2 * l.v - p[0], p[1]] : [p[0], 2 * l.v - p[1]];
  // from s to b off the cushions in seq (in order): the points where it meets them, or null when that way is not possible
  // (the meeting point off the cushion's length, behind the ball, or in a pocket's mouth)
  function bounce(s, b, seq, P) {
    let tgt = b; const imgs = []; for (let i = seq.length - 1; i >= 0; i--) { tgt = mirror(tgt, seq[i]); imgs.unshift(tgt); }
    const pts = []; let cur = s;
    for (let i = 0; i < seq.length; i++) {
      const l = seq[i], aim = imgs[i], d = sub(aim, cur), k = l.ax, den = d[k]; if (Math.abs(den) < 1e-9) return null;
      const t = (l.v - cur[k]) / den; if (!(t > 1e-6 && t < 1 - 1e-6)) return null;
      const h = [cur[0] + d[0] * t, cur[1] + d[1] * t], o = 1 - k, lim = o === 0 ? P.L : P.W;
      if (h[o] < P.R || h[o] > lim - P.R) return null;
      if (P.pockets.some(q => Math.hypot(q.x - h[0], q.y - h[1]) < q.r + P.R)) return null;
      pts.push(h); cur = h; // (the next leg aims at the next image: where b is seen in the cushions still to come)
    }
    return pts;
  }
  // the ways from a to b: through the first hit (when given) and off 0, 1 or 2 cushions after it
  function ways(a, b, P, hit) {
    const L = lines(P), seqs = [[]]; for (const l of L) seqs.push([l]); for (const l1 of L) for (const l2 of L) if (l1 !== l2) seqs.push([l1, l2]);
    const out = [];
    for (const via of hit ? [[hit], []] : [[]]) {
      const s = via.length ? via[via.length - 1] : a;
      for (const seq of seqs) { const h = bounce(s, b, seq, P); if (h) out.push({ wp: via.concat(h), cush: seq.length, hit: via.length > 0 }); }
    }
    return out;
  }
  // pts: [{ t, x, y }] in order, the first where the ball rested when the shot started. P: the table (L, W, R, pockets).
  // o.hit: [x, y], the cue ball's centre where it met the first ball (only for the cue ball, when known); o.hitT: when that
  // ball was first seen moving (the hit is in the gap that ends within a look of it). Returns the points with the gaps
  // filled.
  function fill(pts, P, o) {
    o = o || {}; if (!pts || pts.length < 2) return pts ? pts.slice() : [];
    const out = [pts[0]]; let hitDone = !o.hit || dist([pts[0].x, pts[0].y], o.hit) < 1;
    for (let i = 0; i + 1 < pts.length; i++) {
      const A = pts[i], B = pts[i + 1], a = [A.x, A.y], b = [B.x, B.y], gap = dist(a, b);
      // (seen within a ball of the ghost ball: the hit is behind it)
      if (!hitDone && dist(a, o.hit) < 2 * P.R) hitDone = true;
      if (gap <= GAP) { out.push(B); if (!hitDone && dist(b, o.hit) < 2 * P.R) hitDone = true; continue; }
      const dt = Math.max(1e-3, (B.t != null && A.t != null ? B.t - A.t : 0.33));
      const Cn = pts[i + 2], Z = out.length > 1 ? out[out.length - 2] : null; // (the way it came into a: from the point before it, filled or seen)
      const dOut = Cn && dist(b, [Cn.x, Cn.y]) > 1.5 ? sub([Cn.x, Cn.y], b) : null, vAfter = dOut && Cn.t != null && B.t != null ? len(dOut) / Math.max(1e-3, Cn.t - B.t) : null;
      const dIn = Z && dist([Z.x, Z.y], a) > 1.5 ? sub(a, [Z.x, Z.y]) : null;
      // (the hit in this gap only if the first ball was seen moving by the end of it, or within a look after)
      const hitHere = !hitDone && !(o.hitT != null && B.t != null && o.hitT > B.t + 0.4);
      let best = null, base = null;
      for (const w of ways(a, b, P, hitHere ? o.hit : null)) {
        const path = [a].concat(w.wp, [b]); let L0 = 0; for (let j = 1; j < path.length; j++) L0 += dist(path[j - 1], path[j]);
        const v = L0 / dt; if (v > VMAX) continue;
        // the straight way through the hit (if any) is the measure: each cushion and each inch more than it must be earned
        // by how well the way fits where the ball was seen going
        const via = [a].concat(w.hit ? [o.hit] : [], [b]); let Lv = 0; for (let j = 1; j < via.length; j++) Lv += dist(via[j - 1], via[j]);
        let sc = 10 * w.cush + 30 * Math.max(0, L0 / Math.max(1, Lv) - 1) + (hitHere && !w.hit ? 25 : 0);
        if (dOut) sc += ang(sub(b, path[path.length - 2]), dOut);
        if (dIn && !w.hit) sc += ang(dIn, sub(path[1], a));
        // (it slows down: the way cannot have taken the gap's time at less than the speed it was next seen at)
        if (vAfter != null && v < 0.8 * vAfter) sc += 60 * (0.8 * vAfter - v) / vAfter;
        // (and it cannot arrive much faster than it then goes: a cushion takes about half the speed, Dr. Dave; a ball hit on
        // the way takes an unknown share, so not checked then)
        if (vAfter != null && !w.hit) { const vArr = v / Math.pow(2, w.cush); if (vAfter < 0.25 * vArr) sc += 40 * Math.log(0.25 * vArr / Math.max(1, vAfter)); }
        if (!w.cush && (!hitHere || w.hit) && (!base || sc < base.sc)) base = { sc, path, L0, hit: w.hit };
        if (!best || sc < best.sc) best = { sc, path, L0, hit: w.hit };
      }
      // a way off cushions is drawn only when it fits well and clearly better than the straight one (when nothing fits,
      // a ball hit on the way that was not seen, say, the straight line stays: it does not pretend to know)
      if (base && best && best !== base && (best.sc > base.sc - 10 || best.sc > 50)) best = base;
      if (best && best.path.length > 2) {
        let run = 0; for (let j = 1; j < best.path.length - 1; j++) { run += dist(best.path[j - 1], best.path[j]); const f = run / best.L0;
          out.push({ t: A.t != null && B.t != null ? A.t + f * (B.t - A.t) : undefined, x: best.path[j][0], y: best.path[j][1], fill: true }); }
      }
      if (best && best.hit) hitDone = true;
      out.push(B); if (!hitDone && dist(b, o.hit) < 2 * P.R) hitDone = true;
    }
    return out;
  }
  // the cue ball's place at the first hit: the first ball's spot less two radii back along the way it went (its own first
  // move when seen, else toward the pocket it went in)
  function hitOf(P, ob, obPts, pocket) {
    if (!ob) return null; let u = null;
    if (obPts) for (const q of obPts) { const d = [q.x - ob[0], q.y - ob[1]]; if (len(d) > 1.5) { u = d; break; } }
    // (seen moving only far from its spot, after a cushion maybe: the first move is still the best way known, unless it
    // went in, when the pocket is)
    if (u && pocket && len(u) > 12) u = [pocket.x - ob[0], pocket.y - ob[1]];
    if (!u && pocket) u = [pocket.x - ob[0], pocket.y - ob[1]];
    if (!u || len(u) < 1e-6) return null; const l = len(u); return [ob[0] - 2 * P.R * u[0] / l, ob[1] - 2 * P.R * u[1] / l];
  }
  // when the first ball was first seen moving (for o.hitT)
  const movedAt = (ob, obPts) => { if (!ob || !obPts) return null; const q = obPts.find(z => Math.hypot(z.x - ob[0], z.y - ob[1]) > 1.5); return q ? q.t : null; };
  return { fill, hitOf, movedAt, GAP };
})();
if (typeof module !== 'undefined') module.exports = TRAIL;
