# Reader v2 Cycle 1: pre-registration (written 2026-10-21 00:40 UTC, before any cycle result)

Authorised by Nackers 2026-10-21 00:26 UTC: up to 8 offline experiments, Challenger B as the starting point. The frozen reader,
v0.6 tracker and scorer, the benchmark (`../recognition-2026-10-20/`) and the labels stay unchanged.

## Data and honesty rules
- Development / model selection: Oct 12-16 only, using the benchmark's split (train = Oct 12-14 + even Oct 16 clips,
  dev = Oct 15 + odd Oct 16 clips). Product-level dev = the Oct 16 session (24 shots). It is weak: it is part of B's
  training data, and in the benchmark every reader scored 11-13 of 24 on it. So it is used only as a "no regression" guard.
- Final evaluation: Oct 17-19 (92 shots), both 30 fps picks (`frozen30` = the published set, `d30b` = the alternate pick).
- **The held-out set is no longer untouched.** Its results were seen in the benchmark and in the failure analysis, and
  the areas below (far camera, overlapping balls) were chosen *because* of held-out failures. Any held-out gain in this cycle
  is evidence, not fresh independent validation. One example: the held-out "touching" pictures are 8 balls at the far
  spot that overlap in the picture (1.6-1.9 radii apart). That was seen before the overlap augmentation was designed.
- Held-out results are computed for the pre-declared variants only. They are reported in full and are not used to
  iterate a design. At most one follow-up (E8) may be run after held-out results, and it is labelled as such.
- Training differs between seeds (B: 1,354-1,435 right). Every training variant gets 3 seeds, and a variant is judged
  on the mean of the 3 seeds.

## Experiments
| # | Change (everything else = B) | Hypothesis / expected benefit | Selection evidence (dev) |
|---|---|---|---|
| E1 | Input only: B's number + frozen "not a ball"; and B's number re-scaled "given it is a ball" (p / (1 - B nb)) + frozen "not a ball" | Fewer real balls dropped or left unsure, so more fully named looks. Expected +3 or more held-out tables | Oct 16 guard; rescaling must not raise dev confidently wrong pictures |
| E2 | Input only: a spot is "not a ball" only if BOTH readers say so (min of the two) | Keeps real detections while identity is unsure | dev: non-balls accepted vs balls rejected |
| E3 | Training: overlap / touching augmentation (a second ball pasted 1.5-2.6 radii away, in front or behind) | Fewer abstentions on touching balls, with no new confident errors | dev-touch (synthetic) right ↑, real dev confidently wrong not ↑ |
| E4 | Training: far-camera augmentation (picture shrunk to 45-80 % and enlarged back) | Fewer far-ball errors | dev-far (synthetic) ↑, real dev not worse |
| E5 | Training: crop / resolution (2.6-radius crop; 48 px input) | Tighter crop sees less of the neighbours; 48 px keeps more detail | dev, dev-touch, dev-far |
| E6 | Input only: average each still spot's 11 probabilities with the same spot (within 0.3 in) in the ±3 neighbouring frames, only if it stayed still | Consistent but weak reads cross the 0.6 vote line, so more still balls are named | Oct 16 guard; per-ball dev accuracy |
| E7 | Product evaluation of the combined candidate (kept changes + 3-seed ensemble if it beats one model on dev) | Final measurement | (held-out, both picks) |
| E8 | Spare: one follow-up only if E7 shows a specific fixable cause | | |

## What counts as a meaningful improvement over B (fixed now)
On the 92 held-out shots, on BOTH 30 fps picks, compared to B:
- at least +3 ending tables right (each shot judged alone), and continuous play not lower;
- confidently wrong shots not above B;
- missed real shots, false shots, false pockets and missed pockets not above B (+1 allowed as noise);
- no held-out session loses more than 2 tables.

Candidates that only move errors into "unsure" (fewer confidently wrong but no more right tables) are rejected.
Recognition also reports per-picture and per-ball accuracy on the verified held-out pictures, because the product
score cannot see two balls with swapped names.

## Addendum A (00:58 UTC, after the dev results of E3-E5, before any product run of trained variants)
Selection by the rule above (mean of 3 seeds on dev; see `results/recognition-sweep.json`):
- E3 overlap augmentation: dev-touch right 704 (vs retrained-B 688), dev confidently wrong not higher -> **kept**.
- E4 far-camera augmentation: dev-far 714 vs 716 -> not shown on dev -> **rejected** (the synthetic far set cannot separate them).
- E5 2.6-radius crop: dev 717 vs 715, dev-touch 708 vs 688, dev confidently wrong equal -> **kept**. 48 px input: worse on
  dev (702 vs 715, 3x the unsure) -> **rejected**.
- Seed ensemble (mean of 3 seeds): better than single seeds on dev (717/1 vs 715/1.7) -> **kept**.
- Combined candidate = 2.6-radius crop + overlap augmentation, 3-seed ensemble ("combo").
Honesty note: the evaluation script printed held-out recognition numbers in the same run as the dev numbers, so they
were seen. The selection above follows the dev rule only.
Pre-declared product runs (held-out reported in full): B; B-recipe retrained 3-seed ensemble (to separate the ensemble
effect); overlap-ensemble; crop-ensemble; combo-ensemble. Each one runs with its own "not a ball" and with the frozen
"not a ball" (E1 found that the frozen one is better), on both 30 fps picks.
