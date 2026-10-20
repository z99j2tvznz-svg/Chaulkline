// ===== VISION: cloth detection, ball detection, identification, cue tracking (pure; works on {data,width,height}) =====
function rgb2hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) {
    if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return [h, mx === 0 ? 0 : d / mx, mx];
}
const hueDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

function floodLargest(mask, w, h) {
  const lab = new Int32Array(w * h); let best = null, id = 0;
  const stack = [];
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || lab[i]) continue;
    id++; let n = 0; stack.length = 0; stack.push(i); lab[i] = id;
    const pts = [];
    while (stack.length) {
      const p = stack.pop(); n++; pts.push(p);
      const x = p % w, y = (p / w) | 0;
      if (x > 0 && mask[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && mask[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && mask[p - w] && !lab[p - w]) { lab[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && mask[p + w] && !lab[p + w]) { lab[p + w] = id; stack.push(p + w); }
    }
    if (!best || n > best.length) best = pts;
  }
  return best;
}

// ---- shape helpers ----
function convexHull(pts) {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const up = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; }
function bestQuad(hull) {
  const n = hull.length, tri = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
  let bq = null, ba = -1;
  for (let i = 0; i < n; i++) for (let k = i + 2; k < n; k++) {
    let b1 = -1, a1 = -1, b2 = -1, a2 = -1;
    for (let j = i + 1; j < k; j++) { const a = tri(hull[i], hull[j], hull[k]); if (a > a1) { a1 = a; b1 = j; } }
    for (let j = k + 1; j < n + i; j++) { const jj = j % n, a = tri(hull[i], hull[jj], hull[k]); if (a > a2) { a2 = a; b2 = jj; } }
    if (b1 >= 0 && b2 >= 0 && a1 + a2 > ba) { ba = a1 + a2; bq = [hull[i], hull[b1], hull[k], hull[b2]]; }
  }
  return bq;
}
// top-left, top-right, bottom-right, bottom-left as the picture shows them
function orderQuad(q) {
  const cx = q.reduce((s, p) => s + p[0], 0) / 4, cy = q.reduce((s, p) => s + p[1], 0) / 4;
  return q.slice().sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx));
}

// Find the cloth: dominant saturated hue, largest region, four extreme corners.
function detectTable(img) {
  const W = img.width, H = img.height, st = Math.max(1, Math.round(W / 240));
  const w = Math.floor(W / st), h = Math.floor(H / st);
  const hs = new Float32Array(w * h), ss = new Float32Array(w * h), vs = new Float32Array(w * h);
  const hist = new Float32Array(36);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = ((y * st) * W + x * st) * 4, i = y * w + x;
    const [hh, s, v] = rgb2hsv(img.data[o], img.data[o + 1], img.data[o + 2]);
    hs[i] = hh; ss[i] = s; vs[i] = v;
    if (s > 0.3 && v > 0.18) hist[Math.floor(hh / 10) % 36] += s * v;
  }
  const peaks = [];
  for (let i = 0; i < 36; i++) { const s = hist[i] * 2 + hist[(i + 35) % 36] + hist[(i + 1) % 36]; peaks.push([s, i]); }
  peaks.sort((a, b) => b[0] - a[0]);
  const picks = []; for (const [s, i] of peaks) { if (s <= 0 || picks.length >= 3) break; if (picks.every(([, j]) => Math.min(Math.abs(i - j), 36 - Math.abs(i - j)) > 2)) picks.push([s, i]); }
  if (!picks.length) return null;
  let best = null;
  for (const [, bi] of picks) {
    const hc = bi * 10 + 5, mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = (hueDiff(hs[i], hc) < 24 && ss[i] > 0.25 && vs[i] > 0.15) ? 1 : 0;
    const comp = floodLargest(mask, w, h);
    if (!comp || comp.length < w * h * 0.06) continue;
    let bd = 0, sx0 = 0, sy0 = 0;
    for (const p of comp) { const x = p % w, y = (p / w) | 0; sx0 += x; sy0 += y; if (x < 2 || y < 2 || x > w - 3 || y > h - 3) bd++; }
    const cx0 = sx0 / comp.length, cy0 = sy0 / comp.length, frac = comp.length / (w * h);
    const central = 1 - Math.min(1, Math.hypot(cx0 - w / 2, cy0 - h / 2) / (0.5 * Math.hypot(w, h)));
    const border = Math.min(1, bd / (2 * (w + h)) * 6);
    const score = frac * (0.4 + 0.6 * central) * (1 - 0.8 * border) * (hc >= 90 && hc <= 260 ? 1.4 : 1);
    if (!best || score > best.score) best = { score, comp, hc, frac };
  }
  if (!best) return null;
  const comp = best.comp, hc = best.hc;
  // Outline of the cloth, then the best four-corner shape inside it (works from any side or angle)
  const rowL = new Int32Array(h).fill(1e9), rowR = new Int32Array(h).fill(-1);
  for (const p of comp) { const x = p % w, y = (p / w) | 0; if (x < rowL[y]) rowL[y] = x; if (x > rowR[y]) rowR[y] = x; }
  const op = []; for (let y = 0; y < h; y++) if (rowR[y] >= 0) { op.push([rowL[y], y]); op.push([rowR[y], y]); }
  const hull = convexHull(op); let q4 = hull.length >= 4 ? bestQuad(hull) : null;
  if (!q4) {
    let tl = null, tr = null, br = null, bl = null, a = 1e9, b = -1e9, c = -1e9, d = 1e9;
    for (const p of comp) { const x = p % w, y = (p / w) | 0; if (x + y < a) { a = x + y; tl = [x, y]; } if (x - y > c) { c = x - y; tr = [x, y]; } if (x + y > b) { b = x + y; br = [x, y]; } if (x - y < d) { d = x - y; bl = [x, y]; } }
    q4 = [tl, tr, br, bl];
  }
  q4 = orderQuad(q4);
  const raw = q4.map(([x, y]) => [x * st + st / 2, y * st + st / 2]);
  const qa = Math.abs(polyArea(q4)), fill = qa > 0 ? comp.length / qa : 0;
  return { quad: raw.map(p => p.slice()), raw, hue: hc, frac: comp.length / (w * h), fill };
}
// The cloth outline above also includes the sloped cushion faces on the far and side rails. The felt alone ends at the
// cushion noses, which is what the table model wants. Cushion faces are a different shade, so keep only felt-colored pixels.
function feltQuad(img, cl, loose) {
  const W = img.width, H = img.height, st = Math.max(1, Math.round(Math.max(W, H) / 420));
  const xs = loose.map(p => p[0]), ys = loose.map(p => p[1]), pad = 0.03 * Math.max(W, H);
  const X0 = Math.max(0, Math.floor(Math.min(...xs) - pad)), X1 = Math.min(W - 1, Math.ceil(Math.max(...xs) + pad)), Y0 = Math.max(0, Math.floor(Math.min(...ys) - pad)), Y1 = Math.min(H - 1, Math.ceil(Math.max(...ys) + pad));
  const w = Math.floor((X1 - X0) / st) + 1, h = Math.floor((Y1 - Y0) / st) + 1, mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = ((Y0 + y * st) * W + X0 + x * st) * 4, [hh, ss, vv] = rgb2hsv(img.data[o], img.data[o + 1], img.data[o + 2]);
    if (hueDiff(hh, cl.h) < 16 && Math.abs(ss - cl.s) < 0.16 && Math.abs(vv - cl.v) < Math.max(0.1, 0.14 * cl.v)) mask[y * w + x] = 1;
  }
  // close small gaps left by balls so they do not nibble the outline
  const comp = floodLargest(mask, w, h); if (!comp || comp.length < w * h * 0.04) return null;
  const rowL = new Int32Array(h).fill(1e9), rowR = new Int32Array(h).fill(-1);
  for (const p of comp) { const x = p % w, y = (p / w) | 0; if (x < rowL[y]) rowL[y] = x; if (x > rowR[y]) rowR[y] = x; }
  const colT = new Int32Array(w).fill(1e9), colB = new Int32Array(w).fill(-1);
  for (const p of comp) { const x = p % w, y = (p / w) | 0; if (y < colT[x]) colT[x] = y; if (y > colB[x]) colB[x] = y; }
  const op = []; for (let y = 0; y < h; y++) if (rowR[y] >= 0) { op.push([rowL[y], y]); op.push([rowR[y], y]); }
  for (let x = 0; x < w; x++) if (colB[x] >= 0) { op.push([x, colT[x]]); op.push([x, colB[x]]); }
  const hull = convexHull(op), q4 = hull.length >= 4 ? bestQuad(hull) : null; if (!q4) return null;
  const quad = orderQuad(q4), pts = op.map(([x, y]) => [x * st + X0, y * st + Y0]), q = quad.map(([x, y]) => [x * st + X0, y * st + Y0]);
  // straighten each side: fit a line through the outline points that run along it, then meet the lines at the corners
  const lines = [];
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
    let sel = pts.filter(p => { const t = ((p[0] - a[0]) * ux + (p[1] - a[1]) * uy) / len, d = Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux); return t > 0.12 && t < 0.88 && d < 0.04 * Math.max(W, H); });
    if (sel.length < 6) return null;
    let line = null;
    for (let it = 0; it < 3; it++) {
      const mx = sel.reduce((s, p) => s + p[0], 0) / sel.length, my = sel.reduce((s, p) => s + p[1], 0) / sel.length;
      let sxx = 0, sxy = 0, syy = 0; for (const p of sel) { sxx += (p[0] - mx) ** 2; sxy += (p[0] - mx) * (p[1] - my); syy += (p[1] - my) ** 2; }
      const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), vx = Math.cos(th), vy = Math.sin(th);
      line = { x: mx, y: my, vx, vy };
      const res = sel.map(p => Math.abs((p[0] - mx) * vy - (p[1] - my) * vx)), sorted = res.slice().sort((u, v) => u - v), lim = Math.max(1.5, 2.2 * sorted[sorted.length >> 1]);
      const keep = sel.filter((p, k) => res[k] <= lim); if (keep.length < 6) break; sel = keep;
    }
    lines.push(line);
  }
  const meet = (l1, l2) => { const den = l1.vx * l2.vy - l1.vy * l2.vx; if (Math.abs(den) < 1e-6) return null; const t = ((l2.x - l1.x) * l2.vy - (l2.y - l1.y) * l2.vx) / den; return [l1.x + t * l1.vx, l1.y + t * l1.vy]; };
  const out = []; for (let i = 0; i < 4; i++) { const c = meet(lines[(i + 3) % 4], lines[i]); if (!c) return null; out.push(c); }
  // sanity: must be near the first guess
  const md = Math.max(...out.map((c, i) => Math.hypot(c[0] - q[i][0], c[1] - q[i][1])));
  if (md > 0.06 * Math.max(W, H)) return null;
  return out;
}

