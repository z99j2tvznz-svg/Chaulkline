# Why made balls stay unresolved (Oct 19, 2026)

This is a diagnosis only: nothing was changed. It uses the v0.4 runs (code 67a7cc4, all four sessions) and every ball that really went in during a clip, 57 balls in all. Scripts: `tools/pocket/made.py` and `drop.py`.

| What happened to the made ball | Balls |
|---|---|
| Confirmed pocketed | **8** |
| No pocket event: last named more than 8 in from any pocket | **18** |
| No pocket event: last named within 8 in of a pocket | 12 |
| No pocket event: never named before the shot | 6 |
| Called still on the table (misread, or it dropped after the clip) | 6 |
| Clip ended before the table was still | 5 |
| Pocket event, but the ball was lost outside the mouth | 2 |

- **Likely main cause:** the tracker loses the ball while it is rolling. For 30 of the 57 balls, the tracker raised no pocket event at all, and 18 of those were last named in the middle of the table.
- **Likely:** in 13 of those 30, the detector did see a spot go to a pocket and vanish there after the ball was last named. Identity is lost during the roll, but the eyes still see the drop.
- **Unknown:** the other 17. The ball may have been missed while moving (motion blur, or the detector trained on still pictures), or dropped by the table checks at the pocket mouth.

## Next, if wanted (small, offline)

Look at the tracker's track breaks during a roll on these 30 balls.

If tracks break on fast balls, a tracker-only fix may recover the 13. That fix would carry a ball's identity from where it sat before the shot and follow its spot into the pocket. It would be a new scored version, with nothing else changed.
