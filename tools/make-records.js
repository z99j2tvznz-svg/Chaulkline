// Build Shot Record v1 files (src/record.js) for one session, from its raw evidence store alone, so records can be
// thrown away and rebuilt at any time. Runs the tracker (default settings, trace on: no decision changes) and the
// settled-table check exactly as tools/score-racks.js does, and writes what they saw and decided, with the evidence.
//
//   node tools/make-records.js <data root> <session id> [--out <folder>]
//
// Output (default <data root>/records/<session id>/): session.json, clipNNN.json, and build-info.json (when and from
// which code it was built: the only file that differs between two builds of the same evidence).
'use strict';
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const { makeTracker, TRACK_DEFAULTS } = require('./tracker.js');
const { observe, reconcile, newMemory, BALLS } = require('./reconcile.js');
const { verify, fileSha, sha256 } = require('./make-evidence.js');
const REC = require('../src/record.js');
const CORR = require('./corrections.js');

const ROOT = path.join(__dirname, '..');
const r2 = v => Math.round(v * 100) / 100;
const gitBlob = f => execFileSync('git', ['hash-object', path.join(ROOT, f)], { encoding: 'utf8' }).trim();

// table inches -> frame pixels, fitted to the clip's own spots (each spot has both). DLT least squares on up to 400
// spots spread over the clip; returns the map, its local resolution (inches per pixel along the worst direction) and
// the fit's residual in pixels.
function fitCamera(frames) {
  const pts = []; for (const fr of frames) for (const b of fr.balls) if (b.px != null) pts.push(b);
  const step = Math.max(1, Math.floor(pts.length / 400)), use = pts.filter((_, i) => i % step === 0);
  if (use.length < 8) return null;
  const A = Array.from({ length: 8 }, () => new Array(9).fill(0));
  for (const { x, y, px, py } of use) for (const row of [[x, y, 1, 0, 0, 0, -px * x, -px * y, px], [0, 0, 0, x, y, 1, -py * x, -py * y, py]])
    for (let i = 0; i < 8; i++) for (let j = 0; j < 9; j++) A[i][j] += row[i] * row[j];
  for (let c = 0; c < 8; c++) {   // Gauss-Jordan on the normal equations
    let p = c; for (let i = c + 1; i < 8; i++) if (Math.abs(A[i][c]) > Math.abs(A[p][c])) p = i;
    [A[c], A[p]] = [A[p], A[c]];
    for (let i = 0; i < 8; i++) if (i !== c) { const k = A[i][c] / A[c][c]; for (let j = c; j < 9; j++) A[i][j] -= k * A[c][j]; }
  }
  const h = A.map((row, i) => row[8] / row[i]).concat(1);
  const map = (x, y) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
  const res = (x, y) => {   // inches per pixel along the direction the camera sees worst
    const e = 0.5, [a, b] = map(x, y), [c, d] = map(x + e, y), [g, k] = map(x, y + e);
    const J = [[(c - a) / e, (g - a) / e], [(d - b) / e, (k - b) / e]];
    const p = J[0][0] ** 2 + J[1][0] ** 2, q = J[0][0] * J[0][1] + J[1][0] * J[1][1], s = J[0][1] ** 2 + J[1][1] ** 2;
    const minSv = Math.sqrt((p + s) / 2 - Math.sqrt(((p - s) / 2) ** 2 + q * q));
    return 1 / minSv;
  };
  const errs = use.map(b => { const [u, v] = map(b.x, b.y); return Math.hypot(u - b.px, v - b.py); }).sort((a, b) => a - b);
  return { h: h.map(v => +v.toPrecision(8)), map, res, medianErrPx: r2(errs[errs.length >> 1]), spots: use.length };
}

