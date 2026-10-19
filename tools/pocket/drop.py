# For made balls with no pocket event: after the ball was last named, does the one-class detector see any spot
# (named or not) come within 5 in of a pocket and then vanish there (no spot near that pocket for the rest of the clip)?
import json, math, collections, sys
V = sys.argv[1]; S = '../v04/'
PK = [(0, 0), (39, 0), (78, 0), (0, 39), (39, 39), (78, 39)]
rows = json.load(open(f'made-{V}.json')); C = collections.Counter()
for r in rows:
    if r['event'] != 'none' or r['status'] == 'confirmed' or 'not settled' in r['status'] or r['status'].startswith('wrong'): continue
    fr = json.load(open(f'{S}{V}-{r["sess"]}/{r["clip"]}.json'))['frames']
    t0 = r['lastSeen']['t'] if r['lastSeen'] else 0
    # pockets that had a spot inside 5 in after t0 and none in the last second of the clip
    hit = set()
    for f in fr:
        if f['t'] < t0: continue
        for o in f['balls']:
            for i, (a, b) in enumerate(PK):
                if math.hypot(o['x'] - a, o['y'] - b) < 5: hit.add(i)
    T = fr[-1]['t']; still = set()
    for f in fr:
        if f['t'] < T - 1: continue
        for o in f['balls']:
            for i, (a, b) in enumerate(PK):
                if math.hypot(o['x'] - a, o['y'] - b) < 5: still.add(i)
    vanished = hit - still
    k = ('far' if r['lastSeen'] and r['lastSeen']['pocketIn'] > 8 else 'near' if r['lastSeen'] else 'never named')
    C[(k, 'a spot vanished at a pocket' if vanished else 'no spot vanished at a pocket')] += 1
for k, n in sorted(C.items()): print(V, k, n)
