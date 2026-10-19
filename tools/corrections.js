// Player corrections: a per-session, append-only log kept apart from everything generated, so evidence, record and
// viewer rebuilds never touch it. Records (tools/make-records.js) copy each clip's corrections into their `corrections`
// section and say whether the correction still finds its target in the rebuilt record. Nothing here changes a tracker
// decision or the frozen scorer: the log is read only by the record builder.
//
//   <data root>/corrections/<session id>/log.jsonl   one correction per line, never edited or removed
//
// A correction names its clip, the shot it falls in, and its target in the record it was made against:
//   ball   - a ball's state in the table look before or after the clip    { type, section: 'before'|'after', ball }
//   event  - an observed event (pocket call, vanished ball, shot start...)  { type, id, kind, ball, t }
//   track  - a track's ball number                                          { type, id, ball, firstF }
//   missed - something Chalkline did not report at all                      { type, kind, t, ball }
// old is the record's value at the time, new the player's value. A later correction can replace an earlier one
// (replaces: its id); the earlier line stays. Each line holds the sha256 of the line before it, so an edited or removed
// line shows up in `verify`.
//
//   node tools/corrections.js add <data root> <session> <clip> <target> <new> --why "..." [--who name] [--replaces cN]
//        target: after.ball:5 | before.ball:5 | event:p1 | track:12 | missed:pocket@12.4:5
//        new:    on | pocketed | unknown (ball), wrong | right | ball=5 | pocket=<name> (event), ball=5 | ball=none (track)
//   node tools/corrections.js list <data root> <session> [clip]
//   node tools/corrections.js verify <data root> <session>
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const logFile = (root, id) => path.join(root, 'corrections', id, 'log.jsonl');
const TYPES = ['ball', 'event', 'track', 'missed'];

function readLog(root, id) {
  const f = logFile(root, id);
  if (!fs.existsSync(f)) return { lines: [], entries: [] };
  const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
  return { lines, entries: lines.map(l => JSON.parse(l)) };
}

// the hash chain and numbering: any edited, removed or reordered line is a problem
function verify(root, id) {
  const { lines, entries } = readLog(root, id), bad = [];
  entries.forEach((c, i) => {
    if (c.id !== 'c' + (i + 1)) bad.push(`line ${i + 1}: id ${c.id}, expected c${i + 1}`);
    if (c.prev !== (i ? sha(lines[i - 1]) : null)) bad.push(`line ${i + 1}: the line before it was edited or removed`);
    if (c.session !== id) bad.push(`line ${i + 1}: session ${c.session}`);
    if (c.replaces && !entries.slice(0, i).some(e => e.id === c.replaces)) bad.push(`line ${i + 1}: replaces unknown ${c.replaces}`);
  });
  return bad;
}

function parseTarget(s) {
  let m;
  if ((m = /^(before|after)\.ball:(\d+)$/.exec(s))) return { type: 'ball', section: m[1], ball: +m[2] };
  if ((m = /^event:(\S+)$/.exec(s))) return { type: 'event', id: m[1] };
  if ((m = /^track:(\d+)$/.exec(s))) return { type: 'track', id: +m[1] };
  if ((m = /^missed:([a-z ]+)@([\d.]+)(?::(\d+))?$/.exec(s))) return { type: 'missed', kind: m[1], t: +m[2], ball: m[3] == null ? null : +m[3] };
  throw new Error('bad target ' + s);
}
function parseNew(target, s) {
  const kv = /^(ball|pocket)=(.+)$/.exec(s);
  if (target.type === 'ball') { if (!['on', 'pocketed', 'unknown'].includes(s)) throw new Error('a ball state is on, pocketed or unknown'); return s; }
  if (target.type === 'event') { if (s === 'wrong' || s === 'right') return s; if (kv) return { [kv[1]]: kv[1] === 'ball' ? +kv[2] : kv[2] }; throw new Error('an event correction is wrong, right, ball=N or pocket=NAME'); }
  if (target.type === 'track') { if (kv && kv[1] === 'ball') return { ball: kv[2] === 'none' ? null : +kv[2] }; throw new Error('a track correction is ball=N or ball=none'); }
  return 'happened';
}

const shotAt = (rec, t) => t == null ? null : rec.observed.shots.filter(s => s.t <= t + 1e-6).pop() || null;

