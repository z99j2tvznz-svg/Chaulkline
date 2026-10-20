# One shot per clip vs Evening check (Oct 20, 2026)

Session rec-20261019-1710 (recorder R0.6, low side, 24 clips, clip004 redo skipped -> 23 analysed). Frozen v0.4
(detector-v1, clip-detect unchanged since 67a7cc4, run at e542f5f), tracker defaults, no outline-check, no one-cue rule.
Evidence: evidence/rec-20261019-1710 (sha256 verified). Records: records/rec-20261019-1710. Viewer: viewer/rec-20261019-1710,
published https://claude.ai/artifact/SxuzzFnhtuvLrjHvJzJNc1

| | Evening check (Oct 18) | Tonight (Oct 19, 1 shot/clip) |
|---|---|---|
| Clips analysed | 20 | 23 |
| Shots found | 46 | 22 (clip014 has 2: second is likely ball in hand) |
| Table settled at clip end | 11/20 | 23/23 |
| Balls reported in | 31 | 11 |
| Reported in but not confirmed | 30 (97%) | 8 (73%) |
| ... cause "end state" (table not settled) | 8 | 0 |
| ... cause tracking (lost mid-roll) | 12 | 6 |
| ... identity / detection-or-identity | 3 / 6 | 1 / 0 |
| ... pocket decision | 1 | 1 (clip024 9: called in, uncertain) |
| Pocket calls (supported) | 12 (1) | 4 (3, all right) |
| Moving-ball time seen | 46% | 54% |
| Confirmed in but not reported | 0 | 0 |

Confirmed: one shot per clip removes the "end state" failures. Still failing: tracking loses the ball mid-roll
(clip003, 015, 017, 018, 020, 023). Small sample (11 balls), different racks: rates are indicative only.
Nackers' note: first rack messy; after a non-legal hit, ball in hand was taken at the end of that clip.
