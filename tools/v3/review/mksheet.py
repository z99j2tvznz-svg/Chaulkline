import sys,os
from PIL import Image, ImageDraw
src,out=sys.argv[1],sys.argv[2]
W0,H0=Image.open(os.path.join(src,'shot001-before.jpg')).size
# table strip: box y 255..725 of 1080 -> scale to picture size
y0,y1=int(H0*250/1080),int(H0*730/1080)
sc=760/W0
rows=5
for b in range(0,int(sys.argv[3]) if len(sys.argv)>3 else 40,rows):
    sheet=Image.new('RGB',(2*760+10,rows*(int((y1-y0)*sc)+18)),'black'); d=ImageDraw.Draw(sheet)
    for i in range(rows):
        n=b+i+1; yy=i*(int((y1-y0)*sc)+18)
        for j,k in enumerate(['before','after']):
            p=os.path.join(src,'shot%03d-%s.jpg'%(n,k))
            if not os.path.exists(p): continue
            im=Image.open(p).crop((0,y0,W0,y1)); im=im.resize((760,int((y1-y0)*sc)))
            sheet.paste(im,(j*770,yy+18)); d.text((j*770+4,yy+3),'shot %d %s'%(n,k),fill='yellow')
    sheet.save(os.path.join(out,'s%02d.jpg'%(b//rows+1)),quality=85)
print(W0,H0)
