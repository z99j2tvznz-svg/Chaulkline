# Cycle 4 validation and cue-ball test: first evaluation (2026-10-22)

Plan: [PREREGISTRATION.md](PREREGISTRATION.md). Truth drafted by eye from the video and committed (2bae723) before
either system was run. No option, threshold or tool was changed before these numbers. Recordings: R0.8 session
20261022-1227 (racks 3, 4, 5) and 20261022-1244 (cue-ball clips), stored with SHA-256 under
`chalkline-data/sessions/validation-2026-10-22/`. Everything here is on fresh footage; nothing was developed on it.

## Part 1: three racks

| Measure | Rack 3 C3 | Rack 3 C4 | Rack 4 C3 | Rack 4 C4 | Rack 5 C3 | Rack 5 C4 |
|---|---|---|---|---|---|---|
| Real shots (truth) | 9 | 9 | 26 | 26 | 1 | 1 |
| Tables after shots: correct / unresolved / **confidently wrong** | 0 / 8 / **1** | 5 / 3 / **1** | 0 / 26 / 0 | 0 / 26 / 0 | 0 / 1 / 0 | 0 / 1 / 0 |
| Shots: found / missed / false | 8 / 1 / 0 | 8 / 1 / 0 | 25 / 1 / 1 | 25 / 1 / 1 | 1 / 0 / 2 | 1 / 0 / 2 |
| First ball: right / no reading / wrong | 7 / 0 / 0 | 7 / 0 / 0 | 7 / 1 / 12 | 9 / 1 / 10 | - | - |
| Made balls: observed / inferred / not confirmed | 4 / 0 / 4 | 5 / 3 / 0 | 0 / 0 / 8 (+1 other shot) | 2 / 0 / 7 | 0 / 0 / 2 | 0 / 0 / 2 |
| P-IDs right / wrong / unknown | 4 / 0 / 0 | 5 / 0 / 3 | 0 / 0 / 0 | 0 / 0 / 2 | - | - |
| Start: balls established | 7 / 10 | 10 / 10 | 8 / 10 | 8 / 10 | 6 / 10 | 6 / 10 |
| Invented pockets | 0 | 0 | 0 | 0 | 0 | 0 |

Totals over 36 real shots: **Cycle 3 0 correct / 35 unresolved / 1 confidently wrong; Cycle 4 5 / 30 / 1.**
Made-ball counts exclude the ball of a missed shot (the scorer has no table for it).
Rack 1 (development) was 13/13 for Cycle 4; the fresh racks are far worse.

Rack split check (`tools/racks.py`, Cycle 4 options): rack 3 no proposal (right); rack 5 one proposal, rejected for
having no pack (right); **rack 4 a false split at 218 s** (after a foul the player moved the cue ball and the 6 by
hand; the still-table count rose and a 2-ball "pack" passed the check).

Break accounting:
- Rack 3 (8 and 3 into P1): Cycle 4 inferred both from the table, pocket unknown (right, no pocket invented). Cycle 3
  left both unconfirmed.
- Rack 4 (3 into P1): unconfirmed in both, for the whole rack.
- Rack 5 (7 into P1, 9 into P3; the 9 wins the rack): unconfirmed in both.

### New failure modes (times in the recording)
1. **Recording starts while racking** (rack 5, 0-36 s). The rack look is taken at 13.5 s with the rack half built;
   false shots at 17.3 and 32.6 s; pack count 8 + 6 = 14. After looking (not part of the score): with an explicit
   "rack ready" mark at 41 s (the supported `--marks` fallback) the false shots go and the count agrees (9 + 1 = 10),
   but the two break pots stay unconfirmed.
2. **Shot hidden by the player's body** (rack 3, 122.3 s). Missed; the 7 dropping in P5 is credited to the shot
   before (111.3 s), giving the only confidently wrong table on these racks.
3. **Camera knocked** (rack 4, ~302-306 s). One false shot (303.1 s). Afterwards pockets are reported with
   "P-ID unknown (the camera may have moved)": cautious and right.
