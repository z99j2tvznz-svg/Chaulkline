"""Final checks + a sha256 manifest of every output file. Exits non-zero if a reproduction check failed."""
import json, os, sys
from common import OUT, out, sha256

prov = json.load(open(out('provenance.json'))); fr = json.load(open(out('frozen-reproduction.json')))
base = json.load(open(out('product', 'baseline-reproduction.json')))
checks = dict(package_unchanged=prov['package_unchanged_since_package_commit'],
              scorer_identical_to_v06=all(prov['scorer_files_identical_to_v06_commit'].values()),
              frozen_reader_reproduces_stored_probabilities=fr['max_abs_prob_difference_vs_stored'] < 1e-3,
              v06_baseline_exact=all(base['exact'].values()), product_metrics_identical_to_pm_v06=base['product_metrics_output_identical_to_published_pm_v06'])
man = {os.path.relpath(os.path.join(dp, f), OUT): sha256(os.path.join(dp, f)) for dp, _, fs in os.walk(OUT) for f in fs
       if not f.endswith('.npz') and '/product/alt' not in dp and 'manifest' not in f}
json.dump(dict(checks=checks), open(out('checks.json'), 'w'), indent=1)
json.dump(man, open(out('manifest-sha256.json'), 'w'), indent=1, sort_keys=True)
print(json.dumps(checks, indent=1))
if not all(checks.values()): sys.exit('a reproduction check failed')
