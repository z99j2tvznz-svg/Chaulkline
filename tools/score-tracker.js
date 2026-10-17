// Score the new tracker (tools/tracker.js) on a session's clip detections (tools/clip-detect.js) against the
// hand-checked truth in data/truth/.
//
//   node tools/score-tracker.js <detections folder> <truth json> [--v]
const fs = require('node:fs'), path = require('node:path');
const { makeTracker } = require('./tracker.js');

const argv = process.argv.slice(2), VERBOSE = argv.includes('--v');
const [DET, TRUTH] = argv.filter(a => !a.startsWith('--'));
const truth = JSON.parse(fs.readFileSync(TRUTH, 'utf8')).clips;

const tot = { clips: 0, realShots: 0, shotsFound: 0, fakeShots: 0, made: 0, caught: 0, named: 0, wrongName: 0, missed: 0, phantom: 0, falseScratch: 0, firstChecked: 0, firstRight: 0 };
const lines = [];
for (const clip of Object.keys(truth).sort()) {
  const f = path.join(DET, clip + '.json'); if (!fs.existsSync(f)) continue;
  const d = JSON.parse(fs.readFileSync(f, 'utf8')), T = truth[clip];
  const tr = makeTracker(d.table);
  for (const fr of d.frames) tr.step(fr);
  const r = tr.finish();
  tot.clips++;
  const got = r.shots.length > 0;
  if (T.shot) { tot.realShots++; if (got) tot.shotsFound++; }
  tot.fakeShots += T.shot ? Math.max(0, r.shots.length - 1) : r.shots.length;
  // every pocket the tracker saw in this clip, inside a shot or not
  const pockets = r.events.filter(e => e.k === 'pocket').map(e => ({ ...e, ball: (r.tracks.find(t => t.id === e.track) || {}).ball ?? e.ball }));
  const left = T.made.slice(); let caught = 0, named = 0, wrong = 0, phantom = 0;
  // match by number first; a pocket with the wrong or no number still counts as caught if a real ball went in
  const rest = [];
  for (const p of pockets) { const i = p.ball != null ? left.indexOf(p.ball) : -1; if (i >= 0) { left.splice(i, 1); caught++; named++; } else rest.push(p); }
  for (const p of rest) {
    if (p.ball === 0) continue; // cue ball "in" = scratch, counted below
    if (left.length) { left.shift(); caught++; if (p.ball != null) wrong++; } else phantom++;
  }
  tot.made += T.made.length; tot.caught += caught; tot.named += named; tot.missed += left.length; tot.phantom += phantom; tot.wrongName += wrong;
  const scratch = pockets.some(p => p.ball === 0);
  if (scratch && !T.scratch) tot.falseScratch++;
  let firstNote = '';
  if (T.shot && got && T.first != null) {
    tot.firstChecked++; const f1 = r.shots[0].first;
    if (f1 === T.first) tot.firstRight++;
    firstNote = `first ${f1 ?? '-'}${f1 === T.first ? '' : ' (truth ' + T.first + ')'}`;
  }
  lines.push(`${clip}  truth: ${T.shot ? 'shot' : 'no shot'}, made [${T.made}]   tracker: ${r.shots.length} shot(s) at [${r.shots.map(s => s.t.toFixed(1))}], pockets [${pockets.map(p => (p.ball ?? '?') + '@' + p.t.toFixed(1))}] ${firstNote}`
    + (VERBOSE ? `\n    events ${JSON.stringify(r.events.filter(e => e.k !== 'pocket'))}\n    end ${JSON.stringify(r.tracks)}` : ''));
}
console.log(lines.join('\n'));
const pct = (a, b) => b ? `${a}/${b}` : '-';
console.log('\nSummary');
console.log(`  real shots found      ${pct(tot.shotsFound, tot.realShots)}`);
console.log(`  fake shots            ${tot.fakeShots}`);
console.log(`  pockets caught        ${pct(tot.caught, tot.made)} (named right ${tot.named}, named wrong ${tot.wrongName})`);
console.log(`  pockets missed        ${tot.missed}`);
console.log(`  phantom pockets       ${tot.phantom}`);
console.log(`  false scratches       ${tot.falseScratch}`);
console.log(`  first ball right      ${pct(tot.firstRight, tot.firstChecked)}`);