// Median-ish cloth color sampled inside the quad (balls are a minority so the mode wins).
function sampleCloth(img, quad) {
  const W = img.width, H = img.height;
  const cx = quad.reduce((s, p) => s + p[0], 0) / 4, cy = quad.reduce((s, p) => s + p[1], 0) / 4;
  const hv = [], sv = [], vv = []; let hx = 0, hy = 0;
  for (let k = 0; k < 900; k++) {
    const u = Math.random() * 0.8 - 0.4, t = Math.random() * 0.8 - 0.4;
    const x = Math.round(cx + u * (quad[1][0] - quad[0][0]) + t * (quad[3][0] - quad[0][0]));
    const y = Math.round(cy + u * (quad[1][1] - quad[0][1]) + t * (quad[3][1] - quad[0][1]));
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const o = (y * W + x) * 4, [h, s, v] = rgb2hsv(img.data[o], img.data[o + 1], img.data[o + 2]);
    if (s < 0.2) continue;
    hx += Math.cos(h * D2R) * s; hy += Math.sin(h * D2R) * s; sv.push(s); vv.push(v);
  }
  if (sv.length < 30) return null;
  sv.sort((a, b) => a - b); vv.sort((a, b) => a - b);
  let h = Math.atan2(hy, hx) / D2R; if (h < 0) h += 360;
  return { h, s: sv[sv.length >> 1], v: vv[vv.length >> 1] };
}

function isCloth(h, s, v, cl) {
  if (v < (cl.v > 0.75 ? 0.52 : 0.42) * cl.v) return false; // bright felt: shadows stay above about half the felt brightness, dark balls go below
  if (cl.s > 0.2 && s > 0.2) { const dh = hueDiff(h, cl.h); if (dh > 24 || (dh > 13 && v < 0.8 * cl.v)) return false; } // a dark ball of nearly the same hue (navy on blue felt) is darker AND a different hue; shadows are only darker
  // navy 2 ball on blue felt: much darker and deeper blue than the felt (a shadow on felt is darker but not deeper). On very
  // saturated felt (0.86+) "deeper" can only mean nearly fully saturated: the user's 2 measured 0.98-0.99 against 0.86.
  if (cl.s > 0.2 && v < 0.66 * cl.v && s > Math.min(0.95, cl.s + 0.15)) return false;
  if (Math.abs(s - cl.s) > 0.34) return false;
  if (v > 1.7 * cl.v) return false;
  return true;
}

