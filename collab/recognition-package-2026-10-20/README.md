# Chalkline ball-recognition evaluation package (made 2026-10-20)

Everything needed to reproduce the current number reader's answers and the v0.6 product scores, and to test a different
recognition method against them. Nothing was retrained, no experiment was re-tuned, and v0.6 and the app are unchanged.
Nothing was filtered out: every labelled spot is included, whether the reader was right, wrong, unsure or said "not a ball".

Two checks were run on this package as packed (both passed):
- `03-reader-and-detector/reader/run_reader.py` reproduces the stored reader probabilities of all 3,524 exported
  pictures (largest difference 0.0001).
- `06-product-evaluation/run-v06-eval.sh` reproduces the published v0.6 scores exactly (`pm-v06.json`).

Footage is in separate archives (see "Footage" below).

## 1. Sessions and the train / test split

Keep session boundaries. A session is one camera spot and one lighting setup, so splitting by session is what tests
generalisation to unseen camera spots and light.

| Session folder | What it is | Camera | Use |
|---|---|---|---|
| 2026-10-12_1819_V2.0 … 2026-10-13_1735_V2.2 (5) | old app still pictures (before/after each shot) | home 7 ft, one spot per session | **reader training data** (in-sample) |
| 2026-10-13_1835_V2.2 | old app, pool hall 9 ft, other cloth and ball set | hall | **reader training data** (in-sample) |
| 2026-10-14_* … 2026-10-15_2107_V2.3.2 (7) | old app still pictures | home 7 ft (Oct 14 ultra-wide lens, blurry) | train/dev (reader never saw them; detector-v1 trained on Oct 12-15 labels) |
| 2026-10-16_evening_V2.3.3 | old app video clips | close side | train/dev (detector checking split; used in all reports) |
| 2026-10-17_1500_V2.3.3_otherside | old app video clips | other long side | **held-out test** |
| 2026-10-17_2151_V2.3.3_firstspot | old app video clips | far spot, small balls (10-12 px radius) | **held-out test** |
| rec-20261017-1730 | test recorder (R0.x), 720p | recorder spot; clips 12-14 = deliberate light changes | **held-out test** |
| rec-20261018-2310 | test recorder, "evening check" | recorder spot | **held-out test** |
| rec-20261019-1710 | test recorder R0.6, one shot per clip | low side view | **held-out test** |

Notes:
- The held-out sessions were never used to train anything. The calibration experiment (05) did fit a small correction on
  1-6 labelled pictures inside some of them and scored only on that session's other clips; the frozen reader never saw them.
- Old-app session details: `00-sessions/old-app-sessions.csv`.

## 2. Folder structure

