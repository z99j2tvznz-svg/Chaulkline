# v0.4 baseline: detector-v1 swapped in (Oct 19, 2026)

**What changed:** only the ball finder. `tools/clip-detect.js --detector` uses detector-v1 instead of the app's old finder:
- weights sha 16601d820ca7;
- threshold 0.35;
- whole 1280x720 frame, imgsz 1280.

Code 67a7cc4. Everything after the finder is unchanged: table outline, number reader, tracker, pocket rules, memory, scorer and truth files.

The only compatibility rules are the two table checks the old finder applies to every spot it reports. A box is dropped if it is:
- in a pocket opening;
- centred on a cushion line.

The run was done once, with no tuning afterwards. Raw outputs are in `baseline-v0.4-2026-10-19/`.

**What it is compared with:** a fresh rerun of the old finder (v0.3) on the same frames with the same code.

The frozen v0.3 numbers do not reproduce exactly. On the first spot, the frozen run had 15 confidently wrong and 5 missed shots; the rerun has 13 and 3. The other three sessions match. Tiny frame-decoding differences flip shot timing on a few clips. **So a difference of 1 or 2 clips is within run-to-run noise.**

## End to end (continuous, no help)

Each cell reads v0.3 rerun → v0.4.

| | First spot (26) | Other side (9) | Recorder shots (18) | **Held-out total (53)** | Oct 16, development (24) |
|---|---|---|---|---|---|
| Correct automatically | 0 → 0 | 0 → 0 | 4 → 5 | **4 → 5** | 0 → 0 (re-anchored 3 → 7) |
| Unresolved | 13 → 14 | 3 → 3 | 10 → 11 | 26 → 28 | 11 → 19 |
| Confidently wrong | 13 → 12 | 6 → 6 | 4 → 2 | **23 → 20** | **13 → 5** |
| Real shots missed | 3 → 3 | 1 → 0 | 3 → 1 | 7 → 4 | 4 → 2 |
| False shots | 1 → 2 | 2 → 2 | 1 → 2 | 4 → 6 | 2 → 2 |
| Phantom pockets | 1 → 1 | 0 → 0 | 1 → 1 | 2 → 2 | 2 → 0 |
| Made balls left unresolved | 9 → 10 | 5 → 5 | 16 → 15 | 30 → 30 | 10 → 13 |
| Memory confidently wrong | 8 → 8 | 9 → 8 | n/a | 17 → 16 | **8 → 0** |
| Ball on table, not named | 91 → 83 | 26 → 21 | n/a | 117 → 104 | 19 → 8 |
| Named, but gone | 10 → 10 | 10 → 9 | n/a | 20 → 19 | **11 → 1** |
| Corrections to settle | 28 → 29 | 14 → 15 | 16 → 15 | 58 → 59 | 25 → 21 |

Rack completion and integrity stay at 0 for both versions, on every real-play rack (first spot 2 racks, other side 1, Oct 16 2). In the recorder, each clip counts as a rack: 4 → 5 completed, and 29 → 30 with no confidently wrong result.

**Recorder no-shot clips (16):** false shots went from 1 to 2.

**Re-anchored runs:** for the held-out sessions they give the same numbers as continuous, except for corrections.

## Perception at the clip's final look (count-based; the truth has no ball positions)

- **First spot: the detector sees the far balls now (likely).**
  - At the 27 final looks there are 152 balls on the table. The detector keeps 159 spots in the last frames, against 235 noisy spots from the old finder.
  - But only 69 balls are named right, against 61 before.
  - "Not detected at least" went from 49 to 40. That count comes after the tracker's naming filters, so it understates detection.
  - **At the first spot the limit is now naming the small far balls, not finding them.**
- **The reader rejected detector spots as "not a ball":**

  | Session | Rejected |
  |---|---|
  | First spot | 14% |
  | Other side | 1.6% |
  | Oct 16 | 1.6% |
  | Recorder | 33% (mostly hands and things off the layout; the recorder layouts have few balls) |

  These spots stay out of play under the current rules, as asked. Nothing downstream changed.
- **Spots dropped by the table checks:**

  | Session | Dropped on a cushion line |
  |---|---|
  | First spot | 5% |
  | Other side | 9% |
  | Recorder | 20% |
  | Oct 16 | about 0% |

  The dropped boxes were not checked by eye.

## Traced changes on held-out clips

Most flips are shot timing, the noisy part.

| | Clips |
|---|---|
| New false shots | first spot shot002, other side shot001, recorder clip018 |
| Newly missed shot | first spot shot011 |
| Missed shots now found | first spot shot014 and shot016, other side shot006, recorder clip028 and clip048 |
| Fixed identity error | first spot shot024 (the 4 was "seen" after it went) |
| New identity error | first spot shot027 (2 "seen" after it went) |
| Changed phantom pocket | first spot shot028 (cue → 4) |

- **shot027 is a reader misread, not the detector.** The same spot is read as the 2 in both versions.
- **shot028 comes from pocket evidence:** the 4 is in neither version's final look.
- **No case found where the better detector turned an unresolved ball into a confident wrong one.**

## Verdict (per ChatGPT's section 10)

**Detection improved, but held-out play barely changed.**
- Confidently wrong went from 23 to 20 of 53, which is close to noise.
- Oct 16 improved strongly: wrong 13 → 5, memory errors 8 → 0. But Oct 16 is development footage, from the same camera spot the detector was checked on.

The bottlenecks are now downstream:
1. Naming small, far balls (the first spot).
2. Pocket evidence: 30 made balls are still unresolved.
3. Shot timing, which also causes most of the run-to-run noise.

Not done: anything in the live app.
