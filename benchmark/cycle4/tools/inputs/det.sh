#!/bin/bash
# det.sh <session dir> <out dir> [extra args]: frozen detector + rejected sidecars
S=/tmp/claude-0/-home-user-Chaulkline/e2aab88e-650e-5c9b-8cd7-b373619fcdb2/scratchpad
cd /home/user/Chaulkline/collab/recognition-package-2026-10-20/code && PATH=$S/venv/bin:$PATH NODE_PATH=/home/user/Chaulkline/node_modules node tools/clip-detect.js "$1" "$2" --detector $S/rk/best.pt --rejected "${@:3}"
