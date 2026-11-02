import sys,os,json
from PIL import Image, ImageDraw
src,out,n,k=sys.argv[1],sys.argv[2],sys.argv[3],int(sys.argv[4])
ix=json.load(open(os.path.join(src,n,'index.json'))); L=ix['list']
pick=[L[int(i*(len(L)-1)/(k-1))] for i in range(k)]
w,h=Image.open(os.path.join(src,n,pick[0][0])).size; s=2; cols=int(sys.argv[5]) if len(sys.argv)>5 else 3
sh=Image.new('RGB',(cols*(w*s+4),((k+cols-1)//cols)*(h*s+14)),'black'); d=ImageDraw.Draw(sh)
for i,p in enumerate(pick):
    x,y=(i%cols)*(w*s+4),(i//cols)*(h*s+14)
    sh.paste(Image.open(os.path.join(src,n,p[0])).resize((w*s,h*s)),(x,y+14)); d.text((x+2,y),'%s %.2f nc%.2f ch%s'%(n,p[1]/1000,p[2],p[3]),fill='yellow')
sh.save(out,quality=88)
