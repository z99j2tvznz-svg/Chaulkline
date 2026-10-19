// Shot Record v1 (src/record.js, tools/make-records.js, tools/make-evidence.js) and the tracker's trace output.
// The tests on real footage need the project data folder (CHALKLINE_DATA, default /mnt/project-files/chalkline-data)
// and are skipped without it. Run: node --test "tests/*.test.js"
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { execFileSync } = require('node:child_process');
const { makeTracker } = require('../tools/tracker.js');
const REC = require('../src/record.js');

const DATA = process.env.CHALKLINE_DATA || '/mnt/project-files/chalkline-data', SESSION = 'rec-20261018-2310';
const EV = path.join(DATA, 'evidence', SESSION), HAVE = fs.existsSync(path.join(EV, 'manifest.json'));
const ROOT = path.join(__dirname, '..');
const runTracker = (d, opts) => { const tr = makeTracker(d.table, opts); for (const fr of d.frames) tr.step(fr); return tr.finish(); };
const noTrace = r => JSON.stringify({ ...r, trace: undefined });

// a small synthetic clip: a still table, then the cue ball rolls into the 1, which rolls into a pocket
function synthetic() {
  const frames = [];
  for (let i = 0; i < 150; i++) {
    const t = i / 30, cx = t < 2 ? 20 : Math.min(48, 20 + (t - 2) * 40), ox = t < 2.7 ? 50 : 50 + (t - 2.7) * 45;
    const balls = [{ x: +cx.toFixed(2), y: 20, rec: 0, p: 1, nb: 0 }];
    if (ox < 76) balls.push({ x: +ox.toFixed(2), y: 20 + (ox - 50) * 0.7, rec: 1, p: 1, nb: 0 });
    frames.push({ t: +t.toFixed(3), balls });
  }
  return { table: [78, 39], frames };
}

test('tracker trace is output only: every decision is the same with it on and off (synthetic clip)', () => {
  const d = synthetic(), off = runTracker(d, {}), on = runTracker(d, { trace: true });
  assert.strictEqual(off.trace, undefined);
  assert.strictEqual(noTrace(on), noTrace(off));
  assert.ok(on.trace.tracks.length >= 2 && on.trace.frames === d.frames.length);
  assert.strictEqual(off.shots.length, 1); assert.strictEqual(off.shots[0].made.length, 1);   // the clip exercises a shot and a pocket call
  assert.strictEqual(on.trace.pocketEvidence.length, 1); assert.ok(on.trace.pocketEvidence[0].frames.length > 0);
  for (const t of on.trace.tracks) assert.strictEqual(t.samples.length > 0, true);
});

test('checker: invented or interpolated samples, unsupported pockets, model output in evidence, edited corrections are rejected', () => {
  const base = {
    format: REC.FORMAT, kind: 'clip', clip: 'clip001', ref: { video: { sha256: 'a'.repeat(64) }, detections: { sha256: 'b'.repeat(64) } }, capture: {},
    before: { balls: [{ ball: 1, status: 'on', source: 'observed' }] }, after: { balls: [] },
    observed: { tracks: [{ id: 1, isBall: true, final: 'resting', samples: [[0, 1, 10, 10, 0, 0], [3, 0, 10, 10, -1, 2], [6, 1, 11, 10, 0, 0]] }], events: [] },
    reported: null, confirmed: [], corrections: [], predictions: [], analyses: [],
  };
  const raw = { frames: Array.from({ length: 7 }, (_, f) => ({ balls: [{ x: f < 6 ? 10 : 11, y: 10 }] })) };
  assert.deepStrictEqual(REC.checkClip(base, raw), []);
  const mod = fn => { const r = JSON.parse(JSON.stringify(base)); fn(r); return REC.checkClip(r, raw); };
  assert.match(mod(r => { r.observed.tracks[0].samples[1] = [3, 0, 10.5, 10, -1, 2]; }).join(), /interpolated or invented/);
  assert.match(mod(r => { r.observed.tracks[0].samples[1] = [3, 1, 10, 10, -1, 0]; }).join(), /seen without a detection/);
  assert.match(mod(r => { r.observed.tracks[0].samples[2] = [6, 1, 12, 10, 0, 0]; }).join(), /is not detection/);
  assert.match(mod(r => { r.observed.events.push({ id: 'p1', kind: 'pocket', status: 'supported', evidence: [] }); }).join(), /supported with no evidence/);
  assert.match(mod(r => { r.observed.tracks[0].final = 'hidden'; }).join(), /without a "vanished" entry/);
  assert.match(mod(r => { r.observed.events.push({ id: 'x', kind: 'prediction', status: 'uncertain' }); }).join(), /prediction or analysis inside an evidence section/);
  assert.match(mod(r => { r.before.balls[0].source = 'predicted'; }).join(), /not allowed in a state/);
  assert.match(mod(r => { r.analyses.push({ name: 'x' }); }).join(), /without name/);
  const c1 = REC.appendCorrection(base, { who: 'player', when: 'x', target: 'after.balls.1', old: 'unknown', new: 'pocketed', why: 'saw it' });
  assert.deepStrictEqual(REC.checkUpdate(base, c1), []);
  assert.strictEqual(base.corrections.length, 0);
  assert.match(REC.checkUpdate(c1, { ...c1, corrections: [{ ...c1.corrections[0], new: 'on' }] }).join(), /append-only/);
  assert.match(REC.checkUpdate(c1, { ...c1, observed: { ...c1.observed, events: [{ id: 'e' }] } }).join(), /outside corrections/);
  assert.throws(() => REC.appendCorrection(base, { who: 'p' }), /needs/);
});

