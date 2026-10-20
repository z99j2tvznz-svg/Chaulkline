# Tracker v0.6: v0.5 + absence rule + outline correction (Oct 20, 2026)

**What v0.6 is:** v0.5, plus the absence + ball-count rule in the settled-table check, scored on detections made with
the outline correction (`clip-detect.js --outline-check keep-first`).
- Code 7e08306, branch `claude/project-thread-b5ucci` (includes the tracking branch up to 6650ef6).
- Select it with `{ version: 'v0.6' }`.
- v0.4 and v0.5 are unchanged, and a test checks this. The tracker itself runs v0.6 byte-identically to v0.5.
- All tests pass.

**Promoted** under Nackers' approval of Oct 20 02:39. The conditions were zero new confident errors and better ending
tables, and both held. No unrelated experiments are included: not the one-cue rule, the frame-rate work, or
learned looks.

**Detections:**
- Oct 17 recorder, Oct 18 and Oct 19: the keep-first set (`chalkline-data/detections-outline-keepfirst/`, made by the
  Engineering collaboration thread).
- Oct 16, Oct 17 first spot and Oct 17 other side: the V2.3.3 sessions use the outline saved by the app, so the
  outline check does not touch them. Their detections are the frozen v0.4 ones.

## Main measure: ending table right with no correction (116 real shots, 6 sessions)

| | v0.5 | outline only | absence only | **v0.6 (both)** |
|---|---|---|---|---|
| Each shot judged alone (from the true start table) | 28 (24%) | 30 | 37 | **38 (33%)** |
| Played straight through (memory carried) | 22 (19%) | 24 | 26 | **27 (23%)** |
| Confidently wrong shots | 28 | 26 | 28 | **26** |
| New wrong answer in any clip vs v0.5 | | 0 | 0 | **0** |
| False pockets | 2 | 2 | 2 | 2 |
| Made balls called "still on the table" | 4 | 4 | 4 | 4 |
| Table-state errors | 16 | 16 | 16 | 16 |
| Made balls left open (per shot / continuous) | 77 / 78 | 74 / 75 | 66 / 73 | **64 / 71** |
| Real shots missed | 8 | 5 | 8 | 5 |
| False shots | 10 | 10 | 10 | 10 |
| Complete real racks (5) | 0 | 0 | 0 | **0** |

Per session, v0.5 → v0.6, each shot judged alone:

| Session | v0.5 | v0.6 |
|---|---|---|
| Oct 16 | 8 | 12 of 24 |
| first spot | 0 | 0 of 26 |
| other side | 0 | 1 of 9 |
| Oct 17 recorder | 5 | 10 of 18 |
| Oct 18 Evening check | 3 | 3 of 18 |
| Oct 19 one-shot | 12 | 12 of 21 |

The two changes add up almost independently. The outline correction mainly finds missed shots (8 → 5) and removes 2
wrong answers. The absence rule confirms made balls. Played straight through, the absence rule gains less, because
uncertainty carried from earlier shots blocks it, as designed.

## Why made balls are still open (v0.6; the first check that failed for each ball)

| Category | Each shot alone (64) | Straight through (71) | What it points to |
|---|---|---|---|
| After look not settled: still moving at clip end | 29 | 27 | Settled-table selection / segmentation (mostly Oct 18 multi-shot clips) |
| Unnamed spot in the after look | 16 | 10 | Ball identification on the still table |
| Not named before the shot | 11 | 9 | Ball identification on the still table |
| Another missing ball not named before | 6 | 6 | Ball identification |
| Ball count did not fall to match | 2 | 0 | Detection / count |
| This ball already uncertain from an earlier shot | | 10 | Carried uncertainty |
| Another missing ball uncertain from an earlier shot | | 9 | Carried uncertainty |
| Shot not found (no before look) | 0 | 0 | Shot segmentation |

**Reading:** about 45% of the open made balls wait on the table settling within the clip, and about 50% on naming
balls on a still table. Carried uncertainty matters only when playing straight through: 19 of 71. None of the
remaining open balls is a pocket-decision problem the rule could safely loosen. Raw numbers:
`tracker-v0.6-2026-10-20/` (summary.json, categories.json, pm-v06.json and the two scripts).

## Not changed / follow-ups
- Records and the viewer are still built with v0.4 defaults.
- The 98% goal still needs about 99.8% per shot. v0.6 is at 33% per shot and 0 of 5 racks.
