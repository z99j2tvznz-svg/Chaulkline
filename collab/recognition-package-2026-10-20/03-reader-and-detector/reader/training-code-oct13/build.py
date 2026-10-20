# Build the ball-picture library from every saved session: one 64x64 crop per detected spot, with a proposed label and
# how sure that label is. labels: 0-9 = ball number, 'nb' = not a ball (hand, arm, cue, shirt), '?' = unknown.
import json, os, math, csv
from PIL import Image, ImageDraw
SP='/tmp/claude-0/-home-claude/98017ec1-4128-57de-bccb-96e702253347/scratchpad/'
OUT=SP+'lib/'; os.makedirs(OUT+'crops',exist_ok=True)
rows=[]
def crop(im,b,name):
    r=max(6,b['pr']); s=int(round(3.2*r)); x0=int(b['px']-s/2); y0=int(b['py']-s/2)
    c=Image.new('RGB',(s,s),(0,0,0)); c.paste(im.crop((max(0,x0),max(0,y0),min(im.width,x0+s),min(im.height,y0+s))),(max(0,-x0),max(0,-y0)))
    c.resize((64,64),Image.LANCZOS).save(OUT+'crops/'+name)
def add(sess,shot,tag,i,b,label,trust,im,note=''):
    name=f'{sess}_s{shot:03d}_{tag[0]}{i}.png'; crop(im,b,name)
    rows.append(dict(file=name,session=sess,shot=shot,pic=tag,x=b['x'],y=b['y'],px=b['px'],py=b['py'],pr=b['pr'],app_id='' if b['id'] is None else b['id'],app_conf=b.get('conf',0),label=label,trust=trust,note=note))
for sess in ['real1','real2','real3','real4','real5']:
    L=json.load(open(SP+sess+'/labels.json'))
    for s in L['shots']:
        for tag in ('before','after'):
            f=s.get(tag)
            if not f: continue
            im=Image.open(SP+sess+'/'+f['file']).convert('RGB'); balls=f['balls']
            if sess=='real4' and s.get('drill'):   # the drill: only the cue ball and the called ball are on the table
                ball=s['ball']; sp=s['spot']; ring=None
                if tag=='before':
                    cand=[b for b in balls if math.dist((b['x'],b['y']),sp['obj'])<4.5 and b['id']!=0]
                    if cand: ring=min(cand,key=lambda b:math.dist((b['x'],b['y']),sp['obj']))
                for i,b in enumerate(balls):
                    if b is ring: add(sess,s['shot'],tag,i,b,ball,'sure',im,'on ring')
                    elif b['id']==0: add(sess,s['shot'],tag,i,b,0,'drill',im)
                    elif b['id']==ball: add(sess,s['shot'],tag,i,b,ball,'drill',im)
                    else: add(sess,s['shot'],tag,i,b,'nb','drill',im,'extra blob')
            else:
                for i,b in enumerate(balls):
                    add(sess,s['shot'],tag,i,b,'?' if b['id'] is None else b['id'],'app',im)
with open(OUT+'manifest.csv','w',newline='') as fh:
    w=csv.DictWriter(fh,fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
print(len(rows),'crops')
import collections; print(collections.Counter((r['session'],r['trust']) for r in rows)); print(collections.Counter(str(r['label']) for r in rows))
