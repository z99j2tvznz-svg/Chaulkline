# Diagnostics after the first baseline (Oct 18, 2026)

This is the limited diagnostic phase that ChatGPT approved after reviewing the first frozen baseline. It measures only. No rule was changed, and every baseline number comes out the same without the new flags. Some results below were made by feeding verified truth into one stage. Those are labelled **oracle-assisted**: they are diagnostics, not product performance.

- Code: commit 63e2ce6.
- Method: `docs/diagnostics.md`.
- Raw outputs: `diagnostics-2026-10-18/`, one set per session: `current`, `oracle-obs`, `oracle-pockets`, `oracle-both`.

The validation sessions are the Oct 17 other side, the Oct 17 first spot, and the recorder shots. Oct 16 is the development session.

## The short answer

- **Confirmed:** neither fix alone is enough.
  - Perfect ball sightings alone cut confidently wrong calls on real play from 21 to 8, but they leave made balls open.
  - Perfect pocket answers alone barely help real play, but they lift the simple recorder shots from 4 to 15 of 18 correct.
  - With both, 23 of the 35 real-play shots on Oct 17 come out right when memory is re-set to the truth before each clip.
- **Confirmed:** with both fixed, every remaining wrong call is shot timing: 11 of 11 are missed shots or false shots.
- **Likely:** the ball finder has a detection problem and a naming problem, and which one dominates depends on the camera spot.
  - From the first spot (far balls), at least 49 of the 91 missed balls were not detected at all.
  - From the other spot and Oct 16, most errors are naming: dark balls (the 7 and 8) are read as the blue 2, again and again.
- **Confirmed:** a gap in the rules showed up. Once a ball is left "unconfirmed" (for example when a clip ended while it was still rolling), no later still look ever closes it. With perfect sightings and pocket answers, the no-help run still leaves 22 of the 53 validation clips unresolved, mostly for that reason.

## B. Oracle-assisted component isolation (diagnostic, not real performance)

"Re-set" means memory is set from the truth before each clip; "no help" means memory carries from clip to clip. Each cell reads correct / unresolved / confidently wrong.

| Validation, 53 real-shot clips | No help | Re-set |
|---|---|---|
| Current pipeline | 4 / 24 / 25 | 4 / 24 / 25 |
| Perfect ball sightings | 4 / 37 / 12 | 18 / 23 / 12 |
| Perfect pocket answers | 15 / 14 / 24 | 16 / 13 / 24 |
| Both | 20 / 22 / 11 | 38 / 4 / 11 |

| By session, re-set | Current | Sightings | Pockets | Both |
|---|---|---|---|---|
| Oct 16, development (24) | 3 / 10 / 11 | 9 / 10 / 5 | 6 / 7 / 11 | 14 / 5 / 5 |
| Oct 17 other side (9) | 0 / 3 / 6 | 3 / 4 / 2 | 1 / 2 / 6 | 5 / 2 / 2 |
| Oct 17 first spot (26) | 0 / 11 / 15 | 11 / 9 / 6 | 0 / 11 / 15 | 18 / 2 / 6 |
| Recorder shots (18) | 4 / 10 / 4 | not possible\* | 15 / 0 / 3 | 15 / 0 / 3 |

\*The recorder layouts are scripted, not checked, so no verified sightings exist for them.

What is left with both fixed (validation, re-set):
- **11 wrong:** 9 missed shots and 2 false shots.
- **4 open:** 3 clips ended while balls were still moving, and in 1 the made ball was not explained.

## A. Detection versus naming

This uses each clip's final look where the truth knows what is on the table. Truth has no ball positions, so the split is by counts, and the "at least" figures are lower bounds.

| | Oct 16 (29 looks) | Other side (12) | First spot (27) |
|---|---|---|---|
| Balls on the table | 152 | 63 | 152 |
| Named right | 134 | 37 | 61 |
| Not named right | 18 | 26 | 91 |
| … seen but unnamed (at most) | 7 | 3 | 32 |
| … under a wrong number (at most) | 11 | 10 | 10 |
| … not detected at all (at least) | 7 | 13 | 49 |
| Extra groups that are not balls (at least) | 7 | 0 | 0 |

**The 31 "named, but gone" balls.** These were checked against what sat at the same spot before the shot.

| Explanation | Count | Label |
|---|---|---|
| A ball that sat still and was misread the same way every time | 13 | Likely |
| A ball that moved and was misread as another number | 2 | Likely |
| A mark read as a ball | 1 | Likely |
| Cannot tell | 15 | |

15 of the 31 are the same mistake repeated from the clip before.

Two were checked by eye, and the pictures match:
- Firstspot shot018: the 8 is read as the 2.
- Otherside shot004 to shot013: the maroon 7 is read as the 2.

