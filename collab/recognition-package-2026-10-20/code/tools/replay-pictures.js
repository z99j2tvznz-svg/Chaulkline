// Replay the current ball finder and recognizer over every saved picture of the real sessions, and score it against the
// hand-checked labels (library/manifest.csv) where they exist.
//
//   CHALKLINE_DATA=/path/to/sessions node tools/replay-pictures.js [--out report.json] [folder ...]
//
// Each session folder is one "Save debug" zip unpacked (log.txt, labels.json, shotNNN-before/after.jpg, lookNNN.jpg).
// data/sessions.csv maps folder names to the session names used in the notes and the manifest (real1 ...).
//
// What it measures, per session (failure types kept apart, no single accuracy number):
//   outline check  - how far the app's own saved ball spots land from where the table outline in the log puts them.
//                    Large = the outline changed during the session, and the scores for that session are not reliable.
//   found / missed - labelled balls the finder found again / did not find (within 0.6 ball radius).
//   not-a-ball     - spots found on something labelled "not a ball" (hand, cue, shadow) = false detections.
//   unlabelled     - spots found where the labels have nothing; either a false detection or a ball the old finder missed.
//   named right    - recognizer's top number = label, for found balls. The shipped recognizer was trained on real1-real6,
//                    so on those sessions this is an in-sample number and flatters it.
// Limits: the labels only contain balls some earlier finder saw (plus a few added by eye), so a ball that no finder ever
// saw is not counted as missed. Pictures are stills: shots, tracking and identity switches are not covered here.
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright');
const { serve } = require('../tests/lib/serve.js');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.CHALKLINE_DATA;
if (!DATA) { console.error('Set CHALKLINE_DATA to the folder holding the session folders.'); process.exit(2); }
const argv = process.argv.slice(2), outIx = argv.indexOf('--out'), OUT = outIx >= 0 ? argv.splice(outIx, 2)[1] : null;

function csv(file) {
  const [head, ...rows] = fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).map(l => l.split(','));
  return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}
const SESS = csv(path.join(ROOT, 'data/sessions.csv'));
const MAN = csv(path.join(ROOT, 'library/manifest.csv'));
const truthFor = (name, shot, pic) => MAN.filter(r => r.session === name && +r.shot === shot && r.pic === pic);

async function main() {
  const folders = argv.length ? argv : SESS.map(s => s.folder).filter(f => fs.existsSync(path.join(DATA, f)));
  const srv = await serve(ROOT, DATA);
  const browser = await chromium.launch();
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(srv.url + '/index.html');
  await page.waitForFunction(() => window.__chalk && window.__chalk.S);
  const report = [];
  for (const folder of folders) {
    const meta = SESS.find(s => s.folder === folder) || { name: folder };
    const log = JSON.parse(fs.readFileSync(path.join(DATA, folder, 'log.txt'), 'utf8')).header;
    const labels = JSON.parse(fs.readFileSync(path.join(DATA, folder, 'labels.json'), 'utf8'));
    const pics = [];
    for (const s of labels.shots) for (const tag of ['before', 'after', 'pic']) {
      const f = s[tag]; if (!f || !f.file) continue;
      pics.push({ shot: s.shot || s.look, pic: tag === 'pic' ? 'look' : tag, f });
    }
    const out = await page.evaluate(async ({ folder, QN, FT, pics }) => {
      const C = __chalk, S = C.S, res = [];
      const full = document.createElement('canvas'); full.width = 1280; full.height = 720;
      const g = full.getContext('2d', { willReadFrequently: true });
      const work = document.createElement('canvas'); work.width = 800; work.height = 450;
      for (const p of pics) {
        const img = new Image(); img.src = '/data/' + folder + '/' + p.f.file;
        try { await img.decode(); } catch (e) { res.push({ ...p, f: undefined, file: p.f.file, err: 'no picture' }); continue; }
        // put the saved table crop back where it was in the 1280x720 camera frame
        g.fillStyle = '#2a2420'; g.fillRect(0, 0, 1280, 720); g.drawImage(img, p.f.crop[0], p.f.crop[1], p.f.crop[2], p.f.crop[3]);
        work.getContext('2d', { willReadFrequently: true }).drawImage(full, 0, 0, 800, 450);
        S.live = false; S.src = work; S.W = 800; S.H = 450; S.vr = { x: 0, y: 0, w: 1280, h: 720, vw: 1280, vh: 720, z: 1 };
        S.ft = FT; S.P = C.mkP(); S.lens = 0.86; S.camZoom = 1; S.recSrc = { c: full, k: 1280 / 800 };
        setQuad(QN.map(q => C.srcFromVn(q, S.vr)));
        const im = imgData(); S.cloth = sampleCloth(im, S.quad) || S.cloth;
        const k = 1280 / 800, sc = p.f.scale || 1, X = v => (v * k - p.f.crop[0]) * sc, Y = v => (v * k - p.f.crop[1]) * sc;
        // outline check: where this outline puts the app's own saved spots (table inches -> picture pixels)
        const reproj = (p.f.balls || []).map(b => { const q = S.cam.proj(b.x, b.y, S.P.R); return Math.hypot(X(q[0]) - b.px, Y(q[1]) - b.py); });
        const found = detectBalls(im, S.cam, S.P, S.cloth, {});
        C.recogFound(found);
        res.push({ shot: p.shot, pic: p.pic, file: p.f.file, reproj,
          found: found.map(b => ({ px: X(b.px), py: Y(b.py), pr: b.rpx * k * sc, x: b.x, y: b.y, rec: b.rec ? recogTop(b.rec) : null, nb: b.rec ? b.rec[RECOG_NB] : null })) });
      }
      return res;
    }, { folder, QN: log.quadN, FT: log.ft, pics });
    report.push({ folder, name: meta.name, pictures: score(meta.name, out) });
  }
  await browser.close(); srv.close();
  if (errors.length) console.error('page errors:', errors.slice(0, 5));
  summarise(report);
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
}

