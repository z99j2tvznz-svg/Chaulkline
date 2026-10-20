// Rack scorer for the offline baseline. Rules: docs/baseline-rules.md (written before any run).
// Runs the existing tracker (tools/tracker.js, default settings) and the settled-table check (tools/reconcile.js) on
// each clip's finder output (tools/clip-detect.js), rack by rack, and scores the result against the hand-checked truth.
//
//   node tools/score-racks.js <detections folder> <truth json> [--out report.json] [--v] [--diag] [--oracle obs|pockets|both]
//
// --diag adds diagnostics (docs/diagnostics.md): finder errors split into detection and naming, shot-finding rates,
// clips with and without a still final look, and a what-if pocket rule. They do not change any baseline number.
// --oracle feeds verified truth into one stage (ORACLE-ASSISTED DIAGNOSTIC, never product performance): obs = the
// still-table looks are replaced by the verified inventory (only where truth can verify it), pockets = the tracker's
// pocket events are replaced by the verified made balls, both = both. Everything else runs as normal.
//
// Two runs per session, reported apart: "continuous" (memory carried clip to clip, as a player would get it) and
// "checkpoint" (memory set from truth before each clip, for finding which part fails; the tracker never sees truth).
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { execSync } = require('node:child_process');
const { makeTracker, TRACK_DEFAULTS } = require('./tracker.js');
const { observe, reconcile, newMemory, BALLS } = require('./reconcile.js');

const argv = process.argv.slice(2), VERBOSE = argv.includes('--v');
const oIx = argv.indexOf('--out'), OUT = oIx >= 0 ? argv.splice(oIx, 2)[1] : null;
const kIx = argv.indexOf('--track'), TRACK_OPTS = kIx >= 0 ? JSON.parse(argv.splice(kIx, 2)[1]) : {}; // tracker experiment options
// experiment option absence (off by default, not part of any tracker version): the settled-table check may also confirm a
// pocket from absence plus the ball count (reconcile.js, ABSENCE). It is a settled-table option, so the tracker never sees it.
const ABS = !!TRACK_OPTS.absence; delete TRACK_OPTS.absence;
const qIx = argv.indexOf('--oracle'), ORACLE = qIx >= 0 ? argv.splice(qIx, 2)[1] : null, DIAG = argv.includes('--diag');
if (ORACLE && !['obs', 'pockets', 'both'].includes(ORACLE)) throw new Error('--oracle obs|pockets|both');
const O_OBS = ORACLE === 'obs' || ORACLE === 'both', O_POCK = ORACLE === 'pockets' || ORACLE === 'both';
const [DET, TRUTH] = argv.filter(a => !a.startsWith('--'));
const TJ = JSON.parse(fs.readFileSync(TRUTH, 'utf8'));

// the racks: from the truth file, or (recorder sessions) one clip per "rack" starting from its scripted layout
const racks = TJ.racks || Object.keys(TJ.clips).sort().map(c => ({ name: c, clips: [c], start: TJ.clips[c].layout && TJ.clips[c].layout.length ? TJ.clips[c].layout : null }));

const T0 = 1.5, T1 = 0.2, LOOK = 1.0, AT_TOL = 1.5;
const yes = v => typeof v === 'string' && v.startsWith('yes');

