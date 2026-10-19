// Compare the frozen tracker with one experiment option, session by session, on the same detections. Reports what
// each experiment must report: tracking coverage, identity continuity, confirmed pockets, unresolved balls and false
// positives (from the rack scorer), so experiments can be judged against the unchanged baseline.
//
//   node tools/experiments/compare.js '<tracker options JSON>' <detections folder>:<truth json> [...] [--out file.json]
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { execFileSync } = require('node:child_process');
const { makeTracker } = require('../tracker.js');

// tracker-only measures on one detections folder
function trackMeasures(dir, opts, truth) {
  const T = JSON.parse(fs.readFileSync(truth, 'utf8')).clips, stepOf = c => Array.isArray(T) ? (T.find(x => x.clip === c) || {}).step : (T[c] || {}).step;
  const m = { clips: 0, movingFrames: 0, movingSeen: 0, ballTracks: 0, renames: 0, clipsTwoCue: 0, cueNamedTracks: 0, unnamedBallTracks: 0, pocketEvents: 0 };
  for (const f of fs.readdirSync(dir).filter(f => /^(clip|shot)\d+\.json$/.test(f)).sort()) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')), clip = f.replace('.json', ''), o = opts.oneCue === 'play' ? { ...opts, oneCue: !stepOf(clip) || /^play/.test(stepOf(clip)) } : opts, tr = makeTracker(d.table, { ...o, trace: true });
    for (const fr of d.frames) tr.step(fr);
    const r = tr.finish(); m.clips++; m.pocketEvents += r.events.filter(e => e.k === 'pocket').length;
    const balls = r.trace.tracks.filter(t => t.isBall); m.ballTracks += balls.length;
    for (const t of balls) {
      m.renames += Math.max(0, t.idChanges.length - 1); if (t.ball == null) m.unnamedBallTracks++;
      let on = false; for (const [, det, , st] of t.samples) { if (st === 'moving') on = true; else if (st === 'resting' || st === 'pocketed' || st === 'gone') on = false; if (on) { m.movingFrames++; if (det >= 0) m.movingSeen++; } }
    }
    const cue = balls.filter(t => t.ball === 0).length; m.cueNamedTracks += cue; if (cue > 1) m.clipsTwoCue++;
  }
  m.coverage = m.movingFrames ? +(m.movingSeen / m.movingFrames).toFixed(3) : null;
  return m;
}
function score(dir, truth, opts) {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cmp-')), 's.json');
  execFileSync('node', [path.join(__dirname, '..', 'score-racks.js'), dir, truth, '--diag', '--out', out, '--track', JSON.stringify(opts)], { encoding: 'utf8' });
  const t = JSON.parse(fs.readFileSync(out, 'utf8')).continuous.totals;
  return { correct: t.correctAutomatically, unresolved: t.unresolved, confidentlyWrong: t.confidentlyWrong, madeLeftUnresolved: t.madeLeftUnresolved,
    phantomPockets: t.phantomPockets, madeCalledOnTable: t.madeCalledOnTable, stateErrors: t.stateErrors, falseShots: t.falseShots, realShotsMissed: t.realShotsMissed, correctionsNeeded: t.correctionsNeeded };
}
const argv = process.argv.slice(2), oi = argv.indexOf('--out'), OUT = oi >= 0 ? argv.splice(oi, 2)[1] : null;
const opts = JSON.parse(argv[0]), res = [];
for (const pair of argv.slice(1)) {
  const [dir, truth] = pair.split(':'), name = path.basename(truth, '.json');
  const row = { session: name, baseline: { ...trackMeasures(dir, {}, truth), ...score(dir, truth, {}) }, experiment: { ...trackMeasures(dir, opts, truth), ...score(dir, truth, opts) } };
  res.push(row);
  const keys = Object.keys(row.baseline).filter(k => row.baseline[k] !== row.experiment[k]);
  console.log(name + ': ' + (keys.length ? keys.map(k => `${k} ${row.baseline[k]} -> ${row.experiment[k]}`).join(', ') : 'no change'));
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ options: opts, sessions: res }, null, 1));
