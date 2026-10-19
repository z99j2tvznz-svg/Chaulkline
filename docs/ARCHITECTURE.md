# Chalkline architecture: table twin, physics, planning (Oct 19, 2026)

Short and permanent. The product view is in `PRODUCT_SPEC.md`. **Verified** means a test or a run checks it; **not verified** means it is a target or model output only.

## 1. Table state: the shared interface (`src/state.js`, new)

There are three kinds of record, and they are never mixed:

| Record | What it is | Authoritative? |
|---|---|---|
| `state` | Table geometry (size, pockets), each ball's id, position in table inches, status (`on`, `pocketed`, `unknown`), source (`observed`, `confirmed`, `inferred`) and uncertainty (`conf` for identity, `sd` in inches for position), plus the game context (`rules`, `group`) | yes |
| `prediction` | What physics says one shot would do: paths, final spots, pocketed balls, model name, `validated: false` | never |
| `proposal` | A suggested shot from a planner, with its model and `validated: false` | never |

Rules that are enforced and tested (`tests/runout.test.js`):
- States are frozen.
- `predict()` reads a state and never changes it.
- An authoritative state refuses a `predicted` ball. Looking ahead uses `hypothetical(state, prediction)`, which is marked `hypothetical` and fails `isAuthoritative()`.
- Overlapping balls, a ball off the cloth or a number used twice are rejected.
- `plannerLayout()` passes only balls whose identity is sure (`conf` ≥ 0.9). Planners refuse to plan when a ball is doubtful, instead of guessing.

The state does not know any game: rules modules read `game`. The camera path would build `observed` states, and the player's corrections turn balls into `confirmed`. That wiring is not built yet.

## 2. Physics and planner audit (`src/core.js` = V1.8.1, byte-identical functions)

**What the physics does (V1.8.1, not checked against real shots):**
- **Ball motion:** sliding friction (0.2) turning to rolling, then a constant roll-out slowdown (4.5 in/s²). Top and bottom spin come from the cue tip's height. Side spin fades at a fixed rate.
- **Ball-ball collisions:** equal balls, restitution 0.95, and simple friction "throw" (constant 0.06, capped). Side spin feeds into throw.
- **Cushions:** a flat wall one ball radius in from the cloth edge. The bounce depends on speed (clamped 0.5 to 0.78). Side spin changes the rebound angle, capped.
- **Squirt:** the aim shifts 0.05 rad per unit of side spin.
- **Pockets:** a ball counts as made when its centre enters a circle (corner 2.3 in, side 1.9 in, times the pocket-style scale).
- **Monte Carlo spread** (`mcGen`) from aim and speed noise. **Table fit** (`fitTableGen`) from straight calibration shots.

**What it leaves out:**
- Pocket jaws, rattles and the cushion nose height. The rail runs straight into the pocket circle.
- Swerve, massé and jump: the cue is always level.
- Throw that changes with speed or cut. Spin-induced throw beyond the simple cap.
- Cloth that differs by direction or table area.
- Ball and cushion values that differ per table, unless they are fitted.
- Any validation against footage.

**Do not call it professional-grade.** Spin, cushion and pocket results are model output only.

**Planner (`planGen`, V1.8.1):**
1. Searches direct pots (ghost ball × pockets × 4 speeds × 8 tip spots × small aim offsets), then combos.
2. Refines the cue ball's position for the next ball, with a two-ball lookahead (`zoneGrade`, `shapeOK`).
3. Scores robustness to small aim and speed errors, and adds safeties when pots are poor.

It returns the top 8. It only ever looks one or two balls ahead.

| Component | Verdict |
|---|---|
| `simulate`, `stepBall`, `cushion` | Reused as is. Not validated. |
| `planGen`, `shotGrade`, `zoneGrade`, `shapeOK`, `nextInfo`, `potGeom` | Reused as is |
| `legalTargets`, `evalResult` | Used inside the planner only. Not trusted for automatic judging. |
| App overlays (`drawPlan`, `drawTip`, `drawLanding`), top-down map | Reusable, but not wired to the new state yet |
| Whole-rack planning | **New** (`src/runout.js`) |

## 3. Runout planner (`src/runout.js`, new, experimental, heuristic)

1. **Backward pocket plan.**
   - Start with the last ball (9-ball order: lowest first).
   - For each ball, grade every 2.5-inch spot of the table: how easy the pot is from there (V1 `zoneGrade`), and whether there is natural shape to the pocket already chosen for the next ball.
   - The pocket with the best mix of pocket ease and good-zone area wins.
   - Then step back to the ball before.
2. **This shot.**
   - Take planGen's pots on the ball to shoot.
   - Try softer and firmer speeds and more follow or draw.
   - Keep the shots that still make the ball. Grade where the cue ball stops in the next ball's zone. Weight that by the model's make chance under small errors.
3. **Replan.**
   - Apply the prediction as a *hypothetical* state and repeat.
   - When the real layout differs (the player confirms the new layout), plan again from that confirmed state.

**Heuristic limits:**
- Other balls are assumed to stay put when the zones are graded.
- One pocket per ball.
- No safeties, banks, kicks or break-outs in the plan. A hooked ball stops the plan with "a safety is needed".
- The make chance is the model's, not the player's.
- Only 9-ball has a ball-order rule.

## 4. Demo

Run:

```
node tools/runout-demo.js data/layouts/9ball-demo.json runout-demo.html
```

It writes a top-down page for each step, showing:
- the zone for the next ball;
- the pocket lane;
- the ghost ball;
- the cue-ball and object-ball paths;
- the shot (strength 1 to 10, tip).

It plans a hand-entered spread rack, then replans after a confirmed change. In the demo layout, the cue ball comes back up the table after shot 2.

**Verified on the demo rack (model only):**
- All 9 balls run out in physics.
- 7 of 9 shots go into the backward-planned pocket. The other 2 switch pockets because no shot there leaves good position.
- 7 of 8 predicted cue-ball stops land in a green or amber spot for the next ball. After shot 8 the cue ball stops outside the zone, but the 9 is still made.
- `tests/runout.test.js` (6 tests) and the full suite (28) pass, and `index.html` is unchanged.

The real cue ball will not follow the model exactly. The first coaching milestone compares predictions with real footage.

## 5. Not built (non-blocking follow-ups)

- Wiring into the app's top-down map.
- Camera states.
- Spin and table calibration against footage.
- Other games.
- Player-specific make chances.
- Deeper strategy search.
- Native app.