function runClip(clip, T) {
  const f = path.join(DET, clip + '.json'); if (!fs.existsSync(f)) return null;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const frames = T.settleEnd != null ? d.frames.filter(fr => fr.t <= T.settleEnd) : d.frames;
  // experiment option oneCue: 'play' applies the one-cue-ball rule only to game play: rack sessions (no step) and play steps
  const opts = TRACK_OPTS.oneCue === 'play' ? { ...TRACK_OPTS, oneCue: !T.step || /^play/.test(T.step) } : TRACK_OPTS;
  const tr = makeTracker(d.table, opts), movingAt = [];
  for (const fr of frames) { tr.step(fr); movingAt.push(tr.moving()); }
  const r = tr.finish(), end = frames[frames.length - 1].t;
  const shotT = r.shots.length ? r.shots[0].t : null;
  const beforeFr = shotT != null ? frames.filter(fr => fr.t >= shotT - T0 && fr.t <= shotT - T1) : frames.filter(fr => fr.t <= LOOK);
  const ai = frames.map((fr, i) => i).filter(i => frames[i].t >= end - LOOK);
  const before = beforeFr.length >= 5 ? observe(beforeFr) : null;
  const after = observe(ai.map(i => frames[i])); after.settled = !ai.some(i => movingAt[i]);
  // the tracker's pocket events, with the ball's last seen spot and whether that is inside a pocket mouth
  const [L, W] = d.table, pockets = [[0, 0], [L / 2, -0.6], [L, 0], [0, W], [L / 2, W + 0.6], [L, W]];
  const pev = r.events.filter(e => e.k === 'pocket').map(e => {
    const t = r.tracks.find(x => x.id === e.track) || {}, x = t.x, y = t.y;
    const inMouth = x != null && pockets.some(p => Math.hypot(x - p[0], y - p[1]) < TRACK_DEFAULTS.pocketDist);
    return { ball: t.ball ?? e.ball ?? null, x, y, t: +e.t.toFixed(2), jaws: !!e.jaws, inMouth };
  });
  // absence experiment: did a ball start from this spot and roll away? (a path that passed within MOVE_FROM of the spot
  // and later ended up at least MOVE_AWAY from it, on a track that moved). A ball that only went out of view does not.
  const movedFrom = (x, y) => tr.tracks.some(k => k.real && k.movedAt != null && k.path.some(([, px, py]) => Math.hypot(px - x, py - y) < MOVE_FROM)
    && Math.hypot(k.x - x, k.y - y) >= MOVE_AWAY);
  return { r, before, after, pev, shotT, end, movedFrom };
}
const MOVE_FROM = 1.5, MOVE_AWAY = 3;

// oracle inputs (diagnostic only): a still-table look that names exactly the verified balls, and pocket events for
// exactly the verified made balls. Balls the truth cannot tell about are left out of both.
const truthLook = (inv, unsure, settled) => { const nums = [...inv].filter(n => !unsure.has(n)).sort((a, b) => a - b);
  return { frames: 0, balls: nums.map(n => ({ x: null, y: null, num: n, score: null })), named: Object.fromEntries(nums.map(n => [n, { x: null, y: null }])), unnamed: 0, settled, oracle: true }; };
const truthPockets = w => w.made.filter(b => !w.unsure.has(b)).map(b => ({ ball: b, x: null, y: null, t: null, jaws: false, inMouth: true, oracle: true }));

// detection versus naming at one verified still look (truth has no ball positions, so the split is by counts; the
// per-ball answer needs position labels). N balls on the table; the finder's D groups are C named right, Wn named
// with a number that is not on the table, U seen but unnamed. The N - C balls not named right are among Wn, U, or
// not detected at all.
function obsSplit(obs, inv, unsure) {
  const on = [...inv].filter(n => !unsure.has(n)), N = on.length, D = obs.balls.length;
  const C = on.filter(n => obs.named[n]).length, Wn = obs.balls.filter(b => b.num != null && !inv.has(b.num) && !unsure.has(b.num)).length;
  const Wu = obs.balls.filter(b => b.num != null && unsure.has(b.num)).length, U = obs.unnamed, M = N - C;
  return { N, D, C, Wn, U, Wu, M, undetectedAtLeast: Math.max(0, N - (D - Wu)), extraAtLeast: Math.max(0, (D - Wu) - N), unnamedWhileMissing: Math.min(U, M), wrongNumberWhileMissing: Math.min(Wn, M) };
}

// truth inventory through a rack: balls on the table before and after each clip, and balls whose fate is unknown
function truthWalk(rack) {
  let inv = new Set(rack.start || []);
  return rack.clips.map(c => {
    const T = TJ.clips[c] || {};
    for (const b of T.offCameraBefore || []) inv.delete(b);
    if (!inv.has(0) && rack.start && rack.start.includes(0)) inv.add(0); // cue ball back after a scratch (ball in hand)
    const before = new Set(inv), made = (T.made || []).concat(T.madeAfterClip || []), unsure = new Set(T.unsureBalls || []);
    for (const b of made) inv.delete(b);
    const after = new Set(inv);
    return { clip: c, T, before, after, made, unsure, stateOk: !!rack.start && yes(T.verify && T.verify.state) };
  });
}
const truthMemory = inv => ({ balls: Object.fromEntries(BALLS.map(n => [n, { status: inv.has(n) ? 'present' : 'pocketed', why: 'set from truth (checkpoint run)' }])), rack: false });