function kmeans(pts, k) {
  const cs = [];
  let mx = 0, my = 0; for (const p of pts) { mx += p[0]; my += p[1]; } mx /= pts.length; my /= pts.length;
  let far = pts[0], fd = -1;
  for (const p of pts) { const d = (p[0] - mx) ** 2 + (p[1] - my) ** 2; if (d > fd) { fd = d; far = p; } }
  cs.push([far[0], far[1]]);
  while (cs.length < k) {
    let bp = pts[0], bd = -1;
    for (const p of pts) { let m = 1e18; for (const c of cs) m = Math.min(m, (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2); if (m > bd) { bd = m; bp = p; } }
    cs.push([bp[0], bp[1]]);
  }
  for (let it = 0; it < 8; it++) {
    const sum = cs.map(() => [0, 0, 0]);
    for (const p of pts) {
      let bi = 0, bd = 1e18;
      for (let i = 0; i < cs.length; i++) { const d = (p[0] - cs[i][0]) ** 2 + (p[1] - cs[i][1]) ** 2; if (d < bd) { bd = d; bi = i; } }
      sum[bi][0] += p[0]; sum[bi][1] += p[1]; sum[bi][2]++;
    }
    for (let i = 0; i < cs.length; i++) if (sum[i][2]) { cs[i][0] = sum[i][0] / sum[i][2]; cs[i][1] = sum[i][1] / sum[i][2]; }
  }
  return cs;
}

// Ball appearance features around (px,py)
function ballFeat(img, px, py, rpx, cl) {
  const W = img.width, H = img.height, R2 = (rpx * 0.78) ** 2, x0 = Math.max(0, Math.floor(px - rpx)), y0 = Math.max(0, Math.floor(py - rpx)), x1 = Math.min(W - 1, Math.ceil(px + rpx)), y1 = Math.min(H - 1, Math.ceil(py + rpx));
  const gw = x1 - x0 + 1, col = new Uint8Array(gw * (y1 - y0 + 1));
  let n = 0, nw = 0, nb = 0, nc = 0, cx = 0, cy = 0, vc = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if ((x - px) ** 2 + (y - py) ** 2 > R2) continue;
      const o = (y * W + x) * 4, [h, s, v] = rgb2hsv(img.data[o], img.data[o + 1], img.data[o + 2]);
      if (isCloth(h, s, v, cl)) continue;
      n++;
      if (v < 0.3) nb++;
      else if ((s < 0.3 && v > 0.55) || (s < 0.18 && v > 0.4)) nw++;
      else { nc++; cx += Math.cos(h * D2R) * s; cy += Math.sin(h * D2R) * s; vc += v; col[(y - y0) * gw + (x - x0)] = 1; }
    }
  if (n < 6) return null;
  // Is the colour one solid patch (a solid ball or a stripe band) or scattered specks (red dots on a cue ball)? Size of the biggest patch against the ball.
  let big = 0; const seen = new Uint8Array(col.length), st = [];
  for (let i = 0; i < col.length; i++) {
    if (!col[i] || seen[i]) continue; let a = 0; st.length = 0; st.push(i); seen[i] = 1;
    while (st.length) { const p = st.pop(); a++; const px2 = p % gw; if (px2 > 0 && col[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; st.push(p - 1); } if (px2 < gw - 1 && col[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; st.push(p + 1); } if (p >= gw && col[p - gw] && !seen[p - gw]) { seen[p - gw] = 1; st.push(p - gw); } if (p + gw < col.length && col[p + gw] && !seen[p + gw]) { seen[p + gw] = 1; st.push(p + gw); } }
    if (a > big) big = a;
  }
  return { wf: nw / n, bf: nb / n, cf: nc / n, cx: nc ? cx / nc : 0, cy: nc ? cy / nc : 0, vc: nc ? (vc / nc) / cl.v : 0, band: big / n };
}
const hueVec = (h, s = 0.85) => [Math.cos(h * D2R) * s, Math.sin(h * D2R) * s];
const BASE_HUE = [null, 48, 222, 3, 270, 30, 145, 345];
function priorSamples() {
  const out = [{ id: 0, prior: true, f: { wf: 0.9, bf: 0, cf: 0.05, cx: 0, cy: 0, vc: 0, band: 0.03 }, cl: 0 }];
  out.push({ id: 8, prior: true, f: { wf: 0.02, bf: 0.9, cf: 0.05, cx: 0, cy: 0, vc: 0.3 }, cl: 0 });
  for (let i = 1; i <= 7; i++) {
    const [cx, cy] = hueVec(BASE_HUE[i], i === 7 || i === 6 ? 0.7 : 0.85), vc = i === 7 || i === 6 ? 0.55 : 1.05;
    out.push({ id: i, prior: true, f: { wf: 0.04, bf: 0.03, cf: 0.9, cx, cy, vc, band: 0.85 }, cl: 0 });
    out.push({ id: i + 8, prior: true, f: { wf: 0.28, bf: 0.02, cf: 0.65, cx: cx * 0.9, cy: cy * 0.9, vc, band: 0.5 }, cl: 0 });
  }
  // the same balls as measured from a real standard set (cue ball with red dot to the 9) on blue felt, two picture sizes averaged
  SET_LOOK.forEach((f, id) => out.push({ id, prior: true, set: true, f, cl: 0 }));
  return out;
}
const SET_LOOK = [{"wf": 0.97, "bf": 0.0, "cf": 0.03, "cx": 0.19, "cy": -0.05, "vc": 0.86, "band": 0.02}, {"wf": 0.1, "bf": 0.0, "cf": 0.9, "cx": 0.69, "cy": 0.6, "vc": 0.97, "band": 0.89}, {"wf": 0.02, "bf": 0.06, "cf": 0.91, "cx": -0.74, "cy": -0.52, "vc": 0.44, "band": 0.89}, {"wf": 0.01, "bf": 0.0, "cf": 0.99, "cx": 0.82, "cy": -0.06, "vc": 0.8, "band": 0.99}, {"wf": 0.17, "bf": 0.19, "cf": 0.64, "cx": -0.07, "cy": -0.53, "vc": 0.45, "band": 0.61}, {"wf": 0.18, "bf": 0.01, "cf": 0.81, "cx": 0.77, "cy": 0.26, "vc": 0.93, "band": 0.8}, {"wf": 0.04, "bf": 0.31, "cf": 0.65, "cx": -0.59, "cy": 0.2, "vc": 0.45, "band": 0.62}, {"wf": 0.02, "bf": 0.36, "cf": 0.61, "cx": 0.6, "cy": -0.07, "vc": 0.44, "band": 0.58}, {"wf": 0.14, "bf": 0.79, "cf": 0.06, "cx": -0.23, "cy": -0.09, "vc": 0.42, "band": 0.02}, {"wf": 0.25, "bf": 0.01, "cf": 0.74, "cx": 0.67, "cy": 0.6, "vc": 0.9, "band": 0.74}];
function featCost(f, s, cloth) {
  const g = s.f;
  let d = 2.2 * Math.abs(f.wf - g.wf) + 1.6 * Math.abs(f.bf - g.bf) + 0.5 * Math.abs(f.cf - g.cf);
  if (f.cf > 0.15 && g.cf > 0.15) d += 1.8 * Math.hypot(f.cx - g.cx, f.cy - g.cy) + 0.3 * Math.abs(f.vc - g.vc);
  else if (f.cf > 0.03 && g.cf > 0.03) d += 0.9 * Math.hypot(f.cx - g.cx, f.cy - g.cy); // a little colour still has a hue: yellow band against red dots
  if (f.band !== undefined && g.band !== undefined && (f.cf > 0.05 || g.cf > 0.05)) d += 1.1 * Math.abs(f.band - g.band);
  if (s.prior) d += 0.3; else d += (s.walk ? 0.2 : 0.8) * Math.abs((s.cl || 0) - cloth.v);
  return d;
}
// How badly one ball matches each number (lower is better): the best of the recognizer's answer, the built-in colour
// guesses (a little less trusted) and the looks learned on this table. Tested on every saved session, judged on sessions
// it never learned from: never worse than either alone. Also used to keep re-checking names while the balls sit still.
function idCost(b, open, samples, cloth, recPen) {
  const best = {}, learned = {}, prior = {}; if (recPen == null) recPen = 0.15;
  if (b.feat) for (const sm of samples) { if (!open.includes(sm.id)) continue; const c = featCost(b.feat, sm, cloth); if (best[sm.id] === undefined || c < best[sm.id]) best[sm.id] = c; const t = sm.prior ? prior : learned; if (t[sm.id] === undefined || c < t[sm.id]) t[sm.id] = c; }
  if (b.rec) for (const id of open) { if (id > 9) continue; const rc = -0.7 * Math.log(Math.max(1e-4, b.rec[id])) + (Array.isArray(recPen) ? recPen[id] : recPen); best[id] = Math.min(rc, prior[id] !== undefined ? prior[id] + 0.4 : 9, learned[id] !== undefined ? learned[id] : 9); }
  return best;
}
// Give numbers to balls so that the total mismatch is lowest (best overall pairing, each number once). A ball whose best
// fit is still poor (cost above 2.1) stays unnamed. Balls already locked to a number keep it.
// opts.recPen: how much less the recognizer is trusted than this table's own learned looks (more for an away table)
function assignIds(balls, candIds, samples, cloth, opts) {
  const LIM = 2.1, ids = [...new Set(candIds)], recPen = opts && opts.recPen != null ? opts.recPen : 0.15;
  const usedId = new Set(), free = [];
  balls.forEach((b, i) => { if (b.locked && b.id != null) usedId.add(b.id); else if (b.feat) free.push(i); else { b.id = null; b.conf = 0; } });
  const open = ids.filter(id => !usedId.has(id));
  if (!free.length) return balls;
  const n = free.length, m = open.length, N = n + m, C = [];
  for (let r = 0; r < n; r++) {
    const b = balls[free[r]], best = idCost(b, open, samples, cloth, recPen);
    const row = []; for (let c = 0; c < m; c++) { const v = best[open[c]]; row.push(v === undefined || v > LIM ? 1e3 : v); }
    for (let c = 0; c < n; c++) row.push(c === r ? LIM : 1e6); // "leave this ball unnamed" option
    C.push(row);
  }
  for (let r = 0; r < m; r++) { const row = []; for (let c = 0; c < m; c++) row.push(1e6); for (let c = 0; c < n; c++) row.push(0); for (let c = 0; c < m; c++) row[c] = (c === r ? 0 : 1e6); C.push(row); } // "number not on the table" option
  const as = hungarian(C);
  for (let r = 0; r < n; r++) { const b = balls[free[r]], c = as[r]; if (c < m && C[r][c] <= LIM) { b.id = open[c]; b.conf = Math.exp(-C[r][c]); } else { b.id = null; b.conf = 0; } }
  return balls;
}
// classic O(n^3) assignment (Kuhn-Munkres) on a square cost matrix; returns column for each row
function hungarian(a) {
  const n = a.length, u = new Float64Array(n + 1), v = new Float64Array(n + 1), p = new Int32Array(n + 1), way = new Int32Array(n + 1);
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
  const ans = new Array(n); for (let j = 1; j <= n; j++) ans[p[j] - 1] = j - 1; return ans;
}

// the full-frame work arrays are kept and cleared rather than made new on every look (at 1280 px that is several MB a look)
const DETB = { n: 0 };
function detBufs(n) {
  if (DETB.n !== n) { DETB.n = n; DETB.fg = new Uint8Array(n); DETB.edge = new Uint8Array(n); DETB.er = new Uint8Array(n); DETB.lab = new Int32Array(n); DETB.nv = new Uint8Array(n); }
  else { DETB.fg.fill(0); DETB.edge.fill(0); DETB.er.fill(0); DETB.lab.fill(0); DETB.nv.fill(0); }
  return DETB;
}
// the whole navy ball around a navy core: the core plus the felt-hued but clearly darker pixels next to it (its lit half)
function navyBall(img, mx, my, rpx, cl, fg, nv, W, H, cam, R) {
  let cx = mx, cy = my, r = rpx, n = 0;
  for (let pass = 0; pass < 3; pass++) {
    const rr = (pass === 0 ? 1.6 : 1.1) * r, x0 = Math.max(0, Math.floor(cx - rr)), x1 = Math.min(W - 1, Math.ceil(cx + rr)), y0 = Math.max(0, Math.floor(cy - rr)), y1 = Math.min(H - 1, Math.ceil(cy + rr));
    let sx = 0, sy = 0; n = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > rr * rr) continue;
      const i = y * W + x; let on = nv[i];
      if (!on) { const o = i * 4, [h, s, v] = rgb2hsv(img.data[o], img.data[o + 1], img.data[o + 2]); on = (fg[i] && v < 0.66 * cl.v) || (hueDiff(h, cl.h) < 16 && v < 0.85 * cl.v && s > cl.s - 0.1); }
      if (on) { sx += x; sy += y; n++; }
    }
    if (n < 6) return null;
    cx = sx / n; cy = sy / n; const t = cam.unproj(cx, cy, R); r = cam.ballRad(t[0], t[1], R, R);
  }
  const e = Math.max(1, r - 1), ratio = n / (Math.PI * e * e);
  if (ratio < 0.5 || ratio > 1.5) return null;
  // a ball stands out from the felt around it: a navy core inside a big patch of dark felt (a hand's or a body's shadow, a dim
  // corner) is not a ball. Most of the ring just outside the ball has to be ordinary felt.
  { const r0 = 1.3 * r, r1 = 1.8 * r, x0 = Math.max(0, Math.floor(cx - r1)), x1 = Math.min(W - 1, Math.ceil(cx + r1)), y0 = Math.max(0, Math.floor(cy - r1)), y1 = Math.min(H - 1, Math.ceil(cy + r1));
    let an = 0, ad = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d2 = (x - cx) ** 2 + (y - cy) ** 2; if (d2 < r0 * r0 || d2 > r1 * r1) continue;
      const i = y * W + x, o = i * 4, [h, s, v] = rgb2hsv(img.data[o], img.data[o + 1], img.data[o + 2]); an++;
      if (nv[i] || (hueDiff(h, cl.h) < 16 && v < 0.85 * cl.v && s > cl.s - 0.1)) ad++;
    }
    if (an && ad / an > 0.55) return null; }
  const t = cam.unproj(cx, cy, R);
  return { px: cx, py: cy, rpx: r, ratio, k: 1, fill: 0.7, asp: 1, x: t[0], y: t[1], navy: 1 };
}
// the ball-sized disc (radius rpx) holding the most of a blob's pixels: its middle and how full it is (0..1)
function discFit(pts, rpx) {
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const w = x1 - x0 + 1, h = y1 - y0 + 1, r = Math.max(1.5, rpx - 1); // (blob pixels are eroded by one)
  if (w * h > 40000) return null;
  const m = new Uint8Array(w * h); for (const [x, y] of pts) m[(y - y0) * w + (x - x0)] = 1;
  const off = []; for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) if (dx * dx + dy * dy <= r * r) off.push([dx, dy]);
  let best = null, bn = -1;
  const cnt = (cx, cy) => { let n = 0; for (const [dx, dy] of off) { const xx = cx + dx, yy = cy + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && m[yy * w + xx]) n++; } return n; };
  const st = pts.length * off.length > 400000 ? 3 : pts.length * off.length > 120000 ? 2 : 1; // (big blobs: every 2nd or 3rd middle, then the best one refined)
  for (let cy = 0; cy < h; cy += st) for (let cx = 0; cx < w; cx += st) { if (!m[cy * w + cx]) continue; const n = cnt(cx, cy); if (n > bn) { bn = n; best = [cx, cy]; } }
  if (best && st > 1) { const [bx, by] = best; for (let cy = Math.max(0, by - st + 1); cy < Math.min(h, by + st); cy++) for (let cx = Math.max(0, bx - st + 1); cx < Math.min(w, bx + st); cx++) { if (!m[cy * w + cx]) continue; const n = cnt(cx, cy); if (n > bn) { bn = n; best = [cx, cy]; } } }
  return best ? { x: x0 + best[0], y: y0 + best[1], cov: bn / off.length } : null;
}
function detectBalls(img, cam, P, cloth, info) {
  const W = img.width, H = img.height, R = P.R;
  // eb: how close to the cushion something must reach to count as coming in from outside (wider when the cushion strip itself
  // is masked out as a known shadow, so an arm reaching over it still counts)
  const BUF = detBufs(W * H), fg = BUF.fg, edge = BUF.edge, tx0 = 0.55 * R, ty0 = 0.55 * R, eb = info && info.still && info.still.mask ? 3.5 * R : 1.2 * R; let tableN = 0;
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let i = 0; i < 8; i++) { // the cloth, and the tops of balls standing at its edges
    const p = cam.proj([0, P.L, P.L, 0][i & 3], [0, 0, P.W, P.W][i & 3], i < 4 ? 0 : 2 * R);
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]);
  }
  // From a low camera the top of a ball near the far cushion is seen above the cushion line: on the cloth's own level those
  // pixels land behind the cushion, and the ball was cut in half. Measured at the height of a ball's middle they land on the
  // table, so on the sides away from the camera that height decides (the rail itself is higher, so it still lands outside).
  const Cc = cam.C, sR = cam.ok && Cc ? (Cc[2] - R) / Cc[2] : 1, farY0 = Cc && Cc[1] > P.W / 2, farYW = Cc && Cc[1] < P.W / 2, farX0 = Cc && Cc[0] > P.L, farXL = Cc && Cc[0] < 0;
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(H - 1, Math.ceil(y1));
  const nv = BUF.nv, nvOn = cloth.s > 0.2, nvS = Math.min(0.95, cloth.s + 0.15); // navy: the dark core of a navy ball on blue felt
  const Hit = cam.Hit, st = info && info.still; // fixed shadows: st.mask (skip those spots) or st.hit (record what is dark this scan)
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const w = Hit[6] * x + Hit[7] * y + Hit[8];
    let tx = (Hit[0] * x + Hit[1] * y + Hit[2]) / w, ty = (Hit[3] * x + Hit[4] * y + Hit[5]) / w;
    if (tx < tx0 || tx > P.L - tx0 || ty < ty0 || ty > P.W - ty0) {
      if (sR === 1 || !((tx >= tx0 || farX0) && (tx <= P.L - tx0 || farXL) && (ty >= ty0 || farY0) && (ty <= P.W - ty0 || farYW))) continue;
      const txR = Cc[0] + sR * (tx - Cc[0]), tyR = Cc[1] + sR * (ty - Cc[1]);
      if (txR < tx0 || txR > P.L - tx0 || tyR < ty0 || tyR > P.W - ty0) continue;
      if (P.pockets.some(pk => Math.hypot(txR - pk.x, tyR - pk.y) < pk.r + 2.5)) continue; // the far pocket holes are not balls
      tx = txR; ty = tyR; // (shadows learned here and the edge band use this spot too)
    }
    tableN++;
    const o = (y * W + x) * 4, [h, s, v] = rgb2hsv(img.data[o], img.data[o + 1], img.data[o + 2]);
    if (!isCloth(h, s, v, cloth)) {
      const ii = y * W + x;
      if (st) {
        const gi = ((ty / st.cs) | 0) * st.gw + ((tx / st.cs) | 0), r = img.data[o], g = img.data[o + 1], b = img.data[o + 2];
        // a learned shadow spot is skipped only while it still looks like the shadow learned there; a ball rolling onto it
        // looks different and is kept
        // (and only while it has the cloth's own colour, darker or lighter: the shadow and the lit cushion edge do, a ball does
        // not. From a low camera a ball near the far rail falls on the learned strip, and a white ball can look like the lit edge.)
        if (st.mask) { if (st.mask[gi]) { let dh = Math.abs(h - cloth.h); if (dh > 180) dh = 360 - dh; if (((dh < 28 && s > 0.2) || (v < 0.3 && st.mr[gi] + st.mg[gi] + st.mb[gi] < 240)) && Math.abs(r - st.mr[gi]) + Math.abs(g - st.mg[gi]) + Math.abs(b - st.mb[gi]) < 60) { st.dk[gi]++; continue; } st.ot[gi]++; } }
        else if (st.hit) { st.hit[gi] = 1; st.sr[gi] += r; st.sg[gi] += g; st.sb[gi] += b; st.sn[gi]++; }
      }
      fg[ii] = 1; if (nvOn && v < 0.66 * cloth.v && s > nvS && hueDiff(h, cloth.h) <= 24) nv[ii] = 1;
      if (tx < tx0 + eb || tx > P.L - tx0 - eb || ty < ty0 + eb || ty > P.W - ty0 - eb) edge[ii] = 1;
    } else if (st && st.mask) { const gi = ((ty / st.cs) | 0) * st.gw + ((tx / st.cs) | 0); if (st.mask[gi]) st.cl[gi]++; }
  }
  const er = BUF.er;
  for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) {
    const i = y * W + x;
    if (fg[i] && fg[i - 1] && fg[i + 1] && fg[i - W] && fg[i + W]) er[i] = 1;
  }
  const lab = BUF.lab, stack = [], blobs = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const s0 = y * W + x; if (!er[s0] || lab[s0]) continue;
    const pts = []; stack.length = 0; stack.push(s0); lab[s0] = 1;
    let bx0 = x, bx1 = x, by0 = y, by1 = y;
    while (stack.length) {
      const p = stack.pop(), px = p % W, py = (p / W) | 0; pts.push([px, py]);
      if (px < bx0) bx0 = px; if (px > bx1) bx1 = px; if (py < by0) by0 = py; if (py > by1) by1 = py;
      for (const q of [p - 1, p + 1, p - W, p + W]) if (er[q] && !lab[q]) { lab[q] = 1; stack.push(q); }
    }
    blobs.push({ pts, bw: bx1 - bx0 + 1, bh: by1 - by0 + 1 });
  }
  const out = [], occ = [];
  for (const b of blobs) {
    let mx = 0, my = 0; for (const p of b.pts) { mx += p[0]; my += p[1]; } mx /= b.pts.length; my /= b.pts.length;
    const t = cam.unproj(mx, my, R), rpx = cam.ballRad(t[0], t[1], R, R);
    const e = Math.max(1, rpx - 1), Aexp = Math.PI * e * e, ratio = b.pts.length / Aexp;
    // A navy ball on blue felt: only its dark lower half differs from the felt; its lit top has the felt's own colour, just
    // darker, so the blob is half a ball and fails the size checks. Mostly navy core -> rebuild the ball around it.
    if (nvOn && ratio >= 0.1 && ratio < 1.6) {
      let nn = 0; for (const [qx, qy] of b.pts) if (nv[qy * W + qx]) nn++;
      if (nn > 0.5 * b.pts.length && Math.min(b.bw, b.bh) >= 0.6 * rpx && Math.max(b.bw, b.bh) <= 2 * Math.min(b.bw, b.bh)) { const nb = navyBall(img, mx, my, rpx, cloth, fg, nv, W, H, cam, R); if (nb) { const dpk = Math.min(...P.pockets.map(pk => Math.hypot(nb.x - pk.x, nb.y - pk.y) / pk.r));
          if (dpk >= 1 + 1.0 / 2.3 && nb.x > 0.6 * R && nb.x < P.L - 0.6 * R && nb.y > 0.6 * R && nb.y < P.W - 0.6 * R) { nb.x = clamp(nb.x, R, P.L - R); nb.y = clamp(nb.y, R, P.W - R); nb.feat = ballFeat(img, nb.px, nb.py, nb.rpx, cloth); out.push(nb); }
          continue; } }
    }
    if (ratio < 0.3) continue;
    if (ratio > 1.6) { // big dark blob right at a pocket is the pocket itself (the opening and its plastic plate), not a pile of balls
      const pk = P.pockets.find(q => Math.hypot(t[0] - q.x, t[1] - q.y) < 7);
      if (pk) { let dk = 0; for (const [qx, qy] of b.pts) { const o = (qy * W + qx) * 4; if (Math.max(img.data[o], img.data[o + 1], img.data[o + 2]) < 70) dk++; } if (dk / b.pts.length > 0.7) continue; }
    }
    // A player's body, arm, hand or cue reaching over the table: it comes in from the edge of the playing area and is far bigger
    // than a few balls, or it is bigger than any rack, or it is long and thin. It is not balls; it is something blocking the view.
    // (Three or four balls frozen together on a rail stay balls.)
    { let ed = 0; for (const [qx, qy] of b.pts) if (edge[qy * W + qx]) ed++;
      const fill0 = b.pts.length / (b.bw * b.bh);
      if ((ed >= 3 && ratio > 6) || ratio > 22 || (ratio >= 2.5 && fill0 < 0.2)) { occ.push(b); continue; } }
    if (Math.min(b.bw, b.bh) < 0.9 * rpx) continue; // too thin to be a ball: shadow strips along the cushions, cue stick, chalk lines
    const fill = b.pts.length / (b.bw * b.bh);
    if (ratio < 1.6 && (fill < 0.5 || Math.max(b.bw, b.bh) / Math.min(b.bw, b.bh) > 2.2)) {
      // V2.3.3: not ball-shaped as a whole, but there may be a whole ball in it (a ball frozen to a cushion with a bit of the
      // cushion's lit edge or shadow stuck to it was thrown away here): the best ball-sized disc inside it, if it is filled
      const fit = discFit(b.pts, rpx); if (fit && fit.cov >= 0.72) { const t3 = cam.unproj(fit.x, fit.y, R), r3 = cam.ballRad(t3[0], t3[1], R, R);
        const dpk = Math.min(...P.pockets.map(pk => Math.hypot(t3[0] - pk.x, t3[1] - pk.y) / pk.r));
        if (dpk >= 1 + 1.0 / 2.3 && t3[0] > 0.6 * R && t3[0] < P.L - 0.6 * R && t3[1] > 0.6 * R && t3[1] < P.W - 0.6 * R) out.push({ px: fit.x, py: fit.y, rpx: r3, ratio: 1, k: 1, fill: fit.cov, asp: 1, fit: 1, x: clamp(t3[0], R, P.L - R), y: clamp(t3[1], R, P.W - R), feat: ballFeat(img, fit.x, fit.y, r3, cloth) }); }
      continue;
    }
    const k = ratio < 1.55 ? 1 : Math.min(6, Math.round(ratio));
    if (info && k === 1) (info.ratios = info.ratios || []).push(ratio);
    let cs;
    if (k === 1) cs = [[mx, my]];
    else { const sub = b.pts.length > 1500 ? b.pts.filter((_, i) => i % Math.ceil(b.pts.length / 1500) === 0) : b.pts; cs = kmeans(sub, k); }
    for (const c of cs) {
      const t2 = cam.unproj(c[0], c[1], R), r2 = cam.ballRad(t2[0], t2[1], R, R);
      // in the pocket opening itself: the hole, not a ball. Near the mouth (a ball hanging on the lip, or resting by the side
      // pocket, which V2.0 threw away) it has to look like one round ball.
      const dpk = Math.min(...P.pockets.map(pk => Math.hypot(t2[0] - pk.x, t2[1] - pk.y) / pk.r));
      if (dpk < 0.75) continue;
      if (dpk < 1 + 1.0 / 2.3 && !(k === 1 && ratio > 0.6 && fill >= 0.5)) continue;
      // a ball's centre can never be closer to a cushion than its own radius: something centred on the cushion line
      // (the cushion's shadow or its lit edge, a ball sitting in the pocket jaws) is not a ball on the table
      if (t2[0] < 0.6 * R || t2[0] > P.L - 0.6 * R || t2[1] < 0.6 * R || t2[1] > P.W - 0.6 * R) continue;
      out.push({ px: c[0], py: c[1], rpx: r2, ratio, k, fill, asp: Math.max(b.bw, b.bh) / Math.min(b.bw, b.bh), x: clamp(t2[0], R, P.L - R), y: clamp(t2[1], R, P.W - R), feat: ballFeat(img, c[0], c[1], r2, cloth) });
    }
  }
  if (info) {
    // where the view is blocked: a coarse grid over the picture, grown by about a ball so balls touching the blocker count as hidden
    const cs = 4, gw = Math.ceil(W / cs), gh = Math.ceil(H / cs), g = new Uint8Array(gw * gh); let on = 0;
    if (occ.length) {
      const raw = new Uint8Array(gw * gh); for (const b of occ) for (const [qx, qy] of b.pts) raw[((qy / cs) | 0) * gw + ((qx / cs) | 0)] = 1;
      const grow = Math.max(1, Math.round(cam.ballRad(P.L / 2, P.W / 2, R, R) * 1.3 / cs));
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { if (!raw[y * gw + x]) continue; for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= gw || yy >= gh) continue; g[yy * gw + xx] = 1; } }
      for (const b of occ) on += b.pts.length;
    }
    info.occ = occ.length ? { g, gw, gh, cs } : null; info.occFrac = tableN ? on / tableN : 0; info.occN = occ.length;

  }
  return out;
}

