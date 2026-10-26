/* Chalkline Fieldwork / geometry v0.1 — no dependencies, pure functions.
 * Coordinates are always image pixels or normalized u/v; homography is a proposal, not ground truth.
 */
(function(root) {
  'use strict';
  const ns = root.Fieldwork || (root.Fieldwork = {});
  function area(q) { let s=0; for(let i=0;i<q.length;i++){const p=q[i],b=q[(i+1)%q.length];s+=p[0]*b[1]-b[0]*p[1];}return Math.abs(s)/2; }
  function distance(a,b) { return Math.hypot(a[0]-b[0],a[1]-b[1]); }
  function convexHull(points) {
    if(points.length<3)return points.slice();
    const pts=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cr=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    const lo=[],up=[];
    for(const p of pts){while(lo.length>1&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
    for(let i=pts.length-1;i>=0;i--){const p=pts[i];while(up.length>1&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
    return lo.slice(0,-1).concat(up.slice(0,-1));
  }
  function bestQuad(hull) {
    // Maximise quadrilateral area from convex boundary, capped by caller to a small hull.
    const n=hull.length;if(n<4)return null;
    const tri=(a,b,c)=>Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;
    let best=null,ba=-1;
    for(let i=0;i<n;i++)for(let k=i+2;k<n;k++){
      let a1=-1,a2=-1,jj=-1,mm=-1;
      for(let j=i+1;j<k;j++){const t=tri(hull[i],hull[j],hull[k]);if(t>a1){a1=t;jj=j;}}
      for(let j=k+1;j<n+i;j++){const j0=j%n,t=tri(hull[i],hull[j0],hull[k]);if(t>a2){a2=t;mm=j0;}}
      if(jj>=0&&mm>=0&&a1+a2>ba){ba=a1+a2;best=[hull[i],hull[jj],hull[k],hull[mm]];}
    }
    return best;
  }
  function orderedQuad(points){
    if(!points||points.length!==4)return null;
    const c=points.reduce((o,p)=>[o[0]+p[0]/4,o[1]+p[1]/4],[0,0]);
    const q=points.slice().map(p=>[+p[0],+p[1]]).sort((a,b)=>Math.atan2(a[1]-c[1],a[0]-c[0])-Math.atan2(b[1]-c[1],b[0]-c[0]));
    const sums=q.map(p=>p[0]+p[1]);let i=sums.indexOf(Math.min(...sums));return q.slice(i).concat(q.slice(0,i));
  }
  function validQuad(q,w,h) {
    if(!Array.isArray(q)||q.length!==4||q.some(p=>!p||p.some(x=>!Number.isFinite(x))))return false;
    const A=area(q);if(A < 0.028*w*h)return false;
    const v=(a,b)=>[b[0]-a[0],b[1]-a[1]];
    let sign=0;
    for(let i=0;i<4;i++){
      const a=v(q[i],q[(i+1)%4]),b=v(q[(i+1)%4],q[(i+2)%4]),cr=a[0]*b[1]-a[1]*b[0];
      if(Math.abs(cr)<1)return false;
      if(sign&&cr*sign<=0)return false;sign=Math.sign(cr);
      if(Math.hypot(...a)<0.07*Math.min(w,h))return false;
    }
    return true;
  }
  function solveLinear(A,b) {
    const n=b.length,m=A.map((r,i)=>r.slice().concat([b[i]]));
    for(let c=0;c<n;c++){
      let piv=c;for(let i=c+1;i<n;i++)if(Math.abs(m[i][c])>Math.abs(m[piv][c]))piv=i;
      if(Math.abs(m[piv][c])<1e-10)return null;
      [m[piv],m[c]]=[m[c],m[piv]];
      const p=m[c][c];for(let j=c;j<=n;j++)m[c][j]/=p;
      for(let i=0;i<n;i++)if(i!==c){const v=m[i][c];for(let j=c;j<=n;j++)m[i][j]-=v*m[c][j];}
    }
    return m.map(r=>r[n]);
  }
  function homography(quad){
    // Maps a normalized rect [(0,0),(1,0),(1,1),(0,1)] into image coordinates.
    if(!Array.isArray(quad)||quad.length!==4||quad.some((p,i)=>!p||!Number.isFinite(p[0])||!Number.isFinite(p[1])||distance(p,quad[(i+1)%4])<1e-7)||area(quad)<1e-7)return null;
    const uv=[[0,0],[1,0],[1,1],[0,1]],A=[],b=[];
    for(let i=0;i<4;i++){
      const [u,v]=uv[i],[x,y]=quad[i];
      A.push([u,v,1,0,0,0,-x*u,-x*v]);b.push(x);
      A.push([0,0,0,u,v,1,-y*u,-y*v]);b.push(y);
    }
    const h=solveLinear(A,b);if(!h)return null;
    for(const [u,v] of uv)if(Math.abs(h[6]*u+h[7]*v+1)<1e-8)return null;
    return [...h,1];
  }
  function project(H,u,v){const d=H[6]*u+H[7]*v+1;return d&&Number.isFinite(d)?[(H[0]*u+H[1]*v+H[2])/d,(H[3]*u+H[4]*v+H[5])/d]:[NaN,NaN];}
  // Infinite straight-line intersection (not a pocket jaw, not a physical ball target).
  function lineIntersection(a,b,c,d){
    const vx=b[0]-a[0],vy=b[1]-a[1],wx=d[0]-c[0],wy=d[1]-c[1],den=vx*wy-vy*wx;
    if(!Number.isFinite(den)||Math.abs(den)<1e-7)return null;
    const t=((c[0]-a[0])*wy-(c[1]-a[1])*wx)/den;
    const p=[a[0]+vx*t,a[1]+vy*t];return p.every(Number.isFinite)?p:null;
  }
  function longRailQuad(quad,axis) {
    // axis=horizontal uses top/bottom edges; vertical rotates the rectangle 90 degrees.
    return axis==='vertical'?[quad[1],quad[2],quad[3],quad[0]]:quad.slice();
  }
  function rails(quad){return [0,1,2,3].map(i=>({id:'rail_'+i,a:quad[i],b:quad[(i+1)%4],long:i%2===0,source:'inferred_from_cloth'}));}
  function diamondProposals(H) {
    const points=[];
    const long=[0.125,0.25,0.375,0.625,0.75,0.875];
    for(const t of long){points.push({id:'long_top_'+t,u:t,v:0,rail:0});points.push({id:'long_bottom_'+t,u:t,v:1,rail:2});}
    for(const t of [0.25,0.5,0.75]){points.push({id:'short_right_'+t,u:1,v:t,rail:1});points.push({id:'short_left_'+t,u:0,v:t,rail:3});}
    return points.map(p=>({...p,point:project(H,p.u,p.v),source:'geometric_proposal',observed:false,confidence:0}));
  }
  function expectedPockets(H) {
    return [
      {id:'corner_TL',kind:'corner',p:project(H,0,0),u:0,v:0},
      {id:'side_top',kind:'side',p:project(H,0.5,0),u:0.5,v:0},
      {id:'corner_TR',kind:'corner',p:project(H,1,0),u:1,v:0},
      {id:'corner_BR',kind:'corner',p:project(H,1,1),u:1,v:1},
      {id:'side_bottom',kind:'side',p:project(H,0.5,1),u:0.5,v:1},
      {id:'corner_BL',kind:'corner',p:project(H,0,1),u:0,v:1}
    ];
  }
  function rectifiedPixels(input,H,outWidth=880,outHeight=440){
    if(!H)return null;
    const result=new Uint8ClampedArray(outWidth*outHeight*4),src=input.data,w=input.width,h=input.height;
    for(let y=0;y<outHeight;y++){
      const v=(y+.5)/outHeight;
      for(let x=0;x<outWidth;x++){
        const u=(x+.5)/outWidth,[sx,sy]=project(H,u,v),oi=(y*outWidth+x)*4;
        const ix=Math.floor(sx),iy=Math.floor(sy),tx=sx-ix,ty=sy-iy;
        if(ix<0||ix>=w-1||iy<0||iy>=h-1){result[oi]=result[oi+1]=result[oi+2]=23;result[oi+3]=255;continue;}
        const j=(iy*w+ix)*4,k=j+w*4;
        for(let c=0;c<3;c++){result[oi+c]=src[j+c]*(1-tx)*(1-ty)+src[j+4+c]*tx*(1-ty)+src[k+c]*(1-tx)*ty+src[k+4+c]*tx*ty;}
        result[oi+3]=255;
      }
    }
    return {width:outWidth,height:outHeight,data:result};
  }
  const api={area,distance,convexHull,bestQuad,orderedQuad,validQuad,solveLinear,homography,project,longRailQuad,lineIntersection,rails,diamondProposals,expectedPockets,rectifiedPixels};
  Object.assign(ns,api);
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);