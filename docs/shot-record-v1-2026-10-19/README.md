# Shot Record v1 and diagnostic viewer (Oct 19, 2026)

The Oct 18 Evening check (rec-20261018-2310, low side camera, 20 analysed clips) as durable records plus a phone viewer.
No tracker decision, detector, physics or planner changed: the v0.4 scorer output is byte-identical with the trace on and
off, on all 5 scored sessions.

## What is where (paths relative to chalkline-data)

| Layer | Path | Rebuild |
|---|---|---|
| Original 60 fps videos (never touched) | `sessions/rec-20261018-2310/part01-05.zip` | the recorder's own exports |
| Raw evidence: 30 fps analysed-frame detections + manifest (sha256 of every file and of every video inside the zips) | `evidence/rec-20261018-2310/` (read-only) | `node tools/make-evidence.js <data> <session> --verify` checks it |
| Shot Records | `records/rec-20261018-2310/` | `node tools/make-records.js <data> rec-20261018-2310` |
| Viewer (disposable copy: small videos + data) | `viewer/rec-20261018-2310/` | `node tools/make-viewer.js <data> rec-20261018-2310 <out>` |

The viewer is published as a private Claude artifact: https://claude.ai/artifact/NpSRFP9ajC3C1DXj6upjph. To republish
after a rebuild, publish `<out>/index.html` with the `data/` and `video/` files to that same link.

## Record format

`src/record.js` (format `chalkline.record/1`) has the sections, the id scheme and the checker. One record per recorded clip,
because the play clips hold 2 to 4 shots each and the still-table looks are per clip.

## Results

- **Records:** all 20 clips have a record. The checker passes against the raw detections: every seen sample is the detection it names, and every not-seen sample is the last seen spot.
- **Record size:** 29 to 78 KB per clip, median 41 KB, 884 KB in total; 8 to 59 KB per shot.
- **Tracking coverage:** a seen sample on 46% of moving-ball frames overall (4,474 of 9,718).
  - Per clip: 15% to 100%.
  - Controlled steps: 34% to 100%.
  - Play clips: 15% to 95%.
- **Disagreements:** the player reported 30 balls in that Chalkline did not confirm, the same 30 the frozen scorer counts as unresolved. Stage hints:
  - tracking 12;
  - end state 8;
  - detection or identity 6;
  - identity 3;
  - pocket decision 1.
- **Events:**
  - 46 shot starts.
  - 35 first-hit guesses, all uncertain.
  - 12 pocket calls: 1 supported, 11 uncertain.
  - 26 vanished balls, all unsupported, none counted in.
  - 1 pocket call withdrawn.
  - 1 not-a-shot.

## Limits

- **Camera calibration:** the table-to-camera map is refitted from the clip's own spots, so its 0.03 px error shows the map is consistent with itself, not that the camera is calibrated. Position resolution is 0.12 to 0.34 inches per pixel, from the near rail to the far rail. Clip 022 reaches 1.44, because of a spot off the playing surface.
- **Viewer timing:** the viewer videos take the same 30 fps frames as the analysis, so video frame n is analysed frame n. The re-encode has 600 frames where the analysis has 601, so the last frame can be off by one.
- **Collisions** are not analysed. The first hit is the tracker's approximation and is marked uncertain.