// Track the white cue ball near a guess (table inches). Returns {x,y,n} or null.
function findCue(img, cam, P, guess, searchIn) {
  const W = img.width, H = img.height, R = P.R;
  const g = cam.proj(guess.x, guess.y, R), rpx = cam.ballRad(guess.x, guess.y, R, R);
  const sr = Math.max(rpx * 2, cam.rad(guess.x, guess.y, R, searchIn));
  let cx = g[0], cy = g[1], n = 0;
  for (let it = 0; it < 4; it++) {
    let sx = 0, sy = 0; n = 0;
    const rr = it === 0 ? sr : rpx * 1.5;
    for (let y = Math.max(0, Math.floor(cy - rr)); y <= Math.min(H - 1, Math.ceil(cy + rr)); y++)
      for (let x = Math.max(0, Math.floor(cx - rr)); x <= Math.min(W - 1, Math.ceil(cx + rr)); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > rr * rr) continue;
        const o = (y * W + x) * 4, r = img.data[o], gg = img.data[o + 1], b = img.data[o + 2];
        const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
        if (mx > 150 && (mx - mn) < 0.3 * mx) { sx += x; sy += y; n++; }
      }
    if (!n) return null;
    cx = sx / n; cy = sy / n;
  }
  if (n < 0.2 * Math.PI * rpx * rpx) return null;
  const t = cam.unproj(cx, cy, R);
  return { x: t[0], y: t[1], n };
}


