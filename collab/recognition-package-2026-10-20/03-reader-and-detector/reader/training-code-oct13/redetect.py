# run the current detector (V2.2 vision) over a session's saved pictures; output found spots in picture pixels
from playwright.sync_api import sync_playwright
import json, sys
SP='/tmp/claude-0/-home-claude/98017ec1-4128-57de-bccb-96e702253347/scratchpad/'
sess=sys.argv[1]; HD=json.load(open(SP+sess+'/log.txt'))['header']; QN=HD['quadN']; FT=HD['ft']
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500)
    out=pg.evaluate("""async ([QN, sess, FT])=>{
      const C=__chalk, S=C.S, L=await (await fetch(sess+'/labels.json')).json(), res=[];
      for (const sh of L.shots) for (const tag of ['before','after']) {
        const f=sh[tag]; if(!f) continue;
        const img=new Image(); img.src=sess+'/'+f.file; await img.decode();
        const c=document.createElement('canvas'); c.width=1280; c.height=720; const g=c.getContext('2d',{willReadFrequently:true}); g.fillStyle='#2a2420'; g.fillRect(0,0,1280,720); g.drawImage(img, f.crop[0], f.crop[1], f.crop[2], f.crop[3]);
        const s=document.createElement('canvas'); s.width=800; s.height=450; s.getContext('2d',{willReadFrequently:true}).drawImage(c,0,0,800,450);
        S.src=s; S.W=800; S.H=450; S.vr={x:0,y:0,w:1280,h:720,vw:1280,vh:720,z:1}; S.ft=FT; S.P=C.mkP(); S.lens=0.86;
        setQuad(QN.map(p=>C.srcFromVn(p,S.vr)));
        const im=imgData(); S.cloth=sampleCloth(im,S.quad);
        STILL.cnt=null; STILL.mask=null; S.balls=[];
        for(let k=0;k<9;k++){const i2={still:stillInfo()}; const f2=detectBalls(im,S.cam,S.P,S.cloth,i2); stillLearn(i2.still,f2);}
        const found=detectBalls(im,S.cam,S.P,S.cloth,{still:stillInfo()});
        const k8=1280/800, sc=f.scale||1, X=px=>Math.round((px*k8-f.crop[0])*sc), Y=py=>Math.round((py*k8-f.crop[1])*sc);
        res.push({shot:sh.shot, tag, file:f.file, found:found.map(b=>({px:X(b.px),py:Y(b.py),pr:+(b.rpx*k8*sc).toFixed(1),x:+b.x.toFixed(1),y:+b.y.toFixed(1),ratio:+b.ratio.toFixed(2),navy:b.navy||0,feat:b.feat,clv:S.cloth.v,cl:[S.cloth.h,S.cloth.s,S.cloth.v]}))});
      }
      return res;}""", [QN, sess, FT])
    json.dump(out, open(SP+'lib/redet_'+sess+'.json','w')); print(sess, len(out), 'pictures', sum(len(r['found']) for r in out), 'spots', errs[:2]); b.close()
