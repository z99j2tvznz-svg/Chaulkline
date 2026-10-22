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
  - Table size: the player's earlier measurement in the recorder setup (2026-10-17 session), 79.06 × 39.03 in,
    cushion nose to cushion nose. Reused at the player's request on 2026-10-22, before any footage.
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
  - B in or out:
    - The zone is a 9 × 9 in box, marked by 4 donut-sticker corners. This was changed from a circle at the player's
      suggestion on 2026-10-22, before any footage.
    - The system says "in" when the rest centre is inside the box: within 4.5 in of the zone centre along both
      axes. The zone centre is 6 diamonds from the left on the centre line.
    - Compared with the measured position and with the player's in/out. Rests within 0.5 in of the box edge are
      reported as borderline.
    - The stickers on the cloth are reported if the system ever takes one for a ball. They are not filtered out.
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

## Tools (written before any footage; checked only for plumbing)
- `tools/cueball.js`: runs the Cycle 4 tracker unchanged. It gives each shot's path, gaps, path length, initial speed,
  duration, closest approach to each cushion and rest position, plus every still period.
- `tools/score-cueball.js`: the scoring above, from the player's measurements written as JSON (format in its header).
- Plumbing check: rack 1 footage against synthetic measurements made from the tool's own output, with known offsets.
  The offsets were recovered exactly (0.36 in). This tests the code paths only, and is not a result.

## Change before any footage (2026-10-22 19:21, player's request)
- The player asked for guided steps with pictures in the recorder. Recorder R0.8 (commit 4267444, dev branch) adds a
  "Cue-ball test" session for this.
- **One short clip per event**, so the recorder labels each event itself. A placements record 8 s; shots record up to
  20 s or until "Shot done", plus a 2.5 s still tail.
- **Measurements typed into the app after each clip**, and saved with that clip. A placement is made, recorded, then
  measured; the ball is never moved before the clip ends.
- **The racks are unchanged:** R0.7 continuous mode, one recording per rack.
- `cueball.js` runs per clip:
  - A: the clip's still period gives the position.
  - B-D: the clip's single shot and its rest position.
  - A clip with no shot found = missed; more than one = false shots.

## Change before any footage (2026-10-22 20:10, player's request: no arithmetic, place by the diamonds)
- **Placement:** balls and stickers are placed by sighting the diamonds. The player types raw tape readings only,
  and Claude does all conversion.
- **A, tape optional per placement.** "On the diamond spot, no tape" stores the intended grid crossing. A results are
  reported in two tiers:
  - taped placements: truth = tape;
  - grid-only placements: truth = the intended crossing. This bounds the error only to about the placement accuracy
    (est. 1-2 in), so it is never used for claims finer than that.
- **B set-up clip.** B starts with an 8 s clip of the stickers. The stickers are also seen by the camera, and the
  system output is checked for sticker false detections. Optionally, one sticker is taped.
  - Zone centre = the taped sticker + 4.5 in, else the diamond crossing.
  - The player's in/out call (relative to the stickers they see) is reported next to the measured in/out.
- **Pending: the player's choice between tape and grid for A.**
- The player's idea of calibrating the camera view from the diamonds (straightening the lens curve) is noted as a
  future perception improvement. Perception is frozen for this validation.

## Units (2026-10-22 20:11, player's point: amateurs think in diamonds, not inches)
- All results and any coaching feedback are given in diamonds (1 diamond ≈ 9.9 in along, 9.8 in across), with inches
  alongside.
- The go-rule thresholds are unchanged and restated: median ≤ 1.5 in ≈ 1/6 diamond, worst ≤ 3 in ≈ 1/3 diamond.
- The finest feedback players use is about a quarter diamond (≈ 2.5 in). The diamond-sighted placements (about
  1-2 in placement error) can therefore test the question that matters for the drill: whether the camera puts the ball
  within a quarter diamond. The tape is only needed for claims finer than that.

## Truth confidence (2026-10-22 20:14, player: "my tape numbers won't be accurate")
- Tape readings are low-confidence truth. They are all kept and reported as such. None is dropped for disagreeing with
  the system, because that would bias the result.
- High-confidence truth = positions exact without a tape: a ball frozen against a rail (exact on that axis; A2, A6, A8)
  and the box stickers seen in the set-up clip. Accuracy claims rest on these, and the tape tier is reported
  separately.
- The test design is frozen from here on, at the player's request.

## No tape (2026-10-22 20:15, player: tape readings are too unreliable to keep)
- Tape readings are not used as truth. Any typed in are stored but not scored.
- Truth without a tape: a ball frozen against a rail (exact on that axis), diamond-sighted placements (about 1-2 in),
  the stickers seen in the set-up clip, the player's in/out and touched calls, and rails hit.
- What this can show: whether the camera puts a ball within about a quarter diamond. It cannot show sub-inch accuracy,
  and no such claim is made. The camera is never used as its own truth.