function scoreClip(w, run, mem, trace) {
  const T = w.T, out = { clip: w.clip, realShot: !!T.shot || !!(T.more && T.more.length), wrong: [], unresolved: [], unverifiable: [] };
  // fact 1: the shot(s)
  const starts = (T.shot ? [T.at ?? null] : []).concat(T.more || []);
  const shots = run.r.shots.map(s => s.t), usedShot = new Set();
  for (const at of starts) {
    const i = shots.findIndex((t, k) => !usedShot.has(k) && (at == null || Math.abs(t - at) < AT_TOL));
    if (i >= 0) usedShot.add(i); else out.wrong.push({ fact: 'shot', what: 'real shot not found' + (at != null ? ' at ' + at + ' s' : '') });
  }
  out.falseShots = shots.length - usedShot.size;
  for (let k = 0; k < out.falseShots; k++) out.wrong.push({ fact: 'shot', what: 'false shot' });
  // fact 2 and 3: which balls left, and the table after
  const sysMade = new Set(trace.confirmed.filter(c => c.change === 'pocketed').map(c => c.ball));
  const truthMade = new Set(w.made.filter(b => !w.unsure.has(b)));
  for (const b of w.unsure) out.unverifiable.push({ fact: 'made', ball: b, why: T.unsureWhy || 'unknown' });
  for (const b of sysMade) if (!w.unsure.has(b) && !truthMade.has(b)) out.wrong.push({ fact: 'made', ball: b, what: 'confirmed pocketed, but it did not go in' });
  for (const b of truthMade) if (!sysMade.has(b)) {
    const st = mem.balls[b] && mem.balls[b].status;
    if (st === 'present') out.wrong.push({ fact: 'made', ball: b, what: 'went in, but the system says it is on the table (seen)' });
    else out.unresolved.push({ fact: 'made', ball: b, what: 'went in; left unresolved (' + (mem.balls[b] ? mem.balls[b].why : 'not tracked') + ')' });
  }
  out.obsErrors = null; out.stateErrors = null;
  if (w.stateOk) {
    out.obsErrors = { missedOrUnnamed: [], namedButGone: [] }; out.stateErrors = [];
    for (const n of BALLS) {
      if (w.unsure.has(n)) continue;
      const on = w.after.has(n), st = mem.balls[n] ? mem.balls[n].status : null, seen = !!run.after.named[n];
      if (on && !seen) out.obsErrors.missedOrUnnamed.push(n);
      if (!on && seen) out.obsErrors.namedButGone.push(n);
      if (truthMade.has(n) || sysMade.has(n)) continue; // already judged under "made"
      if (on && (st === 'pocketed' || st === 'left')) { out.stateErrors.push(n); out.wrong.push({ fact: 'state', ball: n, what: 'on the table, but the system has it gone' }); }
      else if (!on && st === 'present') { out.stateErrors.push(n); out.wrong.push({ fact: 'state', ball: n, what: 'gone, but the system has it on the table (seen)' }); }
      else if (st === 'unconfirmed' || st == null) out.unresolved.push({ fact: 'state', ball: n, what: (on ? 'on the table' : 'gone') + ', left unconfirmed' });
    }
  } else out.unverifiable.push({ fact: 'state', why: (T.verify && T.verify.state) || 'no inventory in the truth' });
  out.result = out.wrong.length ? 'confidently wrong' : out.unresolved.length ? 'unresolved' : 'correct automatically';
  // research number only: first ball hit
  const s0 = run.r.shots[0];
  out.first = T.first != null && s0 ? { truth: T.first, tracker: s0.first ?? null } : null;
  return out;
}

