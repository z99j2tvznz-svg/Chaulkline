// The player's pose (V3.8.11, owner Nov 8: a shot is the player down on it, the tip at the cue ball with a bridge hand out,
// from any side; standing up with a hand at a ball is not one). The pose comes from YOLO11n-pose (Ultralytics, 17 body
// points, models/pose/yolo11n-pose.onnx, 640 x 384). From the biggest person seen, a body-shape vector (the points
// round the person's box, mirrored so the hand further out is on the right, plus torso lean, arm reach and how far the
// head is above the lower hand) goes through a logistic model learned on the owner's sessions (Nov 8 13:04, 13:09, 13:13:
// the three looks before each move, 144 frames down on the shot and 24 upright; and earlier upright setup moves). Left
// out a session at a time: every move down on the shot of the three sessions called so, every upright one caught.
// Pure functions; the app feeds the model's output. Tested in tests/pose.test.js.
const POSE = (() => {
  const M = { mu: [0.01691, -0.18735, 0.84211, 0.00343, -0.16908, 0.70526, 0.02852, -0.1458, 0.6, -0.02718, -0.17675, 0.61579, 0.00807, -0.13445, 0.44737, -0.09018, -0.19986, 0.97895, -0.12372, -0.26918, 0.96316, 0.04304, -0.00032, 0.98421, 0.00723, -0.12636, 0.76842, 0.19124, 0.08877, 0.97895, 0.10977, -0.01622, 0.85263, -0.23517, 0.07753, 0.95263, -0.15633, 0.01133, 0.83684, -0.09556, 0.22672, 0.76842, -0.05005, 0.18734, 0.71053, -0.08527, 0.24618, 0.54737, -0.03111, 0.21258, 0.47368, 1.09164, 0.38418, 0.77574, 0.43225],
    sd: [0.13403, 0.1562, 0.36464, 0.12215, 0.15803, 0.45593, 0.11162, 0.16657, 0.4899, 0.12577, 0.16081, 0.48641, 0.10951, 0.17121, 0.49722, 0.16464, 0.12997, 0.14356, 0.27859, 0.13395, 0.18838, 0.22302, 0.15676, 0.12466, 0.34858, 0.16747, 0.42184, 0.3709, 0.23946, 0.14356, 0.33618, 0.19229, 0.35447, 0.31087, 0.18679, 0.21243, 0.37026, 0.14666, 0.36951, 0.22535, 0.21426, 0.42184, 0.29819, 0.21043, 0.45352, 0.28504, 0.25819, 0.49775, 0.30885, 0.24983, 0.49931, 0.49648, 0.27804, 0.26599, 0.238],
    w: [-0.11006, 0.44636, 0.69269, -0.02655, 0.56159, 0.34655, 0.17489, 0.32317, 0.44393, -0.06654, 0.26454, 0.30182, -0.03838, 0.16637, 0.27842, 0.11715, 0.80199, -0.08928, -0.14441, 0.425, 0.44376, 0.30843, -0.04816, 0.41632, 0.04837, 0.08064, -0.13762, 0.10329, -0.28746, 0.09974, 0.02817, -0.11991, 0.06843, -0.16631, -0.24999, 0.18078, -0.14787, -0.23725, -0.16485, -0.10242, -0.13774, -0.09893, 0.01417, -0.09051, -0.11798, -0.0556, 0.17289, 0.06985, -0.04386, 0.23389, 0.01153, 0.71056, 0.56605, 0.33935, -0.96284], b: 2.65375 };
  // persons from the model's output (1 x 56 x N: box cx cy w h, score, 17 x (x, y, score)), in the model's input pixels
  function decode(data, N, thr) {
    const out = [];
    for (let i = 0; i < N; i++) {
      const s = data[4 * N + i]; if (s < (thr || 0.4)) continue;
      const cx = data[i], cy = data[N + i], w = data[2 * N + i], h = data[3 * N + i], kp = [];
      for (let k = 0; k < 17; k++) kp.push([data[(5 + 3 * k) * N + i], data[(6 + 3 * k) * N + i], data[(7 + 3 * k) * N + i]]);
      out.push({ box: [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2], conf: s, kp });
    }
    out.sort((a, b) => b.conf - a.conf); const keep = [];
    const iou = (a, b) => { const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); if (w <= 0 || h <= 0) return 0; const i = w * h; return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i); };
    for (const p of out) if (!keep.some(k => iou(k.box, p.box) > 0.6)) keep.push(p);
    return keep;
  }
  function vec(kp, b) {
    const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, h = Math.max(1, b[3] - b[1]), w = Math.max(1, b[2] - b[0]);
    const pts = kp.map(p => [(p[0] - cx) / h, (p[1] - cy) / h, p[2]]);
    const wr = [pts[9], pts[10]], far = Math.abs(wr[0][0]) * wr[0][2] >= Math.abs(wr[1][0]) * wr[1][2] ? wr[0] : wr[1], sgn = far[0] >= 0 ? 1 : -1;
    const v = []; for (const [x, y, c] of pts) { const on = c > 0.3 ? 1 : 0; v.push(sgn * x * on, y * on, on); }
    v.push(w / h);
    const g = i => pts[i][2] > 0.3 ? pts[i] : null, sh = [g(5), g(6)].filter(Boolean), hp = [g(11), g(12)].filter(Boolean), wrs = [g(9), g(10)].filter(Boolean), hd = [g(0), g(1), g(2), g(3), g(4)].filter(Boolean);
    const avg = (a, k) => a.reduce((s, q) => s + q[k], 0) / a.length;
    const ta = sh.length && hp.length ? Math.atan2(Math.abs(avg(sh, 0) - avg(hp, 0)), Math.abs(avg(sh, 1) - avg(hp, 1)) + 1e-6) * 180 / Math.PI : 45;
    let ext = 0; for (const a of wrs) for (const s of sh) ext = Math.max(ext, Math.hypot(a[0] - s[0], a[1] - s[1]));
    const hdrop = wrs.length && hd.length ? Math.max(...wrs.map(q => q[1])) - Math.min(...hd.map(q => q[1])) : 0.5;
    v.push(ta / 90, ext, hdrop);
    return v;
  }
  // how likely the biggest person is down on a shot (null: nobody seen)
  function down(persons) {
    const ps = persons.filter(p => p.conf >= 0.4); if (!ps.length) return null;
    const p = ps.reduce((a, q) => (q.box[2] - q.box[0]) * (q.box[3] - q.box[1]) > (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]) ? q : a);
    const v = vec(p.kp, p.box); let z = M.b; for (let i = 0; i < v.length; i++) z += M.w[i] * (v[i] - M.mu[i]) / M.sd[i];
    return 1 / (1 + Math.exp(-z));
  }
  return { decode, vec, down, M };
})();
if (typeof module !== 'undefined') module.exports = POSE;
