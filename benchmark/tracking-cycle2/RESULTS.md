# Cycle 2 (tracking and table-state reconciliation): results (2026-10-21)

Plan and criteria: [PREREGISTRATION.md](PREREGISTRATION.md). **Experiments completed: 6 of 8.** The cycle stopped
early; see "Why the cycle stopped".

Nothing in the app, the frozen package, v0.6 or the benchmarks was changed. The experimental code is in `exp/tools/`,
which holds copies of tracker.js, reconcile.js and score-racks.js. Every option is off by default.
`tools/check_scorer.py` confirms that the scoring functions are byte-for-byte the frozen scorer's (truthWalk,
scoreClip, totals, diagnostics, obsSplit, truth helpers). With the options off, the copies reproduce v0.6 exactly.

## Best configuration
`{"version":"v0.6","x":{"delayed":true,"whole":true,"guard":true}}`, on Challenger B's number + the frozen reader's not-a-ball.
- **delayed (X3):** suppose the tracker saw a ball lost at a pocket, but the clip ended while balls were still rolling, so
  the shot could not be confirmed. The ball is then held as pending for the next two clips. At the next clear still table
  (every spot named), it is confirmed gone only if all of these hold:
  - the ball count fell by exactly the balls missing since the look before that shot;
  - at most 2 of those balls are still unconfirmed;
  - the ball rolled away in its own shot.

  The unfinished clip itself stays unresolved.
- **whole (X4):** in each still look, a spot left unnamed may be named from its full reader probabilities once the
  numbers held by clearly surer spots in the same look are removed. This applies when the spot's number was taken by a
  surer spot, or when it had too few confident looks. Two conditions:
  - The remaining evidence must reach 0.85 and be at least 4 times the next number.
  - The number may only be removed if its holder's mean probability for it is at least 0.9, and at least 0.1 above the
    losing spot's.

  Names given this way count for the table, but such a look is never used for the absence rule.
- **guard:** a ball seen again after it was counted pocketed (not the cue ball) keeps a doubtful name for the rack, and
  its absence is never used to confirm a pocket.

## Before / after (116 shots; held-out Oct 17-19 = 92 shots, a known benchmark)
Columns:
- Alone / Cont. = ending table right, each shot judged alone / played straight through.
- Conf. wrong = confidently wrong shots, alone / straight through.
- Missed / false = shots missed / false shots, on the 92 held-out shots.
- False / missed pockets = on the 92 held-out shots.

| Input, pick | Configuration | Alone (all / HO) | Cont. (all / HO) | Conf. wrong (all) | Missed / false (HO) | False / missed pockets (HO) | Racks |
|---|---|---|---|---|---|---|---|
| B + frozen nb, frozen30 | v0.6 | 53 / 40 | 38 / 36 | 17 / 18 | 3 / 8 | 0 / 3 | 0/5 |
| | **best** | **54 / 41** | **41 / 36** | **17 / 18** | 3 / 8 | 0 / 3 | 0/5 |
| B + frozen nb, d30b | v0.6 | 51 / 38 | 35 / 33 | 22 / 22 | 4 / 11 | 1 / 3 | 0/5 |
| | **best** | **52 / 39** | **38 / 33** | **22 / 22** | 4 / 11 | 1 / 3 | 0/5 |
| Frozen reader, frozen30 | v0.6 | 38 / 26 | 27 / 25 | 26 / 26 | 3 / 8 | 2 / 3 | 0/5 |
| | best | 38 / 26 | 30 / 25 | 26 / 26 | 3 / 8 | 2 / 3 | 0/5 |
| Frozen reader, d30b | v0.6 | 36 / 24 | 25 / 23 | 30 / 30 | 4 / 11 | 2 / 3 | 0/5 |
| | best | 36 / 24 | 28 / 23 | 30 / 30 | 4 / 11 | 2 / 3 | 0/5 |

Per session (alone / continuous, frozen30, B + frozen nb):

| Session | v0.6 | Best |
|---|---|---|
| Oct 16 | 13/2 | 13/5 |
| first spot | 2/0 | 3/0 |
| other side | 4/2 | 4/2 |
| rec 10-17 | 18 | 18 |
| rec 10-18 | 3 | 3 |
| rec 10-19 | 13 | 13 |

No session lost a table on either pick or either reader. There are no new confidently wrong shots, false pockets or
false scratches in any of the 8 runs (2 inputs × 2 picks × alone/continuous). The criteria are met, but the gain is small:
- Confirmed: continuous Oct 16 went from 2 to 5. In rack 1, a ball lost at a pocket during an unfinished clip used to stay
  open for the rest of the rack, and this is now resolved one shot later.
