// live after-shot names on after pictures, any camera (quad, rot, picture size, lens), side labels
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
global.D2R=Math.PI/180;const {makeCam,makeP}=require(path.join(__dirname, '../../../src/core.js')),V=require(path.join(__dirname, '../../../src/vision.js'));
const [dir,out,cfgS]=process.argv.slice(2),cfg=JSON.parse(cfgS),d=JSON.parse(fs.readFileSync(path.join(dir,'log.json'),'utf8'));
const [W,H]=cfg.wh,P=makeP(7),{L,Wd}=V.tableDims(7),cam=makeCam(V.tableCornersFor(cfg.rot,L,Wd),cfg.quad,W,H,cfg.lens*Math.max(W,H),[W/2,H/2]);
const jobs=d.shots.filter(s=>cfg.shots.includes(s.n)).map(s=>({f:'shot'+String(s.n).padStart(3,'0')+'-after.jpg',n:s.n,b:s.after.map(b=>{const p=cam.proj(b.x,b.y,P.R);return [p[0],p[1],(b.num==null?'?':b.num===0?'Q':String(b.num))+(b.sure?'':'?')+(b.state==='hidden'?'h':'')]})}));
fs.writeFileSync(path.join(out,'jobs.json'),JSON.stringify({jobs,crop:cfg.crop,cols:cfg.cols}));
execFileSync('python3',['-I','-c',`
import json,sys,os
from PIL import Image,ImageDraw
d,o=sys.argv[1],sys.argv[2]; J=json.load(open(os.path.join(o,'jobs.json'))); ims=[]
for j in J['jobs']:
  im=Image.open(os.path.join(d,j['f'])).convert('RGB'); k=im.size[0]/(1080 if im.size[1]>im.size[0] else 1920); dr=ImageDraw.Draw(im)
  for x,y,t in j['b']:
    x*=k;y*=k; dr.ellipse((x-7,y-7,x+7,y+7),outline=(255,0,255),width=2); dr.line((x,y,x+12,y-10),fill=(255,255,0)); dr.rectangle((x+12,y-17,x+20+6*len(t),y-6),fill=(0,0,0)); dr.text((x+14,y-18),t,fill=(255,255,0))
  dr.text((4,4),'shot %d'%j['n'],fill=(255,255,0)); c=J['crop']; ims.append(im.crop(tuple(c)))
cols=J['cols']; w,h=ims[0].size
for i in range(0,len(ims),cols*2):
  g=ims[i:i+cols*2]; rows=(len(g)+cols-1)//cols; M=Image.new('RGB',(w*cols,h*rows))
  for q,im in enumerate(g): M.paste(im,((q%cols)*w,(q//cols)*h))
  M=M.resize((int(M.size[0]*1.6),int(M.size[1]*1.6))); M.save(os.path.join(o,'n%02d.jpg'%i))
`,dir,out]);
