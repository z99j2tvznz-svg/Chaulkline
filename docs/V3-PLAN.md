# Chalkline V3 plan (agreed in discussion, Oct 27, 2026; not built yet)

Nothing here is built until the owner says "build it". This replaces the Oct 17-25 rebuild path (offline cycles with
pre-registered scoring), which took about ten days and put nothing new on the phone.

## Starting point

V3 starts from the live app, V2.3.3 (`src/`). Kept: camera handling, table finding, the top-down map, physics, planner,
look and feel, Save debug. Removed: the pile of per-case naming rules in Watch & Learn (cue-end rules, count-based
targets, mask re-checks and similar), which fixed one case and broke another.

Brought in from the side branches (`claude/project-thread-vl1o4a`, collab package):
- **Ball finder:** detector-v1 (YOLO11n, `best.onnx`). Found 99% of balls, including far ones, with 1 false ball in
  24 pictures against 10 for the old finder. This is the fix for phantom balls on arms, hands and the cue.
- **Number reader:** Challenger B (small network, Oct 20). Right 97% of the time when sure; the 9 read as the cue ball
  went from 120 of 210 test pictures to 0.

## What changes in how balls are named

1. **Names ride with the balls.** A ball is named while the table is still, then followed through the shot. It is not
   re-read every frame. It is renamed only when the evidence over several still looks strongly disagrees.
2. **A tap is the strongest evidence.** When the player taps a ball and picks a number, that name sticks to that ball
   (not to a spot on the table) until the ball is pocketed or the player changes it. The pictures of that ball are
   saved as examples, and the reader is retrained on the owner's own balls between sessions.
3. **Measle cue ball vs the 9.** The owner's cue ball is white with red dots; the 9 is white with a yellow stripe.
   Three checks: a dedicated yellow-band vs red-dots check on those two; the ball that moves first in a shot is the
   cue ball; and a followed cue ball is not re-read when it stops next to the 9.
4. **Nothing new while someone is over the table.** New balls are added only when the table is still and clear.
5. **When unsure, ask, don't guess.** Unsure balls are shown as unsure. "New rack" is a button, not a guess.

## Camera: any orientation

The app no longer forces landscape. Portrait (for example on the short rail, looking down a 7 ft table) and landscape
both work. The app finds the table in whichever orientation the phone is held. Table coordinates do not change with the
orientation, so results stay comparable. Setup asks once which end is the head rail.

Caveat: the ball finder and reader were trained on side-view footage only. From the end of the table, far balls are
smaller and balls hide behind each other more often. The owner's taps and retraining are expected to cover this.

## Lag drill (V3.1, after V3.0 works)

Replaces the Oct 22 cue-ball test, which was not realistic. Solo, one ball.
- The player shoots from behind the head string to the foot rail and back.
- Score: the gap between the ball and the head cushion, in balls (2.25 in), to the nearest quarter ball (0, 1/4, 1/2,
  3/4, 1, 1 1/4 ...). No finer detail.
- Faults (from the usual lag rules): touches a side rail, does not reach the foot rail or hits it more than once,
  pocketed or off the table, crosses the long string.
- Self-check without tape: a ball frozen to the head cushion must score 0; with a second ball as a spacer, 1.
- Note: a quarter ball is about 0.56 in. The Oct 22 low side view had a systematic error of about 1.4 in near the rail,
  so quarter-ball scoring needs the head rail close to the camera or a fix for that offset.

## Testing

- The owner tests on the phone, several times a night when possible. Each version comes with a short list of what to
  try (about 15 minutes).
- Save debug zips go in the Google Drive folder "Chalkline test uploads". Claude sorts them into one subfolder per test
  night and keeps the log.
- Quick automatic tests (`npm test`) keep the app from breaking. No pre-registered scoring cycles.

## First check before building

Whether the ball finder runs fast enough in Safari on the owner's iPhone (ONNX Runtime Web). A small test page comes
first. If it is too slow, it runs on a smaller picture, or less often (when the table settles), before anything else
is built on it.

## Later, not now

- Plan a layout (place balls on the map, get a shot suggestion): only if the owner wants it.
- Licence: detector-v1 was trained with Ultralytics YOLO (AGPL). Fine for this open repo; before any paid or closed
  release, retrain on a permissively licensed detector.