// Find white-ball-sized bright blobs near a point; return the one closest to `center` (table inches).
function findWhite(img, cam, P, center, radIn, minDistIn, exclude, skip) {
  const W = img.width, H = img.height, R = P.R;
  const c = cam.proj(center.x, center.y, R), rpx = cam.ballRad(center.x, center.y, R, R), sr = Math.max(rpx * 2, cam.rad(center.x, center.y, R, radIn));
  const x0 = Math.max(0, Math.floor(c[0] - sr)), x1 = Math.min(W - 1, Math.ceil(c[0] + sr)), y0 = Math.max(0, Math.floor(c[1] - sr)), y1 = Math.min(H - 1, Math.ceil(c[1] + sr));
  const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w < 3 || h < 3) return null;
  const m = new Uint8Array(w * h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if ((x - c[0]) ** 2 + (y - c[1]) ** 2 > sr * sr) continue;
    const o = (y * W + x) * 4, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx > 150 && (mx - mn) < 0.3 * mx) m[(y - y0) * w + (x - x0)] = 1;
  }
  const seen = new Uint8Array(w * h), st = [], aexp = Math.PI * rpx * rpx; let best = null, bd = 1e9;
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || seen[i]) continue;
    st.length = 0; st.push(i); seen[i] = 1; let n = 0, sx = 0, sy = 0;
    while (st.length) {
      const p = st.pop(), px = p % w, py = (p / w) | 0; n++; sx += px; sy += py;
      if (px > 0 && m[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; st.push(p - 1); }
      if (px < w - 1 && m[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; st.push(p + 1); }
      if (py > 0 && m[p - w] && !seen[p - w]) { seen[p - w] = 1; st.push(p - w); }
      if (py < h - 1 && m[p + w] && !seen[p + w]) { seen[p + w] = 1; st.push(p + w); }
    }
    if (n < 0.28 * aexp || n > 2.3 * aexp) continue;
    const t = cam.unproj(x0 + sx / n, y0 + sy / n, R), d = Math.hypot(t[0] - center.x, t[1] - center.y);
    if (d < (minDistIn || 0)) continue;
    if (exclude && exclude.some(e => Math.hypot(t[0] - e.x, t[1] - e.y) < 1.8)) continue;
    if (skip && skip({ x: t[0], y: t[1] })) continue; // not a ball on the cloth (a hand, a sleeve): look past it
    if (d < bd) { bd = d; best = { x: t[0], y: t[1], n }; }
  }
  return best;
}


