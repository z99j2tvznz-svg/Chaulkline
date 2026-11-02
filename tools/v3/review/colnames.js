// zoomed column crops with live names drawn to the side (one label per ball, no overlap)
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
global.D2R=Math.PI/180;const {makeCam,makeP}=require(path.join(__dirname, '../../../src/core.js')),V=require(path.join(__dirname, '../../../src/vision.js'));
const [dir,out,shotsS]=process.argv.slice(2),d=JSON.parse(fs.readFileSync(path.join(dir,'log.json'),'utf8')),h=d.header;
const P=makeP(7),{L,Wd}=V.tableDims(7),cam=makeCam(V.tableCornersFor(h.rot,L,Wd),h.quad,1920,1080,h.lens*1920,[960,540]);
const want=shotsS.split(',').map(Number);
const jobs=d.shots.filter(s=>want.includes(s.n)).map(s=>({f:'shot'+String(s.n).padStart(3,'0')+'-after.jpg',n:s.n,b:s.after.map(b=>{const p=cam.proj(b.x,b.y,P.R);return [p[0]/2,p[1]/2,(b.num==null?'?':b.num===0?'Q':String(b.num))+(b.sure?'':'?')+(b.state==='hidden'?'h':''),+b.y.toFixed(1)]})}));
fs.writeFileSync(path.join(out,'cj.json'),JSON.stringify(jobs));
execFileSync('python3',['-I','-c',`
import json,sys,os
from PIL import Image,ImageDraw,ImageFont
d,o=sys.argv[1],sys.argv[2]; J=json.load(open(os.path.join(o,'cj.json'))); Z=4; tiles=[]
try: F=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',22)
except Exception: F=None
for j in J:
  im=Image.open(os.path.join(d,j['f'])).convert('RGB'); x0,y0,x1,y1=150,140,560,345
  c=im.crop((x0,y0,x1,y1)).resize(((x1-x0)*Z,(y1-y0)*Z)); W=c.size[0]; T=Image.new('RGB',(W+260,c.size[1]),'black'); T.paste(c,(0,0)); dr=ImageDraw.Draw(T)
  for x,y,t,yy in sorted(j['b'],key=lambda b:b[1]):
    X,Y=(x-x0)*Z,(y-y0)*Z
    if not(0<=X<W and 0<=Y<c.size[1]): continue
    dr.ellipse((X-6,Y-6,X+6,Y+6),outline=(255,0,255),width=3); dr.line((X,Y,W+10,Y),fill=(255,255,0)); dr.text((W+14,Y-12),t,fill=(255,255,0),font=F)
  dr.text((6,6),'after %d'%j['n'],fill=(255,255,0),font=F); tiles.append(T)
w,h=tiles[0].size; M=Image.new('RGB',(w*2,h*((len(tiles)+1)//2)))
for i,t in enumerate(tiles): M.paste(t,((i%2)*w,(i//2)*h))
M.save(os.path.join(o,'col.jpg'),quality=85); print(M.size)
`,dir,out]);
