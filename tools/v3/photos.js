// The bare-cloth check of V3.0.4 tried on a session's own shot pictures (a debug session folder: log.json plus
// shotNNN-before/after.jpg). A replay has no camera frames, so each look uses the latest shot picture taken by then (the
// "after" one is taken as the shot ends, which is when a ghost is decided). Needs Python with Pillow to decode the JPEGs.
// usage: node tools/v3/photos.js <session folder> <fixture.json> [--detail] [--write]
//   prints the score with the check on the pictures; --write stores the per-picture cloth maps in the fixture
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { makeCam, makeP } = require(path.join(__dirname, '../../src/core.js'));
const { tableDims, tableCornersFor, sampleCloth } = require(path.join(__dirname, '../../src/vision.js')), { bareCloth } = require(path.join(__dirname, '../../src/v3/cloth.js'));
const LENS = 0.86; // as in src/v3/app.js
global.D2R = global.D2R || Math.PI / 180; // vision.js uses core.js's global in the page
function loadPhotos(dir) {
  const out = path.join(dir, '.rgba'); fs.mkdirSync(out, { recursive: true });
  execFileSync('python3', ['-I', '-c', `
import sys,os
from PIL import Image
d,o=sys.argv[1],sys.argv[2]
for f in sorted(os.listdir(d)):
  if f.endswith('.jpg'):
    t=os.path.join(o,f[:-4]+'.rgba')
    if not os.path.exists(t):
      im=Image.open(os.path.join(d,f)).convert('RGBA'); open(t,'wb').write(im.size[0].to_bytes(2,'little')+im.size[1].to_bytes(2,'little')+im.tobytes())
`, dir, out]);
  const ph = {};
  for (const f of fs.readdirSync(out)) { const b = fs.readFileSync(path.join(out, f)); ph[f.replace('.rgba', '')] = { width: b.readUInt16LE(0), height: b.readUInt16LE(2), data: b.subarray(4) }; }
  return ph;
}
function emptyFromPhotos(dir, d) {
  const ph = loadPhotos(dir), h = d.header, [W, H] = h.picture, P = makeP(h.ft || 7), { L, Wd } = tableDims(h.ft || 7);
  const cam = makeCam(tableCornersFor(h.rot || 0, L, Wd), h.quad, W, H, LENS * Math.max(W, H), [W / 2, H / 2]);
  // when each picture was taken: "after" at the shot's end, "before" up to 1.5 s before its start
  const ev = d.events || [], times = [];
  for (const e of ev) { if (e.k === 'shot_end') times.push({ t: e.t / 1000, f: 'shot' + String(e.n).padStart(3, '0') + '-after' }); if (e.k === 'shot_start') times.push({ t: e.t / 1000 - 0.75, f: 'shot' + String(e.n).padStart(3, '0') + '-before' }); }
  times.sort((a, b) => a.t - b.t);
  const cloth = {};
  return t => {
    let f = null; for (const x of times) { if (x.t <= t) f = x.f; else break; }
    const img = f && ph[f]; if (!img) return () => null;
    const k = img.width / W;
    if (!(f in cloth)) cloth[f] = sampleCloth(img, h.quad.map(p => [p[0] * k, p[1] * k]));
    return (x, y) => { const p = cam.proj(x, y, P.R); return bareCloth(img, p[0] * k, p[1] * k, cam.ballRad(x, y, P.R, P.R) * k, cloth[f]); };
  };
}
// The same check, done once per picture on a 1-inch grid over the table and kept in the fixture ("cloth"), so the tests
// can replay a session with it and without the pictures: 2 bits per inch (0 cannot tell, 1 bare cloth, 2 covered),
// from 2 in outside the cushions.
function clothMaps(dir, d) {
  const em = emptyFromPhotos(dir, d), ev = d.events || [], frames = [], L = 82, W = 43, o = 2; // 2 in past the cushions: balls in the jaws
  const times = [];
  for (const e of ev) { if (e.k === 'shot_end') times.push(e.t / 1000); if (e.k === 'shot_start') times.push(e.t / 1000 - 0.75); }
  for (const t of times.sort((a, b) => a - b)) {
    const f = em(t + 0.01), bytes = new Uint8Array(Math.ceil(L * W / 4));
    for (let y = 0; y < W; y++) for (let x = 0; x < L; x++) { const r = f(x - o + 0.5, y - o + 0.5), v = r === true ? 1 : r === false ? 2 : 0, i = y * L + x; bytes[i >> 2] |= v << ((i & 3) * 2); }
    frames.push({ t: +t.toFixed(2), m: Buffer.from(bytes).toString('base64') });
  }
  return { grid: [L, W], off: o, frames };
}
function emptyFromMaps(cloth) {
  const [L, W] = cloth.grid, o = cloth.off || 0, fr = cloth.frames.map(f => ({ t: f.t, b: Buffer.from(f.m, 'base64') }));
  return t => {
    let f = null; for (const x of fr) { if (x.t <= t) f = x; else break; }
    if (!f) return () => null;
    return (x, y) => { const gx = Math.floor(x + o), gy = Math.floor(y + o); if (gx < 0 || gy < 0 || gx >= L || gy >= W) return null; const i = gy * L + gx, v = (f.b[i >> 2] >> ((i & 3) * 2)) & 3; return v === 1 ? true : v === 2 ? false : null; };
  };
}
module.exports = { emptyFromPhotos, clothMaps, emptyFromMaps };
if (require.main === module) {
  const d = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), full = JSON.parse(fs.readFileSync(path.join(process.argv[2], 'log.json'), 'utf8'));
  d.events = d.events && d.events.some(e => e.k === 'shot_end') ? d.events : full.events; d.header = d.header || full.header;
  if (process.argv.includes('--write')) { const fx = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')); fx.cloth = clothMaps(process.argv[2], d); if (!fx.events) fx.events = d.events.filter(e => ['new_rack', 'tap', 'tap_not', 'tap_pocketed', 'shot_start', 'shot_end'].includes(e.k)); fs.writeFileSync(process.argv[3], JSON.stringify(fx)); console.log('cloth maps written:', fx.cloth.frames.length); }
  const { score } = require('./score.js'), r = score(d, null, { empty: emptyFromPhotos(process.argv[2], d) });
  if (process.argv.includes('--detail')) for (const x of r.rows) if (!x.right) console.log(JSON.stringify(x));
  const { rows, ...sum } = r; console.log(JSON.stringify(sum));
}
