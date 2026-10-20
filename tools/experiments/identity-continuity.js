// Diagnostic only (Oct 20, 2026): of the balls the settled-table looks leave unnamed or misname, how many could have kept
// an identity established earlier, without a new read of their looks? Runs tracker v0.6 and the settled-table check
// exactly as tools/score-racks.js does (same looks, same memory), and for every failing spot in a look with a known true
// table asks what earlier evidence existed:
//   independent: only this clip (the track's rest-frame votes before the look; for the after look, the before look's
//                name at the spot the track came from)
//   continuous:  the same, plus where memory carried from earlier clips last saw each ball
// Groups: 1 identified earlier and stationary; 2 moved on one unbroken, unambiguous track; 3 identity lost or ambiguous
// (contact, broken track, two candidates); 4 never reliably identified; 5 earlier identity confidently wrong (the number
// is not on the table) or contradicted by a clear read elsewhere in the same look. Truth has no ball positions, so a
// candidate counts as correct when the number is on the table, not named elsewhere in the look and not given to two
// spots (Likely, not position-checked). Nothing in the tracker or the settled-table check changes.
//   node tools/experiments/identity-continuity.js <dets>:<truth> [...] [--out file.json]
'use strict';
const fs = require('node:fs'), path = require('node:path');
const { makeTracker, TRACK_DEFAULTS } = require('../tracker.js');
const { observe, reconcile, newMemory, BALLS, OBS } = require('../reconcile.js');

const argv = process.argv.slice(2), oi = argv.indexOf('--out'), OUT = oi >= 0 ? argv.splice(oi, 2)[1] : null;
const T0 = 1.5, T1 = 0.2, LOOK = 1.0, MOVE_FROM = 1.5, MOVE_AWAY = 3, NEAR = 2.0;
const yes = v => typeof v === 'string' && v.startsWith('yes');
// the settled-table check's own "sure" rule, applied to a track's votes
const sureNum = v => { const o = BALLS.slice().sort((a, b) => v[b] - v[a]); return v[o[0]] >= OBS.minScore && v[o[0]] >= OBS.margin * v[o[1]] ? o[0] : null; };
const snap = trs => trs.filter(k => k.real).map(k => ({ id: k.id, x: k.x, y: k.y, state: k.state, born: k.born, movedAt: k.movedAt,
  votes: k.votes.slice(), unsure: k.unsure ? { t: k.unsure.t, votes: k.unsure.votes.slice() } : null }));
const effVotes = s => s.unsure ? s.votes.map((v, i) => v - s.unsure.votes[i]) : s.votes;

function runClip(dir, clip, T) {
  const f = path.join(dir, clip + '.json'); if (!fs.existsSync(f)) return null;
  const d = JSON.parse(fs.readFileSync(f, 'utf8'));
  const frames = T.settleEnd != null ? d.frames.filter(fr => fr.t <= T.settleEnd) : d.frames;
  const opts = { version: 'v0.6' };
  // pass 1 finds the shot time; pass 2 (the same deterministic run) keeps track snapshots at the look edges
  const t1 = makeTracker(d.table, opts); for (const fr of frames) t1.step(fr);
  const r1 = t1.finish(), shotT = r1.shots.length ? r1.shots[0].t : null, end = frames[frames.length - 1].t;
  const at = { beforeStart: shotT != null ? shotT - T0 : 0, shot: shotT != null ? shotT - T1 : null, afterStart: end - LOOK };
  const tr = makeTracker(d.table, opts), movingAt = [], S = {};
  for (const fr of frames) {
    tr.step(fr); movingAt.push(tr.moving());
    for (const k in at) if (at[k] != null && S[k] == null && fr.t >= at[k]) S[k] = snap(tr.tracks);
  }
  const r = tr.finish(); S.end = snap(tr.tracks);
  const beforeFr = shotT != null ? frames.filter(fr => fr.t >= shotT - T0 && fr.t <= shotT - T1) : frames.filter(fr => fr.t <= LOOK);
  const ai = frames.map((fr, i) => i).filter(i => frames[i].t >= end - LOOK);
  const before = beforeFr.length >= 5 ? observe(beforeFr) : null;
  const after = observe(ai.map(i => frames[i])); after.settled = !ai.some(i => movingAt[i]);
  const [L, W] = d.table, pockets = [[0, 0], [L / 2, -0.6], [L, 0], [0, W], [L / 2, W + 0.6], [L, W]];
  const pev = r.events.filter(e => e.k === 'pocket').map(e => {
    const t = r.tracks.find(x => x.id === e.track) || {}, x = t.x, y = t.y;
    const inMouth = x != null && pockets.some(p => Math.hypot(x - p[0], y - p[1]) < TRACK_DEFAULTS.pocketDist);
    return { ball: t.ball ?? e.ball ?? null, x, y, t: +e.t.toFixed(2), jaws: !!e.jaws, inMouth };
  });
  const movedFrom = (x, y) => tr.tracks.some(k => k.real && k.movedAt != null && k.path.some(([, px, py]) => Math.hypot(px - x, py - y) < MOVE_FROM)
    && Math.hypot(k.x - x, k.y - y) >= MOVE_AWAY);
  if (before) before.rejected = rejected(beforeFr); after.rejected = rejected(ai.map(i => frames[i]));
  return { r, before, after, pev, shotT, end, movedFrom, S };
}

