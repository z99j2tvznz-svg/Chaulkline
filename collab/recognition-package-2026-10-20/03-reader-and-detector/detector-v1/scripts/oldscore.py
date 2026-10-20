import json, sys
sys.path.insert(0, '.')
from evalfind import *
O = json.load(open('old-finder.json'))
raw = {p['id']: [(d['px'], d['py'], d['pr'], 1.0) for d in p['found']] for p in O['pictures']}
filt = {p['id']: [(d['px'], d['py'], d['pr'], 1.0) for d in p['found'] if d['nb'] is None or d['nb'] < 0.5] for p in O['pictures']}
sets = [('Checking crops, all (24)', ids_where(split='validation', kind='crop')),
        ('… Oct 16 crops (12)', ids_where(group='oct16-crop')), ('… hall crops (12)', ids_where(group='hall')),
        ('Checking full frames, Oct 16 (29)', ids_where(split='validation', kind='frame')),
        ('Training crops (132, for reference)', ids_where(split='training'))]
for rule in ['main', 'loose']:
    print('\n## rule', rule)
    for name, ids in sets:
        print('\n###', name); print(HEAD)
        print(line('old finder, everything it reports', score(raw, ids, rule)))
        print(line('old finder, not-a-ball filter (as the baseline)', score(filt, ids, rule)))
# app's live guesses on crops (counts from the labelling, different rule: Nackers' keep/delete)
import collections
for name, ids in sets[:3] + sets[4:]:
    c = collections.Counter()
    for i in ids:
        p = PICS[i]
        if p['kind'] != 'crop': continue
        c['kept'] += sum(b['src'] == 'proposed' for b in p['balls']); c['added'] += sum(b['src'] != 'proposed' for b in p['balls'])
        c['del'] += len(p['removed']); c['balls'] += len(p['balls'])
    print(name, 'live guesses: found', c['kept'], '/', c['balls'], 'false', c['del'], 'precision %.0f%%' % (100 * c['kept'] / (c['kept'] + c['del'])))
