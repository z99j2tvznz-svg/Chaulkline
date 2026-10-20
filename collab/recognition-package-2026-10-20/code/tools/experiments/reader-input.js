// Diagnostic (read only, Oct 20, 2026): the exact picture the number reader gets for chosen spots, next to the frame it
// came from. Same frames, outline, crop and resize as tools/experiments/reader-dump.js / clip-detect.js.
//   node tools/experiments/reader-input.js <list.json> <out.json>
// list: [{ id, dets (folder), video, clip, frame, spot }]. Output per id: the frame crop it was cut from (3.2 ball
// radii square, as RGB at frame resolution), the 24 x 24 reader input (RGB), the reader's 11 probabilities and the
// five colour numbers it adds (white share, dark share, mean colour of the coloured pixels).
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve } = require('../../tests/lib/serve.js');
const ROOT = path.join(__dirname, '..', '..');
const [LIST, OUT] = process.argv.slice(2);

(async () => {
  const list = JSON.parse(fs.readFileSync(LIST, 'utf8')), out = {};
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rin-')), srv = await serve(ROOT, tmp);
  const browser = await chromium.launch(), page = await browser.newPage();
  await page.goto(srv.url + '/index.html?norecog=0');
  await page.waitForFunction(() => window.__chalk && window.__chalk.S);
  for (const e of list) {
    const d = JSON.parse(fs.readFileSync(path.join(e.dets, e.clip + '.json'), 'utf8')), sp = d.frames[e.frame].balls[e.spot];
    // the same 30 fps frame as the detections: frame k is the (k+1)-th picture of the same extraction as clip-detect
    const all = path.join(tmp, 'all-' + e.clip + '-' + path.basename(path.dirname(e.video)));
    if (!fs.existsSync(all)) { fs.mkdirSync(all); execFileSync('ffmpeg', ['-v', 'error', '-i', e.video, '-vf', `fps=${d.fps || 30},scale=1280:720`, '-q:v', '3', path.join(all, '%05d.jpg')]); }
    const dir = path.join(tmp, e.id); fs.mkdirSync(dir); fs.copyFileSync(path.join(all, String(e.frame + 1).padStart(5, '0') + '.jpg'), path.join(dir, '00001.jpg'));
    out[e.id] = await page.evaluate(async ({ id, QN, sp }) => {
      const C = __chalk, S = C.S;
      const full = document.createElement('canvas'); full.width = 1280; full.height = 720;
      const g = full.getContext('2d', { willReadFrequently: true });
      const work = document.createElement('canvas'); work.width = 800; work.height = 450;
      const wg = work.getContext('2d', { willReadFrequently: true });
      S.live = false; S.src = work; S.W = 800; S.H = 450; S.vr = { x: 0, y: 0, w: 1280, h: 720, vw: 1280, vh: 720, z: 1 };
      S.ft = 7; S.P = C.mkP(); S.lens = 0.86; S.camZoom = 1; S.recSrc = { c: full, k: 1280 / 800 };
      const img = new Image(); img.src = `/data/${id}/00001.jpg`; await img.decode(); g.drawImage(img, 0, 0); wg.drawImage(full, 0, 0, 800, 450);
      setQuad(QN.map(q => C.srcFromVn(q, S.vr)));
      const k = 1280 / 800, R = S.P.R, rpx = S.cam.ballRad(sp.x, sp.y, R, R);
      const r = Math.max(3, rpx) * k, s = 3.2 * r, x = sp.px - s / 2, y = sp.py - s / 2;
      if (!RC.cv) { RC.cv = document.createElement('canvas'); RC.cv.width = RC.cv.height = RECOG.S; RC.cx = RC.cv.getContext('2d', { willReadFrequently: true }); }
      RC.cx.fillStyle = '#000'; RC.cx.fillRect(0, 0, RECOG.S, RECOG.S); RC.cx.drawImage(full, x, y, s, s, 0, 0, RECOG.S, RECOG.S);
      const inp = RC.cx.getImageData(0, 0, RECOG.S, RECOG.S).data, probs = Array.from(recogRun(inp));
      const xs = Math.max(0, Math.floor(x)), ys = Math.max(0, Math.floor(y)), ws = Math.min(1280 - xs, Math.ceil(s)), hs = Math.min(720 - ys, Math.ceil(s));
      const src = g.getImageData(xs, ys, ws, hs).data;
      const rgb = a => { const o = []; for (let i = 0; i < a.length; i += 4) o.push(a[i], a[i + 1], a[i + 2]); return o; };
      return { probs, ballRadiusPx: +r.toFixed(1), crop: { w: ws, h: hs, rgb: rgb(src) }, input: { w: RECOG.S, h: RECOG.S, rgb: rgb(inp) }, stored: { rec: sp.rec, p: sp.p, nb: sp.nb } };
    }, { id: e.id, QN: d.quadN, sp });
    fs.rmSync(dir, { recursive: true });
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true });
})();
