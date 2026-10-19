# Runout planner v2: lookahead search vs the old planner (Oct 19, 2026)

All results come from the simulation model: V1.8.1 physics, not checked against real shots. **Nothing here is real-world validation.** Make shares are model numbers, not player make rates. The live app (`index.html`) is unchanged, and the full test suite passes (33 tests).

## What was built

| | Reused (V1.8.1, unchanged) | New |
|---|---|---|
| Physics | `simulate`, full table on every trial | — |
| Candidates | `planGen` (first shot only), `potGeom`, `pocketOptions` | per-pocket grid of strength × follow/draw; aim centred on the pocket (secant correction for throw) |
| Grading | `shotGrade` (position), `bestEase` (safety heuristic) | — |
| Search | — | `src/search.js`: 3-shot lookahead (to the end with 3 balls or fewer); 2 pockets per ball; at the first shot the future is averaged over the nominal landing spot plus noisy ones |
| Monte Carlo | method of `mcGen`, re-written with seeded randomness (core.js untouched) | two stages: 10 repeats to screen, 75 for the top 3; stroke error grows with strength and spin |
| Safety | — | searched and reported separately; picked only when model make < 45% and the safety's quality is ≥ 60% and it is legal in ≥ 80% of repeats (heuristic rule) |
| Evaluation | — | `tools/runout-eval/`: planner-free layout finder, closed-loop evaluator with 3 table conditions the planners do not know, paired seeds, summary with ±2 SE |

**Budgets.** `server` and `phone` are configurable in `BUDGETS`.

**Measured on this server:** about 1,000–3,700 simulations and 1–4 s per recommendation on the challenge layouts, and about 11 s on a full 9-ball rack. Those times come from 4 evaluations running in parallel. The phone budget measured 659 simulations and about 2 s on the full rack, one run. iPhone time is not measured.

## Challenge layouts

The expected answers were fixed and committed (6db8185) before scoring. They come from physics and geometry with plain strokes, not from either planner.

**First-shot check** (`challenge-first-shot.md`):

| Layout | Old matches | New matches | Note |
|---|---|---|---|
| 1. Easy pot vs shape | no | no | Both shoot the side pocket. The new planner found a strength-8 stun-draw that gets shape, which the plain-stroke expectation never tried. The evaluator below favours the new planner's route, so **the expected answer itself may be wrong**. |
| 2. Two routes | yes | yes | |
| 3. 7-8-9 endgame | no | no | The check only looks at plain strokes on the 8, so it is too narrow. The evaluator below favours the new planner. |
| 4. Pot or safety | no | **yes** | The new planner recommends the safety. |
| 5. Replan after an error | yes | **no** | After the error it finds the right pocket (top-right), but rates it at a 31% model make and so recommends a safety (see "Where the new planner is worse"). |

## Closed loop: completed racks, same layouts and error seeds

**As built, the new planner plays a safety too often.** A safety ends a trial, because there is no opponent model, so it cannot complete a rack. In the 50-trial runs (`eval-50-old-vs-new.md`) it chose a safety in:
- 16 to 49 of 50 trials on layouts 1 to 4;
- 43 to 47 of 50 on layout 5.

Completed racks were therefore equal or lower than the old planner's everywhere. That compares safety advice, not run-out quality.

**Offense only** (the new planner's best pot every time; its safety advice is counted, not played).

Standard table, 200 trials (`eval-200-standard.md`):

| Layout | Old | New (offense) | Paired difference |
|---|---|---|---|
| 1. Easy pot vs shape | 95 (48%) | 112 (56%) | **+9 ± 7 points, better** |
| 2. Two routes | 23 (12%) | 80 (40%) | **+28 ± 8, better** |
| 3. 7-8-9 endgame | 37 (19%) | 60 (30%) | **+12 ± 8, better** |
| 4. Pot or safety (the pot is the wrong choice here) | 12 (6%) | 7 (4%) | too close |
| 5. Replan after an error | 42 (21%) | 47 (24%) | too close |

Changed table conditions, 50 trials each (`eval-50-old-vs-offense.md`):
- **Better:** 4 of 20 cells.
  - Layout 1 on slower cloth.
  - Layout 2 on slower cloth and on the standard table.
  - Layout 3 on slower cloth.
- **No cell clearly worse.**
- **Too close:** the rest, including every "more throw" and "bigger stroke error" cell.

Fouls were similar, except on layout 4. There the new planner's forced pot fouled 28 times out of 200, against 14 for the old planner.

**Full demo rack** (`eval-demo-rack.md`, 20 trials × 4 conditions): neither planner completed a rack (0 of 20 each). Both made about 1.4 balls per rack (standard table: old 1.3, new 1.6). With this model's error levels a full 9-ball runout essentially never happens, so this layout cannot tell the planners apart.

## Where the new planner is worse, or not yet trustworthy

1. **Safety decisions.** The model's corner pockets are narrow. A routine 13° cut has a make window of only 0.25° of aim (measured), so model make shares are low across the board. The fixed 45% safety rule then fires on ordinary shots: on layout 5 it advised a safety on more than half of all shots. The rule was not re-tuned after these results.
2. **Changed throw and larger stroke errors:** no measurable gain. The search optimises for the physics it knows.
3. **Speed:** about 3–4 times slower than the old planner.

## Disclosures

- During development, before the layouts were committed, the new planner was run on layout 4 and on one rejected candidate layout.
- Centring the aim on the pocket was added after debugging layout 5's first-shot result, before any evaluator run.
- The offense-only mode is a reporting mode added after the first evaluator run. The planner was not changed after evaluation.

## Suggested next step

Check the model's pocket acceptance and make chances against real shots before trusting any safety advice. That uses the Safari recorder: a few dozen recorded cut shots at known angles. Until then, show the search's best pot and its safety alternative side by side, and do not auto-pick a safety.
