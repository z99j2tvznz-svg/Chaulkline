'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const G=require('../js/geometry.js'),V=require('../js/vision.js'),B=require('../js/bundle.js');
function samePt(a,b,tol=.005){assert.ok(Math.hypot(a[0]-b[0],a[1]-b[1])<tol,`got ${a}, expected ${b}`);}
function pixels(w,h,color=[30,100,90]){
 const p=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<p.length;i+=4){p[i]=color[0];p[i+1]=color[1];p[i+2]=color[2];p[i+3]=255;}
 return {data:p,width:w,height:h};
}
function fillRect(img,x0,y0,x1,y1,c){for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const j=(y*img.width+x)*4;img.data.set(c,j);}}
test('homography maps corners and interpolates inside skew quad',()=>{
 const q=[[12,25],[380,14],[420,210],[50,250]],h=G.homography(q);
 samePt(G.project(h,0,0),q[0]);samePt(G.project(h,1,0),q[1]);
 samePt(G.project(h,1,1),q[2]);samePt(G.project(h,0,1),q[3]);
 const p=G.project(h,.5,.5);assert.ok(p[0]>150&&p[0]<290&&p[1]>85&&p[1]<185);
});
test('quad ordering preserves polygon and orientation independent of input order',()=>{
 const q=[[10,15],[180,10],[190,140],[20,160]];
 for(const p of [[q[2],q[0],q[3],q[1]],[q[3],q[1],q[2],q[0]]]){
  const a=G.orderedQuad(p);assert.ok(G.validQuad(a,220,170));assert.ok(G.area(a)>20000);
 }
});
test('invalid or collapsed quadrilaterals do not create a valid table',()=>{
 assert.equal(G.validQuad([[1,1],[1,1],[200,100],[20,100]],300,200),false);
 assert.equal(G.homography([[0,0],[0,0],[1,1],[1,0]]),null);
});
test('no felt yields FAIL and no invented pockets',()=>{
 const im=pixels(400,250,[40,42,40]);const result=V.analyzePixels(im);
 assert.equal(result.status,'fail');assert.equal(result.table,null);assert.equal(result.metrics.cornersObserved,0);
});
test('green felt rectangle is detected but pockets are not called observed without dark signal',()=>{
 const im=pixels(600,400,[90,89,90]);fillRect(im,80,90,520,320,[28,142,116,255]);
 const result=V.analyzePixels(im);
 assert.ok(result.table,'table detected');
 assert.equal(result.status,'review');
 assert.equal(result.table.pockets.length,6);
 assert.equal(result.metrics.cornersObserved,0);
 assert.equal(result.metrics.sidesObserved,0);
 assert.ok(result.table.pockets.every(p=>p.source==='geometric_proposal'));
});
test('manual geometry is tagged manual, not misreported automatic',()=>{
 const im=pixels(600,400,[80,82,80]);fillRect(im,80,70,520,320,[20,138,105,255]);
 const result=V.calculateGeometry(im,[[80,70],[520,70],[520,320],[80,320]],{method:'manual-adjusted',geometryConfidence:.65});
 assert.equal(result.method,'manual-adjusted');assert.equal(result.table.cornerSource,'confirmed_by_user');assert.ok(result.warnings.some(w=>w.includes('manually')));
});
test('rectification preserves expected pixel samples, not just an empty image',()=>{
 const im=pixels(160,80,[20,150,140]),h=G.homography([[0,0],[159,0],[159,79],[0,79]]);
 const warped=G.rectifiedPixels(im,h,80,40);assert.equal(warped.width,80);assert.equal(warped.data[0],20);
 assert.equal(warped.data[1],150);assert.equal(warped.data[2],140);
});
test('ZIP round-trip with CRC verified and binary bytes preserved',async()=>{
 const data=new Uint8Array([0,1,7,255,0,44,13]);
 const zip=await B.createZip([{name:'a.txt',data:'abc'},{name:'images/one.bin',data}]);
 const files=await B.parseZip(zip);assert.equal(new TextDecoder().decode(files.get('a.txt')),'abc');
 assert.deepEqual(files.get('images/one.bin'),data);
});
test('ZIP parser rejects checksum tampering',async()=>{
 const zip=await B.createZip([{name:'f.txt',data:'clean'}]);const bytes=new Uint8Array(await zip.arrayBuffer());
 const pos=30+'f.txt'.length;bytes[pos]^=1;
 await assert.rejects(B.parseZip(new Blob([bytes])),/checksum/i);
});
test('ZIP writer rejects path traversal and importer rejects unsupported format',async()=>{
 await assert.rejects(B.createZip([{name:'../password',data:'unsafe'}]),/Unsafe/);
 const zip=await B.createZip([{name:'any.txt',data:'hello'}]);
 await assert.rejects(B.zipToSession(zip),/Not a Fieldwork bundle/);
});
test('session ZIP exports all evidence with actual labels and imports',async()=>{
 const s={id:'local-test',createdAt:'2026-10-25T22:00:00.000Z',tableSizeFeet:9,device:{platform:'test'},log:['event'],frames:[{
  filename:'table.jpeg',capturedAt:'2026-10-25T22:01:00.000Z',dimensions:{width:100,height:80},
  original:new Blob([Uint8Array.from([255,216,255,217])],{type:'image/jpeg'}),
  source:new Blob([Uint8Array.from([5,6,7])],{type:'application/octet-stream'}),sourceFilename:'raw.png',
  overlay:new Blob([Uint8Array.from([255,216,255,217])]),rectified:new Blob([Uint8Array.from([255,216,255,217])]),
  normalization:{resized:false,sourceType:'image/png'},analysis:{status:'review',metrics:{cornersObserved:0,sidesObserved:0,diamondsObserved:0},method:'auto-felt-segmentation'}
 }]};
 const blob=await B.sessionToZip(s),files=await B.parseZip(blob);
 for(const required of ['photos/capture_001.jpg','overlays/capture_001_overlay.jpg','rectified/capture_001_topdown.jpg','analysis/capture_001.analysis.json','session_summary.json','debug_log.txt','source_originals/source_001.png'])assert.ok(files.has(required),required);
 const summary=JSON.parse(new TextDecoder().decode(files.get('session_summary.json')));
 assert.equal(summary.imageResults[0].status,'review');assert.equal(summary.tableSizeFeet,9);
 const imported=await B.zipToSession(blob);assert.equal(imported.frames.length,1);assert.equal(imported.frames[0].analysis.status,'review');assert.equal(imported.tableSizeFeet,9);
});

