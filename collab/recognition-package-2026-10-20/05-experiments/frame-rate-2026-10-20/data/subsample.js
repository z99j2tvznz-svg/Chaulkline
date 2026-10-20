// node subsample.js <dets60 dir> <out dir> <step>  : keep every step-th frame (t unchanged), fps = 60/step
const fs = require('fs'), path = require('path');
const [src, out, step, off = 0] = process.argv.slice(2), k = +step, o = +off; fs.mkdirSync(out, { recursive: true });
for (const f of fs.readdirSync(src).filter(f => /^(clip|shot)\d+\.json$/.test(f))) {
  const d = JSON.parse(fs.readFileSync(path.join(src, f), 'utf8'));
  d.frames = d.frames.filter((_, i) => i % k === o); d.fps = d.fps / k;
  fs.writeFileSync(path.join(out, f), JSON.stringify(d));
}
