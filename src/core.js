// ===== CORE: math, camera, physics, planner, drills, fitting (pure, no DOM) =====
const D2R = Math.PI / 180, MPH = 17.6;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

function solveLinear(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [b[i], b[p]] = [b[p], b[i]];
    for (let r = i + 1; r < n; r++) {
      const f = A[r][i] / A[i][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let c = i + 1; c < n; c++) s -= A[i][c] * x[c];
    x[i] = s / A[i][i];
  }
  return x;
}
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solveLinear(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}
function applyH(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}
function invert3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const D = -(b * i - c * h), E = a * i - c * g, F = -(a * h - b * g);
  const G = b * f - c * e, H = -(a * f - c * d), I = a * e - b * d;
  const det = a * A + b * B + c * C;
  return [A / det, D / det, G / det, B / det, E / det, H / det, C / det, F / det, I / det];
}
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Camera: table coords (inches, y up, z up) <-> working-image pixels
function makeCam(tableCorners, imgPts, W, H, fpx, pp) {
  const Hti = homography(tableCorners, imgPts), Hit = invert3(Hti);
  const cam = { Hti, Hit, ok: false, W, H, f: fpx };
  const cx = pp ? pp[0] : W / 2, cy = pp ? pp[1] : H / 2;
  const kin = (a, b, c) => [(a - cx * c) / fpx, (b - cy * c) / fpx, c];
  let m1 = kin(Hti[0], Hti[3], Hti[6]), m2 = kin(Hti[1], Hti[4], Hti[7]), m3 = kin(Hti[2], Hti[5], Hti[8]);
  const lam = 2 / (Math.hypot(...m1) + Math.hypot(...m2));
  let r1 = m1.map(v => v * lam), r2 = m2.map(v => v * lam), t = m3.map(v => v * lam);
  if (t[2] < 0) { r1 = r1.map(v => -v); r2 = r2.map(v => -v); t = t.map(v => -v); }
  let r3 = cross3(r1, r2);
  let cz = -dot3(r3, t);
  if (cz < 0) { r3 = r3.map(v => -v); cz = -cz; }
  const C = [-dot3(r1, t), -dot3(r2, t), cz];
  cam.C = C;
  cam.ok = isFinite(cz) && cz > 8 && cz < 900;
  cam.proj = (x, y, z = 0) => {
    if (!cam.ok) return applyH(Hti, x, y);
    const X = r1[0] * x + r2[0] * y + r3[0] * z + t[0];
    const Y = r1[1] * x + r2[1] * y + r3[1] * z + t[1];
    const Z = r1[2] * x + r2[2] * y + r3[2] * z + t[2];
    return [fpx * X / Z + cx, fpx * Y / Z + cy];
  };
  // A ball is a sphere, so its picture is a circle whose size depends only on how far away it is (not on how the table is tilted).
  cam.ballRad = (x, y, z, r) => {
    if (!cam.ok) return cam.rad(x, y, z, r);
    const Z = r1[2] * x + r2[2] * y + r3[2] * z + t[2]; return Z > 1e-6 ? fpx * r / Z : cam.rad(x, y, z, r);
  };
  cam.unproj = (px, py, z = 0) => {
    const P0 = applyH(Hit, px, py);
    if (!cam.ok || z === 0) return P0;
    const s = (C[2] - z) / C[2];
    return [C[0] + s * (P0[0] - C[0]), C[1] + s * (P0[1] - C[1])];
  };
  cam.rad = (x, y, z, r) => {
    const a = cam.proj(x, y, z), b = cam.proj(x + r, y, z), c = cam.proj(x, y + r, z);
    return (Math.hypot(a[0] - b[0], a[1] - b[1]) + Math.hypot(a[0] - c[0], a[1] - c[1])) / 2;
  };
  return cam;
}

// ===== Physics =====
function makeP(ft, phys, pocketScale) {
  const d = ft === 7 ? { L: 78, W: 39 } : ft === 8 ? { L: 88, W: 44 } : { L: 100, W: 50 };
  const P = { R: 1.125, L: d.L, W: d.W, g: 386.09, muS: 0.2, rollDec: 4.5, spinDec: 12,
    eBall: 0.95, eRail: 0.72, muBall: 0.06, squirt: 0.05 };
  const ps = pocketScale || 1, mk = (x, y, corner) => ({ x, y, r: (corner ? 2.3 : 1.9) * ps, corner });
  if (phys) Object.assign(P, phys);
  P.pockets = [mk(0, 0, true), mk(d.L / 2, 0, false), mk(d.L, 0, true), mk(0, d.W, true), mk(d.L / 2, d.W, false), mk(d.L, d.W, true)];
  P.pocketNames = ['bottom-left', 'bottom side', 'bottom-right', 'top-left', 'top side', 'top-right'];
  return P;
}

