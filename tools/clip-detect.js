// Run the app's own ball finder and recognizer on every frame of a session's shot clips, and save what it found per
// frame. This is the input for the offline tracker (tools/tracker.js), so the tracker can be tried on real footage
// without a phone.
//
//   node tools/clip-detect.js <session folder> <out folder> [--fps 30] [shotNNN ...]
//
// The session folder is one "Save debug" export unpacked (log.txt with the table outline, shotNNN.mp4 clips).
// Output: <out folder>/shotNNN.json = { fps, frames: [{ t, balls: [{ x, y, rec, p, nb }] }] }, x/y in table inches,
// rec = recognizer's top number (0 = cue ball), p = its score, nb = "not a ball" score. Needs ffmpeg.
//
// Recorder sessions (a folder with the test recorder's meta.json and clipNNN.mp4 files, unzipped): the recorder keeps
// no table outline, so the outline comes from --quad '<4 corners, 0..1 of the frame>' if given, otherwise the app's
// own automatic table finder on each clip's first frame (falling back to the last good outline when it is unsure).
// --sections rest,hands,shots picks which recorder sections to run. Redone clips are skipped.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const { serve } = require('../tests/lib/serve.js');

const ROOT = path.join(__dirname, '..');
const argv = process.argv.slice(2), fpsIx = argv.indexOf('--fps'), FPS = fpsIx >= 0 ? +argv.splice(fpsIx, 2)[1] : 30;
const qIx = argv.indexOf('--quad'), START_QUAD = qIx >= 0 ? argv.splice(qIx, 2)[1] : null;
const sIx = argv.indexOf('--sections'), SECTIONS = sIx >= 0 ? argv.splice(sIx, 2)[1].split(',') : null;
const [SESSION, OUT, ...only] = argv;
if (!SESSION || !OUT) { console.error('usage: node tools/clip-detect.js <session folder> <out folder> [--fps 30] [shotNNN ...]'); process.exit(2); }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const REC = fs.existsSync(path.join(SESSION, 'meta.json'));
  let log, clips, PTS = [];
  if (REC) {
    // test recorder session: no app log, no saved ball spots
    const meta = JSON.parse(fs.readFileSync(path.join(SESSION, 'meta.json'), 'utf8'));
    log = { ft: parseInt(meta.setup.table, 10) || 7, quadN: null };
    clips = meta.clips.filter(c => (!SECTIONS || SECTIONS.includes(c.sec)) && !(c.answers && c.answers.redo) && fs.existsSync(path.join(SESSION, c.name + '.mp4')))
      .map(c => c.name).filter(c => !only.length || only.includes(c)).sort();
  } else {
    log = JSON.parse(fs.readFileSync(path.join(SESSION, 'log.txt'), 'utf8')).header;
    clips = fs.readdirSync(SESSION).filter(f => /^shot\d+\.mp4$/.test(f)).map(f => f.slice(0, -4))
      .filter(c => !only.length || only.includes(c)).sort();
    // the app's saved ball spots (table inches + where they were seen in the 1280x720 frame), for checking the outline
    const labels = JSON.parse(fs.readFileSync(path.join(SESSION, 'labels.json'), 'utf8'));
    for (const s of labels.shots) for (const tag of ['before', 'after']) {
      const f = s[tag]; if (!f || !f.balls) continue; const sc = f.scale || 1;
      for (const b of f.balls) PTS.push({ x: b.x, y: b.y, fx: b.px / sc + f.crop[0], fy: b.py / sc + f.crop[1] });
    }
  }
  let QN = START_QUAD ? JSON.parse(START_QUAD) : log.quadN, QN_FIT = null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clipframes-'));
  const srv = await serve(ROOT, tmp);
  const browser = await chromium.launch();
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.text().startsWith('fitted')) console.log(m.text()); });
  await page.goto(srv.url + '/index.html?norecog=0');
  await page.waitForFunction(() => window.__chalk && window.__chalk.S);
  for (const clip of clips) {
    const dir = path.join(tmp, clip); fs.mkdirSync(dir);
    execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(SESSION, clip + '.mp4'), '-vf', `fps=${FPS},scale=1280:720`, '-q:v', '3', path.join(dir, '%05d.jpg')]);
    const n = fs.readdirSync(dir).length, t0 = Date.now();
    const frames = await page.evaluate(async ({ clip, n, FPS, QN, FT, PTS, AUTO }) => {
      const C = __chalk, S = C.S, res = [];
      const full = document.createElement('canvas'); full.width = 1280; full.height = 720;
      const g = full.getContext('2d', { willReadFrequently: true });
      const work = document.createElement('canvas'); work.width = 800; work.height = 450;
      const wg = work.getContext('2d', { willReadFrequently: true });
      S.live = false; S.src = work; S.W = 800; S.H = 450; S.vr = { x: 0, y: 0, w: 1280, h: 720, vw: 1280, vh: 720, z: 1 };
      S.ft = FT; S.P = C.mkP(); S.lens = 0.86; S.camZoom = 1; S.recSrc = { c: full, k: 1280 / 800 };
      let cloth = null;
      // The saved outline can be in another orientation than the clips (the phone was turned when the log was
      // written). The app's own saved ball spots know where the table is, so move the outline corners until the
      // camera model puts those spots back where they were seen.
      function fitQuad(q0) {
        const k = 1280 / 800, rot = S.rot;
        const cost = q => {
          setQuad(q.map(p => C.srcFromVn(p, S.vr)), rot);
          const d = PTS.map(p => { const r = S.cam.proj(p.x, p.y, S.P.R); return Math.hypot(r[0] * k - p.fx, r[1] * k - p.fy); }).sort((a, b) => a - b);
          return d[d.length >> 1];
        };
        let q = q0.map(p => p.slice()), best = cost(q);
        for (let step = 0.02; step > 0.0005; step /= 2) {
          for (let it = 0, moved = true; moved && it < 60; it++) {
            moved = false;
            for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) for (const s of [step, -step]) {
              q[i][j] += s; const c = cost(q);
              if (c < best) { best = c; moved = true; } else q[i][j] -= s;
            }
          }
        }
        setQuad(q.map(p => C.srcFromVn(p, S.vr)), rot);
        console.log('fitted outline', JSON.stringify(q.map(p => p.map(v => +v.toFixed(4)))), 'median error px', best.toFixed(1));
        window.__fit = { q, err: best };
      }
      for (let i = 1; i <= n; i++) {
        const img = new Image(); img.src = `/data/${clip}/${String(i).padStart(5, '0')}.jpg`;
        await img.decode();
        g.drawImage(img, 0, 0); wg.drawImage(full, 0, 0, 800, 450);
        if (!cloth) {
          if (AUTO) {
            // recorder clip: the app's own automatic table finder on the first frame; keep the last good outline when unsure
            const a = autoCalibrate(imgData(), FT);
            window.__auto = { conf: a.conf, corners: a.corners, tips: a.tips };
            if (a.quad && a.conf >= 0.6) { setQuad(a.quad, a.rot); window.__auto.q = S.quad.map(C.vnFromSrc); }
            else if (QN) setQuad(QN.map(q => C.srcFromVn(q, S.vr)));
            else throw new Error('table not found on the first frame of ' + clip + ' (conf ' + a.conf.toFixed(2) + ')');
          } else {
            setQuad(QN.map(q => C.srcFromVn(q, S.vr)));
            if (PTS.length) fitQuad(QN);
          }
          cloth = sampleCloth(imgData(), S.quad) || S.cloth; S.cloth = cloth;
        }
        const found = detectBalls(imgData(), S.cam, S.P, cloth, {});
        C.recogFound(found);
        res.push({ t: +((i - 1) / FPS).toFixed(3), balls: found.map(b => {
          const top = b.rec ? recogTop(b.rec) : null;
          return { x: +b.x.toFixed(2), y: +b.y.toFixed(2), rec: top, p: top != null ? +b.rec[top].toFixed(2) : null, nb: b.rec ? +b.rec[RECOG_NB].toFixed(2) : null };
        }) });
      }
      return res;
    }, { clip, n, FPS, QN, FT: log.ft, PTS, AUTO: REC && !START_QUAD });
    if (REC && !START_QUAD) {
      const a = await page.evaluate(() => window.__auto);
      if (a.q) QN = a.q;
      console.log(`${clip}: table finder conf ${a.conf.toFixed(2)}, ${a.corners} of 4 corner pockets${a.q ? '' : ', kept the previous outline'}`);
    }
    if (!QN_FIT) { QN_FIT = await page.evaluate(() => window.__fit && window.__fit.q); if (QN_FIT) { QN = QN_FIT; PTS = []; console.log('outline', JSON.stringify(QN), 'error px', (await page.evaluate(() => window.__fit.err)).toFixed(1)); } }
    fs.writeFileSync(path.join(OUT, clip + '.json'), JSON.stringify({ fps: FPS, table: [78, 39], quadN: QN, frames }));
    fs.rmSync(dir, { recursive: true });
    console.log(`${clip}: ${n} frames, ${((Date.now() - t0) / n).toFixed(0)} ms/frame`);
  }
  await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true });
  if (errors.length) console.error('page errors:', errors.slice(0, 5));
}

main().catch(e => { console.error(e); process.exit(1); });
