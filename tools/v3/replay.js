// Replay the looks of a V3 debug log (log.json, or a tests/fixtures/v3/session-*.json) through src/track.js and print the
// shots. The log keeps each spot's table position, number and kind, not the reader's 11 probabilities, so those are rebuilt
// (sure: 0.9 on the number; unsure: 0.5; not a ball: 0.8 not-a-ball). Shot timing and pocket calls depend on positions only.
// usage: node tools/v3/replay.js <log.json> [--events]
const fs = require('fs'), path = require('path');
const { makeP } = require(path.join(__dirname, '../../src/core.js')), { makeTracker } = require(path.join(__dirname, '../../src/track.js'));
function replay(d, ft, opts) {
  const tk = makeTracker(makeP(ft || (d.header && d.header.ft) || 7), opts);
  const probs = (n, k) => { const q = new Array(11).fill(0); if (k === 'n') { q[10] = 0.8; q[n] = 0.2; return q; } const top = k === 's' ? 0.9 : 0.5; q.fill((1 - top - 0.01) / 9); q[n] = top; q[10] = 0.01; return q; };
  for (const L of d.looks) {
    const spots = L[5].map(([x, y, num, kind, score]) => ({ x, y, px: x * 20, py: y * 20, r: 13.5, score, kind: kind === 's' ? 'sure' : kind === 'u' ? 'unsure' : kind === 'n' ? 'not_a_ball' : null, p: num == null ? null : probs(num, kind) }));
    tk.update(L[0] / 1000, spots, { read: spots.some(s => s.p) });
  }
  return tk;
}
if (require.main === module) {
  const tk = replay(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
  for (const s of tk.S.shots) console.log('shot', s.n, (s.t1 - s.t0).toFixed(1) + ' s', 'made', s.made.map(m => m.num), s.scratch ? 'scratch' : '', 'first', s.firstNum);
  if (process.argv.includes('--events')) for (const e of tk.S.events) if (e.k !== 'named' && e.k !== 'ball') console.log(JSON.stringify(e));
}
module.exports = { replay };