// spots the look threw away (the same grouping as observe()): too few frames, or the reader called it "not a ball"
function rejected(frames) {
  const groups = [];
  for (const fr of frames) for (const b of fr.balls) {
    let g = null, gd = OBS.group;
    for (const c of groups) { const d = Math.hypot(b.x - c.x, b.y - c.y); if (d < gd) { gd = d; g = c; } }
    if (!g) { g = { x: b.x, y: b.y, n: 0, frames: new Set(), nb: 0, nbN: 0 }; groups.push(g); }
    g.x = (g.x * g.n + b.x) / (g.n + 1); g.y = (g.y * g.n + b.y) / (g.n + 1); g.n++; g.frames.add(fr.t); if (b.nb != null) { g.nb += b.nb; g.nbN++; }
  }
  const out = { notABall: 0, flicker: 0 };
  for (const g of groups) { const few = g.frames.size < OBS.share * frames.length, nb = g.nbN && g.nb / g.nbN >= OBS.nb; if (nb && !few) out.notABall++; else if (few && g.frames.size >= 0.2 * frames.length) out.flicker++; }
  return out;
}

function truthWalk(TJ, rack) {
  let inv = new Set(rack.start || []);
  return rack.clips.map(c => {
    const T = TJ.clips[c] || {};
    for (const b of T.offCameraBefore || []) inv.delete(b);
    if (!inv.has(0) && rack.start && rack.start.includes(0)) inv.add(0);
    const before = new Set(inv), made = (T.made || []).concat(T.madeAfterClip || []), unsure = new Set(T.unsureBalls || []);
    for (const b of made) inv.delete(b);
    return { clip: c, T, before, after: new Set(inv), made, unsure, stateOk: !!rack.start && yes(T.verify && T.verify.state) };
  });
}
const truthMemory = inv => ({ balls: Object.fromEntries(BALLS.map(n => [n, { status: inv.has(n) ? 'present' : 'pocketed', why: 'set from truth (checkpoint run)' }])), rack: false });
const nearest = (list, x, y, max) => { let b = null, bd = max; for (const s of list) { const e = Math.hypot(s.x - x, s.y - y); if (e < bd) { bd = e; b = s; } } return b; };
const live = s => s.state === 'resting' || s.state === 'moving';