function stepBall(b, dt, P) {
  const R = P.R;
  const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx;
  const um = Math.hypot(ux, uy);
  const sd = 3.5 * P.muS * P.g * dt;
  if (um > sd + 1e-6) {
    const ix = ux / um, iy = uy / um, mg = P.muS * P.g * dt;
    b.vx -= mg * ix; b.vy -= mg * iy;
    b.wx += -2.5 * mg * iy / R; b.wy += 2.5 * mg * ix / R;
  } else {
    const sp = Math.hypot(b.vx, b.vy);
    if (sp <= P.rollDec * dt + 0.02) { b.vx = 0; b.vy = 0; b.wx = 0; b.wy = 0; b.wz = 0; }
    else {
      const k = (sp - P.rollDec * dt) / sp;
      b.vx *= k; b.vy *= k; b.wx = -b.vy / R; b.wy = b.vx / R;
    }
  }
  if (b.wz !== 0) {
    const d = P.spinDec * dt;
    if (Math.abs(b.wz) <= d) b.wz = 0; else b.wz -= Math.sign(b.wz) * d;
  }
  b.x += b.vx * dt; b.y += b.vy * dt;
}
function cushion(b, nx, ny, P, res, t) {
  const vn = b.vx * nx + b.vy * ny;
  if (vn <= 0) return;
  const tx = -ny, ty = nx, vt = b.vx * tx + b.vy * ty;
  const e = clamp(P.eRail - 0.0006 * vn, 0.5, 0.78);
  const s = vt + P.R * b.wz;
  const cap = 0.15 * (1 + e) * vn;
  const dvt = clamp(-s / 3.5, -cap, cap);
  const nvt = vt + dvt, nvn = -e * vn;
  b.vx = nvn * nx + nvt * tx; b.vy = nvn * ny + nvt * ty;
  b.wz += 2.5 * dvt / P.R;
  if (res.contacted) res.railAfter = true;
}
function simulate(init, shot, P, opts = {}) {
  const R = P.R, L = P.L, W = P.W, D = 2 * R;
  const balls = init.map(o => ({ id: o.id, x: o.x, y: o.y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, out: false }));
  const cue = balls.find(b => b.id === 0);
  const res = { pocketed: [], firstHit: null, contacted: false, railAfter: false, paths: {}, t: 0, hits: [] };
  const ang = shot.angle + P.squirt * (shot.a || 0);
  const dx = Math.cos(ang), dy = Math.sin(ang), V = shot.speed;
  cue.vx = V * dx; cue.vy = V * dy;
  const top = 2.5 * V * (shot.b || 0) / R;
  cue.wx = -dy * top; cue.wy = dx * top; cue.wz = 2.5 * V * (shot.a || 0) / R;
  const rec = !!opts.record, sdt = opts.sampleDt || 0.025;
  const only = opts.only || null;
  if (rec) for (const b of balls) if (!only || only.has(b.id)) res.paths[b.id] = [[0, b.x, b.y]];
  let t = 0, ns = sdt;
  const maxT = opts.maxT || 14;
  while (t < maxT) {
    let vmax = 0, moving = false;
    for (const b of balls) if (!b.out) {
      const s = Math.hypot(b.vx, b.vy);
      if (s > vmax) vmax = s;
      if (s > 0 || b.wx !== 0 || b.wy !== 0) moving = true;
    }
    if (!moving) break;
    const dt = clamp(0.25 * R / Math.max(vmax, 1), 1 / 1500, 1 / 200);
    for (const b of balls) if (!b.out) stepBall(b, dt, P);
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (a.out) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const c = balls[j]; if (c.out) continue;
        const ddx = c.x - a.x, ddy = c.y - a.y, d2 = ddx * ddx + ddy * ddy;
        if (d2 >= D * D || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = ddx / d, ny = ddy / d;
        const rvx = a.vx - c.vx, rvy = a.vy - c.vy, vn = rvx * nx + rvy * ny;
        const ov = (D - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; c.x += nx * ov; c.y += ny * ov;
        if (vn <= 0) continue;
        const j2 = (1 + P.eBall) * vn / 2;
        a.vx -= j2 * nx; a.vy -= j2 * ny; c.vx += j2 * nx; c.vy += j2 * ny;
        const tx = -ny, ty = nx;
        const s = rvx * tx + rvy * ty + R * (a.wz + c.wz);
        const cap = P.muBall * j2;
        const J = clamp(s / 7, -cap, cap);
        a.vx -= J * tx; a.vy -= J * ty; c.vx += J * tx; c.vy += J * ty;
        a.wz -= 2.5 * J / R; c.wz -= 2.5 * J / R;
        if (!res.contacted && (a.id === 0 || c.id === 0)) {
          res.contacted = true; res.firstHit = a.id === 0 ? c.id : a.id;
          res.hitAt = { x: (a.x + c.x) / 2, y: (a.y + c.y) / 2, t };
        }
      }
    }
    for (const b of balls) {
      if (b.out) continue;
      let cap = false;
      for (let pi = 0; pi < P.pockets.length; pi++) {
        const pk = P.pockets[pi];
        if (Math.hypot(b.x - pk.x, b.y - pk.y) < pk.r) {
          b.out = true; b.vx = b.vy = 0; res.pocketed.push({ id: b.id, pocket: pi, t });
          if (rec && res.paths[b.id]) res.paths[b.id].push([t, pk.x, pk.y]);
          cap = true; break;
        }
      }
      if (cap) continue;
      if (b.x < R) { b.x = R; cushion(b, -1, 0, P, res, t); }
      else if (b.x > L - R) { b.x = L - R; cushion(b, 1, 0, P, res, t); }
      if (b.y < R) { b.y = R; cushion(b, 0, -1, P, res, t); }
      else if (b.y > W - R) { b.y = W - R; cushion(b, 0, 1, P, res, t); }
    }
    t += dt;
    if (rec && t >= ns) {
      ns += sdt;
      for (const b of balls) if (!b.out && res.paths[b.id]) res.paths[b.id].push([t, b.x, b.y]);
    }
  }
  if (rec) for (const b of balls) if (!b.out && res.paths[b.id]) res.paths[b.id].push([t, b.x, b.y]);
  res.t = t;
  res.final = balls.filter(b => !b.out).map(b => ({ id: b.id, x: b.x, y: b.y }));
  return res;
}

