# Old app (V2.3.3) vs tracker v0.4 / v0.5: pocketed balls on the same recordings (Oct 20, 2026)

Investigation only. Nothing in the tracker, app or architecture was changed.

## What was compared
- **Recordings:** the three sessions recorded *by* the old app V2.3.3: Oct 16 evening (29 clips, 2 racks),
  Oct 17 other side (13 clips, 1 rack), Oct 17 first spot (29 clips, 2 racks). 71 clips, 37 made balls, hand-checked
  truth in `data/truth/`.
- **Old app:** its own live calls, read from each session's `log.txt` (made, scratch, first ball per logged shot),
  matched to clip `shotNNN` = logged shot NNN. Sanity check: on Oct 16 this reproduces the hand count in
  `tonight-2026-10-16-V2.3.3.md` exactly (14 right, 1 "?", 3 missed, 5 phantoms, 4 false scratches).
- **New:** v0.4 and v0.5 run by `tools/score-racks.js` (continuous mode) on the frozen detector-v1 detections of the
  same clips. "Pocketed" = the settled-table check confirmed it.
- Balls the truth marks unsure (off camera) are left out. Script and raw numbers: `old-vs-new-2026-10-20/`.

**Caveat (Confirmed):** the old app watched live at ~60 fps with the whole session in view; the new pipeline sees only
each clip, sampled at 30 fps. That favours the old app slightly (it can see a ball drop after a clip ends).
Oct 16 is the camera spot the old app was tuned on and the detector was checked on (development footage).

## Results (37 made balls, 71 clips)

| | Old V2.3.3 | v0.4 | v0.5 |
|---|---|---|---|
| Made balls named right automatically | **27** (73%) | 5 | 7 (19%) |
| Made, but named as a different ball | 3 | 1 | 1 |
| Made, left open as a question ("?" / unresolved) | 1 | 27 | 25 |
| Made, silently missed ("nothing dropped" / "still on table") | 6 | 4 | 4 |
| False pockets (said down, was not) | **13** | 1 | 1 |
| False scratches | **7** | 0 | 0 |
| Confidently wrong pocket/scratch facts | **29** | 6 | 6 |
| Corrections a player would need (pocket + scratch) | 30, only 1 flagged | 33, 27 flagged | 31, 25 flagged |
| First ball hit right (53 checked) | 22 | 28 | 34 |
| Clips with every pocket/scratch fact right | 47 of 71 | 39 | 41 |
| Racks with every pocket/scratch fact right | 0 of 5 | 0 of 5 | 0 of 5 |

Per session, old app false pockets: Oct 16 5, other side 2, first spot 6. New confirmed makes: Oct 16 5, other side 0,
first spot 2 (v0.5).

**Plain reading (Confirmed on this footage):** your memory is right that the old app *named* far more made balls. It
did so by committing to an answer every time, which also produced about one confident wrong fact (false pocket, false scratch, wrong name, missed drop) for every right one,
almost none flagged. The rebuild almost never says something wrong, but it asks about two thirds of the made balls.
Neither is close to usable yet; they fail in opposite directions.

## What the old app actually did (Confirmed from V2.3.3 source and design notes)
1. **Absence + ball count = pocketed.** After the table settled it compared the before-shot and after-shot looks:
   numbers that vanished, capped by how many balls the count dropped by; if more numbers vanished than balls,
   the ones nearest a pocket won. No pocket-entry evidence needed. Count dropped but no number missing gave "?".
2. **A path ending in a pocket** could raise the count when part of the table was blocked.
3. **Blocked-view mask:** a ball under a player/cue was "can't see", not "gone".
4. **Sanity rule:** 3+ balls at once (not the break) was "didn't look right", not counted.
5. **Per-table learned looks** ("Show me the balls", Home/Away profiles) for the number reader.
6. **Next-shot self-correction:** if the first ball hit was judged illegal but the next shot started from where the
   cue ball stopped (no ball in hand), the two numbers were swapped and learned.
7. **Unseen-shot catch:** a settled table that changed while the view was blocked was logged as a shot.
8. **Continuous watching** (no clip boundaries), so late, slow drops still counted.

## What the rebuild lost (Confirmed / Likely)
- **Item 1 is the big one (Confirmed).** The new settled-table check only confirms a ball as pocketed when the
  tracker *also* saw it enter a pocket mouth. A ball that is simply gone from a still table is "not seen, nothing
  explains it", so it becomes a question. That is why 25 of 37 made balls are open in v0.5: the tracker loses the
  ball mid-roll (known), so the pocket event never comes.
- Items 3, 5, 6, 7 have no equivalent in the still-table check (Likely; the tracker has a "hidden" state while
  moving, but the before/after look has no blocked-view mask).
- Items 2, 4 and 8 are partly covered (pocket events, settled-table rule, one-shot clips).

## Would the old absence rule help on the new pipeline? (one untuned what-if, scorer's existing `--diag`)
Rule: a ball clearly named before the shot is gone from a still after-look in which every spot was named.
- Oct 16: 14 calls, **14 right**. Other side: 1 call, 1 right. First spot: 7 calls, **2 right, 5 wrong.**
- Adding the old count cap and "3+ at once = doubt": Oct 16 11 right, 0 wrong; other side 1/0; first spot 0 right,
  1 wrong. (Likely; tiny sample, Oct 16 is development footage, not tuned.)
- **Meaning (Likely):** the old rule works where the number reader is reliable (good view) and becomes the
  phantom-pocket machine where it isn't (first spot's small far balls). It is not a fix on its own; it is safe only
  when the before and after looks are trustworthy, i.e. gated by look quality per ball.

## Individual metrics vs whole-rack reliability (the ~98% goal)
- Per-fact numbers above look tolerable in places (old: 73% of makes named; v0.5: 64% first ball). A rack is
  only right if *every* fact is right: roughly 10-15 shots x (shot found, first ball, made balls, scratch).
- Clips fully right today: old 66%, v0.5 58%. At that rate a 12-shot rack is fully right well under 1% of the
  time, which matches the 0 of 5 racks for every version.
- For 98% of racks fully right without help, each shot must be right about 99.8% of the time (0.998^12 = 0.98),
  i.e. about 1 wrong shot in 500. Even 98% per shot gives only ~78% of racks.
- So the goal has to be met by **(a)** near-zero *confident* mistakes and **(b)** cheap, rare questions. Per rack
  today: old app ~6 unflagged mistakes; v0.5 ~1 unflagged mistake + ~5 questions on made balls alone.

## Recommendation (not started; needs your go)
Keep the rebuild's "never guess" core. Bring back the old absence + count rule as **one more piece of evidence**
in the settled-table check, allowed to confirm a pocket only when the ball's before and after looks are good
(clearly named before, a clean still after-look with no unnamed spots, count drop agrees, not 3+ at once). Score it
on all frozen sessions; success = more makes confirmed with zero new confident wrongs. The per-table learned looks
and next-shot self-correction are good later candidates.
