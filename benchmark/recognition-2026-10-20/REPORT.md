# Recognition benchmark results (2026-10-20)

Frozen reader vs Challenger A (colour/appearance features + logistic regression) vs Challenger B (small CNN, 65,715
weights, 40x40 crops). Everything below was executed on GitHub Actions unless marked otherwise. Nothing was promoted;
the package, the app, v0.6 and the labels are unchanged (checked by the workflow on every run).

- Final run (all steps, results committed by the workflow): https://github.com/z99j2tvznz-svg/Chaulkline/actions/runs/39504265303
  -> results folder `actions-results/run-39504265303/`
- Run whose trained models were used for the product-level test: https://github.com/z99j2tvznz-svg/Chaulkline/actions/runs/39500020895
  -> `actions-results/run-39500020895/`
- Earlier run (same code, first training of B): https://github.com/z99j2tvznz-svg/Chaulkline/actions/runs/39499369643
- Artifacts (zip downloads) are listed at the bottom of each run page.

## 1. Baseline reproduction (Confirmed, exact)

| Figure | Documented | Measured in Actions |
|---|---|---|
| Ending table right, each shot judged alone | 38/116 | 38/116 |
| Ending table right, played straight through | 27/116 | 27/116 |
| Confidently wrong shots | 26 | 26 (both modes) |
| Complete racks | 0/5 | 0/5 |
| product-metrics output vs published pm-v06.json | | identical |
| Frozen reader re-run vs stored probabilities (2,425 pictures) | | max difference 0.00005 |

Files: `product/baseline-reproduction.json`, `frozen-reproduction.json`, `checks.json`.

## 2. Recognition on the held-out sessions (Confirmed)

Same 1,583 player-verified test pictures (106 balls, Oct 17-19, 5 sessions) for all three. One decision rule for all:
"not a ball" if that probability >= 0.5, else confident if top number >= 0.6, else unsure. Numbers below are for the
models used at product level (run 39500020895; `metrics/product_models_recognition.json` re-scores them).

| | Frozen | A | B |
|---|---|---|---|
| Pictures right (confident) | 1,236 | 1,152 | **1,408** |
| Pictures confidently wrong | 196 | 196 | **48** |
| Unsure / said not a ball | 76 / 75 | 182 / 53 | 77 / 50 |
| Accuracy when confident / coverage | 86.3% / 90.5% | 85.5% / 85.2% | 96.7% / 92.0% |
| Balls right / confidently wrong (106, frames averaged) | 83 / 13 | 77 / 13 | **95 / 3** |
| 9-ball pictures called cue (of 210) | 120 | 85 | **0** |
| Cue pictures right (of 210) | 210 | 210 | 210 |
| Far spot (480 pictures): right / conf. wrong | 283 / 75 | 213 / 105 | 314 / 43 |
| Touching / within 2.5 radii (112): right / conf. wrong | 47 / 45 | 7 / 45 | 8 / 0 (104 unsure or rejected) |

B minus frozen, ball-level paired bootstrap 95% interval: right +172 (+57 to +294), confidently wrong -148
(-252 to -47) (`metrics/summary.json` of each run). Other sessions, solids vs stripe, radius bands and full
confusion matrices: `metrics/recognition_metrics.csv`, `metrics/confusion_*.csv`. Every picture with every system's
11 probabilities: `predictions/all_systems_test.csv`.

Stability of B (Confirmed): 7 trainings (seed 0 on three runs, seeds 1-4): right 1,354-1,435, confidently wrong 35-67.
Training is not bit-identical between runner machines (seed 0 gave 1,404/42, 1,408/48 and 1,397/47).

## 3. Product level, unchanged v0.6 scorer (Confirmed)

Only `rec`, `p`, `nb` of each detection spot were replaced; spots, frames and tracker are unchanged. "Held-out" = the
92 shots of Oct 17-19 (Oct 16 is train/dev data for the challengers, so the 116-shot totals flatter them slightly).

