# Rack 2 test: the Cycle 3 system, unchanged, on a new recording (2026-10-21)

Recording: R0.7 `20261021-1212-rack2` (iPhone 16 Pro Max, low side, home 7 ft, 9-ball, 373.8 s). The four pieces join to
the exact size in the meta file. Video, motion file and detections are in project files
`chalkline-data/sessions/rack-20261021-1212/`.

**The recording holds two complete racks**, not one: rack 2A (0-167 s, break 21.5 s, 13 shots) and rack 2B (re-racked
168-196 s, break 212.4 s, 12 shots). The system was run three ways, with nothing changed:
- each rack on its own (the detections cut at 168 s and 196 s, the way the per-shot harness cuts clips for evaluation);
- the whole recording as one rack (the runner's native mode).

Truth: `truth/` (checked by eye by Claude, reconciled with the player's account in RECONCILIATION.md; first ball judged at 1-3 fps only). Logs and
scores: `results/`. Input "B" = Challenger B number + frozen not-a-ball (the Cycle 3 default); "frozen" = frozen reader.
Scoring script: `../perception-cycle3/tools/eval-rack.js`.

## Measured results (each rack on its own)

| Measure | Rack 1 (development case) | Rack 2A | Rack 2B |
|---|---|---|---|
| Shots found / missed / false | 13 / 0 / 0 | 13 / 0 / 1 | 11 / 1 / 0 |
| First ball right / no reading / wrong | 12 / 0 / 0 | 8 / 2 / 1 | 5 / 4 / 0 |
| Start: pack count, foot end | 9 + cue, agrees; camera-left | 9 + cue; camera-left (right) | 9 + cue; camera-left (right) |
| Start: balls established | 10 / 10 | 9 / 10 (count check disagrees) | 6 / 10 (count check disagrees) |
| **Tables after shots: correct / unresolved / wrong** | **13 / 0 / 0** | **0 / 3 / 10** | **0 / 12 / 0** |
| Same, frozen reader | 12 / 1 / 0 | 0 / 3 / 10 | 0 / 11 / 1 |
| Same, Cycle 2 baseline (B input) | 12 / 1 / 0 | 0 / 3 / 10 | 0 / 12 / 0 |
| Potted balls: observed / not confirmed / credited to another shot | 9 / 0 / 0 | 5 / 2 / 2 | 3 / 5 / 0 |
| P-ID given: right / wrong | 9 / 0 | 5 / 0 (was 4 / 1 before the truth fix) | 3 / 0 |
| Pockets made up | 0 | 0 | 0 |

Whole recording as one rack: 26 shots found; rack 2A's 13 and 11 of rack 2B's 12, plus 13 false shots in the re-rack.
The runner has no idea of a second rack: re-racked balls simply "reappear", every table after the re-rack is open or
wrong.

## Why (confirmed from the logs)
1. **Balls potted on the break that were never named.** Cycle 3 leaves balls inside the pack unnamed (the reader is
   unreliable on touching balls). A ball that goes from the pack straight into a pocket is therefore never identified:
   the 4 in rack 2A, the 3, 4 and 8 in rack 2B. They stay "not seen, nothing explains it" for the rest of the rack, so
   no table after the break can be complete. In rack 1 no ball went in on the break, so this never showed. This is the
   main reason rack 2B is 0 / 12 (it is all "unresolved", nothing confidently wrong).
2. **A ball hanging in the jaws for two minutes.** In rack 2A the 7 stopped in the near side pocket jaws on the break and
   stayed there until shot A10. The system logged "7 went in" at 26.7 s and later read that ball as the 3 (and credited
   "3 potted, near side" when the 7 finally dropped). That one mistake makes 10 of 13 tables confidently wrong.
3. **Reader at the near rail and in jaws.** The 2 in rack 2B was never named in its first still look (start "not
   established"); first ball A8 read the 5 as the 3.
4. **The last shot of rack 2B (the 9, ~361 s) was not found.** The recording ends 7 s after the 9 drops, with a cue and
   a glove laid on the table.
5. **One false shot** (74.3 s): the player's body over the table.
6. ~~One wrong P-ID~~: withdrawn. The truth was wrong: the 8 in rack 2A went into P1, as the system said (see RECONCILIATION.md).
7. **Two racks in one recording** are not handled at all by the native runner (see above).

## Unknowns
- Truth is Claude's by-eye reading; the player has not reviewed it. First ball for 3 shots was not judged.
- Whether "potted on the break, never named" can be closed safely without inventing balls (for example from the pack
  count plus numbers never seen again over several still tables) is not tested. The approved rule is that disappearing
  is not proof.

## Conclusion
Rack 1's 13 / 13 does not carry over. On two new racks from the same table and camera spot, 0 of 25 tables are fully
right. The parts that worked: shot finding (24 / 25), the pack count and foot end (both racks), P-IDs where given (8 / 8),
no pockets made up, and on rack 2B nothing confidently wrong. The parts that failed are break pots of unread pack balls,
a ball resting in the jaws, and multi-rack recordings.
