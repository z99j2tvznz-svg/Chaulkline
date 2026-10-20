import json,csv,math,collections
rows=list(csv.DictReader(open('manifest.csv')))
by=collections.defaultdict(list)
for r in rows: by[(r['session'],int(r['shot']),r['pic'])].append(r)
D2R=math.pi/180
def hv(h,s=0.85): return (math.cos(h*D2R)*s, math.sin(h*D2R)*s)
BASE=[None,48,222,3,270,30,145,345]
SET=[{"wf": 0.97, "bf": 0.0, "cf": 0.03, "cx": 0.19, "cy": -0.05, "vc": 0.86, "band": 0.02}, {"wf": 0.1, "bf": 0.0, "cf": 0.9, "cx": 0.69, "cy": 0.6, "vc": 0.97, "band": 0.89}, {"wf": 0.02, "bf": 0.06, "cf": 0.91, "cx": -0.74, "cy": -0.52, "vc": 0.44, "band": 0.89}, {"wf": 0.01, "bf": 0.0, "cf": 0.99, "cx": 0.82, "cy": -0.06, "vc": 0.8, "band": 0.99}, {"wf": 0.17, "bf": 0.19, "cf": 0.64, "cx": -0.07, "cy": -0.53, "vc": 0.45, "band": 0.61}, {"wf": 0.18, "bf": 0.01, "cf": 0.81, "cx": 0.77, "cy": 0.26, "vc": 0.93, "band": 0.8}, {"wf": 0.04, "bf": 0.31, "cf": 0.65, "cx": -0.59, "cy": 0.2, "vc": 0.45, "band": 0.62}, {"wf": 0.02, "bf": 0.36, "cf": 0.61, "cx": 0.6, "cy": -0.07, "vc": 0.44, "band": 0.58}, {"wf": 0.14, "bf": 0.79, "cf": 0.06, "cx": -0.23, "cy": -0.09, "vc": 0.42, "band": 0.02}, {"wf": 0.25, "bf": 0.01, "cf": 0.74, "cx": 0.67, "cy": 0.6, "vc": 0.9, "band": 0.74}]
def priors():
    out=[dict(id=0,prior=1,f=dict(wf=.9,bf=0,cf=.05,cx=0,cy=0,vc=0,band=.03)), dict(id=8,prior=1,f=dict(wf=.02,bf=.9,cf=.05,cx=0,cy=0,vc=.3))]
    for i in range(1,8):
        cx,cy=hv(BASE[i],0.7 if i in (6,7) else 0.85); vc=0.55 if i in (6,7) else 1.05
        out.append(dict(id=i,prior=1,f=dict(wf=.04,bf=.03,cf=.9,cx=cx,cy=cy,vc=vc,band=.85)))
        out.append(dict(id=i+8,prior=1,f=dict(wf=.28,bf=.02,cf=.65,cx=cx*.9,cy=cy*.9,vc=vc,band=.5)))
    for i,f in enumerate(SET): out.append(dict(id=i,prior=1,f=f))
    return [o for o in out if o['id']<=9]
def cost(f,s,clv):
    g=s['f']; d=2.2*abs(f['wf']-g['wf'])+1.6*abs(f['bf']-g['bf'])+0.5*abs(f['cf']-g['cf'])
    if f['cf']>0.15 and g['cf']>0.15: d+=1.8*math.hypot(f['cx']-g['cx'],f['cy']-g['cy'])+0.3*abs(f['vc']-g['vc'])
    elif f['cf']>0.03 and g['cf']>0.03: d+=0.9*math.hypot(f['cx']-g['cx'],f['cy']-g['cy'])
    if 'band' in f and 'band' in g and (f['cf']>0.05 or g['cf']>0.05): d+=1.1*abs(f['band']-g['band'])
    d+= 0.3 if s.get('prior') else 0.2*abs(s.get('cl',clv)-clv)
    return d
# gather labelled features
data=[]
for sess in ['real1','real2','real3','real4','real5']:
    for pic in json.load(open(f'redet_{sess}.json')):
        have=by[(sess,pic['shot'],pic['tag'])]
        for f in pic['found']:
            if not f['feat']: continue
            m=[h for h in have if math.hypot(float(h['px'])-f['px'],float(h['py'])-f['py'])<max(8,0.9*f['pr'])]
            if not m: continue
            h=min(m,key=lambda h:math.hypot(float(h['px'])-f['px'],float(h['py'])-f['py']))
            if h['label']=='?': continue
            data.append(dict(sess=sess,shot=pic['shot'],label=h['label'],f=f['feat'],clv=f['clv']))
print('labelled spots with features',len(data), collections.Counter(d['label'] for d in data))
json.dump(data,open('feat_data.json','w'))
def classify(f,clv,samples):
    best={}
    for s in samples:
        c=cost(f,s,clv)
        if s['id'] not in best or c<best[s['id']]: best[s['id']]=c
    i=min(best,key=best.get); return i,best[i]
P=priors()
for name,extra in [('current looks',lambda sess:[]),('+ library (other sessions)',lambda sess:[dict(id=int(d['label']),f=d['f'],cl=d['clv'],walk=1) for d in data if d['sess']!=sess and d['label']!='nb'])]:
    tot=ok=0; per=collections.Counter(); pert=collections.Counter(); nbrej=nbn=0
    for sess in ['real1','real2','real3','real4','real5']:
        S=P+extra(sess)
        for d in data:
            if d['sess']!=sess: continue
            i,c=classify(d['f'],d['clv'],S)
            if d['label']=='nb': nbn+=1; nbrej+= c>2.1; continue
            tot+=1; pert[d['label']]+=1
            if str(i)==d['label'] and c<=2.1: ok+=1; per[d['label']]+=1
    print(f'{name}: right {ok}/{tot} = {100*ok/tot:.0f}%  per ball', {k:f'{per[k]}/{pert[k]}' for k in sorted(pert)}, f' not-a-ball rejected {nbrej}/{nbn}')
# with not-a-ball looks as their own class
tot=ok=0; nbok=nbn=0; lost=0
for sess in ['real1','real2','real3','real4','real5']:
    S=P+[dict(id=(-1 if d['label']=='nb' else int(d['label'])),f=d['f'],cl=d['clv'],walk=1) for d in data if d['sess']!=sess]
    for d in data:
        if d['sess']!=sess: continue
        i,c=classify(d['f'],d['clv'],S)
        if d['label']=='nb': nbn+=1; nbok+= (i==-1 or c>2.1); continue
        tot+=1; ok+= str(i)==d['label'] and c<=2.1; lost+= i==-1
print(f'+ library incl. not-a-ball looks: balls right {ok}/{tot} = {100*ok/tot:.0f}% (balls wrongly called not-a-ball {lost}); not-a-ball caught {nbok}/{nbn}')
