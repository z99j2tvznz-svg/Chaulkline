"""Score the frozen reader and both challengers on the same held-out test examples.
Writes out/metrics/*.json|csv and out/predictions/all_systems_test.csv (one row per test picture, every system)."""
import collections, json
import numpy as np
from common import CFG, CLASSES, out, read_csv, write_csv, decide

SYSTEMS = ['frozen', 'challenger_a', 'challenger_b']
SESS = {'2026-10-17_1500_V2.3.3_otherside': 'Oct 17 other side', '2026-10-17_2151_V2.3.3_firstspot': 'Oct 17 far spot',
        'rec-20261017-1730': 'Oct 17 recorder', 'rec-20261018-2310': 'Oct 18 evening', 'rec-20261019-1710': 'Oct 19 low side'}


def counts(items):
    """items: list of (truth, kind, number)."""
    c = collections.Counter(); n = len(items)
    for y, kind, k in items:
        c['correct' if kind == 'confident' and k == y else 'confidently_wrong' if kind == 'confident' else kind] += 1
    dec = c['correct'] + c['confidently_wrong']
    return dict(n=n, correct=c['correct'], confidently_wrong=c['confidently_wrong'], unsure=c['unsure'], said_not_a_ball=c['not_a_ball'],
                accuracy_when_confident=round(c['correct'] / dec, 4) if dec else None, coverage=round(dec / n, 4) if n else None,
                correct_share_of_all=round(c['correct'] / n, 4) if n else None)


