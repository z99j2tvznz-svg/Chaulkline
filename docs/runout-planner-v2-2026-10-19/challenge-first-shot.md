# Challenge layouts: old vs new planner

Model results only (V1.8.1 physics, not checked against real shots). Make shares are model numbers from noisy repeats, not player make rates.

## 1. Easy pot with poor shape vs harder pot with natural shape

Expected (written before scoring): The 1 goes in the top side pocket with a 9 degree cut (model make 12/12 on a plain stroke), but none of 12 plain strokes into the side leaves a green or amber shot on the 9 (best grade 0). Into the top-left corner it is a 45 degree cut (model make 11/12) and 2 plain strokes leave the 9 green. Expected: the top-left corner (pocket 3).

| Planner | Recommendation | Matches expected | Time |
|---|---|---|---|
| old (one shot ahead) | the 1 in the top side | no | 980 ms |
| new (search) | the 1 in the top side | no | 1324 ms, 1444 simulations |

New planner's reasoning: best offense: model make 93%, next shot playable after 67% of makes, 2 shot(s) searched; safety not needed (rule: safety only when make < 45%).

| Alternative | Strength | Follow(+)/draw(−) | Cut | Cue→ball | Ball→pocket | Model make (screen / final) | Next shot playable | Future | Value |
|---|---|---|---|---|---|---|---|---|---|
| the 1 → top side | 8 | -0.2 | 9° | 10" | 8" | 100% / 88% | 60% | 0.87 | 0.76 |
| the 1 → top side (V1 planGen) | 5.7 | -0.15 | 9° | 10" | 8" | 90% / 93% | 67% | 0.83 | 0.78 |
| the 1 → top-left corner | 4.5 | 0 | 45° | 11" | 55" | 90% / 65% | 100% | 0.80 | 0.52 |
| the 1 → top side | 6 | -0.2 | 9° | 10" | 8" | 80% / – | 38% | 0.77 | 0.61 |