function runRack(rack, mode) {
  const walk = truthWalk(rack), clips = [];
  let mem = newMemory(rack.start || BALLS);
  for (const w of walk) {
    const run = runClip(w.clip, w.T); if (!run) { clips.push({ clip: w.clip, missing: true }); continue; }
    const real = { before: run.before, after: run.after };
    const oObs = O_OBS && w.stateOk, settled = run.after.settled;
    if (oObs) { run.before = truthLook(w.before, w.unsure); run.after = truthLook(w.after, w.unsure, settled); }
    if (O_POCK && yes(w.T.verify && w.T.verify.made)) run.pev = truthPockets(w);
    const traces = [];
    if (mode === 'checkpoint' && w.stateOk && clips.length) mem = truthMemory(w.before);
    if (run.before) { const a = reconcile(mem, run.before, { pockets: [] }, 'before'); mem = a.memory; traces.push(a.trace); }
    const b = reconcile(mem, run.after, { pockets: run.pev, ...(ABS && run.before ? { absence: { before: run.before, movedFrom: run.movedFrom } } : {}) }, 'after'); mem = b.memory; traces.push(b.trace);
    const s = scoreClip(w, run, mem, b.trace);
    s.trace = traces; s.shotsAt = run.r.shots.map(x => +x.t.toFixed(2));
    s.settled = settled; s.seconds = run.end; s.oracleObs = oObs;
    s.shotEvents = (w.T.shot ? 1 : 0) + (w.T.more || []).length;
    if (w.stateOk) s.obsSplit = obsSplit(real.after, w.after, w.unsure);
    // each "named, but gone" ball: what sat at that spot in the before-look (balls that were not hit stay put). The
    // spot of another ball still on the table means a likely misread of that ball. Read as the same gone number in both
    // looks at the same spot: something still sits there and is read wrong every time; a misread of a real ball when a
    // ball on the table is not named (truth has no positions to say which), otherwise a mark. Nothing there before:
    // a ball that moved (cannot tell).
    if (s.obsErrors && real.before) s.goneWhy = s.obsErrors.namedButGone.map(n => {
      const g = real.after.named[n], near = real.before.balls.filter(b => Math.hypot(b.x - g.x, b.y - g.y) < 2).sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y))[0];
      const why = !near ? 'cannot tell (nothing sat there before)' : near.num === n ? ([...w.after].some(j => !w.unsure.has(j) && !real.after.named[j]) ? 'likely a still ball misread the same way every time' : 'likely a mark read as a ball') : near.num != null && w.after.has(near.num) && !real.after.named[near.num] ? 'likely a misread of the ' + near.num : near.num == null ? 'cannot tell (an unnamed ball sat there)' : 'cannot tell';
      return { ball: n, why };
    });
    // what-if pocket rule (evaluated, not used): a ball clearly seen before the shot, gone from a still after-look in
    // which every ball the finder saw was named. Truth says whether that call would have been right.
    if (real.before && settled && real.after.unnamed === 0) s.whatIf = BALLS.filter(n => real.before.named[n] && !real.after.named[n] && !w.unsure.has(n)).map(n => ({ ball: n,
      verdict: w.made.includes(n) ? 'right' : w.stateOk ? (w.after.has(n) ? 'wrong (still on the table)' : 'right (gone)') : yes(w.T.verify && w.T.verify.made) ? 'wrong (did not go in)' : 'cannot tell' }));
    clips.push(s);
  }
  const scored = clips.filter(c => !c.missing), real = scored.filter(c => c.realShot);
  return { rack: rack.name, mode, clips,
    completion: real.length > 0 && real.every(c => c.result === 'correct automatically') && scored.every(c => !c.falseShots),
    integrity: scored.every(c => c.result !== 'confidently wrong'),
    // each open item counts once, when it first becomes open (an item carried from clip to clip is one correction)
    corrections: scored.reduce((a, c, i) => { const prev = new Set(i ? scored[i - 1].unresolved.map(u => u.fact + u.ball) : []); return a + c.unresolved.filter(u => !prev.has(u.fact + u.ball) && !prev.has('state' + u.ball) && !prev.has('made' + u.ball)).length; }, 0) };
}

