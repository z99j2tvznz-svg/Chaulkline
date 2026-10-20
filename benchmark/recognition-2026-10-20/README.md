# Ball-recognition benchmark (isolated, 2026-10-20)

An independent, reproducible comparison of the frozen number reader against two challenger recognisers, run on
GitHub Actions (`.github/workflows/recognition-benchmark.yml`). It reads `collab/recognition-package-2026-10-20`
(published at commit 9652277) and the frozen v0.6 scorer inside it; it changes nothing in the package, the app or v0.6.
Nothing here is promoted.

## What the workflow does (each step is a script in `bench/`, run in this order)

| Step | Script | Output (in the run's artifact `recognition-benchmark-results`) |
|---|---|---|
| 0 | `s00_verify.py` - commits, package diff vs 9652277 (must be empty), sha256 of key files, scorer files == v0.6 commit 7e08306 | `provenance.json` |
| 1 | `s01_data.py` - train / dev / test lists from player-verified labels only; leak check | `data/examples.csv`, `data/split-check.json` (+ arrays in artifact `recognition-benchmark-example-arrays`) |
| 2 | `s02_frozen.py` - frozen reader re-run on the exact 24x24 test pictures vs stored probabilities | `predictions/frozen.csv`, `frozen-reproduction.json` |
| 3 | `s03_challenger_a.py` - colour / appearance features + one multinomial logistic regression (11 classes) | `predictions/challenger_a.csv`, `models/challenger_a.*`, `logs/challenger_a.json` |
| 4 | `s04_challenger_b.py` - small CNN (about 60k weights) on 40x40 crops, exported to ONNX | `predictions/challenger_b.csv`, `models/challenger_b.onnx`, `logs/challenger_b.json` |
| 4b | `s04b_seed_spread.py` - challenger B retrained with seeds 1-4 (stability only, not used for any choice) | `metrics/challenger_b_seed_spread.json` |
| 5 | `s05_evaluate.py` - the same test examples for all three systems | `metrics/summary.json`, `metrics/recognition_metrics.csv`, `metrics/confusion_*.csv`, `predictions/all_systems_test.csv` |
| 5b | `s05b_product_models.py` - re-scores the exact models used at product level and checks the committed per-spot answers equal the test predictions at the labelled spots | `metrics/product_models_recognition.json` |
| 6 | `s06_product.py` - unchanged v0.6 scorer: baseline as published, then each reader swapped in | `product/baseline-reproduction.json`, `product/product_metrics.csv`, `product/product_results.json`, `product/runs/*` |
| 7 | `s07_checks.py` - fails the run if the package changed, the reader or the v0.6 baseline did not reproduce | `checks.json`, `manifest-sha256.json` |

Logs of every step, `pip freeze` and the Node version are in `logs/`. Seeds, thresholds and hyper-parameters are in
`config.json` (all fixed before any test-set run).

Manual runs with `publish_to_branch` also commit these small results to `actions-results/run-<id>/` on this branch
(artifact downloads were blocked from the Claude container, and the product step needs the trained models).

## Rules

- **Split.** Train/dev = Oct 12-16 sessions only; dev = the three Oct 15 sessions + Oct 16 clips with an odd shot number
  (used only to fit one temperature per challenger, and logged). Test = every Oct 17-19 session, scored once.
  Splitting is by session, so no clip or frame crosses; `split-check.json` also confirms no identical crop and reports
  nearest-neighbour picture distances between test and train.
- **Labels.** Training uses only player-verified labels: labels-v1 (old-app pictures Oct 12-16, including the 172
  deleted app guesses as "not a ball") and the verified Oct 16 video crops in `index.csv`. The reader-training library
  (labels inferred by Claude) and the old app's own labels are not used. Test scoring uses only held-out pictures with a
  player-verified number; balls whose number was not verified and the light-step pictures (by eye only) are counted
  and reported apart, never scored.
- **One decision rule for every system** (the tracker's own vote thresholds): "not a ball" when that probability is at
  least 0.5; otherwise the top number counts as a confident answer when its probability is at least 0.6, else unsure.
- **Units.** Each test ball appears in up to 15 consecutive still frames, so picture counts are not independent.
  Results are given per picture and per ball (its frames' probabilities averaged), with a ball-level paired bootstrap.
- **No verified non-balls exist in the held-out sessions**, so false-detection rejection cannot be measured there.

## Product-level run and the footage

The v0.6 scorer needs the reader's answer for every detection spot in every frame (358,601 spots at 30 fps), which
needs the original video. The footage (about 700 MB) is not on GitHub. So:

1. `local/radii.js` gets each spot's ball radius from the app's own camera model (same as `reader-input.js`).
2. `local/infer_footage.py` re-extracts the frames exactly as `clip-detect.js` does, cuts the same crops, and runs
   the frozen reader (as a control on these crops), challenger A and challenger B (the models produced by the Actions
   run) on every spot. Its output is `replacement-predictions/{frozen30,d30b}.npz` with `MANIFEST.json`
   (model and footage hashes).
3. The workflow merges those answers into copies of the frozen detection files (only `rec`, `p`, `nb` change; an
   assertion checks every clip's spot count) and runs the unchanged scorer.

The models used are those of Actions run 39500020895 (`actions-results/run-39500020895/models`). Product totals are
given for all 116 shots and for the 92 held-out shots alone, because Oct 16 is train/dev data for the challengers.
`control_frozen` = the frozen reader re-run on this pipeline's own crops: it shows what re-cropping alone changes.

Checked: on held-out labelled spots the local crops are byte-identical to the package's `crop-before-resize` pictures.

## Reproducing from a clean checkout

```
git clone https://github.com/z99j2tvznz-svg/Chaulkline && cd Chaulkline && git checkout claude/project-thread-vl1o4a
python3.12 -m venv v && . v/bin/activate
pip install -r benchmark/recognition-2026-10-20/requirements.txt
pip install torch==2.5.1 --index-url https://download.pytorch.org/whl/cpu      # Node 22 also needed (step 6)
cd benchmark/recognition-2026-10-20/bench
for s in s00_verify s01_data s02_frozen s03_challenger_a s04_challenger_b s05_evaluate s06_product s07_checks; do python $s.py; done
```
Outputs go to `benchmark/recognition-2026-10-20/out/` (or `$BENCH_OUT`). Re-running Challenger B on another CPU can
differ in the last digits; the product step uses the committed replacement predictions, whose model hashes are in
`replacement-predictions/MANIFEST.json`. To redo step 2 of the product run you need the footage archives
(`chalkline-footage-*.zip`), ffmpeg, Node 22 + Playwright 1.56.1 (`npm install` in `local/`).
