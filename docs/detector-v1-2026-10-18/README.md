# First ball detector experiment and number-reader check (Oct 18, 2026)

This is the experiment ChatGPT and Nackers approved after labels-v1. **Nothing was plugged into the app or the baseline.** All results are on development pictures:
- the 53-picture checking split (Oct 16 plus the 9 ft hall session);
- the Oct 17 sessions and the recorder clips were not touched.

Full tables are in `detector-v1-2026-10-18/`, and the weights are in `chalkline-data/detector-v1/`. The code is `tools/detector/` and `tools/finder-on-labels.js` on branch `claude/project-thread-9vpr76`.

## The short answer

- **Confirmed, on development pictures:** the new detector beats the old finder on every count that matters.
  - On table crops it found 99% of balls (old finder 88%), and 99% of far balls (old finder 85%).
  - It made 1 false ball in 24 pictures (old finder 10).
  - On full frames it found all 153 balls with no false balls, without being told where the table is. The old finder found 95% with 11 false balls, and it needs the table outline first.
- **Confirmed:** the result barely depends on the threshold. Anything from 0.25 to 0.7 gives almost the same numbers.
- **Likely, and the big caveat:** on these still pictures the old finder was already fairly good (88 to 95%). The worst real-play misses came from the Oct 17 first spot and from frames during play, which this set does not cover. So the gain on real play is still **unknown** until it is scored on the held-out sessions.
- **Confirmed:** the number reader on your verified balls is right 92% of the time on sessions it never trained on.
  - Its main mistakes are the 9 read as the cue ball (13 times) and the 4 read as the 7 or the 8 (9 times).
  - The "7 or 8 read as the 2" problem from the diagnostics hardly shows here (1 case).
- **Recommendation: integrate as a new scored version, but only after a "build it".** The detector would replace only the "where are the balls" step. Shot timing, pocket rules and memory would stay as they are, and the result would be scored from scratch on the held-out Oct 17 sessions and recorder clips. Naming stays with the current reader for now.

## 1. Old finder vs new detector, same pictures, same rule

The matching rule is the same for both finders:
- a find counts if its centre is within 0.6 of the ball's radius of the labelled centre (at least 5 px), the rule `tools/replay-pictures.js` uses;
- each ball and each find can be matched only once;
- balls marked "in a pocket" are left out of both counts. There are none in the checking split.

| Checking pictures | Finder | Found | Far found | False balls | Precision | False per picture | Centre error px (median) |
|---|---|---|---|---|---|---|---|
| A. Table crops (24) | old finder, baseline filter | 115/130 (88%) | 85% of 67 | 10 | 92% | 0.42 | 1.7 |
| | old finder, unfiltered | 116/130 (89%) | 87% | 41 | 74% | 1.71 | 1.7 |
| | **new detector** | **129/130 (99%)** | **99%** | **1** | **99%** | **0.04** | **0.6** |
| … Oct 16 crops (12) | old finder, baseline filter | 54/61 (89%) | 73% of 26 | 10 | 84% | 0.83 | 1.7 |
| | **new detector** | **61/61 (100%)** | **100%** | **0** | **100%** | **0** | 0.6 |
| … Hall crops (12, a table it never trained on) | old finder, baseline filter | 61/69 (88%) | 93% of 41 | 0 | 100% | 0 | 1.7 |
| | **new detector** | **68/69 (99%)** | **98%** | 1 | 99% | 0.08 | 0.7 |
| B. Full frames, Oct 16 (29) | old finder, baseline filter (given the table outline) | 145/153 (95%) | 92% of 98 | 11 | 93% | 0.38 | 1.4 |
| | **new detector, whole frame (no outline)** | **153/153 (100%)** | **100%** | **0** | **100%** | **0** | 1.0 |
| | new detector, inside the outline | 153/153 | 100% | 0 | 100% | 0 | 1.0 |

The baseline filter drops finds the number reader calls "not a ball", as the baseline did.

**A and B are separate tests.** A uses the app's table crops, which have been pasted back into the camera frame so the old finder sees them where it saw them. B uses whole video frames.
- **The old finder cannot run on a full frame without a table outline.** The Oct 16 log's saved outline is in the other orientation, 262 px off. So it was given the outline the baseline used (fitted from the app's own saved spots, 4.9 px median error).
- The new detector needed no outline. It also made no false balls outside the table: no people, cues or pockets were counted.

**For reference, the live guesses the app saved on the crops** (from your labelling, judged by keep or delete) found 90/130 balls with 41 false. The offline old finder does better on the same pictures than those live guesses.

**The centre error favours the old finder.** Your labels started from the app's own spots, so its centres were the starting point. Even so, the new detector is closer (0.6 px against 1.7 px).

## 2. Failure examples

- **The old finder** (`fail-old.png`):
  - it misses dark balls on the far rail (the 8 and the maroon 7);
  - it puts a second, off-centre find on a ball, which is counted as a false ball;
  - it misses balls at the near rail in the hall.