function score(name, pics) {
  return pics.map(p => {
    if (p.err) return p;
    const truth = truthFor(name, p.shot, p.pic), used = new Set(), s = { found: 0, missed: 0, notBall: 0, unlabelled: 0, named: 0, namedRight: 0 };
    for (const f of p.found) {
      let best = -1, bd = Infinity;
      truth.forEach((t, i) => { const d = Math.hypot(+t.px - f.px, +t.py - f.py); if (!used.has(i) && d < Math.max(5, 0.6 * +t.pr) && d < bd) { bd = d; best = i; } });
      if (best < 0) { s.unlabelled++; continue; }
      used.add(best); const lab = truth[best].label;
      if (lab === 'nb') s.notBall++;
      else if (lab !== '?') { s.found++; if (f.rec != null) { s.named++; if (String(f.rec) === lab) s.namedRight++; } }
    }
    truth.forEach((t, i) => { if (!used.has(i) && t.label !== 'nb' && t.label !== '?') s.missed++; });
    const r = p.reproj.slice().sort((a, b) => a - b);
    return { shot: p.shot, pic: p.pic, file: p.file, labelled: truth.length > 0, spots: p.found.length, reprojMedian: r.length ? r[r.length >> 1] : null, ...s };
  });
}

function summarise(report) {
  const rows = [['session', 'folder', 'pictures', 'outline err px', 'spots', 'labelled pics', 'found', 'missed', 'not-a-ball', 'unlabelled', 'named right']];
  for (const r of report) {
    const P = r.pictures.filter(p => !p.err), L = P.filter(p => p.labelled), sum = k => L.reduce((a, p) => a + p[k], 0);
    const re = P.map(p => p.reprojMedian).filter(v => v != null).sort((a, b) => a - b);
    const pct = (a, b) => b ? `${a}/${b} (${Math.round(100 * a / b)}%)` : '-';
    rows.push([r.name, r.folder, P.length, re.length ? re[re.length >> 1].toFixed(1) : '-', P.reduce((a, p) => a + p.spots, 0), L.length,
      L.length ? pct(sum('found'), sum('found') + sum('missed')) : '-', L.length ? sum('missed') : '-', L.length ? sum('notBall') : '-',
      L.length ? sum('unlabelled') : '-', L.length ? pct(sum('namedRight'), sum('named')) : '-']);
  }
  const w = rows[0].map((_, i) => Math.max(...rows.map(r => String(r[i]).length)));
  for (const r of rows) console.log(r.map((v, i) => String(v).padEnd(w[i])).join('  '));
}

main().catch(e => { console.error(e); process.exit(1); });
