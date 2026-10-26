/* Chalkline Fieldwork: pocket mouth evidence v0.4.
 * Pure, replaceable adapter. It DOES NOT declare actual jaw tips, exact pocket
 * centres, legal contacts, or made balls. Its endpoints are image-derived
 * projected nose-line candidates with explicit uncertainty and evidence.
 * Input: RGBA image; four virtual cushion-line intersections, normalized-table H;
 * cloth hue (degrees). Output: six pocket records with optional mouth candidates.
 */
(function(root){
  'use strict';
  const ns=root.Fieldwork||(root.Fieldwork={});
  const G=(typeof module==='object'&&module.exports)?require('./geometry.js'):ns;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const vadd=(a,b)=>[a[0]+b[0],a[1]+b[1]];
  const vscale=(a,t)=>[a[0]*t,a[1]*t];
  const DIST=G.distance;
  const DELTAS=[-2,0,2];
  const round=(x)=>Math.round(x*1000)/1000;
  function sample(img,x,y,hue){
    const ix=Math.round(x),iy=Math.round(y),w=img.width,h=img.height;
    if(ix<0||iy<0||ix>=w||iy>=h)return null;
    const k=(iy*w+ix)*4,r=img.data[k]/255,g=img.data[k+1]/255,b=img.data[k+2]/255;
    const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
    let hh=0;if(d){if(mx===r)hh=((g-b)/d)%6;else if(mx===g)hh=(b-r)/d+2;else hh=(r-g)/d+4;hh=(hh*60+360)%360;}
    const chromaDiff=Math.min(Math.abs(hh-hue),360-Math.abs(hh-hue));
    return {blue:chromaDiff<25&&d/(mx||1)>.43&&mx>.31, dark:mx<.34,
      value:mx};
  }
  function basis(q,edge){
    const a=q[edge],b=q[(edge+1)%4],len=DIST(a,b),t=[(b[0]-a[0])/len,(b[1]-a[1])/len];
    let n=[-t[1],t[0]];
    const mid=[(a[0]+b[0])/2,(a[1]+b[1])/2],c=q.reduce((s,p)=>vadd(s,vscale(p,.25)),[0,0]);
    if((c[0]-mid[0])*n[0]+(c[1]-mid[1])*n[1]>0)n=vscale(n,-1);
    return {a,b,len,t,n};
  }
  function profile(img,B,along,offset,hue){
    let blue=0,dark=0,count=0;
    for(const d of DELTAS){
      const p=vadd(vadd(B.a,vscale(B.t,along)),vscale(B.n,offset+d));
      const s=sample(img,p[0],p[1],hue);
      if(s){blue+=s.blue?1:0;dark+=s.dark?1:0;count++;}
    }
    return {blue:count?blue/count:0,dark:count?dark/count:0,valid:count===DELTAS.length};
  }
  function average(arr,from,to,key){let sum=0,n=0;for(let i=Math.max(0,from);i<Math.min(arr.length,to);i++){sum+=arr[i][key]||0;n++;}return n?sum/n:0;}
  // Blue cushion face interrupted by a dark side-pocket mouth, flanked by
  // blue on BOTH sides. A mere dark spot/wood area is not enough.
  function findSideGap(img,B,expected,hue){
    const center=(expected[0]-B.a[0])*B.t[0]+(expected[1]-B.a[1])*B.t[1];
    const M=clamp(B.len*.07,14,52),reach=M*1.7,step=1.5,span=Math.ceil(reach*2/step),options=[];
    const offsets=[0,4,8,12,16,20,24,28,32,38,44].map(v=>v*Math.max(.55,Math.min(1.25,Math.max(img.width,img.height)/1600)));
    for(const offset of offsets){
      const start=center-reach,series=[];
      for(let j=0;j<=span;j++)series.push(profile(img,B,start+j*step,offset,hue));
      const tags=series.map((_,i)=>average(series,i-1,i+2,'dark')>=.52 && average(series,i-1,i+2,'blue')<=.37);
      for(let i=0;i<tags.length;){
        if(!tags[i]){i++;continue;}
        let j=i;while(j+1<tags.length&&tags[j+1])j++;
        const len=(j-i+1)*step,lo=start+i*step,hi=start+j*step;
        const mid=(lo+hi)/2,dist=Math.abs(mid-center);
        const flank=Math.max(5,Math.round(Math.min(M*.38,21)/step));
        const blueBefore=average(series,i-flank,i-2,'blue'),blueAfter=average(series,j+3,j+flank+1,'blue');
        const voidMean=average(series,i,j+1,'dark');
        if(len>=Math.max(4.5,M*.13)&&len<M*1.55&&dist<M*.95&&blueBefore>=.54&&blueAfter>=.54&&voidMean>=.57){
          const score=(Math.min(blueBefore,blueAfter)*.6+voidMean*.4)*(1-.26*dist/M);
          options.push({lo,hi,score,offset,voidMean,blueBefore,blueAfter,dist,px:len});
        }
        i=j+1;
      }
    }
    if(!options.length)return {status:'unresolved',reason:'No dark gap bounded by continuous cushion colour on both sides',jawTips:[],openingCenterCandidate:null};
    // Avoid choosing an isolated single pixel or wood seam. Select the strongest
    // offset and report how many independent offsets support this gap.
    options.sort((a,b)=>b.score-a.score);
    const best=options[0],agree=options.filter(o=>Math.abs((o.lo+o.hi-best.lo-best.hi)/2)<Math.max(8,M*.23));
    if(agree.length<2)return {status:'unresolved',reason:'Single cross-rail sampling depth; jaw break not reproducible',jawTips:[],openingCenterCandidate:null};
    const raw=[best.lo,best.hi].map(s=>vadd(B.a,vscale(B.t,s)));
    const midpoint=vscale(vadd(raw[0],raw[1]),.5);
    // A tiny black core is *not* the full opening or the two physical jaw ends.
    // Make the size constraint conservative relative to the perspective rail.
    const plausible=best.px>=Math.max(9,B.len*.028);
    return {status:plausible?'paired_image_candidate':'partial_dark_gap',source:'dark_gap_between_cushion_colour_segments',
      jawTips:plausible?raw.map((pt,i)=>({point:pt,source:'image_derived_nose_line_candidate',
        label:i?'B':'A',physicalJawVerified:false,positionUncertaintyPx:round(Math.max(14,B.len*.035,best.offset*.65))})):[],
      openingCenterCandidate:midpoint,openingCenterVerified:false,
      evidence:{score:round(best.score),scanOffsetPx:round(best.offset),spanPx:round(best.px),darkFraction:round(best.voidMean),
        blueFlankA:round(best.blueBefore),blueFlankB:round(best.blueAfter),supportingDepths:agree.length,
        predictedToMouthOffsetPx:round(best.dist),source:'dark break with blue cushion on both sides',
        candidateWidthMinPx:round(Math.max(9,B.len*.028)),fullOpeningWidthEstablished:false},
      warning:plausible?'These jaw candidates are derived from a dark core; the true endpoints and width require human verification.':'Dark core detected, but its width is too narrow to claim the real cushion ends.'};
  }
  // At a corner the opening truncates two different cushions. One-sided
  // dark -> blue evidence is required on EACH incoming rail independently.
  function cornerTip(img,B,startAt,hue){
    const reach=clamp(B.len*.15,18,75),search=clamp(B.len*.045,9,32),step=1.5;
    const offsets=[0,4,8,12,16,20,24,28,34].map(v=>v*Math.max(.55,Math.min(1.25,Math.max(img.width,img.height)/1600)));
    const found=[];
    for(const offset of offsets){
      const series=[];
      for(let j=0;j<Math.ceil((reach+search)/step);j++){
        const inward=-search+j*step,along=startAt?inward:B.len-inward;
        series.push(profile(img,B,along,offset,hue));
      }
      const at=i=>-search+i*step;
      for(let i=4;i<series.length-9;i++){
        const where=at(i);
        if(where<2||where>Math.min(reach*.76,55))continue;
        const darkLead=average(series,Math.max(0,i-Math.ceil(search/step)),i-2,'dark');
        const blueAfter=average(series,i+3,i+9,'blue');
        const blueBefore=average(series,Math.max(0,i-7),i-1,'blue');
        // Must transition from a dark pocket area to a supported cushion.
        if(darkLead>=.51&&blueAfter>=.75&&blueBefore<=.47){
          const strength=Math.min(darkLead,blueAfter)*(.75+.25*(1-where/reach));
          found.push({inward:where,offset,score:strength});
        }
      }
    }
    if(!found.length)return null;
    found.sort((a,b)=>b.score-a.score);
    const best=found[0],agree=found.filter(f=>Math.abs(f.inward-best.inward)<Math.max(7,reach*.12));
    if(agree.length<2)return null;
    const along=startAt?best.inward:B.len-best.inward;
    return {point:vadd(B.a,vscale(B.t,along)),source:'image_derived_nose_line_candidate',
      physicalJawVerified:false,positionUncertaintyPx:round(Math.max(5,best.offset*.45)),
      evidence:{score:round(best.score),scanOffsetPx:round(best.offset),supportingDepths:agree.length,inwardDistancePx:round(best.inward)}};
  }
  function detectPocketMouths(img,q,H,hue){
    const basisByEdge=[0,1,2,3].map(i=>basis(q,i)),expected=G.expectedPockets(H);
    const ids=['corner_TL','side_top','corner_TR','corner_BR','side_bottom','corner_BL'];
    const cornerEdges={corner_TL:[[0,true],[3,false]],corner_TR:[[0,false],[1,true]],
      corner_BR:[[1,false],[2,true]],corner_BL:[[2,false],[3,true]]};
    return expected.map((p,i)=>{
      let mouth;
      if(p.kind==='side')mouth=findSideGap(img,basisByEdge[p.id==='side_top'?0:2],p.p,hue);
      else{
        const tips=cornerEdges[p.id].map(([e,start])=>cornerTip(img,basisByEdge[e],start,hue));
        if(tips.every(Boolean)){
          const pairGap=DIST(tips[0].point,tips[1].point),limit=Math.max(9,Math.min(basisByEdge[cornerEdges[p.id][0][0]].len,basisByEdge[cornerEdges[p.id][1][0]].len)*.035);
          const plausible=pairGap>=limit;
          mouth={status:plausible?'paired_image_candidate':'partial_two_rail_truncation',source:'two_rail_dark_to_blue_truncations',
            jawTips:plausible?tips:[],openingCenterCandidate:plausible?vscale(vadd(tips[0].point,tips[1].point),.5):null,
            openingCenterVerified:false,
            evidence:{score:round(Math.min(tips[0].evidence.score,tips[1].evidence.score)),supportingRails:2,
              candidateSpanPx:round(pairGap),candidateWidthMinPx:round(limit),fullOpeningWidthEstablished:false},
            warning:plausible?'Two rail truncation candidates; physical jaw tips remain unverified.':'Image edge transitions cluster too close to the virtual corner to establish two physical jaw tips.'};
        }else mouth={status:'unresolved',reason:`${tips.filter(Boolean).length} of 2 cushion termination points have supporting dark-to-blue evidence`,
            jawTips:[],openingCenterCandidate:null,openingCenterVerified:false,
            evidence:{supportedSingleRailCount:tips.filter(Boolean).length}};
      }
      // Every result has an explicit unknown physical outcome and no implicit ball scoring.
      return {id:p.id,kind:p.kind,virtualReference:p.kind==='corner'?p.p:null,
        predictedLocation:p.p,mouth,physicalPocketOutcome:'unknown',openingCenterVerified:false};
    });
  }
  const api={detectPocketMouths,findSideGap,cornerTip};
  Object.assign(ns,api);
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);