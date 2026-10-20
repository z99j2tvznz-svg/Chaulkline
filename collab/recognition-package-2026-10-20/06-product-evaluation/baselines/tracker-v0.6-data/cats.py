import json,glob,os,collections
S=os.path.dirname(os.path.abspath(__file__)); out={}
for mode in ['checkpoint','continuous']:
  tot=collections.Counter(); per={}
  for f in sorted(glob.glob(S+'/*.both.json')):
    n=os.path.basename(f)[:-10]; B=json.load(open(f))[mode]; C=collections.Counter()
    for r in B['racks']:
      for c in r['clips']:
        if c.get('missing'): continue
        opn=[u['ball'] for u in c['unresolved'] if u['fact']=='made']
        if not opn: continue
        tb=[t for t in c['trace'] if t['label']=='before']; a=[t for t in c['trace'] if t['label']=='after'][0]
        missing=[int(k) for k,v in a['after'].items() if v!='present' and a['prev'].get(k) in('present','unconfirmed')]
        for b in opn:
          p0=(tb[0]['prev'] if tb else a['prev'])
          carried=lambda m: p0.get(str(m))=='unconfirmed'
          if carried(b): why='uncertainty carried from an earlier shot (this ball)'
          elif not tb: why='shot not segmented (no before look)'
          elif not a['settled']: why='after look not settled (table still moving at clip end)'
          elif a['unnamed']>0: why='after look has an unnamed spot (identification)'
          else:
            bn={s['num'] for s in tb[0]['seen'] if s['num'] is not None}
            drop=len(tb[0]['seen'])-len(a['seen'])
            if b not in bn: why='not named before the shot (identification)'
            elif not all(m in bn for m in missing):
              why='another missing ball uncertain from an earlier shot' if any(carried(m) for m in missing if m not in bn) else 'another missing ball not named before (identification)'
            elif drop!=len(missing): why='ball count did not fall to match'
            elif drop>2: why='3+ balls at once'
            else: why='never seen rolling away'
          C[why]+=1
    per[n]=dict(C); tot+=C
  out[mode]={'total':dict(tot),'perSession':per}
  print(mode,sum(tot.values())); [print('  ',v,k) for k,v in tot.most_common()]
json.dump(out,open(S+'/categories.json','w'),indent=1)