```
00-sessions/                session list (old app), upload notes
01-images/
  reader-inputs/            THE EXACT READER PICTURES (3,524), from the frozen frames and detections
    input-24x24/*.png         what the reader actually receives (24 x 24 RGB)
    crop-before-resize/*.png  the same square cut from the 1280x720 frame before resizing (3.2 ball radii wide)
    index.csv                 one row per picture: session, split, clip, frame, time, spot, pixel and table position,
                              truth + its status, solid/stripe, reader's 11 probabilities, ball radius
  labelled-frames-1280x720/ the full frames those labelled pictures come from (50 frames)
  label-set-v1-pictures/    the 185 pictures of the frozen label set (old app crops + Oct 16 full frames)
  reader-training-library-64/  the reader's original training crops (2,277, 64 x 64), rebuilt from the old session
                              pictures with the original crop rule (library/build.py); labels in manifest.csv
02-ground-truth/
  player-verified/          labelled by Nackers (the player). This is the scored data.
    all-verified-ball-labels.csv   every verified ball (and verified non-ball) in one table
    label-set-v1/           frozen labels-v1 (sha256 prefix 37c308170514), raw per-picture records, quality report
    calibration-labels-2026-10-20/  14 verified frames from the held-out sessions (+ the frames, + the page's app
                            pre-fill, which is NOT truth)
    shot-outcomes/          per-clip truth: real shot or not, balls made, scratch, first ball hit, layouts / racks,
                            and a "verify" field saying how each fact was checked
  inferred-or-unverified/   NOT for scoring
    reader-training-library/manifest.csv   labels of the training crops (see section 4)
    old-app-session-labels/ what the old app itself logged per shot (its own guesses + in-app taps)
03-reader-and-detector/
  reader/recog.json         frozen reader weights (the file the app ships)
  reader/vision.js          app source: recogRun() (line ~693) = the reader; recogTop(); detection code
  reader/run_reader.py      Python copy of the reader; re-runs it on every 24 x 24 picture and checks the stored numbers
  reader/training-code-oct13/  original training scripts (train2.py, export_mlp.py, train_r6.py, build.py, ...) and
                            mlp24.json (an earlier 5-session export, NOT the shipped weights)
  detector-v1/              one-class YOLO11n ball finder: best.onnx, best.pt, args.yaml, results.csv, training log,
                            scripts/, report/
04-detections/
  v0.6-scoring-set/         frozen per-frame detections used for every v0.6 score and every reader experiment:
                            v04-oct16, v04-firstspot, v04-otherside (old-app sessions) and the 3 recorder sessions
                            (outline-corrected "keep-first" set)
  detections-v03rerun-v04.tgz   the v0.3 / v0.4 baseline detection sets
  alternate-sampling/       same detector at 60 fps, and 30 fps even/odd and 15 fps subsamples (regression sets)
  shot-record-evidence/     manifests describing the detection fields
05-experiments/             each with report.md, raw results and data
  reader-input-audit-2026-10-20/   what the reader actually sees; examples.json; contact sheets
  calibration-2026-10-20/   per-table last-layer calibration (not promoted): setup, per-run results, looks
  colour-stripe-2026-10-20/ fixed colour / stripe measurements: spots.json (the 234 scored spots), results.json
  rest-naming-2026-10-20/   still-table naming diagnostic (json)
  identity-continuity-2026-10-20/  would memory of earlier identities help (no)
  frame-rate-2026-10-20/    15 / 30 / 60 fps test
  detector-v1-2026-10-18/   detector and reader accuracy on labels-v1
06-product-evaluation/
  run-v06-eval.sh           re-score v0.6 (section 6)
  baselines/                v0.6, v0.5, v0.4, original baseline, absence rule, one-shot clips, old app vs new: reports + raw json
code/                       the repository at commit in code/COMMIT.txt (v0.6 tracker + all experiment tools)
```

## 3. Labels: what counts as truth

| Source | Who checked it | Status | Scored? |
|---|---|---|---|
| labels-v1 (185 pictures, 860 balls, 172 deleted app guesses) | Nackers, every picture | player-verified | yes |
| calibration labels (14 frames, 117 balls) | Nackers, every frame | player-verified | yes |
| shot outcomes, Oct 16 and Oct 17 old-app sessions | watched clip by clip | verified (see each "verify" field) | yes |
| shot outcomes, recorder sessions | the player's tap answers per clip; layouts mostly not recorded | partly verified ("verify" field says which) | yes, as in all reports |
| light-step pictures, rec-20261017-1730 clips 12-14 (720 pictures) | identities by eye only | UNVERIFIED | no; reported apart |
| reader-training library (2,277 crops) | the app's own number, checked by eye on contact sheets by the assistant (Claude), not by the player; "sure" = drill ring ball | inferred | no |
| old app session labels.json | the app's own guesses | unverified | no |

- `number` blank with `number_known = 0` means the player marked a ball but could not read its number (includes balls
  10-15 in the 16-ball spread, rec-20261017-1730 clip008). These are verified balls with unknown identity.
- Verified non-balls: the 172 app guesses the player deleted in labels-v1 (`entry` column of `all-verified-ball-labels.csv`).
  The calibration frames have no deleted guesses; no verified empty-cloth spots exist in the video frames.
