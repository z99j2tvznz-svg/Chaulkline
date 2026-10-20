# Detector experiment v1 (Oct 18, 2026)

Scripts for the first one-class ball detector experiment. Report: `docs/detector-v1-2026-10-18/README.md`.
They were run from one working folder (paths inside point at it and at `/mnt/project-files/chalkline-data/`).

1. `convert.py` - labels-v1 circles to YOLO boxes (`ds/train`, `ds/ival` = Oct 15 2107, `ds/check`), plus box-check pictures.
2. Train: `YOLO('yolo11n.pt').train(data='ds/data.yaml', epochs=40, imgsz=1280, batch=8, workers=2, device='cpu', seed=0, deterministic=True)` (Ultralytics 8.4.182).
3. `node tools/finder-on-labels.js <sessions> <label-set-v1> old-finder.json` - the app's old finder and number reader on the same pictures.
4. `oldscore.py`, `newdet.py <weights> run` then `newdet.py score`, `recog.py`, `draw.py` - scoring (shared rules in `evalfind.py`).
