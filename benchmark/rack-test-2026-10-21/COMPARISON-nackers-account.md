# Rack 1: Nackers' firsthand account vs Claude's truth vs Chalkline (2026-10-21)

This adds to the original evaluation; it does not replace it. `RESULTS.md`, `truth/` and `results/` are unchanged, so the
original scores still reproduce. The system figures below come from the original outputs (`results/scores.tgz`, B number +
frozen not-a-ball, Cycle 2 best, unless a row says otherwise). Pocket labels come from a new look at the video (frames
every 0.15-0.3 s around every drop), made after Nackers' account arrived.

Pocket IDs for this recording (Nackers, as seen from the camera): P1 far-left corner, P2 near-left corner, P3 near side,
P4 near-right corner, P5 far-right corner, P6 far side. Nackers' "top" = the right end and "lower" = the left end. That
reading fits every shot where both were seen.

## Shot by shot
| # | Claude id | Strike (truth / system) | First ball: Nackers / Claude / system | Made: Nackers / Claude / system | Pocket (video) | How the system knew | Table after | Discrepancies |
|---|---|---|---|---|---|---|---|---|
| 1 | break | 11.7 / 11.8 | break / 1 / none (break) | none / none / none | none | n/a | correct | none |
| 2 | A | 38.1 / 38.17 | 1 / 1 / 1 | none / none / none | none (1 hits the P3 jaw) | n/a | correct | **Rails:** Nackers says a two-rail kick; Claude's note said one rail. **Nackers is right.** At 0.1 s steps the cue ball hits the left short rail (~38.9 s), then the near long rail (~39.65 s), then the 1 (~39.9 s). |
| 3 | B | 55.1 / 55.03 | 1 / 1 / 1 | 1 / 1 / 1 | P3, high | pocket event at the mouth (55.97 s) | correct | Cue ball contacting the 6 afterwards: not in Claude's truth, not measured by the system |
| 4 | C | 71.4 / 71.33 | 2 / 2 / 2 | none / none / none | none | n/a | correct | none |
| 5 | D | 84.9 / 84.8 | 2 / 2 / 2 | none / none / none | none | n/a | correct | none (a safety; intent is not something the system measures) |
| 6 | E | 99.6 / 99.5 | 2 / 2 / 2 | 2 / 2 / 2 | P5, high (at the jaws at 100.7 s, gone at 101.0 s) | **inferred**: gone from the still table (absence rule), no pocket event | correct | Contact on the 6: not measured |
| 7 | F | 114.0 / 113.73 | 5 (nearly simultaneous with the 3) / 5 (contact at 114.82 s, checked at 60 fps) / 5 | 5 / 5 / 5 | P6, high (at the jaws ~115.9 s) | **inferred** (absence) | **unresolved**: the 6 is hidden by the bridge hand in the look before shot 8 | All three agree on the 5 first. The contacts are close together; the system's 30 fps first-ball reading is not a precise contact-order measurement |
| 8 | G | 130.9 / 130.8 | 3 / 3 / 3 | 3 / 3 / 3 | P2, high | pocket event (132.13 s) | correct (v0.6 alone: unresolved, cue ball unnamed) | none |
| 9 | H | 144.9 / 145.6 | 4 / 4 / none (body) | 4 / 4 / 4 | P5, medium-high (visible at the far-right jaws at 146.0 s, then the body covers the area) | pocket event (146.23 s) | correct | System shot start 0.7 s late (occluded) |
| 10 | I | 160.4 / 160.23 | 6 / 6 / 6 | 6 / 6 / 6 | P6, high (~161.1 s) | **inferred** (absence) | correct | none |
| 11 | J | 174.6 / 174.47 | 7 / 7 / 7 | 7 / 7 / 7 | P1, high (~175.6 s) | **inferred** (absence) | correct | none |
| 12 | K | 187.7 / 187.63 | 8 / 8 / 8 | 8 / 8 / 8 | P6, high (the head hides the near half; the far side is visible) | pocket event (189.43 s) | correct | none |
| 13 | L | 199.6 / 199.53 | 9 / 9 / 9 | 9 / 9 / 9 | P4, high (~200.2 s) | pocket event (200.13 s) | correct | none |

## Does 12/13 still stand?
Yes. Nackers' account and Claude's truth agree on everything the scorer checks: 13 shots, which ball was made on each,
no scratch, and the first ball on all 12 non-break shots. The only factual error in Claude's truth is the rail count on
shot 2, which the scorer does not use. The original numbers stand unchanged:
- Cycle 2 best: 12 correct, 1 unresolved, 0 confidently wrong, 0 missed or false shots, 0 false pockets.
- v0.6: 11 correct.

Two qualifications:
- **Shot 1's start look:** the "correct" result for shot 1 is judged on the table after the break. In the racked-table look,
  the system named only the cue, the 2 and the 5; the other 7 balls were "not seen at rack start". The starting rack
  itself was not read.
