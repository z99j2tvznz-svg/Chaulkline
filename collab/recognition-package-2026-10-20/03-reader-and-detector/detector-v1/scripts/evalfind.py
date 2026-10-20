"""Score ball finders against labels-v1 with one matching rule for every finder.

A detection matches a labelled ball when its centre is within max(5, 0.6 r) px of the ball's centre (the rule in
tools/replay-pictures.js), one-to-one, closest pairs first. Balls marked "in a pocket" are not counted as balls to
find, and a detection on one is neither a hit nor a false ball (reported separately).
"""
import json, math, sys, collections

LAB = json.load(open('/home/claude/Chaulkline/data/labels/label-set-v1.json'))
PICS = {p['id']: p for p in LAB['pictures']}
HALL = '2026-10-13_1835_V2.2'


def far(p, b):
    return b['y'] < (p['h'] / 3 if p['kind'] == 'crop' else 0.4 * p['h'])


def group(p):
    return 'hall' if p['session'] == HALL else ('oct16-frame' if p['kind'] == 'frame' else 'oct16-crop' if p['session'].startswith('2026-10-16') else p['session'])


def match(balls, dets, rule):
    pairs = []
    for i, b in enumerate(balls):
        lim = rule(b['r'])
        for j, d in enumerate(dets):
            e = math.hypot(d[0] - b['x'], d[1] - b['y'])
            if e <= lim: pairs.append((e, i, j))
    pairs.sort(); bi, dj, out = set(), set(), []
    for e, i, j in pairs:
        if i in bi or j in dj: continue
        bi.add(i); dj.add(j); out.append((i, j, e))
    return out


RULES = {'main': lambda r: max(5, 0.6 * r), 'loose': lambda r: r}


def score(dets_by_id, ids, rule='main', keep=lambda p, d: True):
    """dets_by_id: id -> [(x, y, r, conf)]. Returns counts for the pictures in ids."""
    c = collections.Counter(); errs = []
    for pid in ids:
        p = PICS[pid]; dets = [d for d in dets_by_id.get(pid, []) if keep(p, d)]
        table = [b for b in p['balls'] if not b['inPocket']]
        pock = [b for b in p['balls'] if b['inPocket']]
        m = match(table, dets, RULES[rule])
        used = {j for _, j, _ in m}
        rest = [d for j, d in enumerate(dets) if j not in used]
        mp = match(pock, rest, RULES[rule])
        c['pics'] += 1; c['balls'] += len(table); c['found'] += len(m); c['dets'] += len(dets)
        c['false'] += len(rest) - len(mp); c['pocket'] += len(pock); c['pocket_found'] += len(mp)
        for i, j, e in m: errs.append(e)
        for i, b in enumerate(table):
            hit = any(k == i for k, _, _ in m)
            if far(p, b): c['far'] += 1; c['far_found'] += hit
            else: c['near'] += 1; c['near_found'] += hit
            if b['partial']: c['partial'] += 1; c['partial_found'] += hit
    errs.sort()
    c['err_med'] = errs[len(errs) // 2] if errs else None
    c['err_mean'] = sum(errs) / len(errs) if errs else None
    return c


def line(name, c):
    pct = lambda a, b: f'{100 * a / b:.0f}%' if b else '-'
    prec = c['found'] / (c['found'] + c['false']) if c['found'] + c['false'] else 0
    return (f"| {name} | {c['pics']} | {c['balls']} | {c['found']} ({pct(c['found'], c['balls'])}) | {pct(c['far_found'], c['far'])} of {c['far']} | "
            f"{pct(c['near_found'], c['near'])} | {c['false']} | {100 * prec:.0f}% | {c['false'] / c['pics']:.2f} | "
            f"{(c['err_med'] or 0):.1f} / {(c['err_mean'] or 0):.1f} | {c['pocket_found']}/{c['pocket']} |")


HEAD = ('| Finder | Pictures | Balls | Found | Far found | Near found | False balls | Precision | False per picture | Centre error px (median / mean) | In-pocket found |\n'
        '|---|---|---|---|---|---|---|---|---|---|---|')


def ids_where(**kw):
    out = []
    for p in LAB['pictures']:
        if all((group(p) if k == 'group' else p[k]) in (v if isinstance(v, (list, tuple)) else [v]) for k, v in kw.items()): out.append(p['id'])
    return out
