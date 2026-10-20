#!/bin/sh
# Re-score tracker v0.6 on the frozen detections (6 sessions, 116 real shots). Run from the package root:
#   sh 06-product-evaluation/run-v06-eval.sh [tracker options JSON]
# Default options '{"version":"v0.6"}'. Output: one line per session + 06-product-evaluation/my-run.json.
# The result must equal 06-product-evaluation/baselines/tracker-v0.6-data/pm-v06.json (checked when this package was made).
# ("fatal: not a git repository" lines are harmless: the scorer tries to record the git commit.)
OPTS=${1:-'{"version":"v0.6"}'}
T=02-ground-truth/player-verified/shot-outcomes
D=04-detections/v0.6-scoring-set
node code/tools/experiments/product-metrics.js "$OPTS" \
  $D/v04-oct16:$T/2026-10-16_evening_V2.3.3.json \
  $D/v04-firstspot:$T/2026-10-17_2151_V2.3.3_firstspot.json \
  $D/v04-otherside:$T/2026-10-17_1500_V2.3.3_otherside.json \
  $D/rec-20261017-1730:$T/rec-20261017-1730.json \
  $D/rec-20261018-2310:$T/rec-20261018-2310.json \
  $D/rec-20261019-1710:$T/rec-20261019-1710.json \
  --out 06-product-evaluation/my-run.json