// the same steps as score-racks.js runClip() + runRack() for a recorder clip (its own rack, memory from a new rack)
function runClip(d) {
  const frames = d.frames, tr = makeTracker(d.table, { trace: true }), movingAt = [];
  for (const fr of frames) { tr.step(fr); movingAt.push(tr.moving()); }
  const r = tr.finish(), end = frames[frames.length - 1].t;
  const shotT = r.shots.length ? r.shots[0].t : null;
  const beforeFr = shotT != null ? frames.filter(fr => fr.t >= shotT - 1.5 && fr.t <= shotT - 0.2) : frames.filter(fr => fr.t <= 1.0);
  const ai = frames.map((fr, i) => i).filter(i => frames[i].t >= end - 1.0);
  const before = beforeFr.length >= 5 ? observe(beforeFr) : null;
  const after = observe(ai.map(i => frames[i])); after.settled = !ai.some(i => movingAt[i]);
  const [L, W] = d.table, pockets = [[0, 0], [L / 2, -0.6], [L, 0], [0, W], [L / 2, W + 0.6], [L, W]];
  const pev = r.events.filter(e => e.k === 'pocket').map(e => {
    const t = r.tracks.find(x => x.id === e.track) || {}, x = t.x, y = t.y;
    const inMouth = x != null && pockets.some(p => Math.hypot(x - p[0], y - p[1]) < TRACK_DEFAULTS.pocketDist);
    return { ball: t.ball ?? e.ball ?? null, x, y, t: +e.t.toFixed(2), jaws: !!e.jaws, inMouth, track: e.track, ev: e };
  });
  let mem = newMemory(BALLS); const looks = [];
  if (before) { const a = reconcile(mem, before, { pockets: [] }, 'before'); mem = a.memory; looks.push(a); }
  const memBefore = mem;
  const b = reconcile(mem, after, { pockets: pev }, 'after'); looks.push(b);
  return { r, before, after, pev, shotT, end, pockets, memBefore, memAfter: b.memory, looks, beforeWin: beforeFr.length ? [beforeFr[0].t, beforeFr[beforeFr.length - 1].t] : null, afterWin: [frames[ai[0]].t, end] };
}

// memory (reconcile.js) -> a table state in the vocabulary of src/state.js
function toState(mem, look, label, win) {
  const balls = BALLS.map(n => {
    const m = mem.balls[n] || { status: 'unconfirmed', why: 'not tracked' }, seen = look && look.named[n];
    const status = m.status === 'present' ? 'on' : m.status === 'pocketed' ? 'pocketed' : 'unknown';
    return { ball: n, status, source: status === 'on' && seen ? 'observed' : 'inferred', x: status === 'on' && m.x != null ? m.x : null, y: status === 'on' && m.y != null ? m.y : null, why: m.why || null };
  });
  return { look: label, window: win && win.map(r2), settled: look ? look.settled !== false : null, complete: balls.every(b => b.status !== 'unknown'),
    unnamedSpots: look ? look.balls.filter(b => b.num == null).map(b => ({ x: b.x, y: b.y })) : [], balls };
}