function totals(results) {
  const all = results.flatMap(r => r.clips.filter(c => !c.missing)), real = all.filter(c => c.realShot), non = all.filter(c => !c.realShot);
  const n = (a, k) => a.filter(c => c.result === k).length;
  const sum = (a, f) => a.reduce((s, c) => s + f(c), 0);
  return {
    realShotClips: real.length,
    correctAutomatically: n(real, 'correct automatically'), unresolved: n(real, 'unresolved'), confidentlyWrong: n(real, 'confidently wrong'),
    realShotsMissed: sum(real, c => c.wrong.filter(w => w.what.startsWith('real shot not found')).length),
    nonShotClips: non.length, falseShots: sum(all, c => c.falseShots || 0), nonShotClipsWrong: n(non, 'confidently wrong'),
    phantomPockets: sum(all, c => c.wrong.filter(w => w.fact === 'made' && w.what.startsWith('confirmed pocketed')).length),
    madeLeftUnresolved: sum(all, c => c.unresolved.filter(u => u.fact === 'made').length),
    madeCalledOnTable: sum(all, c => c.wrong.filter(w => w.fact === 'made' && w.what.startsWith('went in')).length),
    stateErrors: sum(all, c => (c.stateErrors || []).length),
    obsMissedOrUnnamed: sum(all, c => c.obsErrors ? c.obsErrors.missedOrUnnamed.length : 0),
    obsNamedButGone: sum(all, c => c.obsErrors ? c.obsErrors.namedButGone.length : 0),
    stateCheckedClips: all.filter(c => c.obsErrors).length,
    racks: results.length, racksComplete: results.filter(r => r.completion).length, racksIntact: results.filter(r => r.integrity).length,
    correctionsNeeded: sum(results, r => r.corrections),
    firstBall: { checked: all.filter(c => c.first).length, right: all.filter(c => c.first && c.first.truth === c.first.tracker).length },
  };
}

function diagnostics(results) {
  const all = results.flatMap(r => r.clips.filter(c => !c.missing)), real = all.filter(c => c.realShot), non = all.filter(c => !c.realShot);
  const sum = (a, f) => a.reduce((s, c) => s + f(c), 0), n = (a, k) => a.filter(c => c.result === k).length;
  const missed = c => c.wrong.filter(w => w.what.startsWith('real shot not found')).length;
  const outcome = a => ({ clips: a.length, correct: n(a, 'correct automatically'), unresolved: n(a, 'unresolved'), wrong: n(a, 'confidently wrong') });
  const sp = all.filter(c => c.obsSplit).map(c => c.obsSplit), S = k => sp.reduce((s, o) => s + o[k], 0);
  const wi = all.flatMap(c => c.whatIf || []), gw = all.flatMap(c => c.goneWhy || []), G = f => gw.filter(x => f(x.why)).length;
  // a "named but gone" ball repeated in the next clip of the same rack is likely the same mistake carried on
  let gone = 0, goneRepeat = 0;
  for (const r of results) { let prev = new Set(); for (const c of r.clips.filter(c => !c.missing)) { const g = c.obsErrors ? c.obsErrors.namedButGone : []; gone += g.length; goneRepeat += g.filter(b => prev.has(b)).length; prev = new Set(g); } }
  return {
    shots: { realShotEvents: sum(real, c => c.shotEvents), found: sum(real, c => c.shotEvents - missed(c)), missed: sum(real, missed),
      falseInNonShotClips: sum(non, c => c.falseShots || 0), nonShotClips: non.length, extraInShotClips: sum(real, c => c.falseShots || 0),
      minutes: +(sum(all, c => c.seconds) / 60).toFixed(1) },
    byFinalLook: { still: outcome(real.filter(c => c.settled)), moving: outcome(real.filter(c => !c.settled)) },
    finder: { looks: sp.length, ballsOnTable: S('N'), namedRight: S('C'), notNamedRight: S('M'), groupsSeen: S('D'), unnamedGroups: S('U'), wrongNumberGroups: S('Wn'),
      undetectedAtLeast: S('undetectedAtLeast'), extraGroupsAtLeast: S('extraAtLeast'), namedButGone: gone, namedButGoneRepeatedNextClip: goneRepeat,
      goneLikelyMisread: G(w => w.startsWith('likely a misread')), goneLikelyStillMisread: G(w => w.startsWith('likely a still ball')), goneLikelyMark: G(w => w.startsWith('likely a mark')), goneCannotTell: G(w => w.startsWith('cannot tell')) },
    whatIfPocketRule: { calls: wi.length, right: wi.filter(x => x.verdict.startsWith('right')).length, wrong: wi.filter(x => x.verdict.startsWith('wrong')).length, cannotTell: wi.filter(x => x.verdict === 'cannot tell').length },
  };
}

