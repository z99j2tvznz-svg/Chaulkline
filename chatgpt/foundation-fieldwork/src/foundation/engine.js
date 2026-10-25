/* Chalkline / Fieldwork foundation v0.1.
 * A deterministic consumer of pre-classified evidence, NOT a vision detector.
 * This file never infers a pocket from disappearance alone or treats a
 * physics prediction as a camera observation. Node and browser compatible.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChalklineFoundation = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PHASES = Object.freeze(['SETUP', 'ARMED', 'STRIKE_PENDING', 'IN_MOTION', 'SETTLING', 'RESOLVED', 'UNCERTAIN', 'VIEW_INVALID']);
  const ACTIVITIES = Object.freeze(['clear', 'shooting', 'practice', 'handling', 'racking', 'occluding', 'unknown']);
  const STRIKES = Object.freeze(['none', 'candidate', 'supported']);
  const POCKET_EVIDENCE = Object.freeze(['candidate', 'supported']);
  const DEFAULTS = Object.freeze({ settleSeconds: 0.50, strikeWindowSeconds: 0.55, pocketAbsenceSeconds: 0.30, occlusionGraceSeconds: 1.5, length: 78, width: 39, ft: 7 });
  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const copy = v => JSON.parse(JSON.stringify(v));
  const round = v => Math.round(v * 100) / 100;
  const numbered = n => n === null || n === undefined || (Number.isInteger(n) && n >= 0 && n <= 15);

  class FoundationEngine {
    constructor(options = {}) {
      this.cfg = { ...DEFAULTS, ...options };
      for (const k of ['length', 'width', 'ft', 'settleSeconds', 'strikeWindowSeconds', 'pocketAbsenceSeconds', 'occlusionGraceSeconds']) {
        if (!finite(this.cfg[k]) || this.cfg[k] <= 0) throw new Error('invalid config: ' + k);
      }
      this.reset();
    }
    reset() {
      this.t = -Infinity;
      this.revision = null;
      this.phase = 'SETUP';
      this.cameraValid = false;
      this.clearView = false;
      this.balls = new Map(); // physical track key is not the ball number
      this.events = [];
      this.shots = [];
      this.active = null;
      this.pending = null;
      this.stillSince = null;
      this.lastActivity = null;
      this.motionUnverified = false;
      this.lastEvidence = 'No evidence yet';
      this.frameNo = 0;
      return this.snapshot();
    }
    event(type, status, t, details = {}) {
      const event = Object.freeze({ id: 'E' + String(this.events.length + 1).padStart(3, '0'), t: round(t), type, status, ...copy(details) });
      this.events.push(event);
      this.lastEvidence = type;
      return event;
    }
    validate(f) {
      if (!f || !finite(f.t) || f.t <= this.t) throw new Error('timestamps must strictly increase');
      if (!f.camera || typeof f.camera.valid !== 'boolean' || typeof f.camera.revision !== 'string' || !f.camera.revision)
        throw new Error('camera validity and revision required');
      if (!f.view || typeof f.view.clear !== 'boolean') throw new Error('view.clear required');
      if (!f.table || typeof f.table.moving !== 'boolean') throw new Error('table.moving required');
      if (!f.player || !ACTIVITIES.includes(f.player.activity)) throw new Error('player.activity required');
      if (!f.cue || !STRIKES.includes(f.cue.strike)) throw new Error('cue.strike required');
      if (f.cue.strike !== 'none' && (typeof f.cue.evidenceRef !== 'string' || !f.cue.evidenceRef))
        throw new Error('strike evidenceRef required');
      if (!Array.isArray(f.balls) || !Array.isArray(f.pocketEntries || []) || !Array.isArray(f.corrections || []))
        throw new Error('balls/pocketEntries/corrections must be arrays');
      const seen = new Set();
      for (const b of f.balls) {
        if (!b || typeof b.track !== 'string' || !b.track || seen.has(b.track)) throw new Error('duplicate/invalid physical track');
        seen.add(b.track);
        if (!numbered(b.number)) throw new Error('invalid ball number');
        if (!finite(b.x) || !finite(b.y) || b.x < 0 || b.y < 0 || b.x > this.cfg.length || b.y > this.cfg.width)
          throw new Error('ball outside table');
        if (b.conf !== undefined && (!finite(b.conf) || b.conf < 0 || b.conf > 1)) throw new Error('invalid identity confidence');
      }
      for (const e of (f.pocketEntries || [])) {
        if (!e || typeof e.track !== 'string' || !e.track || typeof e.pocket !== 'string' || !e.pocket ||
            !POCKET_EVIDENCE.includes(e.status) || typeof e.evidenceRef !== 'string' || !e.evidenceRef)
          throw new Error('invalid pocket evidence');
      }
      for (const c of (f.corrections || [])) {
        if (!c || typeof c.track !== 'string' || !c.track || !numbered(c.number) ||
            typeof c.evidenceRef !== 'string' || !c.evidenceRef) throw new Error('invalid correction evidence');
      }
      return f;
    }
    abort(t, why) {
      if (this.active) {
        const a = this.active;
        const shot = { id:a.id, tStart:a.tStart, tEnd:round(t), status:'uncertain', pocketed:[], unconfirmedPocketTracks:[...a.pockets.keys()], why };
        this.shots.push(Object.freeze(shot));
        this.event('shot-unresolved', 'uncertain', t, { shot:a.id, why });
        this.active = null;
      }
      if (this.pending) this.event('strike-cancelled', 'uncertain', t, { evidenceRef:this.pending.evidenceRef, why });
      this.pending = null;
      this.stillSince = null;
    }
    markUnknown() {
      for (const [key, b] of this.balls) {
        if (b.status !== 'pocketed') this.balls.set(key, { ...b, status:'unknown', source:'inferred', conf:Math.min(b.conf, 0.49), absentSince:this.t });
      }
    }
    observeBalls(f) {
      const present = new Set();
      const names = new Map();
      for (const b of f.balls) if (b.number != null && (b.conf ?? 0.5) >= 0.75)
        names.set(b.number, (names.get(b.number) || 0) + 1);
      const duplicated = [...names.entries()].filter(([, n]) => n > 1).map(([n]) => n).sort((a,b)=>a-b);
      if (duplicated.length) this.event('identity-conflict', 'uncertain', f.t, { numbers:duplicated });
      for (const obs of f.balls) {
        present.add(obs.track);
        const previous = this.balls.get(obs.track);
        const correcting = (f.corrections || []).some(c => c.track === obs.track);
        const proposed = obs.number == null ? (previous?.number ?? null) : obs.number;
        const conf = obs.conf ?? (obs.number == null ? 0.5 : 0.75);
        let number = proposed, confidence = conf, source = 'observed';
        // A high-confidence conflict is not resolved by choosing the most recent label.
        if (duplicated.includes(proposed)) { number = null; confidence = 0; source = 'inferred'; }
        else if (!correcting && previous && previous.source === 'confirmed' && previous.number != null && obs.number !== undefined && obs.number !== null && obs.number !== previous.number) {
          this.event('identity-disagreement', 'uncertain', f.t, { track:obs.track, confirmed:previous.number, observed:obs.number });
          number = previous.number; confidence = previous.conf; source = 'confirmed';
        } else if (!correcting && previous && previous.number != null && obs.number != null && previous.number !== obs.number && previous.conf >= 0.75 && conf >= 0.75) {
          this.event('identity-disagreement', 'uncertain', f.t, { track:obs.track, prior:previous.number, observed:obs.number });
          number = null; confidence = 0; source = 'inferred';
        } else if (previous?.source === 'confirmed' && previous.number === proposed) {
          confidence = 1; source = 'confirmed';
        } else if (obs.number == null && previous?.number != null) {
          confidence = Math.min(previous.conf, 0.74); source = 'inferred';
        }
        this.balls.set(obs.track, { track:obs.track, number, x:round(obs.x), y:round(obs.y), conf:confidence,
          status:'on', source, seenAt:f.t, absentSince:null });
      }
      for (const [track, b] of this.balls) {
        if (present.has(track) || b.status === 'pocketed') continue;
        this.balls.set(track, { ...b, status:'unknown', source:'inferred', conf:Math.min(b.conf, 0.49),
          absentSince:b.absentSince == null ? f.t : b.absentSince });
      }
      for (const corr of (f.corrections || [])) {
        const current = this.balls.get(corr.track);
        if (!current) {
          this.event('correction-unmatched', 'uncertain', f.t, { track:corr.track, evidenceRef:corr.evidenceRef });
          continue;
        }
        if (corr.number != null) for (const [track, b] of this.balls) {
          if (track !== corr.track && b.number === corr.number && b.status !== 'pocketed') {
            this.balls.set(track, { ...b, number:null, conf:0, source:'inferred' });
            this.event('identity-displaced', 'uncertain', f.t, { track, number:corr.number, by:corr.track });
          }
        }
        this.balls.set(corr.track, { ...current, number:corr.number ?? null, conf:corr.number == null ? 0 : 1, source:'confirmed' });
        this.event('identity-correction', 'confirmed', f.t, { track:corr.track, from:current.number, to:corr.number ?? null, evidenceRef:corr.evidenceRef });
      }
    }
    processPocketEntries(f) {
      for (const entry of (f.pocketEntries || [])) {
        if (entry.status === 'candidate') {
          if (this.active) this.active.candidates.add(entry.track);
          this.event('pocket-candidate', 'candidate', f.t, entry);
        } else if (this.active) {
          this.active.pockets.set(entry.track, { pocket:entry.pocket, evidenceRef:entry.evidenceRef, t:f.t });
          this.event('pocket-entry', 'supported', f.t, entry);
        } else {
          this.event('pocket-outside-shot', 'uncertain', f.t, entry);
        }
      }
    }
    complete(f) {
      const active = this.active;
      if (!active) return;
      const pocketed = [], unconfirmed = [];
      for (const [track, e] of active.pockets) {
        const ball = this.balls.get(track);
        const supported = ball && ball.status === 'unknown' && ball.absentSince != null &&
          f.t - ball.absentSince >= this.cfg.pocketAbsenceSeconds && f.view.clear;
        if (!supported) { unconfirmed.push(track); continue; }
        const datum = { track, number:ball.number, pocket:e.pocket,
          evidence:[e.evidenceRef, 'clear-settled-absence@' + round(f.t)] };
        pocketed.push(datum);
        this.balls.set(track, { ...ball, status:'pocketed', source:'inferred' });
        this.event('pocket-supported', 'supported', f.t, datum);
      }
      for (const track of active.candidates) if (!pocketed.some(p=>p.track===track) && !unconfirmed.includes(track)) unconfirmed.push(track);
      const doubtful = active.occluded || unconfirmed.length > 0;
      const shot = Object.freeze({ id:active.id, tStart:active.tStart, tEnd:round(f.t),
        status:doubtful?'uncertain':'supported', pocketed, unconfirmedPocketTracks:unconfirmed,
        why:active.occluded?'view occluded during shot':unconfirmed.length?'pocket evidence not confirmed':null });
      this.shots.push(shot);
      this.event('shot-complete', shot.status, f.t, { shot:shot.id, pockets:pocketed.length, unconfirmedPocketTracks:unconfirmed });
      this.active = null;
      this.stillSince = null;
      this.phase = doubtful?'UNCERTAIN':'RESOLVED';
    }
    step(raw) {
      const f = this.validate(raw);
      const wasClear = this.clearView;
      const changed = this.revision != null && this.revision !== f.camera.revision;
      this.t = f.t;
      this.frameNo += 1;
      this.cameraValid = f.camera.valid;
      this.clearView = f.view.clear;
      if (changed || !f.camera.valid) {
        if (changed) this.event('calibration-changed', 'uncertain', f.t, { from:this.revision, to:f.camera.revision });
        this.revision = f.camera.revision;
        this.abort(f.t, changed?'camera calibration changed':'camera invalid');
        this.markUnknown();
        this.phase = 'VIEW_INVALID';
        if (this.lastActivity !== 'camera-invalid') this.event('camera-invalid', 'uncertain', f.t, { revision:this.revision });
        this.lastActivity = 'camera-invalid';
        this.motionUnverified = false;
        return this.snapshot();
      }
      this.revision = f.camera.revision;
      if (this.lastActivity === 'camera-invalid') this.event('camera-restored', 'candidate', f.t, { revision:this.revision });
      this.observeBalls(f);
      const activity = f.player.activity;
      if (activity === 'handling' || activity === 'racking' || activity === 'practice') {
        this.abort(f.t, 'human activity: ' + activity);
        if (activity !== this.lastActivity) this.event('player-interaction', 'supported', f.t, { activity });
        this.phase = 'SETUP';
        this.lastActivity = activity;
        this.motionUnverified = false;
        return this.snapshot();
      }
      if (activity === 'occluding' || !f.view.clear) {
        if (this.active) this.active.occluded = true;
        if (activity !== this.lastActivity || wasClear !== f.view.clear)
          this.event('view-obscured', 'uncertain', f.t, { activity, clear:f.view.clear });
      }
      this.processPocketEntries(f);
      const cueVisible = [...this.balls.values()].some(b => b.number === 0 && b.status === 'on' && b.conf >= 0.75);
      const ready = cueVisible && f.view.clear && (activity === 'clear' || activity === 'shooting');
      if (f.cue.strike === 'candidate') this.event('strike-candidate', 'candidate', f.t, { evidenceRef:f.cue.evidenceRef });
      if (f.cue.strike === 'supported' && !this.active && !this.pending) {
        if (ready) {
          this.pending = { t:f.t, evidenceRef:f.cue.evidenceRef };
          this.event('strike-supported', 'supported', f.t, { evidenceRef:f.cue.evidenceRef });
          this.phase = 'STRIKE_PENDING';
        } else {
          this.event('strike-unusable', 'uncertain', f.t, { evidenceRef:f.cue.evidenceRef, why:'cue/view/activity not ready' });
        }
      }
      if (this.pending) {
        const p = this.pending;
        if (f.t - p.t > this.cfg.strikeWindowSeconds) {
          this.event('strike-not-followed-by-motion', 'uncertain', f.t, { evidenceRef:p.evidenceRef });
          this.pending = null;
          this.phase = 'SETUP';
        } else if (f.table.moving && ready) {
          const shotId = 'S' + String(this.shots.length + 1).padStart(3, '0');
          this.active = { id:shotId, tStart:round(p.t), pockets:new Map(), candidates:new Set(), occluded:false };
          this.pending = null;
          this.stillSince = null;
          this.motionUnverified = false;
          this.event('shot-start', 'supported', f.t, { shot:shotId, strikeEvidence:p.evidenceRef });
          this.phase = 'IN_MOTION';
        }
      }
      if (this.active) {
        if (f.table.moving) { this.phase = 'IN_MOTION'; this.stillSince = null; }
        else if (f.view.clear) {
          if (this.stillSince == null) this.stillSince = f.t;
          this.phase = 'SETTLING';
          if (f.t - this.stillSince >= this.cfg.settleSeconds) this.complete(f);
        } else if (f.t - this.active.tStart > this.cfg.occlusionGraceSeconds) {
          this.abort(f.t, 'view obscured beyond allowed window');
          this.phase = 'UNCERTAIN';
        }
      } else if (!this.pending) {
        if (!['RESOLVED', 'UNCERTAIN'].includes(this.phase)) this.phase = ready && !f.table.moving ? 'ARMED' : 'SETUP';
        if (f.table.moving && !this.motionUnverified) {
          this.event('motion-without-verified-strike', 'uncertain', f.t, { activity });
          this.motionUnverified = true;
          if (this.phase !== 'RESOLVED') this.phase = 'UNCERTAIN';
        }
        if (!f.table.moving) this.motionUnverified = false;
      }
      this.lastActivity = activity;
      return this.snapshot();
    }
    snapshot() {
      return copy({ t:Number.isFinite(this.t)?round(this.t):null, phase:this.phase,
        revision:this.revision, cameraValid:this.cameraValid, clearView:this.clearView,
        frameNo:this.frameNo, activeShot:this.active?.id ?? null,
        balls:[...this.balls.values()].map(b => ({ ...b, seenAt:round(b.seenAt) })),
        shots:this.shots, events:this.events, lastEvidence:this.lastEvidence,
        config:{ ft:this.cfg.ft, length:this.cfg.length, width:this.cfg.width } });
    }
    // Adapter payload for existing src/state.js makeState(); does NOT call physics.
    toSharedState() {
      const balls = [...this.balls.values()].map(b => ({ id:b.number,
        x:b.status==='on'?b.x:null, y:b.status==='on'?b.y:null,
        status:b.status, source:b.source, conf:b.conf, sd:b.status==='on'?0.75:2 }));
      const counts = new Map();
      for (const b of balls) if (b.id != null && b.status !== 'pocketed') counts.set(b.id, (counts.get(b.id)||0)+1);
      for (const b of balls) if (b.id != null && b.status !== 'pocketed' && counts.get(b.id)>1) { b.id=null; b.conf=0; }
      return copy({ft:this.cfg.ft, pocketScale:1, origin:'camera', t:Number.isFinite(this.t)?this.t:0,
        game:{rules:'none'},balls});
    }
  }
  return Object.freeze({ FoundationEngine, PHASES, ACTIVITIES, STRIKES, DEFAULTS });
});
