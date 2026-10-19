# Tracking experiment: coasting lost tracks (Oct 19, 2026)

Offline only, v0.4 detections, nothing else changed. `tools/tracker.js` option `coast` (off by default; baseline output verified identical with it off). `score-racks.js --track '{"coast":"line"}'` or `'{"coast":"cushion"}'`.

- **Result:** both straight-line and cushion-bounce coasting recover about 1 pocketed ball (first spot made-unresolved 10 -> 9). Every other count is unchanged in all 4 sessions.
- **Why so little** (`tools/pocket/trk.js`, the 30 made balls with no pocket event): 12 were never named by any track; about 9 lost identity at launch (the named track ends "resting", a new unnamed track takes the moving ball); 3 hidden while resting; about 8 lost while moving.
- **Next step (not started):** launch handover. When a named resting ball is struck, the new moving track starting at its spot inherits the name. Later, predict with `src/core.js` physics.
