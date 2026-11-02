import sys,os
from PIL import Image, ImageDraw
src,out=sys.argv[1],sys.argv[2]; names=sys.argv[3].split(',')
rows=[]
for n in names:
    fs=sorted(f for f in os.listdir(os.path.join(src,n)) if f.endswith('.jpg')); pick=[fs[int(i*(len(fs)-1)/5)] for i in range(6)]
    ims=[Image.open(os.path.join(src,n,f)) for f in pick]; w,h=ims[0].size; s=300/w
    row=Image.new('RGB',(6*305,int(h*s)+16),'black'); d=ImageDraw.Draw(row)
    for i,im in enumerate(ims): row.paste(im.resize((300,int(h*s))),(i*305,16))
    d.text((4,2),n,fill='yellow'); rows.append(row)
sh=Image.new('RGB',(rows[0].width,sum(r.height for r in rows)),'black'); y=0
for r in rows: sh.paste(r,(0,y)); y+=r.height
sh.save(out,quality=85); print(ims[0].size)