// ===== Planner =====
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function pathClear(ax, ay, bx, by, balls, skip, clear) {
  for (const b of balls) { if (skip.has(b.id)) continue; if (segDist(b.x, b.y, ax, ay, bx, by) < clear) return false; }
  return true;
}
function potGeom(cue, tb, pk, R) {
  const vx = pk.x - tb.x, vy = pk.y - tb.y, vl = Math.hypot(vx, vy), ux = vx / vl, uy = vy / vl;
  const gx = tb.x - 2 * R * ux, gy = tb.y - 2 * R * uy;
  const cx = gx - cue.x, cy = gy - cue.y, cl = Math.hypot(cx, cy);
  return { gx, gy, u: [ux, uy], cl, vl, cosCut: (cx * ux + cy * uy) / cl, ang: Math.atan2(cy, cx) };
}
function legalTargets(ids, game, group) {
  if (game === '9ball') { const lo = Math.min(...ids.filter(i => i >= 1)); return isFinite(lo) ? [lo] : []; }
  const solids = ids.filter(i => i >= 1 && i <= 7), stripes = ids.filter(i => i >= 9 && i <= 15), has8 = ids.includes(8);
  if (group === 'solids') return solids.length ? solids : (has8 ? [8] : []);
  if (group === 'stripes') return stripes.length ? stripes : (has8 ? [8] : []);
  const open = solids.concat(stripes);
  return open.length ? open : (has8 ? [8] : []);
}
function bestEase(balls, targets, P) {
  const cue = balls.find(b => b.id === 0);
  if (!cue || !targets.length) return 0;
  let best = 0;
  for (const tid of targets) {
    const tb = balls.find(b => b.id === tid); if (!tb) continue;
    for (const pk of P.pockets) {
      const g = potGeom(cue, tb, pk, P.R);
      if (g.cosCut < 0.2) continue;
      const sk = new Set([0, tid]);
      if (!pathClear(cue.x, cue.y, g.gx, g.gy, balls, sk, 2 * P.R - 0.15)) continue;
      if (!pathClear(tb.x, tb.y, pk.x, pk.y, balls, sk, 2 * P.R - 0.15)) continue;
      const e = g.cosCut * g.cosCut * Math.exp(-(g.cl + 2.5 * g.vl) / 260) * (pk.corner ? 1 : 0.82);
      if (e > best) best = e;
    }
  }
  return best;
}
function makeCtx(cfg, ids, legal) {
  const own = new Set(), opp = new Set();
  if (cfg.game === '8ball') {
    for (const i of ids) {
      if (i === 8) continue;
      const solid = i <= 7;
      if (cfg.group === 'open') own.add(i);
      else if ((cfg.group === 'solids') === solid) own.add(i); else opp.add(i);
    }
    if (legal.size === 1 && legal.has(8)) own.add(8);
  }
  return { game: cfg.game, group: cfg.group, legal, own, opp, ids, P: cfg.P };
}
function evalResult(res, ctx) {
  const out = { foul: false, pots: [], gave: 0, win: false, lose: false, notes: [] };
  const pk = res.pocketed.filter(p => p.id !== 0);
  if (res.pocketed.some(p => p.id === 0)) { out.foul = true; out.notes.push('scratch'); }
  if (res.firstHit == null) { out.foul = true; out.notes.push('no contact'); }
  else if (!ctx.legal.has(res.firstHit)) { out.foul = true; out.notes.push('wrong ball first'); }
  if (!out.foul && pk.length === 0 && !res.railAfter) { out.foul = true; out.notes.push('no rail'); }
  if (ctx.game === '9ball') {
    for (const p of pk) out.pots.push(p.id);
    if (pk.some(p => p.id === 9) && !out.foul) out.win = true;
  } else {
    for (const p of pk) {
      if (p.id === 8) { if (ctx.legal.has(8) && ctx.legal.size === 1 && !out.foul) out.win = true; else out.lose = true; }
      else if (ctx.group === 'open' || ctx.own.has(p.id)) out.pots.push(p.id);
      else out.gave++;
    }
  }
  return out;
}

