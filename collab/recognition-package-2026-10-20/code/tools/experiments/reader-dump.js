// Experiment tool (read only, Oct 20, 2026): run the number reader again on every spot of a frozen detections folder
// and keep what it computed inside, so a per-table calibration can be tried without detecting again.
// For each clip: the same frames (ffmpeg, same fps and scale as tools/clip-detect.js), the clip's saved outline, and
// each saved spot's frame position. The reader sees the same crop as in clip-detect (radius from the camera model at the
// spot's table position). Output per clip: <out>/<clip>.bin = Float32 rows of [frame, spot, 11 probabilities, 64 hidden
// units], and <out>/<clip>.check.json = how well the re-run matches the frozen numbers (top number, p, nb).
//   node tools/experiments/reader-dump.js <frozen detections folder> <clips folder (shotNNN.mp4 / clipNNN.mp4)> <out folder> [clip ...]
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve } = require('../../tests/lib/serve.js');
const ROOT = path.join(__dirname, '..', '..');
const [DET, CLIPS, OUT, ...only] = process.argv.slice(2);
const ROW = 2 + 11 + 64;
// SRC60=<offset>: the detections are one of the alternate 30 fps picks of a 60 fps run (frame i = 60 fps frame 2i + offset)
const SRC60 = process.env.SRC60 != null ? +process.env.SRC60 : null;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const clips = fs.readdirSync(DET).filter(f => /^(shot|clip)\d+\.json$/.test(f)).map(f => f.slice(0, -5)).filter(c => !only.length || only.includes(c)).sort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rdump-')), srv = await serve(ROOT, tmp);
  const browser = await chromium.launch(), page = await browser.newPage();
  await page.goto(srv.url + '/index.html?norecog=0');
  await page.waitForFunction(() => window.__chalk && window.__chalk.S);
  for (const clip of clips) {
    if (fs.existsSync(path.join(OUT, clip + '.bin'))) continue;
    const d = JSON.parse(fs.readFileSync(path.join(DET, clip + '.json'), 'utf8')), vid = path.join(CLIPS, clip + '.mp4');
    if (!fs.existsSync(vid)) { console.log(clip + ': no video'); continue; }
    const dir = path.join(tmp, clip); fs.mkdirSync(dir);
    execFileSync('ffmpeg', ['-v', 'error', '-i', vid, '-vf', `fps=${SRC60 != null ? 60 : d.fps || 30},scale=1280:720`, '-q:v', '3', path.join(dir, '%05d.jpg')]);
    const nf = fs.readdirSync(dir).length, n = Math.min(SRC60 != null ? Math.floor((nf - SRC60 + 1) / 2) : nf, d.frames.length);
    const spots = d.frames.slice(0, n).map(fr => fr.balls.map(b => [b.x, b.y, b.px, b.py]));
    const r = await page.evaluate(async ({ clip, n, QN, spots, SRC60 }) => {
      const C = __chalk, S = C.S;
      const full = document.createElement('canvas'); full.width = 1280; full.height = 720;
      const g = full.getContext('2d', { willReadFrequently: true });
      const work = document.createElement('canvas'); work.width = 800; work.height = 450;
      const wg = work.getContext('2d', { willReadFrequently: true });
      S.live = false; S.src = work; S.W = 800; S.H = 450; S.vr = { x: 0, y: 0, w: 1280, h: 720, vw: 1280, vh: 720, z: 1 };
      S.ft = 7; S.P = C.mkP(); S.lens = 0.86; S.camZoom = 1; S.recSrc = { c: full, k: 1280 / 800 };
      const draw = async i => { const img = new Image(); img.src = `/data/${clip}/${String(i).padStart(5, '0')}.jpg`; await img.decode(); g.drawImage(img, 0, 0); wg.drawImage(full, 0, 0, 800, 450); };
      await draw(1); setQuad(QN.map(q => C.srcFromVn(q, S.vr)));
      const rows = [], k = 1280 / 800, R = S.P.R; let projErr = 0, nProj = 0;
      for (let i = 1; i <= n; i++) {
        await draw(SRC60 != null ? 2 * (i - 1) + SRC60 + 1 : i);
        const list = spots[i - 1].map(([x, y, px, py]) => ({ x, y, px: px / k, py: py / k, rpx: S.cam.ballRad(x, y, R, R) }));
        for (const b of list) { const q = S.cam.proj(b.x, b.y, R); projErr += Math.hypot(q[0] - b.px, q[1] - b.py); nProj++; }
        C.recogFound(list);
        list.forEach((b, j) => { if (!b.rec) return; recogRun; rows.push([i - 1, j, ...b.rec]); });
        // hidden units: run once more per spot to read them (recogFound keeps only the probabilities)
        for (let j = 0; j < list.length; j++) {
          const b = list[j]; if (!b.rec) continue;
          const r = Math.max(3, b.rpx || 6) * k, s = 3.2 * r, x = b.px * k - s / 2, y = b.py * k - s / 2;
          RC.cx.fillStyle = '#000'; RC.cx.fillRect(0, 0, RECOG.S, RECOG.S); RC.cx.drawImage(full, x, y, s, s, 0, 0, RECOG.S, RECOG.S);
          recogRun(RC.cx.getImageData(0, 0, RECOG.S, RECOG.S).data);
          const row = rows.find(rw => rw[0] === i - 1 && rw[1] === j); row.push(...Array.from(RECOG.h));
        }
      }
      return { rows, projErr: projErr / Math.max(1, nProj) };
    }, { clip, n, QN: d.quadN, spots, SRC60 });
    const buf = new Float32Array(r.rows.length * ROW); r.rows.forEach((rw, i) => buf.set(rw, i * ROW));
    fs.writeFileSync(path.join(OUT, clip + '.bin'), Buffer.from(buf.buffer));
    // match against the frozen numbers
    let same = 0, all = 0, dp = 0, dnb = 0;
    for (const rw of r.rows) {
      const b = d.frames[rw[0]].balls[rw[1]], pr = rw.slice(2, 13); let top = 0; for (let c = 1; c < 10; c++) if (pr[c] > pr[top]) top = c;
      all++; if (top === b.rec) same++; dp = Math.max(dp, Math.abs(pr[top] - b.p)); dnb = Math.max(dnb, Math.abs(pr[10] - b.nb));
    }
    const chk = { clip, frames: n, spots: all, sameTop: same, maxDiffP: +dp.toFixed(3), maxDiffNb: +dnb.toFixed(3), meanProjErrPx: +r.projErr.toFixed(2) };
    fs.writeFileSync(path.join(OUT, clip + '.check.json'), JSON.stringify(chk));
    console.log(JSON.stringify(chk));
    fs.rmSync(dir, { recursive: true });
  }
  await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true });
})();
