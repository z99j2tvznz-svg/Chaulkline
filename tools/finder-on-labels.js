// Run the app's own ball finder and number reader on the 185 reviewed pictures (data/labels/label-set-v1.json), for the
// first detector experiment (docs/detector-v1.md). Two jobs per picture:
//   finder - detectBalls on the picture, as the baseline ran it (the table outline from the session log; a table crop is
//            put back where it was in the 1280x720 camera frame, a full video frame is used as it is)
//   reader - the number reader (recogFound) on every verified ball spot, at the verified centre and size
// Writes { pictures: [{ id, found: [{ px, py, pr, rec, nb }], read: [{ i, top, p, nb }] }] } in picture pixels.
//
//   node tools/finder-on-labels.js <sessions folder> <label-set-v1 folder> <out.json>
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { serve } = require('../tests/lib/serve.js');

const ROOT = path.join(__dirname, '..');
const [SESS, SET, OUT] = process.argv.slice(2);
if (!OUT) { console.error('usage: node tools/finder-on-labels.js <sessions folder> <label-set-v1 folder> <out.json>'); process.exit(2); }
// The Oct 16 log's saved outline is in the other orientation from the video frames (262 px off the app's own saved
// spots); this is the outline the baseline used for those clips, used here for all Oct 16 pictures (fitted by tools/clip-detect.js from the app's saved spots, median 4.9 px; tracker/PROGRESS.md)
const FRAME_QUAD = { '2026-10-16_evening_V2.3.3': [[0.1975, 0.2788], [0.7625, 0.2612], [0.845, 0.5112], [0.1162, 0.5388]] };
const LAB = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/labels/label-set-v1.json'), 'utf8'));