// ===== Position for the next ball =====
// After this shot, which ball is next, and through which pocket(s) is it easiest? Returns null when nothing is left.
function nextInfo(rest, game, group, P) {
  const R = P.R, D = P.L / 8, targets = legalTargets(rest.map(q => q.id), game, group); if (!targets.length) return null;
  let pick = null;
  for (const tid of targets) {
    const tb = rest.find(q => q.id === tid); if (!tb) continue;
    const pks = [];
    for (const pk of P.pockets) {
      const vx = pk.x - tb.x, vy = pk.y - tb.y, vl = Math.hypot(vx, vy); if (vl < 0.1) continue;
      if (!pathClear(tb.x, tb.y, pk.x, pk.y, rest, new Set([tid]), 2 * R - 0.15)) continue;
      const nx = pk.corner ? (pk.x < P.L / 2 ? -1 : 1) / Math.SQRT2 : 0, ny = pk.corner ? (pk.y < P.W / 2 ? -1 : 1) / Math.SQRT2 : (pk.y < P.W / 2 ? -1 : 1);
      const entry = Math.acos(Math.max(-1, Math.min(1, (vx * nx + vy * ny) / vl))) * 180 / Math.PI;
      if (entry > (pk.corner ? 60 : 55)) continue;
      pks.push({ pk, score: (1 - entry / 90) / (1 + vl / (3 * D)) * (pk.corner ? 1 : 0.85) });
    }
    pks.sort((u, v) => v.score - u.score);
    const use = pks.filter((q, i) => i === 0 || (i === 1 && q.score >= 0.8 * pks[0].score)).map(q => q.pk);
    const sc = pks.slice(0, 2).reduce((t, q) => t + q.score, 0);
    if (pks.length && (!pick || sc > pick.sc)) pick = { tb, tid, pks: use, sc };
  }
  return pick;
}
// How good is a cue-ball spot for potting ball `n` (from nextInfo)? 3 green, 2 amber, 1 red, 0 nothing; hooked when the
// angle would be fine but another ball is in the way.
function shotGrade(x, y, n, rest, P) {
  const R = P.R, D = P.L / 8, others = rest.filter(q => q.id !== n.tid);
  let best = 0, hooked = false, bestPk = null, bestG = null;
  for (const pk of n.pks) {
    const g = potGeom({ x, y }, n.tb, pk, R); if (g.cl < 0.5) continue;
    const cut = Math.acos(Math.max(-1, Math.min(1, g.cosCut))) * 180 / Math.PI;
    let q = 0;
    if (cut <= 15 && g.cl >= 0.6 * D && g.cl <= 2.6 * D) q = 3;
    else if (cut <= 25 && g.cl >= 0.4 * D && g.cl <= 3.0 * D) q = 2;
    else if (cut <= 33 && g.cl >= 0.3 * D && g.cl <= 3.3 * D) q = 1;
    if (!q) continue;
    if (!pathClear(x, y, g.gx, g.gy, others, new Set([0, n.tid]), 2 * R - 0.15)) { if (q >= 2) hooked = true; continue; }
    if (q > best) { best = q; bestPk = pk; bestG = g; }
  }
  return { q: best, hooked: !best && hooked, pk: bestPk, g: bestG };
}
// Where does the cue ball naturally go after potting ball n from (x,y)? Stop (straight in), stun along the tangent line,
// follow and draw: sample those lines (with one cushion bounce) and ask whether any spot leaves a good shot on the ball after.
function shapeOK(x, y, n, sg, rest, P, after) {
  if (!after || !sg.g) return 1;
  const R = P.R, D = P.L / 8, g = sg.g, u = g.u, cl = g.cl || 1, vx = (g.gx - x) / cl, vy = (g.gy - y) / cl;
  const rest2 = rest.filter(q => q.id !== n.tid).concat([]);
  let tx = vx - (vx * u[0] + vy * u[1]) * u[0], ty = vy - (vx * u[0] + vy * u[1]) * u[1]; const tl = Math.hypot(tx, ty);
  const dirs = [];
  if (tl > 0.15) { tx /= tl; ty /= tl; dirs.push([tx, ty]); const f = [tx + 0.7 * u[0], ty + 0.7 * u[1]], d = [tx - 0.5 * u[0], ty - 0.5 * u[1]]; for (const w of [f, d]) { const l = Math.hypot(w[0], w[1]); dirs.push([w[0] / l, w[1] / l]); } }
  else { dirs.push([u[0], u[1]]); dirs.push([-u[0], -u[1]]); } // straight in: follow through or draw back
  let best = 0; const pts = [[g.gx, g.gy]];
  for (const [dx, dy] of dirs) for (const s of [0.5, 1, 1.5, 2, 2.5, 3]) {
    let px = g.gx + dx * s * D, py = g.gy + dy * s * D;
    if (px < R) px = 2 * R - px; if (px > P.L - R) px = 2 * (P.L - R) - px; if (py < R) py = 2 * R - py; if (py > P.W - R) py = 2 * (P.W - R) - py;
    if (px < R || px > P.L - R || py < R || py > P.W - R) continue; pts.push([px, py]);
  }
  for (const [px, py] of pts) {
    if (rest2.some(q => Math.hypot(q.x - px, q.y - py) < 2 * R)) continue;
    if (P.pockets.some(pk => Math.hypot(pk.x - px, pk.y - py) < pk.r + 2)) continue;
    const q = shotGrade(px, py, after, rest2, P).q; if (q > best) best = q; if (best === 3) break;
  }
  return best >= 3 ? 1 : best === 2 ? 0.6 : best === 1 ? 0.3 : 0;
}
// The colour of one spot in the position zone: easy on the next ball AND natural shape to the one after = green.
function zoneGrade(x, y, z) {
  const sg = shotGrade(x, y, z.n, z.rest, z.P);
  if (!sg.q) return { q: 0, hooked: sg.hooked };
  if (!z.after) return { q: sg.q, hooked: false };
  const sh = shapeOK(x, y, z.n, sg, z.rest, z.P, z.after);
  // green needs at least a playable shot on the ball after; amber/red drop one step when the next shape is poor
  let q = sg.q; if (q >= 2 && sh < 0.6) q -= 1;
  return { q, hooked: false, shape: sh };
}
// Everything the zone needs after a planned shot: the balls left, the next ball, and the one after it.
function zoneCtx(final, pots, game, group, P) {
  const rest = final.filter(q => q.id !== 0 && !pots.includes(q.id)); if (!rest.length) return null;
  if (game === '8ball' && group === 'open' && pots.length) group = pots[0] <= 7 ? 'solids' : 'stripes';
  const n = nextInfo(rest, game, group, P); if (!n) return null;
  const rest2 = rest.filter(q => q.id !== n.tid), after = rest2.length ? nextInfo(rest2, game, group, P) : null;
  return { n, after, rest, P };
}
const ZQ = [0.05, 0.3, 0.65, 1];
function valueOf(out, res, ctx) {
  if (out.lose) return -10;
  if (out.win) return 10;
  if (out.foul) return -3;
  if (!out.pots.length) return -0.4;
  const remaining = res.final.filter(b => b.id !== 0);
  const ids = remaining.map(b => b.id);
  let group = ctx.group;
  if (ctx.game === '8ball' && group === 'open') group = out.pots[0] <= 7 ? 'solids' : 'stripes';
  // position: how good the cue ball's resting spot is for the next ball, and for getting from it to the one after
  const z = zoneCtx(res.final, out.pots, ctx.game, group, ctx.P), cue = res.final.find(b => b.id === 0);
  let pos = 0;
  if (z && cue) { const zg = zoneGrade(cue.x, cue.y, z); pos = ZQ[zg.q] * 0.8 + 0.2 * bestEase(res.final, [z.n.tid], ctx.P); }
  else pos = bestEase(res.final, legalTargets(ids, ctx.game, group), ctx.P);
  return 1 + 0.25 * Math.min(2, out.pots.length - 1) - 0.5 * out.gave + 1.6 * pos;
}
const POCKET_DESC = P => i => P.pocketNames[i];

