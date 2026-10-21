# Perception Cycle 3: one continuous understanding of the table through a whole rack (plan, 2026-10-21)

Approved by Nackers on 2026-10-21 at 17:07, as one cycle led by Claude. This file was written before any Cycle 3
change was scored.

Nothing in the app, the recorder on main, the frozen package, v0.6, or the earlier benchmark folders is changed. The work
lives in this folder:
- `exp/tools/` holds copies of the Cycle 2 tracker, reconcile and scorer. Every new option is off by default, and the
  scoring functions stay byte-identical to the frozen scorer (checked by `tools/check_scorer.py`).
- New modules are added beside those copies.

## What rack 1 showed before any change (diagnosis, measured)
1. **Rack start.**
   - detector-v1 finds 3 of the 10 balls in the racked table (the 2, the 1 and the cue ball). At confidence 0.02 it adds
     only 2 weak boxes.
   - The frozen reader calls every touching ball "not a ball" (nb ≈ 1).
   - A plain cloth-colour mask loses the blue 2 against the blue cloth.

   So the pack cannot be read ball by ball.
2. **Pocket events.**
   - On the whole recording, the tracker does see 9 of the 9 drops lost inside a pocket mouth.
   - For the 2, 5 and 7 (far pockets), a spot that the reader calls "not a ball" (the ball lying in the pocket, the jaw
     shading) turns up in the mouth soon after. It "re-finds" the lost ball, so the ball ends "hidden" instead of
     pocketed.
   - In the per-shot pieces, the 6 also lost its event. Its piece starts after the drop's run-up.
3. **The hidden 6, and the body over the 9 and the cue ball.** The still look is the last second before the next shot,
   or the first still second after the settle. In each case the ball was clearly visible at another moment of the same
   still period.

## Changes to build (one coordinated set; all options off by default)
- **A. Pocket hold (tracker).**
  - A ball lost inside a pocket mouth is only "back on the table" when it is seen as a ball again: the reader does not
    call it "not a ball", and it stays seen for about a second or leaves the mouth.
  - A brief re-sighting inside the mouth does not undo the loss.
  - Physical reason: a ball that entered a pocket cannot return without being seen on the cloth.
- **B. Still-period looks (settled table).**
  - The table is observed over the whole still period: from when the balls stop to just before the next shot, or to the
    clip's end.
  - Nothing moves during that time, so a ball seen clearly at any moment of it is still there, even if a hand or body
    covers it later. These balls are marked "present (hidden since …)".
  - Names use all the still frames, but each number is still held at most once.
  - A ball seen only briefly does not count: it must be seen for at least 0.8 s, and the look must call it a ball on
    average.
- **C. Rack start (pack probe + break inventory).**
  - At rack start, the pack is found as the cluster of non-cloth pixels around the detected rack balls. Its location
    gives the foot end (the table's orientation). Its size gives an estimate of the ball count, reported as an estimate.
  - The starting inventory is then completed at the first still table after the break. It is every ball seen there
    (each must have come from the pack), plus every ball with a pocket event during the break, plus the cue ball.
  - It is confirmed when that count agrees with the pack estimate; otherwise the extra balls stay "unconfirmed".
  - No game rule is used. The set of balls in play (here 9-ball: cue + 1-9) comes from the recorder's game field, as
    before.
- **D. Pocket identity (P1-P6).**
  - Each pocket event keeps the pocket it was lost into (camera-relative), and gets a P-ID once the orientation is known.
    Mapping, as seen from the head end looking at the foot end: P1 = foot corner on the right, P2 = foot corner on the
    left, P3 = left side, P4 = head corner on the left, P5 = head corner on the right, P6 = right side. With the foot at
    the camera's left, this gives Nackers' rack 1 labels.
  - With no orientation, the P-ID is "unknown" and only the camera-relative pocket is reported.
  - A ball confirmed only by absence gets the pocket "unknown".
  - Every pocket call states "observed entry" or "inferred from the table".
- **E. Native continuous runner (`exp/tools/rack.js`).**
  - One tracker pass over the whole recording.
  - Still periods and shots come from the tracker.
  - State chain S0 → S1 → … uses reconcile on still-period looks.
  - Writes a rack log: shots, first ball, pocket events with P-ID and kind, the table after each shot (with hidden
    balls), and open items.
  - The per-shot cut harness stays only to score the old way.

## Measures
Rack 1 (development case, so it is *not* held-out):
- start-table accuracy (balls correctly established present at rack start);
- shots found / false;
- first ball;
- after-tables right with the per-shot scorer (baseline Cycle 2 best 12/13), and per still period with the native
  runner;
- unresolved items;
- pocket events observed / inferred;
- P-ID coverage and correctness against the verified labels;
- fabricated pockets (must be 0).

Regression, on the six earlier sessions:
- 116 shots, of which 92 are held-out Oct 17-19 (already exposed, so this is a known benchmark);
- both 30 fps picks, both reader inputs;
- the same table as Cycle 2.

Success:
- On regression: no new confidently wrong shots, false pockets, false scratches or missed/false shots, with any loss of
  correct tables reported.
- On rack 1: S0 established, P-IDs right for every observed entry, nothing fabricated.

A gain of ±1-2 shots on old data is not claimed as progress. Each change is kept only if it holds up on regression.
