#!/bin/bash
# runrack.sh <rN> <rackN> : edge input -> Cycle 4 (racks.py) and Cycle 3 (rack.js defaults, same probe) -> eval
set -e
S=/tmp/claude-0/-home-user-Chaulkline/e2aab88e-650e-5c9b-8cd7-b373619fcdb2/scratchpad; r=$1; k=$2
B=/home/user/Chaulkline/benchmark; I=$B/cycle4/tools/inputs; V=$S/val/$r/session; W=$S/val/$r/work; O=$S/val/$r/out
T=$B/validation-2026-10-22/truth
mkdir -p $W $O
node $I/merge.js $S/val/$r/det/clip001.json $S/val/$r/det/clip001-rejected.json $W/clip001.json
(cd $B/recognition-2026-10-20/local && NODE_PATH=/home/user/Chaulkline/node_modules node radii.js $W $W/radii.json >/dev/null)
(cd $B/rack-test-2026-10-21/tools && $S/venv/bin/python prep_inputs.py $W/clip001.json $W/radii.json $V/clip001.mp4 $W/in >/dev/null)
$S/venv/bin/python $I/edgenb.py $W/in/bnb/rack1.json $W/in/probs.npz $W/e.json
$S/venv/bin/python $I/addnbB1.py $W/e.json $W/in/probs.npz $O/edge.json
OPTS=$(cat $B/cycle4/results/cycle4-rack-options.json)
$S/venv/bin/python $B/cycle4/tools/racks.py $O/edge.json $V/clip001.mp4 $O/c4 --opts "$OPTS" > $O/c4-racks.txt
PR=$(python3 -c "import json;r=json.load(open('$O/c4/racks.json'))['racks'][0]['rackLookProbe'];print(r['file'] if r else '')")
node $B/perception-cycle3/exp/tools/rack.js $O/edge.json ${PR:+--probe $PR} --out $O/log-cycle3.json > /dev/null
cp $O/c4/rack1-log.json $O/log-cycle4.json
for c in 3 4; do node $B/cycle4/tools/eval-rack.js $O/log-cycle$c.json $T/$k-events.json $T/$k-pockets.json > $O/eval-cycle$c.txt; done
echo "$r done"