def main():
    ex = {e['id']: e for e in read_csv(out('data', 'examples.csv')) if e['split'] == 'test'}
    P = {s: {r['id']: r for r in read_csv(out('predictions', s + '.csv'))} for s in SYSTEMS}
    assert all(set(P[s]) == set(ex) for s in SYSTEMS), 'every system must have exactly the same test examples'
    ids = sorted(ex); scored = [i for i in ids if int(ex[i]['y']) >= 0]
    prob = lambda s, i: np.array([float(P[s][i]['p_' + c]) for c in CLASSES])
    pick = lambda s, i: (int(ex[i]['y']), P[s][i]['kind'], int(P[s][i]['number']))

    # per-ball decision: mean of the ball's frame probabilities, same decision rule
    balls = collections.defaultdict(list)
    for i in scored: balls[ex[i]['ball_key']].append(i)
    ball_pick = {s: {b: (int(ex[v[0]]['y']),) + decide(np.mean([prob(s, i) for i in v], 0))[:2] for b, v in balls.items()} for s in SYSTEMS}

    def groups(i):
        e = ex[i]; y = int(e['y']); g = ['all', 'session: ' + SESS[e['session']]]
        g.append('cue ball' if y == 0 else '9 ball (stripe)' if y == 9 else 'solids 1-8')
        g.append('touching/near another ball (<2.5 radii)' if e['touching'] == '1' else 'no ball within 2.5 radii')
        if e['partly_hidden'] == '1': g.append('partly hidden (player-marked)')
        r = float(e['radius_px']); g.append('ball radius < 12 px' if r < 12 else 'ball radius 12-15 px' if r < 15 else 'ball radius >= 15 px')
        if e['one_frame_per_ball'] == '1': g.append('one frame per ball (frame used in earlier experiments)')
        return g

    summary = dict(decision_rule=CFG['decision_rule'], units={}, verification={}, systems=SYSTEMS)
    rows = []
    for s in SYSTEMS:
        G = collections.defaultdict(list)
        for i in scored:
            for g in groups(i): G[g].append(pick(s, i))
        for g, it in sorted(G.items()): rows.append(dict(system=s, unit='picture', group=g, **counts(it)))
        BG = collections.defaultdict(list)
        for b, v in balls.items():
            e = ex[v[0]]; BG['all'].append(ball_pick[s][b]); BG['session: ' + SESS[e['session']]].append(ball_pick[s][b])
            y = int(e['y']); BG['cue ball' if y == 0 else '9 ball (stripe)' if y == 9 else 'solids 1-8'].append(ball_pick[s][b])
        for g, it in sorted(BG.items()): rows.append(dict(system=s, unit='ball (frames averaged)', group=g, **counts(it)))
    write_csv(out('metrics', 'recognition_metrics.csv'), rows)
    for r in rows:
        if r['group'] == 'all': summary['units'].setdefault(r['unit'], {})[r['system']] = {k: r[k] for k in r if k not in ('system', 'unit', 'group')}

    # cue vs 9 detail, confusion matrices (decided), raw top-number confusion
    cols = CLASSES[:10] + ['unsure', 'not a ball']
    for s in SYSTEMS:
        M = np.zeros((10, 12), int); Mraw = np.zeros((10, 10), int)
        for i in scored:
            y, kind, k = pick(s, i); M[y, k if kind == 'confident' else 10 if kind == 'unsure' else 11] += 1; Mraw[y, k] += 1
        write_csv(out('metrics', f'confusion_{s}.csv'), [dict(truth=CLASSES[y], **{c: int(M[y, j]) for j, c in enumerate(cols)}) for y in range(10)], ['truth'] + cols)
        write_csv(out('metrics', f'confusion_top_number_{s}.csv'), [dict(truth=CLASSES[y], **{c: int(Mraw[y, j]) for j, c in enumerate(CLASSES[:10])}) for y in range(10)], ['truth'] + CLASSES[:10])
        summary.setdefault('cue_vs_9', {})[s] = dict(nine_pictures=int(M[9].sum()), nine_confidently_called_cue=int(M[9, 0]), nine_correct=int(M[9, 9]),
                                                    cue_pictures=int(M[0].sum()), cue_confidently_called_9=int(M[0, 9]), cue_correct=int(M[0, 0]))

    # changed lighting: only the unverified light-step pictures exist -> what each system says, no accuracy
    light = [i for i in ids if ex[i]['light_step'] == '1']
    summary['light_steps_unverified'] = dict(pictures=len(light), note='Identities NOT verified: no accuracy can be computed. Shows how often each system names, is unsure, or rejects.',
                                             **{s: dict(collections.Counter(P[s][i]['kind'] for i in light)) for s in SYSTEMS})
    if light:
        agree = lambda a, b: sum(P[a][i]['kind'] == 'confident' == P[b][i]['kind'] and P[a][i]['number'] == P[b][i]['number'] for i in light)
        summary['light_steps_unverified']['confident_and_same_number_a_and_b'] = agree('challenger_a', 'challenger_b')
    summary['verification'] = dict(
        scored_test_pictures=len(scored), scored_test_balls=len(balls),
        test_status_counts=dict(collections.Counter(ex[i]['status'] for i in ids)),
        excluded_from_scoring='verified balls whose number was not verified/unknown, and unverified light-step pictures',
        verified_non_balls_in_test=0,
        false_positive_rejection='NOT ESTABLISHED: the held-out sessions contain no verified non-ball examples, so rejection of false detections cannot be measured independently.',
        near_duplicates='Each test ball appears in up to 15 consecutive still frames; picture counts are not independent. Use the per-ball unit and the ball-level bootstrap.')

    # paired bootstrap over balls: challenger minus frozen, picture-level counts
    rng = np.random.default_rng(CFG['bootstrap']['seed']); bk = sorted(balls); B = CFG['bootstrap']['resamples']
    per = {s: {b: counts([pick(s, i) for i in balls[b]]) for b in bk} for s in SYSTEMS}
    boot = {}
    for s in SYSTEMS[1:]:
        dc = np.array([per[s][b]['correct'] - per['frozen'][b]['correct'] for b in bk]); dw = np.array([per[s][b]['confidently_wrong'] - per['frozen'][b]['confidently_wrong'] for b in bk])
        sam = rng.integers(0, len(bk), (B, len(bk)))
        boot[s] = dict(correct_diff=int(dc.sum()), correct_diff_95ci=[int(np.percentile(dc[sam].sum(1), 2.5)), int(np.percentile(dc[sam].sum(1), 97.5))],
                       confidently_wrong_diff=int(dw.sum()), confidently_wrong_diff_95ci=[int(np.percentile(dw[sam].sum(1), 2.5)), int(np.percentile(dw[sam].sum(1), 97.5))])
    summary['bootstrap_vs_frozen_pictures'] = boot

    # strongest candidate (rule fixed in config.json)
    pic = summary['units']['picture']; fw = pic['frozen']['confidently_wrong']
    ok = [s for s in SYSTEMS[1:] if pic[s]['confidently_wrong'] <= fw]
    summary['strongest_candidate'] = max(ok, key=lambda s: pic[s]['correct']) if ok else min(SYSTEMS[1:], key=lambda s: pic[s]['confidently_wrong'])
    summary['strongest_candidate_rule'] = CFG['strongest_candidate_rule']
    json.dump(summary, open(out('metrics', 'summary.json'), 'w'), indent=1)

    # one wide file: every test picture, truth + status + every system's probabilities
    wide = []
    for i in ids:
        e = ex[i]; r = dict(id=i, image_id=e['image_id'], session=e['session'], clip=e['clip'], frame=e['frame'], ball_key=e['ball_key'],
                            truth=CLASSES[int(e['y'])] if int(e['y']) >= 0 else '', status=e['status'], scored=int(int(e['y']) >= 0),
                            touching=e['touching'], partly_hidden=e['partly_hidden'], light_step=e['light_step'], radius_px=e['radius_px'])
        for s in SYSTEMS:
            q = P[s][i]; r.update({f'{s}_kind': q['kind'], f'{s}_number': CLASSES[int(q['number'])], f'{s}_p': q['p_top'], f'{s}_nb': q['nb']})
            r.update({f'{s}_p_{c}': q['p_' + c] for c in CLASSES})
        wide.append(r)
    write_csv(out('predictions', 'all_systems_test.csv'), wide)
    print(json.dumps({k: summary[k] for k in ('units', 'cue_vs_9', 'bootstrap_vs_frozen_pictures', 'strongest_candidate', 'light_steps_unverified')}, indent=1))


if __name__ == '__main__':
    main()
