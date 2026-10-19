// Table state: the one shared record of "what is on the table", independent of any game. Not part of the app build yet.
// Three kinds of thing, never mixed:
//   state      - what we believe is on the table now (from the camera or from the player's confirmation). Authoritative.
//   prediction - what physics says a shot would do. Never authoritative; it can only be turned into a hypothetical state.
//   proposal   - a suggested shot (from a planner). Carries its model and that it is not validated.
// All positions are table inches: x along the long rail from the bottom-left pocket, y across, as in core.js.
'use strict';
(function (root) {
const core = typeof module !== 'undefined' ? require('./core.js') : root;

const SOURCES = ['observed', 'confirmed', 'inferred', 'predicted'];   // seen by the camera / set or checked by the player / reasoned (e.g. by rules) / from physics
const STATUSES = ['on', 'pocketed', 'unknown'];

function deepFreeze(o) { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); } return o; }

function tableGeom(ft, pocketScale) {
  const P = core.makeP(ft, null, pocketScale);
  return { ft, L: P.L, W: P.W, R: P.R, pockets: P.pockets.map((p, i) => ({ x: p.x, y: p.y, r: p.r, corner: p.corner, name: P.pocketNames[i] })) };
}

// game: { rules: '9ball' | '8ball' | ..., group?: 'open'|'solids'|'stripes' }. Rules modules read it; the state itself does not judge.
function makeState({ ft = 9, pocketScale = 1, game = { rules: '9ball' }, balls = [], origin = 'manual', t = 0, hypothetical = false }) {
  const table = tableGeom(ft, pocketScale), ids = new Set();
  const bs = balls.map(b => {
    const id = b.id == null ? null : b.id;
    if (id != null) { if (ids.has(id)) throw new Error('ball ' + id + ' twice'); ids.add(id); }
    const status = b.status || 'on', source = b.source || (origin === 'manual' ? 'confirmed' : 'observed');
    if (!STATUSES.includes(status)) throw new Error('bad status ' + status);
    if (!SOURCES.includes(source)) throw new Error('bad source ' + source);
    if (source === 'predicted' && !hypothetical) throw new Error('a predicted ball cannot be in an authoritative state');
    if (status === 'on' && (!(b.x >= table.R - 0.01 && b.x <= table.L - table.R + 0.01) || !(b.y >= table.R - 0.01 && b.y <= table.W - table.R + 0.01)))
      throw new Error('ball ' + id + ' is off the playing surface');
    return { id, x: status === 'on' ? b.x : null, y: status === 'on' ? b.y : null, status, source,
      conf: b.conf == null ? (source === 'confirmed' ? 1 : 0.5) : b.conf,   // how sure we are of the identity
      sd: b.sd == null ? (source === 'confirmed' ? 0.25 : 1) : b.sd };       // position uncertainty, inches
  });
  const on = bs.filter(b => b.status === 'on');
  for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++)
    if (Math.hypot(on[i].x - on[j].x, on[i].y - on[j].y) < 2 * table.R - 0.05) throw new Error('balls ' + on[i].id + ' and ' + on[j].id + ' overlap');
  return deepFreeze({ kind: 'state', table, game: { ...game }, balls: bs, origin, t, hypothetical });
}

// A layout the player set or confirmed by hand: [[id, x, y], ...] or [{id, x, y}].
function manualState(balls, opts = {}) {
  return makeState({ ...opts, origin: 'manual', balls: balls.map(b => Array.isArray(b) ? { id: b[0], x: b[1], y: b[2] } : b) });
}

// What a planner may use: balls on the table whose identity is sure enough. Anything else is listed, not guessed.
function plannerLayout(s, minConf = 0.9) {
  const use = [], doubtful = [];
  for (const b of s.balls) {
    if (b.status !== 'on') { if (b.status === 'unknown') doubtful.push(b.id); continue; }
    if (b.id == null || b.conf < minConf) doubtful.push(b.id); else use.push({ id: b.id, x: b.x, y: b.y });
  }
  return { balls: use, doubtful, ok: doubtful.length === 0 && use.some(b => b.id === 0) };
}
function physicsOf(s) { return core.makeP(s.table.ft, null, s.table.pockets[0].r / 2.3); }

// Physics prediction of one shot. Reads the state, never changes it.
function predict(s, shot, P = physicsOf(s)) {
  const lay = plannerLayout(s, 0);
  const res = core.simulate(lay.balls, shot, P, { record: true });
  return deepFreeze({ kind: 'prediction', model: 'core.simulate (V1.8.1 physics, not validated on real shots)', validated: false,
    basisT: s.t, shot: { ...shot }, pocketed: res.pocketed.map(p => ({ id: p.id, pocket: p.pocket })), firstHit: res.firstHit,
    railAfter: res.railAfter, final: res.final, paths: res.paths });
}

// "What if the prediction comes true": a new, clearly hypothetical state for looking ahead. Never authoritative.
function hypothetical(s, pred) {
  if (!pred || pred.kind !== 'prediction') throw new Error('not a prediction');
  const gone = new Set(pred.pocketed.map(p => p.id)), fin = new Map(pred.final.map(b => [b.id, b]));
  const balls = s.balls.filter(b => b.status === 'on' && b.conf >= 0).map(b => gone.has(b.id) ? { id: b.id, status: 'pocketed', source: 'predicted', conf: 1 }
    : fin.has(b.id) ? { id: b.id, x: fin.get(b.id).x, y: fin.get(b.id).y, source: 'predicted', conf: b.conf, sd: 2 } : { ...b });
  for (const b of s.balls) if (b.status !== 'on') balls.push({ ...b });
  return makeState({ ft: s.table.ft, pocketScale: s.table.pockets[0].r / 2.3, game: s.game, balls, origin: 'prediction', t: s.t + 1, hypothetical: true });
}
const isAuthoritative = s => s && s.kind === 'state' && !s.hypothetical && !s.balls.some(b => b.source === 'predicted');

// A suggested shot. Planners return these; they never write into a state.
function proposal(fields) { return deepFreeze({ kind: 'proposal', validated: false, ...fields }); }

const api = { SOURCES, STATUSES, makeState, manualState, plannerLayout, physicsOf, predict, hypothetical, isAuthoritative, proposal, tableGeom };
if (typeof module !== 'undefined') module.exports = api; else root.chalkState = api;
})(typeof window !== 'undefined' ? window : globalThis);
