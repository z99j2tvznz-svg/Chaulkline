# Chalkline product specification (permanent; written Oct 19, 2026)

Read this before any design decision. It records the whole product, so that narrowing work to tracking for a while never loses the rest. The original vision and decisions are in `DESIGN NOTES.md` (top half); the rebuild order is in `chalkline-data/plans/rebuild-decisions.md`.

## What Chalkline is

Chalkline is a physics-driven billiards practice, analysis and coaching platform for home tables and pool halls, used mostly in long practice sessions rather than during matches.

At its centre is a **digital twin of the table**, kept in table coordinates (inches on the playing surface):
- the camera observes the table;
- the twin holds and interprets the state;
- physics limits what movement is plausible;
- new observations correct the predictions.

**A prediction is never shown or stored as an observation.** Every ball state carries where it came from (seen, predicted or inferred) and how uncertain it is.

Everything else is a view or a consumer of the twin: the camera overlay, the top-down map, coaching, stats, a remote coach, a projector, broadcast graphics. Because balls, paths, zones and annotations all live in table coordinates, any display can draw them.

## Status of each capability

Status key:
- **E** – exists and works;
- **P** – partly built, or exists but is unproven on real footage;
- **M** – missing, needed for the current milestone;
- **F** – future, not in the current milestone.

| Area | Capability | Status | Where |
|---|---|---|---|
| Table | Table finding, camera model, table to screen mapping | E | `src/core.js` homography, makeCam; `src/vision.js` autoCalibrate, findDiamonds |
| | Top-down table map | E | `src/app.js` drawFelt, menu "Show table map" |
| | Lens distortion | M (minor) | the lens value is a fixed guess |
| Balls | One-class ball detector (detector-v1) | P | offline only (`tools/detector/`); not in the app |
| | Number reader | P | `src/vision.js` recogRun; 92% on clean still spots; weak on small far balls and the 9 against the cue |
| | Per-ball tracking: identity, speed, state | P | `tools/tracker.js` (offline only). The app follows only the cue ball during a shot |
| | Seen / predicted / inferred plus uncertainty per ball | M | there is no common ball-state record |
| | Table memory across shots (settled-table check) | P | `tools/reconcile.js` (offline); rules v1 never close an unconfirmed ball later |
| Physics | Sliding to rolling, spin, cushions, ball-ball collisions, pockets, squirt | E | `src/core.js` makeP, stepBall, cushion, simulate |
| | Fit speed and spin from a seen path; table calibration; Monte Carlo spread | E | fitGen, fitTableGen, mcGen |
| | Physics used to help tracking | M | the tracker uses straight lines only (`coast` experiment) |
| | Checked against real footage; jump, masse and throw | M / F | |
| Rules | 9-ball and 8-ball legality and shot judging | E (mixed in) | core legalTargets, evalResult; app judgeShot |
| | Rules as a separate layer over observed events | M | planned in rebuild-decisions section 16 |
| | 10-ball, straight pool, bank pool, one-pocket; fouls where observable | F | |
| Planning | Candidate shots, safeties, combos, pocketability and position grade, zone grid, ball in hand | E | core planGen, shotGrade, zoneGrade, positionZone; app planNow, bestCuePlacement |
| | Whole-rack planning (work backward, patterns, clusters) | M→F | the planner looks at the next ball only |
| | Banks and kicks in the planner | F | `research/bank-kick-simulator.md` |
| Coaching views | Aim line, ghost ball, paths shaded by uncertainty, landing zone (green fading, amber/red on the sides, hatched blocked area), tip diagram, strength 1–10 | E | app drawPlan, drawLanding, drawTip, speedOfLevel |
| | Safe/Bold slider | P | the slider exists but does nothing yet |
| | Fan-shaped green/yellow/red/gray zones from the next object ball, computed (not forced into a fixed wedge) | P | landing zone and zone grid exist; the gray "blocked" area is partial |
| Player model | Make/miss stats, history, adaptive drill picking | E | app statsHtml, drillStats, pickDrill |
| | Shot labels (cut, distance, type), success by shot type | P | DESIGN NOTES section "Shot classification" |
| | Speed calibrated per player and table; personal 1–10 speed drill | P / M | the strength scale and table fit exist; no dedicated speed drill |
| | Unofficial Fargo-style estimate (never shown as official FargoRate), trends, weakness-based drill recommendations | F | |
| | Shot choice using the player's measured make chances, calibrated from real evidence | F | |
| Sessions | Long practice sessions, resume, per-shot clips, debug export | E | app clipStart, packDebug, resume |
| | Guided test recorder (zip parts under 25 MB, tap answers) | E | `recorder/` (R0.5, Evening check) |
| | Per-shot records kept, not just totals | P | |
| Platform | Remote coach view and annotations; projector on the cloth; broadcast and pro analysis; TV mode | F | all of these reuse the twin in table coordinates |

## Order of work

The current milestone is reliable tracking of a complete real 9-ball rack:
1. Finding balls.
2. Following each ball and keeping its identity through motion.
3. Pocket evidence.
4. Table memory.
5. Rules.

Planning, coaching and the player model already exist in the app, but they are only as good as the state they read. They come back into scope after the milestone, in this order:
1. Rules as a separate layer.
2. Per-shot records.
3. The player model.
4. Whole-rack planning.
5. Platform views.

## Lasting design rules

- **One twin, in table inches.** Every view draws from the twin. Nothing is computed in screen pixels except observations.
- **Observation, prediction and inference stay separate, each with its uncertainty.** An unresolved ball is shown as unresolved, never guessed.
- **Rules sit on top of events, not inside tracking.** Each game (9-ball, 8-ball, …) is a rule module over the same events.
- **One physics engine, `src/core.js`.** The same code serves tracking help, planning and coaching. An outside engine (for example pooltool, Python, Apache-2.0) is for offline checks only, unless it is adopted on purpose.
- **Make chances come from measured player evidence.** Never invent them, and never derive them from a rating.
- **Every algorithm change is a new scored version** on the frozen held-out footage. One component changes at a time.
