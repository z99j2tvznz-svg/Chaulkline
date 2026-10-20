# Chalkline ball library (started Oct 13, 2026)
Source: every saved session so far (real1 V2.0, real2 V2.1, real3 V2.1 single-ball drill, real4 V2.2 Learn the balls
drill at home, real5 V2.2 Watch & Learn at home). Same 7 ft home table, blue cloth, same set of balls.

- crops/: 1851 pictures, 64x64, one per spot found (ball centred, 3.2 ball radii wide).
- manifest.csv: file, session, shot, before/after picture, table inches, picture pixels, radius, the app's own number and
  confidence, label (0 = cue, 1-9, nb = not a ball: hand/arm/cue/shirt/shadow, ? = can't tell), trust
  (sure = drill ring ball, drill = drill session, app = app's number checked by eye, redetect = found by the V2.2
  detector on old pictures and labelled by eye), proposed (label before the eye check).
- Every label was checked by eye on contact sheets (342 of the app's numbers corrected; 127 extra spots added, 45 of
  them the navy 2 the old versions never saw).
- feat_data.json: the detector's colour measurements for 1717 labelled spots (for the current colour-based naming).

Counts: cue 397, 1:40, 2:76, 3:89, 4:110, 5:140, 6:165, 7:190, 8:208, 9:221, not-a-ball 196, unknown 19.
How often the app's own number was right: V2.0 83%, V2.1 79%, single-ball drill 93%, V2.2 watch 91%.
Naming test (each session judged only with looks from the other sessions): built-in looks 78% -> with the library 98%.
With not-a-ball looks too: 81% of hands/arms caught, but 3.6% of balls wrongly called not-a-ball.
Not complete: balls neither detector found are missing (no full-picture boxes yet).
