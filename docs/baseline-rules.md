# Offline baseline: rules written before any footage is run

Written Oct 18, 2026, before the baseline was run on any session (agreed with Nackers and the ChatGPT review; see
`chalkline-data/plans/rebuild-decisions.md` section 18). These rules may not be loosened or tightened after seeing
results. Any change after the first run is a new version, scored again from scratch, and the first run stays on record.

The baseline joins parts that already exist: the old app's table outline and ball finder/recogniser (per clip frame,
`tools/clip-detect.js`), the new tracker's shot timing (`tools/tracker.js`, unchanged), plus two new parts: the
settled-table check (`tools/reconcile.js`) and the rack scorer (`tools/score-racks.js`). Nothing in the app or the
recorder changes.

## 1. What a shot outcome must establish (v1)
1. Whether a real shot happened.
2. Which balls left the table, by number, cue ball included.
3. For each, how: pocketed, or left another way.
4. The 9-ball state after it: which balls are still on the table, the lowest ball, rack over.

Not required for v1: which pocket, exact positions, first ball hit, rail contact. First ball hit is reported as a
separate research number only.

## 2. Settled observations (what the camera says is on a still table)
- **Before** a shot: the clip's frames from 1.5 s to 0.2 s before the tracker's shot start. With no shot in the clip:
  the first 1.0 s of the clip.
- **After** a shot: the last 1.0 s of the clip. It is **settled** only if the tracker has no ball moving in that second.
  If something is still moving, the observation is not settled and nothing in that shot can be confirmed.
- Spots from those frames are grouped when within 1.5 in of each other. A group counts as a ball if it is seen in at
  least half the frames and its average "not a ball" score is under 0.5.
- A group's number: add up the recogniser's score for each number over the frames where it is a confident look
  (score >= 0.6, "not a ball" < 0.5; the tracker's existing thresholds). The number is **confident** when its total is
  at least 2 and at least twice the next number's. Otherwise the ball is seen but unnamed.
- Each number is on the table at most once: if two groups are confidently the same number, the higher total keeps it
  and the other becomes an unnamed ball.

Fixed design numbers introduced here (not fitted to footage): 1.5 s / 0.2 s / 1.0 s windows, 1.5 in grouping, half of
the frames, the 2x margin.

## 3. Memory (one record per ball number, cue ball = 0, 1 to 9)
Each record has a status: **present** (seen at the last settled look), **present, unconfirmed** (not seen, nothing
explains it), **pocketed** (confirmed), **left the table** (confirmed, another way), and the reason for its last change.
Unnamed balls seen on the table are counted, not given a number.

## 4. Settled-table check: rules for each ball, at every settled observation
- **R1 Seen.** A ball confidently seen is present. If memory had it pocketed, the pocketing is reversed and recorded
  as a reversal.
- **R2 Confirmed pocketed** needs all three: the tracker logged a pocket event for this ball in this clip (by its
  number, or by being the only missing ball when the event has no usable number); the ball's last seen spot was inside
  the pocket mouth zone (within 5.5 in of a pocket, the tracker's own zone) or it was seen sitting in the jaws; and the
  settled after-observation does not see it.
- **R3 Heading toward a pocket is not enough.** A pocket event whose ball was last seen outside the mouth zone gives
  "possibly pocketed": unresolved.
- **R4 Missing with no explanation** stays on the table as present, unconfirmed, and is unresolved. It is never
  removed silently.
- **R5 Not settled:** if the after-observation is not settled, nothing is confirmed in that shot; every missing ball
  is unresolved.
- **R6 Unnamed balls:** when unnamed balls are seen, a missing number may be one of them, so it stays present,
  unconfirmed (unresolved), never removed.
- **R7 Appearing balls:** at the start of a rack every seen ball is present. Later, the cue ball reappearing after a
  scratch is present (ball in hand). A numbered ball reappearing after a confirmed pocketing is R1 (a reversal).
- **R8 Left the table another way / removed by hand** cannot be confirmed in this baseline (no off-table or hand
  evidence yet). Such balls end up unresolved under R4.
- **R9 The game updates only from confirmed changes.** Balls on the table = present + present, unconfirmed. The lowest
  ball is flagged uncertain if any lower-or-equal ball is unconfirmed. The rack is over only when the 9 is confirmed
  pocketed.
- Pocket mouths come from the table size (the tracker's default positions). Pocket positions stored in the truth files
  were fitted to where balls went in, so they are **not** used.

Every settled check writes a trace: previous state, balls seen (with confidence), unnamed balls, tracker pocket events
with their evidence, proposed changes, confirmed changes, unresolved items, and the game state after.

## 5. Two ways to run a rack
- **Continuous** (what a player would get): memory starts empty at the start of each rack (the player starting a rack is
  the only outside input), is filled from the first settled look, and is carried from clip to clip with no help.
- **From checkpoints** (for finding which part fails): before each clip the scorer sets memory to the verified truth
  for that moment. This is for scoring only; the tracker and the finder never see truth in either mode.
They are reported separately and never combined.

## 6. Scoring
Per real-shot clip, the required facts (section 1) are compared with truth, each fact only where truth can verify it:
- **Confidently wrong** if any fact is asserted wrong: a real shot not found, a ball confirmed pocketed that did not go
  in, or a ball confirmed present (seen) that was gone.
- **Unresolved** if nothing is asserted wrong but a required fact is left open (a ball that went in is left unresolved,
  a ball still on the table is left unconfirmed, or the after-look was not settled).
- **Correct automatically** otherwise.
- **Unverifiable**: facts the truth cannot check are left out, with the reason. A clip with no checkable facts is not
  scored.
Non-shot clips: a shot found there is a **false shot**; any ball confirmed pocketed there is a confidently wrong change.

Per rack: **completion** (every real shot correct automatically and no false shots) and **integrity** (no confidently
wrong result and no false shots; unresolved allowed), plus the correction burden (unresolved items a player would have
to settle). Shown side by side, never as one score.

At each checkpoint where truth knows the inventory, errors are also split:
- **observation errors**: a ball on the table not confidently seen, or a confident number for a ball that is not there;
- **state errors**: memory confidently wrong (confirmed pocketed but present, or confirmed present but gone).

## 7. What is held back
The recorder run's breaks and play clips (rec-20261017-1730 sections "breaks" and "play") are not run in this
baseline. They, and every session that arrives after this baseline is frozen, are kept for later testing.
