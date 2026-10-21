# Perception Cycle 4: break pots, balls in the jaws, rails, shot detection, several racks (results, 2026-10-21)

Assignment: Nackers, 2026-10-21 22:05. Baseline: Cycle 3 unchanged ([../perception-cycle3/RESULTS.md](../perception-cycle3/RESULTS.md)).

Nothing in the app, the recorder, the frozen package, v0.6, Cycle 3 or the earlier benchmark folders was changed. This
folder is a copy of the Cycle 3 experiment code. Every new behaviour is an option that is off by default. With every
option off, the code gives exactly the Cycle 3 numbers:
- racks: rack 1, 2A and 2B, on the plain and on the edge inputs;
- old clips: 58/44 and 55/40, the same lines as Cycle 3.

The scoring functions are byte-identical to the frozen scorer (`tools/check_scorer.py`: all identical).

**Read the rack numbers with care.**
- Racks 2A and 2B were the development data for this cycle. Rack 1 was the development data for Cycle 3.
- No rack in this report is a held-out test. The only evidence that the changes carry over to other footage is the
  old-clip regression set below.

Input everywhere: Challenger B's number + the frozen reader's not-a-ball (the Cycle 1 recognition baseline).

## What changed and why

| # | Option (file) | Problem it targets | What it does |
|---|---|---|---|
| 1 | `spotBack` (tracker) | D: false shot at 74.3 s in 2A. The body covered a resting ball, and the tracker read that as the ball being struck. | Withdraws a "shot" when all of these hold: the "cue ball" vanished within 1 s after a short run (under 8 in); nothing was hit and nothing pocketed; no other trusted ball moved. And then either the ball is seen resting again where it sat, or another ball within 15 in vanished at the same moment (a body passing over both). |
| 2 | `lateStart` (tracker) | D: missed last shot in 2B. The cue ball was never seen rolling: it was hidden, then the 9 jumped 15 in. | A new fast track on a still table, born within 0.6 s of 1-3 resting balls being lost, starting next to one of them or with the cue ball lost, ball-like to the reader, travelling at least 10 in mostly in a straight line. That is a shot that started while hidden. The shot is kept open while that track rolls. |
| 3 | `jawEdges` (tracker) + `--rejected` boxes | B: the 7 hanging in the jaws (2A and 2B). The detector's pocket rule threw those boxes away, so the ball "vanished" and was called pocketed. | Pocket-edge boxes that the reader calls a ball are kept, for the camera's near-side pockets only. A far pocket shows the balls lying in its bag, which must not come back as table balls. Near and far are fitted from the boxes themselves (picture height against table position), so no camera placement is assumed. A ball that stops in the jaws stays on the table. It counts as pocketed only when it drops from the jaws while it or a ball next to it is moving, and it then stays gone. A hand covering a ball near a pocket is no longer a pot. |
| 4 | `railEdges` (tracker) | C: balls frozen to a cushion. The cushion rule threw the box away, so the ball was missing from the still table. | Cushion-edge boxes that the reader calls a ball are kept and moved onto the cloth, except within 2.5 in of a pocket point. |
| 5 | `bagSpots` (tracker) | A ball lying in a far pocket's bag was read back as a ball on the table (2A). | A ball lost fast at a pocket and "refound" right there is the ball in the bag, so the refind is refused. A new still spot inside a pocket's jaw zone after a pot there is left out of the still-table looks. |
| 6 | `breakPots` (runner) | A: balls pocketed straight out of the pack on the break. Pack balls touch and are not read, so such a ball is never named, and the whole rack stays unresolved. | The ball is counted "pocketed on the break (inferred), pocket unknown" only when all five checks agree: (1) the first table after the break is still; (2) the count matches: start count (pack + cue ball) minus spots after the break, minus balls seen going in, equals the number of never-named balls; (3) the unnamed spots after the break are exactly the balls named later; (4) there are at least 2 later still tables; (5) at least one pocket entry was seen on the break. Otherwise the ball stays open. A ball is never given a pocket just because it is missing. The candidate pockets (entries seen) are logged. |
| 7 | `breakTwoPass` (runner) | Break pots were only known at the end of the rack, so every later shot still counted them as "missing", and the usual "the one ball gone = the one pocket entry seen" rule could not fire. | When `breakPots` applies, the rack is run again with those balls out of play from the break on. The second pass is kept only if it finds the same break pots. |
| 8 | `anonPockets` (runner) + `anonEntries` (tracker) | An unnamed rolling ball seen going into a pocket was thrown away (2B: the 9 in P4 on the last shot). | Such a track becomes an anonymous pocket event. The existing reconciliation gives it a number only by elimination: exactly one ball gone and exactly one unexplained entry. |
| 9 | `findRacks` (runner) + `tools/racks.py` | E: several racks in one recording. | The ball count on a still table only goes up at a re-rack. A cut is proposed where a still table holds 2 or more spots more than the fewest since the last shot. The proposal is accepted only if a pack is then found (rackprobe) and a later shot scatters it (the break). Shots in between are racking, not play. Explicit marks (`--marks`, for example a future "New rack" button) are supported as the fallback. |

