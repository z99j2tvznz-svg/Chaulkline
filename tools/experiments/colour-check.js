// Experiment tool (offline, Oct 20, 2026): the 8-vs-2 and 7-vs-4 "make unsure" check on a frozen detections folder.
// For every spot the reader called the 2, 8, 4 or 7 with p >= 0.6, the same 24 x 24 reader picture is cut again
// (same frames, outline and crop as tools/experiments/reader-dump.js) and the blueness measurement of
// tools/experiments/colour-stripe.py is taken. If that measurement, with cut-offs learned on other sessions only, is
// sure of the other ball of the pair, the spot's p is lowered to 0.5 (below every vote threshold). The read number stays;
// nothing is renamed. Every other field and spot is copied unchanged.
//   node tools/experiments/colour-check.js <frozen dets> <clips folder> <out dets> <cutoffs.json> [clip ...]
// cutoffs.json: { "8 vs 2": [lo, hi], "7 vs 4": [lo, hi] }  (above hi: the bluer ball, the 2 or the 4; below lo: the 8 or the 7)
// SRC60=<offset> as in reader-dump.js for the alternate 30 fps picks of a 60 fps run.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve } = require('../../tests/lib/serve.js');
const ROOT = path.join(__dirname, '..', '..');
const [DET, CLIPS, OUT, CUTS, ...only] = process.argv.slice(2);
const SRC60 = process.env.SRC60 != null ? +process.env.SRC60 : null;
const cuts = JSON.parse(fs.readFileSync(CUTS, 'utf8'));
// number read -> [pair, the bluer ball of the pair, the other]
const PAIR = { 2: ['8 vs 2', 2, 8], 8: ['8 vs 2', 2, 8], 4: ['7 vs 4', 4, 7], 7: ['7 vs 4', 4, 7] };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const clips = fs.readdirSync(DET).filter(f => /^(shot|clip)\d+\.json$/.test(f)).map(f => f.slice(0, -5)).filter(c => !only.length || only.includes(c)).sort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ccheck-')), srv = await serve(ROOT, tmp);
  const browser = await chromium.launch(), page = await browser.newPage();
  await page.goto(srv.url + '/index.html?norecog=0');
  await page.waitForFunction(() => window.__chalk && window.__chalk.S);
  const total = { checked: 0, lowered: 0, byPair: {} };
  for (const clip of clips) {
    const d = JSON.parse(fs.readFileSync(path.join(DET, clip + '.json'), 'utf8')), vid = path.join(CLIPS, clip + '.mp4');
    const sel = d.frames.map(fr => fr.balls.map((b, j) => [b, j]).filter(([b]) => PAIR[b.rec] && b.p >= 0.6 && b.nb < 0.5).map(([b, j]) => [j, b.x, b.y, b.px, b.py]));
    if (!sel.some(s => s.length) || !fs.existsSync(vid)) { fs.writeFileSync(path.join(OUT, clip + '.json'), JSON.stringify(d)); continue; }
    const dir = path.join(tmp, clip); fs.mkdirSync(dir);
    execFileSync('ffmpeg', ['-v', 'error', '-i', vid, '-vf', `fps=${SRC60 != null ? 60 : d.fps || 30},scale=1280:720`, '-q:v', '3', path.join(dir, '%05d.jpg')]);
    const nf = fs.readdirSync(dir).length, n = Math.min(SRC60 != null ? Math.floor((nf - SRC60 + 1) / 2) : nf, d.frames.length);
    const blue = await page.evaluate(async ({ clip, n, QN, sel, SRC60 }) => {
      const C = __chalk, S = C.S;
      const full = document.createElement('canvas'); full.width = 1280; full.height = 720;
      const g = full.getContext('2d', { willReadFrequently: true });
      const work = document.createElement('canvas'); work.width = 800; work.height = 450;
      const wg = work.getContext('2d', { willReadFrequently: true });
      S.live = false; S.src = work; S.W = 800; S.H = 450; S.vr = { x: 0, y: 0, w: 1280, h: 720, vw: 1280, vh: 720, z: 1 };
      S.ft = 7; S.P = C.mkP(); S.lens = 0.86; S.camZoom = 1;
      const draw = async i => { const img = new Image(); img.src = `/data/${clip}/${String(i).padStart(5, '0')}.jpg`; await img.decode(); g.drawImage(img, 0, 0); wg.drawImage(full, 0, 0, 800, 450); };
      await draw(1); setQuad(QN.map(q => C.srcFromVn(q, S.vr)));
      const N = RECOG.S, c0 = N / 2 - 0.5, cv = document.createElement('canvas'); cv.width = cv.height = N; const cx = cv.getContext('2d', { willReadFrequently: true });
      const k = 1280 / 800, R = S.P.R, out = [];
      const med = a => { a.sort((x, y) => x - y); const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
      for (let i = 1; i <= n; i++) {
        if (!sel[i - 1].length) { out.push([]); continue; }
        await draw(SRC60 != null ? 2 * (i - 1) + SRC60 + 1 : i);
        const fr = [];
        for (const [j, x0, y0, px, py] of sel[i - 1]) {
          const r = Math.max(3, S.cam.ballRad(x0, y0, R, R)) * k, s = 3.2 * r;
          cx.fillStyle = '#000'; cx.fillRect(0, 0, N, N); cx.drawImage(full, px - s / 2, py - s / 2, s, s, 0, 0, N, N);
          const D = cx.getImageData(0, 0, N, N).data, ring = [[], [], []], disk = [];
          for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
            const rad = Math.hypot(yy - c0, xx - c0), o = (yy * N + xx) * 4, p = [D[o] / 255, D[o + 1] / 255, D[o + 2] / 255];
            if (rad >= 10) for (let c = 0; c < 3; c++) ring[c].push(p[c]);
            if (rad <= 6) disk.push(p);
          }
          const cl = ring.map(med); let sum = 0, cnt = 0;
          for (const [r_, g_, b_] of disk) {
            const mx = Math.max(r_, g_, b_), mn = Math.min(r_, g_, b_), sat = (mx - mn) / (mx + 1e-3);
            const off = Math.hypot(r_ - cl[0], g_ - cl[1], b_ - cl[2]) > 0.18, white = sat < 0.3 && mx > 0.6;
            if (off && !white) { sum += (b_ - r_) / (mx + 0.05); cnt++; }
          }
          fr.push([j, cnt >= 3 ? sum / cnt : null]);
        }
        out.push(fr);
      }
      return out;
    }, { clip, n, QN: d.quadN, sel, SRC60 });
    blue.forEach((fr, i) => fr.forEach(([j, v]) => {
      const b = d.frames[i].balls[j], [pair, hiBall, loBall] = PAIR[b.rec], [lo, hi] = cuts[pair];
      total.checked++;
      const call = v == null || (v >= lo && v <= hi) ? null : v > hi ? hiBall : loBall;
      if (call != null && call !== b.rec) {
        b.p = Math.min(b.p, 0.5); b.colourCheck = { pair, blue: +v.toFixed(3), says: call };
        total.lowered++; total.byPair[pair] = (total.byPair[pair] || 0) + 1;
      }
    }));
    d.colourCheck = { cuts };
    fs.writeFileSync(path.join(OUT, clip + '.json'), JSON.stringify(d));
    fs.rmSync(dir, { recursive: true });
  }
  // detections folders hold more than clips (the session file and so on): copy anything not written
  for (const f of fs.readdirSync(DET)) if (!fs.existsSync(path.join(OUT, f)) && fs.statSync(path.join(DET, f)).isFile()) fs.copyFileSync(path.join(DET, f), path.join(OUT, f));
  console.log(JSON.stringify(total));
  await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true });
})();