Most of the 31 are identity substitutions, not false detections (likely).

## C. Clips with a still final look versus a moving one

"Still" is judged by the tracker's own motion, not checked by eye.

| Validation | Clips | Correct | Unresolved | Wrong |
|---|---|---|---|---|
| Final second still | 40 | 4 | 21 | 15 |
| Final second moving | 13 | 0 | 3 | 10 |

On Oct 16 (development), 18 clips were still and 6 were moving.

Clips that end while balls are moving are a capture problem: the recorder should keep recording until the table is still. For the algorithm, they are missing input.

## Shot finding

| | All sessions | Validation |
|---|---|---|
| Real shots (a clip can hold more than one) | 78 | 54 |
| Found | 65 (83%) | 45 (83%) |
| Missed | 13 | 9 |
| False shots in clips with no shot | 2 of 28 clips | 1 of 23 clips |
| Extra shots inside real-shot clips (duplicate or false; cannot tell) | 3 | 2 |
| Footage | 22.2 min | 15.9 min |
| False or extra shots per hour | about 13.5 | about 11 |

A missed or false shot makes the clip "confidently wrong". Each clip gets exactly one top-level outcome. The error flags under it can overlap, so they must not be added up.

## A looser pocket rule (tested, not adopted)

The rule tested: a ball clearly seen before the shot, gone from a still after-look in which every ball the finder saw was named. Across all sessions it made 37 calls: 19 right, 17 wrong, 1 cannot tell.

In the recorder clips, 9 of its 10 wrong calls named a ball that was not on the table at all. In those, the ball really did disappear, but the 1 had been read as the 5, 9 or 6. So a "gone from a still table" rule may become usable once naming is fixed (likely). It is not safe now.

## Answers to ChatGPT's questions

1. **The 31 named-but-gone:** see section A. At least 15 are likely identity substitutions and 1 is likely a mark; 15 cannot be told apart without position labels.
2. **The 91 missed at the first spot:** at least 49 were not detected at all, at most 32 were detected but unnamed, and at most 10 were named with a wrong number.
3. **Can the truth files support oracle tests?** Yes for which balls are on the table and which went in, in 3 of the 4 sessions. No for ball positions, which are not in the truth anywhere. The recorder layouts are scripted, so there is no sightings oracle for them.
4. **Clips with a verifiable still final look:** 58 of 77 by the tracker's own motion. None has been checked independently by eye yet (unknown).
5. **Missed shots in the top-level outcomes:** yes. A missed shot makes the clip "confidently wrong". The outcomes are mutually exclusive, and the flags under them overlap.
6. **What confirms a pocket now:** three things together. The tracker logs a pocket event for that ball, the ball's last spot was within 5.5 in of a pocket (or it was seen in the jaws), and the ball is gone from a still after-look. Yes, it can be evaluated on its own: the pocket oracle and the looser-rule test above do exactly that.
7. **Can this be added without restructuring?** Yes. It was added as options on the existing scorer, and the baseline is unchanged.

## Disclosures

- **A counting issue was found in the frozen baseline.** A ball that goes in just after its clip ends (Oct 16 shot033, the 7) is treated as already gone at the clip's last look. At that moment it is still visibly on the table. This made 1 wrong call and 1 named-but-gone count unfairly, both on development data. The baseline stays as frozen; this will be fixed in the next scored version.
- The freeze wording in the baseline report was corrected. It now calls the baseline the first finalised scoring run, and says one counting fix was made after a first look.

## D. First picture set to label (picked, nothing labelled)

The set has 185 pictures, in `chalkline-data/label-set-v1/` with `manifest.json`:
- 156 are app pictures from the 12 debug sessions on Oct 12 to 15 plus Oct 16. They include the 9 ft hall table, and they are spread over few, middle and many balls.
- 29 are full video frames from the end of each Oct 16 clip.

Each picture carries the app's own ball spots, to be checked and corrected, never trusted.

Only development footage is used, so the Oct 17 sessions and the recorder run stay fair test data. Note that the app pictures are crops of the table, not full frames.

## Where this points

1. **The eyes come first for real play, and they need two separate fixes:**
   - detection, for the far balls (a one-class ball detector);
   - naming, for dark balls read as the 2 on blue cloth (recogniser work).
   The labelled picture set serves both. It needs a person to label it, or a simple labelling page, which is not built.
2. **Pocket evidence comes next.** It decides the clean shots.
3. **Two smaller, separate items:**
   - the recorder should keep recording until the table is still;
   - rules version 2 should let a later still look close an "unconfirmed" ball. That is a rule change, so it would be a new version, scored from scratch.
4. **Shot timing** is what is left after all of that: 13 missed shots out of 78.
