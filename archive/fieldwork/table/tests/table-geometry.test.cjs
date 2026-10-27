'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../core/table-geometry.js');
const { OpenCVPerspectiveAdapter, OPENCV_JS_URL } = require('../adapters/opencv-perspective.js');
const { BrowserCameraAdapter } = require('../adapters/browser-camera.js');
const corners = [{ x: 100, y: 100 }, { x: 900, y: 90 }, { x: 880, y: 520 }, { x: 120, y: 560 }];
const args = { points: corners, imageWidth: 1000, imageHeight: 650, table: '7ft', sourceType: 'camera', revision: 1 };

test('table sizes are explicit 7/8/9 foot playing surfaces', () => {
  assert.deepEqual(Object.keys(G.TABLES), ['7ft', '8ft', '9ft']);
  assert.equal(G.TABLES['7ft'].widthIn, 78);
  assert.equal(G.TABLES['9ft'].heightIn, 50);
});
test('valid clockwise manual corners return area coverage', () => {
  const x = G.checkCorners(corners, 1000, 650);
  assert.ok(x.coverage > 0.4 && x.coverage < 0.8);
});
test('does not accept partial corners', () => assert.throws(() => G.checkCorners(corners.slice(0, 3), 1000, 650), /four corners/i));
test('does not accept corners outside frame', () => assert.throws(() => G.checkCorners([...corners.slice(0, 3), { x: 1001, y: 200 }], 1000, 650), /inside/i));
test('does not accept undefined coordinates', () => assert.throws(() => G.checkCorners([{ x: NaN, y: 1 }, ...corners.slice(1)], 1000, 650), /inside/i));
test('does not accept crossing edge order', () => assert.throws(() => G.checkCorners([corners[0], corners[2], corners[1], corners[3]], 1000, 650), /clockwise/i));
test('does not accept reverse winding', () => assert.throws(() => G.checkCorners([...corners].reverse(), 1000, 650), /clockwise/i));
test('does not accept concave geometry', () => assert.throws(() => G.checkCorners([corners[0], corners[1], { x: 400, y: 200 }, corners[3]], 1000, 650), /clockwise/i));
test('does not accept near-zero perspective region', () => assert.throws(() => G.checkCorners([{x:100,y:100},{x:180,y:100},{x:180,y:130},{x:100,y:130}], 1000,650), /too little/i));
test('does not accept near-duplicate corners', () => assert.throws(() => G.checkCorners([{x:100,y:100},{x:101,y:101},corners[2],corners[3]],1000,650), /too close/i));
test('does not accept invalid image dimensions', () => assert.throws(() => G.checkCorners(corners, 0,650), /valid source/i));
test('creates normalized corners and source metadata', () => {
  const c=G.createCalibration(args); assert.equal(c.version,1); assert.equal(c.source.widthPx,1000);
  assert.deepEqual(c.cornersPx[0],{x:100,y:100}); assert.equal(c.cornersNormalized[0].x,0.1);
  assert.equal(c.cornersNormalized[0].y,+(100/650).toFixed(7)); assert.equal(c.table.playingWidthIn,78);
  assert.equal(c.verification.videoValidated,false);
});
test('rejects unapproved table preset', () => assert.throws(() => G.createCalibration({...args,table:'10ft'}),/Table size/i));
test('rejects invalid revision', () => assert.throws(() => G.createCalibration({...args,revision:0}),/Revision/i));
test('rejects unapproved source types', () => assert.throws(() => G.createCalibration({...args,sourceType:'ai'}),/Unsupported frame/i));
test('calibration output may be extended with independent projection metadata', () => {
  const c=G.createCalibration(args);const p=G.withProjection(c,{provider:'test',widthPx:960,heightPx:480,homography:[1,0,0,0,1,0,0,0,1]});
  assert.equal(p.perspective.widthPx,960);assert.equal(p.perspective.verifiedOnRealFootage,false);
  assert.equal(c.perspective,undefined);assert.equal(p.perspective.units,'rectified-image-pixels');
});
test('rejects non-finite projection coefficients', () => assert.throws(() => G.withProjection(G.createCalibration(args),{provider:'test',widthPx:960,heightPx:480,homography:[NaN,0,0,0,1,0,0,0,1]}),/Invalid projection/i));
test('maps camera points into rectified image using homography', () => {
  assert.deepEqual(G.projectPoint([2,0,5,0,3,7,0,0,1],{x:4,y:6}),{x:13,y:25});
});
test('homography denominator near zero is rejected', () => assert.throws(() => G.projectPoint([1,0,0,0,1,0,0,0,0],{x:1,y:1}),/denominator/i));
test('opencv URL is pinned and licensed metadata is explicit', () => {
  assert.match(OPENCV_JS_URL,/4\.10\.0\/opencv\.js$/);
  assert.equal(new OpenCVPerspectiveAdapter().license,'Apache-2.0');
});
test('OpenCV backend rectifies using injected CV without sourcing any other dependency', async () => {
  const deletes=[],calls=[],fakeMat=(data)=>({data64F:data,delete(){deletes.push(this)}});
  const cv={ CV_32FC2:5,INTER_LINEAR:1,BORDER_CONSTANT:0,Mat:class{delete(){deletes.push(this)}},
    imread:(c)=>{calls.push(['imread',c]);return fakeMat();},
    matFromArray:(n,m,t,v)=>{calls.push(['from',n,m,t,v]);return fakeMat();},
    getPerspectiveTransform:(a,b)=>{calls.push(['transform']);return fakeMat(new Float64Array([1,0,0,0,1,0,0,0,1]));},
    warpPerspective:(...params)=>calls.push(['warp',params[3].width,params[3].height]),
    imshow:(...params)=>calls.push(['show',params[0]]),
    Size:class{constructor(width,height){this.width=width;this.height=height}},
    Scalar:class{}
  };
  const adapter=new OpenCVPerspectiveAdapter({cv});
  const src={name:'source'}, out={name:'out'};
  assert.equal(await adapter.ready(),cv);
  const p=adapter.rectify(src,G.createCalibration(args),out,960);
  assert.equal(p.widthPx,960);assert.equal(p.heightPx,480);
  assert.deepEqual(p.homography,[1,0,0,0,1,0,0,0,1]);
  assert.equal(deletes.length,5);assert.ok(calls.some(x=>x[0]==='warp'&&x[1]===960&&x[2]===480));
  assert.equal(out.width,960);assert.equal(out.height,480);
});
test('OpenCV backend always deletes matrices if homography read fails', () => {
  const deletes=[];
  const fakeMat=()=>({delete(){deletes.push(1)}});
  const cv={CV_32FC2:5,INTER_LINEAR:1,BORDER_CONSTANT:0,Mat:class{delete(){deletes.push(1)}},
    imread:fakeMat,matFromArray:fakeMat,getPerspectiveTransform:fakeMat,
    warpPerspective(){},imshow(){},Size:class{},Scalar:class{}};
  assert.throws(()=>new OpenCVPerspectiveAdapter({cv}).rectify({},G.createCalibration(args),{},960),/unsupported homography/i);
  assert.equal(deletes.length,5);
});
test('OpenCV backend rejects uninitialized use', () => assert.throws(() => new OpenCVPerspectiveAdapter().rectify({}, G.createCalibration(args),{}),/not initialized/i));
test('OpenCV backend rejects invalid output width', () => {
  const cv={Mat(){},getPerspectiveTransform(){}};
  assert.throws(()=>new OpenCVPerspectiveAdapter({cv}).rectify({},G.createCalibration(args),{},15),/output width/i);
});
test('BrowserCameraAdapter requests video only and shuts down camera tracks', async () => {
  let requested, stopped=0, played=0,paused=0;
  const fakeStream={getTracks(){return[{stop(){stopped++}}]}};
  const camera = new BrowserCameraAdapter({getUserMedia:async opts=>{requested=opts;return fakeStream}});
  const video={videoWidth:1920,videoHeight:1080,async play(){played++},pause(){paused++},srcObject:null};
  await camera.open(video);
  assert.equal(requested.audio,false);assert.equal(requested.video.facingMode.ideal,'environment');
  assert.equal(played,1);camera.close(video);assert.equal(stopped,1);assert.equal(video.srcObject,null);
});
test('BrowserCameraAdapter captures a local frame with bounded resolution', () => {
  let drawn;const camera = new BrowserCameraAdapter({});
  const canvas={getContext(){return{drawImage(...a){drawn=a}}}};
  const dims=camera.capture({videoWidth:1920,videoHeight:1080},canvas,1280);
  assert.deepEqual(dims,{widthPx:1280,heightPx:720});assert.equal(drawn[3],1280);
});
test('BrowserCameraAdapter blocks capture without a frame', () => {
  assert.throws(()=>new BrowserCameraAdapter({}).capture({videoWidth:0,videoHeight:0},{}),/not delivered/i);
});

