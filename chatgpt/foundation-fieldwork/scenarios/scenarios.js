/* Synthetic frames only. These are NOT real footage measurements. */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.ChalklineScenarios = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ball=(track,number,x,y,conf=0.97)=>({track,number,x,y,conf});
  const C=(x=17,y=19)=>ball('CB',0,x,y);
  const O=(x=47,y=19,number=1,conf=0.98)=>ball('OB1',number,x,y,conf);
  const frame=(t,opts={})=>({
    t, camera:{valid:true,revision:'CAM-A'}, table:{moving:false},
    view:{clear:true}, player:{activity:'clear'}, cue:{strike:'none'},
    balls:[C(),O()], pocketEntries:[], corrections:[], ...opts
  });
  const strike=(ref='clip#strike')=>({strike:'supported',evidenceRef:ref});
  const candidate=(ref='clip#cue-motion')=>({strike:'candidate',evidenceRef:ref});
  const pocket=(status='supported')=>({track:'OB1',pocket:'right-side',status,evidenceRef:'clip#pocket-mouth'});
  const scenarios=[
    {id:'clean-make',name:'Clean pocket',kind:'SHOT',description:'A supported cue strike, continuous ball movement, supported pocket entry and settled absence.',expect:'One supported shot; one supported pocket.',frames:[
      frame(0), frame(.2,{table:{moving:true},cue:strike(),balls:[C(20),O()]}),
      frame(.45,{table:{moving:true},balls:[C(29),O(61,18)]}),
      frame(.75,{table:{moving:true},balls:[C(34),O(75,19)],pocketEntries:[pocket()]}),
      frame(1.05,{table:{moving:true},balls:[C(39)]}),
      frame(1.45,{balls:[C(40)]}),frame(2.05,{balls:[C(40)]})
    ]},
    {id:'clean-miss',name:'Clean miss',kind:'SHOT',description:'A real stroke and ball motion, without a pocket event.',expect:'One supported shot; zero pockets.',frames:[
      frame(0),frame(.2,{table:{moving:true},cue:strike(),balls:[C(19),O()]}),
      frame(.5,{table:{moving:true},balls:[C(27),O(52)]}),
      frame(.95,{balls:[C(32),O(56)]}),frame(1.58,{balls:[C(32),O(56)]})
    ]},
    {id:'practice',name:'Practice strokes',kind:'HUMAN',description:'Cue/arm motion labelled as practice, but no real supported strike.',expect:'No shot should be recorded.',frames:[
      frame(0),frame(.2,{player:{activity:'practice'},cue:candidate(),balls:[C(),O()]}),
      frame(.45,{player:{activity:'practice'},table:{moving:true},balls:[C(),O()]}),
      frame(.7,{player:{activity:'practice'},balls:[C(),O()]}),frame(1.2)
    ]},
    {id:'ball-in-hand',name:'Moving balls by hand',kind:'HUMAN',description:'Player manually repositions the cue ball and an object ball.',expect:'No shot should be recorded.',frames:[
      frame(0),frame(.3,{table:{moving:true},player:{activity:'handling'},balls:[C(28),O(50)]}),
      frame(.5,{player:{activity:'handling'},balls:[C(34),O(54)]}),
      frame(1.1,{balls:[C(34),O(54)]})
    ]},
    {id:'racking',name:'Building a rack',kind:'HUMAN',description:'Several balls move while the player is racking; no stroke.',expect:'No shot should be recorded.',frames:[
      frame(0),frame(.3,{table:{moving:true},player:{activity:'racking'},balls:[C(),O(57),ball('OB2',2,60,20),ball('OB3',3,61,17)]}),
      frame(.6,{table:{moving:true},player:{activity:'racking'},balls:[C(),O(62),ball('OB2',2,65,20),ball('OB3',3,65,16)]}),
      frame(1.1,{balls:[C(),O(62),ball('OB2',2,65,20),ball('OB3',3,65,16)]})
    ]},
    {id:'occlusion',name:'Player blocks the view',kind:'VISIBILITY',description:'A shot occurs, but the player hides the table before the result can be verified.',expect:'A shot exists but must remain uncertain.',frames:[
      frame(0),frame(.2,{table:{moving:true},cue:strike(),balls:[C(20),O()]}),
      frame(.45,{table:{moving:true},view:{clear:false},player:{activity:'occluding'},balls:[C(28)]}),
      frame(.7,{table:{moving:true},balls:[C(35),O(54)]}),
      frame(1,{balls:[C(36),O(54)]}),frame(1.62,{balls:[C(36),O(54)]})
    ]},
    {id:'camera-bump',name:'Camera repositioned',kind:'CAMERA',description:'Calibration changes in the middle of a shot. Old observations become uncertain.',expect:'The interrupted shot is uncertain and the view re-arms.',frames:[
      frame(0),frame(.2,{table:{moving:true},cue:strike(),balls:[C(20),O()]}),
      frame(.5,{table:{moving:true},camera:{valid:true,revision:'CAM-B'},balls:[C(32),O(54)]}),
      frame(.9,{camera:{valid:true,revision:'CAM-B'},balls:[C(32),O(54)]})
    ]},
    {id:'identity',name:'Identity disagreement',kind:'EVIDENCE',description:'Two physical tracks are both labelled as the same number; the system refuses to guess.',expect:'Conflicting names become unknown, followed by an explicit player correction.',frames:[
      frame(0),frame(.3,{balls:[C(),O(),ball('OB2',2,58,20)]}),
      frame(.6,{balls:[C(),O(48,19,1,.99),ball('OB2',1,58,20,.99)]}),
      frame(.9,{balls:[C(),O(48,19,null,.55),ball('OB2',null,58,20,.55)],corrections:[{track:'OB2',number:2,evidenceRef:'owner#manual-2'}]})
    ]},
    {id:'pocket-only-candidate',name:'Unconfirmed pocket',kind:'EVIDENCE',description:'A ball disappears and a pocket entry is only a candidate.',expect:'Never award a supported pocket without supported entry evidence.',frames:[
      frame(0),frame(.2,{table:{moving:true},cue:strike(),balls:[C(19),O()]}),
      frame(.5,{table:{moving:true},balls:[C(30),O(73,19)],pocketEntries:[pocket('candidate')]}),
      frame(.8,{table:{moving:true},balls:[C(37)]}),
      frame(1.2,{balls:[C(40)]}),frame(1.82,{balls:[C(40)]})
    ]}
  ];
  return Object.freeze({scenarios,frame,ball,strike,pocket});
});