# Naming balls at rest: where settled-table naming fails (Oct 20, 2026)

**Setup:** v0.6 unchanged, on the frozen detections (outline keep-first for the recorder sessions, v0.4 for the V2.3.3
sessions). Every settled look the rack scorer takes is used: the start look before each shot, and the end look when the
table is settled. They are compared with the true table where truth knows it (verified rack clips and scripted recorder
layouts). The Oct 19 session has no true tables, and Oct 18 has only 1 clip with one.

**Tool:** `tools/experiments/rest-naming.js` (read only). Raw numbers: rest-naming-2026-10-20.json.

## Per session (Confirmed)
| Session (camera) | Look | Looks | Whole table right | True balls | Named right | 1. Unnamed | 2. Wrong number | 3. Not detected |
|---|---|---|---|---|---|---|---|---|
| Oct 16 (side, close) | start | 29 | 19 | 170 | 155 | 11 | 0 | 4 |
| | end | 27 (+2 unsettled) | 22 | 141 | 134 | 6 | 1 extra name | 1 |
| Oct 17 other side | start | 12 | 1 | 69 | 49 | 12 | 7 | 1 |
| | end | 7 (+5 unsettled) | 2 | 37 | 29 | 5 | 3 | 0 |
| Oct 17 first spot (far) | start | 27 | 0 | 165 | 74 | 59 | 10 | 22 |
| | end | 24 (+3 unsettled) | 0 | 134 | 61 | 51 | 7 | 15 |
| Oct 17 recorder | start | 26 | 10 | 100 | 58 | 32 | 7 | 3 |
| | end | 26 | 19 | 82 | 49 | 30 | 1 | 2 |
| Oct 18 (1 known table) | start / end | 1 / 1 | 0 / 0 | 10 / 10 | 9 / 9 | 1 / 1 | 0 | 0 |

**Totals:**
- Start tables: 345 of 514 balls named right (67%).
- End tables: 282 of 404 balls named right (70%).
- 291 failing balls: 208 unnamed (71%), 35 wrong number plus 1 extra name (12%), 48 not detected (16%).

## Inside the categories
**1. Detected but unnamed (208):**

| Reason | Balls |
|---|---|
| Reader says "not a ball" | 91 |
| Number taken by a surer spot (two spots read as the same number; the weaker one is left blank) | 71 (32 of them read as the cue ball) |
| Reader not sure | 27 |
| Seen too briefly | 19 |

**2. Confidently wrong number (35):**
- Other side: the 8 read as the 2, 11 times.
- Recorder: the 1 read as the 5, 5 times.
- Far camera: 4, 5 and 7 read as 2 or 3.

**3. Not detected (48):**
- 37 are on the far camera.
- On two far-camera clips I re-ran detection, keeping the boxes the cushion and pocket rules throw away. Only 1 of the 9 missing balls there was thrown away by the cushion rule. The rest were never found at all: racked balls merged together, or far balls the detector missed.

## Conditions (Confirmed, except where marked)
- **Lighting:** on the Oct 17 light1/light2/light3 steps, 10 of 60 balls were named. On the other recorder steps it was 97 of 122 (80%). Under changed light the reader calls nearly every ball "not a ball", with low confidence, so no counting rule can recover them.
- **Far camera:** 135 of 299 named (45%), against 289 of 311 (93%) on the close side camera.
- **Cue-ball confusion:** 36 failing balls. Mostly the 9 and the 4 read as the cue ball on the far camera. They are left blank, never named wrong.
- **Clusters:** 13 failing balls (the cluster step, and the rack before the break).
- **Frozen on a rail:** 13 failing balls, all on the far camera. This is a likely undercount, because a missing ball's position is often unknown.

## Checks
- **Alternate frame sampling:** using every other frame (two offsets), every count moved by at most 3 per line. The categories are stable.
- **Which number fails is matched by count for most balls.** Truth has no positions, so a missing ball is tied to a spot only by the reader's own votes for its number, or by the other look. Category counts are exact; the number assigned to each failing ball is Likely.
- **A logic-only fix was tried and dropped:** when a spot loses its number to a surer spot, give it its second choice if that is clear and free. It named only 4 more balls (out of 291 failing), and it risks a swap that cannot be checked. The code was not kept.

## What this means
Nearly all failures are the reader's eyes on still balls: changed lighting, small far balls, the 8/2 and 1/5 misreads, and the 9 and 4 against the cue ball. Re-weighting the settled-table check cannot fix them without forcing names.

The levers that respect "preserve uncertainty" are:
1. **Identity continuity from earlier verified looks.** This is being measured in another thread before any reader change.
2. **Per-table appearance calibration, or a reader retrain with lighting and size variation, from verified labels only.**

The cushion filter is a minor cause (Likely).
