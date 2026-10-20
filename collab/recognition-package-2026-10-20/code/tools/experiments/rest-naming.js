// Naming balls at rest (read-only diagnostic): every settled-table look the rack scorer takes (before each shot, and
// the last second when it is settled), compared with the true table where the truth file knows it. Each true ball on
// the table falls in one category:
//   named      - named right
//   unnamed    - detected, but left without a number (1a: kept as a ball, reader not sure or the number taken by a
//                surer spot; 1b: dropped from the look because the reader called it not a ball or it was seen too briefly)
//   wrong      - another number was given (a number that is not on the table was named in this look)
//   undetected - nothing in the look could be it (not found, thrown away by the cushion or pocket rule, hidden, or
//                merged into a touching ball)
// and every look is checked for extra names (a number named that is not on the table while every true ball is named).
// Truth has no ball positions. A missing ball is matched to a spot by the reader's own votes for its number, then by
// where it was named in the other look of the same clip (still balls stay put); otherwise only its category is known.
// Conditions per ball (where its spot is known): near a cushion (frozen on a rail), touching another ball (cluster),
// far third of the table; per look: session (camera spot), recorder step (lighting changes), cue ball confusion.
//   node tools/experiments/rest-naming.js '<tracker options>' <dets>:<truth> [...] [--obs '<observe options>'] [--every k:j] [--out file.json]
// --every k:j uses every k-th frame of each look from offset j (an alternate frame-sampling check).
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { makeTracker } = require('../tracker.js');
const { observe, OBS, BALLS } = require('../reconcile.js');

const argv = process.argv.slice(2), take = k => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : null; };
const OUT = take('--out'), OBS_OPTS = JSON.parse(take('--obs') || '{}'), EVERY = (take('--every') || '1:0').split(':').map(Number);
const [OPTS, ...specs] = argv, TRACK_OPTS = JSON.parse(OPTS);
const T0 = 1.5, T1 = 0.2, LOOK = 1.0;   // the scorer's look windows (score-racks.js)
const RAIL = 1.6, TOUCH = 2.8, NEAR = 1.5;
const yes = v => typeof v === 'string' && v.startsWith('yes');

// observe() with its intermediate groups kept, so dropped spots and reader votes can be inspected. The kept balls and
// their numbers are observe() itself (checked below).
function groupsOf(frames, o) {
  const groups = [];
  for (const fr of frames) for (const b of fr.balls) {
    let g = null, gd = o.group;
    for (const c of groups) { const d = Math.hypot(b.x - c.x, b.y - c.y); if (d < gd) { gd = d; g = c; } }
    if (!g) { g = { x: b.x, y: b.y, n: 0, frames: new Set(), nb: 0, nbN: 0, score: new Array(10).fill(0) }; groups.push(g); }
    g.x = (g.x * g.n + b.x) / (g.n + 1); g.y = (g.y * g.n + b.y) / (g.n + 1); g.n++; g.frames.add(fr.t);
    if (b.nb != null) { g.nb += b.nb; g.nbN++; }
    if (b.rec != null && b.p != null && b.p >= o.p && b.nb != null && b.nb < o.nb) g.score[b.rec] += b.p;
  }
  return groups.map(g => ({ x: g.x, y: g.y, share: g.frames.size / frames.length, nb: g.nbN ? g.nb / g.nbN : 0, score: g.score }));
}

function lookOf(frames, table, rej) {
  const o = { ...OBS, ...OBS_OPTS }, saved = { ...OBS };
  Object.assign(OBS, o); const obs = observe(frames); Object.assign(OBS, saved);
  const [L, W] = table, gs = groupsOf(frames, o);
  const dropped = gs.filter(g => !(g.share >= o.share && g.nb < o.nb)).filter(g => g.share >= 0.2)
    .map(g => ({ x: g.x, y: g.y, why: g.nb >= o.nb ? 'reader says not a ball' : 'seen too briefly', score: g.score }));
  const kept = obs.balls.map(b => ({ ...b, score: (gs.find(g => Math.hypot(g.x - b.x, g.y - b.y) < 0.15) || {}).score || new Array(10).fill(0) }));
  const where = (x, y, all) => ({ rail: Math.min(x, L - x, y, W - y) < RAIL, cluster: all.some(o2 => (o2.x !== x || o2.y !== y) && Math.hypot(o2.x - x, o2.y - y) < TOUCH), far: y > W * 2 / 3 });
  // with --rejected detections: spots the cushion or pocket rule threw away, seen on at least half the look's frames
  const thrown = rej ? groupsOf(rej, { ...o, nb: 2 }).filter(g => g.share >= o.share).filter(g => !kept.concat(dropped).some(k => Math.hypot(k.x - g.x, k.y - g.y) < 2))
    .map(g => ({ x: +g.x.toFixed(1), y: +g.y.toFixed(1), why: g.why })) : null;
  return { obs, kept, dropped, thrown, where: (x, y) => where(x, y, kept.concat(dropped)) };
}