- **First ball:** 11/13 agree with both accounts and none disagree. For shot 7 that is agreement, not proof: Nackers
  reports near-simultaneous contacts, and the reading comes from 30 fps tracking.

## Pocketed balls: observed event vs inferred
| Ball | Pocket | Confidence | System evidence |
|---|---|---|---|
| 1 | P3 | high | direct pocket event |
| 2 | P5 | high | inferred (absence + count) |
| 3 | P2 | high | direct pocket event |
| 4 | P5 | medium-high (partly behind the body) | direct pocket event |
| 5 | P6 | high | inferred |
| 6 | P6 | high | inferred |
| 7 | P1 | high | inferred |
| 8 | P6 | high | direct pocket event |
| 9 | P4 | high | direct pocket event |

- 5 of 9 balls were seen going in; 4 were inferred from the next still table. All 4 inferred balls went into far pockets
  (P1, P5, P6). Two far-pocket drops (the 4 and the 8) did produce events.
- The system has **no pocket identity**. A pocket event carries table coordinates at the mouth, and those coordinates
  match the pockets above. Mapping coordinates to P1-P6 was done here by hand, from the camera view. For the 4 inferred
  balls, the system has no location at all.

## Demonstrated vs intended
Demonstrated on this one rack, a good view:
- Finding the table outline once, at frame 1, and keeping it for 3.5 minutes.
- Detecting all 13 shot starts with no false shots, within 0.2 s (0.7 s when the body blocks the view).
- Identifying the balls on settled tables after every shot: 0 confidently wrong.
- Knowing which ball was pocketed on every shot: 5 seen going in, 4 inferred, 0 false pockets.
- Keeping a coherent table state through body and head occlusion (shots 9 and 12).
- Holding back instead of guessing when the 6 was hidden (left unresolved, not removed).
- A first-ball reading that agrees on 11/13, with the other 2 left blank.

Not demonstrated, or not present:
- **Pocket identity (P1-P6):** not computed.
- **Pocket location for absence-inferred balls:** unknown.
- **Reading the racked balls / establishing the starting table S0:** failed in this run.
- **Table orientation:** foot/head end not determined.
- **Detecting camera movement:** absent. The motion sensor is logged by R0.7, but nothing reads it.
- **Occluder awareness:** the system does not know that a hand is covering the 6. It only sees the 6 missing with nothing
  to explain it.
- **Keeping a hidden ball "present but hidden":** the current choice is "unresolved".
- **Secondary contacts, rail counts, and stroke or cue-impact recognition as its own event:** not measured.
- **Rules and fouls, and inverse physics:** deliberately absent.

## Architectural concerns
1. **Pocket IDs need two missing pieces:**
   - a pocket event for every drop, in all six pockets (the far pockets are small in the image);
   - a mapping from table coordinates to physical pockets.

   Today, the table coordinates are camera-relative: x runs left to right and y runs near to far, as the outline's corners
   come out. A pocket ID derived from them would be camera-relative too, until orientation exists.
2. **Orientation from the rack does not need ball identities.** The rack's position (a tight cluster at one end before the
   break) marks the foot end even though the system could not read the racked balls. So the orientation plan does not
   depend on solving rack reading. This is a design note, not tested.
3. **Camera movement:** the outline is found once. If the phone moves, every coordinate and every pocket ID silently
   shifts. Detecting this belongs to the perception layer. R0.7 already records the motion sensor, which could be a cheap
   signal.
4. **Occlusion handling should stay in tracking:**
   - Do not remove a ball without movement or pocket evidence.
   - For the 6, the evidence was: it had not moved, no pocket event, and its spot was covered.
   - The current tracker treats "not seen" and "covered" the same.
   - This is the same problem behind the settle-cut finding in RESULTS.md: which still moment is clear enough to read.
5. **Layer boundary for contacts:** perception should report "first contact = 5, confidence X, contacts N ms apart",
   never "foul". On shot 7, at 30 fps, the confidence would honestly be limited. That is where future high-frame-rate or
   inverse-physics work would plug in.
6. **The evaluation harness, not the system, cuts the rack into shots.** The scorer still takes one shot per clip. That
   is fine for now, but the numbers above describe per-shot table states, not a native rack-level output.
7. **Truth quality:** the shot count, made balls and first balls are now agreed by two independent viewers. The pocket
   labels rely on Claude's video check, consistent with Nackers' wording. Rails and secondary contacts are human-only facts.

## Future research concept (recorded, not planned)
Inverse-physics contact order (Nackers, 2026-10-21): for an ambiguous collision such as shot 7, compare the observed
incoming and outgoing paths of the cue ball and object balls with simulations of each possible contact order. The cue
ball's outgoing direction is the most telling. This belongs after perception and rules, together with higher frame rate
analysis.
