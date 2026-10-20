# Colour-and-stripe measurement check (Oct 20, 2026)

**Result: it depends on the pair.**
- **Dark balls work well.** Simple colour measurements tell the dark balls apart reliably at every camera spot, scored on sessions they never saw:
  - 8 vs 2: right on 32 of 34, with no confident errors
  - 7 vs 4: right on 30 of 32, with no confident errors
  - 5 vs 3: right on 26 of 29, with no confident errors
  - On the same balls the reader was confidently wrong 3, 1 and 1 times.
- **9 vs cue does not work from one still picture.** At the far spot and on Oct 19 the yellow band faces away and the 9 looks white in the reader's picture, so that information really is missing there.
- **Lighting is not a cloth-only problem.**
  - The cloth hypothesis is confirmed for the "not a ball" decision: put the normal cloth colour back around the light-step balls and the frozen reader stops rejecting them (35 of 48 → 0).
  - But the numbers it then gives are mostly wrong. So lighting breaks the reader's colour judgement too, not just the cloth.
- **Overconfidence can be cut without new errors.** Making the reader "unsure" only when a held-out measurement is sure of the other ball turned 6 of its 13 confident wrong reads into "unsure". The cost was 2 of 148 right reads, and there were no new confident errors.

Nothing in the reader, tracker v0.6 or the app changed. Nothing is promoted. Confirmed = measured; Likely = reasoned; Unknown = not measurable here.

## How it was done
- **Pictures:**
  - The exact 24 × 24 reader pictures (`tools/experiments/reader-input.js`) of every spot in your 14 calibration pictures and the 14 labels-v1 Oct 16 pictures.
  - That is 186 verified balls across 6 sessions and camera spots, plus 48 light-step spots.
  - The light steps (clips 12, 13, 14) are reported apart, because their identities are only my eye read.
- **Measurements:** a few fixed measurements of the middle of the ball, chosen before scoring (code `tools/experiments/colour-stripe.py`):
  - share of the ball unlike the cloth ("ballness")
  - white share
  - share of strongly coloured pixels
  - colour (hue)
  - how blue the non-white part of the ball is
  - Each pair uses one measurement: 9 vs cue uses the coloured share, 8 vs 2 and 7 vs 4 use blueness, and 5 vs 3 uses hue.
- **No tuning on the test:**
  - For each session, the cut-offs come from all the other sessions only.
  - Values between or inside the overlap of the training classes are "can't tell".
  - Ball vs not-a-ball uses a fixed rule set before looking: over half the ball unlike the cloth = ball, under a quarter = not a ball. The pictures contain no verified empty spots to learn from.
- **Views:** each ball is classed as a clean single ball, another ball in the square, or touching/overlapping. This uses the distance to the nearest labelled ball.
- **Reader check:** a Python copy of the frozen reader matches the app to 0.000004 (Confirmed).
- **A tried and rejected variant:** white-balancing each picture on its cloth colour made every pair worse. The numbers below are for colours as captured.

## Results by pair (held-out session, verified balls only)

| Pair | Balls | Measurement right | Confidently wrong | Can't tell | Reader right | Reader confidently wrong | Reader unsure |
|---|---|---|---|---|---|---|---|
| 8 vs 2 | 34 | **32** | **0** | 2 | 28 | 3 | 3 |
| 7 vs 4 | 32 | **30** | **0** | 2 | 25 | 1 | 6 |
| 5 vs 3 | 29 | 26 | **0** | 3 | 28 | 1 | 0 |
| 9 vs cue | 52 | 23 | 2 | 27 | 42 | 8 | 2 |
| Real ball vs not a ball | 186 | 186 | 0 | 0 | 175 | 7 | 4 |

"Given the ball is one of these two, which is it?" These measurements do not name balls in general.

**By camera spot** (full split in `colour-stripe-2026-10-20/results.json`):
- **8 vs 2:**
  - Right at every spot. That includes all 6 at the other side, where the reader reads the 8 as the 2 at 0.99 three times.
  - Far spot 4 of 5, one "can't tell".
- **7 vs 4:**
  - Right at Oct 16, Oct 17 recorder, Oct 18 and Oct 19.
  - Other side 5 of 6. Far spot 1 of 2 (only 2 examples there).
  - It catches the Oct 19 purple 4 that the reader called the 7 at 0.96.
- **5 vs 3:**
  - Right everywhere except 1 "can't tell" at the far spot and 2 on Oct 19.
  - The far-spot 5 that the reader called the 3 at 1.00 is one of the "can't tell".
- **9 vs cue:**
  - Neither reliable nor safe.
  - On Oct 18 the band shows and the 9 is caught, but the cue there picks up a blue tint from the cloth and is then called the 9 (2 confident errors).
  - At the far spot and on Oct 19 the band is out of view (sheet `9-vs-cue-misses.png`). The measurement says "can't tell", where the reader says "cue" at 0.90-1.00.
