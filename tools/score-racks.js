// Rack scorer for the offline baseline. Rules: docs/baseline-rules.md (written before any run).
// Runs the existing tracker (tools/tracker.js, default settings) and the settled-table check (tools/reconcile.js) on
// each clip's finder output (tools/clip-detect.js), rack by rack, and scores the result against the hand-checked truth.
//
//   node tools/score-racks.js <detections folder> <truth json> [--out report.json] [--v]
//
// Two runs per session, reported apart: "continuous" (memory carried clip to clip, as a player would get it) and
// "checkpoint" (memory set from truth before each clip, for finding which part fails; the tracker never sees truth).
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { execSync } = require('node:child_process');
const { makeTracker, TRACK_DEFAULTS } = require('./tracker.js');
const { observe, reconcile, newMemory, BALLS } = require('./reconcile.js');

const argv = process.argv.slice(2), VERBOSE = argv.includes('--v');
const oIx = argv.indexOf('--out'), OUT = oIx >= 0 ? argv.splice(oIx, 2)[1] : null;
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
  const tr = makeTracker(d.table), movingAt = [];
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
  return { r, before, after, pev, shotT };
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
    const traces = [];
    if (mode === 'checkpoint' && w.stateOk && clips.length) mem = truthMemory(w.before);
    if (run.before) { const a = reconcile(mem, run.before, { pockets: [] }, 'before'); mem = a.memory; traces.push(a.trace); }
    const b = reconcile(mem, run.after, { pockets: run.pev }, 'after'); mem = b.memory; traces.push(b.trace);
    const s = scoreClip(w, run, mem, b.trace);
    s.trace = traces; s.shotsAt = run.r.shots.map(x => +x.t.toFixed(2));
    clips.push(s);
  }
  const scored = clips.filter(c => !c.missing), real = scored.filter(c => c.realShot);
  return { rack: rack.name, mode, clips,
    completion: real.length > 0 && real.every(c => c.result === 'correct automatically') && scored.every(c => !c.falseShots),
    integrity: scored.every(c => c.result !== 'confidently wrong'),
    corrections: scored.reduce((a, c) => a + c.unresolved.length, 0) };
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

const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 12);
let commit = null; try { commit = execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim() + (execSync('git status --porcelain', { cwd: __dirname }).toString().trim() ? '+uncommitted' : ''); } catch (e) { }
const report = { truth: path.basename(TRUTH), truthHash: hash(TRUTH), code: commit, detections: Object.fromEntries(fs.readdirSync(DET).filter(f => f.endsWith('.json')).sort().map(f => [f, hash(path.join(DET, f))])) };
for (const mode of ['continuous', 'checkpoint']) {
  const res = racks.map(r => runRack(r, mode));
  report[mode] = { totals: totals(res), racks: res };
}

const t = report.continuous.totals, c = report.checkpoint.totals;
console.log(`${report.truth}  (code ${report.code})`);
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
if (VERBOSE) for (const r of report.continuous.racks) for (const cl of r.clips) if (!cl.missing)
  console.log(`  ${r.rack} ${cl.clip}: ${cl.result}${cl.wrong.length ? ' | wrong: ' + cl.wrong.map(w => (w.ball ?? '') + ' ' + w.what).join('; ') : ''}${cl.unresolved.length ? ' | open: ' + cl.unresolved.map(u => u.ball + ' ' + u.what).join('; ') : ''}`);
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 1));