// Dark pocket opening near (px,py): centroid of very dark pixels within rad.
function darkNear(img, px, py, rad, lim) {
  const W = img.width, H = img.height; lim = lim || 0.24; let n = 0, sx = 0, sy = 0, tot = 0;
  for (let y = Math.max(0, Math.floor(py - rad)); y <= Math.min(H - 1, Math.ceil(py + rad)); y++)
    for (let x = Math.max(0, Math.floor(px - rad)); x <= Math.min(W - 1, Math.ceil(px + rad)); x++) {
      if ((x - px) ** 2 + (y - py) ** 2 > rad * rad) continue; tot++;
      const o = (y * W + x) * 4, mx = Math.max(img.data[o], img.data[o + 1], img.data[o + 2]) / 255;
      if (mx < lim) { n++; sx += x; sy += y; }
    }
  return { n, frac: tot ? n / tot : 0, x: n ? sx / n : px, y: n ? sy / n : py };
}
const tableDims = ft => { const L = ft === 7 ? 78 : ft === 8 ? 88 : 100; return { L, Wd: L / 2 }; };
const tableCornersFor = (rot, L, Wd) => { const base = [[0, Wd], [L, Wd], [L, 0], [0, 0]]; return [0, 1, 2, 3].map(i => base[(i + rot) % 4]); };
// Which way is the table turned? The side pockets sit only on the two long rails, so look for them.
function pickRot(img, quad) {
  const Hu = homography([[0, 0], [1, 0], [1, 1], [0, 1]], quad), rd = Math.max(img.width, img.height) * 0.03;
  const dk = (u, v) => { const q = applyH(Hu, u, v); return darkNear(img, q[0], q[1], rd).frac; };
  const tb = dk(.5, -.03) + dk(.5, 1.03), lr = dk(-.02, .5) + dk(1.02, .5);
  if (Math.abs(tb - lr) > 0.1) return tb > lr ? 0 : 1;
  const top = Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]), left = Math.hypot(quad[3][0] - quad[0][0], quad[3][1] - quad[0][1]);
  return top >= left ? 0 : 1;
}
// Move the felt corners out to where the corner pockets really are (under an inch along the diagonal).
function growQuad(quad, rot, L, Wd, e) {
  const tc = tableCornersFor(rot, L, Wd), H = homography(tc, quad);
  return tc.map(([x, y]) => applyH(H, x + (x < L / 2 ? -e : e), y + (y < Wd / 2 ? -e : e)));
}
// Full automatic table lock: felt outline, four corner pockets, side pockets. Returns quad plus a confidence and tips.
function autoCalibrate(img, ft) {
  const { L, Wd } = tableDims(ft), mx = Math.max(img.width, img.height), tips = [];
  const t = detectTable(img);
  if (!t) return { quad: null, conf: 0, corners: 0, sides: 0, tips: ['The felt was not found. Make sure the whole table is in view, the lights are on, and nothing is draped over the cloth.'] };
  const cl = sampleCloth(img, t.quad);
  if (!cl) return { quad: t.quad, conf: 0.1, corners: 0, sides: 0, tips: ['The cloth color could not be read. Add light and avoid glare on the felt.'] };
  const fq = feltQuad(img, cl, t.quad), base = fq || t.quad;
  const rot = pickRot(img, base), quad = growQuad(base, rot, L, Wd, 0.7);
  let corners = 0;
  for (const p of quad) { const d = darkNear(img, p[0], p[1], mx * 0.04); if (d.n >= 12) corners++; }
  if (corners < 4) tips.push(corners + ' of 4 corner pockets were seen. Raise or move the phone so all four corner pockets are visible and not covered by hands or the cue.');
  const H = homography(tableCornersFor(rot, L, Wd), quad);
  let sides = 0;
  for (const [x, y] of [[L / 2, 0], [L / 2, Wd]]) { const q = applyH(H, x, y), rd = mx * 0.03, d = darkNear(img, q[0], q[1], rd); if (d.n >= 20) sides++; }
  if (sides < 2) tips.push(sides + ' of 2 side pockets were seen. That is fine, they are assumed at the middle of the long rails.');
  const xs = quad.map(p => p[0]), ys = quad.map(p => p[1]), extent = Math.max((Math.max(...xs) - Math.min(...xs)) / img.width, (Math.max(...ys) - Math.min(...ys)) / img.height);
  if (extent < 0.5) tips.push('The table looks small in the picture. Move the phone closer or zoom in so the table fills most of the width of the screen.');
  if (t.fill < 0.7) tips.push('The outline does not fit the cloth well. Something may be on the table, or the light is uneven.');
  const conf = 0.3 * (t.frac > 0.05 ? 1 : 0.4) * (t.fill > 0.7 ? 1 : 0.5) + 0.45 * (corners / 4) + 0.15 * (sides / 2) + 0.1 * (extent >= 0.5 ? 1 : 0);
  return { quad, rot, conf, corners, sides, tips, cloth: cl, extent, fill: t.fill, felt: !!fq };
}

