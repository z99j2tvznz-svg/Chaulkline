# Perception Cycle 3: one continuous understanding of the table through a rack (results, 2026-10-21)

Plan and criteria: [PREREGISTRATION.md](PREREGISTRATION.md).

Nothing in the app, the recorder on main, the frozen package, v0.6, or the earlier benchmark folders was changed. All new
behaviour is behind options in `exp/tools/`, which are off by default. The scoring functions are byte-identical to the
frozen scorer (`tools/check_scorer.py`).

Rack 1 is the development case. It was looked at while building, so its numbers are not a held-out test. The six earlier
sessions are the regression check. Their Oct 17-19 part (92 shots) was already exposed in earlier cycles, so it is a
known benchmark, not fresh validation.

## What changed (four parts, one system)
1. **Pocket hold** (tracker option `pocketHold`).
   - Before: a ball lost inside a pocket mouth counted as back on the table as soon as any spot turned up there. That
     spot was often the ball itself lying in a far pocket, or shading at the jaws. So 3 of the 9 drops in rack 1 ended
     as "hidden".
   - Now: the ball is back only if it is seen steadily at the mouth (in 60% of the frames over 1 s: a ball sitting in
     the jaws) or seen as a ball outside the mouth. Glimpses do not undo the loss.
   - The first version also refused spots the reader calls "not a ball". On the old data that made false pockets: a
     cue ball sitting in the jaws is often read as "not a ball". That rule was replaced by the persistence rule. A
     timing bug was fixed too: after a re-loss, the ball must stay gone 1 s from the re-loss.
2. **Still-period looks** (option `x.period` in the scorer, `period` in the runner).
   - A table look covers the whole still stretch it belongs to, not only its last second. Nothing moved during that
     stretch, so a ball seen clearly at any moment of it is still there when a hand or the body covers it later. It is
     carried as "present (hidden since t)".
   - Three safeguards came out of the first regression pass:
     - The look is a superset of the old one-second look, so a ball that arrives late still counts.
     - The stretch starts only once every ball is within 0.75 in of where it ends up (a ball creeping to a stop is not
       "moving" for the tracker).
     - A spot whose sightings all end before a nearby spot starts is the same ball creeping, not a second ball.
