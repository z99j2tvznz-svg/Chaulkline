// Shot Record v1: the durable record of a recorded session and of each recorded clip in it, and a checker for the
// format's rules. Not part of the app build. Records are built offline by tools/make-records.js from the raw evidence
// store (tools/make-evidence.js) and are the input of the diagnostic viewer (tools/make-viewer.js).
//
// Sections of a clip record, never mixed:
//   ref          - which evidence it was built from: video (zip, member, sha256), detections (file, sha256)
//   capture      - camera spot, outline, how table inches map to camera pixels, position resolution
//   before/after - table states (the vocabulary of src/state.js: status on|pocketed|unknown, source observed|inferred)
//   observed     - what the tracker saw: tracks (samples flagged seen / not seen, never interpolated), shots, events
//                  (each with a status: supported | uncertain | unsupported | not analysed, and its evidence frames)
//   reported     - what the player said, word for word (events, not ball positions)
//   confirmed    - table states the player set or checked by hand
//   corrections  - append-only { who, when, target, old, new, why }; they never edit observed
//   predictions, analyses - separate lists, each naming its model or method and version; can be thrown away and recomputed
// Ids: the session id, then the clip name; a frame is "<clip>#f<frame index>", a detection "<clip>#f<frame>.d<spot>",
// where the frame index counts the analysed frames in the detections file and the spot index counts its spots.
'use strict';
(function (root) {
const FORMAT = 'chalkline.record/1';
const STATUSES = ['supported', 'uncertain', 'unsupported', 'not analysed'];
const SECTIONS = ['ref', 'capture', 'before', 'after', 'observed', 'reported', 'confirmed', 'corrections', 'predictions', 'analyses'];
// sample columns of a track: frame index, 1 = seen (a matched detection) / 0 = not seen, x, y (in; when not seen: the
// last seen spot, unchanged), detection spot index (-1 when not seen), tracker state (index into TRACKER_STATES)
const SAMPLE = ['f', 'seen', 'x', 'y', 'd', 'state'];
const TRACKER_STATES = ['resting', 'moving', 'hidden', 'lostAtPocket', 'pocketed', 'gone'];

const frameId = (clip, f) => `${clip}#f${f}`;
const detId = (clip, f, d) => `${clip}#f${f}.d${d}`;
function parseId(id) { const m = /^(clip\d+)#f(\d+)(?:\.d(\d+))?$/.exec(id); return m ? { clip: m[1], f: +m[2], d: m[3] == null ? null : +m[3] } : null; }

// everything inside these sections must be measurement or report: nothing produced by a model or analysis
const NOT_EVIDENCE = o => o && typeof o === 'object' && (o.source === 'predicted' || o.kind === 'prediction' || o.kind === 'analysis' || o.kind === 'proposal' || 'model' in o || 'hypothetical' in o);
function walk(o, fn, at) { if (o && typeof o === 'object') { fn(o, at); for (const k of Object.keys(o)) walk(o[k], fn, at + '.' + k); } }

// check one clip record; `raw` (optional) is its detections file, to check every seen sample against the detection it
// names. Returns a list of problems (empty = passes).
function checkClip(r, raw) {
  const bad = [], need = (c, m) => { if (!c) bad.push(m); };
  need(r.format === FORMAT && r.kind === 'clip', 'not a ' + FORMAT + ' clip record');
  for (const s of SECTIONS) need(s in r, 'missing section ' + s);
  if (bad.length) return bad;
  need(r.ref.video && /^[0-9a-f]{64}$/.test(r.ref.video.sha256), 'ref.video has no sha256');
  need(r.ref.detections && /^[0-9a-f]{64}$/.test(r.ref.detections.sha256), 'ref.detections has no sha256');
  // uncertainty is never hidden: seen samples are real detections, nothing is invented in a gap
  for (const tr of r.observed.tracks) {
    let last = null;
    for (const s of tr.samples) {
      const [f, seen, x, y, d, st] = s;
      need(TRACKER_STATES[st] != null, `track ${tr.id} f${f}: unknown state ${st}`);
      if (seen === 1) {
        need(d >= 0, `track ${tr.id} f${f}: seen without a detection`);
        if (raw) { const b = raw.frames[f] && raw.frames[f].balls[d]; need(b && b.x === x && b.y === y, `track ${tr.id} f${f}: seen spot is not detection ${detId(r.clip, f, d)}`); }
        last = [x, y];
      } else {
        need(seen === 0 && d === -1, `track ${tr.id} f${f}: not-seen sample names a detection`);
        need(last && last[0] === x && last[1] === y, `track ${tr.id} f${f}: not-seen sample is not the last seen spot (interpolated or invented)`);
      }
    }
  }
  const ev = r.observed.events;
  for (const e of ev) {
    need(STATUSES.includes(e.status), `event ${e.id}: bad status ${e.status}`);
    for (const id of e.evidence || []) need(parseId(id) && parseId(id).clip === r.clip, `event ${e.id}: bad evidence id ${id}`);
    if (e.kind === 'pocket') need((e.evidence && e.evidence.length) || e.status !== 'supported', `pocket event ${e.id}: supported with no evidence frames`);
  }
  // a disappearance never becomes a pocket on its own: every vanished ball has its own entry, never counted in
  for (const tr of r.observed.tracks) if (tr.isBall && (tr.final === 'hidden' || tr.final === 'gone' || tr.final === 'lostAtPocket'))
    need(ev.some(e => e.kind === 'vanished' && e.track === tr.id && e.status === 'unsupported'), `track ${tr.id} vanished without a "vanished" entry`);
  for (const sec of ['before', 'after']) for (const b of r[sec].balls) {
    need(['on', 'pocketed', 'unknown'].includes(b.status), `${sec} ball ${b.ball}: bad status`);
    need(['observed', 'confirmed', 'inferred'].includes(b.source), `${sec} ball ${b.ball}: source ${b.source} not allowed in a state`);
  }
  // separation: no model output inside evidence sections; model output names its model and version
  for (const s of ['observed', 'reported', 'confirmed', 'before', 'after']) walk(r[s], (o, at) => { if (NOT_EVIDENCE(o)) bad.push(`${at}: prediction or analysis inside an evidence section`); }, s);
  for (const s of ['predictions', 'analyses']) for (const a of r[s]) need(a.name && a.version != null && (a.method || a.model), `${s}: entry without name, method/model and version`);
  for (const c of r.corrections) need(['who', 'when', 'target', 'old', 'new', 'why'].every(k => k in c), 'correction missing who/when/target/old/new/why');
  return bad;
}

function checkSession(s) {
  const bad = [], need = (c, m) => { if (!c) bad.push(m); };
  need(s.format === FORMAT && s.kind === 'session', 'not a ' + FORMAT + ' session record');
  for (const k of ['detector', 'reader', 'tracker', 'reconcile', 'physics', 'record']) need(s.versions && s.versions[k], 'versions.' + k + ' missing');
  for (const k of ['cameraSpot', 'device', 'video', 'analysedFps', 'outline']) need(s.capture && k in s.capture, 'capture.' + k + ' missing');
  need(s.table && s.table.size, 'table.size missing');
  need(s.evidence && /^[0-9a-f]{64}$/.test(s.evidence.sha256), 'evidence manifest sha256 missing');
  need(s.clock && s.clock.origin, 'clock missing');
  return bad;
}

// corrections are append-only: the only allowed change between two versions of a record is new corrections at the end
function appendCorrection(r, c) {
  for (const k of ['who', 'when', 'target', 'old', 'new', 'why']) if (!(k in c)) throw new Error('correction needs ' + k);
  return { ...r, corrections: r.corrections.concat([{ ...c }]) };
}
function checkUpdate(prev, next) {
  const bad = [], strip = r => JSON.stringify({ ...r, corrections: null });
  if (strip(prev) !== strip(next)) bad.push('the record changed outside corrections');
  if (next.corrections.length < prev.corrections.length || prev.corrections.some((c, i) => JSON.stringify(c) !== JSON.stringify(next.corrections[i])))
    bad.push('a correction was edited or removed (corrections are append-only)');
  return bad;
}

const api = { FORMAT, STATUSES, SECTIONS, SAMPLE, TRACKER_STATES, frameId, detId, parseId, checkClip, checkSession, appendCorrection, checkUpdate };
if (typeof module !== 'undefined') module.exports = api; else root.chalkRecord = api;
})(typeof window !== 'undefined' ? window : globalThis);