function* planGen(layout, cfg) {
  const P = cfg.P, R = P.R, skill = cfg.skill || 0.35;
  const balls = layout.balls.map(b => ({ id: b.id, x: b.x, y: b.y }));
  const cue = balls.find(b => b.id === 0);
  if (!cue) return { error: 'Cue ball not found', cands: [] };
  const objs = balls.filter(b => b.id >= 1), ids = objs.map(b => b.id);
  const legalArr = legalTargets(ids, cfg.game, cfg.group);
  if (!legalArr.length) return { error: 'No legal target balls', cands: [] };
  const legal = new Set(legalArr), ctx = makeCtx(cfg, ids, legal);
  const cands = [];
  const trial = shot => { const res = simulate(balls, shot, P); const out = evalResult(res, ctx); return { res, out, val: valueOf(out, res, ctx), shot }; };
  const SO = cfg.speedOf || (L => L * 1.6 * MPH), levels = [2, 3, 5, 7], sdv = (cfg.speedSd || 0.1) / 0.1;
  const spins = [[0, 0], [0, 0.3], [0, -0.3], [0, -0.45], [0.25, 0], [-0.25, 0], [0.25, 0.3], [-0.25, 0.3]];
  // A: ghost-ball direct pots
  for (const tid of legalArr) {
    const tb = balls.find(b => b.id === tid);
    for (let pi = 0; pi < P.pockets.length; pi++) {
      const pk = P.pockets[pi], g = potGeom(cue, tb, pk, R);
      if (g.cosCut < 0.17) continue;
      if (g.gx < R - 0.01 || g.gx > P.L - R + 0.01 || g.gy < R - 0.01 || g.gy > P.W - R + 0.01) continue;
      const sk = new Set([0, tid]);
      if (!pathClear(cue.x, cue.y, g.gx, g.gy, balls, sk, 2 * R - 0.12)) continue;
      if (!pathClear(tb.x, tb.y, pk.x, pk.y, balls, sk, 2 * R - 0.12)) continue;
      for (const lv of levels) for (const [a, b] of spins) {
        const sp = SO(lv);
        const base = g.ang - P.squirt * a;
        for (const off of [0, 0.6, -0.6, 1.2, -1.2]) {
          const tr = trial({ angle: base + off * D2R, speed: sp, a, b });
          if (tr.out.pots.includes(tid) && !tr.out.foul) { cands.push({ kind: 'pot', target: tid, pocket: pi, shot: tr.shot, val: tr.val, cut: Math.acos(clamp(g.cosCut, -1, 1)) / D2R, ghost: [g.gx, g.gy], level: lv }); break; }
          if (tr.out.foul && tr.out.notes.includes('scratch') && off === 0) break;
        }
        yield 0;
      }
    }
  }
  // B: combo / carom sweeps
  for (const fid of legalArr) {
    const fb = balls.find(b => b.id === fid), d = Math.hypot(fb.x - cue.x, fb.y - cue.y);
    if (d < 2 * R + 0.1) continue;
    const base = Math.atan2(fb.y - cue.y, fb.x - cue.x), half = Math.asin(Math.min(1, 2 * R / d)) * 0.97;
    for (let da = -half; da <= half; da += 0.4 * D2R) {
      for (const lv of [4, 7]) {
        const tr = trial({ angle: base + da, speed: SO(lv), a: 0, b: 0 });
        const others = tr.out.pots.filter(p => p !== fid);
        if (tr.res.firstHit === fid && others.length && !tr.out.foul && !tr.out.pots.includes(fid) && !tr.out.win === !tr.out.win) {
          cands.push({ kind: 'combo', target: fid, pocket: tr.res.pocketed.find(p => p.id !== 0).pocket, shot: tr.shot, val: tr.val, via: others[0], cut: 0, level: lv });
        }
        yield 0;
      }
    }
  }
  // B2: position. For the most promising pots, try a little softer/firmer and more follow/draw, to land the cue ball
  // where the next ball is easiest (and leads on to the one after).
  cands.sort((a, b) => b.val - a.val);
  { const seenT = new Set(), refine = [];
    for (const c of cands) { if (c.kind !== 'pot') continue; const k = c.target + '|' + c.pocket + '|' + Math.round(c.shot.b * 10); if (seenT.has(k)) continue; seenT.add(k); refine.push(c); if (refine.length >= 6) break; }
    for (const c of refine) {
      let best = c;
      for (const f of [0.7, 0.85, 1.15, 1.3, 1.5]) for (const b of [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45]) {
        const tr = trial({ angle: c.shot.angle, speed: c.shot.speed * f, a: c.shot.a, b });
        if (tr.out.pots.includes(c.target) && !tr.out.foul && tr.val > best.val) best = { ...c, shot: tr.shot, val: tr.val, level: Math.max(1, Math.round(c.level * f)) };
        yield 0;
      }
      if (best !== c) cands.push(best);
    }
  }
  // C: robustness
  cands.sort((a, b) => b.val - a.val);
  const seen = new Set(), top = [];
  for (const c of cands) {
    const k = c.kind + c.target + c.pocket + Math.round(c.shot.speed / 10) + Math.round(c.shot.a * 10) + Math.round(c.shot.b * 10) + (c.via || '');
    if (seen.has(k)) continue; seen.add(k); top.push(c); if (top.length >= 16) break;
  }
  const pts = [[-1, 1, 0, 0], [1, 1, 0, 0], [-0.5, 0.93, 0, 0], [0.5, 1.07, 0, 0], [0, 0.9, 0.05, 0], [0, 1.1, -0.05, 0.05], [-1, 1.05, 0, -0.05], [1, 0.95, 0.05, 0.05]];
  for (const c of top) {
    let sum = c.val, n = 1, ok = 1;
    for (const [dA, f, da, db] of pts) {
      const s = { angle: c.shot.angle + dA * skill * D2R, speed: c.shot.speed * (1 + (f - 1) * sdv), a: clamp(c.shot.a + da, -0.5, 0.5), b: clamp(c.shot.b + db, -0.5, 0.5) };
      const tr = trial(s); sum += tr.val; n++;
      const good = c.kind === 'combo' ? (tr.out.pots.length && !tr.out.foul) : (tr.out.pots.includes(c.target) && !tr.out.foul);
      if (good) ok++;
    }
    c.score = sum / n; c.p = ok / n; yield 0;
  }
  top.sort((a, b) => b.score - a.score);
  // D: safeties when pots are poor
  const bestPot = top.length ? top[0].score : -9;
  if (bestPot < 0.5) {
    const oppT = cfg.game === '9ball' ? legalArr : ids.filter(i => ctx.opp.has(i) || (cfg.group === 'open' && i !== 8));
    const safes = [];
    for (const fid of legalArr) {
      const fb = balls.find(b => b.id === fid), d = Math.hypot(fb.x - cue.x, fb.y - cue.y);
      const base = Math.atan2(fb.y - cue.y, fb.x - cue.x), half = Math.asin(Math.min(1, 2 * R / Math.max(d, 2 * R + 0.1))) * 0.9;
      for (let da = -half; da <= half; da += 1.2 * D2R) for (const lv of [1, 2, 3]) for (const b of [0, -0.3]) {
        const tr = trial({ angle: base + da, speed: SO(lv), a: 0, b });
        if (tr.out.foul || tr.out.pots.length || tr.res.firstHit !== fid) { yield 0; continue; }
        const oe = bestEase(tr.res.final, oppT.length ? oppT : ids, P);
        safes.push({ kind: 'safety', target: fid, pocket: -1, shot: tr.shot, score: -0.4 + 0.72 * (1 - oe), p: 1, opp: oe, cut: 0, level: lv });
        yield 0;
      }
    }
    safes.sort((a, b) => b.score - a.score);
    for (const s of safes.slice(0, 3)) top.push(s);
    top.sort((a, b) => b.score - a.score);
  }
  const final = top.slice(0, 8);
  for (const c of final) { c.res = simulate(balls, c.shot, P, { record: true }); c.cueEnd = c.res.final.find(b => b.id === 0) || null; }
  return { cands: final, legal: legalArr };
}
function runSync(gen) { let r; do { r = gen.next(); } while (!r.done); return r.value; }