function runClip(d, T, R) {
  const frames0 = T.settleEnd != null ? d.frames.filter(fr => fr.t <= T.settleEnd) : d.frames;
  const tr = makeTracker(d.table, TRACK_OPTS), moving = [];
  for (const fr of frames0) { tr.step(fr); moving.push(tr.moving()); }
  const r = tr.finish(), end = frames0[frames0.length - 1].t, shotT = r.shots.length ? r.shots[0].t : null;
  // alternate frame sampling: every k-th frame of each look, from offset j
  const pick = idx => idx.filter((i, n) => n % EVERY[0] === EVERY[1]);
  const bi = pick(frames0.map((f, i) => i).filter(i => shotT != null ? frames0[i].t >= shotT - T0 && frames0[i].t <= shotT - T1 : frames0[i].t <= LOOK));
  const ai = frames0.map((f, i) => i).filter(i => frames0[i].t >= end - LOOK);
  const rj = idx => R ? idx.map(i => ({ t: frames0[i].t, balls: R[i] || [] })) : null;
  return { before: bi.length >= 5 / EVERY[0] ? lookOf(bi.map(i => frames0[i]), d.table, rj(bi)) : null, after: lookOf(pick(ai).map(i => frames0[i]), d.table, rj(pick(ai))), settled: !ai.some(i => moving[i]) };
}

// one look against its true table: per-ball categories and conditions
function judge(look, truthOn, unsure, other, ctx) {
  const on = [...truthOn].filter(n => !unsure.has(n)), rows = [];
  const named = look.obs.named, wrongG = look.kept.filter(b => b.num != null && !truthOn.has(b.num) && !unsure.has(b.num));
  const pool = [...wrongG.map(g => ({ g, cat: 'wrong' })), ...look.kept.filter(b => b.num == null).map(g => ({ g, cat: b => b.dupOf != null ? 'unnamed (number taken by a surer spot)' : 'unnamed (reader not sure)' })),
    ...look.dropped.map(g => ({ g, cat: 'unnamed (' + g.why + ')' }))];
  const missing = on.filter(n => !named[n]);
  for (const n of on.filter(n => named[n])) rows.push({ ...ctx, ball: n, cat: 'named', ...look.where(named[n].x, named[n].y) });
  // match missing balls to spots: the reader's votes for that number, then where the other look named it
  const used = new Set(), match = {};
  const best = (n, f) => pool.filter(p => !used.has(p)).map(p => [p, f(p)]).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1])[0];
  for (const n of missing) { const b = best(n, p => p.g.score[n] > 0 ? -p.g.score[n] : null); if (b) { match[n] = b[0]; used.add(b[0]); } }
  for (const n of missing.filter(n => !match[n])) { const o = other && other.obs.named[n]; if (!o) continue;
    const b = best(n, p => { const d = Math.hypot(p.g.x - o.x, p.g.y - o.y); return d < NEAR ? d : null; }); if (b) { match[n] = b[0]; used.add(b[0]); } }
  // the rest by count: wrong names first (a misread ball), then unnamed spots, then nothing
  const left = pool.filter(p => !used.has(p));
  for (const n of missing) {
    let p = match[n], how = p ? 'matched' : 'by count';
    if (!p) { p = left.find(q => q.cat === 'wrong') || left.find(q => typeof q.cat === 'function') || left[0]; if (p) left.splice(left.indexOf(p), 1); }
    const o = other && other.obs.named[n], pos = p ? p.g : o || null;
    let cat = !p ? 'undetected' : typeof p.cat === 'function' ? p.cat(p.g) : p.cat;
    const r = { ...ctx, ball: n, cat, how, ...(pos ? look.where(pos.x, pos.y) : { rail: null, cluster: null, far: null }) };
    if (cat === 'wrong') r.readAs = p.g.num;
    if (p && cat !== 'wrong') { const top = BALLS.slice().sort((a, b) => p.g.score[b] - p.g.score[a]); r.votes = { top: top[0], topScore: +p.g.score[top[0]].toFixed(1), second: top[1], secondScore: +p.g.score[top[1]].toFixed(1), own: +p.g.score[n].toFixed(1) }; }
    if (!p && pos) r.undetectedWhere = 'last named at ' + pos.x.toFixed(1) + ',' + pos.y.toFixed(1);
    r.cueConfusion = (n === 9 || n === 1) && ((cat === 'wrong' && r.readAs === 0) || (r.votes && r.votes.top === 0));
    rows.push(r);
  }
  // extra names: numbers not on the table, beyond the misreads already counted against a missing ball
  const extra = Math.max(0, wrongG.length - missing.length);
  return { rows, extra, extraNums: wrongG.map(g => g.num), N: on.length, D: look.kept.length };
}

