// Summarise evaluator results: outcomes per layout x table condition x planner, and the paired old-vs-new difference
// in completed racks (same trials, same error seeds), flagged "too close" when it is within 2 standard errors.
//   node tools/runout-eval/summary.js results.json [more.json ...]
'use strict';
const fs = require('fs');
const R = process.argv.slice(2).flatMap(f => JSON.parse(fs.readFileSync(f, 'utf8')).results);
const OUT = ['completed', 'missed', 'foul', 'safety', 'safety foul', 'no shot', 'step limit', 'error'];
const key = r => r.file + '|' + r.v, groups = new Map();
for (const r of R) { if (!groups.has(key(r))) groups.set(key(r), []); groups.get(key(r)).push(r); }
const lines = ['| Layout | Table | Planner | Trials | Completed | Missed | Fouls | Safety chosen | No shot (hooked) | Avg plan time | Sims per plan |', '|---|---|---|---|---|---|---|---|---|---|---|'];
const diffs = ['| Layout | Table | Completed old → new | Paired difference | Verdict |', '|---|---|---|---|---|'];
for (const [k, rs] of groups) {
  const [file, v] = k.split('|');
  for (const pl of ['old', 'new']) {
    const x = rs.filter(r => r.planner === pl); if (!x.length) continue;
    const c = o => x.filter(r => r.res.out === o).length, shots = x.reduce((a, r) => a + r.res.shots, 0);
    lines.push(`| ${file.replace('.json', '')} | ${v} | ${pl} | ${x.length} | ${c('completed')} (${Math.round(100 * c('completed') / x.length)}%) | ${c('missed')} | ${c('foul') + c('safety foul')} | ${c('safety')} | ${c('no shot')} | ${(x.reduce((a, r) => a + r.res.ms, 0) / shots / 1000).toFixed(1)} s | ${pl === 'new' ? Math.round(x.reduce((a, r) => a + r.res.sims, 0) / shots) : '–'} |`);
  }
  const byT = new Map(); for (const r of rs) { if (!byT.has(r.t)) byT.set(r.t, {}); byT.get(r.t)[r.planner] = r.res.out === 'completed' ? 1 : 0; }
  const d = [...byT.values()].filter(p => 'old' in p && 'new' in p).map(p => p.new - p.old), n = d.length;
  if (!n) continue;
  const m = d.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, n - 1)), se = sd / Math.sqrt(n);
  const o = [...byT.values()].reduce((a, p) => a + (p.old || 0), 0), nw = [...byT.values()].reduce((a, p) => a + (p.new || 0), 0);
  diffs.push(`| ${file.replace('.json', '')} | ${v} | ${o} → ${nw} of ${n} | ${m >= 0 ? '+' : ''}${(100 * m).toFixed(0)} points ± ${(200 * se).toFixed(0)} | ${Math.abs(m) < 2 * se || se === 0 && m === 0 ? 'too close' : m > 0 ? 'new better' : 'new worse'} |`);
}
console.log(lines.join('\n') + '\n\n' + diffs.join('\n'));
