# Ball labels v1: quality check and frozen version (Oct 18, 2026)

Nackers reviewed all 185 pictures on the label page. This report covers the checks ChatGPT asked for before any training. The labels are now frozen as **labels-v1** (sha256 37c308170514):

- the combined file is `chalkline-data/label-set-v1/labels-v1.json`, with a copy at `data/labels/label-set-v1.json` in the repo;
- each picture's raw record is in `labels-v1-raw/`.

Any later fix to the labels becomes labels-v2.

## 1. Spot check by eye (likely clean)

I redrew the labels on 16 randomly picked pictures (12 table crops and 4 full frames) and checked each one by eye. I found no missed balls, no extra circles and no wrong numbers. The circles sit on the balls, and the "in a pocket" and "partly hidden" marks match what the pictures show.

This is one checker looking at small pictures, so it is labelled *likely*, not proven.

## 2. What is in the set

| | Count |
|---|---|
| Pictures | 185 (all marked done): 156 table crops, 29 full video frames |
| Balls marked | 860: 707 in crops, 153 in full frames |
| By number | cue 180 · 1: 13 · 2: 34 · 3: 48 · 4: 52 · 5: 70 · 6: 93 · 7: 105 · 8: 117 · 9: 132 · can't tell 16 |
| Partly hidden | 29 |
| In a pocket | 29 |
| Ball size in the pictures | 8 to 17 pixels across the radius (median 12) |

There are 12 pictures from each debug session (Oct 12 to 15) and 41 from Oct 16. The 9 ft hall table is one session of 12 pictures.

There are few 1-balls (13), because the 1 usually goes first. For checking the number reader, the 1 is thin. The 9 and the 8 are well covered.

## 3. How good the old app's guesses were

This covers the 156 table crops; the 29 full frames had no guesses.

| | Count |
|---|---|
| App guesses | 773 |
| Kept as a real ball | 601 |
| … left as they were | 26 |
| … nudged into place | 508 |
| … given a different number | 67 |
| Deleted as not a ball | 172 (22% of guesses) |
| Real balls the app missed (added by Nackers) | 106 of 707 (15%) |
| Number right on kept balls | 534 of 601 (89%) |

The most common number fixes were:

| App's number | Real number | Times |
|---|---|---|
| 7 | 4 | 7 |
| 3 | 8 | 5 |
| 2 | 5 | 4 |
| 4 | 8 | 4 |
| 8 | 7 | 4 |
| 9 | cue | 4 |

These are still pictures. The live video looks were worse in the baseline.

Most nudges are likely my own offset when I placed the guesses, not the app's.

## 4. Training and checking split

The split is by whole session, so similar neighbouring pictures never end up on both sides.

| | Sessions | Pictures | Balls | Far-side balls |
|---|---|---|---|---|
| Training | Oct 12 to 15, home table | 132 | 577 | 330 |
| Checking | Oct 16, plus the 9 ft hall session | 53 | 283 | 165 |

- **The hall session is in checking, not training.** So it tests whether the detector works on a table it never saw.
- **All 29 full frames are on the checking side.** They all come from Oct 16. The table crops cover the same table area, so training on crops and checking on full frames is a fair first test (likely).
- **The real test stays separate.** The Oct 17 sessions and the recorder clips are still held out, scored the old way against the truth files.

## 5. Far-side balls (enough for a first try)

"Far side" here means the top third of a crop, or the top 40% of a full frame.

- 495 of the 860 balls are on the far side.
- 177 of the 259 balls Nackers added were far balls. That matches the baseline finding that far balls get missed.
- The training side has 330 far balls.

## 6. Known limits (not blocking)

- **One reviewer.**
- **Repeated layouts.** Neighbouring pictures in a session often show the same layout, so 185 pictures are worth fewer than 185 independent examples.
- **Mostly crops.** The crops are only 170 to 330 pixels tall.
- **The "accepted when finishing" flag is unclear for 504 balls.** Those balls were also nudged, so the order of events is unclear. Only 25 app guesses were accepted with no individual action at all.

## Recommended first experiment (not started; needs "build it")

1. **Ball detector.** Fine-tune a small, already-trained one-class ball detector on the 132 training pictures. It only answers "is there a ball here", with no numbers. Score it on the 53 checking pictures for:
   - balls found;
   - false balls;
   - far-side balls found, scored separately;
   - centre error.

   Compare it with the old app's 85% found and 22% false on the same kind of picture.
2. **Number reader, scored separately.** Run the existing number reader on the verified ball spots and report a number-by-number confusion table. That tells us whether the dark-ball and blue-2 confusion is the main naming fault.
3. **Only if the detector clearly beats the old finder:** plug it into the frozen baseline as a new version. Score it on the held-out Oct 17 sessions with the same scorer, no rule changes and the old run kept on record.

Practical note: the Python package index is reachable from here and the machine has 4 CPU cores and no GPU. A small detector on 132 pictures should train on CPU (likely; not tried yet).
