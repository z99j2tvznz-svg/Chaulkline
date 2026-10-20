// Calibration experiment: score v0.6 on the frozen detections and on the recalibrated ones, counting only the test
// clips (clips used for calibration are never counted). Main measure and failure types from tools/score-racks.js,
// each shot judged alone ("checkpoint") and played straight through ("continuous").
//   node tools/experiments/recal-compare.js <truth> <frozen dets> <recalibrated dets> <test clip,clip,...>
'use strict';
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { execFileSync } = require('node:child_process');
const [TRUTH, A, B, TEST] = process.argv.slice(2), test = new Set(TEST.split(','));
const run = dir => { const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rc-')), 'r.json');
  execFileSync('node', [path.join(__dirname, '..', 'score-racks.js'), dir, TRUTH, '--out', out, '--track', '{"version":"v0.6"}']); return JSON.parse(fs.readFileSync(out, 'utf8')); };
const sum = (rep, mode) => {
  const cl = rep[mode].racks.flatMap(r => r.clips).filter(c => !c.missing && test.has(c.clip)), real = cl.filter(c => c.realShot);
  const W = (c, f) => c.wrong.filter(f).length;
  return { shots: real.length, endRight: real.filter(c => c.result === 'correct automatically').length, confidentlyWrong: real.filter(c => c.result === 'confidently wrong').length,
    phantom: cl.reduce((a, c) => a + W(c, w => w.fact === 'made' && w.what.startsWith('confirmed pocketed')), 0),
    madeOpen: cl.reduce((a, c) => a + c.unresolved.filter(u => u.fact === 'made').length, 0),
    stateErrors: cl.reduce((a, c) => a + (c.stateErrors || []).length, 0),
    missed: cl.reduce((a, c) => a + W(c, w => w.what.startsWith('real shot not found')), 0), falseShots: cl.reduce((a, c) => a + (c.falseShots || 0), 0),
    clipsWrong: cl.filter(c => c.result === 'confidently wrong').map(c => c.clip) };
};
const ra = run(A), rb = run(B), res = {};
for (const mode of ['checkpoint', 'continuous']) {
  const a = sum(ra, mode), b = sum(rb, mode);
  res[mode] = { v06: a, calibrated: b, newWrongClips: b.clipsWrong.filter(c => !a.clipsWrong.includes(c)) };
  console.log(mode.padEnd(11) + ' v0.6 ' + JSON.stringify({ ...a, clipsWrong: undefined }) + '\n' + ''.padEnd(11) + ' cal  ' + JSON.stringify({ ...b, clipsWrong: undefined }) + '  new wrong clips: ' + res[mode].newWrongClips.join(' '));
}
if (process.argv[6]) fs.writeFileSync(process.argv[6], JSON.stringify(res, null, 1));
