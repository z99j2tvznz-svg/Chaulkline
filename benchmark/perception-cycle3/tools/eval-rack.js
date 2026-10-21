// Score a continuous-rack log (exp/tools/rack.js) against a rack's verified events and pockets.
//   node eval-rack.js <log.json> <events truth json> [<pockets truth json>] [--json]
// Truth: events json = { start: [balls], shots: [{ at, made: [..], first }] }; pockets json = { pockets: [{ ball, pocket: 'P1'.. }] }.
// Measures (all on this one rack):
//   start      balls established on the table at rack start (any way), named right at rack start, wrongly established
//   shots      real shots found (system shot within 1.5 s, one to one), missed, false; first ball right / no reading / wrong
//   tables     after each real shot: every ball's state right with nothing open (correct), something open (unresolved),
//              something confidently wrong (wrong); balls carried as present while hidden, and whether they were there
//   pockets    each made ball: confirmed in the right shot as an observed entry or inferred from the table, or not;
//              P-ID given and right / given and wrong / unknown; a pocket given for an inferred ball counts as fabricated
'use strict';
const fs = require('node:fs');
const [LOG, EV, PK] = process.argv.slice(2).filter(a => !a.startsWith('--')), JSONOUT = process.argv.includes('--json');
const log = JSON.parse(fs.readFileSync(LOG, 'utf8')), T = JSON.parse(fs.readFileSync(EV, 'utf8')), P = PK ? JSON.parse(fs.readFileSync(PK, 'utf8')).pockets : [];
const set = T.start, res = { start: {}, shots: {}, tables: { correct: 0, unresolved: 0, wrong: 0, perShot: [] }, pockets: { made: 0, observed: 0, inferred: 0, notConfirmed: 0, wrongShot: 0, pidRight: 0, pidWrong: 0, pidUnknown: 0, fabricated: 0, perBall: [] }, hidden: { carried: 0, right: 0 } };
// start
const st = log.start ? log.start.balls : {};
res.start = { truth: set.length, established: set.filter(n => st[n] && st[n] !== 'not established').length, namedAtStart: set.filter(n => st[n] === 'seen and named at rack start').length,
  wronglyEstablished: Object.keys(st).map(Number).filter(n => !set.includes(n) && st[n] !== 'not established').length, countCheck: log.start ? log.start.countCheck : null };
// shots: one to one, closest first
const sys = log.shots.map(s => s.t), pairs = [];
T.shots.forEach((s, i) => sys.forEach((t, j) => { if (Math.abs(t - s.at) < 1.5) pairs.push([Math.abs(t - s.at), i, j]); }));
pairs.sort((a, b) => a[0] - b[0]);
const tOf = new Map(), sOf = new Map();
for (const [, i, j] of pairs) if (!tOf.has(i) && !sOf.has(j)) { tOf.set(i, j); sOf.set(j, i); }
res.shots = { real: T.shots.length, found: tOf.size, missed: T.shots.length - tOf.size, false: sys.length - sOf.size, firstRight: 0, firstNone: 0, firstWrong: 0 };
let on = new Set(set);
T.shots.forEach((s, i) => {
  for (const b of s.made) on.delete(b);
  const j = tOf.get(i), e = j != null ? log.shots[j] : null;
  if (e) { if (s.id === 'break' || s.first == null) {} else if (e.first == null) res.shots.firstNone++; else if (e.first === s.first) res.shots.firstRight++; else res.shots.firstWrong++; }
  // the table after this shot: the system's table at the last system shot at or before the next real shot's match
  const row = { shot: i + 1, id: s.id, result: null, open: [], wrong: [] };
  if (!e || !e.table) { row.result = 'no table'; res.tables.unresolved++; res.tables.perShot.push(row); return; }
  for (const n of set) {
    const r = e.table[n], status = r ? r.status : null, isOn = on.has(n);
    if (isOn && status === 'pocketed') row.wrong.push(n + ' on the table, called gone');
    else if (!isOn && status === 'present') row.wrong.push(n + ' gone, called on the table');
    else if (status !== 'present' && status !== 'pocketed') row.open.push(n + (isOn ? ' on the table' : ' gone') + ', left ' + (status || 'untracked'));
    if (r && r.hiddenSince != null) { res.hidden.carried++; if (isOn) res.hidden.right++; }
  }
  row.result = row.wrong.length ? 'wrong' : row.open.length ? 'unresolved' : 'correct';
  res.tables[row.result === 'correct' ? 'correct' : row.result === 'wrong' ? 'wrong' : 'unresolved']++;
  res.tables.perShot.push(row);
  // pockets
  for (const b of s.made) {
    res.pockets.made++;
    const pb = { ball: b, shot: i + 1, truthPocket: (P.find(p => p.ball === b) || {}).pocket || null };
    const m = e.made && e.made.find(x => x.ball === b), elsewhere = log.shots.some((x, k) => k !== j && x.made && x.made.some(y => y.ball === b));
    if (!m) { pb.result = elsewhere ? 'confirmed in another shot' : 'not confirmed'; if (elsewhere) res.pockets.wrongShot++; else res.pockets.notConfirmed++; }
    else if (m.kind === 'observed entry') {
      res.pockets.observed++; pb.result = 'observed entry'; pb.pid = m.pocket.pid; pb.camera = m.pocket.camera; pb.conf = m.pocket.conf;
      if (!/^P\d$/.test(m.pocket.pid)) res.pockets.pidUnknown++; else if (m.pocket.pid === pb.truthPocket) res.pockets.pidRight++; else res.pockets.pidWrong++;
    } else { res.pockets.inferred++; pb.result = 'inferred from the table'; if (m.pocket !== 'unknown') res.pockets.fabricated++; else res.pockets.pidUnknown++; }
    res.pockets.perBall.push(pb);
  }
});
if (JSONOUT) console.log(JSON.stringify(res, null, 1));
else {
  const r = res;
  console.log(`start: established ${r.start.established}/${r.start.truth} (named at rack start ${r.start.namedAtStart}), wrongly established ${r.start.wronglyEstablished}` + (r.start.countCheck ? `, pack count ${r.start.countCheck.packCount} + ${r.start.countCheck.seenAwayFromPack} away = ${r.start.countCheck.expected} (${r.start.countCheck.agrees ? 'agrees' : 'DISAGREES'})` : ''));
  console.log(`shots: found ${r.shots.found}/${r.shots.real}, missed ${r.shots.missed}, false ${r.shots.false}; first ball right ${r.shots.firstRight}, no reading ${r.shots.firstNone}, wrong ${r.shots.firstWrong}`);
  console.log(`tables after shots: correct ${r.tables.correct}, unresolved ${r.tables.unresolved}, wrong ${r.tables.wrong}; hidden balls carried ${r.hidden.carried} (right ${r.hidden.right})`);
  for (const x of r.tables.perShot) if (x.result !== 'correct') console.log(`  shot ${x.shot} (${x.id}): ${x.result} ${x.wrong.concat(x.open).join('; ')}`);
  console.log(`pockets: ${r.pockets.made} made: observed ${r.pockets.observed}, inferred ${r.pockets.inferred}, not confirmed ${r.pockets.notConfirmed}, other shot ${r.pockets.wrongShot}; P-ID right ${r.pockets.pidRight}, wrong ${r.pockets.pidWrong}, unknown ${r.pockets.pidUnknown}; fabricated ${r.pockets.fabricated}`);
}
