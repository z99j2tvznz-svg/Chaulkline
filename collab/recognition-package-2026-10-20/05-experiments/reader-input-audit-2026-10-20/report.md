# Reader-input visibility audit (Oct 20, 2026)

**Result:** in almost every failure, the information needed to name the ball is visible in the exact 24 × 24 picture the reader gets. The reader misreads it, and usually with high confidence.
- The one thing that really is lost is the printed number. Digits are hard to read even in the original 720p frame, and gone at 24 × 24.
- Colour and the solid/stripe pattern survive.
- So the reader is in practice a colour-and-pattern classifier, and its failures are errors of colour and pattern judgement.

Diagnostic only: nothing was retrained, nothing in the tracker changed, v0.6 is unchanged. Labels: Confirmed = measured; Likely = reasoned; Unknown = not measurable here.

## How it was checked
- **Tool:** `tools/experiments/reader-input.js` (branch `claude/project-thread-evm9v0`).
  - It cuts the same frame, the same 3.2-ball-radius square and the same 24 × 24 resize as the app.
  - It re-runs the frozen reader on that picture, and the result matches the frozen detections on 46 of 46 examples (Confirmed). So the pictures in the sheets are exactly what the reader saw.
- **Examples:**
  - 46 verified examples from your labelled pictures and labels-v1, covering every camera spot (`examples.json`).
  - All 64 spots of four Oct 17 light steps.
  - 4 far-spot spots read as the 4 by the calibrated reader.
- **Sheets:** in `reader-input-audit-2026-10-20/`. Each cell shows the original crop (left), the reader input (right), the read, the next guesses and the not-a-ball score.

## What each failure looks like

| Failure | Examples | Visible in original? | Visible in 24 × 24? | Verdict |
|---|---|---|---|---|
| 9 read as the cue | 8 (far spot shots 2/4/6/8, Oct 18 clips 1-2, Oct 19 clips 1-2), cue at 0.92-1.00 | Yes, the yellow band shows. At the far spot it often faces away, leaving a cream ball | Yes on Oct 18/19. Partly at the far spot | **Present, misread** (far spot: partly lost by angle) |
| 8 read as the 2 (other side, shots 1-3) | 3, at about 1.00 | Yes, black vs navy | Yes, but close | **Present, misread** |
| 5 read as the 3, 4 read as the 7 | 2 (far spot shot 2 at 1.00; Oct 19 clip 2 at 0.85) | Yes, orange vs red, purple vs maroon | Yes, but subtle | **Present, misread** |
| Far spot "4" (calibrated, shots 22-27) | 4 | It is the maroon 7. The 4 was already down | Yes, the same maroon ball | **Present, misread** (Likely; my eye read, no label) |
| Real ball rejected as "not a ball" (far spot) | 7 (the 7, 6, 4 and others), not-a-ball 0.8-1.0 | Yes, clear solids | Yes, but a rail often fills part of the square and colours are paler | **Present, misread** |
| Every ball rejected under changed light (light steps 12 and 13) | 31 of 32 spots at not-a-ball 1.00 | Yes, all 16 balls are crisp | Yes, the cloth turns grey-green or dark teal | **Present, misread** (Confirmed; identities are my eye read) |
| Stripes 10-15 (Oct 17 16-ball spread) | 6 and more, read as solids or the cue at up to 1.00 | Yes, white band plus colour | Yes | **No class for them**: the reader only knows cue and 1-9 |
| Correct reads | 152 verified balls named right | | | Clean single balls with the normal cloth colour |

Further detail:
- **Ball size:** balls are 10-18 px in radius at every spot. The reader's square is therefore 32-58 px, shrunk to 24 px, so a printed digit becomes 2-4 pixels.
- **Capture limits:** the V2.3.3 videos are about 0.9 Mbps and the recorder is about 1.8 Mbps. The compression softens digits further. This is a capture-level loss (Confirmed).
- **Counts:** across every labelled ball in the verified pictures (from which the 46 examples were picked), 152 were right, 15 wrong, 8 rejected, 4 unsure, 2 not detected and 7 unknown stripes. These pictures were chosen for calibration, so these counts are not a rate. The rates are in `rest-naming-2026-10-20.md` and `calibration-2026-10-20.md`.
- **Overconfidence is the dangerous part.** Most wrong reads come at 0.85-1.00, so v0.6 accepts them as sure. That is where confidently wrong table states come from.
- **Lighting stands out.** In clip012 and clip013 the balls look as sharp as in normal light, but the reader rejects nearly all of them. Likely cause: the reader learned what "the cloth around a ball" looks like from Oct 12-13 only, and treats a different cloth colour as "not a ball".

