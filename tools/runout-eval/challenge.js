// Challenge layouts: each planner's first recommendation, the alternatives it weighed, and a check against the
// expected answer written into the layout file before scoring (planner-free; see find-layouts.js).
//   node tools/runout-eval/challenge.js data/layouts/challenge/*.json > report.md
'use strict';
const fs = require('fs'), core = require('../../src/core.js'), ST = require('../../src/state.js'), S = require('../../src/search.js');
const { pockets } = require('./find-layouts.js');
const PN = ['bottom-left corner', 'bottom side', 'bottom-right corner', 'top-left corner', 'top side', 'top-right corner'];
const pct = v => v == null ? '–' : Math.round(v * 100) + '%';
const recOld = s => S.recommendBaseline(s), recNew = (s, budget) => S.recommend(s, { budget });
function nominal(s, shot) { const P = ST.physicsOf(s), b = s.balls.filter(x => x.status === 'on'), r = core.simulate(b, shot, P); return { r, left: r.final.filter(x => !r.pocketed.some(p => p.id === x.id)) }; }
function check(L, s, rec, plannerName) {
  const E = L.expected, off = rec.offense || {};
  if (E.type === 'pocket') return { pass: rec.pick === 'offense' && off.pocket === E.pocket, got: rec.pick === 'offense' ? `the ${off.target} in the ${PN[off.pocket]}` : rec.pick };
  if (E.type === 'safety') return { pass: rec.pick === 'safety', got: rec.pick === 'safety' ? 'safety' : `pot the ${off.target} in the ${PN[off.pocket]} (model make ${pct(off.make)})` };
  if (E.type === 'endgame') {
    if (rec.pick !== 'offense') return { pass: false, got: rec.pick };
    const n = nominal(s, rec.shot); if (!n.r.pocketed.some(p => p.id === E.ball)) return { pass: false, got: 'nominal shot misses' };
    const ps = pockets(n.left, E.ball + 1), ok = ps.some(p => p.make >= 0.6 && p.shots.some(x => x.q === 3 && (() => { const nine = pockets(x.left, 9); return nine.length >= 0; })()));
    // the property: some makeable (>= 60%) plain shot on the 8 leaves the 9 green
    let good = false; for (const p of ps) if (p.make >= 0.6) for (const x of p.shots) { const lf = x.left, cue = lf.find(b => b.id === 0); if (lf.some(b => b.id === 9) && S.posGrade(lf, cue.x, cue.y, ST.physicsOf(s)).q === 3) good = true; }
    return { pass: good, got: `the 7 in the ${PN[off.pocket]}; afterwards ${good ? 'a makeable shot on the 8 leaves the 9 green' : 'no makeable plain shot on the 8 leaves the 9 green'}` };
  }
  if (E.type === 'replan') {
    if (rec.pick !== 'offense') return { pass: false, got: rec.pick };
    const n = nominal(s, rec.shot), ft = L.ft || 9;
    const sNom = ST.manualState(n.left.map(b => [b.id, b.x, b.y]), { ft });
    const sErr = ST.manualState(n.left.map(b => b.id === 0 ? [0, ...E.error.cue] : [b.id, b.x, b.y]), { ft });
    const a = plannerName === 'old' ? recOld(sNom) : recNew(sNom), b = plannerName === 'old' ? recOld(sErr) : recNew(sErr);
    const pa = a.offense ? a.offense.pocket : a.pick, pb = b.offense && b.pick === 'offense' ? b.offense.pocket : b.pick;
    return { pass: pb === E.pocketAfterError, got: `the 2: ${typeof pa === 'number' ? PN[pa] : pa} from the predicted spot, ${typeof pb === 'number' ? PN[pb] : pb} after the error` };
  }
}
const out = ['# Challenge layouts: old vs new planner', '', 'Model results only (V1.8.1 physics, not checked against real shots). Make shares are model numbers from noisy repeats, not player make rates.', ''];
const summary = [];
for (const f of process.argv.slice(2)) {
  const L = JSON.parse(fs.readFileSync(f, 'utf8')), s = ST.manualState(L.balls, { ft: L.ft || 9 });
  out.push(`## ${L.name}`, '', `Expected (written before scoring): ${L.expected.why}`, '');
  const o = recOld(s), n = recNew(s), co = check(L, s, o, 'old'), cn = check(L, s, n, 'new');
  out.push(`| Planner | Recommendation | Matches expected | Time |`, `|---|---|---|---|`,
           `| old (one shot ahead) | ${co.got} | ${co.pass ? 'yes' : 'no'} | ${o.ms} ms |`,
           `| new (search) | ${cn.got} | ${cn.pass ? 'yes' : 'no'} | ${n.ms} ms, ${n.sims} simulations |`, '');
  out.push(`New planner's reasoning: ${n.why}.`, '', '| Alternative | Strength | Follow(+)/draw(−) | Cut | Cue→ball | Ball→pocket | Model make (screen / final) | Next shot playable | Future | Value |', '|---|---|---|---|---|---|---|---|---|---|');
  for (const a of n.alternatives || []) out.push(`| the ${a.target} → ${PN[a.pocket]}${a.from === 'planGen' ? ' (V1 planGen)' : ''} | ${a.strength} | ${a.follow} | ${a.cut}° | ${a.cueToBall}" | ${a.ballToPocket}" | ${pct(a.screenMake)} / ${pct(a.make)} | ${pct(a.landingPlayable)} | ${a.future == null ? '–' : a.future.toFixed(2)} | ${a.value == null ? '–' : a.value.toFixed(2)} |`);
  if (n.safety) out.push('', `Best safety (heuristic, reported separately): strength ${n.safety.strength}, legal in ${pct(n.safety.pLegal)} of noisy repeats, quality ${pct(n.safety.quality)} (1 − opponent's easiest pot, V1 bestEase).`);
  out.push('');
  summary.push({ layout: L.name, old: co, new: cn, newMs: n.ms, newSims: n.sims, oldMs: o.ms });
}
out.push('## Summary', '', '| Layout | Old matches | New matches |', '|---|---|---|', ...summary.map(x => `| ${x.layout} | ${x.old.pass ? 'yes' : 'no'} | ${x.new.pass ? 'yes' : 'no'} |`));
console.log(out.join('\n'));
fs.writeFileSync(process.env.CHALLENGE_JSON || '/dev/null', JSON.stringify(summary));
