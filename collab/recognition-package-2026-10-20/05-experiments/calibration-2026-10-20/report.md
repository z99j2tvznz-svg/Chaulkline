# Per-table appearance calibration: scored experiment (Oct 20, 2026)

**Result: not promotable.**
- The calibration names more balls at the far camera and turns some confident misreads into honest blanks at the other side.
- But it creates new confidently wrong identities: mostly a far-camera ball read as the 4.
- It does nothing for changed lighting.
- The end-table gain (+3 shots, or +2 on the alternate pick) is inside sampling noise.

v0.6, the reader's weights and the app are unchanged. Labels: Confirmed = measured; Likely = reasoned; Unknown = not measurable here.

## What was tested
- **Calibration (offline only):**
  - The frozen reader stays as it is. A small correction to its last layer is learned from one session's verified pictures, and applied to that session's other clips only.
  - The correction is pulled towards "no change", and the strength of that pull is picked using the calibration pictures only.
  - It must also keep the reader's own answers on unlabelled spots of the calibration clips, so numbers it has no example of are not pushed down.
  - Code: `tools/experiments/recal.py`, `recal-run.py`, `reader-dump.js`, `reader-looks.js`, `recal-compare.js` (branch `claude/project-thread-evm9v0`, 22902b0).
- **Gate-only variant:** only the "not a ball" score is corrected, and the ranking of numbers stays the reader's own. This measures the rejection gate on its own.
- **Verified labels only:**
  - Your 14 new pictures (page https://claude.ai/artifact/8VruNrJXGDb9sXEWJXQjUS, saved in `calibration-2026-10-20/labels/`).
  - The existing labels-v1 Oct 16 frames.
  - Nothing was learned from play.
- **Independent test images:** each session is scored only on clips the calibration never saw.

| Session (camera) | Calibration pictures | Test clips |
|---|---|---|
| Oct 16 (close side) | 14 existing (rack 1) | rack 2 (15) |
| Oct 17 first spot (far) | 6 (rack 1) | rack 2 (15) |
| Oct 17 other side | 3 (shots 1-3) | shots 4-15 (10) |
| Oct 17 recorder | 1 (spread) | other 33 clips |
| Oct 18 evening check | 2 (clips 1-2) | other 18 |
| Oct 19 one-shot | 2 (clips 1-2) | other 21 |

- **Checks:**
  - The re-run reader matched the frozen detections on 99.98% of 358,601 spots (Confirmed).
  - Every result is scored on the frozen 30 fps pick and on the alternate odd-frame 30 fps pick.

## Baseline: what happens to real balls in settled looks (v0.6, all sessions with a known table)

Split by count; truth has no ball positions.

| | Balls | Named right | 1 rejected as "not a ball" | 2 kept but unnamed | 3 wrong number | 4 absent (not detected, filtered, flicker, hidden) |
|---|---|---|---|---|---|---|
| Start tables | 476 | 317 (67%) | 44 | 51 | 18 | 46 |
| End tables | 384 | 263 (68%) | 41 | 45 | 10 | 25 |

Where:
- Rejections are the far spot (20 / 18) and the Oct 17 light steps (22 / 22).
- Wrong numbers are the far spot (11 / 7) and the other side (7 / 3).
- Absent is mostly the far spot (28 / 18).
- Oct 16 has almost nothing left.

For the conditions behind these (far camera, 9 or 1 against the cue ball, lighting, clusters, rail-frozen balls), see `rest-naming-2026-10-20.md`. It is the same footage cut the same way.

## Results on test clips only (full calibration)

**Main measure, ending table right with no correction, 92 test shots:**

| | Frozen pick: v0.6 → calibrated | Alternate pick: v0.6 → calibrated |
|---|---|---|
| Each shot judged alone | 31 → 34 | 29 → 31 |
| Played straight through | 25 → 28 | 23 → 25 |
| Confidently wrong shots | 24 → **25** | 28 → **30** |
| Phantom pockets | 2 → 3 | 2 → 2 |
| Made balls left open | 57 → 53 | 56 → 53 |
| Missed / false shots | unchanged | unchanged |
| Complete racks | 0 | 0 |

**Per session (each shot alone; frozen pick, then alternate pick):**
- **Oct 16:** end 5 → 5; one new phantom-pocket fact, in a clip that was already wrong.
- **First spot:** end 0 → 0.
  - Confidently wrong 11 → 12 (alternate pick 10 → 12).
  - New wrong clips: shots 23 and 24 (and 27 on the alternate pick). A ball that is not the 4 is now read as the 4 while the 4 is already down.
- **Other side:** end 1 → 1. Wrong numbers on start tables went 7 → 3 and on end tables 3 → 1; those balls became unnamed rather than misnamed. Table-state errors 8 → 6.
- **Oct 17 recorder:** end 10 → 12 (alternate pick 8 → 9). The light-step looks did not improve: rejections 22 → 23.
- **Oct 18:** no change.
- **Oct 19:** end 12 → 13 (alternate pick 11 → 12).

**Naming at rest on test looks (frozen pick):**
- First spot start tables: 40 → 50 of 88 named. End tables: 29 → 36 of 63.
  - Rejections of real balls fell 9 → 0 and 4 → 0.
  - Wrong numbers rose 8 → 10 on start tables.
- Other side: named unchanged (35 of 50; 14 of 19), but wrong 7 → 3 and 3 → 1.
- Oct 16: +1 ball. Recorder static layouts: −1 ball.

**Gate-only variant (Confirmed):**
- It removes the far-spot rejections (9 → 3, 4 → 0), but those balls only become unnamed. No end table changed, and there were no new errors anywhere.
- So at the far spot the gate is not what limits naming; the number reading is.
- Under changed light, calibration taken in normal light did not move the gate at all (22 → 22).

## Setup cost (Confirmed for this run)
- **Your time:** about 15 minutes for 14 pictures (from the save times). That is about 1 minute for a 9-ball picture and 3 minutes for the 16-ball spread.
- **Examples needed (far spot learning curve):**

| Pictures | Start named | End named | Confidently wrong |
|---|---|---|---|
| 0 | 40 | 29 | 11 |
| 1 | 39 | 29 | 13 |
| 2 | 48 | 36 | 12 |
| 4 | 51 | 38 | 12 |
| 6 | 50 | 36 | 12 |

  Most of the gain comes with 2 pictures, about 2 minutes of your time. More pictures did not remove the new 4 misreads. Mid-rack pictures show only a few numbers (the 4, 5, 2 and 1 appear in only one or two pictures), so a calibration from game pictures is unbalanced (Likely the cause).
- **Lighting:** one calibration in one light does not carry over to another (Confirmed on the light steps). Re-calibrating for each light could not be tested, because each light step is a single clip of one layout.

## What this means
1. **Calibration can move the reader (Confirmed).** At the far spot it names about 10 more balls, and it stops rejecting real balls. At the other side it trades misreads for honest blanks.
2. **It fails the acceptance rules (Confirmed).** It makes new confident misnames: the 4 at the far spot, and one phantom-pocket fact on Oct 16. Zero new confidently wrong identities was required.
3. **The end-table gain is not established.** +3 and +2 shots across 92 is at the sampling-noise level we measured.
4. **It does not address lighting (Confirmed),** which is the largest gate failure.
5. **Likely root cause:** the reader is a very small network (24 x 24 pixel crops, one hidden layer) trained only on Oct 12-13 home-table pictures from one camera spot. A few pictures can nudge it, but far balls and changed light are outside what it ever learned, so the nudge also moves look-alike numbers.

## Recommendation
- **Do not promote calibration.** Keep v0.6.
- Keep the tools and your labels: they are a ready test bed, and the 14 pictures are new verified data from the far spot, other side and recorder spots.
- The evidence points at the reader itself rather than per-table tuning. The established fix would be to retrain the number reader on the detector's crops with more data and with light and size variation, scored the same way. That is a big task, so it would need your "build it".
