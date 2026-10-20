# Identity continuity diagnostic (Oct 20, 2026)

Diagnostic only. Nothing in the tracker, the settled-table check or v0.6 was changed.

**Question (Nackers, Oct 20):** of the balls the settled-table looks leave unnamed or misname, how many could have kept a
correct identity from an earlier observation, without another read of their looks?

**Setup:**
- Tracker v0.6 (code 7e08306), frozen detector-v1 detections, the same looks and memory as `tools/score-racks.js`.
- Script: `tools/experiments/identity-continuity.js` (branch `claude/project-thread-evm9v0`). Raw output: `identity-continuity-2026-10-20/`.
- **Only sessions with a verified true table count.** That is the three V2.3.3 sessions: Oct 16, Oct 17 first spot, Oct 17 other side.
  The recorder sessions (Oct 17 rec, Oct 18, Oct 19) have no verified ball inventory, so they cannot be used here. Oct 16 is development footage.
- Start looks: all 68 with a verified table. End looks: the 58 that were settled (10 unsettled ones are left out).
- "Earlier observation", **independent shots**: only this clip. For the start look, that is the track's earlier rest frames. For the end look, it is the start-look name
  at the spot the ball's track came from, or the track's votes before the shot.
  **Continuous play:** the same, plus where memory carried from earlier clips last saw each ball.
- Earlier identity "sure" = the settled-table check's own rule (score at least 2 and at least twice the runner-up).
- **Limitation (Confirmed):** the truth lists which balls are on the table, not where they are. So an earlier identity counts as
  "correct" when its number is on the table, not named elsewhere in the look, and not claimed by two spots. That makes groups 1 and 2
  **Likely**, not position-checked. Counts are ball-looks: one ball that keeps failing is counted in every look.

## What v0.6 already does to keep identities (Confirmed, from the code)
- **Inside a clip, the tracker keeps identity.** Each track adds up reader votes over all its resting frames for the whole clip.
  It keeps its number through short hiding (found again within 4 in). v0.5's relink carries fast balls across a missed frame, and its
  contact rule clears both names when a collision is ambiguous.
- **Between clips (continuous play),** memory carries each number's status and last-seen spot. It uses them for pocket and state
  reasoning, never to name a spot.
- **The settled-table looks do not use any of that.** Each start and end look names balls from scratch, from about 1 s of frames,
  with each number used at most once. So the gap is real: the tracker's identities never reach the look.

## Main result

| | Start table, independent | Start table, continuous | End table, independent | End table, continuous |
|---|---|---|---|---|
| Balls on the table (ball-looks) | 404 | 404 | 312 | 312 |
| Named right now | 278 | 278 | 224 | 224 |
| **Not named right** | **126** | 126 | **88** | 88 |
| ...no spot in the look at all | 67 | 67 | 42 | 42 |
| ...spot left unnamed | 42 | 42 | 37 | 37 |
| ...spot misnamed (a number not on the table) | 17 | 17 | 11 | 11 |

The **unnamed spots** (42 / 37), sorted into the five groups:

| Group | Start, indep. | Start, cont. | End, indep. | End, cont. |
|---|---|---|---|---|
| 1. Identified earlier and stationary | 2 | 3 | 1 | 1 |
| 2. Moved, one unbroken, unambiguous track | 0 | 0 | 3 | 3 |
| 3. Identity lost or ambiguous (contact, broken track, two candidates) | 0 | 1 | 1 | 1 |
| 4. Never reliably identified | 9 | 8 | 9 | 9 |
| 5a. Earlier identity confidently wrong (number not on the table) | 1 | 1 | 4 | 4 |
| 5b. Earlier identity contradicted by a clear read of that number elsewhere | 30 | 29 | 19 | 19 |

The **misnamed spots** (17 / 11): continuity would fix none of them safely. Most (13 start, 5 end) carry the same wrong number from
earlier too. Changing the rest would mean memory overruling a confident read.

**What continuity could add at most** (accepting every group 1 and 2 ball, nothing else):
- Start tables fully named: 20 of 68, unchanged.
- End tables fully named: 24 → 25 of 58.
- Balls: +2 or 3 on start tables, +4 on end tables.

### Per session (unnamed spots; independent; continuous is within 1 ball)