// ---- rail diamonds ----
// The marks sit on the rail top, a few inches out from the cushion and a little above the felt. Exact numbers differ by table,
// so look at every small white mark first, then let the table model pick the offset that explains the most of them.
function diamondSpots(L, Wd, D) {
  const out = [];
  for (const i of [1, 2, 3, 5, 6, 7]) for (const y of [-D, Wd + D]) out.push([i * L / 8, y]);
  for (const j of [1, 2, 3]) for (const x of [-D, L + D]) out.push([x, j * Wd / 4]);
  return out;
}
function whiteMarks(img, quad) {
  const W = img.width, H = img.height, xs = quad.map(p => p[0]), ys = quad.map(p => p[1]);
  const mw = (Math.max(...xs) - Math.min(...xs)) * 0.12, mh = (Math.max(...ys) - Math.min(...ys)) * 0.5 + 0.05 * H;
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - mw)), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs) + mw)), y0 = Math.max(0, Math.floor(Math.min(...ys) - mh)), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys) + mh));
  const w = x1 - x0 + 1, h = y1 - y0 + 1, m = new Uint8Array(w * h), vmap = new Float32Array(w * h), smap = new Float32Array(w * h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const o = (y * W + x) * 4, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), i = (y - y0) * w + (x - x0);
    vmap[i] = mx / 255; smap[i] = mx ? (mx - mn) / mx : 0; if (mx > 170 && (mx - mn) < 0.3 * mx) m[i] = 1;
  }
  const seen = new Uint8Array(w * h), st = [], out = [], amax = Math.max(12, 0.5 * (0.012 * W) ** 2);
  for (let i = 0; i < w * h; i++) {
    if (!m[i] || seen[i]) continue; st.length = 0; st.push(i); seen[i] = 1; let n = 0, sx = 0, sy = 0;
    while (st.length) {
      const p = st.pop(), px = p % w, py = (p / w) | 0; n++; sx += px; sy += py;
      if (px > 0 && m[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; st.push(p - 1); }
      if (px < w - 1 && m[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; st.push(p + 1); }
      if (py > 0 && m[p - w] && !seen[p - w]) { seen[p - w] = 1; st.push(p - w); }
      if (py < h - 1 && m[p + w] && !seen[p + w]) { seen[p + w] = 1; st.push(p + w); }
    }
    if (n < 2 || n > amax) continue;
    const cx = sx / n, cy = sy / n, rr = Math.max(4, 2.6 * Math.sqrt(n)); let dark = 0, tot = 0;
    for (let k = 0; k < 10; k++) { const a = k * Math.PI / 5, qx = Math.round(cx + Math.cos(a) * rr), qy = Math.round(cy + Math.sin(a) * rr); if (qx < 0 || qy < 0 || qx >= w || qy >= h) continue; tot++; if (vmap[qy * w + qx] < 0.6 || smap[qy * w + qx] > 0.45) dark++; }
    if (tot >= 6 && dark / tot >= 0.7) out.push({ x: x0 + cx, y: y0 + cy, n });
  }
  return out;
}
function findDiamonds(img, quad, rot, ft, fRatio, pp) {
  const { L, Wd } = tableDims(ft), W = img.width, H = img.height, cam = makeCam(tableCornersFor(rot, L, Wd), quad, W, H, fRatio * Math.max(W, H), pp);
  const marks = whiteMarks(img, quad); let best = null;
  if (!cam.ok || marks.length < 4) return { found: [], expected: 18, n: 0, marks: marks.length };
  for (const D of [1.5, 2.5, 3.5, 4.5, 5.5, 6.5]) for (const z of [0, 0.8, 1.6]) {
    const spots = diamondSpots(L, Wd, D), used = new Set(), found = []; let cost = 0;
    spots.forEach(([sx, sy], si) => {
      const c = cam.proj(sx, sy, z), tol = Math.max(6, 2.4 * cam.rad(sx, sy, z, 1)); let bi = -1, bd = tol;
      marks.forEach((mk, k) => { if (used.has(k)) return; const d = Math.hypot(mk.x - c[0], mk.y - c[1]); if (d < bd) { bd = d; bi = k; } });
      if (bi >= 0) { used.add(bi); found.push({ px: marks[bi].x, py: marks[bi].y, ex: c[0], ey: c[1], si, d: bd }); cost += (1 - bd / tol) ** 2; }
    });
    const score = cost;
    if (!best || score > best.score) best = { score, found, D, z };
  }
  return { found: best.found, expected: 18, n: best.found.length, D: best.D, z: best.z, marks: marks.length };
}
// Nudge the four corners so the model's diamond positions land on the marks that were seen.
function refineWithDiamonds(img, quad, rot, ft, fRatio, dia, pp) {
  const { L, Wd } = tableDims(ft), W = img.width, H = img.height, spots = diamondSpots(L, Wd, dia.D), tc = tableCornersFor(rot, L, Wd), f = fRatio * Math.max(W, H), found = dia.found;
  const sides = new Set(found.map(d => spots[d.si][1] < 0 ? 'a' : spots[d.si][1] > Wd ? 'b' : spots[d.si][0] < 0 ? 'c' : 'd'));
  if (found.length < 8 || sides.size < 3) return null;
  const cap = 0.012 * Math.max(W, H), q0 = quad.map(p => p.slice());
  const cost = q => {
    const cam = makeCam(tc, q, W, H, f, pp); if (!cam.ok) return 1e18; let s = 0;
    for (const d of found) { const [sx, sy] = spots[d.si], p = cam.proj(sx, sy, dia.z), e = Math.min(Math.hypot(p[0] - d.px, p[1] - d.py), cap); s += e * e; }
    for (let i = 0; i < 4; i++) s += 0.05 * ((q[i][0] - q0[i][0]) ** 2 + (q[i][1] - q0[i][1]) ** 2);
    return s;
  };
  let q = q0.map(p => p.slice()), c = cost(q), step = 0.006 * Math.max(W, H);
  for (let it = 0; it < 60 && step > 0.25; it++) {
    let better = false;
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) for (const sg of [-1, 1]) {
      const t = q.map(p => p.slice()); t[i][k] += sg * step; const ct = cost(t); if (ct < c) { c = ct; q = t; better = true; }
    }
    if (!better) step /= 2;
  }
  const moved = Math.max(...q.map((p, i) => Math.hypot(p[0] - q0[i][0], p[1] - q0[i][1])));
  if (moved > 0.03 * Math.max(W, H)) return null;
  return q;
}