- Solid / stripe: 9-ball set only. Cue = white, 1-8 solid, 9 = the only stripe. No stripe classes 10-15 were labelled.
- In `01-images/reader-inputs/index.csv`, truth comes from those labels: a detection spot gets a label's identity when it
  is within 10 px of the labelled ball in the labelled frame, and the same spot is followed (within 6 px) through the
  clip's last 15 frames, where the table is still. `frame_used_in_experiments = 1` marks the one frame per ball that the
  colour-stripe and calibration experiments scored; the other 14 frames per ball are for multi-frame methods.
  Status values: player-verified; player-verified ball, number not verified; UNVERIFIED (light step).
- No label was ever made from the reader's own answers.

## 4. The current reader

- Model: one hidden-layer network. Input = the 24 x 24 RGB picture (1,728 values, 0-1) + 5 colour numbers of the middle
  12 x 12 (white share, dark share, mean colour of coloured pixels; see recogRun) = 1,733 inputs -> 64 ReLU -> 11 classes
  (cue, 1-9, not a ball), softmax. Weights int8 with one scale per column (`recog.json`).
- Crop at run time (`code/tools/experiments/reader-input.js`, same as the app and `code/tools/clip-detect.js`): ball radius
  in pixels from the table camera model at the spot's table position; square of 3.2 radii centred on the spot, cut from
  the 1280 x 720 frame, drawn on a black canvas and scaled to 24 x 24 by the browser canvas (bilinear).
- Training (Oct 13, `training-code-oct13/`): crops from the old app's still pictures (64 x 64, Lanczos), resized to 24 x 24
  (bilinear, Pillow), 4x augmentation (flip, brightness, small rotation with blue fill), scikit-learn MLPClassifier
  (64 hidden, alpha 1e-3, 400 iterations, seed 0); `export_mlp.py` folds the scaler into layer 1 and quantises.
  Trained on the 6 sessions of Oct 12-13 (5 home + hall). Leave-one-session-out on those: 96.5%.
  **Mismatch to note:** training pictures were old-app stills (different resolution and processing) while today it
  reads 720p video frames.
- Confidence and rejection rules (no separate calibration):
  - per frame: "not a ball" when the not-a-ball probability is 0.5 or more; the number is the best of classes 0-9.
  - still-table naming (`code/tools/reconcile.js`, `observe`, OBS settings): spots grouped within 1.5 in; a group must be
    seen in half the frames and average not-a-ball under 0.5; a frame votes only with p >= 0.6 and not-a-ball < 0.5;
    named when the top vote total is >= 2 and at least twice the runner-up; each number at most once (higher total keeps it).
  - tracker votes (`code/tools/tracker.js`, around lines 160-290): same thresholds, plus a strong contradicting read
    (p >= 0.8) blocks a relink.
- Detector (finds the spots, not numbers): detector-v1, YOLO11n, trained on labels-v1 Oct 12-15 crops
  (`03-reader-and-detector/detector-v1/report/README.md`).

### Reproducing the reader's answers
1. Fast: `cd 03-reader-and-detector/reader && python3 run_reader.py` (numpy, Pillow). Prints the largest difference
   to the stored probabilities.
2. From video: `node code/tools/experiments/reader-input.js <list.json> <out.json>` with entries
   `{id, dets, video, clip, frame, spot}` (dets = a folder in `04-detections/v0.6-scoring-set`, video from the footage
   archives). Gives the crop, the 24 x 24 input and the probabilities. Needs Node 22, Playwright 1.56 with Chromium,
   ffmpeg; run `npm install` inside `code/` first. Frames are extracted with
   `ffmpeg -i clip.mp4 -vf fps=30,scale=1280:720`, and frame k is the (k+1)-th picture.