// one look: every failing spot gets an earlier-identity candidate and a group
function analyseLook(kind, look, inv, unsure, run, prevMem, mode) {
  const on = [...inv].filter(n => !unsure.has(n)), named = look.named;
  const missingNums = on.filter(n => !named[n]);
  const fails = look.balls.filter(b => b.num == null || (!inv.has(b.num) && !unsure.has(b.num)))
    .map(b => ({ x: b.x, y: b.y, fresh: b.num, kind: b.num == null ? 'unnamed' : 'misnamed' }));
  const atLook = kind === 'before' ? run.S.beforeStart : run.S.afterStart;
  for (const f of fails) {
    const T = atLook ? nearest(atLook.filter(live), f.x, f.y, NEAR) : null;
    f.track = T ? T.id : null; f.wholeClip = null;
    if (T) { const e = run.S.end.find(s => s.id === T.id); if (e) f.wholeClip = sureNum(effVotes(e)); }   // what the tracker holds by clip end
    const cands = [];
    if (kind === 'before') {
      if (T) { const c = sureNum(effVotes(T)); if (c != null) cands.push({ num: c, from: 'track earlier in clip', moved: T.movedAt != null, contact: !!T.unsure }); }
      if (mode === 'continuous' && prevMem) {
        const m = nearest(Object.entries(prevMem.balls).filter(([n, r]) => r.status === 'present' && r.x != null && !named[+n]).map(([n, r]) => ({ n: +n, x: r.x, y: r.y })), f.x, f.y, NEAR);
        if (m) cands.push({ num: m.n, from: 'memory from earlier clip', moved: false, contact: false });
      }
    } else {
      const S0 = run.S.shot;   // just before the shot
      if (!T) f.chain = 'no track at the spot';
      else if (!S0) f.chain = 'no shot found';
      else {
        const T0s = S0.find(s => s.id === T.id);
        if (!T0s) f.chain = 'track began after the shot (chain broken)';
        else {
          const dist = Math.hypot(T.x - T0s.x, T.y - T0s.y), contact = !!(T.unsure && T.unsure.t >= run.shotT - T1);
          f.chain = contact ? 'contact made it uncertain' : dist > 1.5 ? 'moved, one unbroken track' : 'stationary';
          const bn = run.before ? nearest(run.before.balls.filter(b => b.num != null), T0s.x, T0s.y, NEAR) : null;
          const c = bn ? bn.num : sureNum(effVotes(T0s));
          if (c != null) cands.push({ num: c, from: bn ? 'before look' : 'track before the shot', moved: dist > 1.5, contact });
        }
      }
    }
    const nums = [...new Set(cands.map(c => c.num))];
    f.cand = nums.length === 1 ? nums[0] : null; f.candFrom = cands.map(c => c.from).join(' + ');
    if (nums.length > 1) { f.group = 3; f.why = 'two earlier identities disagree'; continue; }
    if (!cands.length) {
      f.group = f.chain === 'track began after the shot (chain broken)' ? 3 : f.chain === 'contact made it uncertain' ? 3 : 4;
      f.why = f.group === 3 ? f.chain : kind === 'after' && f.chain ? 'never reliably identified (' + f.chain + ')' : 'never reliably identified';
      continue;
    }
    const c = cands[0];
    if (!inv.has(f.cand) && !unsure.has(f.cand)) { f.group = 5; f.why = 'earlier identity not on the table'; continue; }
    if (named[f.cand]) { f.group = 5; f.why = 'contradicted by a clear read of that number elsewhere'; continue; }
    if (c.contact) { f.group = 3; f.why = 'contact made it uncertain'; continue; }
    f.group = c.moved ? 2 : 1; f.why = c.moved ? 'moved on one unbroken track' : 'identified earlier, stationary';
  }
  // the same candidate on two spots: neither is safe
  for (const n of new Set(fails.filter(f => f.group <= 2).map(f => f.cand))) {
    const two = fails.filter(f => f.group <= 2 && f.cand === n);
    if (two.length > 1) for (const f of two) { f.group = 3; f.why = 'same earlier identity on two spots'; }
  }
  // balls with no spot in the look: does the tracker still follow something there, and with which earlier identity?
  const lone = (atLook || []).filter(s => live(s) && !nearest(look.balls, s.x, s.y, NEAR));
  const dropped = { trackedSureMissing: 0, trackedSureOther: 0, trackedNoName: 0 };
  for (const s of lone) { const c = sureNum(effVotes(s)); if (c == null) dropped.trackedNoName++; else if (missingNums.includes(c) && !fails.some(f => f.cand === c)) dropped.trackedSureMissing++; else dropped.trackedSureOther++; }
  const covered = fails.filter(f => f.group <= 2 && f.kind === 'unnamed').length;
  const undetected = Math.max(0, missingNums.length - fails.filter(f => f.kind === 'unnamed').length);
  const noSpot = Math.max(0, missingNums.length - fails.length);
  return { kind, dropped, noSpot, rejected: look.rejected, balls: on.length, named: on.filter(n => named[n]).length, missingNums, fails, undetectedAtLeast: undetected,
    fullNow: missingNums.length === 0 && !fails.some(f => f.kind === 'misnamed'),
    fullIfContinuity: !fails.some(f => f.kind === 'misnamed') && undetected === 0 && covered === fails.length && fails.length === missingNums.length };
}

const results = [];
for (const pair of argv) {
  const [dir, truth] = pair.split(':'), TJ = JSON.parse(fs.readFileSync(truth, 'utf8')), session = path.basename(truth, '.json');
  const racks = TJ.racks || Object.keys(TJ.clips).sort().map(c => ({ name: c, clips: [c], start: TJ.clips[c].layout && TJ.clips[c].layout.length ? TJ.clips[c].layout : null }));
  for (const mode of ['independent', 'continuous']) {
    for (const rack of racks) {
      let mem = newMemory(rack.start || BALLS);
      const walk = truthWalk(TJ, rack);
      walk.forEach((w, i) => {
        const run = runClip(dir, w.clip, w.T); if (!run) return;
        if (mode === 'independent' && w.stateOk && i) mem = truthMemory(w.before);
        const prevMem = JSON.parse(JSON.stringify(mem));
        if (run.before) mem = reconcile(mem, run.before, { pockets: [] }, 'before').memory;
        const afterMem = JSON.parse(JSON.stringify(mem));
        mem = reconcile(mem, run.after, { pockets: run.pev, ...(run.before ? { absence: { before: run.before, movedFrom: run.movedFrom } } : {}) }, 'after').memory;
        if (!w.stateOk) return;
        const realShot = !!w.T.shot || !!(w.T.more && w.T.more.length);
        if (run.before) results.push({ session, mode, rack: rack.name, clip: w.clip, realShot, ...analyseLook('before', run.before, w.before, w.unsure, run, i ? prevMem : null, mode) });
        if (run.after.settled) results.push({ session, mode, rack: rack.name, clip: w.clip, realShot, ...analyseLook('after', run.after, w.after, w.unsure, run, afterMem, mode) });
        else results.push({ session, mode, rack: rack.name, clip: w.clip, realShot, kind: 'after', unsettled: true });
      });
    }
  }
}

