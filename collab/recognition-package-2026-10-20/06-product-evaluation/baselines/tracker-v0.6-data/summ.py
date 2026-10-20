import json,glob,os,sys
S=os.path.dirname(os.path.abspath(__file__))
sess=sorted(set(os.path.basename(f).rsplit('.',2)[0] for f in glob.glob(S+'/*.v05.json')))
CF=['v05','outline','absence','both']
K=['correctAutomatically','confidentlyWrong','phantomPockets','madeCalledOnTable','stateErrors','madeLeftUnresolved','realShotsMissed','falseShots','correctionsNeeded','racksComplete']
G={c:{m:{k:0 for k in K} for m in ['checkpoint','continuous']} for c in CF}
newwrong=[]
for s in sess:
  R={c:json.load(open(f'{S}/{s}.{c}.json')) for c in CF}
  for m in ['checkpoint','continuous']:
    row=[]
    for c in CF:
      t=R[c][m]['totals']
      for k in K: G[c][m][k]+=t[k]
      row.append(f"{c}: ok {t['correctAutomatically']}/{t['realShotClips']} wrong {t['confidentlyWrong']} ph {t['phantomPockets']} open {t['madeLeftUnresolved']}")
    print(s,m,' | '.join(row))
    base={x['clip']:x for r in R['v05'][m]['racks'] for x in r['clips']}
    for c in CF[1:]:
      for r in R[c][m]['racks']:
        for x in r['clips']:
          if x.get('missing'): continue
          b=base[x['clip']]; bw={(w['fact'],w.get('ball'),w['what']) for w in b.get('wrong',[])}
          nw=[w for w in x['wrong'] if (w['fact'],w.get('ball'),w['what']) not in bw]
          if nw: newwrong.append((s,m,c,x['clip'],[(w.get('ball'),w['what']) for w in nw]))
print()
for c in CF:
  for m in ['checkpoint','continuous']: print(c,m,G[c][m])
print('\nNEW WRONG vs v0.5:')
for x in newwrong: print(' ',x)
json.dump({'totals':G,'newWrong':newwrong},open(S+'/summary.json','w'),indent=1)
