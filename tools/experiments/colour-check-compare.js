// Colour-check experiment: score tracker v0.6 on the frozen detections and on the same detections after the
// "make unsure" colour check (tools/experiments/colour-check.js), every clip of the session, both scoring modes of
// tools/score-racks.js. Prints the totals side by side and every clip whose result changed.
//   node tools/experiments/colour-check-compare.js <truth> <frozen dets> <checked dets> [out.json]
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const [TRUTH, A, B, OUT] = process.argv.slice(2);
const run = dir => { const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cc-')), 'r.json');
  execFileSync('node', [path.join(__dirname, '..', 'score-racks.js'), dir, TRUTH, '--out', out, '--track', '{"version":"v0.6"}'], { stdio: ['ignore', 'ignore', 'inherit'] }); return JSON.parse(fs.readFileSync(out, 'utf8')); };
const K = ['realShotClips', 'correctAutomatically', 'unresolved', 'confidentlyWrong', 'phantomPockets', 'madeLeftUnresolved', 'madeCalledOnTable', 'stateErrors', 'realShotsMissed', 'falseShots', 'racks', 'racksComplete', 'racksIntact'];
const ra = run(A), rb = run(B), res = {};
for (const mode of ['checkpoint', 'continuous']) {
  const ta = ra[mode].totals, tb = rb[mode].totals, ca = ra[mode].racks.flatMap(r => r.clips), cb = rb[mode].racks.flatMap(r => r.clips);
  const changed = ca.map((c, i) => [c, cb[i]]).filter(([a, b]) => a.result !== b.result).map(([a, b]) => ({ clip: a.clip, before: a.result, after: b.result }));
  res[mode] = { v06: Object.fromEntries(K.map(k => [k, ta[k]])), checked: Object.fromEntries(K.map(k => [k, tb[k]])), changed };
  console.log(mode + ': ' + K.filter(k => ta[k] !== tb[k] || ['correctAutomatically', 'confidentlyWrong', 'racksComplete'].includes(k)).map(k => `${k} ${ta[k]} -> ${tb[k]}`).join(', '));
  for (const c of changed) console.log(`   ${c.clip}: ${c.before} -> ${c.after}`);
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
