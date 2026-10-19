// Independent evaluator: play layouts with each planner, shot by shot, with execution errors, replanning after every
// shot. The table can follow physics the planners do not know (changed cloth, cushions, throw, stroke error).
// Both planners get the same layouts, physics and per-shot error seeds.
//   node tools/runout-eval/eval.js --layouts a.json,b.json --trials 50 --variants std,cloth,throw,stroke
//        [--planners old,new] [--budget server|phone] [--workers 4] [--out results.json]
'use strict';
const fs = require('fs'), path = require('path'), { fork } = require('child_process');
const core = require('../../src/core.js'), ST = require('../../src/state.js'), S = require('../../src/search.js');

// Table and stroke conditions used only to execute shots. The planners always plan with the standard model.
const VARIANTS = {
  std:    { phys: {}, noise: S.NOISE, about: 'the planners\' own physics and stroke-error model' },
  cloth:  { phys: { muS: 0.16, rollDec: 5.5, eRail: 0.64 }, noise: S.NOISE, about: 'slower cloth, less slide friction, deader cushions' },
  throw:  { phys: { muBall: 0.10, squirt: 0.07, eBall: 0.92 }, noise: S.NOISE, about: 'more throw and squirt, less lively balls' },
  stroke: { phys: {}, noise: { aimDeg: 0.6, speed: 0.12, speedPerLevel: 0.015, spin: 0.08, spinPer: 0.15, sideAim: 0.7 }, about: 'bigger stroke errors than the planners assume' },
};
const hash = (...v) => { let h = 2166136261; for (const x of v) for (const ch of String(x)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// Separate balls the physics left a hair apart less than a ball width, so the next state is valid.
function settle(balls, R) {
  for (let k = 0; k < 5; k++) for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
    const a = balls[i], b = balls[j], d = Math.hypot(a.x - b.x, a.y - b.y);
    if (d < 2 * R) { const nx = (b.x - a.x) / (d || 1), ny = (b.y - a.y) / (d || 1), m = (2 * R - d) / 2 + 0.001; a.x -= nx * m; a.y -= ny * m; b.x += nx * m; b.y += ny * m; }
  }
  return balls;
}

function playTrial(layout, li, plannerName, vname, t, budget) {
  const V = VARIANTS[vname], ft = layout.ft || 9, Pv = core.makeP(ft, V.phys);
  let balls = layout.balls.map(([id, x, y]) => ({ id, x, y })), shots = 0, made = 0, ms = 0, sims = 0;
  for (let k = 0; k < 12; k++) {
    const s = ST.manualState(balls.map(b => [b.id, b.x, b.y]), { ft });
    const t0 = Date.now(), rec = plannerName === 'old' ? S.recommendBaseline(s) : S.recommend(s, { budget });
    ms += Date.now() - t0; sims += rec.sims || 0; shots++;
    if (rec.error) return { out: 'error', error: rec.error, shots, made, ms, sims };
    if (rec.pick === 'none') return { out: 'no shot', shots, made, ms, sims };
    const r = S.rng(hash(li, vname, t, k)), shot = S.noisy(rec.shot, r, V.noise);
    const res = core.simulate(balls, shot, Pv), low = Math.min(...balls.filter(b => b.id > 0).map(b => b.id));
    const pots = res.pocketed.map(p => p.id), foul = pots.includes(0) || res.firstHit !== low || (!pots.length && !res.railAfter);
    if (rec.pick === 'safety') return { out: foul ? 'safety foul' : 'safety', shots, made, ms, sims };
    if (foul) return { out: 'foul', shots, made, ms, sims, why: pots.includes(0) ? 'scratch' : res.firstHit !== low ? 'wrong ball first' : 'no rail' };
    if (!pots.length) return { out: 'missed', shots, made, ms, sims };
    made += pots.length;
    if (pots.includes(9)) return { out: 'completed', shots, made, ms, sims };
    balls = settle(res.final.filter(b => !pots.includes(b.id)).map(b => ({ id: b.id, x: Math.min(Pv.L - Pv.R, Math.max(Pv.R, b.x)), y: Math.min(Pv.W - Pv.R, Math.max(Pv.R, b.y)) })), Pv.R);
  }
  return { out: 'step limit', shots, made, ms, sims };
}

if (process.argv[2] === '--worker') {   // child: run the jobs it is sent
  process.on('message', m => { if (m === 'end') return process.exit(0); const { layout, li, planner, v, t, budget } = m; process.send({ ...m, layout: undefined, res: playTrial(layout, li, planner, v, t, budget) }); });
} else {
  const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
  const files = (arg('layouts') || '').split(',').filter(Boolean), trials = +(arg('trials') || 50), from = +(arg('from') || 0);
  const variants = (arg('variants') || 'std,cloth,throw,stroke').split(','), planners = (arg('planners') || 'old,new').split(',');
  const budget = arg('budget') || 'server', workers = +(arg('workers') || 4), out = arg('out') || 'eval-results.json';
  const layouts = files.map(f => ({ file: path.basename(f), ...JSON.parse(fs.readFileSync(f, 'utf8')) }));
  const jobs = []; layouts.forEach((L, li) => { for (const v of variants) for (let t = from; t < from + trials; t++) for (const planner of planners) jobs.push({ layout: L, li: hash(L.file), file: L.file, planner, v, t, budget }); });
  const results = []; let next = 0, live = 0; const t0 = Date.now();
  const done = () => {
    fs.writeFileSync(out, JSON.stringify({ trials, from, variants, planners, budget, layouts: layouts.map(l => l.file), results }, null, 0));
    console.log(`${results.length} trials in ${((Date.now() - t0) / 60000).toFixed(1)} min -> ${out}`);
  };
  for (let w = 0; w < Math.min(workers, jobs.length); w++) {
    const c = fork(__filename, ['--worker']); live++;
    const feed = () => { if (next < jobs.length) c.send(jobs[next++]); else c.send('end'); };
    c.on('message', m => { results.push(m); if (results.length % 50 === 0) console.log(`${results.length}/${jobs.length}`); feed(); });
    c.on('exit', () => { if (--live === 0) done(); });
    feed();
  }
}
module.exports = { VARIANTS, playTrial };