test('evidence store: every file and source video still matches its sha256', { skip: !HAVE }, async () => {
  const { verify } = require('../tools/make-evidence.js');
  const { manifest, problems } = await verify(DATA, SESSION);
  assert.deepStrictEqual(problems, []);
  assert.strictEqual(Object.values(manifest.clips).filter(c => c.detections).length, 20);
  for (const c of Object.values(manifest.clips)) { assert.strictEqual(c.video.fps, 60); assert.ok(c.video.bytes > 1e6); }
  assert.strictEqual(manifest.detections.analysedFps, 30);
});

test('records: all 20 clips, checker passes against the raw detections, rebuilds byte-identical, under 100 KB', { skip: !HAVE }, () => {
  const { build } = require('../tools/make-records.js');
  const a = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-a-')), b = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-b-'));
  build(DATA, SESSION, a); build(DATA, SESSION, b);
  const files = fs.readdirSync(a).sort();
  assert.strictEqual(files.filter(f => /^clip\d+\.json$/.test(f)).length, 20);
  for (const f of files) assert.ok(fs.readFileSync(path.join(a, f)).equals(fs.readFileSync(path.join(b, f))), f + ' differs between two builds');
  const s = JSON.parse(fs.readFileSync(path.join(a, 'session.json')));
  assert.deepStrictEqual(REC.checkSession(s), []);
  for (const clip of Object.keys(s.clips)) {
    const buf = fs.readFileSync(path.join(a, clip + '.json')), r = JSON.parse(buf);
    assert.ok(buf.length < 100 * 1024, `${clip}: ${buf.length} bytes`);
    const raw = JSON.parse(fs.readFileSync(path.join(DATA, r.ref.detections.file)));
    assert.deepStrictEqual(REC.checkClip(r, raw), [], clip);
    // every evidence id names a real frame or detection in the raw file
    for (const e of r.observed.events) for (const id of e.evidence) { const p = REC.parseId(id); assert.ok(raw.frames[p.f] && (p.d == null || raw.frames[p.f].balls[p.d]), id); }
  }
});

test('records agree with the frozen v0.4 scorer, and its output is byte-identical with the trace on', { skip: !HAVE }, () => {
  const { build } = require('../tools/make-records.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rec-')), out = n => path.join(dir, n + '.json');
  build(DATA, SESSION, path.join(dir, 'rec'));
  const score = extra => execFileSync('node', [path.join(ROOT, 'tools/score-racks.js'), path.join(EV, 'detections'), path.join(ROOT, 'data/truth', SESSION + '.json'), '--diag', ...extra], { encoding: 'utf8' });
  const t1 = score(['--out', out('off')]), t2 = score(['--out', out('on'), '--track', '{"trace":true}']);
  assert.strictEqual(t1, t2);
  assert.strictEqual(fs.readFileSync(out('off'), 'utf8'), fs.readFileSync(out('on'), 'utf8'));
  const rep = JSON.parse(fs.readFileSync(out('off'), 'utf8'));
  let unresolved = 0;
  for (const rack of rep.continuous.racks) for (const c of rack.clips) {
    const r = JSON.parse(fs.readFileSync(path.join(dir, 'rec', c.clip + '.json'))), after = c.trace[c.trace.length - 1].after;
    const st = { on: 'present', pocketed: 'pocketed', unknown: 'unconfirmed' };
    for (const b of r.after.balls) assert.strictEqual(st[b.status], after[b.ball], `${c.clip} ball ${b.ball}`);
    assert.deepStrictEqual(r.observed.shots.map(s => s.t), c.shotsAt, c.clip);
    unresolved += r.analyses[0].disagreements.filter(d => d.reported === 'went in').length;
  }
  assert.strictEqual(unresolved, rep.continuous.totals.madeLeftUnresolved);
});

test('tracker trace is output only on all 20 real clips: shots, events and final states identical', { skip: !HAVE }, () => {
  const dir = path.join(EV, 'detections');
  for (const f of fs.readdirSync(dir)) {
    const d = JSON.parse(fs.readFileSync(path.join(dir, f)));
    assert.strictEqual(noTrace(runTracker(d, { trace: true })), noTrace(runTracker(d, {})), f);
  }
});