function buildClip(id, clip, man, d, meta, cam) {
  const fps = d.fps, F = t => Math.round(t * fps), run = runClip(d), tc = run.r.trace, ev = [], c = man.clips[clip];
  const ballTracks = new Map(tc.tracks.map(t => [t.id, t]));
  // tracks: every analysed frame while the ball moves or its seen / state changes (and the frame before), else 10 Hz
  const tracks = tc.tracks.map(t => {
    const s = t.samples, keep = s.map((x, i) => F(x[0]) % 3 === 0 || x[3] === 'moving' || i === 0 || i === s.length - 1);
    for (let i = 1; i < s.length; i++) if ((s[i][1] >= 0) !== (s[i - 1][1] >= 0) || s[i][3] !== s[i - 1][3]) keep[i] = keep[i - 1] = true;
    const samples = s.filter((_, i) => keep[i]).map(([tt, det, , st, x, y]) => [F(tt), det >= 0 ? 1 : 0, x, y, det, REC.TRACKER_STATES.indexOf(st)]);
    // gaps (not seen) and jumps (seen again far from where it was, through a wide look): at full frame rate
    const gaps = [], jumps = []; let g = null, prev = null;
    for (const [tt, det, how, st, x, y] of s) {
      if (det < 0) { if (!g) g = { from: F(tt), to: F(tt), state: st }; else { g.to = F(tt); g.state = st; } continue; }
      if (g) { gaps.push(g); g = null; }
      if (prev && (how === 'launch' || how === 'refound' || how === 'coast') && Math.hypot(x - prev[1], y - prev[2]) > TRACK_DEFAULTS.gate)
        jumps.push({ f: F(tt), how, inches: r2(Math.hypot(x - prev[1], y - prev[2])), note: 'possible swap or merge' });
      prev = [tt, x, y];
    }
    if (g) gaps.push({ ...g, open: true });
    const tot = t.votes.reduce((a, v) => a + v, 0), share = t.ball != null && tot ? r2(t.votes[t.ball] / tot) : null;
    const seenXY = s.filter(x => x[1] >= 0), rs = cam ? seenXY.map(x => cam.res(x[4], x[5])) : [];
    return { id: t.id, ball: t.ball, isBall: t.isBall, final: t.state, identity: { votes: t.votes, share, changes: t.idChanges.map(k => ({ f: F(k.t), from: k.from, to: k.to })) },
      firstF: F(s[0][0]), lastSeenF: seenXY.length ? F(seenXY[seenXY.length - 1][0]) : null,
      resolution: rs.length ? { minInPerPx: r2(Math.min(...rs)), maxInPerPx: r2(Math.max(...rs)) } : null, gaps, jumps, samples };
  });
  const sampleAt = (track, tt) => { const t = ballTracks.get(track); return t && t.samples.find(x => F(x[0]) === F(tt)); };
  const frameEv = (track, times) => times.map(tt => { const x = sampleAt(track, tt); return x && x[1] >= 0 ? REC.detId(clip, F(tt), x[1]) : REC.frameId(clip, F(tt)); });
  // shots
  const shots = run.r.shots.map((s, i) => {
    const sid = 's' + (i + 1), cueT = ballTracks.get(s.cue);
    const startFrames = cueT ? cueT.samples.filter(x => x[0] >= s.t && x[0] <= s.t + 0.5 && x[1] >= 0).map(x => x[0]) : [];
    ev.push({ id: sid, kind: 'shot start', t: r2(s.t), track: s.cue, status: 'supported', rule: 'the table was still, then one ball started rolling fast on its own (taken as the cue ball)',
      evidence: frameEv(s.cue, startFrames) });
    if (s.first !== undefined) ev.push({ id: sid + '-first', kind: 'first hit', t: +s.t.toFixed(2), shot: sid, ball: s.first, track: s.firstTrack, status: 'uncertain',
      rule: 'first other ball to start moving after the cue ball came near it (collisions are not analysed)', evidence: [] });
    return { id: sid, t: +s.t.toFixed(2), end: s.end != null ? r2(s.end) : null, cueTrack: s.cue, from: s.from ? s.from.map(r2) : null,
      firstHit: s.first !== undefined ? { ball: s.first, track: s.firstTrack, status: 'uncertain' } : { status: 'not seen' }, scratch: !!s.scratch };
  });
  // pocket events, with what the call rested on and whether the still-table check agreed
  const after = run.looks[run.looks.length - 1].trace, confirmedIn = new Set(after.confirmed.filter(x => x.change === 'pocketed').map(x => x.ball));
  run.pev.forEach((p, i) => {
    const e = p.ev, why = tc.pocketEvidence.find(x => x.track === e.track), shot = shots.filter(s => s.t <= e.t + 1e-6).pop();
    const un = after.unresolved.find(x => x.ball === p.ball);
    const status = p.ball != null && confirmedIn.has(p.ball) ? 'supported' : 'uncertain';
    ev.push({ id: 'p' + (i + 1), kind: 'pocket', t: r2(e.t), track: e.track, ball: p.ball, shot: shot ? shot.id : null, pocket: why ? why.pocket : null, status,
      rule: why ? why.rule : 'lost at a pocket', late: !!e.late,
      measured: why ? { lastSeenF: why.lastSeen ? F(why.lastSeen[0]) : F(why.t), at: (why.lastSeen ? why.lastSeen.slice(1) : why.at).map(r2), speed: why.speed != null ? r2(why.speed) : null,
        heading: why.heading != null ? r2(why.heading) : null, distToPocket: r2(why.dist), towardPocket: why.cos != null ? r2(why.cos) : null } : null,
      stillTable: status === 'supported' ? 'gone from the still table after' : un ? un.why : p.ball == null ? 'the ball was never named' : 'not confirmed by the still-table check',
      evidence: why ? frameEv(e.track, why.frames) : [] });
  });
  tc.undone.forEach((e, i) => ev.push({ id: 'w' + (i + 1), kind: 'pocket call withdrawn', t: r2(e.t), track: e.track, ball: e.ball, status: 'unsupported', rule: e.why, evidence: [] }));
  // vanished balls: never turned into pockets
  tracks.filter(t => t.isBall && (t.final === 'hidden' || t.final === 'gone' || t.final === 'lostAtPocket')).forEach((t, i) => {
    const last = t.samples.filter(x => x[1] === 1).pop(), moving = t.samples.some(x => x[0] >= (last ? last[0] - 6 : 0) && x[0] <= (last ? last[0] : 0) && REC.TRACKER_STATES[x[5]] === 'moving');
    ev.push({ id: 'v' + (i + 1), kind: 'vanished', t: last ? r2(last[0] / fps) : null, track: t.id, ball: t.ball, status: 'unsupported', rule: 'lost and not seen again; not counted as pocketed',
      measured: last ? { lastSeenF: last[0], at: [last[2], last[3]], wasMoving: moving } : null, evidence: last ? [REC.detId(clip, last[0], last[4])] : [] });
  });
  for (const n of run.r.events.filter(e => e.k === 'notShot')) ev.push({ id: 'n' + (ev.filter(e => e.kind === 'not a shot').length + 1), kind: 'not a shot', t: r2(n.t), status: 'supported', rule: n.why, evidence: [] });
  ev.sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9) || a.id.localeCompare(b.id));
  // reported (the player's words) and the disagreements with what Chalkline concluded
  const mc = meta.clips.find(x => x.name === clip) || {}, answers = mc.answers || null, repIn = answers && answers.in ? answers.in : [];
  const before = toState(run.memBefore, run.before, 'before', run.beforeWin), afterS = toState(run.memAfter, run.after, 'after', run.afterWin);
  const dis = [];
  for (const b of repIn) {
    const st = afterS.balls.find(x => x.ball === b), pe = ev.filter(e => e.kind === 'pocket' && e.ball === b), va = ev.filter(e => e.kind === 'vanished' && e.ball === b);
    if (st.status === 'pocketed') continue;
    const tr = tracks.find(t => t.ball === b) || tracks.find(t => t.identity.changes.some(k => k.to === b));
    const said = pe.length ? `pocket call at ${pe[0].t} s, ${pe[0].status} (${pe[0].stillTable})` : va.length ? `vanished at ${va[0].t} s, unsupported` : st.status === 'on' ? 'still on the table (seen)' : `left unresolved (${st.why})`;
    dis.push({ ball: b, reported: 'went in', chalkline: said, stage: stage(b, run, before, tracks, pe, va, st) });
  }
  for (const b of BALLS) if (afterS.balls[b].status === 'pocketed' && !repIn.includes(b)) dis.push({ ball: b, reported: 'not reported in', chalkline: 'confirmed pocketed', stage: { hint: 'pocket decision', why: 'called in, the player did not report it' } });
  // coverage: share of moving-ball time with a seen sample (from the first moving frame to the next rest, pocket or end)
  let mv = 0, mvSeen = 0;
  for (const t of tc.tracks.filter(t => t.isBall)) { let on = false; for (const [, det, , st] of t.samples) { if (st === 'moving') on = true; else if (st === 'resting' || st === 'pocketed' || st === 'gone') on = false; if (on) { mv++; if (det >= 0) mvSeen++; } } }
  const coverage = { movingFrames: mv, seenFrames: mvSeen, share: mv ? r2(mvSeen / mv) : null };
  return {
    format: REC.FORMAT, kind: 'clip', id: `${id}/${clip}`, session: id, clip, step: mc.step || null,
    clock: { start: null, fps, frames: d.frames.length },
    ref: { video: { file: c.video.file, member: c.video.member, sha256: c.video.sha256, fps: c.video.fps, size: c.video.size },
      detections: { file: c.detections.file, sha256: c.detections.sha256, frames: d.frames.length, spots: c.detections.spots }, ids: 'frame <clip>#f<n>, detection <clip>#f<n>.d<spot>' },
    capture: { outline: d.quadN, finder: d.finder, camera: cam ? { tableToPixels: cam.h, medianErrPx: cam.medianErrPx, spots: cam.spots } : null,
      resolution: cam ? { note: 'inches per camera pixel along the worst direction, at the ball spot', ...resRange(tracks) } : null },
    before, after: afterS,
    observed: { shots, events: ev, collisions: { status: 'not analysed' }, sampleColumns: REC.SAMPLE, states: REC.TRACKER_STATES, tracks, spotsNeverBalls: tc.spotsNeverBalls },
    reported: answers ? { by: 'player', via: 'recorder ' + (meta.version || ''), step: mc.step, instruction: mc.text || null, answers } : null,
    confirmed: [],
    corrections: [],
    predictions: [],
    analyses: [
      { name: 'observed vs reported', method: 'tools/make-records.js', version: 1, disagreements: dis },
      { name: 'coverage', method: 'tools/make-records.js', version: 1, ...coverage },
    ],
  };
}
function resRange(tracks) {
  const r = tracks.map(t => t.resolution).filter(Boolean);
  return r.length ? { minInPerPx: Math.min(...r.map(x => x.minInPerPx)), maxInPerPx: Math.max(...r.map(x => x.maxInPerPx)) } : {};
}