- **The new detector, at the chosen threshold, has 1 failure in 53 pictures.** It drew a box off-centre on a ball sitting in the far side pocket's jaws in the hall (hall shot007-before). That counts as one miss and one false ball.
- **At the lowest threshold** (0.1, not chosen; `fail-new-01.png`) a few extra false balls appear:
  - a knuckle;
  - something at the frame edge;
  - the empty side pocket;
  - two touching balls (the cue ball and the 8) drawn as one box.

  These are what to watch on real play.

## 3. The number reader on your verified balls

The reader was given the exact verified centre and size of each ball, so this measures naming only.

**Leakage check: the reader was trained on Oct 12 and Oct 13, the hall included.** Those results are in-sample and are shown apart.

| Group (clear balls) | Right |
|---|---|
| Never seen by the reader (Oct 14 to 16) | 465/504 (92%) |
| … Oct 16 crops / Oct 16 full frames | 58/58 (100%) / 138/146 (95%) |
| … Oct 14 to 15 | 269/300 (90%) |
| Trained on (Oct 12 to 13) | 281/296 (95%) |
| … hall only (trained on, still the worst) | 52/62 (84%): 7 read as 3 ×4, 8 read as 7 ×3, 5 read as 1 ×2 |
| Partly hidden | 25/28 (89%) |
| In a pocket | 7/16 (44%); 12 called "not a ball" |
| Small balls (radius under 11 px), unseen sessions | 79/94 (84%), against 96% for big ones |

**Confusion, unseen sessions.** Rows are the real number; only the mistakes are shown.

| Real | Right | Read as |
|---|---|---|
| cue | 104/104 | |
| 1 | 4/8 | 9 ×3, 5 ×1 |
| 2 | 18/20 | 8 ×2 |
| 3 | 22/23 | 7 |
| 4 | 21/30 | 7 ×5, 8 ×4 |
| 5 | 41/43 | 3 ×2 |
| 6 | 53/53 | |
| 7 | 60/63 | 3 ×2, 4 |
| 8 | 72/76 | 2, 3, 4, 7 |
| 9 | 70/84 | cue ×13 |

The full matrices are in `recog-score.md`.

**Policies:**
- The cue ball is a normal class.
- The 16 "can't tell" balls are left out of accuracy. The reader called them cue 8, 2 ×5, 3 ×2 and 8 ×1.
- The reader's own confidence helps a little: when it is at least 95% sure it is right 95% of the time, against 92% overall.

**The 1 is thin:** only 8 clear 1-balls in the unseen sessions.

## 4. The detector, recorded

| Item | Setting |
|---|---|
| Model | YOLO11n (Ultralytics 8.4.182), COCO-pretrained, one class "ball", 2.6 M parameters |
| Data | labels-v1 (sha 37c308170514). Boxes are built from your circles; the conversion was checked on pictures before training. |
| Training data | 120 crops (Oct 12 to 15) |
| Monitoring during training | 12 pictures from Oct 15 2107, a training-side session |
| Checking split during training | not seen |
| Settings | input 1280, batch 8, 40 rounds, seed 0, deterministic, CPU, default settings and augmentation (`args.yaml`) |
| Weights | best.pt (round 24) sha 16601d820ca7; ONNX sha 514a8ee8304d |
| Training time | 58 minutes on 4 CPU cores |
| Configurations tried | 1 smoke round (thrown away), then this one run. Nothing was re-tuned. |

**Threshold.** On the monitoring pictures, every threshold from 0.1 to 0.6 was perfect, so best-F1 could not pick one. The rule set before scoring the checking split was to take the middle of that range: **0.35**. The checking split was then scored once.

Disclosure: while testing the scoring code I ran it on the checking split with half-trained weights (round 4). Those numbers were thrown away.

**Size and speed:**
- 5.5 MB as PyTorch, 11 MB as ONNX (about half of that with 16-bit weights).
- On this server's CPU, about 160 ms per 1280 picture (4 threads), or 320 ms on 1 thread. A 1280×736 input instead of a square would likely be about 40% faster.
- **iPhone Safari: likely workable for still looks (before and after a shot), not for every video frame.** A rough guess is 0.3 to 1 s per look with onnxruntime-web, and it is untested on a phone. A native iPhone app (Core ML) would likely run it in a few tens of milliseconds.

## 5. Limits

- **These are development pictures.** The checking split was used once, but it shares the home table and the camera spot with training. Only the hall is a different table.
- **Stills of mostly still tables.** There are few people, little blur and no moving balls. The real-play misses in the baseline came from the Oct 17 first spot (far balls) and from live frames.
- **One labeller.** The labels started from the app's own spots.
- **The reader is scored only on clean, verified centres.** In the app it reads the finder's spots, so its real accuracy also depends on the finder.

## Where this points (needs "build it")

Score a **v0.4 baseline** that swaps in the new detector for finding balls. Everything else would stay frozen:
- the same reader, shot timing, pocket rules and memory;
- the same scorer on the held-out Oct 17 sessions and recorder clips;
- the old v0.3 run kept on record.

That shows whether better eyes on stills turn into fewer wrong calls on real play. The reader's 9-as-cue and 4-as-7/8 mistakes are a separate, later step.
