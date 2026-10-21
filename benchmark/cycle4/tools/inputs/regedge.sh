#!/bin/bash
# regedge.sh <session> <clip> <video dir>: kept + rejected boxes -> B-labelled edge input in c4/edets/frozen30/<session>/<clip>.json
S=/tmp/claude-0/-home-user-Chaulkline/e2aab88e-650e-5c9b-8cd7-b373619fcdb2/scratchpad; s=$1; c=$2; V=$3
W=$S/c4/ework/$s/$c; O=$S/c4/edets/frozen30/$s; mkdir -p $W $O
node $S/c4/merge.js $S/c4/rej/$s/$c.json $S/c4/rej/$s/$c-rejected.json $W/$c.json || exit 1
(cd /home/user/Chaulkline/benchmark/recognition-2026-10-20/local && NODE_PATH=/home/user/Chaulkline/node_modules node radii.js $W $W/radii.json >/dev/null) || exit 1
(cd /home/user/Chaulkline/benchmark/rack-test-2026-10-21/tools && $S/venv/bin/python prep_inputs.py $W/$c.json $W/radii.json $V/$c.mp4 $W/in >/dev/null) || exit 1
$S/venv/bin/python $S/c4/edgenb.py $W/in/bnb/rack1.json $W/in/probs.npz $W/e.json && $S/venv/bin/python $S/c4/addnbB1.py $W/e.json $W/in/probs.npz $O/$c.json && rm -rf $W
