# One complete rack, recorded continuously: the current system vs truth (2026-10-21)

Nackers asked for testing on the single rack recorded with R0.7. He said there may be a foul in it, without saying which
or when. Nothing in the app, the frozen package, v0.6, the Cycle 2 code or any benchmark was changed. This is **one
rack**: it says what works on complete footage, not how often.

## Footage and truth
- Recording: R0.7 continuous rack, iPhone 16 Pro Max, low side, home 7 ft, 9-ball. 3 min 31 s, 60 fps, about 1 s
  chunks.
  - Video: project files `chalkline-data/sessions/rack-20261021-0526/`.
- Truth: [truth/rack1-events.json](truth/rack1-events.json), checked by eye by Claude. Not checked by Nackers yet.
  - 13 shots including the break; all 9 balls made; no scratch.
  - **One foul found:** shot F (114.0 s), wrong ball first. The cue ball, kicked off the near rail, contacts the 5 at
    114.82 s before the 3, which was the lowest ball. The 5 went in the far side pocket. Checked frame by frame at
    60 fps.
  - Other moments in the footage: the empty rack frame is left on the cloth after the break (removed by hand at 20-22 s).
    The player's body hides most of the table at 138-147 s (shot H). The player's head hides the near half at
    184-189 s. A cue and a glove are laid on the cloth after the last shot.

## Pipeline (all frozen pieces, unchanged)
1. `collab/recognition-package-2026-10-20/code/tools/clip-detect.js --detector detector-v1 --outline-check keep-first`
   at 30 fps on the whole recording as one clip.
   - Outline: the table finder was fully confident on frame 1 and found all 4 corner pockets.
   - 6,327 frames, 41,476 spots.
2. Challenger B's number on every spot + the frozen reader's not-a-ball (the Cycle 1 recognition baseline), and B's full
   probabilities for whole-table naming ([tools/prep_inputs.py](tools/prep_inputs.py), the benchmark's own
   `infer_footage.job`). The frozen-reader-only input was also scored.
3. The scorer handles one shot per clip, so the rack is cut into per-shot pieces using only the system's own shot starts
   ([tools/segment.js](tools/segment.js); truth is never read).
   - Piece k runs from 3.3 s before its shot to 0.3 s before the next system shot, so its final look is the still table
     just before the next shot.
   - Truth per piece: [tools/make-truth.js](tools/make-truth.js).
4. Scored with the Cycle 2 scorer copy (scoring functions byte-identical to frozen), with v0.6 and the Cycle 2 best
   configuration (delayed + whole + guard).

## Results (13 real shots, played straight through; continuous = checkpoint here)
| Input | Configuration | Correct automatically | Unresolved | Confidently wrong | Shots missed / false | False pockets | Rack complete |
|---|---|---|---|---|---|---|---|
| B number + frozen nb | v0.6 | 11 | 2 | 0 | 0 / 0 | 0 | no |
| B number + frozen nb | Cycle 2 best | **12** | 1 | 0 | 0 / 0 | 0 | no (1 open item) |
| Frozen reader | v0.6 | 11 | 2 | 0 | 0 / 0 | 0 | no |
| Frozen reader | Cycle 2 best | 11 | 2 | 0 | 0 / 0 | 0 | no |

- **Shots:** all 13 found with no false shots. The system's start times are within 0.2 s of the truth, except the
  occluded shot H (+0.6 s). Compare the earlier per-shot footage: 5 missed and 10 false shots on 92 held-out shots.
- **Every made ball** was confirmed in the right shot, with no false pockets and no ball called on the table that had
  gone. The final table (only the cue ball left) is right in every run.
- **The one open item (best configuration), shot F:** in the final look before shot G, the player's bridge hand sits
  over the 6. The 6 is left "not seen, nothing explains it". It is not called pocketed, which is the correct caution. It
  is seen again in the next look and goes back to present.
  - v0.6 also leaves the cue ball unnamed after shot G. Whole-table naming fixes that.
- **First ball hit** (research number): 11 of 13 right with B input. The other 2 have no reading: the break, and the
  occluded shot H. None are wrong.
  - On shot F the tracker reads first ball = 5, while its own table state before the shot says the lowest ball on the
    table is 3 (`game.lowest = 3, lowestSure = true`).
  - **So the evidence for the foul is in the system's output,** but nothing turns it into a foul call: no rules check is
    wired into this offline pipeline.
  - A plain "lowest ball first" check on these readings would flag exactly the real foul, with no false fouls and
    2 shots undecided.
  - With the frozen reader, shot B reads first ball = 9 (truth 1). That would be a false foul.

## Look-timing check (not adopted)
`segment.js --cut settle` ends each piece one still second after the shot settles, instead of just before the next
shot.
- It fixes shot F (no hand over the 6 yet).
- It breaks shot H: the still second comes while the player's body still hides the 9 and the cue ball.

Same totals (B input: 12 correct with v0.6 or best), so it is a trade, not a gain. **Finding:** which still moment is
used as "the table after the shot" matters on continuous footage. Choosing the clearest still look between the settle
and the next shot is a candidate for the next cycle, to be judged on more than this one rack.

## Limits
- One rack, one camera spot, one player, a good view: a best case, not a rate.
- The truth was made by Claude from the video, not yet confirmed by Nackers. Its main facts are the 13 shot times, the
  made balls per shot and the foul.
- Only the frozen30 pick (30 fps) was run; the d30b pick was not.
- The segmentation is a scoring harness. Its cut rules were fixed before scoring and not tuned. The settle variant was
  tried once and not adopted.

## Files
- `truth/`: the event list, and the per-piece truth the scorer read.
- `results/scores.tgz`: all 8 scorer outputs, with traces.
- `results/pieces-*.json`: system shot starts and the piece cuts.
- Detections and probabilities: project files `chalkline-data/sessions/rack-20261021-0526/detections/`.
