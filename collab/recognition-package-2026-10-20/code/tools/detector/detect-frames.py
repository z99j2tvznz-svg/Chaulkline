"""detector-v1 on every extracted frame of one clip, for tools/clip-detect.js --detector (the v0.4 baseline).

   python3 tools/detector/detect-frames.py <weights best.pt> <frames folder> <out.json>

Frozen settings, the same as the detector-v1 experiment (docs/detector-v1-2026-10-18): whole 1280x720 frame,
imgsz 1280, iou 0.5, max 100 boxes, CPU; kept boxes have confidence >= 0.35 (the frozen threshold).
Writes [[ [cx, cy, r, conf], ... ] per frame in file order], in frame pixels; r = (box width + height) / 4.
"""
import json, os, sys, hashlib
from ultralytics import YOLO

WEIGHTS_SHA = '16601d820ca7'   # detector-v1 best.pt, sha256 first 12
CONF, IMGSZ, IOU, MAXDET = 0.35, 1280, 0.5, 100

weights, frames, out = sys.argv[1:4]
sha = hashlib.sha256(open(weights, 'rb').read()).hexdigest()[:12]
if sha != WEIGHTS_SHA: sys.exit(f'weights {sha} are not detector-v1 ({WEIGHTS_SHA})')
m = YOLO(weights)
files = sorted(f for f in os.listdir(frames) if f.endswith('.jpg'))
res = []
for i in range(0, len(files), 16):
    for r in m.predict([os.path.join(frames, f) for f in files[i:i + 16]], imgsz=IMGSZ, conf=CONF, iou=IOU, max_det=MAXDET, device='cpu', verbose=False):
        res.append([[round((b[0] + b[2]) / 2, 1), round((b[1] + b[3]) / 2, 1), round((b[2] - b[0] + b[3] - b[1]) / 4, 1), round(c, 3)]
                    for b, c in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist())])
json.dump(res, open(out, 'w'))