// summary: per mode, look kind and session
const G = ['1 identified earlier, stationary', '2 moved, unbroken track', '3 lost or ambiguous', '4 never reliably identified', '5a earlier identity not on the table', '5b earlier identity contradicted by a clear read elsewhere'];
const gname = f => f.group === 5 ? (f.why.startsWith('contradicted') ? G[5] : G[4]) : G[f.group - 1];
const sum = {};
for (const r of results) {
  if (r.unsettled) continue;
  const k = r.mode + ' ' + r.kind, s = sum[k] = sum[k] || { looks: 0, balls: 0, named: 0, unnamedSpots: 0, misnamedSpots: 0, undetectedAtLeast: 0, groups: {}, misnamedGroups: {}, why: {}, fullNow: 0, fullIfContinuity: 0, trackerAlreadyHas: 0, dropped: { trackedSureMissing: 0, trackedSureOther: 0, trackedNoName: 0 }, perSession: {} };
  for (const k in r.dropped) s.dropped[k] += r.dropped[k];
  s.noSpot = (s.noSpot || 0) + r.noSpot; if (r.noSpot) { s.rejNotBall = (s.rejNotBall || 0) + Math.min(r.noSpot, r.rejected.notABall); s.rejFlicker = (s.rejFlicker || 0) + Math.min(Math.max(0, r.noSpot - r.rejected.notABall), r.rejected.flicker); }
  s.looks++; s.balls += r.balls; s.named += r.named; s.undetectedAtLeast += r.undetectedAtLeast; s.fullNow += r.fullNow; s.fullIfContinuity += r.fullIfContinuity || r.fullNow;
  const ps = s.perSession[r.session] = s.perSession[r.session] || { looks: 0, fails: 0, g1: 0, g2: 0, g3: 0, g4: 0, g5: 0, fullNow: 0, fullIfContinuity: 0 };
  ps.looks++; ps.fullNow += r.fullNow; ps.fullIfContinuity += r.fullIfContinuity || r.fullNow;
  for (const f of r.fails) {
    if (f.kind === 'unnamed') { s.unnamedSpots++; s.groups[gname(f)] = (s.groups[gname(f)] || 0) + 1; ps.fails++; ps['g' + f.group]++; }
    else { s.misnamedSpots++; s.misnamedGroups[gname(f)] = (s.misnamedGroups[gname(f)] || 0) + 1; }
    s.why[f.kind + ': ' + f.why] = (s.why[f.kind + ': ' + f.why] || 0) + 1;
    if (f.kind === 'unnamed' && f.wholeClip != null && inOn(r, f.wholeClip)) s.trackerAlreadyHas++;
  }
}
function inOn(r, n) { return r.missingNums.includes(n); }
for (const [k, s] of Object.entries(sum)) {
  console.log(`\n${k}: ${s.looks} looks, ${s.named}/${s.balls} balls named; unnamed spots ${s.unnamedSpots}, misnamed ${s.misnamedSpots}, undetected at least ${s.undetectedAtLeast}; whole table named now ${s.fullNow}, with continuity ceiling ${s.fullIfContinuity}`);
  console.log('  unnamed spots by group: ' + JSON.stringify(s.groups));
  console.log('  misnamed spots by group: ' + JSON.stringify(s.misnamedGroups));
  console.log('  tracker already holds a sure, missing number by clip end (unnamed spots): ' + s.trackerAlreadyHas);
  console.log('  balls with no spot in the look ' + s.noSpot + ' (explainable by spots the look rejected as not a ball ' + s.rejNotBall + ', flickering ' + s.rejFlicker + '); tracker still following: ' + JSON.stringify(s.dropped));
  console.log('  why: ' + JSON.stringify(s.why));
  for (const [n, p] of Object.entries(s.perSession)) console.log('   ' + n.padEnd(34) + JSON.stringify(p));
}
const uns = results.filter(r => r.unsettled);
console.log('\nafter looks skipped as not settled: ' + JSON.stringify({ independent: uns.filter(r => r.mode === 'independent').length, continuous: uns.filter(r => r.mode === 'continuous').length }));
if (OUT) fs.writeFileSync(OUT, JSON.stringify({ summary: sum, looks: results }, null, 1));
