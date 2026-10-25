#!/bin/bash
# run-threeball.sh <folder with the recorder's files (zips or joined video + meta)> <out dir>
# A Three-Ball Runout recording -> drill results: frozen detector-v1 (pocket/cushion boxes kept), Challenger B numbers +
# not-a-ball labels, the drill engine (src/drills/threeball.js) with the player's New attempt marks and corrections,
# and a picture of the table at every look for the review page.
# Needs: ffmpeg, node, a Python with ultralytics/torch/opencv (VENV), detector weights (DETW).
# Corrections (optional): <out dir>/corrections.json, [{ t, x, y, ball }] from the review page.
set -e
IN=$1; OUT=$2; R=$(cd "$(dirname "$0")/../.." && pwd)
VENV=${VENV:-/tmp/claude-0/-home-user-Chaulkline/e2aab88e-650e-5c9b-8cd7-b373619fcdb2/scratchpad/venv}
DETW=${DETW:-/mnt/project-files/chalkline-data/detector-v1/best.pt}
I=$R/benchmark/cycle4/tools/inputs
mkdir -p $OUT/unz $OUT/session $OUT/work $OUT/frames
for z in $IN/*.zip; do [ -e "$z" ] && unzip -oq "$z" -d $OUT/unz; done
cp -n $IN/*.json $IN/*.mp4* $OUT/unz/ 2>/dev/null || true
META=$(ls $OUT/unz/*-meta.json | head -1)
VID=$(python3 -c "import json;m=json.load(open('$META'));print(m['files'][0]['files'][0].get('video') or 'rack1.mp4')")
[ -s $OUT/unz/$VID ] || cat $OUT/unz/$VID.0* > $OUT/unz/$VID
ln -sf $OUT/unz/$VID $OUT/session/clip001.mp4
echo '{"app":"chalkline-recorder","clips":[{"name":"clip001","sec":"play","step":"drill"}]}' > $OUT/session/meta.json
# detector (slow: about 8 s of computing per second of video on this machine); reused when already there
if [ ! -s $OUT/work/det/clip001.json ]; then
  (cd $R/collab/recognition-package-2026-10-20/code && PATH=$VENV/bin:$PATH NODE_PATH=$R/node_modules node tools/clip-detect.js $OUT/session $OUT/work/det --detector $DETW --rejected --outline-check keep-first > $OUT/work/det.log 2>&1)
fi
W=$OUT/work
node $I/merge.js $W/det/clip001.json $W/det/clip001-rejected.json $W/clip001.json
(cd $R/benchmark/recognition-2026-10-20/local && NODE_PATH=$R/node_modules node radii.js $W $W/radii.json >/dev/null)
(cd $R/benchmark/rack-test-2026-10-21/tools && $VENV/bin/python prep_inputs.py $W/clip001.json $W/radii.json $OUT/session/clip001.mp4 $W/in >/dev/null)
$VENV/bin/python $I/edgenb.py $W/in/bnb/rack1.json $W/in/probs.npz $W/e.json
$VENV/bin/python $I/addnbB1.py $W/e.json $W/in/probs.npz $OUT/edge.json
# the player's New attempt taps (seconds from the start of the recording; one segment)
MARKS=$(python3 -c "import json;m=json.load(open('$META'));print(','.join(str(e[0]/1000) for g in m['segments'][:1] for e in g['events'] if e[2]=='new-attempt'))")
CORR=""; [ -s $OUT/corrections.json ] && CORR="--corrections $OUT/corrections.json"
node $R/src/drills/threeball.js $OUT/edge.json ${MARKS:+--marks $MARKS} $CORR --out $OUT/drill.json
cp $META $OUT/meta.json
# one picture per look (setup and after each shot), 960 px wide
python3 - "$OUT" <<'PY'
import json, subprocess, sys, os
out = sys.argv[1]; d = json.load(open(os.path.join(out, 'drill.json')))
ts = {a['setup']['t'] for a in d['attempts']} | {s['look']['to'] for a in d['attempts'] for s in a['shots'] if s.get('look')}
for t in sorted(ts):
    f = os.path.join(out, 'frames', 't%07.2f.jpg' % t)
    if not os.path.exists(f):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(max(0, t - 0.05)), '-i', os.path.join(out, 'session', 'clip001.mp4'), '-frames:v', '1', '-vf', 'scale=960:-1', '-q:v', '5', f], check=True)
print('frames', len(ts))
PY
echo "done: $OUT/drill.json"