Tried and rejected:
- **`railNb`.** Uses B's not-a-ball near rails. On the old clips it went 58 → 54 and 55 → 53 tables right, with
  confidently wrong 16 → 21 and 21 → 26. It exposes rail misreads and pocket-bag balls. Kept off. Its idea survives
  only in the break-pot count, which counts spots either reader calls a ball.
- **Hard-coded "near side = y < W/2".** Worked on these racks, but it assumes a camera spot. It was replaced by the
  fitted near side (same results).

How to run: `tools/racks.py` (whole recording) or `exp/tools/rack.js` (one rack). Options:
[results/cycle4-rack-options.json](results/cycle4-rack-options.json) and
[results/cycle4-track-options.json](results/cycle4-track-options.json) (old clips). Edge inputs are built with
`tools/inputs/` (detector run with `--rejected`, merge, B labels).

## Cycle 3 vs Cycle 4 on the racks (development data)

| Measure | Rack 1: C3 | Rack 1: C4 | 2A: C3 | 2A: C4 | 2B: C3 | 2B: C4 |
|---|---|---|---|---|---|---|
| Tables after shots: correct / unresolved / **confidently wrong** | 13 / 0 / 0 | 13 / 0 / 0 | 0 / 3 / **10** | **12 / 1 / 0** | 0 / 12 / 0 | **11 / 1 / 0** |
| Shots: found / missed / false | 13 / 0 / 0 | 13 / 0 / 0 | 13 / 0 / 1 | 13 / 0 / **0** | 11 / 1 / 0 | **12 / 0** / 0 |
| First ball hit: right / no reading / wrong | 12 / 0 / 0 | 12 / 0 / 0 | 8 / 2 / 1 | 9 / 1 / 1 | 5 / 4 / 0 | 6 / 4 / 0 |
| Pocketed balls: observed / inferred / not confirmed (of 9) | 9 / 0 / 0 | 9 / 0 / 0 | 5 / 0 / 2 (+2 credited to the wrong shot) | 6 / 3 / 0 | 3 / 0 / 5 | 6 / 3 / 0 |
| P-IDs right / wrong / unknown | 9 / 0 / 0 | 9 / 0 / 0 | 5 / 0 | 6 / 0 / 3 | 3 / 0 | 6 / 0 / 3 |
| Start: balls established | 10 / 10 | 10 / 10 | 9 / 10 | 10 / 10 | 6 / 10 | 10 / 10 |
| Invented pockets | 0 | 0 | 0 | 0 | 0 | 0 |