test('two rail nose lines cross at virtual sharp; parallel rails do not intersect',()=>{
 samePt(G.lineIntersection([0,7],[100,7],[20,-30],[20,30]),[20,7]);
 assert.equal(G.lineIntersection([0,0],[100,0],[0,20],[100,20]),null);
});
test('virtual geometry is distinct from unverified physical pocket outcome',()=>{
 const im=pixels(600,400,[90,89,90]);fillRect(im,75,60,525,330,[28,142,116,255]);
 const r=V.analyzePixels(im);assert.ok(r.table);
 assert.equal(r.table.pockets.length,6);
 assert.deepEqual(r.table.pockets[0].virtualReference,r.table.pockets[0].p);
 assert.equal(r.table.pockets[0].openingCenterVerified,false);
 assert.equal(r.table.pockets[0].physicalPocketOutcome,'unknown');
 assert.notEqual(r.status,'pass');
});
test('manually adjusted points remain explicitly user-confirmed and do not imply observed pockets',()=>{
 const im=pixels(600,400,[80,82,80]);const q=[[80,70],[520,70],[520,320],[80,320]];
 const r=V.calculateGeometry(im,q,{method:'manual-adjusted',geometryConfidence:.65});
 assert.equal(r.table.geometrySource,'user_confirmed_virtual_intersections');
 assert.equal(r.table.cornerSource,'confirmed_by_user');
 assert.equal(r.status,'review');
});

test('blue cushion band and blue flat felt must not be conflated with wood seam',()=>{
 const im=pixels(900,600,[109,107,102]);
 fillRect(im,145,120,755,520,[34,174,235,255]); // blue cushion face begins at wood seam
 fillRect(im,172,145,728,495,[0,168,246,255]); // high-chroma flat felt starts at inner nose
 const q=[[145,120],[755,120],[755,520],[145,520]];
 const fit=V.fitCushionNoses(im,q,198);
 assert.equal(fit.rails.length,4);
 for(const rail of fit.rails){
  assert.equal(rail.source,'inner_blue_face_to_felt_candidate');
  assert.ok(rail.outerSeam,'outer wood-to-blue seam retained as negative evidence');
  assert.ok(rail.evidence.innerBlueEdgeInliers>=17);
  assert.equal(rail.evidence.independentlyVerifiedPhysicalNose,false);
 }
 assert.ok(fit.quad[0][0]>=163&&fit.quad[0][0]<=182,'virtual top-left beyond outer seam');
 assert.ok(fit.quad[0][1]>=136&&fit.quad[0][1]<=153,'virtual top-left beyond outer seam');
 assert.equal(fit.fitAccepted,false,'even strong synthetic chroma evidence is not a verified physical nose');
});

test('flat uniform felt does not invent an interior cushion-nose edge',()=>{
 const im=pixels(900,600,[109,107,102]);
 fillRect(im,145,120,755,520,[0,168,246,255]);
 const fit=V.fitCushionNoses(im,[[145,120],[755,120],[755,520],[145,520]],198);
 assert.ok(fit.rails.every(r=>r.source!=='inner_blue_face_to_felt_candidate'));
 assert.ok(fit.rails.every(r=>r.outerSeam===null));
});