| 30 fps frozen set | Ending table right, alone (116 / held-out 92) | Straight through (116 / 92) | Confidently wrong (116 / 92) | Made balls unresolved | Missed pockets* | False pockets | Racks |
|---|---|---|---|---|---|---|---|
| Frozen (published) | 38 / 26 | 27 / 25 | 26 / 21 | 64 | 4 | 2 | 0/5 |
| Control: frozen reader on our crops | 37 / 26 | 27 / 25 | 25 / 20 | 65 | 4 | 2 | 0/5 |
| A | 43 / 32 | 33 / 31 | 29 / 23 | 54 | 8 | 1 | 0/5 |
| **B** | **49 / 36** | **33 / 31** | **20 / 14** | 53 | 6 | 2 | 0/5 |
| B number + frozen not-a-ball | 53 / 40 | 38 / 36 | 17 / 11 | 50 | 5 | 1 | 0/5 |

| Alternate 30 fps pick (d30b) | Alone (116 / 92) | Straight through (116 / 92) | Confidently wrong (116 / 92) |
|---|---|---|---|
| Frozen (published) | 36 / 24 | 25 / 23 | 30 / 25 |
| A | 38 / 27 | 28 / 26 | 33 / 27 |
| B | 48 / 35 | 32 / 30 | 25 / 19 |
| B number + frozen not-a-ball | 51 / 38 | 35 / 33 | 22 / 16 |

*Missed pockets = made balls the system called "still on the table". Real shots missed / false shots barely move (B 4/10,
frozen 5/10). Full table: `product/product_metrics.csv`; per session: `product/product_results.json`.

## 4. Confirmed / Likely / Unknown

**Confirmed**
- The v0.6 baseline and the frozen reader reproduce exactly in a clean Actions run.
- B is better than the frozen reader on four held-out sessions and equal on the fifth (Oct 17 recorder, both 150/150), with about 4x fewer confidently wrong pictures,
  and it never called the 9 the cue. A is not better than the frozen reader.
- Through the unchanged v0.6 scorer, B raises correct ending tables (38 -> 49 alone, 27 -> 33 straight through) and
  lowers confidently wrong shots (26 -> 20); the same direction holds on the alternate frame pick and on held-out shots
  alone. A raises ending tables but also raises confidently wrong shots and missed pockets.
- Complete racks stay 0/5 for every system.
- Re-cropping alone changes almost nothing (control 37-38 / 27 / 25).

**Likely**
- The gain is real, not sampling noise: it is far beyond the +/-1-2 shot noise level, holds on both frame picks and
  across 7 trainings. But B still fails at the far spot and on touching balls (it becomes unsure, which is safe but
  does not complete tables). Racks need the other blockers too (table still moving at clip end, unnamed balls).
- B's own "not a ball" answer is weaker than the frozen one at product level (B + frozen not-a-ball scores best), but
  that combination was not chosen before the test, so treat it as a lead, not a result.

**Unknown**
- False-detection rejection: no verified non-balls exist in the held-out sessions, so it cannot be measured.
- Changed lighting: the light-step pictures (Oct 17 clips 12-14) have no verified identities. B rejects far fewer of
  them (about 200 of 720 vs 525 for the frozen reader) but whether its names are right is unknown.
- Other tables, cloths, ball sets, phones and stripes 10-15: not in the data.
- Ball orientation: no labels for it; covered only indirectly (rotation augmentation, many frames per ball).

## 5. Integrity notes
- Challenger A's held-out results were seen in a dry run before the Actions runs; A was not changed afterwards.
  B's design was fixed before its first run; the only later change was a refactor to allow the seed check.
- Split by session; no identical crop and no clip shared between train and test (`data/split-check.json`).
- Product step: per-spot answers were made in the Claude container from the footage (not on GitHub) with the run
  39500020895 models (`replacement-predictions/MANIFEST.json` has model and footage hashes); at the labelled test spots
  they equal the Actions test predictions (8 of 2,425 differ by more than 0.01; largest 0.10).