// ===== Shot fitting: infer speed / spin from measured cue-ball path =====
function* fitGen(layout, meas, P) {
  // meas: {dir (rad), v0 (in/s), samples:[[t,x,y]...] cue only, t measured from impact}
  const balls = layout.balls.map(b => ({ id: b.id, x: b.x, y: b.y }));
  const only = new Set([0]);
  const cost = (f, a, b, dd) => {
    const shot = { angle: meas.dir + dd - P.squirt * a, speed: meas.v0 * f, a, b };
    const res = simulate(balls, shot, P, { record: true, only, sampleDt: 0.02, maxT: 12 });
    const path = res.paths[0]; let c = 0;
    for (const [t, x, y] of meas.samples) {
      let k = 0; while (k < path.length - 1 && path[k][0] < t) k++;
      c += Math.hypot(path[k][1] - x, path[k][2] - y) ** 2;
    }
    const last = meas.samples[meas.samples.length - 1], pe = path[path.length - 1];
    c = c / meas.samples.length + 2 * Math.hypot(pe[1] - last[1], pe[2] - last[2]) ** 2;
    c += 10 * a * a + 3 * b * b + 2 * ((f - 1) / 0.09) ** 2;
    return { c, shot };
  };
  let best = null;
  const tryIt = (f, a, b, dd) => { const r = cost(f, a, b, dd); if (!best || r.c < best.cost) best = { cost: r.c, shot: r.shot, speed: r.shot.speed, a: clamp(a, -0.5, 0.5), b: clamp(b, -0.5, 0.5), f, dd }; };
  for (const f of [0.8, 0.95, 1.1, 1.3]) for (const a of [-0.4, -0.2, 0, 0.2, 0.4]) for (const b of [-0.45, -0.3, -0.15, 0, 0.2, 0.4]) { tryIt(f, a, b, 0); yield 0; }
  for (const [sf, sa, sb, sd] of [[0.1, 0.12, 0.12, 0.4 * D2R], [0.04, 0.05, 0.05, 0.15 * D2R]]) {
    for (let round = 0; round < 2; round++) {
      const c0 = best;
      for (const df of [-sf, 0, sf]) for (const da of [-sa, 0, sa]) for (const db of [-sb, 0, sb]) for (const dd of [-sd, 0, sd]) {
        if (!df && !da && !db && !dd) continue;
        tryIt(c0.f + df, clamp(c0.a + da, -0.5, 0.5), clamp(c0.b + db, -0.5, 0.5), c0.dd + dd); yield 0;
      }
    }
  }
  return best;
}

