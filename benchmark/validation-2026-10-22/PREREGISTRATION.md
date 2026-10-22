# Cycle 4 validation and cue-ball evaluation: plan fixed before any footage (2026-10-22)

Assignment: Nackers, 2026-10-22 01:40. The player's checklist (recording and measuring) is a Claude Doc:
https://claude.ai/artifact/GM5J61AwLdokJZ3kvg2Co7

Status: **nothing has been recorded yet.** Every number in a later RESULTS.md comes from footage and measurements the
player supplies after this file was committed.

## Frozen before the footage arrives
- **Systems.**
  - Cycle 3: `benchmark/perception-cycle3/exp/tools/rack.js`, default options.
  - Cycle 4: `benchmark/cycle4/exp/tools/rack.js`, with
    [cycle4/results/cycle4-rack-options.json](../cycle4/results/cycle4-rack-options.json), as committed in 92822ed.
  - Both are run on the same inputs. No option or threshold is changed before the first evaluation is committed. If a
    fix is tried afterwards, its numbers are reported separately as "after looking at validation".
- **Inputs.**
  - Frozen detector-v1, `clip-detect --outline-check keep-first --rejected` (pocket and cushion boxes kept in a
    sidecar).
  - Merge and labels as in `cycle4/tools/inputs/`: Challenger B number, frozen not-a-ball, B not-a-ball on edge boxes.
  - Cycle 3 ignores the edge boxes (shown identical to its plain input on racks and old clips).
- **Recordings.**
  - Stored as a fresh validation set with SHA-256 per part, under
    `chalkline-data/sessions/validation-2026-10-22/`.
  - Not used for any development before the first evaluation is committed.

## Part 1: three racks
- **Truth.**
  - Claude drafts it from the video (every real shot, including breaks, misses, scratches and combinations; balls made;
    pocket P-ID; first ball hit where visible) **before running either system**. The draft is committed first.
  - The player confirms a short list of doubtful shots. A disagreement is kept and reported, never silently resolved.
- **Run.**
  - Each recording is one rack.
  - `cycle4/tools/racks.py` is also run on each recording to check for a false rack split. Expected: none.
- **Reported separately:**
  - **Table states after shots:** correct / unresolved / confidently wrong.
  - **Shot detection:** found / missed / false.
  - **Ball identification:** start inventory established; first ball right / no reading / wrong.
  - **Pockets:** observed / inferred / not confirmed; P-ID right / wrong / unknown; invented pockets.
  - **Break accounting:** what happened to each ball pocketed on the break.
  - **New failure modes**, each with its time in the video.
- **Promotion.** None from these results alone. A recommendation needs Cycle 4 ≥ Cycle 3 on correct tables with no
  rise in confidently wrong across the three racks.

## Part 2: cue-ball tests (38 events)
- **Truth.**
  - The player's tape measurements: cushion nose to the nearest ball edge, to ¼ in. Claude adds 1.125 in (half a 2¼ in
    ball).
  - Table size: the player's measured cloth length and width.
  - The coordinate frame is the system's: x from the left rail, y from the near rail. The system assumes 78 × 39 in;
    its positions are scaled to the measured cloth size before errors are computed. Unscaled errors are also reported.
  - Measurement error of the truth itself is about ±0.25-0.5 in, so differences below that are not reported as
    meaningful.
- **Event matching (no model output used as truth).**
  - A: still periods between hand placements, in order, matched to A1-A8.
  - B-D: shots in order, matched to the player's list.
  - An unmatched system shot = false. A listed event with no system shot = missed. Events marked `skip` are dropped.
- **Position (A, plus rest positions in B and D).**
  - Error = distance between the system's still-period position and the truth.
  - Reported: mean absolute, median, worst, and by region (near half / far half / centre / against a cushion).
- **Motion (B-D).**
  - Shots detected / missed / false.
  - Trajectory complete, or interrupted (gaps > 0.2 s, with their count and length).
  - Distance travelled: track path length vs. truth (straight distance from S for no-rail shots).
  - Velocity, at 30 fps:
    - initial speed = median frame-to-frame speed over the first 5 tracked frames;
    - speed over time, only where the track has no gap;
    - rolling duration = shot start to the first still frame.
  - Velocity has no ground truth. It is judged only for consistency within each stroke group and for separation
    between groups. No precision claim is made beyond what the frames support.
- **Coaching outcomes.**
  - B in or out: the system says "in" when the rest centre is within 4.5 in of the zone centre (the zone centre is
    measured once from the tape marks, or taken as 6 diamonds from the left on the centre line). Compared with the
    measured position and with the player's in/out. Rests within 0.5 in of the edge are reported as borderline.
  - C cushion contact: the system says "touched" when the tracked centre comes within 1.625 in of the right cushion
    line (half a ball + 0.5 in), or the track reverses direction there. Compared with the player's yes/no; "unsure" is
    reported apart.
  - C stopping distance: system gap vs. measured gap.
  - D: whether rest distance and initial speed separate soft / medium / firm (non-overlapping ranges = separated).

## Part 5: decision rule for building "Stop in the Zone" (set now, before the data)
Build the first prototype (stopping position only) if **all** of these hold on the player's footage:
1. Rest-position median error ≤ 1.5 in and worst ≤ 3 in, on the part of the table the drill uses (B's zone and the
   left half).
2. B in/out correct on ≥ 9 of 10 shots, counting only rests more than 0.5 in from the zone edge.
3. B-D: every shot detected, no false shots, and a still-period position found for every rest.

If 1 holds only on the near half, the prototype may start with near-half zones only, and that limit is stated. Speed
feedback is not part of the first prototype unless D shows clean separation.

## What is not assumed
- 30 fps is not assumed to give accurate instantaneous speed.
- Far-rail accuracy is not assumed. Test A has three far-side placements and one against the far rail. The lag (C) runs
  to the right short rail, because a lag to the far long rail would put the player between the phone and the table.
- The test layout fits this table and this phone spot. Nothing in the evaluation depends on a special camera placement.