4. **Pocketed balls never confirmed in a long, busy rack** (rack 4, 411 s, 26 shots). Every made ball after the
   break stays "unconfirmed", so no table is ever complete. Likely cause (not proven): the 9 is named in only about a
   third of the frames where other balls are named (1326 vs about 3500-3900, 100-230 s) and is often read as the cue
   ball, so the still-table count never balances. Ball 1 and 3 are not phantom-read after they drop (3 and 6 frames).
5. **First-ball misreads in rack 4**: 2 (blue) given as 6 (green) five times, and 9 given as first ball
   three times. Rack 3 had none.
6. **False rack split** (rack 4, 218 s), above.

### Verdict
Cycle 4 is better than Cycle 3 on every rack where they differ (5 vs 0 correct tables, same confidently wrong), so the
pre-set condition "Cycle 4 >= Cycle 3 with no rise in confidently wrong" holds. But 5 of 36 tables is not a usable
result; rack 1's 13/13 did not generalise. **Not promoted.** The fresh racks expose problems the development racks did
not have: racking at the start of a recording, long racks with fouls and hand-placed balls, the camera being moved.

## Part 2: cue-ball clips (partial: 14 of 38 events)
Recorded: A1-A8, B1-B4, C1-C2. Not recorded: B5-B10, C3-C10, D1-D10. No tape readings are used as truth
(stored, not scored). Tool: `tools/score-notape.js` (committed 149a6b0 before running on the footage).

**Position (A, 8 placements, truth = the intended diamond spot, placement about +/- 1-2 in):**
- All 8 found; all within a quarter diamond. Median 0.14 diamond (1.4 in), worst 0.21 diamond (2.1 in, centre).
- Exact axis (ball touching a rail): near rail A2 1.4 in, far rail A6 0.9 in, right rail A8 0.4 in.
- Pattern: the near-half spots (A1-A4) all come out 1.4-2.0 in closer to the near rail than intended; the far-half
  spots are within 1 in. The near-rail frozen ball (exact truth) shows the same 1.4 in. Likely a height / perspective
  offset in the ball's table position for this low side view (the "ball-height correction" noted earlier). It is
  small next to a quarter diamond but it is systematic.
- A2 (touching the near rail at the side pocket) was only found because Cycle 4 keeps the boxes the frozen detector
  throws away as "in a pocket".

**Motion (B, C: 6 shots):** 6 found, 0 missed, 0 false; every path complete (no gaps over 0.2 s); a rest position for
every shot. Path lengths match the shots (B1, B3, B4 and C2 went to the right rail and back; B2 and C1 did not).
Speeds have no truth and too few shots per group to judge; no speed claim is made. D (speed levels) was not recorded.

**Coaching outcomes:**
- B in/out against the stickers the camera actually sees (sticker corners mapped with each clip's table outline):
  **4 / 4 agree with the player** (B1 out, B2 out, B3 in, B4 out), none borderline (1.8-6.8 in from the edge).
- Against the intended box (6 diamonds from the left): 2 / 4. The stickers sit about a third of a diamond short of
  that spot (box centre about 5.7 diamonds, 2.0 across), so the disagreement is box placement, not tracking.
- The stickers were never taken for a ball.
- C touched rail: 2 / 2 agree (C1 no, closest 14.3 in; C2 yes, 0.5 in).

**"Stop in the Zone" decision (pre-set rule):**
- Rule 1 (position: median <= 1.5 in, worst <= 3 in): consistent with the data (1.4 / 2.1 in) but the truth itself
  is only good to 1-2 in, so it is not proven.
- Rule 2 (in/out >= 9 of 10): 4 / 4 against the stickers, but only 4 shots.
- Rule 3 (every shot found, no false shots, a rest for every shot): met on 6 / 6.
- **Decision: not enough shots to say go. The evidence so far is positive. Do not build yet.** If built, the zone
  must be the box the camera sees (the stickers), not an intended diamond spot.

## Files
`results/rack3|4|5/` logs and scores for both cycles plus the rack-split output; `results/rack5/*mark41*` the
after-looking mark run; `results/cueball/` per-clip tracker output and `score.json`. Runner: `tools/runrack.sh`.
