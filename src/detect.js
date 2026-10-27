// ---------- V3 ball finder and number reader (ONNX Runtime Web) ----------
// Ball finder: detector-v1, a one-class YOLO11n trained Oct 18 on the owner's labelled pictures (99% of balls found,
// far ones too, 1 false ball in 24 pictures against 10 for the old finder). Number reader: reader v2 (Oct 20 benchmark
// "Challenger B"), a small network on a 40 x 40 crop of 3.2 ball radii: right 97% of the time when sure, and the 9 is no
// longer read as the cue ball on the test pictures (0 of 210, the old reader 120). Both need window.ort (vendor/ort).
const DET = (() => {
  const VERSION = 'det 5'; // pages check this, so a copy of this file Safari kept from before cannot be mixed with a newer page
  const CLASSES = ['cue', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'not a ball'];
  const NB = 10, READ_T = 0.6674199270850172, NB_T = 0.5, P_T = 0.6; // reader temperature and decision rule (benchmark config)
  const FIND_T = 0.35, NMS_IOU = 0.7, SIDE = 40, CROP = 3.2; // finder threshold of the v0.4 baseline (results barely change 0.25-0.7)
  const st = { find: null, read: null, ep: null, w: 0, h: 0, fixed: false, inCv: null, cropCv: null };
  // V3 finder shapes (models/v3, one shared weights file): about 550 thousand input pixels each, from a thin strip to 16:9.
  // The app crops the picture to the table and uses the shape closest to the crop's aspect (pickShape).
  const SHAPES = [[1568, 352], [1408, 384], [1280, 416], [1184, 448], [1088, 480], [1024, 544], [960, 544]];
  const shapeFile = ([w, h]) => ({ file: 'models/v3/finder-' + w + 'x' + h + '.onnx', weights: 'models/v3/finder-v1.weights', w, h, fixed: true });
  function pickShape(bw, bh) { const a = Math.max(bw, bh) / Math.min(bw, bh); let best = SHAPES[0], bd = 1e9; for (const sh of SHAPES) { const d = Math.abs(Math.log(sh[0] / sh[1] / a)); if (d < bd) { bd = d; best = sh; } } return shapeFile(best); }

  const bytes = new Map(); // url -> download (a promise), so a file is fetched once even when asked for twice at the same time
  function fetchBytes(url, onProgress) {
    if (!bytes.has(url)) bytes.set(url, fetchNew(url, onProgress).catch(e => { bytes.delete(url); throw e; }));
    return bytes.get(url);
  }
  async function fetchNew(url, onProgress) {
    const res = await fetch(url); if (!res.ok) throw new Error(url + ': ' + res.status);
    const total = +res.headers.get('content-length') || 0; if (!res.body || !onProgress) return new Uint8Array(await res.arrayBuffer());
    const rd = res.body.getReader(), parts = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; onProgress(got, total); }
    const out = new Uint8Array(got); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
  }
  // opts: base (site root, ends in /), ep ('webgpu' | 'wasm' | 'auto'), finder {file, w, h, fixed, weights?}, onProgress(text)
  async function load(opts) {
    // several cores only on a cross-origin isolated page (sw.js makes the V3 page one); set before the first session
    const ort = window.ort; ort.env.wasm.wasmPaths = opts.base + 'vendor/ort/';
    if (!st.read) ort.env.wasm.numThreads = window.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1)) : 1;
    const wantGpu = opts.ep !== 'wasm' && !!navigator.gpu, eps = wantGpu ? ['webgpu', 'wasm'] : ['wasm'];
    const say = opts.onProgress || (() => { }), mb = n => (n / 1048576).toFixed(1);
    const prog = (g, t) => say('Downloading the ball finder ' + mb(g) + (t ? ' of ' + mb(t) : '') + ' MB');
    const fb = await fetchBytes(opts.base + opts.finder.file, opts.finder.weights ? null : prog);
    const wb = opts.finder.weights ? await fetchBytes(opts.base + opts.finder.weights, prog) : null;
    const so = e => Object.assign({ executionProviders: [e], graphOptimizationLevel: 'all' }, wb ? { externalData: [{ path: opts.finder.weights.split('/').pop(), data: wb }] } : {});
    const rb = await fetchBytes(opts.base + 'models/reader-v2.onnx');
    say('Starting the ball finder…');
    if (st.find && st.find.release) { try { await st.find.release(); } catch (e) { } }
    let find = null, ep = null;
    for (const e of eps) { try { find = await ort.InferenceSession.create(fb, so(e)); ep = e; break; } catch (err) { if (e === eps[eps.length - 1]) throw err; } }
    st.find = find; st.ep = ep; st.w = opts.finder.w; st.h = opts.finder.h; st.fixed = !!opts.finder.fixed;
    if (!st.read) st.read = await ort.InferenceSession.create(rb, { executionProviders: ['wasm'] }); // tiny: the CPU is fast enough and avoids a GPU round trip
    return { ep, w: st.w, h: st.h };
  }
  function setSize(w, h) { if (st.fixed) return false; st.w = w; st.h = h; return true; }

  // Letterbox like Ultralytics: keep the aspect, centre, pad grey 114. src: a canvas or video with its pixel size; box
  // [x, y, w, h]: the part of it to look at (the table), default all of it. kmax caps the enlargement: the finder learned
  // balls of about 10-23 px radius, and on the verified frames it began to miss near balls blown up past that.
  // The finder input is landscape; an upright box is turned a quarter turn first, so it fills the input instead of
  // shrinking to a third of it. Balls are round, so the finder does not mind the turn. back(u, v) maps a point of the
  // input to the source picture.
  function letterbox(src, W, H, box, kmax) {
    const [bx, by, bw, bh] = box || [0, 0, W, H], iw = st.w, ih = st.h, rot = bh > bw && iw > ih, sw = rot ? bh : bw, sh = rot ? bw : bh;
    const k = Math.min(iw / sw, ih / sh, kmax || 1e9), nw = Math.round(sw * k), nh = Math.round(sh * k);
    const left = Math.round((iw - nw) / 2 - 0.1), top = Math.round((ih - nh) / 2 - 0.1);
    const cv = st.inCv || (st.inCv = document.createElement('canvas')); if (cv.width !== iw || cv.height !== ih) { cv.width = iw; cv.height = ih; }
    const c = cv.getContext('2d', { willReadFrequently: true }); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = 'rgb(114,114,114)'; c.fillRect(0, 0, iw, ih);
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'medium';
    if (rot) { c.setTransform(0, -k, k, 0, left - k * by, top + k * (bw + bx)); c.drawImage(src, bx, by, bw, bh, bx, by, bw, bh); c.setTransform(1, 0, 0, 1, 0, 0); } // (x, y) -> (y - by, bw - (x - bx))
    else c.drawImage(src, bx, by, bw, bh, left, top, nw, nh);
    const px = c.getImageData(0, 0, iw, ih).data, n = iw * ih, x = st.buf && st.buf.length === 3 * n ? st.buf : (st.buf = new Float32Array(3 * n)); // one input buffer, reused: the phone is short of memory
    for (let i = 0, j = 0; i < n; i++, j += 4) { x[i] = px[j] / 255; x[n + i] = px[j + 1] / 255; x[2 * n + i] = px[j + 2] / 255; }
    const back = rot ? (u, v) => [bx + bw - (v - top) / k, by + (u - left) / k] : (u, v) => [bx + (u - left) / k, by + (v - top) / k];
    return { x, k, back, rot };
  }
  function iou(a, b) {
    const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0); if (w <= 0 || h <= 0) return 0;
    const i = w * h; return i / ((a.x1 - a.x0) * (a.y1 - a.y0) + (b.x1 - b.x0) * (b.y1 - b.y0) - i);
  }
  // Every ball in the picture (or in opts.box): {px, py, r, score} in source pixels (r = half the box side).
  async function find(src, W, H, opts) {
    const ort = window.ort, lb = letterbox(src, W, H, opts && opts.box, opts && opts.kmax);
    const out = await st.find.run({ images: new ort.Tensor('float32', lb.x, [1, 3, st.h, st.w]) }), o = out.output0, d = o.data, N = o.dims[2];
    const boxes = [];
    for (let i = 0; i < N; i++) {
      const s = d[4 * N + i]; if (s < FIND_T) continue;
      const [cx, cy] = lb.back(d[i], d[N + i]), bw = d[2 * N + i] / lb.k, bh = d[3 * N + i] / lb.k, w = lb.rot ? bh : bw, h = lb.rot ? bw : bh;
      boxes.push({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2, score: s });
    }
    if (o.dispose) o.dispose();
    boxes.sort((a, b) => b.score - a.score); const keep = [];
    for (const b of boxes) if (!keep.some(k => iou(k, b) > NMS_IOU)) keep.push(b);
    return keep.map(b => ({ px: (b.x0 + b.x1) / 2, py: (b.y0 + b.y1) / 2, r: (b.x1 - b.x0 + b.y1 - b.y0) / 4, score: b.score }));
  }

  // Pillow's BILINEAR resize (a triangle filter that widens when shrinking, rounded to bytes after each pass), so the reader
  // sees what it was trained on. a: n x n x 3 bytes, returns m x m x 3 bytes.
  function coeffs(inN, outN) {
    const sc = inN / outN, fs = Math.max(sc, 1), sup = fs, out = [];
    for (let o = 0; o < outN; o++) {
      const c = (o + 0.5) * sc, lo = Math.max(Math.trunc(c - sup + 0.5), 0), hi = Math.min(Math.trunc(c + sup + 0.5), inN), w = [];
      let t = 0; for (let x = lo; x < hi; x++) { const v = Math.max(0, 1 - Math.abs((x - c + 0.5) / fs)); w.push(v); t += v; }
      out.push({ lo, w: w.map(v => t ? v / t : 0) });
    }
    return out;
  }
  function resize(a, n, m) {
    const cf = coeffs(n, m), mid = new Uint8ClampedArray(n * m * 3), out = new Uint8ClampedArray(m * m * 3);
    for (let y = 0; y < n; y++) for (let ox = 0; ox < m; ox++) { const { lo, w } = cf[ox]; for (let ch = 0; ch < 3; ch++) { let s = 0; for (let k = 0; k < w.length; k++) s += a[(y * n + lo + k) * 3 + ch] * w[k]; mid[(y * m + ox) * 3 + ch] = Math.round(s); } }
    for (let oy = 0; oy < m; oy++) { const { lo, w } = cf[oy]; for (let x = 0; x < m; x++) for (let ch = 0; ch < 3; ch++) { let s = 0; for (let k = 0; k < w.length; k++) s += mid[((lo + k) * m + x) * 3 + ch] * w[k]; out[(oy * m + x) * 3 + ch] = Math.round(s); } }
    return out;
  }
  // The reader's crop: a square 3.2 radii wide on the spot, cut at whole pixels; outside the picture is black.
  // src: ImageData of the whole picture, or the 2D context of a canvas holding it (then only the crop is read out, which
  // keeps memory low on the phone; outside the canvas reads as transparent black, the same as black here).
  function crop(src, px, py, r) {
    const s = CROP * r, x0 = Math.floor(px - s / 2), y0 = Math.floor(py - s / 2), n = Math.max(1, Math.ceil(s)), a = new Uint8Array(n * n * 3);
    if (src.getImageData) { const d = src.getImageData(x0, y0, n, n).data; for (let i = 0, j = 0; i < n * n; i++, j += 3) { a[j] = d[i * 4]; a[j + 1] = d[i * 4 + 1]; a[j + 2] = d[i * 4 + 2]; } return { a, n }; }
    const W = src.width, H = src.height, d = src.data;
    for (let y = 0; y < n; y++) { const sy = y0 + y; if (sy < 0 || sy >= H) continue; for (let x = 0; x < n; x++) { const sx = x0 + x; if (sx < 0 || sx >= W) continue; const i = (sy * W + sx) * 4, j = (y * n + x) * 3; a[j] = d[i]; a[j + 1] = d[i + 1]; a[j + 2] = d[i + 2]; } }
    return { a, n };
  }
  // Share of the ball's middle that is yellow, red and white (in the original crop pixels): the owner's cue ball is white
  // with red dots, the 9 white with a yellow stripe, and the reader mixed them up most often.
  function colours(c) {
    const n = c.n, a = c.a, R = n / CROP * 0.8, m = n / 2; let ye = 0, re = 0, wh = 0, t = 0;
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if ((x + 0.5 - m) ** 2 + (y + 0.5 - m) ** 2 > R * R) continue; const j = (y * n + x) * 3, r = a[j], g = a[j + 1], b = a[j + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0; t++;
      if (sat < 0.25 && mx > 150) { wh++; continue; } if (sat < 0.4 || mx < 90) continue;
      let h = mx === r ? ((g - b) / (mx - mn)) * 60 : mx === g ? (2 + (b - r) / (mx - mn)) * 60 : (4 + (r - g) / (mx - mn)) * 60; if (h < 0) h += 360;
      if (h >= 38 && h <= 68) ye++; else if (h <= 14 || h >= 340) re++;
    }
    return t ? { y: ye / t, r: re / t, w: wh / t } : { y: 0, r: 0, w: 0 };
  }
  function softmax(z, T) { const v = Array.from(z, x => x / T), mx = Math.max(...v), e = v.map(x => Math.exp(x - mx)), t = e.reduce((s, x) => s + x, 0); return e.map(x => x / t); }
  // Number for each spot: adds p (11 probabilities), num (0 = cue, 1-9), pTop, nb (not-a-ball) and kind
  // ('sure' | 'unsure' | 'not_a_ball'). img: ImageData or 2D context of the same picture the spots came from.
  async function read(img, spots) {
    if (!spots.length) return spots;
    const ort = window.ort, x = new Float32Array(spots.length * 3 * SIDE * SIDE), P = SIDE * SIDE;
    spots.forEach((b, i) => {
      const c = crop(img, b.px, b.py, Math.max(3, b.r)), q = resize(c.a, c.n, SIDE), o = i * 3 * P; b.col = colours(c);
      for (let k = 0; k < P; k++) { x[o + k] = q[k * 3] / 255; x[o + P + k] = q[k * 3 + 1] / 255; x[o + 2 * P + k] = q[k * 3 + 2] / 255; }
    });
    const out = await st.read.run({ x: new ort.Tensor('float32', x, [spots.length, 3, SIDE, SIDE]) }), z = out.logits.data;
    spots.forEach((b, i) => {
      const p = softmax(z.subarray(i * 11, i * 11 + 11), READ_T); let k = 0; for (let j = 1; j < NB; j++) if (p[j] > p[k]) k = j;
      b.p = p; b.num = k; b.pTop = p[k]; b.nb = p[NB]; b.kind = p[NB] >= NB_T ? 'not_a_ball' : p[k] >= P_T ? 'sure' : 'unsure';
    });
    return spots;
  }
  const prefetch = (base, path, onProgress) => fetchBytes(base + path, onProgress); // start a download early (cached for load)
  const threads = () => (window.ort && ort.env.wasm.numThreads) || 1;
  return { VERSION, threads, prefetch, load, setSize, find, read, letterbox, crop, resize, colours, pickShape, SHAPES, CLASSES, get ep() { return st.ep; }, get size() { return [st.w, st.h]; }, get fixed() { return st.fixed; } };
})();
if (typeof window !== 'undefined') window.DET = DET;
if (typeof module !== 'undefined') module.exports = { DET };
