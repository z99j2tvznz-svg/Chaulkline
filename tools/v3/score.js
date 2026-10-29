// Score a replayed session against its truth (tests/fixtures/v3/session-*.json with a "truth" list: [start s, [made]] per
// real shot, or [[from, to], [made]] for a shot whose start is only known to lie in that window).
// usage: node tools/v3/score.js <session.json> [--detail]
const fs = require('fs'), path = require('path'), { replay } = require('./replay.js');
function score(d, opts, o2) {
  // a scratch counts as the cue ball made (the shot can call a scratch on a ball it took for the cue ball)
  const tk = replay(d, null, opts, o2), shots = tk.S.shots.map(s => ({ t0: s.t0, made: s.made.map(m => m.num).concat(s.scratch && !s.made.some(m => m.num === 0) ? [0] : []), scratch: s.scratch })), used = new Set(), rows = [];
  for (const [when, made] of d.truth) {
    const [a, b] = Array.isArray(when) ? when : [when - 1.5, when + 1.5];
    const i = shots.findIndex((s, k) => !used.has(k) && s.t0 >= a && s.t0 <= b); if (i >= 0) used.add(i);
    const got = i >= 0 ? shots[i].made : null, want = made.slice().sort(), have = (got || []).filter(n => n != null).sort();
    rows.push({ when, want, got, found: i >= 0, right: i >= 0 && JSON.stringify(want) === JSON.stringify(have) && !(got || []).includes(null),
      missed: want.filter(n => !have.includes(n)), wrongIn: (got || []).filter(n => n == null || !want.includes(n)) });
  }
  const extra = shots.filter((s, k) => !used.has(k));
  return { rows, shots: rows.filter(r => r.found).length, of: rows.length, right: rows.filter(r => r.right).length, missedPots: rows.reduce((a, r) => a + r.missed.length, 0),
    falsePots: rows.reduce((a, r) => a + r.wrongIn.length, 0), extraShots: extra.length, extra: extra.map(s => +s.t0.toFixed(1)) };
}
if (require.main === module) {
  const r = score(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  if (process.argv.includes('--detail')) for (const x of r.rows) console.log(JSON.stringify(x));
  const { rows, ...sum } = r; console.log(JSON.stringify(sum));
}
module.exports = { score };