Best safety (heuristic, reported separately): strength 1.5, legal in 100% of noisy repeats, quality 66% (1 − opponent's easiest pot, V1 bestEase).

## 2. Two pockets for the 1 with different routes to the 2

Expected (written before scoring): Both pockets are makeable: bottom-left corner 27 degree cut (model make 12/12), bottom side 19 degree cut (11/12). Plain strokes into the corner never leave a green or amber shot on the 2 (best grade 0); 2 plain strokes into the side leave the 2 green. Expected: the bottom side pocket (pocket 1).

| Planner | Recommendation | Matches expected | Time |
|---|---|---|---|
| old (one shot ahead) | the 1 in the bottom side | yes | 1268 ms |
| new (search) | the 1 in the bottom side | yes | 4646 ms, 5236 simulations |

New planner's reasoning: best offense: model make 100%, next shot playable after 50% of makes, 3 shot(s) searched; safety not needed (rule: safety only when make < 45%).

| Alternative | Strength | Follow(+)/draw(−) | Cut | Cue→ball | Ball→pocket | Model make (screen / final) | Next shot playable | Future | Value |
|---|---|---|---|---|---|---|---|---|---|
| the 1 → bottom side | 6 | 0.25 | 19° | 6" | 9" | 100% / 100% | 50% | 0.37 | 0.37 |
| the 1 → bottom side | 2 | 0.45 | 19° | 6" | 9" | 100% / 100% | 90% | 0.28 | 0.28 |
| the 1 → bottom side | 4.5 | 0.45 | 19° | 6" | 9" | 100% / 100% | 10% | 0.17 | 0.17 |
| the 1 → bottom-left corner (V1 planGen) | 7 | 0.3 | 27° | 6" | 57" | 80% / – | 88% | 0.18 | 0.15 |
| the 1 → bottom side | 8 | 0.25 | 19° | 6" | 9" | 100% / – | 70% | 0.04 | 0.04 |

Best safety (heuristic, reported separately): strength 3.5, legal in 84% of noisy repeats, quality 84% (1 − opponent's easiest pot, V1 bestEase).

## 3. 7-8-9 endgame: the wrong side of the 8 makes the 9 hard

Expected (written before scoring): Several shots on the 7 (bottom side pocket) leave the 8 green. Some of those leave the cue ball where the 8 is easy (model make 9/12) but no plain stroke on the 8 then leaves the 9 better than red (trap: strength 2 with draw). Others (strength 5, center) leave the 8 green and a plain stroke on the 8 that leaves the 9 green. Expected: the recommended shot on the 7 ends where some plain makeable (>= 60%) shot on the 8 leaves the 9 green.

| Planner | Recommendation | Matches expected | Time |
|---|---|---|---|
| old (one shot ahead) | the 7 in the bottom side; afterwards no makeable plain shot on the 8 leaves the 9 green | no | 789 ms |
| new (search) | the 7 in the bottom side; afterwards no makeable plain shot on the 8 leaves the 9 green | no | 4480 ms, 5394 simulations |

New planner's reasoning: best offense: model make 93%, next shot playable after 100% of makes, 3 shot(s) searched; safety not needed (rule: safety only when make < 45%).

| Alternative | Strength | Follow(+)/draw(−) | Cut | Cue→ball | Ball→pocket | Model make (screen / final) | Next shot playable | Future | Value |
|---|---|---|---|---|---|---|---|---|---|
| the 7 → bottom side | 4.5 | 0.25 | 30° | 10" | 14" | 100% / 93% | 100% | 0.43 | 0.40 |
| the 7 → bottom side | 3 | 0.45 | 30° | 10" | 14" | 100% / 85% | 80% | 0.36 | 0.31 |
| the 7 → bottom side | 4.5 | -0.4 | 30° | 10" | 14" | 100% / 95% | 100% | 0.33 | 0.32 |
| the 7 → bottom side | 2 | -0.4 | 30° | 10" | 14" | 100% / – | 90% | 0.25 | 0.25 |

Best safety (heuristic, reported separately): strength 1.5, legal in 100% of noisy repeats, quality 92% (1 − opponent's easiest pot, V1 bestEase).

## 4. Low-percentage pot vs safety

Expected (written before scoring): The 1 is frozen-ish on the left end rail; the only pocket (top-left corner) needs a 71 degree cut from 89 inches away. A competent player plays safe here; the planner should report the offensive option as low-percentage and recommend the safety.

| Planner | Recommendation | Matches expected | Time |
|---|---|---|---|
| old (one shot ahead) | pot the 1 in the top-left corner (model make 33%) | no | 809 ms |
| new (search) | safety | yes | 1786 ms, 1182 simulations |

New planner's reasoning: offense make only 9% in the model and a safety leaves the opponent little (quality 65%, legal 86%).

| Alternative | Strength | Follow(+)/draw(−) | Cut | Cue→ball | Ball→pocket | Model make (screen / final) | Next shot playable | Future | Value |
|---|---|---|---|---|---|---|---|---|---|
| the 1 → top-left corner (V1 planGen) | 7 | 0 | 71° | 89" | 20" | 20% / 9% | 50% | 0.37 | 0.03 |
| the 1 → top-left corner (V1 planGen) | 5.7 | 0.15 | 71° | 89" | 20" | 10% / 4% | 100% | 0.70 | 0.03 |
| the 1 → top-left corner (V1 planGen) | 3 | 0.3 | 71° | 89" | 20" | 10% / 3% | 100% | 0.70 | 0.02 |
| the 1 → top-left corner | 8 | 0.45 | 71° | 89" | 20" | 10% / – | 0% | 0.35 | 0.03 |

Best safety (heuristic, reported separately): strength 3.5, legal in 86% of noisy repeats, quality 65% (1 − opponent's easiest pot, V1 bestEase).

## 5. Replan after a confirmed cue-ball error

Expected (written before scoring): Natural shots on the 1 (top side pocket) leave the cue ball above the 2, where the 2 goes in the bottom-right corner. If the cue ball instead really stops at (55, 12), below and left of the 2, the bottom-right corner is an 83 degree cut and the top-right corner a 13 degree cut, so the plan for the 2 must switch to the top-right corner (pocket 5).

| Planner | Recommendation | Matches expected | Time |
|---|---|---|---|
| old (one shot ahead) | the 2: top-right corner from the predicted spot, top-right corner after the error | yes | 1028 ms |
| new (search) | the 2: bottom side from the predicted spot, safety after the error | no | 6030 ms, 6038 simulations |

New planner's reasoning: best offense: model make 100%, next shot playable after 100% of makes, 3 shot(s) searched; safety not needed (rule: safety only when make < 45%).

| Alternative | Strength | Follow(+)/draw(−) | Cut | Cue→ball | Ball→pocket | Model make (screen / final) | Next shot playable | Future | Value |
|---|---|---|---|---|---|---|---|---|---|
| the 1 → top side | 2 | 0.25 | 26° | 9" | 10" | 100% / 100% | 100% | 0.39 | 0.39 |
| the 1 → top side | 3 | 0.45 | 26° | 9" | 10" | 100% / 100% | 100% | 0.35 | 0.35 |
| the 1 → top side | 2 | 0.45 | 26° | 9" | 10" | 100% / 100% | 100% | 0.31 | 0.31 |
| the 1 → top side | 3 | 0.25 | 26° | 9" | 10" | 100% / – | 100% | 0.21 | 0.21 |
| the 1 → top-right corner | 6 | 0.45 | 63° | 10" | 52" | 70% / – | 29% | 0.18 | 0.12 |

Best safety (heuristic, reported separately): strength 2.5, legal in 100% of noisy repeats, quality 85% (1 − opponent's easiest pot, V1 bestEase).

## Summary

| Layout | Old matches | New matches |
|---|---|---|
| 1. Easy pot with poor shape vs harder pot with natural shape | no | no |
| 2. Two pockets for the 1 with different routes to the 2 | yes | yes |
| 3. 7-8-9 endgame: the wrong side of the 8 makes the 9 hard | no | no |
| 4. Low-percentage pot vs safety | no | yes |
| 5. Replan after a confirmed cue-ball error | yes | no |
