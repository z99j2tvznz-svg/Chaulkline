/* Chalkline Fieldwork 0.2 — Safari photo session UI. All image data stays local until a user exports/shares. */
(function(root){
'use strict';
if(typeof document==='undefined')return;
const F=root.Fieldwork;const $=id=>document.getElementById(id);const show=(el,visible)=>{el.hidden=!visible;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const pad=i=>String(i).padStart(2,'0');
const state={session:null,sessions:[],step:'home',selection:0,view:'overlay',editing:false,dragIndex:-1,
  camera:null,busy:false,saveError:null,bundle:null,bundleFor:null,dragChanged:false};
function now(){return new Date().toISOString();}
function makeID(){return (crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.floor(Math.random()*1e6)}`).slice(0,32);}
function formatDate(t){try{return new Date(t).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}catch{return t||'unknown';}}
function toast(msg,error=false){const box=$('toast');box.textContent=(error?'NOTICE — ':'')+msg;box.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.hidden=true,6000);}
function log(s){if(state.session)state.session.log.push(`${now()} ${s}`);}
async function persist(){
  if(!state.session)return;
  try{await F.saveSession(state.session);state.saveError=null;}catch(e){state.saveError=e.message;toast('Could not save this session locally: '+e.message+' — export your ZIP before closing.',true);}
}
async function refreshSessions(){try{state.sessions=await F.readSessions();}catch(e){state.sessions=[];$('footerMessage').textContent='LOCAL STORAGE UNAVAILABLE / EXPORT BEFORE CLOSING';}}
function metaSummary(frames){
  const counts={pass:0,review:0,fail:0,pending:0};
  frames.forEach(fr=>{const s=fr.analysis?.status||'pending';counts[s]=(counts[s]||0)+1;});return counts;
}
function setSession(s){state.session=s;state.selection=0;state.editing=false;state.bundle=null;state.bundleFor=null;state.busy=false;state.dragIndex=-1;updateAll();}
function navigate(step){
  if(!state.session&&step!=='home'){toast('Start or load a session first.',true);return;}
  if(step==='capture'&&state.step!=='capture'){}
  if(state.step==='capture'&&step!=='capture')stopCamera();
  state.step=step;document.querySelectorAll('.screen').forEach(s=>show(s,s.id==='screen-'+step));
  document.querySelectorAll('.step').forEach(el=>el.classList.toggle('active',el.dataset.step===step));
  if(step==='review')displayReview();
  if(step==='export')renderExport();
  updateAll();root.scrollTo?.({top:0,behavior:'instant'});
}
function makeSession(synthetic=false){return {id:makeID(),createdAt:now(),tableSizeFeet:Number($('tableSizeSelect').value)||7,
  frames:[],synthetic,device:{userAgent:navigator.userAgent,platform:navigator.platform||'',language:navigator.language||''},log:[`${now()} Session opened. Synthetic=${synthetic}`]};}
async function newSession(){const s=makeSession();setSession(s);await persist();await refreshSessions();navigate('capture');}
function revokeAfter(image){const url=image.dataset.objectUrl;if(url){URL.revokeObjectURL(url);delete image.dataset.objectUrl;}}
function setBlobImage(img,blob){
  revokeAfter(img);if(!blob){img.removeAttribute('src');return;}
  const url=URL.createObjectURL(blob);img.dataset.objectUrl=url;
  img.onload=()=>{if(img.dataset.objectUrl===url){URL.revokeObjectURL(url);delete img.dataset.objectUrl;}};
  img.onerror=()=>{if(img.dataset.objectUrl===url){URL.revokeObjectURL(url);delete img.dataset.objectUrl;}};
  img.src=url;
}
function blobToImage(blob){
  return new Promise((resolve,reject)=>{
    const img=new Image(),url=URL.createObjectURL(blob);
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Browser cannot decode this image. Try JPEG or PNG.'));};img.src=url;
  });
}
function canvasBlob(canvas,type='image/jpeg',quality=.88){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Canvas export failed')),type,quality));}
function canvasFromImage(img,max=1600){
  const scale=Math.min(1,max/Math.max(img.naturalWidth||img.videoWidth||img.width,img.naturalHeight||img.videoHeight||img.height));
  const w=Math.max(1,Math.round((img.naturalWidth||img.videoWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.videoHeight||img.height)*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;canvas.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0,w,h);return canvas;
}
async function captureFromSource(blob,filename,opts={}){
  if(!state.session)throw new Error('Create a session first');
  if(state.session.frames.length>=10)throw new Error('10 images maximum in one session');
  const img=await blobToImage(blob),width=img.naturalWidth,height=img.naturalHeight;
  if(width<120||height<100)throw new Error('Photo is too small');
  const canvas=canvasFromImage(img,1600),normalized=await canvasBlob(canvas);
  const frame={id:makeID(),filename:filename||`capture_${pad(state.session.frames.length+1)}.jpg`,capturedAt:now(),dimensions:{width:canvas.width,height:canvas.height,sourceWidth:width,sourceHeight:height},
    original:normalized,source:opts.isCamera?null:blob,sourceFilename:filename||null,
    normalization:{fromCamera:!!opts.isCamera,resized:width!==canvas.width||height!==canvas.height,sourceType:blob.type||'unknown',analyzedType:'image/jpeg'},
    synthetic:!!opts.synthetic,overlay:null,rectified:null,analysis:null,autoAnalysis:null};
  state.session.frames.push(frame);state.bundle=null;state.bundleFor=null;log(`Added frame ${state.session.frames.length}: ${frame.filename} ${canvas.width}x${canvas.height} from ${width}x${height}`);
  await persist();updateAll();return frame;
}
async function fromFileInput(files){
  if(!state.session)await newSession();
  let count=0;
  for(const f of files){
    try{await captureFromSource(f,f.name,{isCamera:false});count++;}
    catch(e){toast(`${f.name}: ${e.message}`,true);if(state.session.frames.length>=10)break;}
  }
  if(count)toast(`${count} photo${count===1?'':'s'} added. Analysis is ready.`);
}
async function startCamera(){
  if(!navigator.mediaDevices?.getUserMedia){toast('Live camera needs an HTTPS page. Use camera-roll import instead.',true);return;}
  try{stopCamera();const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1080}}});
    state.camera=stream;const video=$('cameraVideo');video.srcObject=stream;await video.play();
    $('cameraBody').classList.add('camera-on');$('cameraPlaceholder').hidden=true;$('cameraStatus').textContent='LIVE / CAMERA CONNECTED';
    $('takePhotoBtn').disabled=false;$('stopCameraBtn').disabled=false;$('startCameraBtn').disabled=true;
  }catch(e){stopCamera();toast(`Camera could not start: ${e.message}. You can choose photos from Files.`,true);}
}
function stopCamera(){
  state.camera?.getTracks().forEach(t=>t.stop());state.camera=null;
  const vid=$('cameraVideo');vid.pause();vid.srcObject=null;
  $('cameraBody').classList.remove('camera-on');$('cameraPlaceholder').hidden=false;
  $('cameraStatus').textContent='CAMERA OFF';$('takePhotoBtn').disabled=true;$('stopCameraBtn').disabled=true;$('startCameraBtn').disabled=false;
}
async function takePhoto(){
  const video=$('cameraVideo');if(!state.camera||!video.videoWidth){toast('Camera is not ready.',true);return;}
  try{const canvas=canvasFromImage(video,1920),blob=await canvasBlob(canvas,'image/jpeg',.92);
    await captureFromSource(blob,`camera_${pad(state.session.frames.length+1)}.jpg`,{isCamera:true});toast('Frame captured.');
  }catch(e){toast('Capture failed: '+e.message,true);}
}
function drawPoly(ctx,pts,close=true){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));if(close)ctx.closePath();}
function drawOverlay(canvas,analysis){
  const ctx=canvas.getContext('2d'),table=analysis?.table;
  if(!table){
    ctx.save();ctx.fillStyle='rgba(219,76,55,.90)';ctx.fillRect(8,8,Math.min(330,canvas.width-16),38);
    ctx.fillStyle='white';ctx.font='bold 17px monospace';ctx.fillText('NO TABLE REFERENCE',18,34);ctx.restore();return;
  }
  const w=canvas.width,scale=Math.max(1,w/1100),q=table.virtualCorners||table.corners;
  function segment(a,b,t0,t1){
    const p=[a[0]+(b[0]-a[0])*t0,a[1]+(b[1]-a[1])*t0],r=[a[0]+(b[0]-a[0])*t1,a[1]+(b[1]-a[1])*t1];
    ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...r);ctx.stroke();
  }
  ctx.save();ctx.lineCap='round';
  // Cyan = the four inner cushion-nose lines. Segments across corner/side pocket
  // gaps are dashed because no physical cushion exists through a pocket opening.
  table.rails.forEach((r,i)=>{
    ctx.lineWidth=3.5*scale;ctx.strokeStyle='#f9dd6e';ctx.setLineDash([]);
    if(i%2===0){segment(r.a,r.b,.07,.44);segment(r.a,r.b,.56,.93);}
    else segment(r.a,r.b,.07,.93);
    ctx.strokeStyle='#fff8e8';ctx.lineWidth=2*scale;ctx.setLineDash([5*scale,6*scale]);
    segment(r.a,r.b,0,.07);segment(r.a,r.b,.93,1);
    if(i%2===0)segment(r.a,r.b,.44,.56);
  });
  ctx.setLineDash([]);
  // Virtual sharp: intersection of extended nose lines. NOT a physical pocket mouth.
  q.forEach((p,i)=>{
    const [x,y]=p,rad=13*scale;
    ctx.strokeStyle='#141c26';ctx.lineWidth=5*scale;
    ctx.beginPath();ctx.moveTo(x-rad,y);ctx.lineTo(x+rad,y);ctx.moveTo(x,y-rad);ctx.lineTo(x,y+rad);ctx.stroke();
    ctx.strokeStyle='#fff9de';ctx.lineWidth=2.3*scale;ctx.stroke();
    ctx.font=`bold ${13*scale}px monospace`;ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.lineWidth=3*scale;ctx.strokeStyle='#162935';ctx.strokeText('V'+(i+1),x+rad+4,y-12*scale);
    ctx.fillStyle='#fff9de';ctx.fillText('V'+(i+1),x+rad+4,y-12*scale);
  });
  // The image may show dark *regions* near expected pockets. Their centroids are
  // not measured jaw points or proven pocket centres; never use as scored outcomes.
  table.pockets.forEach((p,i)=>{
    const [x,y]=p.p,rad=6*scale;
    ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.lineWidth=2.4*scale;
    ctx.strokeStyle=p.observed?'#c8fba0':'#f9a980';ctx.stroke();
    if(p.observed&&p.darkRegionCentroid){
      const [px,py]=p.darkRegionCentroid;
      ctx.fillStyle='#9af1c1';ctx.fillRect(px-2.5*scale,py-2.5*scale,5*scale,5*scale);
    }
    if(p.kind==='side'){
      ctx.textAlign='left';ctx.font=`bold ${14*scale}px monospace`;ctx.fillStyle='#fff9de';ctx.strokeStyle='#162935';ctx.lineWidth=3*scale;
      ctx.strokeText('S?',x+9*scale,y-9*scale);ctx.fillText('S?',x+9*scale,y-9*scale);
    }
  });
  // Diamond proposals may not be true rail markings: show them as small outlines.
  for(const d of table.diamonds){
    const [x,y]=d.point,rad=3.5*scale;
    ctx.beginPath();ctx.moveTo(x,y-rad);ctx.lineTo(x+rad,y);ctx.lineTo(x,y+rad);ctx.lineTo(x-rad,y);ctx.closePath();
    ctx.strokeStyle=d.observed?'#9af1c1':'#f9a980';ctx.lineWidth=1.7*scale;ctx.stroke();
  }
  ctx.save();const nose=table.geometrySource==='virtual_intersection_of_image_fitted_noses';
  const mode=analysis.method==='manual-adjusted'?'MANUAL VIRTUAL CORNERS':(nose?'NOSE LINES FIT':'NOSE LINES UNVERIFIED');
  const text=`REVIEW • ${mode} • POCKET OPENINGS UNVERIFIED`;
  ctx.font=`bold ${13*scale}px monospace`;const rectW=Math.min(w-16,ctx.measureText(text).width+30*scale);
  ctx.fillStyle='rgba(19,37,47,.94)';ctx.fillRect(8,8,rectW,34*scale);ctx.fillStyle='#fff';ctx.textAlign='left';ctx.fillText(text,18*scale,26*scale);
  ctx.restore();ctx.restore();
}
function drawJpegImage(img){const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d',{willReadFrequently:true}).drawImage(img,0,0);return c;}
async function buildDerived(frame,canvas){
  const ov=document.createElement('canvas');ov.width=canvas.width;ov.height=canvas.height;ov.getContext('2d').drawImage(canvas,0,0);
  drawOverlay(ov,frame.analysis);frame.overlay=await canvasBlob(ov,'image/jpeg',.88);
  const H=frame.analysis?.table?.homography;
  if(!H){frame.rectified=null;return;}
  const pix=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
  const result=F.rectifiedPixels(pix,H,880,440);
  if(!result){frame.rectified=null;return;}
  const dst=document.createElement('canvas');dst.width=result.width;dst.height=result.height;
  dst.getContext('2d').putImageData(new ImageData(result.data,result.width,result.height),0,0);
  frame.rectified=await canvasBlob(dst,'image/jpeg',.90);
}
async function analyzeFrame(i,manualQuad=null){
  if(!state.session)throw new Error('No active session');const fr=state.session.frames[i],img=await blobToImage(fr.original),canvas=drawJpegImage(img);
  const pix=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height);
  let analysis;
  if(manualQuad){
    analysis=F.calculateGeometry(pix,manualQuad,{method:'manual-adjusted',geometryConfidence:.65});
    analysis.imageSize={width:canvas.width,height:canvas.height};analysis.options={tableSizeFeet:state.session.tableSizeFeet};
  }else analysis=F.analyzePixels(pix,{tableSizeFeet:state.session.tableSizeFeet});
  if(!manualQuad){fr.autoAnalysis=structuredClone(analysis);}
  fr.analysis=analysis;await buildDerived(fr,canvas);
  log(`Analyzed ${i+1}: ${analysis.status} ${analysis.method} ${analysis.metrics?.cornersObserved||0}/4 corners ${analysis.metrics?.sidesObserved||0}/2 sides ${analysis.metrics?.diamondsObserved||0}/18 diamonds`);
  state.bundle=null;state.bundleFor=null;
  return analysis;
}
async function analyzeAll(){
  if(state.busy)return;
  if(!state.session?.frames.length){toast('Capture at least one frame first.',true);navigate('capture');return;}
  state.busy=true;$('runAnalysisBtn').disabled=true;$('analysisBadge').textContent='RUNNING';
  let done=0,errors=0;
  try{
    for(let i=0;i<state.session.frames.length;i++){
      $('analysisProgressText').textContent=`Analyzing photo ${i+1} of ${state.session.frames.length}…`;
      await sleep(15);
      try{await analyzeFrame(i);}catch(e){errors++;const fr=state.session.frames[i];fr.analysis={status:'fail',reason:e.message,version:F.VISION_VERSION,method:'auto-felt-segmentation',metrics:{cornersObserved:0,sidesObserved:0,diamondsObserved:0}};fr.overlay=null;fr.rectified=null;log('Processing failed frame '+(i+1)+': '+e.message);}
      done++;$('analysisMeter').style.width=Math.round(100*done/state.session.frames.length)+'%';
      $('analysisProgressNumber').innerHTML=pad(Math.round(100*done/state.session.frames.length))+'<span>%</span>';
      renderAnalysisList();await sleep(15);
    }
    await persist();$('analysisProgressText').textContent=`${done} photos analyzed locally. ${errors} runtime failure(s).`;
    $('analysisBadge').textContent='COMPLETE';toast('Analysis complete. Inspect evidence, not just the status label.');
  }finally{state.busy=false;$('runAnalysisBtn').disabled=false;updateAll();}
}
function frameStatus(f){return f.analysis?.status||'pending';}
function updateAll(){
  const s=state.session,c=s?.frames.length||0,n=metaSummary(s?.frames||[]);
  $('sessionTopName').textContent=s?`SESSION ${s.id.slice(0,8).toUpperCase()}`:'NO SESSION';
  $('asideSessionId').textContent=s?`#${s.id.slice(0,8)}`:'—';$('asideSessionDate').textContent=s?formatDate(s.createdAt):'Create a session to begin.';
  $('tableSizeSelect').value=String(s?.tableSizeFeet||7);$('asideFrames').textContent=`${pad(c)} / 10`;
  $('asideFound').textContent=pad(n.pass+n.review);$('asideReview').textContent=pad(n.review+n.fail);
  $('captureCounter').innerHTML=`${pad(c)}<span>/10</span>`;
  $('captureStatusText').textContent=c>=5?`${c} CAPTURES / TARGET REACHED`:`${c} OF 5 MINIMUM RECOMMENDED`;
  $('captureHint').textContent=c<5?`Capture ${5-c} more image${5-c===1?'':'s'} for a complete set. You can still analyze now.`:'Capture set ready. Continue to analysis.';
  $('captureNextBtn').disabled=c===0;
  $('analysisNextBtn').disabled=c===0||n.pending===c;
  $('reviewNextBtn').disabled=c===0;
  if(state.step==='capture')renderThumbs();
  if(state.step==='analyze')renderAnalysisList();
  if(state.step==='review')renderReviewFilmstrip();
  renderInstrument();renderExport();
}
function renderThumbs(){const node=$('captureThumbs');node.replaceChildren();const frames=state.session?.frames||[];
  if(!frames.length){const div=document.createElement('div');div.className='empty-thumbs';div.textContent='YOUR IMAGES WILL APPEAR HERE.';node.append(div);return;}
  frames.forEach((fr,i)=>{const div=document.createElement('div');div.className='thumb';const img=document.createElement('img');img.alt='Capture '+(i+1);setBlobImage(img,fr.original);const b=document.createElement('b');b.textContent=pad(i+1);
    const rem=document.createElement('button');rem.type='button';rem.title='Remove photo '+(i+1);rem.ariaLabel='Remove photo '+(i+1);rem.textContent='×';rem.addEventListener('click',async()=>{if(state.busy)return;state.session.frames.splice(i,1);state.selection=Math.max(0,Math.min(state.selection,state.session.frames.length-1));state.bundle=null;await persist();updateAll();});
    div.append(img,b,rem);node.append(div);
  });
}
function renderSessions(){const node=$('sessionsList');node.replaceChildren();$('sessionCount').textContent=`${state.sessions.length} LOCAL RECORD${state.sessions.length===1?'':'S'}`;
  if(!state.sessions.length){const p=document.createElement('div');p.className='empty-sessions';p.textContent='No saved sessions yet. Start with photos or try the synthetic demo.';node.append(p);return;}
  for(const s of state.sessions){
    const row=document.createElement('div');row.className='session-entry';const letter=document.createElement('div');letter.className='session-letter';letter.textContent=s.synthetic?'S':'F';
    const body=document.createElement('div');const b=document.createElement('b');b.textContent=(s.synthetic?'SYNTHETIC / ':'SESSION / ')+s.id.slice(0,8).toUpperCase();
    const sub=document.createElement('small');const n=metaSummary(s.frames);sub.textContent=`${formatDate(s.createdAt)} · ${s.frames.length} photos · ${n.pass} pass / ${n.review} review / ${n.fail} fail`;
    body.append(b,sub);const buttons=document.createElement('div');buttons.className='session-actions';
    const open=document.createElement('button');open.textContent='OPEN ↗';open.type='button';open.addEventListener('click',()=>{setSession(s);navigate(s.frames.some(fr=>fr.analysis)?'review':'capture');});
    const del=document.createElement('button');del.textContent='DELETE';del.type='button';del.className='delete';del.addEventListener('click',async()=>{if(!confirm('Delete this locally stored session and all photos?'))return;try{await F.deleteSession(s.id);if(state.session?.id===s.id)state.session=null;await refreshSessions();renderSessions();updateAll();}catch(e){toast(e.message,true);}});
    buttons.append(open,del);row.append(letter,body,buttons);node.append(row);
  }
}
function renderAnalysisList(){const node=$('analysisFrameList');node.replaceChildren();const s=state.session;
  if(!s?.frames.length){node.textContent='No photos captured.';return;}
  s.frames.forEach((fr,i)=>{const el=document.createElement('div');el.className='analysis-row';
    const first=document.createElement('span');first.className='frame-index';first.textContent=pad(i+1);
    const title=document.createElement('div'),b=document.createElement('strong');b.textContent=fr.filename||`Capture ${i+1}`;const sm=document.createElement('small');
    sm.textContent=fr.analysis?`${fr.analysis.metrics?.cornersObserved??0}/4 corners · ${fr.analysis.metrics?.sidesObserved??0}/2 sides · ${fr.analysis.metrics?.diamondsObserved??0}/18 diamonds`:'Not yet analyzed';title.append(b,sm);
    const tag=document.createElement('span');tag.className=`status-tag ${frameStatus(fr)}`;tag.textContent=frameStatus(fr)==='review'?'REVIEW':frameStatus(fr).toUpperCase();
    const btn=document.createElement('button');btn.type='button';btn.textContent='VIEW ↗';btn.onclick=()=>{state.selection=i;navigate('review');};
    el.append(first,title,tag,btn);node.append(el);
  });
  const counts=metaSummary(s.frames);if(!state.busy){$('analysisBadge').textContent=counts.pending?'READY / PARTIAL':'COMPLETE';const progress=(s.frames.length-counts.pending)/s.frames.length*100;$('analysisMeter').style.width=progress+'%';$('analysisProgressNumber').innerHTML=pad(Math.round(progress))+'<span>%</span>';}
}
function renderReviewFilmstrip(){const node=$('reviewFilmstrip');node.replaceChildren();(state.session?.frames||[]).forEach((fr,i)=>{
  const b=document.createElement('button');b.className='film-item'+(state.selection===i?' selected':'');b.type='button';
  const img=document.createElement('img');img.alt='Frame '+(i+1);setBlobImage(img,fr.original);const txt=document.createElement('small');txt.textContent=pad(i+1)+' / '+frameStatus(fr).toUpperCase();b.append(img,txt);
  b.onclick=()=>{state.selection=i;state.editing=false;displayReview();updateAll();};node.append(b);
});}
function renderInstrument(){const node=$('evidenceReadout');node.replaceChildren();const title=document.createElement('h3');title.textContent='SELECTED FRAME';node.append(title);
  const fr=state.session?.frames[state.selection];if(!fr){const p=document.createElement('p');p.textContent='No frame selected.';node.append(p);return;}
  const table=fr.analysis?.table;
  const row=(a,b)=>{const div=document.createElement('div');div.className='readout-item';const l=document.createElement('span');l.textContent=a;const v=document.createElement('strong');v.textContent=String(b);div.append(l,v);node.append(div);};
  row('FRAME',`${state.selection+1} / ${state.session.frames.length}`);row('STATUS',frameStatus(fr).toUpperCase());
  row('MODE',fr.analysis?.method||'NOT RUN');row('CORNERS',`${fr.analysis?.metrics?.cornersObserved||0} / 4`);
  row('SIDE POCKETS',`${fr.analysis?.metrics?.sidesObserved||0} / 2`);row('DIAMONDS',`${fr.analysis?.metrics?.diamondsObserved||0} / 18`);
  row('GEOM. SCORE',table?.geometryConfidence?.toFixed(2)??'—');
  if(fr.analysis?.warnings?.length){const p=document.createElement('p');p.textContent=fr.analysis.warnings.join(' • ');node.append(p);}
  else if(fr.analysis?.reason){const p=document.createElement('p');p.textContent=fr.analysis.reason;node.append(p);}
}
async function displayReview(){
  const fr=state.session?.frames[state.selection],canvas=$('reviewCanvas'),place=$('reviewPlaceholder'),top=$('topdownImage');
  state.editing=false;show($('canvasEditBanner'),false);$('editCornersBtn').textContent='ADJUST 4 VIRTUAL CORNERS';$('resetCornersBtn').hidden=!fr?.autoAnalysis||!fr.analysis||fr.analysis.method!=='manual-adjusted';
  if(!fr){canvas.width=800;canvas.height=450;canvas.getContext('2d').clearRect(0,0,800,450);place.hidden=false;top.removeAttribute('src');show($('noTopdown'),true);return;}
  $('reviewFrameCount').textContent=`FRAME ${pad(state.selection+1)} / ${pad(state.session.frames.length)}`;
  try{
    const blob=state.view==='overlay'&&fr.overlay?fr.overlay:fr.original;
    const img=await blobToImage(blob);if(fr!==state.session?.frames[state.selection])return;
    canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);
    place.hidden=true;
    setBlobImage(top,fr.rectified);show($('noTopdown'),!fr.rectified);
  }catch(e){place.textContent='Image could not be displayed: '+e.message;place.hidden=false;}
}
function selectedFrame(){return state.session?.frames[state.selection];}
function canvasCoords(evt){const canvas=$('reviewCanvas'),r=canvas.getBoundingClientRect();return[(evt.clientX-r.left)*canvas.width/r.width,(evt.clientY-r.top)*canvas.height/r.height];}
function drawManualHandles(){const fr=selectedFrame(),q=fr?.analysis?.table?.corners;if(!q)return;const canvas=$('reviewCanvas'),ctx=canvas.getContext('2d');
  const rad=Math.max(10,canvas.width*.012);ctx.save();
  q.forEach(([x,y],i)=>{ctx.fillStyle='#fdecda';ctx.strokeStyle='#db4d33';ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.font=`bold ${rad}px monospace`;ctx.fillStyle='#263943';ctx.textAlign='center';ctx.fillText(String(i+1),x,y+rad*.35);
  });ctx.restore();
}
async function toggleCorners(){const fr=selectedFrame();if(!fr?.analysis?.table){toast('This photo has no detected corners. Recapture with the whole playing surface visible.',true);return;}
  if(state.view!=='overlay'){$('reviewCanvas').getContext('2d');state.view='overlay';document.querySelectorAll('.toggle').forEach(t=>t.classList.toggle('active',t.dataset.view==='overlay'));await displayReview();}
  state.editing=!state.editing;show($('canvasEditBanner'),state.editing);
  $('editCornersBtn').textContent=state.editing?'FINISH CORNER EDIT':'ADJUST 4 CORNERS';
  if(state.editing){state.dragImage=await blobToImage(fr.overlay||fr.original);drawManualHandles();}else await displayReview();
}
async function saveManualGeometry(){const fr=selectedFrame();if(!fr?.analysis?.table)return;
  const points=fr.analysis.table.corners;
  if(!state.dragChanged)return;
  state.dragChanged=false;
  try{await analyzeFrame(state.selection,points);await persist();updateAll();$('resetCornersBtn').hidden=false;
    // Keep editing mode and show manual handles after overlay regeneration.
    const img=await blobToImage(fr.overlay);const c=$('reviewCanvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);if(state.editing)drawManualHandles();
    state.dragImage=img;setBlobImage($('topdownImage'),fr.rectified);show($('noTopdown'),!fr.rectified);
  }catch(e){toast('Corner adjustment rejected: '+e.message,true);}
}
async function revertCorners(){const fr=selectedFrame();if(!fr)return;state.editing=false;
  await analyzeFrame(state.selection);await persist();await displayReview();updateAll();toast('Re-ran automatic table finding; manual correction removed.');
}
function renderExport(){const fr=state.session?.frames||[],c=metaSummary(fr);$('exportImages').textContent=pad(fr.length);
  $('exportPass').textContent=`${pad(c.pass)} / ${pad(c.review)}`;$('exportReview').textContent=pad(c.fail+c.review+c.pending);
  const label=state.session?.id.slice(0,8)||'session';const d=(state.session?.createdAt||now()).slice(0,10);
  $('exportFilename').textContent=`chalkline_fieldwork_${d}_${label}.zip`;
  $('exportZipBtn').disabled=fr.length===0;$('shareZipBtn').disabled=fr.length===0;
}
async function getBundle(){
  const s=state.session;if(!s?.frames.length)throw new Error('No photos to export');
  // The bundle cache is invalidated after every photo/analyze/edit operation.
  if(state.bundle&&state.bundleFor===s.id)return state.bundle;
  const blob=await F.sessionToZip(s);state.bundle=blob;state.bundleFor=s.id;return blob;
}
async function exportZip(share){
  const btn=share?$('shareZipBtn'):$('exportZipBtn'),prev=btn.textContent;btn.disabled=true;btn.textContent='PACKAGING…';
  try{const blob=await getBundle(),name=$('exportFilename').textContent,file=new File([blob],name,{type:'application/zip'});
    if(share&&navigator.canShare?.({files:[file]})&&navigator.share){
      try{await navigator.share({files:[file],title:'Chalkline Fieldwork Review Bundle'});toast('Shared via your device.');}
      catch(e){if(e.name!=='AbortError')throw e;}
    }else{
      if(share)toast('Share Sheet is unavailable here. The ZIP will download instead.');
      const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
      toast('ZIP ready. Save it to Files and attach it in your Chalkline chat.');
    }
  }catch(e){toast('Could not export ZIP: '+e.message,true);}finally{btn.disabled=false;btn.textContent=prev;}
}
async function importBundle(file){
  try{const s=await F.zipToSession(file);setSession(s);await persist();await refreshSessions();renderSessions();navigate('review');toast('Bundle imported into local storage.');}
  catch(e){toast('Import rejected: '+e.message,true);}
}
function drawDemo(canvas,shift=0){
  // SYNTHETIC FIXTURE — not a photograph, not an accuracy validation.
  const ctx=canvas.getContext('2d');const w=canvas.width,h=canvas.height;
  ctx.fillStyle='#344449';ctx.fillRect(0,0,w,h);
  ctx.save();ctx.translate(shift*3,shift*2);
  let q=[[183,158],[1030,112],[1120,558],[112,610]];
  const c=q.reduce((s,p)=>[s[0]+p[0]/4,s[1]+p[1]/4],[0,0]);
  const outer=q.map(p=>[c[0]+(p[0]-c[0])*1.13,c[1]+(p[1]-c[1])*1.16]);
  ctx.fillStyle='#735337';drawPoly(ctx,outer);ctx.fill();ctx.lineWidth=8;ctx.strokeStyle='#a98358';ctx.stroke();
  ctx.fillStyle='#1c736a';drawPoly(ctx,q);ctx.fill();ctx.lineWidth=9;ctx.strokeStyle='#164f4e';ctx.stroke();
  for(let i=0;i<6;i++){
    const u=[0,.5,1,1,.5,0][i],v=[0,0,0,1,1,1][i],p=F.project(F.homography(q),u,v);
    ctx.beginPath();ctx.fillStyle='#0c1519';ctx.arc(p[0],p[1],i===1||i===4?23:22,0,Math.PI*2);ctx.fill();
  }
  const H=F.homography(q);const expected=F.diamondProposals(H);
  for(const d of expected){const n=F.outwardNormal(q,d.rail);let x=d.point[0]+n[0]*26,y=d.point[1]+n[1]*26;
    ctx.fillStyle='#f6efe3';ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.fill();}
  for(let j=0;j<8;j++){
    const p=F.project(H,.18+(.57*(j%4)/4),.20+.21*(Math.floor(j/4))),r=10;
    ctx.beginPath();ctx.arc(p[0],p[1],r,0,Math.PI*2);ctx.fillStyle=['#faf8e9','#e6b436','#2562a3','#9f252e'][j%4];ctx.fill();
    ctx.strokeStyle='rgba(0,0,0,.3)';ctx.lineWidth=2;ctx.stroke();
  }
  ctx.restore();return canvas;
}
async function addDemo(){if(state.busy)return;state.busy=true;
  try{
    const s=makeSession(true);setSession(s);for(let i=0;i<5;i++){
      const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;drawDemo(canvas,i-2);
      const blob=await canvasBlob(canvas,'image/jpeg',.94);await captureFromSource(blob,`SYNTHETIC_fixture_${pad(i+1)}.jpg`,{isCamera:true,synthetic:true});
    }
    await persist();await refreshSessions();navigate('analyze');state.busy=false;await analyzeAll();toast('Synthetic demonstration processed; not a real-world accuracy test.');
  }catch(e){toast(e.message,true);}finally{state.busy=false;}
}
function listen(){
  $('brandHome').onclick=e=>{e.preventDefault();navigate('home');};
  document.querySelectorAll('.step').forEach(b=>b.onclick=()=>navigate(b.dataset.step));
  $('newSessionBtn').onclick=newSession;$('demoBtn').onclick=addDemo;
  $('tableSizeSelect').onchange=async e=>{if(!state.session)return;state.session.tableSizeFeet=Number(e.target.value);state.bundle=null;state.bundleFor=null;
    for(const fr of state.session.frames){if(fr.analysis)fr.analysis.options={...(fr.analysis.options||{}),tableSizeFeet:state.session.tableSizeFeet};if(fr.autoAnalysis)fr.autoAnalysis.options={...(fr.autoAnalysis.options||{}),tableSizeFeet:state.session.tableSizeFeet};}
    log('Table size changed to '+state.session.tableSizeFeet);await persist();updateAll();};
  $('startCameraBtn').onclick=startCamera;$('stopCameraBtn').onclick=stopCamera;$('takePhotoBtn').onclick=takePhoto;
  $('photosInput').onchange=async e=>{await fromFileInput([...e.target.files]);e.target.value='';};
  $('captureNextBtn').onclick=()=>navigate('analyze');$('runAnalysisBtn').onclick=analyzeAll;$('analysisNextBtn').onclick=()=>navigate('review');
  $('reviewNextBtn').onclick=()=>navigate('export');$('exportZipBtn').onclick=()=>exportZip(false);$('shareZipBtn').onclick=()=>exportZip(true);
  $('importInput').onchange=async e=>{if(e.target.files?.[0])await importBundle(e.target.files[0]);e.target.value='';};
  document.querySelectorAll('.toggle').forEach(t=>t.onclick=async()=>{state.view=t.dataset.view;document.querySelectorAll('.toggle').forEach(b=>b.classList.toggle('active',b===t));await displayReview();});
  $('editCornersBtn').onclick=toggleCorners;$('resetCornersBtn').onclick=revertCorners;
  const canvas=$('reviewCanvas');
  canvas.addEventListener('pointerdown',evt=>{
    if(!state.editing||!selectedFrame()?.analysis?.table)return;
    const p=canvasCoords(evt),q=selectedFrame().analysis.table.corners;
    const radius=Math.max(40,canvas.width*.045);let best=-1,dist=radius;
    q.forEach((v,i)=>{const d=F.distance(p,v);if(d<dist){dist=d;best=i;}});
    if(best<0)return;state.dragIndex=best;state.dragChanged=false;canvas.setPointerCapture(evt.pointerId);evt.preventDefault();
  });
  canvas.addEventListener('pointermove',evt=>{
    if(!state.editing||state.dragIndex<0)return;
    const fr=selectedFrame(),pt=canvasCoords(evt);
    fr.analysis.table.corners[state.dragIndex]=[Math.max(0,Math.min(canvas.width-1,pt[0])),Math.max(0,Math.min(canvas.height-1,pt[1]))];
    state.dragChanged=true;
    const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
    // During drag, show previous exported overlay behind the provisional handles.
    if(state.dragImage){ctx.drawImage(state.dragImage,0,0,canvas.width,canvas.height);}
    drawManualHandles();evt.preventDefault();
  });
  canvas.addEventListener('pointerup',async evt=>{if(state.dragIndex<0)return;state.dragIndex=-1;
    if(canvas.hasPointerCapture(evt.pointerId))canvas.releasePointerCapture(evt.pointerId);await saveManualGeometry();});
  canvas.addEventListener('pointercancel',()=>{state.dragIndex=-1;state.dragChanged=false;displayReview();});
  $('helpBtn').onclick=()=>show($('helpModal'),true);$('closeHelpBtn').onclick=()=>show($('helpModal'),false);
  $('helpContinueBtn').onclick=()=>show($('helpModal'),false);
  $('helpModal').onclick=e=>{if(e.target===$('helpModal'))show($('helpModal'),false);};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')show($('helpModal'),false);});
  root.addEventListener('pagehide',stopCamera);
}
async function init(){listen();await refreshSessions();renderSessions();updateAll();navigate('home');
  root.FieldworkApp={state,makeSession,makeID,captureFromSource,analyzeFrame,analyzeAll,navigate,importBundle,exportZip,addDemo};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);