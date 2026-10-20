import json,csv,math,collections
rows=list(csv.DictReader(open('lib/manifest.csv')))
lab=collections.defaultdict(list)
for r in rows: lab[(r['session'],int(r['shot']),r['pic'])].append(r)
def truthset(sess,shot,pic): return {r['label'] for r in lab[(sess,shot,pic)] if r['label'] not in ('nb','?')}
def load(sess):
    J=json.load(open(sess+'/log.txt')); return J['header']['shots'], J['events']
# ---------- drill (real4) ----------
shots,ev=load('real4'); res=[e for e in ev if e['k']=='result']
L=json.load(open('real4/labels.json'))['shots']
print('DRILL real4')
agree_now=agree_new=n=0; rows_out=[]
for i,s in enumerate(shots):
    lb=L[i]; r=res[i]
    if not s.get('drill'): print(f'  shot {i+1}: unseen/ball-move shot, new rule: ignored'); continue
    ball=str(s['ball']); after=truthset('real4',i+1,'after'); before=truthset('real4',i+1,'before')
    truth = (ball not in after) if ball in before or not s.get('blind') else None
    new = int(ball) in r['gone'] or s.get('blind',False)
    n+=1; agree_now += (truth is None) or (s['dmade']==truth); agree_new += (truth is None) or (new==truth)
    if truth is not None and (s['dmade']!=truth or new!=truth) or r['dropN']>1:
        print(f"  shot {i+1} ball {ball}: truth made={truth} app said {s['dmade']} (dropN {r['dropN']}), new rule {new}")
print(f'  drill shots {n}: app right {agree_now}, new rule right {agree_new}')
# ---------- watch (real5) ----------
shots,ev=load('real5'); L=json.load(open('real5/labels.json'))['shots']
snaps=[e for e in ev if e['k']=='table']; starts=[e for e in ev if e['k']=='shot_start']; afters=[e for e in ev if e['k']=='after']; results=[e for e in ev if e['k']=='result']
def age(ts,x,y):
    # how long a ball has been sitting at (x,y) (any number) just before ts, from the layout snapshots
    t0=None
    for e in snaps:
        if e['t']>ts: break
        here=any(math.hypot(b[1]-x,b[2]-y)<1.5 for b in e['b'])
        if here and t0 is None: t0=e['t']
        if not here: t0=None
    return (ts-t0)/1000 if t0 is not None else 0
print('\nWATCH real5')
tab=collections.Counter()
for T in (3,6):
  ok_app=ok_new=cnt=0; si=0
  for i,s in enumerate(shots):
    if s.get('unseen'): continue
    a=afters[si]; st=starts[si]; r=results[si+0]; si+=1
    # result events include the unseen ones; find the result right after this 'after'
    r=next(e for e in results if e['t']>=a['t'])
    bef=truthset('real5',i+1,'before'); aft=truthset('real5',i+1,'after')
    if not L[i].get('before'): continue
    true_drop=len([b for b in bef if b not in aft])
    keep=[b for b in a["before"] if b[0]==0 or age(st["t"],b[1],b[2])>=T]
    keep_ids={b[0] for b in keep}
    now=r['now']; miss=[m for m in r['missing'] if m in keep_ids]
    new_drop=min(len(miss), max(0,len(keep)-now)) if r['clear'] else len(miss)
    app_drop=r['dropN']
    cnt+=1; ok_app+= app_drop==true_drop; ok_new+= new_drop==true_drop
    if T==3 and (app_drop!=true_drop or new_drop!=true_drop): print(f'  shot {i+1}: true drop {true_drop} {sorted(set(bef)-set(aft))}, app {app_drop} {r["gone"]}, new rule {new_drop}  (phantoms {[b[0] for b in a["before"] if b not in keep]})')
  print(f'  T={T}s: shots checked {cnt}: app drop count right {ok_app}, new rule right {ok_new}')
