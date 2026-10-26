/* Chalkline Fieldwork — automatic PHOTO candidate detector, fully on device.
 * Derived in approach from existing Chalkline cloth segmentation. Does NOT assert real-world accuracy.
 * 'observed' requires an image signal. Geometry-derived pockets/diamonds are PROPOSALS until evidence is found.
 */
(function(root){
  'use strict';
  const ns=root.Fieldwork || (root.Fieldwork={});
  const G=(typeof module==='object'&&module.exports)?require('./geometry.js'):ns;
  const V='photo-nose-lines/0.2.0',clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  function hsv(r,g,b){
    r/=255;g/=255;b/=255;
    const max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;
    let h=0;
    if(d){if(max===r)h=((g-b)/d)%6;else if(max===g)h=(b-r)/d+2;else h=(r-g)/d+4;h=(h*60+360)%360;}
    return [h,max?d/max:0,max];
  }
  const hd=(a,b)=>{const d=Math.abs(a-b)%360;return Math.min(d,360-d);};
  function largest(mask,w,h){
    const seen=new Uint8Array(mask.length),stack=new Int32Array(mask.length);
    let best=null,bestCount=0;
    for(let i=0;i<mask.length;i++){
      if(!mask[i]||seen[i])continue;
      let n=0,head=0,tail=1;stack[0]=i;seen[i]=1;
      const coords=[];
      while(head<tail){const p=stack[head++],x=p%w,y=(p/w)|0;n++;coords.push(p);
        if(x>0&&mask[p-1]&&!seen[p-1]){seen[p-1]=1;stack[tail++]=p-1;}
        if(x<w-1&&mask[p+1]&&!seen[p+1]){seen[p+1]=1;stack[tail++]=p+1;}
        if(y>0&&mask[p-w]&&!seen[p-w]){seen[p-w]=1;stack[tail++]=p-w;}
        if(y<h-1&&mask[p+w]&&!seen[p+w]){seen[p+w]=1;stack[tail++]=p+w;}
      }
      if(n>bestCount){bestCount=n;best=coords;}
    }
    return best;
  }
  function tableFromPixels(img){
    const {width:W,height:H,data}=img;
    if(W<120||H<100) return {quad:null,reasons:['Image is too small to analyze.']};
    const st=Math.max(1,Math.ceil(Math.max(W,H)/420)),w=Math.ceil(W/st),h=Math.ceil(H/st);
    const hue=new Uint16Array(w*h),sat=new Float32Array(w*h),val=new Float32Array(w*h),hist=new Float32Array(36);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const ix=Math.min(W-1,x*st),iy=Math.min(H-1,y*st),i=y*w+x,j=(iy*W+ix)*4,[hh,s,v]=hsv(data[j],data[j+1],data[j+2]);
      hue[i]=hh;sat[i]=s;val[i]=v;
      if(s>.65&&v>.49&&v<.99) hist[Math.floor(hh/10)%36]+=s*v;
    }
    const peaks=Array.from({length:36},(_,i)=>[hist[i]*2+hist[(i+35)%36]+hist[(i+1)%36],i]).sort((a,b)=>b[0]-a[0]);
    let best=null;
    for(const [,i] of peaks){
      if(!best&&peaks[0][0]<1)break;
      if(best&&hd(best.hue,i*10+5)<21)continue;
      if(best&&best.iterations>=4)break;
      const center=i*10+5,mask=new Uint8Array(w*h);
      for(let k=0;k<mask.length;k++)if(hd(hue[k],center)<15&&sat[k]>.62&&val[k]>.45)mask[k]=1;
      const comp=largest(mask,w,h);if(!comp||comp.length<w*h*.045)continue;
      let border=0,xc=0,yc=0;
      const rl=new Int32Array(h).fill(w),rr=new Int32Array(h).fill(-1),ct=new Int32Array(w).fill(h),cb=new Int32Array(w).fill(-1);
      for(const k of comp){const x=k%w,y=(k/w)|0;xc+=x;yc+=y;
        rl[y]=Math.min(rl[y],x);rr[y]=Math.max(rr[y],x);ct[x]=Math.min(ct[x],y);cb[x]=Math.max(cb[x],y);
        if(x<2||y<2||x>w-3||y>h-3)border++;
      }
      const boundary=[];
      for(let y=0;y<h;y++)if(rr[y]>=0){boundary.push([rl[y],y],[rr[y],y]);}
      for(let x=0;x<w;x++)if(cb[x]>=0){boundary.push([x,ct[x]],[x,cb[x]]);}
      let hull=G.convexHull(boundary);
      // Large irregular masks can yield many hull vertices. Subsample while retaining extremes.
      if(hull.length>48){const stride=hull.length/48;hull=Array.from({length:48},(_,j)=>hull[Math.floor(j*stride)]);}
      const q0=G.bestQuad(hull);if(!q0)continue;
      const quad=G.orderedQuad(q0.map(p=>[clamp((p[0]+.5)*st,0,W-1),clamp((p[1]+.5)*st,0,H-1)]));
      if(!G.validQuad(quad,W,H))continue;
      const coverage=comp.length/(w*h),quadArea=G.area(q0),fill=quadArea>0?comp.length/quadArea:0;
      const cx=xc/comp.length,cy=yc/comp.length,central=1-clamp(Math.hypot(cx-w/2,cy-h/2)/(.65*Math.hypot(w,h)));
      const borderShare=border/comp.length;
      const score=coverage*(.55+.45*central)*clamp(fill,.2,1.15)*(1-clamp(borderShare*12,0,.65))*(center>80&&center<255?1.15:1);
      if(!best||score>best.score){best={quad,hue:center,coverage,fill,borderShare,score,iterations:0};}
      if(best)best.iterations=(best.iterations||0)+1;
    }
    if(!best)return {quad:null,reasons:['Could not isolate one complete felt surface. Keep all six pockets visible, use good light, avoid large occlusions.']};
    const geometryConfidence=clamp((best.coverage-.035)/.25)*.42+clamp(best.fill/.90)*.38+(1-clamp(best.borderShare*12))*.20;
    return {...best,geometryConfidence,reasons:[]};
  }
  function lightDarkNear(img,px,py,rad,mode='dark'){
    const {width:w,height:h,data}=img;
    let n=0,hits=0,luma=0,cx=0,cy=0;
    const r=Math.max(2,Math.min(46,rad)),x0=Math.max(0,Math.floor(px-r)),x1=Math.min(w-1,Math.ceil(px+r));
    const y0=Math.max(0,Math.floor(py-r)),y1=Math.min(h-1,Math.ceil(py+r));
    const rsq=r*r,step=(r>18?2:1);
    for(let y=y0;y<=y1;y+=step)for(let x=x0;x<=x1;x+=step){
      if((x-px)**2+(y-py)**2>rsq)continue;
      const i=(y*w+x)*4,R=data[i],Gr=data[i+1],B=data[i+2],hi=Math.max(R,Gr,B),lo=Math.min(R,Gr,B);
      const ok=mode==='dark'?hi<75:(hi>180&&hi-lo<75);
      if(ok){hits++;cx+=x;cy+=y;}luma+=.21*R+.72*Gr+.07*B;n++;
    }
    return {fraction:n?hits/n:0,centroid:hits?[cx/hits,cy/hits]:[px,py],mean:n?luma/n:0,hits,samples:n};
  }
  function outwardNormal(q,rail){
    const a=q[rail],b=q[(rail+1)%4],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy)||1;
    const n=[dy/d,-dx/d],middle=[(a[0]+b[0])/2,(a[1]+b[1])/2];
    const c=q.reduce((s,p)=>[s[0]+p[0]/4,s[1]+p[1]/4],[0,0]);
    if((c[0]-middle[0])*n[0]+(c[1]-middle[1])*n[1]>0)return [-n[0],-n[1]];
    return n;
  }
  function pocketEvidence(img,p,q,kind){
    const range=G.distance(q[0],q[2]),rad=clamp(range*(kind==='corner'?.035:.03),5,34);
    const signal=lightDarkNear(img,p[0],p[1],rad);
    return {signal,observed:signal.hits>=5&&signal.fraction>(kind==='corner'?.07:.085),confidence:clamp((signal.fraction-.04)*2.6)};
  }
  function checkDiamonds(img,q,H){
    const proposed=G.diamondProposals(H);const minSide=Math.min(G.distance(q[0],q[3]),G.distance(q[1],q[2]));
    // Search a narrow band OUTSIDE the playing area near the known geometric mark proposal.
    return proposed.map(d=>{
      const normal=outwardNormal(q,d.rail),p=d.point;let best={score:0,point:p,fraction:0};
      const len=G.distance(q[d.rail],q[(d.rail+1)%4]),tangent=[(q[(d.rail+1)%4][0]-q[d.rail][0])/len,(q[(d.rail+1)%4][1]-q[d.rail][1])/len];
      const offsetStep=Math.max(2,Math.round(minSide*.012)),spread=Math.min(26,Math.max(10,len*.06));
      for(let j=1;j<=12;j++)for(let k=-3;k<=3;k++){
        const x=p[0]+normal[0]*offsetStep*j+tangent[0]*spread*k*.33;
        const y=p[1]+normal[1]*offsetStep*j+tangent[1]*spread*k*.33;
        const result=lightDarkNear(img,x,y,clamp(offsetStep*.36,3,10),'light');
        const contrast=Math.max(0,result.mean-100)/155;
        const score=result.fraction*contrast;
        if(score>best.score)best={score,point:[x,y],fraction:result.fraction};
      }
      // Conservative label. White/bright marks may still be reflections; never ground truth.
      const observed=best.score>.31;
      return {...d,point:observed?best.point:d.point,source:observed?'observed_candidate':'geometric_proposal',observed,confidence:observed?clamp(best.score):0,evidence:{brightContrastScore:+best.score.toFixed(3)}};
    });
  }
  // Fit the INNER cushion noses. The initial HSV blob includes cushion faces; its hull
  // is only a seed. Across each rail, scan inward for the last dark-to-felt transition,
  // robustly fit that line, and INTERSECT adjacent lines. Those intersections are
  // virtual playing-surface corners, NOT pocket centres or guaranteed pocket outcomes.
  function fitCushionNoses(img,quad,clothHue){
    const q=G.orderedQuad(quad),cx=q.reduce((s,p)=>s+p[0]/4,0),cy=q.reduce((s,p)=>s+p[1]/4,0);
    const scale=Math.max(img.width,img.height)/1600,rails=[];
    const sample=(x,y)=>{
      const ix=Math.round(x),iy=Math.round(y);
      if(ix<0||iy<0||ix>=img.width||iy>=img.height)return null;
      const j=(iy*img.width+ix)*4,[h,s,v]=hsv(img.data[j],img.data[j+1],img.data[j+2]);
      return {h,s,v};
    };
    function regression(pts,allowed){
      let n=0,st=0,ss=0,stt=0,sts=0;
      for(let i=0;i<pts.length;i++)if(allowed[i]){const t=pts[i].t-.5,s=pts[i].s;n++;st+=t;ss+=s;stt+=t*t;sts+=t*s;}
      if(n<3)return null;
      const den=n*stt-st*st;
      const slope=Math.abs(den)>1e-8?(n*sts-st*ss)/den:0;
      return {slope,offset:(ss-slope*st)/n};
    }
    for(let edge=0;edge<4;edge++){
      const a=q[edge],b=q[(edge+1)%4],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
      let nx=-dy/len,ny=dx/len;
      const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;
      if((cx-mx)*nx+(cy-my)*ny<0){nx=-nx;ny=-ny;}
      const pts=[];
      const start=-18*scale,end=54*scale,step=2*scale,probe=9*scale;
      for(let j=0;j<54;j++){
        const t=.16+(.68*j/53),px=a[0]+dx*t,py=a[1]+dy*t;
        let selected=null;
        for(let z=start;z<=end;z+=step){
          const dark=sample(px+nx*z,py+ny*z),inside=sample(px+nx*(z+probe),py+ny*(z+probe));
          if(!dark||!inside)continue;
          const contrast=inside.v-dark.v;
          if(inside.s>.56&&inside.v>155/255&&hd(inside.h,clothHue)<20&&dark.v<185/255&&contrast>72/255){
            // Last (most inward) supported transition eliminates outer cushion/trim edges.
            selected={t,s:z};
          }
        }
        if(selected)pts.push(selected);
      }
      let inliers=pts.map(()=>true),model=null;
      for(let k=0;k<3;k++){
        const f=regression(pts,inliers);if(!f)break;
        model=f;const residuals=pts.filter((p,i)=>inliers[i]).map(p=>Math.abs(p.s-(f.offset+f.slope*(p.t-.5)))).sort((a,b)=>a-b);
        const med=residuals[Math.floor(residuals.length/2)]||0,tol=Math.max(6*scale,2.4*med);
        inliers=pts.map(p=>Math.abs(p.s-(f.offset+f.slope*(p.t-.5)))<=tol);
      }
      const count=inliers.filter(Boolean).length;
      const extent=pts.length?(Math.max(...pts.map(p=>p.t))-Math.min(...pts.map(p=>p.t))):0;
      const measured=!!(model&&pts.length>=22&&count>=18&&extent>.45&&Math.abs(model.slope)<.3*len);
      const startOffset=measured?model.offset-model.slope/2:0,endOffset=measured?model.offset+model.slope/2:0;
      const a0=[a[0]+nx*startOffset,a[1]+ny*startOffset],b0=[b[0]+nx*endOffset,b[1]+ny*endOffset];
      rails.push({id:'nose_'+edge,a:a0,b:b0,source:measured?'image_transition_fit':'geometric_proposal',measured,
        evidence:{samples:pts.length,inliers:count,coverage:+(count/54).toFixed(3),medianInwardOffset:measured?+model.offset.toFixed(2):null}});
    }
    const intersections=rails.map((r,i)=>G.lineIntersection(rails[(i+3)%4].a,rails[(i+3)%4].b,r.a,r.b));
    const trusted=rails.every(r=>r.measured)&&intersections.every(Boolean)&&G.validQuad(intersections,img.width,img.height)&&
      intersections.every((p,i)=>G.distance(p,q[i])<.115*Math.max(img.width,img.height)&&p[0]>=0&&p[0]<img.width&&p[1]>=0&&p[1]<img.height);
    return {quad:trusted?intersections:q,rails,fitAccepted:!!trusted,seedQuad:q,
      reason:trusted?null:'At least one cushion-nose line lacked sufficient supported image transitions',
      geometrySource:trusted?'virtual_intersection_of_image_fitted_noses':'unverified_felt_hull'};
  }
  function calculateGeometry(img,quad,opts={}){
    const W=img.width,H=img.height,base=G.orderedQuad(quad);
    const nose=opts.noseFit||null;
    if(!G.validQuad(base,W,H))return {status:'fail',table:null,reason:'Invalid table corners: outline too small or self-crossing',version:V};
    let orientation=opts.orientation;
    let options;
    if(!orientation){
      options=['horizontal','vertical'].map(axis=>{
        const q=G.longRailQuad(base,axis),matrix=G.homography(q),pockets=G.expectedPockets(matrix);
        let score=0;
        for(const pk of pockets.filter(p=>p.kind==='side')){const ev=pocketEvidence(img,pk.p,q,'side');score+=ev.signal.fraction;}
        const elongation=(G.distance(q[0],q[1])+G.distance(q[2],q[3]))/(G.distance(q[1],q[2])+G.distance(q[3],q[0]));
        score+=clamp((elongation-1)*.03,-.05,.05);
        return {axis,score};
      });
      // Prefer the obviously longer pair of projected cushion edges. Dark shapes near
      // trim, shadow, or pockets are not a reliable way to override unmistakable length.
      const top=G.distance(base[0],base[1])+G.distance(base[2],base[3]);
      const sides=G.distance(base[1],base[2])+G.distance(base[3],base[0]);
      if(top>1.55*sides)orientation='horizontal';
      else if(sides>1.55*top)orientation='vertical';
      else{options.sort((a,b)=>b.score-a.score);orientation=options[0].axis;}
    }
    const q=G.longRailQuad(base,orientation),Hmat=G.homography(q);
    if(!Hmat)return {status:'fail',table:null,reason:'Perspective geometry is singular',version:V};
    const pockets=G.expectedPockets(Hmat).map(p=>{
      const ev=pocketEvidence(img,p.p,q,p.kind);
      return {...p,source:ev.observed?'observed_candidate':'geometric_proposal',observed:ev.observed,confidence:+ev.confidence.toFixed(3),signal:{darkFraction:+ev.signal.fraction.toFixed(3),pixels:ev.signal.hits,centroid:ev.signal.centroid}};
    });
    const diamonds=checkDiamonds(img,q,Hmat);
    const foundCorners=pockets.filter(p=>p.kind==='corner'&&p.observed).length;
    const foundSides=pockets.filter(p=>p.kind==='side'&&p.observed).length;
    const geomConfidence=Number.isFinite(opts.geometryConfidence)?opts.geometryConfidence:0.65;
    // These are heuristic evidence scores, not calibrated probabilities or precision claims.
    const evidenceScore=clamp(.48*geomConfidence+.38*(foundCorners/4)+.14*(foundSides/2));
    const warnings=[];
    if(foundCorners<4)warnings.push(`${foundCorners}/4 corner pockets have independent dark-image evidence`);
    if(foundSides<2)warnings.push(`${foundSides}/2 side pockets have independent dark-image evidence`);
    if(!diamonds.some(d=>d.observed))warnings.push('No diamond markers met the conservative bright-mark test; placements are proposals only');
    if(opts.method==='manual-adjusted')warnings.push('Four virtual intersections manually adjusted; not an automatic success');
    if(nose&&!nose.fitAccepted)warnings.push('Cushion nose intersections could not be verified; rectification is provisional');
    warnings.push('Pocket centres, jaw positions and ball drop acceptance are NOT identified by these virtual corners');
    // No PASS without independent pocket evidence. Geometry can still be useful for review.
    const status=geomConfidence<.35?'fail':'review'; // Image-dark pixels and fitted lines alone cannot prove real pocket openings.
    const railFit=nose?nose.rails:null;
    const geometrySource=opts.method==='manual-adjusted'?'user_confirmed_virtual_intersections':(nose?.geometrySource||'unverified_felt_hull');
    return {status,version:V,reason:null,warnings,table:{corners:q,virtualCorners:q,rawCorners:base,seedCorners:nose?.seedQuad||base,cornerSource:opts.method==='manual-adjusted'?'confirmed_by_user':geometrySource,geometrySource,orientation,homography:Hmat,geometryConfidence:+geomConfidence.toFixed(3),evidenceScore:+evidenceScore.toFixed(3),rails:G.rails(q).map((r,i)=>({...r,source:nose?.fitAccepted?'virtual_cushion_nose_fit':geometrySource})),railFit,pockets:pockets.map(p=>({...p,virtualReference:p.kind==='corner'?p.p:null,darkRegionCentroid:p.observed?p.signal?.centroid||null:null,openingCenterVerified:false,physicalPocketOutcome:'unknown'})),diamonds,rectifiedAspectRatio:2},metrics:{cornersObserved:foundCorners,sidesObserved:foundSides,diamondsObserved:diamonds.filter(d=>d.observed).length,diamondProposals:diamonds.length,pocketProposals:6,railProposals:4},method:opts.method||'auto-felt-segmentation',note:'Nose-line virtual corners are geometric references only; no pocket opening centre or guaranteed-ball-drop claim. Uncalibrated, review against original photo.'};
  }
  function analyzePixels(img,options={}){
    const t0=typeof performance!=='undefined'?performance.now():Date.now(),region=tableFromPixels(img);
    let analysis;
    if(!region.quad)analysis={status:'fail',reason:region.reasons[0],warnings:region.reasons,table:null,metrics:{cornersObserved:0,sidesObserved:0,diamondsObserved:0,diamondProposals:0,pocketProposals:0,railProposals:0},version:V,method:'auto-felt-segmentation'};
    else {const nose=fitCushionNoses(img,region.quad,region.hue);analysis=calculateGeometry(img,nose.quad,{geometryConfidence:region.geometryConfidence,noseFit:nose});}
    analysis.imageSize={width:img.width,height:img.height};
    analysis.tableRegion=region.quad?{hue:region.hue,coverage:+region.coverage.toFixed(3),fill:+region.fill.toFixed(3),borderShare:+region.borderShare.toFixed(4)}:null;
    analysis.processingMs=Math.round((typeof performance!=='undefined'?performance.now():Date.now())-t0);
    analysis.options={tableSizeFeet:options.tableSizeFeet||7};
    return analysis;
  }
  const api={VISION_VERSION:V,hsv,largest,tableFromPixels,fitCushionNoses,lightDarkNear,outwardNormal,pocketEvidence,checkDiamonds,calculateGeometry,analyzePixels};
  Object.assign(ns,api);
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);