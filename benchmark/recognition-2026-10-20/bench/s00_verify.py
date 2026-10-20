"""Record exactly what is being benchmarked: commits, package fingerprint, and that the package is unchanged since it was
published (git diff against the package commit). Writes out/provenance.json. Fails if the package was modified."""
import json, os, platform, subprocess, sys
from common import PKG, REPO, CFG, out, sha256

git = lambda *a: subprocess.run(['git', '-C', REPO, *a], capture_output=True, text=True).stdout.strip()
pkg_rel = CFG['package']
changed = git('diff', '--name-only', CFG['package_commit'], '--', pkg_rel)
files = sorted(os.path.join(dp, f) for dp, _, fs in os.walk(PKG) for f in fs)
key = ['03-reader-and-detector/reader/recog.json', '01-images/reader-inputs/index.csv',
       '02-ground-truth/player-verified/all-verified-ball-labels.csv', '02-ground-truth/player-verified/label-set-v1/labels-v1.json',
       '06-product-evaluation/baselines/tracker-v0.6-data/pm-v06.json', 'code/tools/tracker.js', 'code/tools/reconcile.js',
       'code/tools/score-racks.js', 'code/tools/experiments/product-metrics.js', 'code/COMMIT.txt']
prov = dict(
    benchmark_commit=git('rev-parse', 'HEAD'), benchmark_branch=os.environ.get('GITHUB_REF_NAME') or git('rev-parse', '--abbrev-ref', 'HEAD'),
    package=pkg_rel, package_commit=git('rev-parse', CFG['package_commit']),
    package_unchanged_since_package_commit=changed == '', package_files_changed=changed.splitlines(),
    package_file_count=len(files), package_tree_hash=git('rev-parse', f"HEAD:{pkg_rel}"),
    package_code_commit=open(os.path.join(PKG, 'code', 'COMMIT.txt')).read().strip(),
    v06_reference_commit=git('rev-parse', CFG['v06_code_commit'] + '^{commit}') or CFG['v06_code_commit'] + ' (not in this clone)',
    key_file_sha256={k: sha256(os.path.join(PKG, k)) for k in key},
    python=sys.version, platform=platform.platform(), node=subprocess.run(['node', '--version'], capture_output=True, text=True).stdout.strip(),
    github_run=dict(id=os.environ.get('GITHUB_RUN_ID'), attempt=os.environ.get('GITHUB_RUN_ATTEMPT'), runner=os.environ.get('RUNNER_OS'),
                    url=(f"{os.environ.get('GITHUB_SERVER_URL')}/{os.environ.get('GITHUB_REPOSITORY')}/actions/runs/{os.environ.get('GITHUB_RUN_ID')}"
                         if os.environ.get('GITHUB_RUN_ID') else None)))
same = lambda f: subprocess.run(['git', '-C', REPO, 'show', f"{CFG['v06_code_commit']}:{f}"], capture_output=True).stdout == open(os.path.join(PKG, 'code', f), 'rb').read()
prov['scorer_files_identical_to_v06_commit'] = {f: same(f) for f in ('tools/tracker.js', 'tools/reconcile.js', 'tools/score-racks.js', 'tools/experiments/product-metrics.js')}
json.dump(prov, open(out('provenance.json'), 'w'), indent=1)
print(json.dumps({k: prov[k] for k in ('benchmark_commit', 'package_commit', 'package_unchanged_since_package_commit', 'package_file_count', 'package_tree_hash')}))
if changed: sys.exit('the recognition package differs from its published commit: ' + changed)
