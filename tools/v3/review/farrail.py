import sys,os
from PIL import Image, ImageDraw
src,out,a,b=sys.argv[1],sys.argv[2],int(sys.argv[3]),int(sys.argv[4])
# far rail band and the near-rail row, from each before/after picture (960x540)
rows=[]
for n in range(a,b+1):
    for k in ('before','after'):
        p=os.path.join(src,'shot%03d-%s.jpg'%(n,k))
        if not os.path.exists(p): continue
        im=Image.open(p)
        far=im.crop((180,180,800,250)).resize((1240,140)); near=im.crop((150,300,520,345)).resize((740,90))
        r=Image.new('RGB',(1240+10+740,160),'black'); r.paste(far,(0,18)); r.paste(near,(1250,18)); ImageDraw.Draw(r).text((4,2),'shot %d %s'%(n,k),fill='yellow'); rows.append(r)
M=Image.new('RGB',(rows[0].width,sum(x.height for x in rows)),'black'); y=0
for r in rows: M.paste(r,(0,y)); y+=r.height
M.save(out,quality=85)