// where the first disagreement shows up (a hint, labelled as one)
function stage(b, run, before, tracks, pe, va, st) {
  const named = run.before && run.before.named[b];
  const tr = tracks.filter(t => t.ball === b || t.identity.changes.some(k => k.to === b));
  if (!named && !tr.length) return { hint: 'detection or identity', why: 'never named before the shot or by any track' };
  if (pe.length && pe[0].status === 'uncertain') return { hint: pe[0].stillTable.includes('not settled') || pe[0].stillTable.includes('still moving') ? 'end state' : 'pocket decision', why: pe[0].stillTable };
  if (va.length) return { hint: 'tracking', why: `the ${b} was lost at ${va[0].t} s and not seen again; no pocket call` };
  if (tr.some(t => t.identity.changes.some(k => k.from === b))) return { hint: 'identity', why: `a track named ${b} changed its number` };
  if (!pe.length) return { hint: 'tracking', why: 'no pocket call for it' + (named ? '' : ' (not named in the look before the shot)') };
  return { hint: 'end state', why: st.why };
}

function build(root, id, out) {
  const ev = path.join(root, 'evidence', id), man = JSON.parse(fs.readFileSync(path.join(ev, 'manifest.json'), 'utf8'));
  const zips = man.sources.map(s => path.join(root, s.file));
  const meta = { version: man.sources[0].recorder, clips: [].concat(...zips.map(z => JSON.parse(execFileSync('unzip', ['-p', z, 'meta.json'])).clips)) };
  const setup = man.sources[0].setup, epochs = meta.clips.map(c => c.epoch).filter(Boolean), origin = Math.min(...epochs);
  fs.mkdirSync(out, { recursive: true });
  const clips = Object.keys(man.clips).filter(c => man.clips[c].detections).sort(), written = {};
  let outlines = [];
  for (const clip of clips) {
    const f = path.join(root, man.clips[clip].detections.file), buf = fs.readFileSync(f);
    if (sha256(buf) !== man.clips[clip].detections.sha256) throw new Error(clip + ': detections sha256 changed');
    const d = JSON.parse(buf), cam = fitCamera(d.frames), rec = buildClip(id, clip, man, d, meta, cam);
    // player corrections come from their own log (tools/corrections.js), never from an earlier record
    rec.corrections = CORR.forClip(root, id, clip, rec);
    const mc = meta.clips.find(x => x.name === clip); rec.clock.start = mc && mc.epoch ? r2((mc.epoch - origin) / 1000) : null;
    outlines.push({ clip, outline: d.quadN, medianErrPx: cam && cam.medianErrPx });
    const s = JSON.stringify(rec); fs.writeFileSync(path.join(out, clip + '.json'), s); written[clip] = sha256(Buffer.from(s));
  }
  const cam0 = meta.clips[0].camera || {};
  const session = {
    format: REC.FORMAT, kind: 'session', id,
    versions: {
      detector: { name: 'detector-v1', file: man.detections.detector.file, sha256: man.detections.detector.sha256 },
      reader: { name: 'app number reader (src/vision.js)', code: man.detections.code },
      tracker: { file: 'tools/tracker.js', blob: gitBlob('tools/tracker.js'), options: 'defaults (trace on: output only)' },
      reconcile: { file: 'tools/reconcile.js', blob: gitBlob('tools/reconcile.js') },
      physics: { status: 'not used in v1 records' },
      record: { format: REC.FORMAT, builder: 'tools/make-records.js', blob: gitBlob('tools/make-records.js'), checker: gitBlob('src/record.js') },
    },
    capture: { device: 'iPhone, Safari (recorder ' + meta.version + ')', cameraSpot: setup.spot, light: setup.light, place: setup.place,
      video: { size: cam0.video || [1280, 720], fps: cam0.settings ? cam0.settings.frameRate : null }, analysedFps: man.detections.analysedFps,
      outline: { method: 'the app\'s automatic table finder on each clip\'s first frame (clip-detect.js); per clip in each record', perClip: outlines },
      calibration: { error: 'not measured against known points for recorder clips; each record gives the median pixel error of the table-to-camera map fitted to its own spots' },
      visibility: 'per track: gaps (not seen spans) and position resolution in inches per pixel; per clip: coverage of moving-ball time' },
    table: { ft: parseInt(setup.table, 10) || null, size: [78, 39], units: 'inches, x along the long rail, y across', pockets: { model: 'mouth points at the corners and side centres (tracker default)', measured: null } },
    evidence: { manifest: path.relative(root, path.join(ev, 'manifest.json')), sha256: fileSha(path.join(ev, 'manifest.json')) },
    clock: { origin: new Date(origin).toISOString(), source: 'recorder clip start times (phone clock); each clip record gives its start in seconds from the origin' },
    corrections: { log: path.relative(root, CORR.logFile(root, id)), count: CORR.readLog(root, id).entries.length },
    clips: written,
  };
  fs.writeFileSync(path.join(out, 'session.json'), JSON.stringify(session, null, 1));
  return { session, clips };
}

module.exports = { build, fitCamera, runClip };

if (require.main === module) (async () => {
  const argv = process.argv.slice(2), oi = argv.indexOf('--out'), outArg = oi >= 0 ? argv.splice(oi, 2)[1] : null, [root, id] = argv;
  const { problems } = await verify(root, id), cbad = CORR.verify(root, id);
  if (cbad.length) { console.error('correction log check failed:\n  ' + cbad.join('\n  ')); process.exit(1); }
  if (problems.length) { console.error('evidence check failed:\n  ' + problems.join('\n  ')); process.exit(1); }
  const out = outArg || path.join(root, 'records', id), { clips } = build(root, id, out);
  let commit = 'unknown'; try { commit = execFileSync('git', ['-C', ROOT, 'describe', '--always', '--dirty'], { encoding: 'utf8' }).trim(); } catch {}
  fs.writeFileSync(path.join(out, 'build-info.json'), JSON.stringify({ built: new Date().toISOString(), code: commit }, null, 1));
  console.log(`${id}: ${clips.length} clip records -> ${out}`);
})().catch(e => { console.error(e.stack); process.exit(1); });
