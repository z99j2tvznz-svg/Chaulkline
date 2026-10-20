// Player-facing measures from the rack scorer (tools/score-racks.js --diag, "from checkpoints" mode: each shot starts
// from the true table, so each shot is judged on its own), per session:
//   start table: on clips where the true table is known, balls on the table that the look before the shot named, and
//     whole start tables fully right (every ball on the table named, no gone ball named)
//   end table: the same for the look after the shot (true end table = start minus balls that went in)
//   shots: real shots found, missed, false shots; pockets: made balls confirmed, left open, called on the table,
//     phantom pockets; scratches confirmed
//   main measure: shots whose end table came out right with no correction (scorer result "correct automatically")
//   racks: complete racks with no intervention (continuous mode)
//   node tools/experiments/product-metrics.js '<tracker options>' <dets>:<truth> [...] [--out file.json]
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { execFileSync } = require('node:child_process');
const argv = process.argv.slice(2), oi = argv.indexOf('--out'), OUT = oi >= 0 ? argv.splice(oi, 2)[1] : null, opts = argv.shift(), res = [];
for (const pair of argv) {
  const [dir, truth] = pair.split(':'), name = path.basename(truth, '.json'), T = JSON.parse(fs.readFileSync(truth, 'utf8')).clips;
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pm-')), 's.json');
  execFileSync('node', [path.join(__dirname, '..', 'score-racks.js'), dir, truth, '--diag', '--out', out, '--track', opts]);
  const rep = JSON.parse(fs.readFileSync(out, 'utf8')), ck = rep.checkpoint, ct = ck.totals;
  const m = { session: name, shots: 0, endRight: 0, startTables: 0, startRight: 0, startBalls: 0, startNamed: 0, startGoneNamed: 0,
    endTables: 0, endRight2: 0, endBalls: 0, endNamed: 0, scratches: 0, scratchesSeen: 0,
    shotsMissed: ct.realShotsMissed, falseShots: ct.falseShots, made: 0, madeLeftOpen: ct.madeLeftUnresolved, madeCalledOnTable: ct.madeCalledOnTable,
    phantom: ct.phantomPockets, confidentlyWrong: ct.confidentlyWrong, racks: rep.continuous.totals.racks, racksComplete: rep.continuous.totals.racksComplete };
  for (const rack of ck.racks) for (const c of rack.clips) {
    if (c.missing) continue;
    const t = T[c.clip] || {};
    if (c.realShot) { m.shots++; if (c.result === 'correct automatically') m.endRight++; m.made += (t.made || []).length; if (t.scratch) { m.scratches++; if (!c.wrong.some(w => w.ball === 0) && !c.unresolved.some(u => u.ball === 0)) m.scratchesSeen++; } }
    for (const look of c.trace || []) {
      const truthOn = Object.entries(look.prev).filter(([, s]) => s === 'present').map(([n]) => +n);
      if (look.prev && Object.values(look.prev).some(s => s === 'unconfirmed')) continue;   // true table not known
      const on = look.label === 'after' ? truthOn.filter(n => !(t.made || []).includes(n)) : truthOn, named = new Set(look.seen.filter(s => s.num != null).map(s => s.num));
      const hit = on.filter(n => named.has(n)).length, gone = [...named].filter(n => !on.includes(n)).length, ok = hit === on.length && !gone;
      if (look.label === 'before') { m.startTables++; m.startRight += ok; m.startBalls += on.length; m.startNamed += hit; m.startGoneNamed += gone; }
      if (look.label === 'after' && c.realShot) { m.endTables++; m.endRight2 += ok; m.endBalls += on.length; m.endNamed += hit; }
    }
  }
  res.push(m);
  const p = (a, b) => b ? `${a}/${b} (${Math.round(100 * a / b)}%)` : 'n/a';
  console.log(`${name}: shots ${m.shots}; end table right with no correction ${p(m.endRight, m.shots)}; start look named ${p(m.startNamed, m.startBalls)}, whole start table ${p(m.startRight, m.startTables)}; end look named ${p(m.endNamed, m.endBalls)}, whole ${p(m.endRight2, m.endTables)}; made ${m.made}: open ${m.madeLeftOpen}, called on table ${m.madeCalledOnTable}; phantom ${m.phantom}; scratches ${p(m.scratchesSeen, m.scratches)}; shots missed ${m.shotsMissed}, false ${m.falseShots}; confidently wrong ${m.confidentlyWrong}; racks complete ${m.racksComplete}/${m.racks}`);
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
