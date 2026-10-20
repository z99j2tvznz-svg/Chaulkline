# Absence + ball-count rule: controlled test (Oct 20, 2026)

**Status:** an experiment that is off by default. It has **not** been promoted. Code 47e15d7, branch
`claude/project-thread-b5ucci`. It is built on tracker v0.5, without the outline correction. The tracker is unchanged,
v0.4 and v0.5 still give the same results, and all 46 tests pass (3 are new for this rule).

**Run it:** `score-racks.js --track '{"version":"v0.5","absence":true}'` or
`experiments/product-metrics.js '{"version":"v0.5","absence":true}' ...`.

## The rule (what counts as enough evidence)
A ball that is gone from the table with no pocket-entry event is still "unresolved" unless **all** of these are true:
1. The look before the shot named it clearly.
2. The table after the shot is settled, and every spot on it is named. If any spot is unnamed, that spot could be the
   missing ball (a ball hidden or unnamed is not a ball that was pocketed).
3. The count of spots fell by exactly the number of missing balls, and every missing ball was named before the shot.
   So if more numbers are missing than balls are gone, nothing is guessed.
4. One or two balls at once. If 3 or more vanish at once, the look is treated as a misread.
5. A track rolled away from the ball's starting spot (a ball can't drop without moving). A ball that was only blocked
   from view does not pass. On this footage this check never had to step in, so its value is still unproven (Unknown).

## Results: 6 frozen sessions, 116 real shots, every camera position, including the multi-shot Evening check

Each shot is judged on its own, starting from the true table (the same method as the 28/116 player baseline).

| Session (camera) | Correct ending table without correction: v0.5 → with rule | Made balls left open |
|---|---|---|
| Oct 16 (side, close) | 8 → **12** of 24 | 11 → 5 |
| Oct 17 first spot (far) | 0 → 0 of 26 | 9 → 9 |
| Oct 17 other side | 0 → **1** of 9 | 5 → 4 |
| Oct 17 recorder | 5 → **9** of 18 | 15 → 11 |
| Oct 18 Evening check (multi-shot) | 3 → 3 of 18 | 29 → 29 |
| Oct 19 one shot per clip | 12 → 12 of 21 | 8 → 8 |
| **All** | **28 → 37 of 116 (24% → 32%)** | **77 → 66** |

- **Correct makes recovered (Confirmed):** 12 made balls and 1 scratch (the cue ball). I checked all 13 against
  the truth, and all 13 were right.
- **New confidently wrong answers: 0. New false pockets: 0 (Confirmed).** Confidently wrong, false pockets, made balls
  called "still on the table" and table-state errors are unchanged in every session, in both scoring modes.
- **Complete real racks: still 0 of 5.** On the recorder clips, where each clip counts as a rack, 5 → 9 of 34 clips
  were fully right.
- **Racks played straight through, with memory carried from shot to shot:** only 1 more made ball confirmed on Oct 16
  (12 → 11 left open). The Oct 17 recorder gains the same 4. The reason (Confirmed): once an earlier ball is uncertain, it counts as missing
  but was never "named before", so the rule correctly refuses (gate 3). This is how uncertainty is meant to be
  carried, not a bug. It does mean the rule pays off most when earlier shots are already right.

## Why the other made balls stay open (66 balls; the first gate that failed)
| Reason | Balls |
|---|---|
| Table still moving in the after look (mostly Oct 18, several shots per clip) | 25 |
| Not named before the shot (far camera, lighting) | 16 |
| An unnamed spot in the after look that could be it | 16 |
| Another missing ball wasn't named before | 7 |
| The count didn't fall | 2 |

So the remaining limit is **stationary-table naming** (before and after looks), not the pocket decision. That matches
item 4 of your priorities (Likely).

## Compared with the old app on the same three V2.3.3 sessions
In the earlier what-if, the bare old rule had **5 wrong** calls at the first spot. All 5 are blocked here by gates
2 and 3 (Confirmed). For comparison, the old app had 27 right and 29 confidently wrong. v0.5 with this rule gets
8 more right than plain v0.5 on these sessions, with 0 new wrong answers.

## Not covered / unknown
- **A ball jumping off the table** would look the same as a pocketed ball to this rule (Unknown, none in the footage).
- The sample is small: 13 confirmations, mostly at the close side camera and from the recorder.
- Raw numbers: `absence-rule-2026-10-20/pm-base.json` and `pm-abs.json`.

## Recommendation
It meets your success test on this footage: more correct makes and zero new confident wrong answers. I recommend
promoting it as part of the next tracker checkpoint, after it is re-scored on top of the outline correction. That is
your call, and nothing has been promoted.