const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
let commit = null; try { commit = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim() + (execSync('git status --porcelain --untracked-files=no', { cwd: __dirname }).toString().trim() ? '+uncommitted' : ''); } catch (e) { }
const report = { oracle: ORACLE ? ORACLE + ' (ORACLE-ASSISTED DIAGNOSTIC, not product performance)' : null, truth: path.basename(TRUTH), truthHash: hash(TRUTH), code: commit, detections: Object.fromEntries(fs.readdirSync(DET).filter(f => f.endsWith('.json')).sort().map(f => [f, hash(path.join(DET, f))])) };
for (const mode of ['continuous', 'checkpoint']) {
  const res = racks.map(r => runRack(r, mode));
  report[mode] = { totals: totals(res), diagnostics: diagnostics(res), racks: res };
}

const t = report.continuous.totals, c = report.checkpoint.totals;
console.log(`${report.truth}  (code ${report.code})${ORACLE ? '  ORACLE-ASSISTED DIAGNOSTIC: ' + ORACLE : ''}`);
const row = (k, a, b) => console.log('  ' + k.padEnd(44) + String(a).padEnd(14) + String(b));
row('', 'continuous', 'from checkpoints');
row('real-shot clips', t.realShotClips, c.realShotClips);
row('  correct automatically', t.correctAutomatically, c.correctAutomatically);
row('  unresolved', t.unresolved, c.unresolved);
row('  confidently wrong', t.confidentlyWrong, c.confidentlyWrong);
row('real shots missed', t.realShotsMissed, c.realShotsMissed);
row('false shots (all clips)', t.falseShots, c.falseShots);
row('phantom pockets (confirmed, not in)', t.phantomPockets, c.phantomPockets);
row('made balls left unresolved', t.madeLeftUnresolved, c.madeLeftUnresolved);
row('made balls called on the table', t.madeCalledOnTable, c.madeCalledOnTable);
row('state errors (memory confidently wrong)', t.stateErrors, c.stateErrors);
row('observation: on table, not named', t.obsMissedOrUnnamed, c.obsMissedOrUnnamed);
row('observation: named, but gone', t.obsNamedButGone, c.obsNamedButGone);
row('clips with checkable inventory', t.stateCheckedClips, c.stateCheckedClips);
row('racks', t.racks, c.racks);
row('  completed with no intervention', t.racksComplete, c.racksComplete);
row('  no confidently wrong result', t.racksIntact, c.racksIntact);
row('  unresolved items to settle', t.correctionsNeeded, c.correctionsNeeded);
row('first ball hit (research only)', `${t.firstBall.right}/${t.firstBall.checked}`, `${c.firstBall.right}/${c.firstBall.checked}`);
if (DIAG) {
  const d = report.continuous.diagnostics, e = report.checkpoint.diagnostics, j = o => Object.entries(o).map(([k, v]) => k + ' ' + v).join(', ');
  console.log('  diagnostics (continuous; checkpoint where it differs)');
  console.log('    shots: ' + j(d.shots));
  for (const k of ['still', 'moving']) console.log(`    final look ${k.padEnd(6)}: ${j(d.byFinalLook[k])}` + (j(e.byFinalLook[k]) !== j(d.byFinalLook[k]) ? `  | checkpoint: ${j(e.byFinalLook[k])}` : ''));
  console.log('    finder at the final look (inventory verified): ' + j(d.finder));
  console.log('    what-if pocket rule: ' + j(d.whatIfPocketRule));
}
if (VERBOSE) for (const r of report.continuous.racks) for (const cl of r.clips) if (!cl.missing)
  console.log(`  ${r.rack} ${cl.clip}: ${cl.result}${cl.wrong.length ? ' | wrong: ' + cl.wrong.map(w => (w.ball ?? '') + ' ' + w.what).join('; ') : ''}${cl.unresolved.length ? ' | open: ' + cl.unresolved.map(u => u.ball + ' ' + u.what).join('; ') : ''}`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
