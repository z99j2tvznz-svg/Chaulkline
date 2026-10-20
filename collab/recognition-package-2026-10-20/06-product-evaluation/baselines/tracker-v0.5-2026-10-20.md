# Tracker v0.5 (Oct 20, 2026)

**What it is:** v0.5 is v0.4 plus the two collision-identity options, relink and contact (see
collision-identity-2026-10-20.md). The table-outline check and the one-cue-ball rule are not included.

**Code and how to run it:** commit 6ee6b20, `tools/tracker.js`. Select it with `{ version: 'v0.5' }`, or
`score-racks.js --track '{"version":"v0.5"}'`.

**The frozen baseline is safe:** v0.4 stays the default. A test checks that it is byte-identical to the defaults and
that v0.5 equals v0.4 with relink and contact on. All 43 tests pass.

**How it was scored:** independently, on the same frozen v0.4 detections (detector-v1), for 6 sessions. That includes
the Oct 19 one-shot session, with a new truth file made from Nackers' tap answers (`data/truth/rec-20261019-1710.json`).
Raw numbers: tracker-v0.5-2026-10-20.json.

| Session | Moving-ball coverage | Ball tracks | Clips with 2+ cue names | Pocket calls | Score changes (rack scorer) |
|---|---|---|---|---|---|
| Evening check Oct 18 | 46% → 55% | 141 → 138 | 13 → 12 | 12 → 16 | confidently wrong 3 → 2, false shots 2 → 1, made left unresolved 30 → 29, unresolved 12 → 13 |
| One-shot Oct 19 | 55% → 65% | 188 → 182 | 12 → 10 | unchanged | none |
| Recorder Oct 17 | 43% → 44% | 111 → 109 | 5 → 2 | 4 → 5 | none |
| Oct 16 | 59% → 61% | 178 → 175 | 5 → 4 | 9 → 10 | correct 0 → 2, unresolved 19 → 17, made left unresolved 13 → 12 |
| Oct 17 first spot | 71% → 79% | 151 → 149 | 22 → 20 | 4 → 5 | made left unresolved 10 → 9 |
| Oct 17 other side | 71% → 72% | 78 → 77 | 2 → 1 | unchanged | none |

Fewer ball tracks for the same balls means fewer identity breaks.

**First ball hit** (sessions with hand-checked first balls):

| Session | v0.4 | v0.5 |
|---|---|---|
| Oct 16 | 13 | 17 of 22 |
| first spot | 7 | 8 of 22 |
| other side | 8 | 9 of 9 |
| **Total** | **28** | **34 of 53** |

**Regressions (Confirmed):** none.
- Per clip, no new wrong answer in any of the 6 sessions, and one was fixed (Oct 18).
- No new phantom pockets or false shots in any session.
- The Oct 18 "unresolved 12 → 13" is one more honest "don't know", not a wrong answer.

**Uncertainty:** when contact cannot tell two balls apart (spots under 1 in apart along the hit line), both names are
cleared and each ball is named again only from looks after it stops. It never guesses.

**Known follow-ups (not blockers):**
- two-ball clusters;
- the break;
- the name flips seen with the one-cue rule, which stays a separate experiment;
- the outline check, to be evaluated separately on top of v0.5.