// ===== Drills =====
const DRILLS = {
  cut15: { title: '15° cut', cut: 15, dist: [28, 48] },
  cut30: { title: '30° cut', cut: 30, dist: [28, 48] },
  cut45: { title: '45° cut', cut: 45, dist: [24, 44] },
  cut60: { title: '60° thin cut', cut: 60, dist: [20, 36] },
  long: { title: 'Long straight-in', cut: 4, dist: [58, 82] },
  stop: { title: 'Stop shot', cut: 12, dist: [24, 40], b: -0.12 },
  follow: { title: 'Follow shot', cut: 15, dist: [24, 44], b: 0.38 },
  draw: { title: 'Draw shot', cut: 15, dist: [24, 44], b: -0.42 },
  english: { title: 'Cut with english', cut: 30, dist: [26, 44], a: 0.3, b: 0 },
};
const rr = (a, b) => a + Math.random() * (b - a);
function genDrill(key, P) {
  const def = DRILLS[key], R = P.R;
  for (let at = 0; at < 400; at++) {
    const tb = { id: 1, x: rr(8, P.L - 8), y: rr(8, P.W - 8) };
    const pi = Math.floor(Math.random() * 6), pk = P.pockets[pi];
    const dp = Math.hypot(pk.x - tb.x, pk.y - tb.y);
    if (dp < 9 || dp > 46) continue;
    const ux = (pk.x - tb.x) / dp, uy = (pk.y - tb.y) / dp;
    const gx = tb.x - 2 * R * ux, gy = tb.y - 2 * R * uy;
    const sgn = Math.random() < 0.5 ? 1 : -1, th = def.cut * sgn * D2R, dist = rr(def.dist[0], def.dist[1]);
    const dx = ux * Math.cos(th) - uy * Math.sin(th), dy = ux * Math.sin(th) + uy * Math.cos(th);
    const cue = { id: 0, x: gx - dist * dx, y: gy - dist * dy };
    if (cue.x < R + 2 || cue.x > P.L - R - 2 || cue.y < R + 2 || cue.y > P.W - R - 2) continue;
    const balls = [cue, tb];
    const g = potGeom(cue, tb, pk, R);
    const shotBase = { angle: g.ang, speed: rr(3, 6) * MPH, a: def.a ? def.a * sgn : 0, b: def.b !== undefined ? def.b : (Math.random() < 0.5 ? 0 : 0.2) };
    shotBase.angle -= P.squirt * shotBase.a;
    let ok = null;
    for (const off of [0, 0.6, -0.6, 1.2, -1.2]) {
      const shot = { ...shotBase, angle: shotBase.angle + off * D2R };
      const res = simulate(balls, shot, P, { record: true });
      const out = res.pocketed.some(p => p.id === 1) && !res.pocketed.some(p => p.id === 0);
      if (out) { ok = { shot, res }; break; }
    }
    if (!ok) continue;
    const ce = ok.res.final.find(b => b.id === 0);
    if (!ce) continue;
    return { key, title: def.title, balls, pocket: pi, target: 1, ref: { shot: ok.shot, res: ok.res, cut: def.cut, ghost: [g.gx, g.gy] }, ring: { x: ce.x, y: ce.y, r: 6 }, cut: def.cut };
  }
  return null;
}


