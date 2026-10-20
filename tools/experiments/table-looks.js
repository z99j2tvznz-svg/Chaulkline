// Before/after table looks for chosen shots (read-only), for the picture sheet (tools/experiments/table-sheet.py):
// for each shot, the analysed frame in the middle of the scorer's before look (1.5 to 0.2 s before the shot) and
// after look (the last second), every detection in that frame with the number of the still-table group it belongs to
// (reconcile.observe, as the scorer uses it), the true table where the truth file knows it, and the scorer's verdict.
//   node tools/experiments/table-looks.js '<tracker options>' <out.json> <dets>:<truth>:<video dir>:<clip>[,<clip>...] ...
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { execFileSync } = require('node:child_process');
const [opts, OUT, ...specs] = process.argv.slice(2), res = [];
for (const spec of specs) {
  const [dir, truth, vids, clips] = spec.split(':'), TJ = JSON.parse(fs.readFileSync(truth, 'utf8'));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tl-')), 's.json');
  execFileSync('node', [path.join(__dirname, '..', 'score-racks.js'), dir, truth, '--diag', '--out', out, '--track', opts]);
  const rep = JSON.parse(fs.readFileSync(out, 'utf8'));
  for (const clip of clips.split(',')) {
    let c = null; for (const r of rep.checkpoint.racks) c = c || r.clips.find(x => x.clip === clip);
    const d = JSON.parse(fs.readFileSync(path.join(dir, clip + '.json'), 'utf8')), T = TJ.clips[clip] || {}, end = d.frames[d.frames.length - 1].t;
    const shotT = c.shotsAt && c.shotsAt.length ? c.shotsAt[0] : null;
    let truthBefore = null;   // the true table before the shot; after = that minus the balls that went in
    const looks = c.trace.filter(x => x.label === 'before' || x.label === 'after').map(look => {
      const tMid = look.label === 'before' ? (shotT != null ? shotT - 0.85 : 0.5) : end - 0.5;
      const f = d.frames.reduce((b, fr, i) => Math.abs(fr.t - tMid) < Math.abs(d.frames[b].t - tMid) ? i : b, 0);
      // rack sessions know the true table: checkpoint mode starts each shot from it
      if (look.label === 'before' && TJ.racks && !Object.values(look.prev).includes('unconfirmed')) truthBefore = Object.entries(look.prev).filter(([, s]) => s === 'present').map(([n]) => +n);
      const truthOn = !truthBefore ? null : look.label === 'after' ? truthBefore.filter(n => !(T.made || []).includes(n)) : truthBefore;
      const spots = d.frames[f].balls.map(b => {
        let g = null, gd = 2.5; for (const s of look.seen) { const dd = Math.hypot(s.x - b.x, s.y - b.y); if (dd < gd) { gd = dd; g = s; } }
        return { px: b.px, py: b.py, x: b.x, y: b.y, num: g ? g.num : null, inLook: !!g };
      });
      return { label: look.label, frame: f, t: d.frames[f].t, seen: look.seen, unnamed: look.unnamed, settled: look.settled, truthOn, spots };
    });
    res.push({ session: path.basename(truth, '.json'), clip, video: path.join(vids, clip + '.mp4'), result: c.result, made: T.made || [], wrong: c.wrong, open: c.unresolved, looks });
  }
}
fs.writeFileSync(OUT, JSON.stringify(res));
console.log(res.map(r => `${r.session} ${r.clip} ${r.result}`).join('\n'));
