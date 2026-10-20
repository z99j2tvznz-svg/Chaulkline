"""Stability check for challenger B (not used for any choice): retrain with seeds 1-4 and score each on the same test
pictures with the same rule. Re-running seed 0 on different hardware also differs slightly (float order), which is part
of the spread. Writes out/metrics/challenger_b_seed_spread.json."""
import json
import s04_challenger_b as B
from common import out, read_csv
from s05_evaluate import counts

ex = {e['id']: e for e in read_csv(out('data', 'examples.csv')) if e['split'] == 'test' and int(e['y']) >= 0}
res = {}
for seed in (1, 2, 3, 4):
    B.main(seed=seed, tag=f'challenger_b_seed{seed}')
    P = {r['id']: r for r in read_csv(out('predictions', f'challenger_b_seed{seed}.csv'))}
    res[seed] = counts([(int(e['y']), P[i]['kind'], int(P[i]['number'])) for i, e in ex.items()])
    print(seed, res[seed], flush=True)
json.dump(dict(note='picture-level counts on all verified held-out test pictures; seed 0 is the main run (metrics/summary.json)', seeds=res),
          open(out('metrics', 'challenger_b_seed_spread.json'), 'w'), indent=1)
