# Chalkline debug sessions

The owner's debug files (Save debug in the app), unzipped, one folder per session: `log.json` (the app's events, the
tracker's events, every look's spots, taps), the shot pictures before and after, and `taps/` (crops of tapped balls).
This branch is not published by GitHub Pages; the app lives on `main`. Times are the owner's local time (Pacific).
The trimmed copies the tests use are on `main` in `tests/fixtures/v3/`, with the truth for each shot taken from the pictures.

| Folder | App | Owner's account | Review |
|---|---|---|---|
| 2026-10-26-2248-V3.0 | V3.0 | Crashed, mirroring off too. Outline a little off the rails, did not follow a swaying tripod. | Graphics chip crash; led to V3.0.1 (processor, several cores, steady outline). |
| 2026-10-26-2312-V3.0.1 | V3.0.1 | No crash; balls named right; after a shot they never stop rolling. | Rest test never met at the phone's look rate; pocket "back" stuck. Led to V3.0.2. |
| 2026-10-26-2350-V3.0.2 | V3.0.2 | Missed pockets, a false pocket, lost the cue ball, the 9 on the rail lost its name and could not be tapped, a one-rail miss not seen. | Live 11 of 18 right. Led to V3.0.3 (replay 17 of 18). |
| 2026-10-27-2227-V3.0.3 | V3.0.3 | First naming very good. A pocketed ball (the 5) leaves a dashed ghost that never clears; the ring lags a rolling ball. | Live 29 of 42 right, 13 balls in missed, 1 false scratch. Struck balls gone between looks are left "hidden" for good; two shots not seen at all. |
| 2026-10-27-2338-V3.0.4 | V3.0.4 | Scratched several times: the cue ball put back stays "?". Tracking smoother, still lags. Asks for colour trails. | Live 30 of 31 real shots right (false "3 in" on a scratch shot; two false shots in the rack-2 roll-out). Cue ball never named again after a scratch (its number counted as pocketed). Led to V3.0.5. log.json's header has the end-of-session picture size; the fixture on main has the one the table was accepted with. |
