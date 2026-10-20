import json, sys
S='/tmp/claude-0/-home-claude-Chaulkline/f9299a23-210b-55c4-9e9e-0f413c3805a1/scratchpad'
SESS={'oct16':'2026-10-16_evening_V2.3.3','otherside':'2026-10-17_1500_V2.3.3_otherside','firstspot':'2026-10-17_2151_V2.3.3_firstspot'}
def oldcalls(s):
    txt=open(f'/mnt/project-files/chalkline-data/sessions/{s}/log.txt').read()
    d,_=json.JSONDecoder().raw_decode(txt.replace('\n',''))
    return d['header']['shots']
def pair(M,N,q):
    tp=M&N; extra=N-M; miss=M-N
    mis=min(len(extra),len(miss)); ph=len(extra)-mis; rem=len(miss)-mis
    unn=min(q,rem); phq=q-unn
    return dict(true=len(tp),misnamed=mis,phantom=ph+phq,unnamedOrOpen=unn,missed=rem-unn)
keys=['true','misnamed','phantom','unnamedOrOpen','missed','calledOnTable','falseScratch','missedScratch','firstRight','firstChecked','clipsAllRight']
G={}
for k,s in SESS.items():
    T=json.load(open(f'/home/claude/Chaulkline/data/truth/{s}.json'))
    old=oldcalls(s)
    new={v:json.load(open(f'{S}/{v}-{k}.json'))['continuous'] for v in ['v04','v05']}
    for sysn in ['old','v04','v05']:
        tot={x:0 for x in keys}; racks=[]
        for ri,R in enumerate(T['racks']):
            rackok=True; rackpock=True
            for c in R['clips']:
                t=T['clips'][c]; uns=set(t.get('unsureBalls',[]))
                M=set(t.get('made',[])+t.get('madeAfterClip',[]))-uns-{0}
                tsc=bool(t.get('scratch'))
                if sysn=='old':
                    o=old[int(c[4:])-1]; mm=o.get('made') or []
                    N=set(x for x in mm if x!='?')-uns-{0}; q=mm.count('?')
                    sc=bool(o.get('scratch')); fb=o.get('first'); onT=0
                else:
                    cl=[x for r in new[sysn]['racks'] for x in r['clips'] if x['clip']==c][0]
                    a=[x for x in cl['trace'] if x['label']=='after'][0]
                    conf=set(x['ball'] for x in a['confirmed'] if x['change']=='pocketed')
                    N=conf-uns-{0}; sc=0 in conf
                    openM=set(x['ball'] for x in cl['unresolved'] if x['fact']=='made')
                    q=len(openM & M)
                    onT=sum(1 for w in cl['wrong'] if w['fact']=='made' and w['what'].startswith('went in'))
                    fb=(cl.get('first') or {}).get('tracker')
                p=pair(M,N,q)
                if sysn!='old': p['missed']-=0  # missed includes calledOnTable for new
                p['calledOnTable']=onT
                p['falseScratch']=int(sc and not tsc); p['missedScratch']=int(tsc and not sc)
                if t.get('first') is not None and t.get('shot'):
                    p['firstChecked']=1; p['firstRight']=int(fb==t['first'])
                ok=p['misnamed']+p['phantom']+p['unnamedOrOpen']+p['missed']+p['falseScratch']+p['missedScratch']==0
                p['clipsAllRight']=int(ok)
                if not ok: rackpock=False
                for x in p: tot[x]=tot.get(x,0)+p[x]
            racks.append(rackpock)
        tot['clips']=sum(len(R['clips']) for R in T['racks']); tot['racksAllPocketsRight']=f"{sum(racks)}/{len(racks)}"
        tot['truthMade']=sum(len(set(T['clips'][c].get('made',[])+T['clips'][c].get('madeAfterClip',[]))-set(T['clips'][c].get('unsureBalls',[]))) for R in T['racks'] for c in R['clips'])
        G.setdefault(sysn,{})[k]=tot
for sysn,v in G.items():
    print(sysn)
    for k,t in v.items(): print(' ',k,t)
json.dump(G,open(f'{S}/cmp/result.json','w'),indent=1)
