// node score.js <session> <truth> -> prints JSON lines per (set, variant)
const path = require('path'), fs = require('fs'), { execFileSync } = require('child_process');
const R = '/home/claude/Chaulkline', { trackMeasures, score } = require(R + '/tools/experiments/compare.js');
const [s, truth, frozen] = process.argv.slice(2), F = '/tmp/claude-0/fr';
const sets = { frozen30: frozen, re30: `${F}/d30/${s}`, re30b: `${F}/d30b/${s}`, re60: `${F}/d60/${s}`, re15: `${F}/d15/${s}`, re15b: `${F}/d15b/${s}` };
const V = { 'v0.5': {}, hits: { 15: { confirmHits: 3 }, 60: { confirmHits: 10 } }, votes: { 15: { minVotes: 5 }, 60: { minVotes: 20 } } };
const out = [];
for (const [set, dir] of Object.entries(sets)) for (const [v, per] of Object.entries(V)) {
  const fps = +set.replace(/\D/g, '').slice(-2); if (v !== 'v0.5' && !per[fps]) continue;
  const o = { version: 'v0.5', ...(v === 'v0.5' ? {} : per[fps]) };
  const tf = `${F}/pm-tmp.json`; execFileSync('node', [R + '/tools/experiments/product-metrics.js', JSON.stringify(o), `${dir}:${truth}`, '--out', tf]);
  const pm = JSON.parse(fs.readFileSync(tf, 'utf8'))[0];
  out.push({ s, set, v, ...trackMeasures(dir, o, truth), ...score(dir, truth, o), pm });
  console.error(s, set, v, 'endRight', pm.endRight + '/' + pm.shots);
}
fs.writeFileSync(`${F}/score-${s}.json`, JSON.stringify(out, null, 1));