3. **Rack start** (`tools/rackprobe.py` + the runner).
   - Pixel level. The probe takes the median picture of the still table before the break, builds a non-cloth mask
     (plus the detector's balls, because a blue ball on blue cloth is not "non-cloth"), and fits a hexagonal grid of
     touching balls to the pack.
   - It gives the pack's position, which gives the foot end, and a ball count. The count is reported as an estimate,
     with its match score.
   - Balls inside the pack are not named: the reader is unreliable on touching balls. In rack 1, the 1 at the apex was
     read as the 5.
   - The starting inventory is completed at the first still table after the break, from every ball seen there plus
     balls seen going in on the break. It is then checked against the pack count.
4. **Continuous-rack runner with pocket identity** (`exp/tools/rack.js`).
   - One tracker pass over the whole recording, with no hand-cut clips.
   - Still stretches and shots come from the tracker.
   - A table-state chain: rack look → after shot 1 → … → after shot n.
   - Each pocketed ball is labelled "observed entry", with the camera-relative pocket and the P-ID once the foot end is
     known (P1-P6 as approved), or "inferred from the table", with pocket "unknown".
   - A camera check: if at least 3 balls, and 70% of the balls named in two consecutive looks, all shift the same way by
     more than 1.5 in, the phone has probably moved, and later P-IDs become "unknown (the camera may have moved)".

## Measured results

### Rack 1, native continuous runner
Script: `tools/eval-rack.js`. Logs and scores: `results/rack1/`. Input: B number + frozen not-a-ball. The frozen
reader's results are in brackets where they differ.

| Measure | Baseline (Cycle 2 looks and pocket rule, run natively) | Cycle 3 |
|---|---|---|
| Start table: balls established | 3 of 10 named at rack start (one of them a misread: the 1 read as the 5); 7 unconfirmed | **10 of 10**. Pack count 9 + cue ball = 10, agrees with the break inventory |
| Foot end / orientation | none | camera-left end, from the pack position |
| Shots found / missed / false | 13 / 0 / 0 | 13 / 0 / 0 |
| First ball (12 non-break shots) | 12 right, 0 wrong | 12 right, 0 wrong |
| Tables after shots: correct / unresolved / wrong | 12 / 1 / 0 (11 / 2 / 0) | **13 / 0 / 0** (12 / 1 / 0) |
| Hidden balls carried through occlusion | 0 | 1 (the 6 under the bridge hand); right |
| Made balls: observed entry / inferred / not confirmed | 6 / 3 / 0 | **9 / 0 / 0** |
| P-ID: right / wrong / unknown | 0 / 0 / 9 (no concept) | **9 / 0 / 0** |
| Pockets fabricated | 0 | 0 |
| Camera-move flags | not checked | 0 (none happened) |

- What each part adds, from the B-input runs: pocket hold makes 6 → 9 drops observed; the still-period looks make
  12 → 13 tables (the 6); the probe adds the start inventory, the orientation and the P-IDs.
- Per-shot cut harness: the old way, the same as the earlier rack test. With B input, 12/13 → 13/13. With the frozen
  reader, 11/13 → 12/13. 0 confidently wrong in both. The frozen reader's remaining open item is the 1 hanging in the
  jaws after shot 2: the frozen reader does not name it.
- Camera check, synthetic test only: rack 1's detections were shifted by 3 in at 120 s. The check flagged it at shot 7,
  and the later P-IDs turned "unknown". There were no flags on the real recording.

### Regression: six earlier sessions, 116 shots, shots judged alone / straight through
Columns:
- HO = the 92 held-out shots.
- CW = confidently wrong shots.
- Missed / false = shots missed / false shots (HO).
- False pockets = HO.

| Input, pick | Configuration | Correct (all) | Correct (HO) | CW (all) | Missed / false | False pockets | Racks |
|---|---|---|---|---|---|---|---|
| B + frozen nb, frozen30 | Cycle 2 best | 54 / 41 | 41 / 36 | 17 / 18 | 3 / 8 | 0 | 0/5 |
| | **Cycle 3** | **58 / 44** | **44 / 39** | **16 / 17** | 3 / 8 | 0 | 0/5 |
| B + frozen nb, d30b | Cycle 2 best | 52 / 38 | 39 / 33 | 22 / 22 | 4 / 11 | 1 | 0/5 |
| | **Cycle 3** | **55 / 40** | **41 / 35** | **21 / 21** | 4 / 11 | 1 | 0/5 |
| Frozen reader, frozen30 | Cycle 2 best | 38 / 30 | 26 / 25 | 26 / 26 | 3 / 8 | 2 | 0/5 |
| | **Cycle 3** | **44 / 35** | **31 / 30** | **23 / 23** | 3 / 8 | 2 | 0/5 |
| Frozen reader, d30b | Cycle 2 best | 36 / 28 | 24 / 23 | 30 / 30 | 4 / 11 | 2 | 0/5 |
| | **Cycle 3** | **41 / 32** | **28 / 27** | **28 / 28** | 4 / 11 | 2 | 0/5 |

- **Per clip, no shot got worse in any of the 4 runs.** Every change is either a gain to "correct", or confidently
  wrong turning into unresolved. The lists are in `results/regression/diff_*.txt`.
- No session lost a table. There are no new false pockets, missed shots or false shots.
- Separately, on B input frozen30: pocket hold alone 56/43, still-period looks alone 56/42, both 58/44.
- Racks are still 0/5. The reasons are the same as in Cycle 2: the old racks contain recordings that end while balls
  roll, and false shots.

## Interpretation (likely explanations, not measured)
- The old pocket rule's weak point was far pockets. There, the camera can see a ball lying in the pocket, and the
  tracker took that for the ball coming back. This probably matters more on continuous footage, where nothing cuts the
  clip off before the glimpse.
- The still-period gains on old data come from more evidence per look: names get more frames, and balls covered in the
  last second are carried. They do not come from the occlusion carry alone.
- The rack-start count matches on rack 1, but the method has been tried on **one** rack only (three time windows, all
  9). Its weak spots are likely balls the colour of the cloth that the detector also misses, a body or cue lying over
  the pack, and other rack shapes. It should stay an estimate until more racks exist.

## Remaining limitations (confirmed)
- **Pocket identity on the old sessions:**
  - No P-IDs: none of those recordings shows a rack, so no orientation can be found.
  - No pocket truth to check camera-relative pockets against.
  - P-ID correctness is measured on rack 1 only (9/9).
- **Rack level:** the native runner, the start inventory, the P-IDs and the camera check have only been tested on rack 1
  (plus the synthetic camera shift). The parts shared with the per-shot harness (pocket hold, still-period looks) are
  what the regression tests.
- **Reader:** the frozen reader still misnames balls (4 ↔ 7, 9 ↔ cue). Pocket hold makes the frozen reader produce more
  pocket events, so a misnamed drop is now more likely to be confirmed with the wrong number. On the frozen reader this
  showed up only during development, and was gone after the persistence fix. With B input it did not happen.
- **No occluder awareness:** a hidden ball is kept because nothing moved. The system still does not know what covered
  it. If a hand removed a ball without the tracker seeing it move, the system would keep it as present (hidden) until
  the next look.
- **Out of scope here:** shot detection (11 old problems) and the "unnamed spot" identity limits.

## Reproducing
- Rack 1:
  1. `tools/rackprobe.py <dets> <video> 0 11.6 probe.json`. The window is the runner's rack look; the video is in
     project files `chalkline-data/sessions/rack-20261021-0526/`.
  2. `node exp/tools/rack.js <dets> --set 0,1,2,3,4,5,6,7,8,9 --probe probe.json --out log.json` (baseline:
     `--opts '{"pocketHold":false,"period":false,"probe":false}'`).
  3. `node tools/eval-rack.js log.json ../rack-test-2026-10-21/truth/rack1-events.json ../rack-test-2026-10-21/truth/rack1-pockets-and-account.json`.

  The detections are in project files `.../rack-20261021-0526/detections/`.
- Regression: `C2_OUT=<cycle 2 inputs> python tools/run.py out.json '<configs>'`, with configuration
  `{"version":"v0.6","pocketHold":true,"x":{"delayed":true,"whole":true,"guard":true,"period":true}}`. Per clip:
  `tools/diffcfg.sh <dets root> <pick> '<A>' '<B>'`.