// Turn tracked samples [[t,x,y]] into {dir, v0, samples(t from impact)}
function analyzeTrack(init, track) {
  const mv = track.findIndex(s => Math.hypot(s[1] - init.x, s[2] - init.y) > 0.9);
  if (mv < 0 || track.length - mv < 3) return null;
  const a = track.slice(mv, mv + 4);
  const n = a.length; let st = 0, sx = 0, sy = 0, stt = 0, stx = 0, sty = 0;
  for (const [t, x, y] of a) { st += t; sx += x; sy += y; stt += t * t; stx += t * x; sty += t * y; }
  const den = n * stt - st * st;
  const vx = (n * stx - st * sx) / den, vy = (n * sty - st * sy) / den, v0 = Math.hypot(vx, vy);
  if (!isFinite(v0) || v0 < 5) return null;
  const tImp = a[0][0] - Math.hypot(a[0][1] - init.x, a[0][2] - init.y) / v0;
  const samples = track.slice(mv).map(([t, x, y]) => [Math.max(0.001, t - tImp), x, y]);
  return { dir: Math.atan2(vy, vx), v0: Math.min(v0 * 1.04, 450), samples };
}

// ---------- the trained recognizer (V2.3) ----------
// A small network trained on the hand-checked library (every saved session, home table and pool hall): a 24x24 picture
// of a spot plus five colour numbers -> cue ball, 1-9, or not a ball (hand, arm, cue, shirt, shadow). About 0.1 ms a spot.
const RECOG_W = /*RECOG_JSON*/null;
const RECOG = (() => {
  if (!RECOG_W) return null;
  const dec = s => { const b = atob(s), a = new Int8Array(b.length); for (let i = 0; i < b.length; i++) a[i] = b.charCodeAt(i) << 24 >> 24; return a; };
  return { S: RECOG_W.S, classes: RECOG_W.classes, nin: RECOG_W.nin, nh: RECOG_W.nh, W1: dec(RECOG_W.w1), s1: RECOG_W.s1, b1: RECOG_W.b1, W2: dec(RECOG_W.w2), s2: RECOG_W.s2, b2: RECOG_W.b2, x: new Float32Array(RECOG_W.nin), h: new Float32Array(RECOG_W.nh) };
})();
const RECOG_NB = 10; // index of "not a ball" in RECOG.classes
// d: RGBA pixels of the S x S picture of one spot (3.2 ball radii across, ball in the middle). Returns 11 probabilities.
function recogRun(d) {
  const M = RECOG; if (!M) return null; const S = M.S, x = M.x, h = M.h, nin = M.nin, nh = M.nh, nc = M.classes.length;
  let k = 0; for (let i = 0; i < S * S; i++) { x[k++] = d[i * 4] / 255; x[k++] = d[i * 4 + 1] / 255; x[k++] = d[i * 4 + 2] / 255; }
  let n = 0, wh = 0, dk = 0, mr = 0, mg = 0, mb = 0, nc2 = 0;
  for (let yy = S / 4; yy < 3 * S / 4; yy++) for (let xx = S / 4; xx < 3 * S / 4; xx++) {
    const o = (yy * S + xx) * 4, r = d[o] / 255, g = d[o + 1] / 255, b = d[o + 2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / (mx + 1e-3);
    n++; if (sat < 0.25 && mx > 0.6) wh++; if (mx < 0.3) dk++; if (sat >= 0.25 && mx >= 0.3) { mr += r; mg += g; mb += b; nc2++; }
  }
  x[k++] = wh / n * 3; x[k++] = dk / n * 3; x[k++] = nc2 ? mr / nc2 * 3 : 0; x[k++] = nc2 ? mg / nc2 * 3 : 0; x[k++] = nc2 ? mb / nc2 * 3 : 0;
  for (let j = 0; j < nh; j++) { let a = 0; for (let i = 0; i < nin; i++) a += x[i] * M.W1[i * nh + j]; a = a * M.s1[j] + M.b1[j]; h[j] = a > 0 ? a : 0; }
  const z = new Float32Array(nc); let mxz = -1e9;
  for (let c = 0; c < nc; c++) { let a = 0; for (let j = 0; j < nh; j++) a += h[j] * M.W2[j * nc + c]; z[c] = a * M.s2[c] + M.b2[c]; if (z[c] > mxz) mxz = z[c]; }
  let sum = 0; for (let c = 0; c < nc; c++) { z[c] = Math.exp(z[c] - mxz); sum += z[c]; } for (let c = 0; c < nc; c++) z[c] /= sum;
  return z;
}
// the recognizer's top number for a spot (0-9), ignoring "not a ball"
function recogTop(p) { if (!p) return null; let bi = 0; for (let c = 1; c < 10; c++) if (p[c] > p[bi]) bi = c; return bi; }
if (typeof module !== 'undefined') module.exports = { recogRun, recogTop, hungarian, tableDims, tableCornersFor, autoCalibrate, pickRot, growQuad, findDiamonds, refineWithDiamonds, darkNear, findWhite, rgb2hsv, detectTable, sampleCloth, detectBalls, ballFeat, assignIds, priorSamples, findCue, analyzeTrack, isCloth };