const res = { opts: TRACK_OPTS, obs: OBS_OPTS, every: EVERY, sessions: [] };
for (const spec of specs) {
  const [dir, truth] = spec.split(':'), TJ = JSON.parse(fs.readFileSync(truth, 'utf8')), session = path.basename(truth, '.json');
  const racks = TJ.racks || Object.keys(TJ.clips).sort().map(c => ({ clips: [c], start: TJ.clips[c].layout && TJ.clips[c].layout.length ? TJ.clips[c].layout : null, scripted: true }));
  const S = { session, looks: [], rows: [] };
  for (const rack of racks) {
    let inv = new Set(rack.start || []);
    for (const c of rack.clips) {
      const T = TJ.clips[c] || {}, f = path.join(dir, c + '.json');
      for (const b of T.offCameraBefore || []) inv.delete(b);
      if (!inv.has(0) && rack.start && rack.start.includes(0)) inv.add(0);
      const before = new Set(inv), made = (T.made || []).concat(T.madeAfterClip || []), unsure = new Set(T.unsureBalls || []);
      for (const b of made) inv.delete(b);
      const after = new Set(inv);
      // the true table is known on verified rack clips, and on recorder clips from the scripted layout
      const known = !!rack.start && (rack.scripted || yes(T.verify && T.verify.state));
      if (!known || !fs.existsSync(f)) continue;
      const rf = path.join(dir, c + '-rejected.json'), d = JSON.parse(fs.readFileSync(f, 'utf8')), run = runClip(d, T, fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : null), ctx = { clip: c, step: T.step || null };
      if (run.before) { const j = judge(run.before, before, unsure, run.after, { ...ctx, look: 'start' }); S.rows.push(...j.rows); S.looks.push({ clip: c, look: 'start', thrown: run.before.thrown, N: j.N, D: j.D, extra: j.extra, extraNums: j.extraNums, step: ctx.step, right: j.rows.every(r => r.cat === 'named') && !j.extra }); }
      if (run.settled) { const j = judge(run.after, after, unsure, run.before, { ...ctx, look: 'end' }); S.rows.push(...j.rows); S.looks.push({ clip: c, look: 'end', thrown: run.after.thrown, N: j.N, D: j.D, extra: j.extra, extraNums: j.extraNums, step: ctx.step, right: j.rows.every(r => r.cat === 'named') && !j.extra }); }
      else S.looks.push({ clip: c, look: 'end', unsettled: true, step: ctx.step });
    }
  }
  res.sessions.push(S);
}

// summary: per session and look, categories and conditions
const lines = [];
for (const S of res.sessions) for (const look of ['start', 'end']) {
  const R = S.rows.filter(r => r.look === look), L = S.looks.filter(l => l.look === look), cnt = f => R.filter(f).length;
  const cats = {}; for (const r of R) cats[r.cat] = (cats[r.cat] || 0) + 1;
  lines.push(`${S.session} ${look}: looks ${L.filter(l => !l.unsettled).length}${L.some(l => l.unsettled) ? ` (+${L.filter(l => l.unsettled).length} unsettled)` : ''}, whole table right ${L.filter(l => l.right).length}; balls ${R.length}: ` +
    Object.entries(cats).map(([k, v]) => `${k} ${v}`).join(', ') + `; extra names ${L.reduce((a, l) => a + (l.extra || 0), 0)}; failing balls near rail ${cnt(r => r.cat !== 'named' && r.rail)}, in cluster ${cnt(r => r.cat !== 'named' && r.cluster)}, far third ${cnt(r => r.cat !== 'named' && r.far)}, cue confusion ${cnt(r => r.cueConfusion)}`);
}
console.log(lines.join('\n'));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
