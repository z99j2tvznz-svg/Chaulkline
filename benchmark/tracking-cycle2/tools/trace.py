"""Print a rack-by-rack trace of one scorer run (looks, names, confirmations, open balls, result)."""
import json, sys
R = json.load(open(sys.argv[1]))[sys.argv[2] if len(sys.argv) > 2 else 'continuous']
for rk in R['racks']:
    print('RACK', rk['rack'])
    for c in rk['clips']:
        if c.get('missing'): continue
        for t in c['trace']:
            print(' ', c['clip'], t['label'], 'settled' if t['settled'] else 'MOVING', 'seen', sorted(s['num'] for s in t['seen'] if s['num'] is not None), 'unn', t['unnamed'],
                  'conf', [(x['ball'], x['change']) for x in t['confirmed']] + [('D', x['ball']) for x in t.get('delayedConfirmed', [])],
                  'open', sorted(set(u['ball'] for u in t['unresolved'] if u['ball'] is not None)), 'pev', [(p['ball'], p['inMouth']) for p in t['pocketEvents']])
        print('   =>', c['result'], [w['what'][:45] + ' ' + str(w.get('ball', '')) for w in c['wrong']], [u['what'][:45] + ' ' + str(u.get('ball', '')) for u in c['unresolved']][:4])