// find a correction's target in a (re)built record. Event and track ids are positions in the tracker output, so when
// the code changes the same thing can get another id: look for the same kind and ball near the same time instead.
function locate(rec, target) {
  const ev = rec.observed.events, tr = rec.observed.tracks;
  if (target.type === 'ball') { const b = rec[target.section].balls.find(x => x.ball === target.ball); return b ? { status: 'matched', value: b.status } : { status: 'unmatched' }; }
  if (target.type === 'event') {
    const same = e => e.kind === target.kind && (e.ball ?? null) === target.ball && Math.abs((e.t ?? -99) - (target.t ?? -99)) <= 0.5;
    const e = ev.find(x => x.id === target.id && same(x)) || ev.find(same);
    return e ? { status: e.id === target.id ? 'matched' : 'rematched', id: e.id, value: { status: e.status, ball: e.ball, pocket: e.pocket ?? null } } : { status: 'unmatched' };
  }
  if (target.type === 'track') {
    const t = tr.find(x => x.id === target.id && x.firstF === target.firstF) || tr.find(x => x.firstF === target.firstF && x.ball === target.ball);
    return t ? { status: t.id === target.id ? 'matched' : 'rematched', id: t.id, value: { ball: t.ball } } : { status: 'unmatched' };
  }
  // missed: still missed unless the rebuilt record now has that event
  const e = ev.find(x => x.kind === target.kind && (target.ball == null || (x.ball ?? null) === target.ball) && Math.abs((x.t ?? -99) - target.t) <= 1);
  return e ? { status: 'now observed', id: e.id } : { status: 'matched', value: 'not observed' };
}

// make a correction against the current record of its clip and append it to the log
function add(root, id, clip, targetStr, newStr, { why, who = 'player', replaces = null, when = new Date().toISOString(), recordsDir } = {}) {
  if (!why) throw new Error('a correction needs a reason (--why)');
  const bad = verify(root, id); if (bad.length) throw new Error('correction log failed its check:\n  ' + bad.join('\n  '));
  const recDir = recordsDir || path.join(root, 'records', id), buf = fs.readFileSync(path.join(recDir, clip + '.json')), rec = JSON.parse(buf);
  const target = parseTarget(targetStr), nv = parseNew(target, newStr);
  // fill in the stable description of the target from the record, so it can be found again after a rebuild
  if (target.type === 'event') { const e = rec.observed.events.find(x => x.id === target.id); if (!e) throw new Error(`${clip} has no event ${target.id}`); Object.assign(target, { kind: e.kind, ball: e.ball ?? null, t: e.t }); }
  if (target.type === 'track') { const t = rec.observed.tracks.find(x => x.id === target.id); if (!t) throw new Error(`${clip} has no track ${target.id}`); Object.assign(target, { ball: t.ball, firstF: t.firstF }); }
  const found = locate(rec, target);
  if (found.status === 'unmatched') throw new Error(`${clip}: target ${targetStr} not found`);
  const { lines, entries } = readLog(root, id);
  if (replaces && !entries.some(e => e.id === replaces)) throw new Error('no correction ' + replaces);
  const t = target.t ?? (target.type === 'track' ? rec.observed.tracks.find(x => x.id === target.id).firstF / rec.clock.fps : null), shot = shotAt(rec, t);
  const c = { id: 'c' + (entries.length + 1), session: id, clip, shot: shot ? { id: shot.id, t: shot.t } : null, target, old: found.value ?? null, new: nv,
    who, when, why, replaces, against: { record: sha(buf) }, prev: lines.length ? sha(lines[lines.length - 1]) : null };
  fs.mkdirSync(path.dirname(logFile(root, id)), { recursive: true });
  fs.appendFileSync(logFile(root, id), JSON.stringify(c) + '\n');
  return c;
}

// a clip's corrections as the record builder puts them in a record: the log entry unchanged, plus where its target is
// in this build and whether a later correction replaced it
function forClip(root, id, clip, rec) {
  const { entries } = readLog(root, id), replaced = new Set(entries.map(e => e.replaces).filter(Boolean));
  return entries.filter(c => c.clip === clip).map(c => ({ ...c, inThisBuild: { ...locate(rec, c.target), replaced: replaced.has(c.id) } }));
}

module.exports = { add, verify, forClip, readLog, logFile, locate, parseTarget, TYPES };

if (require.main === module) {
  const argv = process.argv.slice(2), opt = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
  const why = opt('why'), who = opt('who'), replaces = opt('replaces'), [cmd, root, id, clip, target, nv] = argv;
  try {
    if (cmd === 'add') console.log(JSON.stringify(add(root, id, clip, target, nv, { why, who, replaces })));
    else if (cmd === 'list') for (const c of readLog(root, id).entries.filter(c => !clip || c.clip === clip)) console.log(JSON.stringify(c));
    else if (cmd === 'verify') { const bad = verify(root, id); console.log(bad.length ? bad.join('\n') : `${readLog(root, id).entries.length} corrections, log intact`); process.exit(bad.length ? 1 : 0); }
    else { console.error('usage: corrections.js add|list|verify <data root> <session> ...'); process.exit(2); }
  } catch (e) { console.error(e.message); process.exit(1); }
}