3. Whole detection set: `node code/tools/clip-detect.js <session> <out> --detector <best.pt>` (also needs Python with
   ultralytics 8.4.182 for the detector). Each detection JSON is
   `{fps, quadN (table corners, 0-1 of frame), frames: [{t, balls: [{x, y (table inches), px, py (1280x720 pixels),
   c (detector confidence), rec (reader's number), p (its probability), nb (not-a-ball probability)}]}]}`.
   Only the top number is stored per frame, not all 11 probabilities (those are in index.csv for the labelled spots).

## 5. Experiments (05)
Each folder has the report as written at the time plus raw outputs. Scripts are in `code/tools/experiments/`
(`reader-input.js`, `reader-dump.js`, `recal*.py`, `reader-looks.js`, `colour-stripe.py`, `rest-naming.js`,
`identity-continuity.js`, `product-metrics.js`). Paths inside old setup files point at the machine they ran on;
map them to this package: `dets/v04-<session>` -> `04-detections/v0.6-scoring-set/v04-<session>`, `dets/rec-*` ->
`04-detections/v0.6-scoring-set/rec-*`, `vid/<session>/<clip>.mp4` -> the footage archives, `alt/d30b/<session>` ->
`04-detections/alternate-sampling/sampling-sets-15-30.tgz` (d30b). `colour-stripe.py prep` re-made the identical
234-spot list from these paths when this package was built.

## 6. Product-level evaluation
- Main measure: shots whose ending table is right with no correction. v0.6: **38 of 116** with each shot judged from
  the true start table; **27** played straight through (memory carried); confidently wrong shots 26; false pockets 2;
  made balls called "still on the table" 4; real shots missed 5; false shots 10; complete racks 0 of 5.
- Re-run: `sh 06-product-evaluation/run-v06-eval.sh` (Node only, about 10 s). The straight-through numbers come from
  `node code/tools/score-racks.js <dets> <truth> --track '{"version":"v0.6"}' --out r.json` (`continuous.totals`).
- Two modes: "checkpoint" (each shot starts from the true table, independent shots) and "continuous" (memory carried
  clip to clip, as a player gets it). Rules written before any run: `code/docs/baseline-rules.md`.
- To test a new reader: produce new per-frame detection files with your `rec`, `p`, `nb` (same format), then run the
  same script on them. Check small gains on the alternate 30 fps pick too (`alternate-sampling/`): +/-1-2 shots is
  sampling noise.
- Table inventories: start tables come from the truth files (racks/layouts, made balls); recorder sessions have no
  verified start layouts except where stated, so their start-table measures are mostly n/a.

## 7. Footage (separate archives)
- `chalkline-footage-old-app-oct12-17.zip`: the 16 old-app session folders: still pictures, log.txt, labels.json, and the
  Oct 16 / Oct 17 shot clips (`shotNNN.mp4`).
- `chalkline-footage-recorder-oct17.zip`, `chalkline-footage-recorder-oct18-19.zip`: the recorder uploads as received
  (`partNN.zip`, each holding `clipNNN.mp4`, motion files and meta.json).
Every clip is 720p from an iPhone in Safari; processing is at 30 fps.

## 8. Missing data and known limits
- Reader input pictures exist only for spots in labelled frames (+ the light steps). For any other spot, re-create them
  with reader-input.js from the footage.
- The calibration experiment's 64-unit hidden-layer dumps were not kept; `reader-dump.js` re-creates them.
- The original 64 x 64 training crops were not saved before; the ones here were rebuilt from the original pictures with
  the original crop rule, so they should match but were not byte-checked against the originals.
- The exact script for the shipped 6-session weights is `export_mlp.py` run on the full manifest (hall included);
  `mlp24.json` in the backup is an earlier export.
- No verified empty-cloth or hand spots in the video frames; no stripe balls 10-15 labelled; only 19 verified 1-balls.
- Recorder sessions: shot outcomes come from the player's taps; layouts largely not recorded.
- Light steps (clips 12-14): identities by eye only.
- One of 3,524 pictures (firstspot_shot012_2_f229) differs from the stored detection by just over the 0.015 rounding
  tolerance; the rest match exactly.
- Single table and ball set at home except the 2026-10-13 hall session; one phone model.
