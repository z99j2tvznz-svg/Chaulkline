// edge regression set: held-out clips use the edge input when its kept boxes equal the frozen30 set's, else the plain file
const fs = require('fs'), path = require('path'); const S = process.argv[2], OUT = S + '/c4/c2e';
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT + '/dets/frozen30', { recursive: true });
fs.symlinkSync(S + '/c2/bench_out', OUT + '/bench_out'); fs.symlinkSync(S + '/c4/dets/d30b', OUT + '/dets/d30b');
const rep = {};
for (const s of fs.readdirSync(S + '/c4/dets/frozen30')) {
  const src = S + '/c4/dets/frozen30/' + s, dst = OUT + '/dets/frozen30/' + s;
  if (!s.startsWith('rec-')) { fs.symlinkSync(src, dst); continue; }
  fs.mkdirSync(dst); rep[s] = { edge: 0, plain: [] };
  for (const f of fs.readdirSync(src)) {
    const e = S + '/c4/edets/frozen30/' + s + '/' + f; let ok = false;
    if (fs.existsSync(e)) {
      const a = JSON.parse(fs.readFileSync(e)), b = JSON.parse(fs.readFileSync(src + '/' + f));
      ok = a.frames.length === b.frames.length && a.frames.every((fr, i) => { const k = fr.balls.filter(x => !x.edge), g = b.frames[i].balls;
        return k.length === g.length && k.every((x, j) => Math.abs(x.x - g[j].x) < 1e-6 && Math.abs(x.y - g[j].y) < 1e-6 && x.rec === g[j].rec && x.nb === g[j].nb); });
    }
    if (ok || (process.env.ALL && fs.existsSync(e))) { fs.symlinkSync(e, dst + '/' + f); rep[s].edge++; } else { fs.symlinkSync(src + '/' + f, dst + '/' + f); rep[s].plain.push(f.replace('.json', '') + (fs.existsSync(e) ? ' (kept boxes differ)' : ' (no sidecar)')); }
  }
}
console.log(JSON.stringify(rep, null, 1));
