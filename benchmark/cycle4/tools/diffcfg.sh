#!/bin/bash
# per-clip result changes between two configurations on the six earlier sessions
#   tools/diffcfg.sh <dets root (has <pick>/<session>)> <pick> '<cfg A json>' '<cfg B json>'
H=$(cd "$(dirname "$0")/.." && pwd); TR=$H/../../collab/recognition-package-2026-10-20/02-ground-truth/player-verified/shot-outcomes; T=$(mktemp -d)
while read d t; do
  node $H/exp/tools/score-racks.js $1/$2/$d $TR/$t.json --track "$3" --out $T/a.json > /dev/null
  node $H/exp/tools/score-racks.js $1/$2/$d $TR/$t.json --track "$4" --out $T/b.json > /dev/null
  node -e "
const a=require('$T/a.json'), b=require('$T/b.json');
for (const m of ['checkpoint','continuous']) a[m].racks.forEach((r,i)=>r.clips.forEach((c,j)=>{ const e=b[m].racks[i].clips[j]; if(c.missing) return;
  if(c.result!==e.result) console.log('$d', m.slice(0,4), c.clip, c.result,'->',e.result, '|', JSON.stringify(e.wrong.concat(e.unresolved).map(w=>(w.ball??'')+' '+w.what)).slice(0,260)); }));"
done <<'S'
v04-oct16 2026-10-16_evening_V2.3.3
v04-firstspot 2026-10-17_2151_V2.3.3_firstspot
v04-otherside 2026-10-17_1500_V2.3.3_otherside
rec-20261017-1730 rec-20261017-1730
rec-20261018-2310 rec-20261018-2310
rec-20261019-1710 rec-20261019-1710
S
rm -rf $T
