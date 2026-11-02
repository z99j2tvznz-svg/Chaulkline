// The stroke detector (src/stroke.js) run over the shot clips of a debug session folder (log.json + clips/shotNNN/).
// usage: node tools/v3/stroke.js <session folder> [--curve shotNNN]
//   prints per shot: whether the cue ball was moved with the cue rather than struck (STROKE.moveCheck), practice strokes, the last backswing (in), the pause (s), the strike against when the app saw the shot
//   start, the follow-through (in) and how far off the cue's line the cue ball left (degrees). Needs Python with Pillow.
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
global.D2R = global.D2R || Math.PI / 180;
const { makeCam, makeP } = require(path.join(__dirname, '../../src/core.js')), V = require(path.join(__dirname, '../../src/vision.js')), rgb2hsv = V.rgb2hsv, STROKE = require(path.join(__dirname, '../../src/stroke.js'));
function frames(dir) {
  const out = path.join(dir, '.rgba'); fs.mkdirSync(out, { recursive: true });
  execFileSync('python3', ['-I', '-c', `
import sys,os
from PIL import Image
d,o=sys.argv[1],sys.argv[2]
for f in sorted(os.listdir(d)):
  if f.endswith('.jpg') and f[0].isdigit():
    t=os.path.join(o,f[:-4]+'.rgba')
    if not os.path.exists(t):
      im=Image.open(os.path.join(d,f)).convert('RGBA'); open(t,'wb').write(im.size[0].to_bytes(2,'little')+im.size[1].to_bytes(2,'little')+im.tobytes())
`, dir, out]);
  return f => { const b = fs.readFileSync(path.join(out, f.replace('.jpg', '.rgba'))); return { w: b.readUInt16LE(0), h: b.readUInt16LE(2), data: b.subarray(4) }; };
}
function run(dir, only) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, 'log.json'), 'utf8')), h = d.header, [W, H] = h.picture, P = makeP(h.ft || 7), { L, Wd } = V.tableDims(h.ft || 7);
  const cam = makeCam(V.tableCornersFor(h.rot || 0, L, Wd), h.quad, W, H, (h.lens || 0.86) * Math.max(W, H), [W / 2, H / 2]);
  const cl = (d.events.find(e => e.k === 'cloth') || {}), isCloth = STROKE.clothTest(cl, rgb2hsv);
  const rows = [];
  for (const sh of d.shots || []) {
    const nm = 'shot' + String(sh.n).padStart(3, '0'), cd = path.join(dir, 'clips', nm); if (only && only !== nm) continue;
    if (!fs.existsSync(path.join(cd, 'index.json'))) continue;
    const ix = JSON.parse(fs.readFileSync(path.join(cd, 'index.json'), 'utf8')), [bx, by, bw, bh] = ix.box, [cw, ch] = ix.size, k = cw / bw;
    const cue = (sh.before || []).find(b => b.num === 0); if (!cue) continue;
    const p = cam.proj(cue.rx != null ? cue.rx : cue.x, cue.ry != null ? cue.ry : cue.y, P.R), get = frames(cd);
    const toTable = (px, py) => cam.unproj(bx + px / k, by + py / k, P.R), rBall = Math.max(2, cam.ballRad(cue.rx || cue.x, cue.ry || cue.y, P.R, P.R) * k);
    // the cloth inside the cushions, in clip pixels (the quad's corners, 2 px in)
    const Q = h.quad.map(q => [(q[0] - bx) * k, (q[1] - by) * k]), cx0 = Q.reduce((a, q) => a + q[0], 0) / 4, cy0 = Q.reduce((a, q) => a + q[1], 0) / 4, Qi = Q.map(q => { const dx = cx0 - q[0], dy = cy0 - q[1], n = Math.hypot(dx, dy); return [q[0] + 2 * dx / n, q[1] + 2 * dy / n]; });
    const inside = (x, y) => { let c = false; for (let i = 0, j = 3; i < 4; j = i++) { const [xi, yi] = Qi[i], [xj, yj] = Qi[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
    let prev = { ball: [(p[0] - bx) * k, (p[1] - by) * k], ang: null }; const obs = [];
    for (const [f, t] of ix.list) { const im = get(f), o = STROKE.observe(im, im.w, im.h, prev, isCloth, { rBall: Math.ceil(rBall), reach: Math.max(4, rBall * 1.6), inside }); obs.push(Object.assign({ t }, o)); prev = { ball: o.ball || prev.ball, ang: o.ang != null ? o.ang : prev.ang, rest: prev.rest || (o.ball && !o.lost ? o.ball : null), fb: o.fb, fv: o.fv }; }
    const s = STROKE.summarize(obs, toTable) || {}, mv = STROKE.moveCheck(obs, ix.at, toTable);
    rows.push({ shot: sh.n, move: mv, test: sh.test || null, seen: ix.at, strike: s.strike, early: s.strike != null ? +((ix.at - s.strike) / 1000).toFixed(2) : null, strokes: s.strokes, backLen: s.backLen, pause: s.pause, follow: s.follow, offLine: s.offLine, cueFound: obs.filter(q => q.tip != null).length + '/' + obs.length, curve: only ? s.curve : undefined, obs: only ? obs.map(q => [q.t, q.ball && q.ball.map(v => +v.toFixed(1)), q.ang, q.tip, q.tip0, q.fb && q.fb.map(v => +v.toFixed(1))]) : undefined });
  }
  return rows;
}
module.exports = { run };
if (require.main === module) { const i = process.argv.indexOf('--curve'); for (const r of run(process.argv[2], i > 0 ? process.argv[i + 1] : null)) console.log(JSON.stringify(r)); }
