'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {FoundationEngine, PHASES} = require('../src/foundation/engine.js');
const {scenarios, frame, ball, strike, pocket} = require('../scenarios/scenarios.js');
const run = id => {
  const e = new FoundationEngine();
  const s = scenarios.find(v=>v.id===id);
  if (!s) throw new Error('unknown scenario ' + id);
  for (const f of s.frames) e.step(f);
  return e;
};
const count = (e,type) => e.events.filter(x=>x.type===type).length;
const ball0 = (track='CB')=>ball(track,0,18,19);
const b1 = ()=>ball('OB1',1,47,19);

test('exports the required named lifecycle phases',()=>{
  assert.ok(PHASES.includes('VIEW_INVALID'));
  assert.ok(PHASES.includes('SETTLING'));
});
test('idle evidence arms the engine without inventing a shot',()=>{
  const e=new FoundationEngine();
  const snap=e.step(frame(0));
  assert.equal(snap.phase,'ARMED');
  assert.equal(snap.shots.length,0);
});
test('clean make: supported shot and supported pocket',()=>{
  const e=run('clean-make');
  assert.equal(e.shots.length,1);
  assert.equal(e.shots[0].status,'supported');
  assert.deepEqual(e.shots[0].pocketed.map(x=>x.number),[1]);
  assert.equal(e.balls.get('OB1').status,'pocketed');
});
test('clean miss: a shot with no pocket',()=>{
  const e=run('clean-miss');
  assert.equal(e.shots.length,1);
  assert.equal(e.shots[0].status,'supported');
  assert.deepEqual(e.shots[0].pocketed,[]);
});
test('practice strokes do not become shots',()=>{
  const e=run('practice');
  assert.equal(e.shots.length,0);
  assert.equal(count(e,'shot-start'),0);
  assert.ok(count(e,'player-interaction')>0);
});
test('ball movements under hands do not become shots',()=>{
  const e=run('ball-in-hand');
  assert.equal(e.shots.length,0);
  assert.equal(e.balls.get('CB').x,34);
});
test('racking with multiple moving balls is not a shot',()=>{
  const e=run('racking');
  assert.equal(e.shots.length,0);
  assert.equal(e.balls.get('OB2').number,2);
});
test('occlusion during shot does not yield supported result',()=>{
  const e=run('occlusion');
  assert.equal(e.shots.length,1);
  assert.equal(e.shots[0].status,'uncertain');
  assert.match(e.shots[0].why,/occluded/);
});
test('camera bump interrupts shot and requires new view',()=>{
  const e=run('camera-bump');
  assert.equal(e.shots.length,1);
  assert.equal(e.shots[0].status,'uncertain');
  assert.equal(count(e,'calibration-changed'),1);
  assert.equal(e.revision,'CAM-B');
});
test('duplicate high-confidence ball number is not guessed',()=>{
  const e=run('identity');
  assert.ok(count(e,'identity-conflict')>=1);
  assert.equal(e.balls.get('OB2').number,2);
  assert.equal(e.balls.get('OB2').source,'confirmed');
  assert.equal(e.balls.get('OB1').number,null);
});
test('candidate pocket never becomes a supported pocket',()=>{
  const e=run('pocket-only-candidate');
  assert.equal(e.shots.length,1);
  assert.equal(e.shots[0].status,'uncertain');
  assert.equal(e.shots[0].pocketed.length,0);
  assert.equal(e.balls.get('OB1').status,'unknown');
});
test('disappearance without a pocket event is not pocketed',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.2,{table:{moving:true},cue:strike()}));
  e.step(frame(.6,{table:{moving:true},balls:[ball0()]}));
  e.step(frame(.9,{balls:[ball0()]}));
  e.step(frame(1.5,{balls:[ball0()]}));
  assert.equal(e.balls.get('OB1').status,'unknown');
  assert.equal(e.shots[0].pocketed.length,0);
});
test('supported pocket event outside a shot is not awarded',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(1,{pocketEntries:[pocket()]}));
  assert.equal(count(e,'pocket-outside-shot'),1);
  assert.equal(e.shots.length,0);
});
test('pocket entry is not enough if ball is still visible',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.2,{table:{moving:true},cue:strike()}));
  e.step(frame(.4,{table:{moving:true},pocketEntries:[pocket()]}));
  e.step(frame(.8));e.step(frame(1.45));
  assert.equal(e.shots[0].pocketed.length,0);
  assert.equal(e.shots[0].status,'uncertain');
});
test('unverified motion remains uncertain',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.3,{table:{moving:true}}));
  e.step(frame(.6,{table:{moving:true}}));
  assert.equal(e.shots.length,0);
  assert.equal(count(e,'motion-without-verified-strike'),1);
});
test('candidate strike without support cannot start a shot',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.2,{cue:{strike:'candidate',evidenceRef:'audio#candidate'},table:{moving:true}}));
  assert.equal(e.shots.length,0);
  assert.equal(count(e,'strike-candidate'),1);
});
test('supported strike without motion times out',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.2,{cue:strike()}));
  e.step(frame(1));
  assert.equal(count(e,'strike-not-followed-by-motion'),1);
  assert.equal(e.shots.length,0);
});
test('handling suppresses supported strike',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.2,{player:{activity:'handling'},cue:strike(),table:{moving:true}}));
  assert.equal(count(e,'shot-start'),0);
});
test('no verified strike when a player blocks the cue',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.2,{view:{clear:false},player:{activity:'occluding'},cue:strike(),balls:[b1()]}));
  assert.equal(count(e,'strike-unusable'),1);
  assert.equal(e.shots.length,0);
});
test('camera invalid frames do not overwrite track coordinates',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.3,{camera:{valid:false,revision:'CAM-A'},balls:[ball0('CB'),ball('OB1',1,70,10)]}));
  assert.equal(e.balls.get('OB1').x,47);
  assert.equal(e.balls.get('OB1').status,'unknown');
  assert.equal(e.phase,'VIEW_INVALID');
});
test('recovers from camera invalid after a new valid observation',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.3,{camera:{valid:false,revision:'CAM-A'}}));
  e.step(frame(.6));
  assert.equal(e.phase,'ARMED');
  assert.equal(count(e,'camera-restored'),1);
});
test('rejects timestamp replay without state mutation',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  const before=e.snapshot();
  assert.throws(()=>e.step(frame(0)),/timestamps/);
  assert.deepEqual(e.snapshot(),before);
});
test('rejects out of bounds ball without state mutation',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  const before=e.snapshot();
  assert.throws(()=>e.step(frame(1,{balls:[ball('OB1',1,100,2)]})),/outside table/);
  assert.deepEqual(e.snapshot(),before);
});
test('rejects duplicate physical tracks',()=>{
  const e=new FoundationEngine();
  assert.throws(()=>e.step(frame(0,{balls:[ball0(),ball0()]})),/physical track/);
});
test('rejects missing strike provenance',()=>{
  const e=new FoundationEngine();
  assert.throws(()=>e.step(frame(0,{cue:{strike:'supported'}})),/evidenceRef/);
});
test('snapshots cannot modify engine memory',()=>{
  const e=new FoundationEngine();
  const snap=e.step(frame(0));
  snap.balls[0].number=9;
  snap.events.push({type:'forgery'});
  assert.equal(e.balls.get('CB').number,0);
  assert.equal(e.events.length,0);
});
test('events have monotonic unique ids',()=>{
  const e=run('clean-make');
  assert.deepEqual(e.events.map(x=>x.id),e.events.map((_,i)=>'E'+String(i+1).padStart(3,'0')));
});
test('shared state adapter separates camera state from physics',()=>{
  const e=run('clean-miss');
  const state=e.toSharedState();
  assert.equal(state.origin,'camera');
  assert.equal(state.game.rules,'none');
  assert.ok(state.balls.some(b=>b.id===0&&b.status==='on'));
  assert.ok(state.balls.every(b=>b.source==='observed'||b.source==='inferred'||b.source==='confirmed'));
});
test('correction is traceable and remains confirmed on consistent evidence',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.4,{corrections:[{track:'OB1',number:2,evidenceRef:'owner#label'}],balls:[ball0(),ball('OB1',2,47,19)]}));
  e.step(frame(.7,{balls:[ball0(),ball('OB1',2,47,19)]}));
  assert.equal(e.balls.get('OB1').source,'confirmed');
  assert.equal(e.balls.get('OB1').number,2);
  assert.equal(count(e,'identity-correction'),1);
});
test('real identity contradiction with a player correction is reported',()=>{
  const e=new FoundationEngine();
  e.step(frame(0));
  e.step(frame(.4,{corrections:[{track:'OB1',number:2,evidenceRef:'owner#label'}],balls:[ball0(),ball('OB1',2,47,19)]}));
  e.step(frame(.7,{balls:[ball0(),ball('OB1',3,47,19)]}));
  assert.equal(e.balls.get('OB1').number,2);
  assert.equal(count(e,'identity-disagreement'),1);
});
test('configuration rejects non-physical durations and sizes',()=>{
  assert.throws(()=>new FoundationEngine({settleSeconds:0}),/invalid config/);
  assert.throws(()=>new FoundationEngine({width:-1}),/invalid config/);
});
