# The diamond grid on Nackers' table

Measured by the player in the recorder setup (2026-10-17): the playing surface is 79.06 × 39.03 in, cushion nose to
cushion nose. The diamonds split it into 8 squares along the length and 4 across. The grid lines run between
opposite diamonds and are measured from the cushion noses.

Rails, as seen from the phone at its usual low-side spot:
- **left** and **right** are the short rails;
- **near** is the long rail closest to the phone, the one with the near side pocket (P3);
- **far** is the long rail with the far side pocket (P6).
Pocket IDs P1-P6 (fixed for this table): P1 far-left, P2 near-left, P3 near side, P4 near-right, P5 far-right, P6 far side.

| Diamond line | From the left rail (in) |
|---|---|
| 0 (left rail) | 0 |
| 1 | 9.88 |
| 2 | 19.77 |
| 3 | 29.65 |
| 4 (side pockets) | 39.53 |
| 5 | 49.41 |
| 6 | 59.30 |
| 7 | 69.18 |
| 8 (right rail) | 79.06 |

| Diamond line | From the near rail (in) |
|---|---|
| 0 (near rail) | 0 |
| 1 | 9.76 |
| 2 (centre line) | 19.52 |
| 3 | 29.27 |
| 4 (far rail) | 39.03 |

- One square is 9.88 × 9.76 in.
- A ball's centre sits on a grid crossing when its edge is 1.125 in (half a 2¼ in ball) short of the crossing's
  distance from each rail. For example, the ball for S (diamond 2, centre line) has its edge 18.64 in from the left
  rail and 18.40 in from the near rail.
- The tracker uses table coordinates in inches with x from the left rail and y from the near rail. It assumes a
  78 × 39 in surface, so its positions are scaled to this table's size when they are compared with measurements.
- Recorder layout pictures use the same grid in diamond units: x 0..8, y 0..4, y = 0 the near rail.
