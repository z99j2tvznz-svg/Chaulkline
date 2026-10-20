// Settled-table check (read-only): on clips whose truth gives the layout (which balls are on the table) and where
// nothing moves, look at the first and last second exactly as the scorer's still-table check does (reconcile.observe)
// and count, per table: layout balls named, balls missing (no spot), balls on a spot but unnamed, wrong numbers (a
// number not in the layout), extra spots. A table is fully right when every layout ball is named and nothing is extra
// or wrong. Positions are not checked here (no measured positions exist).
//   node tools/experiments/still-table.js <dets dir>:<truth json> [...]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { observe } = require('../reconcile.js');
const tot = { tables: 0, fullyRight: 0, balls: 0, named: 0, unnamed: 0, missing: 0, wrong: 0, extra: 0 }, rows = [];
for (const pair of process.argv.slice(2)) {
  const [dir, truth] = pair.split(':'), T = JSON.parse(fs.readFileSync(truth, 'utf8')).clips;
  for (const [clip, v] of Object.entries(T)) {
    if (v.shot || !v.layout || !v.layout.length) continue;
    const f = path.join(dir, clip + '.json'); if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, 'utf8')), end = d.frames[d.frames.length - 1].t;
    for (const [look, fr] of [['first', d.frames.filter(x => x.t <= 1)], ['last', d.frames.filter(x => x.t >= end - 1)]]) {
      const o = observe(fr), lay = new Set(v.layout), nums = o.balls.filter(b => b.num != null).map(b => b.num);
      const named = nums.filter(n => lay.has(n)).length, wrong = nums.filter(n => !lay.has(n)), unnamed = o.unnamed;
      const spots = o.balls.length, missing = Math.max(0, v.layout.length - spots), extra = Math.max(0, spots - v.layout.length);
      const ok = named === v.layout.length && !wrong.length && !extra;
      tot.tables++; tot.fullyRight += ok; tot.balls += v.layout.length; tot.named += named; tot.unnamed += Math.min(unnamed, v.layout.length - named); tot.missing += missing; tot.wrong += wrong.length; tot.extra += extra;
      rows.push(`${path.basename(truth, '.json')} ${clip} ${v.step} ${look}: ${named}/${v.layout.length} named, ${unnamed} unnamed, ${missing} missing, wrong ${JSON.stringify(wrong)}, extra ${extra}${ok ? '  RIGHT' : ''}`);
    }
  }
}
console.log(rows.join('\n')); console.log(JSON.stringify(tot));
