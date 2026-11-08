# Reader v3: the cue ball, 1-15, not a ball

Taught the stripes 10-15 on the owner's 15-ball practice sessions of Nov 8, 2026 (13:04, 13:09, 13:13, 14:09, 14:15;
the `sessions` branch). Same network, crop and augmentation as reader v2 (benchmark "Challenger B"), 17 outputs.

- `extract.py`: every ball the finder (detector-v1 960 x 544) sees on the table in each session's before/after pictures
  (960 x 540), with reader v2's reading.
- `labels-20261108.json`: the label of each spot (0 cue, 1-15, 16 not a ball, -1 left out: two balls in one crop, blurred,
  too small to tell). Labelled by Claude from contact sheets: colour from reader v2, stripe or solid from the white shown,
  stripes seen end on (a white cap with a coloured ring) one by one, checked so that no picture has a number twice.
- `train.py`: v2's training data (the Oct 12-17 crops, all splits) plus these; each class weighted equally, half old and
  half new where both exist; 30% of crops shrunk and enlarged back (the live crops come from 1920 x 1080 pictures).
- `eval.py`: each session read by a reader trained without it; the temperature is fitted on those held-out readings.
- `oldeval.py`: reader v2 against v3 (limited to 0-9, as in 9-ball) on v2's own test crops.