const { CanvasPerspectiveAdapter, homography, invert3 } = require('../adapters/canvas-perspective.js');
const pointNear = (got, exp, tol=1e-6) => {
  assert.ok(Math.abs(got.x-exp.x) < tol && Math.abs(got.y-exp.y) < tol,
    `expected ${JSON.stringify(exp)}, received ${JSON.stringify(got)}`);
};

test('Canvas perspective backend is replaceable and has no network dependency', async () => {
  const backend = new CanvasPerspectiveAdapter();
  assert.equal(await backend.ready(), backend);
  assert.match(backend.id, /canvas2d-perspective/);
});

test('Canvas homography maps all four corners of a skewed table to the output rectangle', () => {
  const h = homography(corners, 960, 480);
  for (const [i, p] of corners.entries()) {
    const expected = [{x:0,y:0},{x:960,y:0},{x:960,y:480},{x:0,y:480}][i];
    pointNear(G.projectPoint(h,p),expected);
  }
});

test('Canvas perspective inverse returns image-space positions for projected points', () => {
  const h=homography(corners,960,480), inv=invert3(h);
  for (const p of corners) pointNear(G.projectPoint(inv,G.projectPoint(h,p)),p,1e-6);
});

test('Canvas backend transforms actual pixels in the expected identity case', () => {
  const width=200,height=100;
  const pixels = new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++){
    const i=(y*width+x)*4;
    pixels[i]=x;pixels[i+1]=y;pixels[i+2]=44;pixels[i+3]=255;
  }
  const source={width,height,getContext(){return {getImageData(){return {data:pixels}}};}};
  let outputData;
  const output={width:0,height:0,getContext(){return {
    createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},
    putImageData(im){outputData=im.data}
  };}};
  const cal=G.createCalibration({points:[{x:0,y:0},{x:200,y:0},{x:200,y:100},{x:0,y:100}],
    imageWidth:width,imageHeight:height,sourceType:'image'});
  const projection=new CanvasPerspectiveAdapter().rectify(source,cal,output,200);
  assert.equal(output.width,200);assert.equal(output.height,100);
  assert.equal(projection.heightPx,100);
  assert.equal(projection.provider,'canvas2d-perspective@1');
  for(const [x,y] of [[0,0],[100,50],[199,99]]){
    const i=(y*width+x)*4;
    assert.deepEqual(Array.from(outputData.subarray(i,i+4)),Array.from(pixels.subarray(i,i+4)));
  }
  const enriched=G.withProjection(cal,projection);
  assert.equal(enriched.perspective.provider,'canvas2d-perspective@1');
});

test('Canvas backend rejects invalid source/geometry before allocating output', () => {
  const b=new CanvasPerspectiveAdapter(),cal=G.createCalibration(args);
  assert.throws(()=>b.rectify(null,cal,{},200),/source canvas/i);
  assert.throws(()=>b.rectify({width:100,height:100},cal,{},20),/output width/i);
  assert.throws(()=>homography([{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}],200,100),/stable/i);
  assert.throws(()=>invert3([0,0,0,0,0,0,0,0,0]),/singular/i);
});
