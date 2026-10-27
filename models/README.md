# Models used by V3

| File | What it is | Source |
|---|---|---|
| `detector-v1-960x544.onnx` (default), `-640x384`, `-1280x736` | Ball finder: one-class YOLO11n trained Oct 18, 2026 on the owner's labelled pictures | `collab/recognition-package-2026-10-20/03-reader-and-detector/detector-v1/best.onnx` (branch `chatgpt/fieldwork-photo-session-v01`), exported at 1280 x 1280 |
| `reader-v2.onnx` | Number reader: cue, 1-9, not a ball, on a 40 x 40 crop 3.2 ball radii wide; temperature 0.667 | `benchmark/recognition-2026-10-20/actions-results/run-39500020895/models/challenger_b.onnx` (same branch), the model used for the product-level scores |

The three finder files are the same weights at smaller input sizes. `tools/v3/resize_det.py` rewrites only the
size-dependent constants of the 1280 x 1280 graph (attention reshapes, head reshapes, anchors, strides) and checks the
anchor layout against the original. On the 14 player-verified frames from the held-out sessions
(`tests/fixtures/v3`, `tools/v3/ref_eval.py`), all sizes find the labelled balls:

| Size | Balls found (of 110) | Reader sure and right / wrong | CPU time, 14 frames |
|---|---|---|---|
| 1280 x 1280 (original) | 110 | 98 / 4 | 4.4 s |
| 1280 x 736 | 110 | 98 / 4 | 2.7 s |
| 960 x 544 | 110 | 99 / 3 | 2.0 s |
| 640 x 384 | 109 | 98 / 2 | 1.3 s |

The extra spots the finder reports on these frames (9 at 960 x 544) are all called "not a ball" by the reader.

Licence: detector-v1 was trained with Ultralytics YOLO (AGPL-3.0). Fine in this public repo; retrain on a permissively
licensed detector before any closed or paid release.
