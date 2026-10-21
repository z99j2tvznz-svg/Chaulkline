// merge kept detections with rejected (pocket / cushion) boxes: rejected ones carry edge: why
const fs=require('fs');const [K,R,O]=process.argv.slice(2);
const d=JSON.parse(fs.readFileSync(K)),r=JSON.parse(fs.readFileSync(R));
if(r.length!==d.frames.length)throw new Error('frame count');
d.frames.forEach((f,i)=>{for(const b of r[i].filter(b=>b.px>=48&&b.px<=1232&&b.py>=48&&b.py<=672))f.balls.push({x:b.x,y:b.y,px:b.px,py:b.py,c:b.c,rec:b.rec,p:b.p,nb:b.nb,edge:b.why});});
fs.writeFileSync(O,JSON.stringify(d));
