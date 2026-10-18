# Offline baseline, first run (frozen Oct 18, 2026)

This is the first and only run of the thin end-to-end baseline. It joins the old ball finder, the new tracker's shot timing, and a new step that compares the table before and after each shot. The rules were written down before any footage was run (`docs/baseline-rules.md`, commit 9e18726). Nothing was tuned after seeing these numbers. Any change from here is a new version and gets scored again from scratch.

Code: commit c7cc9a1 on branch `claude/project-thread-9vpr76`. Raw results for each session are in `baseline-2026-10-18/`, as a table (.txt) and as full traces (.json).

## The short answer

- **Confirmed:** on real play it called no rack correctly from start to finish. That is 0 of 5 racks completed without help and 0 of 5 racks with no confidently wrong call. The reason is that wrong calls happened on almost every rack.
- **Confirmed:** the step that compares the table before and after each shot (memory) is not the main problem. Re-setting memory to the truth before every clip barely changed the results (Oct 16: 0 shots correct with no help, 3 with re-setting; the other sessions were identical). The errors start fresh in each clip, from what the camera reports.
- **Likely:** there are three main causes, in this order:
  1. The ball finder reports the wrong thing.
  2. Pocket evidence is too thin to confirm made balls.
  3. Clips end before the table is still.

## Results for each session

The **Before re-set** columns are what a player would get with no help. In the **After re-set** columns, memory is re-set to the truth before each clip, which shows where the errors start.

| | Oct 16 (development), before re-set | Oct 16, after re-set | Oct 17 other side, before re-set | Oct 17 first spot, before re-set | Recorder shots, before re-set |
|---|---|---|---|---|---|
| Real-shot clips | 24 | 24 | 9 | 26 | 18 |
| Correct with no help | 0 | 3 | 0 | 0 | 4 |
| Unresolved (left for the player) | 11 | 10 | 3 | 11 | 10 |
| Confidently wrong | 13 | 11 | 6 | 15 | 4 |
| Real shots missed | 4 | 4 | 1 | 5 | 3 |
| False shots | 2 | 2 | 1 | 1 | 1 |
| Ball called pocketed that did not go in | 2 | 0 | 0 | 1 | 1 |
| Made ball left unresolved | 10 | 10 | 5 | 9 | 16 |
| Made ball called still on the table | 3 | 3 | 1 | 2 | 0 |
| Ball on the table, not named by the finder | 18 | 18 | 26 | 91 | not checkable |
| Ball named by the finder, but gone | 11 | 11 | 10 | 10 | not checkable |
| Memory confidently wrong | 8 | 8 | 9 | 8 | not checkable |
| Corrections a player would make | 25 | 22 | 14 | 28 | 16 |
| First ball hit (research only) | 13/19 | 13/19 | 2/8 | 5/18 | not scored |

For both Oct 17 sessions, the after-re-set results were the same as the before-re-set results, except for corrections (13 for the other side and 23 for the first spot). For the recorder, each clip starts from its own layout, so the two columns are the same.

The validation data is everything except Oct 16. Across it, 4 of 53 real-shot clips were correct with no help, 24 were unresolved, and 25 were confidently wrong.

**Recorder rest and hands clips (no shot):** 15 of 16 were clean. One had a false shot (clip016), and none had a ball wrongly called pocketed.

## What went wrong, and how sure we are

1. **The ball finder.** *Likely* the biggest source of confidently wrong calls.
   - It named 31 balls that were already gone, for example reading the 8 as the 2. A gone ball that is "seen" counts as still on the table. That is a confident error.
   - It also missed many balls that were there. From the first spot it missed 91 of them, mostly far balls. Missing balls are not wrong calls, but they leave a lot unresolved.
2. **Pocket evidence.** *Confirmed* that this is why made balls stay open. 40 made balls were left unresolved and only a handful were confirmed. Most traces say "not seen, nothing explains it": the tracker never logged the ball going in at a pocket mouth. The rule that heading toward a pocket is not proof worked as intended. It refused to guess.
3. **Missed shots.** *Confirmed:* the tracker missed 13 real shots out of 77, plus 5 false shots.
4. **Clips ending too early.** *Confirmed:* in 20 of the 71 Oct 16 and Oct 17 clips, a ball was still moving in the last second, so nothing could be confirmed.
5. **Recorder shots did best.** *Likely* because there was one object ball, a known layout and good light. All 4 shots that came out fully correct were there, and none of the calls about the table there were confidently wrong.

## Disclosures

- One fix was made to the scorer after the first look, before anything was frozen (commit c7cc9a1). Items left open used to be counted again in every clip; now each is counted once. A file the scorer ignores used to make the code version read as changed; that is fixed too. Both affect how results are counted only. Neither changes any rule.
- The tracker's settings were tuned on Oct 16 footage earlier, which is why Oct 16 is labelled development.
- One reviewer wrote all the truth files, except your tap answers on the recorder shots. Recorder layouts are scripted, so what was on the table there is not checked.
- Held back and not run: recorder breaks and play clips, and every session that arrives after this freeze.
- Each recorder clip's table outline was found automatically: 27 of 34 at confidence 1.00, and all of them at 0.85 or higher.

## Where this points (for discussion, nothing built)

The cheapest big win is likely the **eyes**, not the memory. Two candidates:

- **A:** better ball naming (the trained detector), so gone balls stop being "seen".
- **B:** better pocket evidence, so made balls can be confirmed.

Clip length, meaning recording until the table is still, is a smaller, simple fix on the recorder side.

## Frozen reference

| Session | Truth file | Truth hash (sha256, first 12) |
|---|---|---|
| Oct 16 | 2026-10-16_evening_V2.3.3.json | 81d6aff5e1eb |
| Oct 17 other side | 2026-10-17_1500_V2.3.3_otherside.json | dc8bca442d4b |
| Oct 17 first spot | 2026-10-17_2151_V2.3.3_firstspot.json | 4f9f3dea0345 |
| Recorder (rest, hands, shots) | rec-20261017-1730.json | 54430e368c6c |

Code c7cc9a1. Re-run: `node tools/score-racks.js <detections dir> data/truth/<file> --v`.
