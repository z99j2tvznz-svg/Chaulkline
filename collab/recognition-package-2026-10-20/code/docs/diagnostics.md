# Diagnostic phase after the first baseline (Oct 18, 2026)

Agreed after the ChatGPT review of the first frozen baseline (`docs/baseline-2026-10-18/`). This phase measures; it
does not change any rule in `docs/baseline-rules.md`, and every baseline number comes out the same without the new flags.

Run: `node tools/score-racks.js <detections> <truth> --diag [--oracle obs|pockets|both]`

## A. Detection versus naming
At each clip's final look where truth knows what is on the table: balls on the table (N), the finder's ball groups (D),
groups named right (C), groups named with a number that is not on the table (Wn), groups seen but unnamed (U). Truth
has no ball positions, so the split is by counts: at least max(0, N - D) balls were not detected at all, and at least
max(0, D - N) groups were not balls. Each "named, but gone" ball is also checked against what sat at that spot in the
before-look (balls that were not hit stay put): another ball still on the table there means a misread of that ball;
the same number at the same spot in both looks means something that sits still and is read wrong every time.

## B. Oracle-assisted runs (diagnostic only, never product performance)
- `obs`: the before and after looks are replaced by the verified inventory, only where truth can verify it.
- `pockets`: the tracker's pocket events are replaced by the verified made balls, only where truth can verify them.
- `both`: both.
Shot timing, the still-table check and all rules run as normal. Truth never reaches the tracker or the finder. Reports
from these runs are labelled ORACLE-ASSISTED DIAGNOSTIC.

## C. Still and moving final looks
Real-shot clips are scored apart by whether the final second was still (by the tracker's own motion, not checked by eye).

## Shot finding
Real shot events (a clip can hold more than one), found, missed; false shots in clips with no shot; extra shots inside
real-shot clips (a duplicate or a false shot, the scorer cannot tell which); minutes of footage. A missed or false
shot makes the clip "confidently wrong"; the top-level outcome per clip is one of correct / unresolved / wrong, and the
error flags under it may overlap.

## What-if pocket rule (evaluated, not used)
A ball clearly seen before the shot, gone from a still after-look in which every ball the finder saw was named, is
counted as a call. Truth says whether each call would have been right. The real rule (R2) is unchanged.

## D. First picture set to label
`tools/pick-label-set.js` picks pictures from development footage only (before Oct 17); Oct 17 and the recorder run
stay test data. It picks; it labels nothing. The app's own ball spots go along as a prefill to check, never as truth.