- **Correction to the earlier audit:** on Oct 19 the 9's band is mostly hidden too, not only at the far spot.

## Clean versus touching or overlapping balls (Confirmed, small numbers)

| View | Sure reads by the reader | Of which wrong |
|---|---|---|
| Clean single ball | 152 | 9 (6%) |
| Another ball in the square | 4 | 1 |
| Touching or overlapping | 5 | 3 (60%) |

- All 3 touching errors are at the far spot: the 9 against a dark ball, read as the cue at 0.90-0.94.
- The measurement said "can't tell" on all three.
- Only 9 verified balls were touching, so this needs more examples before it means much. But crops with a second ball in them are where the reader is most often sure and wrong.

## Is the reader leaning on the cloth? (probe on the frozen reader, not a fix)

| Pictures | Real balls | Rejected as not a ball (as captured) | Rejected, cloth replaced | Confidently wrong as captured | Confidently wrong, cloth replaced |
|---|---|---|---|---|---|
| Light steps 12-14 (by eye) | 48 | 35 | **0** | Unknown | at least 5 (see below) |
| Far spot | 34 | 7 | 4 | 5 | 8 |
| Other side | 27 | 0 | 0 | 3 | 4 |
| Oct 18 / Oct 19 | 19 / 19 | 0 / 0 | 0 / 0 | 2 / 3 | 3 / 3 |
| Oct 16 | 71 | 2 | 2 | 0 | 0 |

- "Cloth replaced" means the cloth pixels around the ball were set to the Oct 16 cloth colour, and the ball itself was left alone.
- **Confirmed:** the "not a ball" decision is driven by the cloth colour around the ball. That is why it rejects whole tables under changed light.
- **But it is not only the cloth:**
  - After the swap, light step 13 names six balls as the 8 at 0.91-1.00, and there is only one 8 (sheet `light-steps-cloth-replaced.png`).
  - In normal light, the swap also adds confident errors at the far spot and other side.
  - So the reader's number guesses also lean on the surroundings and on the overall colour cast.
- **The simple ballness measurement** called all 48 light-step balls and all 186 verified balls "ball". It could not be scored on non-balls (Unknown), because there are no verified empty spots.

## Can the reader's overconfidence be reduced without new confident errors?
Rule tested: a sure reader answer (≥0.6, not rejected) becomes "unsure" when the held-out measurement for that pair is sure of the other ball. It can only lower confidence, never name a ball.

| | Sure right | Sure wrong |
|---|---|---|
| Reader as it is | 148 | 13 |
| With the check | 146 (2 made unsure) | **7** (6 made unsure) |

- **New confident errors:** 0, by construction (Confirmed).
- **8 vs 2 and 7 vs 4:** 4 errors made unsure (the three 8 → 2 at the other side, and the 4 → 7 on Oct 19), with nothing lost.
- **9 vs cue:** 2 errors made unsure, but it also made 2 right cue reads unsure (Oct 18 tint). Leaving 9 vs cue out would be a choice made after seeing these results, so it is not counted as a result.
- **Still sure and wrong:** six cases of the 9 read as the cue with its band hidden, and one far-spot 5 → 3.
- **Ball level only.** Whether this changes ending tables is not measured yet.

## Do the measurements generalise?
- **Across camera spots:** yes for the dark pairs and 5 vs 3, Confirmed on held-out sessions. The far spot has few examples (2-6 per pair), so its numbers are thin.
- **Across lighting:** Unknown on verified data. The light steps have no verified identities.
  - Normal-cloth colours carried over between sessions and spots without white balancing.
  - The light-step pictures show a strong colour cast (grey-green and dark teal cloth). It is Likely that the colour cut-offs would need checking in each light.

## Smallest practical next step (needs your approval)
**Offline end-table test of the "make unsure" check for 8 vs 2 and 7 vs 4.**
- **Setup:** apply the two dark-colour checks to the frozen detections. They can only lower a read's confidence, never name a ball. Score all sessions with the standard measures:
  - ending table right with no correction
  - complete racks
  - confidently wrong decisions
  - the alternate 30 fps pick
- **Checks:** cut-offs held out by session as here, and v0.6 untouched.
- **Why:** this is the cheapest way to learn whether removing the reader's dark-colour overconfidence moves the product measures, or only ball counts.
- **Treat it as a test only:** the two checks are a measuring stick, not the start of a rule collection.

**What the evidence says comes after, and needs "build it":**
- The reader itself has to stop using the cloth colour and the colour cast. Two ways would make that happen:
  - Retrain it on the detector's crops with cloth-colour and lighting variety.
  - Add stripe classes for 10-ball and 8-ball.
- The 9 vs cue problem needs evidence from more than one still frame, for example frames while the ball rolls, when the band comes into view. A single settled picture often does not contain the answer.
