# Frame-rate comparison: 15 / 30 / 60 fps on existing footage (Oct 20, 2026)

**Setup:**
- Tracker v0.5 (code 82ed45b), detector-v1, the frozen table outlines, and the same scorers (`product-metrics.js`, `compare.js`).
- 6 sessions, 116 real shots. No code was changed.
- Labels: **Confirmed** = measured; **Likely** = reasoned from measurements; **Unknown** = not measurable with this footage.

## How it was kept fair

- **Same pictures at every rate.** Every clip was detected once at 60 fps (about 127,000 frames). The 30 fps sets keep every 2nd frame of that run and the 15 fps sets every 4th, so only the sampling differs.
- **Pipeline check (Confirmed).** Re-running the old 30 fps detection with the frozen outlines reproduced the frozen detections exactly, frame for frame. "frozen30" below is the existing baseline (28/116).
- **Sampling noise (Confirmed).** Two different, equally valid frame picks were scored at each rate:
  - at 30 fps: even frames, odd frames, and the frozen run;
  - at 15 fps: 2 picks.

  This shows how much results move just from which frames you happen to take.

## Main result (all 6 sessions)

| | 30 fps (3 picks) | 60 fps | 15 fps (2 picks) |
|---|---|---|---|
| **End table right, no correction** | **28, 29, 29** | **28** | **27, 26** |
| Confidently wrong | 28, 24, 30 | 28 | 25, 30 |
| Real shots missed | 8, 4, 6 | 5 | **8, 14** |
| False shots | 10, 11, 13 | 10 | 7, 7 |
| Made balls left unresolved | 78, 78, 73 | 75 | 80, 80 |
| Phantom pockets | 2, 3, 2 | 3 | 2, 3 |
| Start table: balls named | 258, 258, 261 of 376 | 258 | 256, 257 |
| End look: balls named | 97, 99, 97 | 97 | 91, 92 |
| Name changes on a track | 89, 94, 87 | **107** | 78, 64 |
| Ball tracks (fewer = fewer breaks) | 830, 833, 836 | 856 | 834, 837 |
| Moving-ball coverage | 62%, 58%, 61% | 60% | 61%, 59% |

Per session, end table right at 30 / 60 / 15 fps:

| Session | 30 fps | 60 fps | 15 fps |
|---|---|---|---|
| Oct 16 | 8, 8, 9 | 8 | 7, 7 |
| Oct 17 first spot | 0 | 0 | 0 |
| Oct 17 other side | 0 | 0 | 0 |
| Oct 17 recorder | 5 | 6 | 5 |
| Oct 18 Evening | 3, 4, 4 | 3 | 5, 3 |
| Oct 19 one-shot | 12, 12, 11 | 11 | 10, 11 |

## What each effect is

**1. Frame sampling alone (Confirmed).** Taking a different but equally valid set of frames at the same rate moves:
- end-table results by 1 to 2 shots in a session;
- confidently wrong answers by up to 6 across all sessions;
- coverage by up to 9 points in one session.

So a difference of 1 or 2 shots between two runs is noise, not progress. This applies to every experiment, not just this one.

**2. Frame-count assumptions in the tracker (Confirmed, small).** I tested the two settings that count frames, each according to its purpose:
- "frames seen before a spot is a ball" checks how long a spot lasts, so it should scale with time;
- "reader votes before a spot is a ball" collects evidence, and neighbouring frames at 60 fps are near-copies, so it was scaled to the same amount of looking time.

Scaling them to 60 fps changed the end table by 0 and +1 shots. Neither is a material problem today.

The one clear frame-count effect: **name changes on a track rise 15% at 60 fps** (107 vs about 90). The reader counts every frame as a separate vote, so more frames mean more chances for a name to flip. It did not reach the end-table result. Two other small vote counts in the code, which can't be set from outside, likely behave the same (Likely).

**3. Real tracking and naming gains from 60 fps (Confirmed: none measurable on this footage).**
- Ball naming is the same at 30 and 60 fps, both on the settled table before the shot and on the end look.
- Track breaks are slightly higher at 60 fps (856 vs about 833).
- No session improved beyond the noise.

**4. Pockets and end tables (Confirmed).**
- 60 fps: made balls left unresolved 75 (noise range at 30 is 73 to 78), phantom pockets 3 (range 2 to 3). No change.
- 15 fps is the only rate that clearly hurts:
  - real shots missed rise to 8 and 14;
  - the end look names 6 to 8 fewer balls.

  The cue ball's speed needs several samples in a short window, and at 15 fps a fast ball jumps too far between frames (Likely).

## Why 60 fps doesn't help yet (Likely)

Our losses are not caused by motion between frames. They come from:
- naming balls on a still table (far camera, lighting);
- unsettled end looks;
- uncertainty carried from earlier shots.

Those don't improve with more frames. Fast-ball cases where 60 fps should matter (breaks, power shots) are rare in these sessions, so that benefit is **Unknown**, not disproved.

## Other facts found

- **Recorder clips run at a steady 60 fps** (no gaps over 25 ms in the clips checked). The old app's clips drop frames: 37 to 45 gaps per clip, the longest 38 ms. So the invented frame time (frame number ÷ rate) is close to true for recorder footage, and less so for old-app footage (Confirmed).
- 60 fps analysis costs about twice the computing time for no gain today.

## Recommendation

1. **Keep analysing at 30 fps.** 60 fps gives no measurable product gain on our footage. 15 fps loses shots.
2. **Don't change the frame-count settings now.** No material problem was found. When we move to 60 fps or higher, change the reader's vote counting so near-identical frames don't count as separate evidence. That would be a targeted, scored change in a new checkpoint.
3. **Judge experiments against the noise.** Treat changes of 1 to 2 shots per session as noise unless they hold on a second frame pick. The 15 and 30 fps sets here can be reused for that.
4. **Next frame-rate evidence would be breaks and hard shots** (the Slo-mo follow-up). It isn't needed now.

**Files:** `frame-rate-2026-10-20/` contains:
- the 60 fps detections (`detections-60fps.tgz`), so 15 and 30 fps can be re-derived;
- the scoring scripts;
- `all-scores.json`, the raw numbers.
