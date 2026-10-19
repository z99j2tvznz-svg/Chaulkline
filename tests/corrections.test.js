// Player corrections (tools/corrections.js): an append-only log kept apart from evidence, records and viewer, carried
// into every rebuild without touching what the tracker produced. Needs the project data folder (CHALKLINE_DATA,
// default /mnt/project-files/chalkline-data); works on a scratch data root that links to its evidence and sessions,
// so the real data folder is never written.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const REC = require('../src/record.js');
const CORR = require('../tools/corrections.js');

const DATA = process.env.CHALKLINE_DATA || '/mnt/project-files/chalkline-data', SESSION = 'rec-20261018-2310';
const HAVE = fs.existsSync(path.join(DATA, 'evidence', SESSION, 'manifest.json'));

function scratchRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'corr-'));
  for (const d of ['evidence', 'sessions']) fs.symlinkSync(path.join(DATA, d), path.join(root, d));
  return root;
}
const readAll = dir => Object.fromEntries(fs.readdirSync(dir).sort().map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
const noCorr = s => JSON.stringify({ ...JSON.parse(s), corrections: [] });

test('corrections survive record and viewer rebuilds, and never change what the tracker produced', { skip: !HAVE, timeout: 600000 }, () => {
  const { build } = require('../tools/make-records.js'), viewer = require('../tools/make-viewer.js');
  const root = scratchRoot(), recDir = path.join(root, 'records', SESSION);
  build(root, SESSION, recDir);
  const plain = readAll(recDir);

  // clip026: the 5 (reported in) left unresolved, its pocket call was the wrong pocket, a track named cue is the 9,
  // and the 5 going in top left was never called
  const add = (target, nv, why, o = {}) => CORR.add(root, SESSION, 'clip026', target, nv, { why, who: 'Nackers', when: '2026-10-19T20:00:00Z', ...o });
  const c1 = add('after.ball:5', 'pocketed', 'it went in the top left');
  const c2 = add('event:p1', 'wrong', 'it rattled the top right jaws and stayed out');
  const c3 = add('track:2', 'ball=9', 'this is the 9 on the far rail, not the cue ball');
  const c4 = add('missed:pocket@19.6:5', 'happened', 'the 5 went in top left on the third shot');
  const c5 = add('after.ball:5', 'pocketed', 'same, with the pocket named', { replaces: 'c1' });
  assert.deepStrictEqual([c1.old, c2.old.status, c3.old.ball, c5.replaces], ['unknown', 'uncertain', 0, 'c1']);
  assert.deepStrictEqual([c2.shot.id, c4.shot.id], ['s2', 's3']);   // tied to the shot it falls in
  assert.strictEqual(c1.target.section, 'after'); assert.strictEqual(c2.target.kind, 'pocket'); assert.strictEqual(c2.target.ball, 5);
  assert.throws(() => add('event:p9', 'wrong', 'x'), /no event/);
  assert.throws(() => add('after.ball:5', 'gone', 'x'), /on, pocketed or unknown/);
  assert.throws(() => add('after.ball:5', 'on', ''), /reason/);

  // rebuild records twice (the second from an empty folder): the corrections come back every time
  build(root, SESSION, recDir);
  const withC = readAll(recDir);
  fs.rmSync(recDir, { recursive: true }); build(root, SESSION, recDir);
  assert.deepStrictEqual(readAll(recDir), withC, 'a rebuild from nothing differs');
  for (const f of Object.keys(plain)) {
    if (f === 'session.json') continue;
    assert.strictEqual(noCorr(withC[f]), noCorr(plain[f]), f + ': generated sections changed');   // tracker output untouched
    assert.deepStrictEqual(REC.checkUpdate(JSON.parse(plain[f]), JSON.parse(withC[f])), [], f);
    if (f !== 'clip026.json') assert.strictEqual(withC[f], plain[f], f);
  }
  const r = JSON.parse(withC['clip026.json']), raw = JSON.parse(fs.readFileSync(path.join(DATA, r.ref.detections.file)));
  assert.deepStrictEqual(REC.checkClip(r, raw), []);
  assert.deepStrictEqual(r.corrections.map(c => c.id), ['c1', 'c2', 'c3', 'c4', 'c5']);
  assert.deepStrictEqual(r.corrections.map(c => c.inThisBuild.status), ['matched', 'matched', 'matched', 'matched', 'matched']);
  assert.deepStrictEqual(r.corrections.map(c => c.inThisBuild.replaced), [true, false, false, false, false]);
  assert.strictEqual(r.after.balls[5].status, 'unknown');   // the correction sits beside the tracker's answer, never over it
  assert.strictEqual(JSON.parse(withC['session.json']).corrections.count, 5);

  // the viewer rebuild carries them too
  const vOut = path.join(root, 'viewer'); viewer.build(root, SESSION, vOut, false);
  const v = JSON.parse(fs.readFileSync(path.join(vOut, 'data', 'clip026.json')));
  assert.deepStrictEqual(v.record.corrections, r.corrections);
  assert.strictEqual(JSON.parse(fs.readFileSync(path.join(vOut, 'data', 'index.json'))).clips.find(c => c.clip === 'clip026').corrections, 5);

  // the log is intact and outside every generated folder; an edited or removed line is caught
  assert.deepStrictEqual(CORR.verify(root, SESSION), []);
  const log = CORR.logFile(root, SESSION), lines = fs.readFileSync(log, 'utf8');
  assert.ok(!log.includes(path.sep + 'records' + path.sep) && !log.includes(path.sep + 'evidence' + path.sep));
  fs.writeFileSync(log, lines.replace('stayed out', 'went in'));
  assert.match(CORR.verify(root, SESSION).join(), /edited or removed/);
  fs.writeFileSync(log, lines.split('\n').filter((l, i) => i !== 1).join('\n'));
  assert.ok(CORR.verify(root, SESSION).length > 0);
  assert.throws(() => add('after.ball:4', 'on', 'x'), /failed its check/);
  fs.writeFileSync(log, lines);
  fs.rmSync(root, { recursive: true, force: true });
});

test('a correction finds its target again when a tracker change renumbers events and tracks', { skip: !HAVE }, () => {
  const r = JSON.parse(fs.readFileSync(path.join(DATA, 'records', SESSION, 'clip026.json')));
  const ev = { type: 'event', id: 'p1', kind: 'pocket', ball: 5, t: 8.6 };
  assert.strictEqual(CORR.locate(r, ev).status, 'matched');
  const moved = JSON.parse(JSON.stringify(r)); moved.observed.events.find(e => e.id === 'p1').id = 'p7';
  assert.deepStrictEqual([CORR.locate(moved, ev).status, CORR.locate(moved, ev).id], ['rematched', 'p7']);
  moved.observed.events = moved.observed.events.filter(e => e.kind !== 'pocket');
  assert.strictEqual(CORR.locate(moved, ev).status, 'unmatched');   // kept and flagged, never dropped
  assert.strictEqual(CORR.locate(r, { type: 'missed', kind: 'pocket', t: 8.7, ball: 5 }).status, 'now observed');
});
