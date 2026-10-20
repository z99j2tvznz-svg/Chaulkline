# Alternate frame-sampling sets (regression resource)

Same detections (detector-v1, frozen outlines) for all 6 scored sessions, from one 60 fps run:
- detections-60fps.tgz: d60/<session>/ (every frame at 60 fps)
- sampling-sets-15-30.tgz: d30 (even frames), d30b (odd frames), d15 (every 4th from frame 0), d15b (every 4th from frame 2)
Frozen 30 fps baseline detections stay where they were (baseline-v0.4 tgz, evidence/).
Use: score a tracker change on frozen30 AND d30b (and d30) for the same session; a change of 1-2 shots that does not hold on both picks is noise.
Sessions: oct16, firstspot, otherside, rec-20261017-1730, rec-20261018-2310, rec-20261019-1710. Truth files: data/truth/ in the repo.
Re-derive with subsample.js <d60 dir> <out> <step> <offset>. Scores: all-scores.json; driver score.js.