| Session | Start: balls / named / no spot / groups 1-2 / group 4 / group 5 | End: balls / named / no spot / groups 1-2 / group 4 / group 5 |
|---|---|---|
| Oct 16 (close side) | 170 / 155 / 12 / 0 / 1 / 2 | 141 / 134 / 4 / 2 / 1 / 1 |
| Oct 17 first spot (far) | 165 / 74 / 49 / 0 / 7 / 25 | 134 / 61 / 36 / 2 / 8 / 19 |
| Oct 17 other side | 69 / 49 / 6 / 2 / 1 / 4 | 37 / 29 / 2 / 0 / 0 / 3 |

## What this means

1. **Continuity on its own explains very little of the naming failure (Confirmed on this footage).** Only about 3 to 5% of the
   balls not named right (2 to 4 per look type) had a correct, unambiguous earlier identity.
2. **Memory would mostly repeat mistakes (Confirmed).** Earlier identities that are wrong or contradicted (group 5) outnumber the
   usable ones (groups 1 and 2) about 7 to 1. The reader's errors are steady, not random: the same ball is misread the same way
   in every frame, so the earlier "identity" is the same misread.
   - The commonest case is a spot whose earlier identity is the **cue ball** while the real cue ball is clearly read elsewhere:
     17 start-look and 12 end-look cases, almost all from the far first spot.
   - Example: first spot, one spot at (28, 25) reads as the cue ball in every look from shot 4 to shot 8, while the 9 is missing.
     This is the 9-read-as-cue error. Memory would carry it through the rack.
   - This matches the old builder's own warning about one early wrong name sticking for the whole rack.
3. **The biggest single block is balls with no spot in the look at all:** 67 of 126 on start tables, 42 of 88 on end tables.
   - About 22 / 19 of these sit where the look threw a spot away because the reader called it "not a ball".
   - About 18 / 7 more are spots that flicker in and out during the look.
   - The rest have no spot at all (not detected, cushion filter, or blocked).
   - The tracker is still following only 12 / 16 of them, and holds a sure, missing number for only 2 / 6.
   - This is the reader's "is it a ball" gate and the look's filters, not memory.
4. **Independent and continuous are almost the same.** Memory carried across clips adds about 1 ball, because between shots
   the same reader reads the same still balls the same way.
5. **Where continuity would work is where the reader already works.** On Oct 16 there is almost nothing left for it to fix.
   At the far spot, the earlier identities are as wrong as the fresh reads. That is likely why the old app looked strong on its
   tuned spot and spread confident errors elsewhere (Likely).

## The two head-to-head checks

**1. Player corrections during the Oct 16 old-app session: Likely one, on the 9, before rack 1's first real shot. No sign of others.**
- The Oct 16 log kept only the shot summaries, not the event stream (its header shows 6 events). So taps cannot be counted directly (Confirmed).
- The app's count of learned looks stayed at 79 from the Oct 15 21:07 session (which had 1 tap) through Oct 16 and both Oct 17
  sessions. A tap normally adds one look, unless that ball already has the maximum of 16 (Confirmed count; Likely meaning).
- Two saved pictures (after shot 4, before shot 5) show the 9 at confidence 1.0. In V2.3.3 only a hand-naming tap (or a drill) sets that (Confirmed from source).
  The reader already read that ball as the 9.
- Oct 17 other side and first spot: full event logs, zero taps (Confirmed).
- Effect on the 27/37: none found. The old app's numbers stand as essentially unassisted (Likely).

**2. Late pockets outside the new clip boundaries: one ball, with no effect on the comparison (Confirmed).**
- Oct 16 shot033: the 7 dropped after the clip ended. It is counted in the 37 for both versions, and the old app missed it too
  (logged as missed in the Oct 16 hand count).
- First spot shots 4 and 28: the 2 and the 8 dropped after the clip, off camera. Both were left out of the comparison for both versions.

## Recommendation
- **Do not build identity memory into the looks as the next step.** The measured ceiling is +4 balls and +1 end table, against
  a much larger pool of wrong earlier identities. Any version must stay limited to groups 1 and 2, and keep a clear contradicting
  read in charge.
- **Next controlled experiment: per-table appearance calibration from verified labels only, scored on independent images.** It
  targets what this diagnostic found: steady misreads (5b, the cue-ball confusion) and spots rejected as "not a ball".
  - The reader's "is it a ball" gate deserves its own measurement in that experiment, since the detector already finds nearly every ball.
- **Validation:** the effect of continuity is too small to need alternate frame-sampling checks to call it small. A calibration
  change would need them (start and end tables, per session, zero new confident misnames).
