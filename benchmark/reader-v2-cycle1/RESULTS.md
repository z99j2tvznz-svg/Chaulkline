# Reader v2 Cycle 1: results (2026-10-21)

Plan and selection rules: [PREREGISTRATION.md](PREREGISTRATION.md) (written before the results; Addendum A was added
after the dev results and before any product run of trained models). Nothing in the app, v0.6, the labels or the benchmark
was changed. Every product number comes from the unchanged v0.6 tracker and scorer (the benchmark's `s06_product.score`).

**Experiments completed: 7 of 8** (E8 was not needed; see "Why the cycle stopped").

## Pipeline checks (Confirmed)
- The benchmark's 4,473 pictures were rebuilt at native resolution, and all md5 hashes match the benchmark's (`tools/c01_data.py`).
- Re-scoring the benchmark's Challenger B gives exactly the published 1,408 right / 48 confidently wrong pictures (`results/recognition/sanity-B-reproduction.json`).
- The product scorer reproduces the frozen baseline (38/27/26) and B (49/33/20) exactly (`results/product/e1_*.json`).
- At the 2,425 labelled held-out spots, the footage predictions equal the recognition-test predictions, with 8 spots
  differing by more than 0.01. The benchmark had the same 8 (`results/footage-vs-test-predictions-check.json`).

## E1, E2, E6: input-only variants of B (no training)
Held-out 92 shots, frozen30 pick / d30b pick. Columns: ending tables right with each shot judged alone, the same played
straight through, and confidently wrong shots.

| Variant | frozen30 | d30b | Finding |
|---|---|---|---|
| B (own "not a ball") | 36 / 31 / 14 | 35 / 30 / 19 | reference |
| B + frozen "not a ball" (E1) | 40 / 36 / 11 | 38 / 33 / 16 | +4 / +3 tables |
| B rescaled "given it is a ball" + frozen nb (E1) | 40 / 36 / 11 | 38 / 33 / 16 | identical: rescaling changes nothing |
| B + "not a ball only if both say so" (E2) | 36 / 31 / 14 | 35 / 30 / 19 | = B |
| B + "not a ball if either says so" (E2b) | 40 / 36 / 11 | 38 / 33 / 15 | = frozen nb (Oct 16 −1) |
| B + still-spot pooling over ±3 frames (E6) | 36 / 31 / 14 | 35 / 30 / 19 | no effect |
| B + frozen nb + pooling (E6) | 40 / 36 / 11 | 38 / 33 / 16 | no effect |

- **Confirmed:** the gain from "frozen not-a-ball" comes from rejecting MORE non-ball spots, not from keeping real
  detections. Making rejection stricter ("either says so") gives the same result. Making it looser ("both must say so")
  gives B's result.
- **Likely cause:** B accepts phantom spots (on dev, 10 of the 50 verified non-balls are accepted, against 0 for the
  frozen reader). Phantom spots leave an unnamed spot in a still look, and that blocks the table. Of the gain, +5
  tables are in rec-20261017-1730.
- **Confirmed:** pooling still spots across frames adds nothing, because the settled-table vote already pools frames.

## E3, E4, E5: retrained variants (15 + 3 trainings, train Oct 12-16, 3 seeds each)
Dev = Oct 15 + odd Oct 16 clips. dev-touch and dev-far are synthetic versions of the dev pictures. Values are the mean of
3 seeds, as right / confidently wrong (`results/recognition/recognition-sweep.json`).

| Variant | dev | dev-touch | dev-far | Decision |
|---|---|---|---|---|
| B recipe retrained | 714.7 / 1.7 | 687.7 / 4.3 | 715.7 / 1.3 | reference |
| Overlap augmentation (E3) | 715.3 / 1.3 | 704.0 / 1.7 | 714.3 / 2.0 | kept |
| Far-camera augmentation (E4) | 715.3 / 2.3 | 685.3 / 4.0 | 714.0 / 1.7 | rejected (no dev gain) |
| 2.6-radius crop (E5) | 717.0 / 1.7 | 707.7 / 2.3 | 716.7 / 1.7 | kept |
| 48 px input (E5) | 702.3 / 3.0 | 674.7 / 4.7 | 710.7 / 3.3 | rejected (worse) |
| 3-seed ensemble (B recipe) | 717 / 1 | 689 / 4 | 717 / 1 | kept |
| Combo: 2.6 crop + overlap, ensemble | 716 / 1 | 714 / 1 | 717 / 2 | candidate |

Held-out recognition (1,583 verified pictures; all of these numbers were seen when the sweep ran):

| System | Pictures right / conf. wrong / unsure / rejected | Balls right / conf. wrong (106) | Far spot right / conf. wrong (480) | Touching (112): right / unsure+rejected |
|---|---|---|---|---|
| Frozen reader | 1,253 / 196 / 54 / 80 * | 84 / 13 | 285 / 79 | 52 / 15 (45 conf. wrong) |
| B | 1,408 / 48 / 77 / 50 | 95 / 3 | 314 / 43 | 8 / 104 |
| B recipe, 3-seed ensemble | 1,433 / 35 / 110 / 5 | 95 / 2 | 350 / 30 | 30 / 82 |
| Overlap ensemble | 1,435 / 35 / 108 / 5 | 97 / 2 | 370 / 30 | 47 / 65 |
| 2.6-crop ensemble | 1,441 / 30 / 112 / 0 | 97 / 2 | 350 / 30 | 42 / 70 |
| Combo ensemble (candidate) | 1,425 / 48 / 110 / 0 | 95 / 3 | 360 / 45 | 47 / 65 |

\* The frozen row re-runs the frozen reader on resized native crops, so it differs slightly from the benchmark's stored
1,236 / 196. Single seeds vary widely: for example, combo seeds give 1,349 to 1,462 right.

## E7: product evaluation (unchanged v0.6 scorer, held-out 92 shots; all-116 in brackets)

| frozen30 pick | Alone | Straight through | Conf. wrong (alone / through) | Missed / false shots | False pockets | Missed pockets | Made unresolved | Racks |
|---|---|---|---|---|---|---|---|---|
| Frozen reader | 26 (38) | 25 (27) | 21 / 21 | 3 / 8 | 2 | 3 | 59 | 0/5 |
| B | 36 (49) | 31 (33) | 14 / 14 | 2 / 8 | 1 | 4 | 49 | 0/5 |
| B + frozen nb | 40 (53) | 36 (38) | 11 / 12 | 3 / 8 | 0 | 3 | 46 | 0/5 |
| Combo ensemble, own nb | 35 (48) | 30 (32) | 12 / 12 | 2 / 9 | 0 | 5 | 48 | 0/5 |
| **Combo ensemble + frozen nb** | **40 (53)** | **36 (38)** | **10 / 10** | 3 / 8 | 0 | 3 | 46 | 0/5 |
| 2.6-crop ensemble + frozen nb | 40 (53) | 36 (38) | 10 / 10 | 3 / 8 | 0 | 3 | 46 | 0/5 |

| d30b pick | Alone | Straight through | Conf. wrong | Missed / false shots | False pockets | Missed pockets | Racks |
|---|---|---|---|---|---|---|---|
| Frozen reader | 24 (36) | 23 (25) | 25 / 25 | 4 / 11 | 2 | 3 | 0/5 |
| B | 35 (48) | 30 (32) | 19 / 19 | 4 / 10 | 2 | 4 | 0/5 |
| B + frozen nb | 38 (51) | 33 (35) | 16 / 16 | 4 / 11 | 1 | 3 | 0/5 |
| **Combo ensemble + frozen nb** | **38 (51)** | **33 (35)** | **14 / 14** | 4 / 11 | 0 | 3 | 0/5 |

Every trained ensemble with frozen nb scores 40 / 36 (frozen30) and 38 / 33 (d30b). Without frozen nb, every trained
ensemble scores at or below B. Full tables, including per session: `results/product/e7_*.json`.

**Candidate against the pre-registered bar (vs B, held-out):**
- tables +4 (frozen30) and +3 (d30b): passes;
- straight through +5 / +3: passes;
- confidently wrong 10 vs 14 and 14 vs 19: passes;
- missed shots +1 on frozen30, false shots +1 on d30b: within the +1 noise allowance;
- false pockets and missed pockets not higher;
- worst session change: far spot −1 on frozen30.

**Passes. But almost all of the gain also comes from B + frozen nb with no retraining.** The retrained readers add only
1-2 fewer confidently wrong shots, which is within noise.

## Remaining failures of the candidate (frozen30, 116 shots judged alone; `results/*.failures.*`)
63 shots fail (B 67, frozen 78). Main blockers (a shot can have several):
- table still moving at clip end: 21 (sole blocker in 19);
- unnamed spot in a still look: 19 before / 15 after, of which "number taken by a surer spot" is 13 / 12;
- absence rule (spot count did not fall by the missing balls): 10;
- shot detection: 5 missed, 6 false;
- wrong identity: 6.

By session: far spot 24 of the 63, rec-20261018 15 (mostly clips cut mid-play), Oct 16 11.
"Number taken" is mostly the far spot, where a still 9 with its stripe hidden is read as the cue and loses to the
real cue (10 clips).

## Why the cycle stopped (stop conditions)
- **Further reader tests are unlikely to change the decision (Confirmed by E3-E7).** Recognition improved on the
  held-out pictures (fewer confident errors, more far-spot balls right, touching balls 8 → 47 right), but the product
  score did not move. Five different trained readers all land on exactly the same ending-table count.
- **The remaining blockers are outside the reader:**
  - settled-table timing at clip end;
  - "number taken" resolution, which would need a whole-table assignment in reconcile, a v0.6 change;
  - the absence rule with unknown inventories;
  - shot detection.

  Each needs either a v0.6 tracker/reconcile change (needs approval) or more far-view data.
- E8 (the spare) was not run, because no remaining fixable reader cause would change the product score.

## Cost
- B is about 24.5 million multiply-adds per spot (the frozen reader about 0.11 million). The combo ensemble is 3 × B.
- B + frozen nb costs B plus the (cheap) frozen reader.
- Safari speed was not measured.

## Held-out caveat
Oct 17-19 was exposed by the benchmark, by the failure analysis and by this cycle's evaluation runs. These results are
evidence on known data, not fresh independent validation.

## Files
- `tools/`: c01 data, c02 training, c03 recognition evaluation, c04 footage inference, c05 product scoring, c06 check.
- `models/`: every trained model as ONNX + json (seed, options, temperature). Model files for B itself are in the
  benchmark's `actions-results/run-39500020895/models`.
- `predictions/pred_{frozen30,d30b}.npz`: per-spot probabilities of the four ensembles on every detection spot.
- `results/`: recognition and product json, scorer traces (`product/scorer-runs.tgz`), failure tables.
- `logs/`: training logs, sweep log, inference logs.