// Pocket Lab 0.4: a jaw must never be obtained from geometry or a dark patch
// alone. A side mouth needs a bounded gap in continuous same-colour cushions.
const PM=require('../js/pockets.js');
function fillCircle(im,cx,cy,rad,color){
 for(let y=Math.max(0,Math.floor(cy-rad));y<Math.min(im.height,Math.ceil(cy+rad));y++)
  for(let x=Math.max(0,Math.floor(cx-rad));x<Math.min(im.width,Math.ceil(cx+rad));x++)
   if(Math.hypot(x-cx,y-cy)<=rad){const k=(y*im.width+x)*4;im.data.set(color,k);}
}
test('pocket adapter provides six independent mouth records with explicit unverified physical outcomes',()=>{
 const im=pixels(800,500,[10,164,239]),q=[[100,100],[700,100],[700,400],[100,400]],H=G.homography(q);
 const p=PM.detectPocketMouths(im,q,H,200);
 assert.equal(p.length,6);assert.deepEqual(p.map(x=>x.id),['corner_TL','side_top','corner_TR','corner_BR','side_bottom','corner_BL']);
 assert.ok(p.every(x=>x.mouth.status==='unresolved' && x.mouth.jawTips.length===0));
 assert.ok(p.every(x=>x.openingCenterVerified===false && x.physicalPocketOutcome==='unknown'));
});
test('side pocket dark opening bounded by coloured cushions produces a PAIR of provisional jaw endpoints',()=>{
 const im=pixels(800,500,[7,160,234]),q=[[100,100],[700,100],[700,400],[100,400]],H=G.homography(q);
 fillCircle(im,400,100,20,[8,14,18,255]);fillCircle(im,400,400,20,[8,14,18,255]);
 const p=PM.detectPocketMouths(im,q,H,200),sides=p.filter(x=>x.kind==='side');
 for(const side of sides){assert.equal(side.mouth.status,'paired_image_candidate',side.id);
  assert.equal(side.mouth.jawTips.length,2);assert.ok(side.mouth.jawTips.every(j=>j.physicalJawVerified===false));
  assert.equal(side.mouth.openingCenterVerified,false);assert.equal(side.physicalPocketOutcome,'unknown');
  assert.ok(side.mouth.evidence.supportingDepths>=2);
 }
});
test('a dark wall without flanking cushion evidence is not misclassified as a pocket',()=>{
 const im=pixels(800,500,[11,12,15]),q=[[100,100],[700,100],[700,400],[100,400]];
 const p=PM.detectPocketMouths(im,q,G.homography(q),200);
 assert.ok(p.every(x=>x.mouth.status==='unresolved'));
});
test('unverified green felt quadrilateral has zero paired mouths despite six geometric proposals',()=>{
 const im=pixels(600,400,[90,89,90]);fillRect(im,80,90,520,320,[28,142,116,255]);
 const a=V.analyzePixels(im);
 assert.equal(a.metrics.pairedMouthCandidates,0);assert.equal(a.metrics.jawTipCandidates,0);
 assert.equal(a.table.pockets.length,6);assert.equal(a.status,'review');
});
test('even a complete synthetic mouth cannot grant a verified pocket or score a make',()=>{
 const im=pixels(800,500,[7,160,234]),q=[[100,100],[700,100],[700,400],[100,400]],H=G.homography(q);
 fillCircle(im,400,100,20,[8,14,18,255]);
 const pk=PM.detectPocketMouths(im,q,H,200)[1];
 assert.equal(pk.mouth.status,'paired_image_candidate');
 assert.equal(pk.mouth.openingCenterVerified,false);
 assert.equal(pk.physicalPocketOutcome,'unknown');
});
test('detector revision and export metadata are aligned to v0.4.0',()=>{
 assert.ok(V.VISION_VERSION.includes('/0.4.0'));
 const fs=require('fs'),html=fs.readFileSync(require('path').join(__dirname,'../index.html'),'utf8');
 assert.match(html,/id="revisionBadge"/);assert.match(html,/BUILD 0\.4\.0/);
 assert.match(html,/pockets\.js\?v=0\.4\.0/);
});
test('a tiny dark spot between blue cushions is evidence of a gap, not two physical jaw tips',()=>{
 const im=pixels(800,500,[7,160,234]),q=[[100,100],[700,100],[700,400],[100,400]],H=G.homography(q);
 fillCircle(im,400,100,6,[8,14,18,255]);
 const m=PM.detectPocketMouths(im,q,H,200)[1].mouth;
 assert.notEqual(m.status,'paired_image_candidate');
 assert.equal(m.jawTips.length,0);
});