## Could colour, stripe and the whole table name balls with unreadable numbers?
**Colour and pattern on their own (Likely).**
- In 9-ball the 9 is the only stripe, so a stripe check alone would settle every 9-vs-cue case where the band is in view.
- Most other confusions are between similar dark colours: 2 navy, 4 purple, 7 maroon, 8 black, and sometimes 6 dark green. Colour narrows these to a small group but does not always split them in this footage.

**The whole table, measured on existing looks (Confirmed).**
- Test: if every other ball on a settled table is named, the one remaining unnamed spot must be the one missing number. This is your 4 example.
- I counted this over 144 settled looks with a known table (Oct 16, Oct 17 first spot, other side, Oct 17 and Oct 18 recorder).

| Look | Count |
|---|---|
| Already right | 48 |
| Fixed by elimination alone (one ball missing, one unnamed spot, no wrong names) | 8 |
| Needs colour plus elimination (2 or more unnamed, all present) | 17 |
| **Unsafe:** some other ball already has a wrong number, so elimination would spread the error | 31 |
| A ball not seen at all (naming can't fix it) | 40 |

- **What this means:** elimination is only as good as the names it leans on.
  - On its own it would fix about 8 looks.
  - In 31 looks it would turn one error into two, mostly at the far spot (16) and the other side (10).
  - Example: at the other side the 8 is read as the 2 at 1.00, so the real 2, if left unnamed, would be "deduced" as the 8.
  - It could only work safely after the confident misreads are fixed, and with honest uncertainty on each name.

## What each game needs from the reader (Likely, from the rules)
- **9-ball:** cue plus 1-9. The hard pairs here are 9 vs cue (a stripe check fixes it) and the dark solids.
- **10-ball:** cue plus 1-10. The 10 is a blue stripe. It needs a stripe class plus blue, otherwise it will be confused with the 2 and the 9.
- **8-ball:** cue, the 8, and solid vs stripe for the other balls. That is close to what the pictures already show well. The exact number of each stripe matters less, except for calls.
- **Today's reader** has no stripe classes at all, so 10-ball and 8-ball are not supported by it as built.

## Player behaviour (note only, not evaluated)
- Play is useful evidence. Example: you keep shooting after a ball the app called the 8 went down, which means it was not the 8.
- It should only make the app less sure of an identity and ask for another look, never set a name on its own.
- It must never override clear visual evidence or create certainty.
- Every identity should stay revisable.

## Dominant failure mode
The reader misjudges colour and pattern it can see, and reports high confidence when it does. This covers:
- rejecting clearly visible balls under new light and at the far spot
- the 9 read as the cue
- the dark-colour swaps

The fix is not to recover lost information. The digits aside, nothing is lost before the reader. The fix is a better colour and pattern judgement that is honest about doubt.

## Recommended smallest controlled experiment (needs your approval)
**A colour-and-stripe measurement check, offline, with no training.**
- **Method:** on the same reader pictures, take simple fixed measurements against the cloth colour around each ball:
  - the ball's main colour (hue and darkness compared with the cloth)
  - the share of white
  - whether the white forms a band (stripe) or a small circle (solid with a number spot)
- **The question:** can these measurements separate the actual failure pairs at each camera spot and in each light step, without new confident errors? The pairs are:
  - 9 vs cue
  - 8 vs 2
  - 7 vs 4
  - 5 vs 3
  - ball vs not-a-ball under clip012/013 light
- **Scoring:** against verified labels only, by session and camera spot. Report how often it separates each pair, how often it would be confidently wrong, and how often it would say "can't tell".
- **What stays untouched:** the reader, the tracker, v0.6 and the app. Nothing is promoted.
- **Cost:** one small script and short compute runs. Optionally, about 5 minutes of your time to verify the light-step pictures 12 and 13 on the label page, because their identities are only my eye read today.
- **Why this one:**
  - It tests the base of any colour/stripe/number/table hierarchy before anything is built or retrained.
  - If simple measurements can't split these pairs in this footage, a hierarchy would rest on sand, and retraining the reader with lighting and size variety is the route.
  - If they can, we learn which evidence is reliable, and that shapes a retrain or a future evidence layer.