// ===== Uncertainty (Monte Carlo around the planned shot) =====
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function* mcGen(layout, cand, cfg, N) {
  const P = cfg.P, balls = layout.balls.map(b => ({ id: b.id, x: b.x, y: b.y }));
  const ids = balls.filter(b => b.id >= 1).map(b => b.id), legalArr = legalTargets(ids, cfg.game, cfg.group), legal = new Set(legalArr);
  const ctx = makeCtx(cfg, ids, legal), nom = cand.res.paths, aimSd = (cfg.skill || 0.35) * D2R, spdSd = cfg.speedSd || 0.1;
  const acc = {}; for (const id in nom) acc[id] = nom[id].map(() => [0, 0, 0]);
  let ok = 0;
  for (let r = 0; r < N; r++) {
    const s = { angle: cand.shot.angle + gauss() * aimSd, speed: cand.shot.speed * (1 + gauss() * spdSd), a: clamp(cand.shot.a + gauss() * 0.06, -0.5, 0.5), b: clamp(cand.shot.b + gauss() * 0.06, -0.5, 0.5) };
    const res = simulate(balls, s, P, { record: true });
    const out = evalResult(res, ctx);
    if (cand.kind === 'safety' ? !out.foul : (cand.kind === 'combo' ? (out.pots.length && !out.foul) : (out.pots.includes(cand.target) && !out.foul))) ok++;
    for (const id in nom) {
      const p = res.paths[id], a = acc[id];
      for (let i = 0; i < a.length; i++) { const q = p ? p[Math.min(i, p.length - 1)] : null; const x = q ? q[1] : nom[id][0][1], y = q ? q[2] : nom[id][0][2]; a[i][0] += x; a[i][1] += y; a[i][2] += x * x + y * y; }
    }
    yield 0;
  }
  const sd = {};
  for (const id in acc) sd[id] = acc[id].map(([sx, sy, s2]) => Math.sqrt(Math.max(0, s2 / N - (sx / N) ** 2 - (sy / N) ** 2)));
  return { p: ok / N, sd };
}

// ===== Position zone: how comfortable is the NEXT shot from each cue-ball spot =====
function positionZone(cand, cfg, step) {
  const P = cfg.P, res = cand.res; if (!res || cand.kind === 'safety') return null;
  if (res.pocketed.some(p => p.id === 0)) return null;
  const pots = res.pocketed.filter(p => p.id !== 0).map(p => p.id); if (!pots.length) return null;
  const rest = res.final.filter(b => b.id !== 0), ids = rest.map(b => b.id); if (!ids.length) return null;
  let group = cfg.group;
  if (cfg.game === '8ball' && group === 'open') group = pots[0] <= 7 ? 'solids' : 'stripes';
  const targets = legalTargets(ids, cfg.game, group); if (!targets.length) return null;
  const R = P.R, nx = Math.floor(P.L / step), ny = Math.floor(P.W / step), ease = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = (i + 0.5) * step, y = (j + 0.5) * step;
    if (x < R + 0.5 || x > P.L - R - 0.5 || y < R + 0.5 || y > P.W - R - 0.5) continue;
    if (rest.some(b => Math.hypot(b.x - x, b.y - y) < 2 * R + 0.3)) continue;
    ease[j * nx + i] = bestEase(rest.concat([{ id: 0, x, y }]), targets, P);
  }
  return { step, nx, ny, ease, targets };
}

// ===== Table feel: fit cloth roll-out and cushion bounce from straight calibration shots =====
function* fitTableGen(shots, P0) {
  let best = null;
  for (const rd of [3, 4, 5, 6.5, 8, 10]) for (const er of [0.6, 0.67, 0.73, 0.79]) {
    const P = makeP(P0.ft || 9, { rollDec: rd, eRail: er }); let cost = 0;
    for (const s of shots) {
      const res = simulate([{ id: 0, x: s.pos0.x, y: s.pos0.y }], { angle: s.dir, speed: s.v0, a: 0, b: 0 }, P, { record: true, sampleDt: 0.05, maxT: 14 });
      const path = res.paths[0], pe = path[path.length - 1], last = s.track[s.track.length - 1];
      cost += Math.hypot(pe[1] - last[1], pe[2] - last[2]) ** 2;
      let c2 = 0; for (const [t, x, y] of s.track) { let k = 0; while (k < path.length - 1 && path[k][0] < t) k++; c2 += Math.hypot(path[k][1] - x, path[k][2] - y) ** 2; }
      cost += c2 / s.track.length;
    }
    if (!best || cost < best.cost) best = { cost: cost / shots.length, rollDec: rd, eRail: er };
    yield 0;
  }
  return best;
}

if (typeof module !== 'undefined') module.exports = { zoneCtx, zoneGrade, nextInfo, shotGrade, mcGen, positionZone, fitTableGen, D2R, MPH, clamp, homography, applyH, invert3, makeCam, makeP, simulate, planGen, runSync, fitGen, genDrill, DRILLS, legalTargets, bestEase, potGeom };