async function main() {
  const srv = await serve(ROOT, SET);
  const browser = await chromium.launch();
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.text().startsWith('fitted')) console.log(m.text()); });
  await page.goto(srv.url + '/index.html');
  await page.waitForFunction(() => window.__chalk && window.__chalk.S);
  const out = [];
  const bySession = {};
  for (const p of LAB.pictures) (bySession[p.session] = bySession[p.session] || []).push(p);
  for (const [session, pics] of Object.entries(bySession)) {
    const log = JSON.parse(fs.readFileSync(path.join(SESS, session, 'log.txt'), 'utf8')).header;
    const labels = JSON.parse(fs.readFileSync(path.join(SESS, session, 'labels.json'), 'utf8'));
    // where each app picture sat in the camera frame, and the app's own saved spots (for fitting the outline to full frames)
    const where = {}, PTS = [];
    for (const s of labels.shots) for (const tag of ['before', 'after']) {
      const f = s[tag]; if (!f || !f.file) continue; where[f.file] = { crop: f.crop, scale: f.scale || 1 };
      for (const b of f.balls || []) PTS.push({ x: b.x, y: b.y, fx: b.px / (f.scale || 1) + f.crop[0], fy: b.py / (f.scale || 1) + f.crop[1] });
    }
    const jobs = pics.map(p => ({ id: p.id, image: p.image, kind: p.kind, place: p.kind === 'crop' ? where[p.file] : { crop: [0, 0, 1280, 720], scale: 1 },
      balls: p.balls.map(b => ({ x: b.x, y: b.y, r: b.r })) }));
    const res = await page.evaluate(async ({ QN, FT, jobs, PTS, FQ }) => {
      const C = __chalk, S = C.S, res = [];
      const full = document.createElement('canvas'); full.width = 1280; full.height = 720;
      const g = full.getContext('2d', { willReadFrequently: true });
      const work = document.createElement('canvas'); work.width = 800; work.height = 450;
      const k = 1280 / 800;
      let fitted = null;
      const setup = () => { S.live = false; S.src = work; S.W = 800; S.H = 450; S.vr = { x: 0, y: 0, w: 1280, h: 720, vw: 1280, vh: 720, z: 1 };
        S.ft = FT; S.P = C.mkP(); S.lens = 0.86; S.camZoom = 1; S.recSrc = { c: full, k }; };
      // the saved outline can be in another orientation than the video frames: move its corners until the camera model
      // puts the app's own saved spots back where they were seen (as tools/clip-detect.js does)
      function fitQuad(q0) {
        const rot = S.rot;
        const cost = q => { setQuad(q.map(p => C.srcFromVn(p, S.vr)), rot);
          const d = PTS.map(p => { const r = S.cam.proj(p.x, p.y, S.P.R); return Math.hypot(r[0] * k - p.fx, r[1] * k - p.fy); }).sort((a, b) => a - b); return d[d.length >> 1]; };
        let q = q0.map(p => p.slice()), best = cost(q);
        for (let step = 0.02; step > 0.0005; step /= 2) for (let it = 0, moved = true; moved && it < 60; it++) { moved = false;
          for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (const s of [step, -step]) { q[i][j] += s; const c = cost(q); if (c < best) { best = c; moved = true; } else q[i][j] -= s; } }
        console.log('fitted outline median error px', best.toFixed(1)); return q;
      }
      // how well the outline puts the app's own saved spots back where they were seen
      setup(); setQuad(QN.map(p => C.srcFromVn(p, S.vr)));
      const errOf = q => { setQuad(q.map(p => C.srcFromVn(p, S.vr)));
        const d = PTS.map(p => { const r = S.cam.proj(p.x, p.y, S.P.R); return Math.hypot(r[0] * k - p.fx, r[1] * k - p.fy); }).sort((a, b) => a - b); return d[d.length >> 1]; };
      const qerr = PTS.length ? +errOf(FQ || QN).toFixed(1) : null;
      for (const jb of jobs) {
        const img = new Image(); img.src = '/data/' + jb.image; await img.decode();
        const [cx, cy, cw, ch] = jb.place.crop, sc = jb.place.scale;
        g.fillStyle = '#2a2420'; g.fillRect(0, 0, 1280, 720); g.drawImage(img, cx, cy, cw, ch);
        work.getContext('2d', { willReadFrequently: true }).drawImage(full, 0, 0, 800, 450);
        setup();
        let q = FQ || QN;
        if (jb.kind === 'frame' && !FQ) { if (!fitted) { setQuad(QN.map(p => C.srcFromVn(p, S.vr))); fitted = fitQuad(QN); } q = fitted; }
        setQuad(q.map(p => C.srcFromVn(p, S.vr)));
        const im = imgData(); S.cloth = sampleCloth(im, S.quad) || S.cloth;
        const X = v => (v * k - cx) * sc, Y = v => (v * k - cy) * sc;
        const found = detectBalls(im, S.cam, S.P, S.cloth, {});
        C.recogFound(found);
        // the number reader on each verified spot, at its verified centre and size
        const spots = jb.balls.map(b => ({ px: (b.x / sc + cx) / k, py: (b.y / sc + cy) / k, rpx: b.r / sc / k }));
        C.recogFound(spots);
        res.push({ id: jb.id,
          found: found.map(b => ({ px: +X(b.px).toFixed(1), py: +Y(b.py).toFixed(1), pr: +(b.rpx * k * sc).toFixed(1), rec: b.rec ? recogTop(b.rec) : null, nb: b.rec ? +b.rec[RECOG_NB].toFixed(3) : null })),
          read: spots.map((s, i) => ({ i, top: s.rec ? recogTop(s.rec) : null, p: s.rec ? +s.rec[recogTop(s.rec)].toFixed(3) : null, nb: s.rec ? +s.rec[RECOG_NB].toFixed(3) : null })) });
      }
      return { res, qerr, ferr: fitted && PTS.length ? +errOf(fitted).toFixed(1) : null };
    }, { QN: log.quadN, FT: log.ft, jobs, PTS, FQ: FRAME_QUAD[session] || null });
    out.push(...res.res);
    console.log(session + ': ' + res.res.length + ' pictures, saved outline error ' + res.qerr + ' px' + (res.ferr != null ? ', full-frame outline error ' + res.ferr + ' px' : ''));
  }
  await browser.close(); srv.close();
  if (errors.length) console.error('page errors:', errors.slice(0, 5));
  fs.writeFileSync(OUT, JSON.stringify({ labels: 'label-set-v1', pictures: out }, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });
