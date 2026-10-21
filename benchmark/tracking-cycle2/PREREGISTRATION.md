# Cycle 2 (tracking and table-state reconciliation): pre-registration (2026-10-21 04:50 UTC)

Authorised by Nackers 2026-10-21 04:27 UTC: up to 8 offline experiments. Experimental copies of the tracker,
settled-table check and the system parts of the rack harness live in `exp/tools/`. Every experiment option is off by
default, and with everything off the copies reproduce v0.6 exactly (checked). The frozen package, the v0.6 scorer
rules and the benchmarks are not touched.

## Baseline and data
- Recognition input for every run: Challenger B's number + the frozen reader's not-a-ball (Cycle 1), on both 30 fps
  picks (frozen30, d30b). Baseline = v0.6 on that input.
  - frozen30: 53 / 38 of 116 (alone / continuous), confidently wrong 17 / 18; held-out 92: 40 / 36, confidently wrong 11 / 12.
  - d30b: 51 / 35; held-out: 38 / 33.
  - Racks 0/5.
- The frozen reader's own detections (v0.6 as published: 38 / 27 / 26) are also reported for the best configuration.
- Tuning / development evidence: Oct 16 (24 shots, 2 real racks) and diagnostics. Oct 17-19 is a known benchmark: it has
  been examined, so results there are not fresh validation. Rules must be general, not tuned to single clips.
- Scoring: `exp/tools/score-racks.js` keeps the frozen scorer's scoring functions byte-for-byte (truthWalk, scoreClip,
  totals, diagnostics; checked by `tools/check_scorer.py`). Only system steps (tracker, observe, reconcile and when they
  are called) carry options.

## Success criteria (fixed now; vs baseline, both picks)
- More correct ending tables (alone or continuous), with neither lower on either pick.
- Confidently wrong shots not higher on either pick; false pockets and false scratches not higher (target 0 new).
- Missed shots and false shots not higher (+1 allowed as noise).
- No session loses more than 1 table.
- A change that only turns unresolved results into different unresolved results is not progress.

## Planned experiments (adaptable)
| # | Change | Hypothesis |
|---|---|---|
| X1 | Settled-table diagnosis: for every "table still moving at clip end" shot, measure what moves in the last second | If these are jitter or false movement, a better still test recovers them. If balls really roll, the clip is incomplete and must stay unresolved |
| X2 | Shot-local absence rule: count and absence evidence judged only on balls named before THIS shot. Balls already uncertain from earlier shots no longer block it | Continuous play stops cascading (earlier open balls make the count check fail forever) |
| X3 | Delayed confirmation: when a clip ends while balls roll, the next still table (the next shot's before look) is compared with the last still look, using the same absence evidence | Balls made in an incomplete clip are resolved one shot later, not left open for the rest of the rack. The incomplete clip itself stays unresolved |
| X4 | Whole-table identity assignment in the still look, using each spot's full reader probabilities and the fact that each ball exists once. A spot that loses a number to a clearly surer spot may take its next number only when the evidence for it is strong once the taken number is removed. Otherwise it stays unnamed | Fewer "number taken" unnamed spots, with no forced names |
| X5 | Shot detection: diagnose missed and false shots, and fix a general cause if one exists | Fewer missed / false shots |
| X6+ | Combination and complete-rack evaluation (continuous), frozen reader input, per-session regressions | |
