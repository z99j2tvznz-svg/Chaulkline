// Compare two detection runs of the same clips (the baseline and an experiment that changes detection, such as the
// outline check) with the frozen tracker and scorer: coverage, identity continuity, pockets, unresolved balls, false
// positives, plus what the detection change itself did (spots kept, per clip).
//
//   node tools/experiments/compare-dets.js <baseline dets>:<experiment dets>:<truth json> [...] [--out file.json]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { trackMeasures, score } = require('./compare.js');

const kept = dir => Object.fromEntries(fs.readdirSync(dir).filter(f => /^(clip|shot)\d+\.json$/.test(f)).sort().map(f => {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  return [f.replace('.json', ''), { spots: d.frames.reduce((a, fr) => a + fr.balls.length, 0), outline: d.outline ? d.outline.status + ' (' + d.outline.from + ')' : null }];
}));
const argv = process.argv.slice(2), oi = argv.indexOf('--out'), OUT = oi >= 0 ? argv.splice(oi, 2)[1] : null, res = [];
for (const triple of argv) {
  const [a, b, truth] = triple.split(':'), name = path.basename(truth, '.json');
  const row = { session: name, baseline: { ...trackMeasures(a, {}, truth), ...score(a, truth, {}) }, experiment: { ...trackMeasures(b, {}, truth), ...score(b, truth, {}) }, clips: {} };
  const ka = kept(a), kb = kept(b);
  for (const c of Object.keys(ka)) if (kb[c] && (ka[c].spots !== kb[c].spots || kb[c].outline)) row.clips[c] = { spotsBefore: ka[c].spots, spotsAfter: kb[c].spots, outline: kb[c].outline };
  res.push(row);
  const keys = Object.keys(row.baseline).filter(k => row.baseline[k] !== row.experiment[k]);
  console.log(name + ': ' + (keys.length ? keys.map(k => `${k} ${row.baseline[k]} -> ${row.experiment[k]}`).join(', ') : 'no change'));
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
