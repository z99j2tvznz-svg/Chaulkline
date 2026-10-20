#!/bin/bash
# re-detect frozen clip sets at 60 fps with the frozen outlines; one output dir per session
cd /home/claude/Chaulkline
W=/mnt/project-files/chalkline-data/detector-v1/best.pt
F=/tmp/claude-0/fr; O=$F/d60; mkdir -p $O
rec() { # session frozen-dir
  s=$1; fz=$2; mkdir -p $O/$s
  for f in $(ls $fz | grep -E '^clip[0-9]+\.json$'); do c=${f%.json}; [ -f $O/$s/$f ] && continue
    q=$(node -e "console.log(JSON.stringify(require('$fz/$f').quadN))")
    node tools/clip-detect.js $F/src/$s $O/$s --fps 60 --detector $W --quad "$q" $c >> $F/run60.log 2>&1 || echo "FAIL $s $c" >> $F/run60.log
  done; echo "DONE $s" >> $F/run60.log; }
old() { # name sessiondir frozen-dir
  n=$1; sd=$2; fz=$3; mkdir -p $O/$n
  q=$(node -e "console.log(JSON.stringify(require('$fz/'+require('fs').readdirSync('$fz')[0]).quadN))")
  clips=$(ls $fz | grep -E '^shot[0-9]+\.json$' | sed 's/.json//' | while read c; do [ -f $O/$n/$c.json ] || echo $c; done)
  [ -n "$clips" ] && node tools/clip-detect.js $sd $O/$n --fps 60 --detector $W --quad "$q" $clips >> $F/run60.log 2>&1 || true
  echo "DONE $n" >> $F/run60.log; }
EV=/mnt/project-files/chalkline-data/evidence; S=/mnt/project-files/chalkline-data/sessions
rec rec-20261019-1710 $EV/rec-20261019-1710/detections
rec rec-20261018-2310 $EV/rec-20261018-2310/detections
old oct16 $S/2026-10-16_evening_V2.3.3 $F/frozen/v04-oct16
old otherside $S/2026-10-17_1500_V2.3.3_otherside $F/frozen/v04-otherside
rec rec-20261017-1730 $F/frozen/v04-rec
old firstspot $S/2026-10-17_2151_V2.3.3_firstspot $F/frozen/v04-firstspot
echo ALLDONE >> $F/run60.log