Break-pocket accounting (truth from the video and the player's account):
- **2A break.**
  - Truth: 4 in the near-left corner; the cue ball scratched.
  - C4: 4 "pocketed on the break (inferred)", pocket unknown. Candidates logged: near-left, near-right. All 5 checks
    agree.
- **2B break.**
  - Truth: 3 and 4 in the near-left corner, 1 in the far side pocket, 8 in the near side pocket.
  - C4: 1 observed going into P6 (right). 3, 4 and 8 inferred, pocket unknown. Candidates logged: near-left and near
    side, both right.
- No pocket was assigned from absence alone.

Rack-boundary accuracy (automatic split, recording 20261021-1212):
- The cut came at 169.6 s. Rack 2A's last shot was at 162.3 s and the re-rack started after it.
- The break was detected at 212.7 s; truth is 212.4 s.
- The racking shot at 198.8 s was correctly rejected: the pack was still there after it.
- Rack 1 got no proposals, so no false split.
- So: 1 of 1 true boundary found, 0 false. That is one example, so it is not yet reliable. Keep an explicit "New rack"
  mark as the product fallback.
- The scores of the automatically split racks: see the end of this file.

Where each gain comes from: the full Cycle 4 setting with one option switched off
([results/ablation-racks.txt](results/ablation-racks.txt)). Numbers are tables correct / unresolved / wrong.

| Option off | 2A | 2B | What comes back |
|---|---|---|---|
| jawEdges | 3/0/10 | 7/5/0 | The 7 in the jaws: every confident error in 2A comes back |
| breakPots | 0/13/0 | 0/12/0 | The never-named break pots block the whole rack |
| breakTwoPass | 6/7/0 | 10/2/0 | The later pots can no longer be matched by elimination |
| railEdges | 12/1/0 | 0/12/0 | The 2 frozen to the rail is missing, so the break count fails |
| bagSpots | 7/4/2 | 11/1/0 | The ball in a far bag is counted as a table ball |
| spotBack | 2/10/1 | 11/1/0 | The body "shot" |
| lateStart | 12/1/0 | 8/3/1 | The missed last shot |
| anonPockets | 12/1/0 | 10/2/0 | The 9 in P4 on the last shot |

Rack 1 stays 13/0/0 with 9/9 P-IDs whichever option is off.

## Generalization: old clips (148 clips, 6 sessions, frozen v0.6 scorer)
Shown as tables right (checkpoint / continuous), confidently wrong (checkpoint / continuous). HO = the Oct 17-19
held-out part (already exposed in earlier cycles: a known benchmark, not fresh).

**Without the edge boxes** (shot, jaw and bag options only; no sidecars):

| Pick | Cycle 3 | Cycle 4 |
|---|---|---|
| frozen30 | ALL 58/44 cw 16/17; HO 44/39 cw 10/11, missed 3, false 8 | ALL **60/45** cw **15/16**; HO 46/40 cw 9/10, missed 2, false 8 |
| d30b (alternate frames) | ALL 55/40 cw 21/21; HO 41/35 cw 15/15, missed 4, false 11 | ALL **56/41** cw 21/21; HO 42/36 cw 15/15, missed 4, false 11 |

Small gains on both frame picks, and confidently wrong goes down or stays the same. Per our rule, +1-2 is within
sampling noise. So this shows "no harm", not proof of a gain.

**With the edge boxes** (detector re-run with `--rejected` on the Oct 17-19 held-out clips, frozen30 pick):

EDGE_REGRESSION_PLACEHOLDER

## Remaining failures, ranked
1. **Nothing is held out yet.** All rack gains are on the footage the rules were built on, and one threshold
   (rail-edge distance 2.5 in) was chosen on 2B. This is the biggest risk, not a single bug.
2. **A ball on the rail that neither reader names** (2B break: the 2 frozen to the cushion, unresolved for one
   table). The frozen reader calls it "not a ball". B's view was rejected because it raises confident errors elsewhere.
3. **The body covering the table at a still moment** (2A shot A2: 4 balls left open). Correctly left unresolved; a
   later still table fixes it.
4. **First-ball reading:**
   - 4 shots with no reading in 2B, 1 in 2A, 1 wrong in 2A.
   - The cause is contacts near the far rail or hidden by the shooter.
5. **Break pots get no pocket.** Inferred balls carry "pocket unknown" with candidate pockets. This is by design;
   naming the pocket needs entries tied to a ball, which pack balls do not have.
6. **Old clips:**
   - Unresolved tables dominate (HO 43 balls left unresolved).
   - These come from clips that end mid-roll and the per-clip format. The racks show that continuous recording removes
     most of this.

## Research (serious candidates)

| Candidate | What it does | Code | License | iPhone video | Measurable advantage for these problems |
|---|---|---|---|---|---|
| Roboflow `trackers` (SORT, ByteTrack, OC-SORT, BoT-SORT) | Frame-to-frame detection linking; ByteTrack also uses low-confidence boxes; lost-track buffer | Yes (Python) | Apache-2.0 | Yes (any frames, CPU) | None expected. Our tracker already does ByteTrack-style gated matching with a second wide pass. Our failures were jaws, rails, break pots and shots-from-hidden, not linking ([review](../tracking-approaches-review-2026-10-21.md)). Not adopted. |
| OC-SORT (CVPR 2023) | Corrects Kalman drift after occlusion using observations | Yes | Not checked | Yes | Low. Occlusion recovery is the right idea, but our hidden balls are mostly at rest (handled by still-period looks). |
| Kalman trackers on fast small balls (arXiv 2509.18451) | Study: constant-velocity Kalman trackers break on fast, tiny, bouncing balls | Paper | n/a | n/a | Evidence against adding Kalman prediction for break shots. |
| TCGA-Pool / "Attention-Pool" (AUT) | Learned 9-ball shot and pot analytics from video | No code found | Paper CC BY 4.0 | Unknown; 27.3M parameters, heavy for Safari | Unknown, and it needs training data we do not have. Watch only. |
| TrackingSnookerBalls (OpenCV HSV) | Colour thresholds per ball, no memory | Yes | None found (cannot reuse) | Yes | None: weaker than our detector and reader. |
| pooltool | Physics simulator | Yes | Apache-2.0 | n/a (simulation) | None for perception. Useful later for reconstruction and inverse physics (later layers). |
| Temporal identity / multi-frame appearance (own) | Pool readings over frames of one still ball | Partly (Cycle 3 still-period looks) | ours | Yes | Already in. This cycle's gains came from table-level accounting (counts, elimination, two passes), the "global reconciliation" direction the review recommended. |

Conclusion: no outside method addresses balls in the jaws or break-pot accounting. These are table-state reasoning
problems, and that is where the gains came from.

## Cue-ball tracking for a speed-control drill prototype
- **Confirmed (measured):**
  - Shot start found on all 38 rack shots, with 0 false shots.
  - The cue ball is identified on every rack (one-cue-ball rule, rack mode).
  - Its rest position comes from a still-table look after every shot.
  - Perception is a separate module: `tracker.js` + still looks, with no game rules. A cue-ball-only drill can call it
    with the ball set `0` and no rack logic.
- **Likely:**
  - Rest position is good to about 1 in on the near half of the table and worse at the far rail. Camera wobble is
    1-2 px (about 0.5 in far rail), and the reader is weaker on far balls.
  - Distance rolled and rails touched can be read from the track at 30 fps.
- **Unknown:**
  - Speed accuracy. At 30 fps a firm shot moves several inches per frame and blurs.
  - Rest-position error against measured truth (we have no measured positions).
- **Recommendation:** a speed drill can be prototyped on rest position alone ("stop the cue ball in this zone", "lag
  to the rail"). That needs no speed. First run a 10-minute position test: cue ball on marked spots (diamonds), near and
  far half, from the usual phone spot.

## Next-cycle recommendation
1. **Confirm on fresh footage before anything else.** Record 3 new complete racks with R0.7 (one recording each, or
   one recording with a "New rack" mark). Run Cycle 4 unchanged. Accept only if tables stay at least as right with no
   rise in confidently wrong.
2. Then decide which options become the experimental default for the rack runner.
3. Small follow-ups, only if the fresh racks show them:
   - rail balls that neither reader names (item 2 above);
   - the first-ball reading near the far rail.
4. The cue-ball position test for the drill (above).

## Automatically split racks
`tools/racks.py` on the whole rack-2 recording, with the Cycle 4 options
([results/racksplit/](results/racksplit/)):
- The proposals are the same as above: cut at 169.6 s, rack start 211.8 s, break 212.7 s.
- The two racks it produced score exactly like the hand-cut racks:
  - rack 2A: 12/1/0, shots 13/0/0;
  - rack 2B: 11/1/0, shots 12/0/0;
  - pockets 6 observed + 3 inferred each, P-IDs 6/0.
- Rack 1 as a whole recording: no proposal, one rack.