- Confirmed: whole-table naming adds +1 on each pick. At the far spot, a still 9 with its stripe hidden is read as the
  cue and lost its name to the real cue; with the cue removed, its remaining evidence for 9 is 0.97-0.98.

## Experiments
| # | Experiment | Result | Decision |
|---|---|---|---|
| X1 | Settled-table diagnosis (`tools/diag_settle.js`, `results/settle-diagnosis.json`) | All 21 "table still moving at clip end" shots have a real ball still travelling 5-44 in over the last second. The table is still for 0-0.43 s at the end. Nothing is jitter or false movement | **Confirmed:** these are incomplete recordings. They must stay unresolved; no settle-detection change |
| X2 | Shot-local absence (ignore balls already uncertain from earlier shots) | B: +1/+1. Frozen reader: false pockets 2 → 7 (balls never seen at rack start no longer protect a look in which a misread ball vanished) | **Rejected.** The safe version (ignore only balls already lost at a pocket) adds nothing on top of X3 |
| X2b | Count rule counting "reappearing" balls | +5 tables but 3 new false pockets: a misread looks exactly like one ball leaving and another coming back | **Rejected.** The strict count check is what protects against misreads |
| X3 | Delayed confirmation at the next clear still table | A first version (any unconfirmed ball, any later look) made 4 false pockets. Requiring a pocket event for the ball, plus a 2-clip limit, removed them. That rule was added after seeing the false calls on known sessions: a stated limitation | **Kept** |
| X4 | Whole-table identity assignment (+ guard) | +1 per pick. The first version also unblocked an absence call on a far-spot 5 that is always read as 3 (a false pocket). Fixed by keeping names given this way out of the absence rule and by adding the guard | **Kept** |
| X5 | Shot detection | The 5 missed and 10 false shots have mixed causes: practice strokes, nudges, hands, the player hiding the cue ball, a second "shot" while the same shot is still rolling. Raising the start speed (12 / 14 / 16 in/s) cuts false shots (10 → 6 / 6 / 5) but adds missed shots (5 → 5 / 6 / 8). Nothing changes on dev (Oct 16) | **Not adopted** (a threshold trade-off tuned only on known data); recorded as a lead |
| X6 | Combination on both readers, both picks, complete racks | See tables | Best = X3 + X4 + guard |

## Why the cycle stopped
- **Complete racks cannot be measured with the current footage (Confirmed).** 4 of the 5 real racks contain at least one
  recording that ends while balls are still rolling:
  - Oct 16 rack 1: shot009;
  - Oct 16 rack 2: shot027;
  - first spot rack 2: shot019-021;
  - other side: 5 clips.

  Such a shot can never be "correct automatically" under the scorer's rules, so those racks cannot complete whatever the
  system does. The fifth rack (first spot rack 1) is the far camera spot, where identity is the limit. Every rack also has
  at least one false shot.
- The remaining blockers (best configuration, shots judged alone, 116 shots):
  - incomplete clips: 21 shots;
  - absence rule cannot confirm (count mismatch): 8-10;
  - unnamed spots: 12;
  - shot detection: 11;
  - wrong identity: 4.

  Most of the absence failures are recorder clips whose starting layout was not recorded.
- More reconciliation rules mostly trade unresolved results for false pockets (X2, X2b, early X3, early X4). The safe
  versions give small gains.

## Recommendation
Record 3 complete racks with the R0.6 recorder (which waits for the table to settle) from an ordinary camera position,
with a known starting layout. This is the minimum needed to measure complete racks at all. It is a targeted recording,
not a large collection, but it is Nackers' decision. Without it, the next cycle can only improve per-shot numbers.

## Reproducing
1. Build the input detections: Cycle 1 `tools/c05_product.py` `merged()` with `{system: challenger_b, nb: frozen}` (into
   `<out>/dets/<pick>`), then `tools/add_probs.py <out>/dets/<pick> ../recognition-2026-10-20/replacement-predictions/<pick>.npz`.
2. Score: `C2_OUT=<out> python tools/run.py <result.json> '[{"name":"best","opts":{"version":"v0.6","x":{"delayed":true,"whole":true,"guard":true}}}]'`.
3. Check the scorer copy: `python tools/check_scorer.py`.

Raw run results: `results/runs/*.json`. Scorer traces: `results/*.tgz`. Failure table of the best configuration:
`results/frozen30.delayed+whole+guard.failures.*`.
