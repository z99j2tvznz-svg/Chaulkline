# Tracking approaches vs Chalkline's failure data (review, 2026-10-21)

This is a desk review: nothing was installed, copied or run. The method descriptions are general knowledge of the
published methods. The Chalkline numbers come from the Cycle 1 and Cycle 2 results:
- [reader-v2-cycle1/RESULTS.md](reader-v2-cycle1/RESULTS.md)
- [tracking-cycle2/RESULTS.md](tracking-cycle2/RESULTS.md)

**Demonstrated** = measured on our data. **Proposal** = not tested.

## What our failures actually are
Best configuration, 116 shots judged alone, 63 failing. A shot can have several blockers.

| Blocker | Shots | Kind of problem |
|---|---|---|
| Recording ends while balls still roll | 21 | footage (Demonstrated, Cycle 2 X1) |
| Shot detection (practice strokes, hands, cue ball hidden, 2nd "shot" while rolling) | 11 | event definition |
| Unnamed spot at a still look ("number taken", far spot) | 12 | identity at rest |
| Absence rule can't confirm (count mismatch; starting layout not recorded) | 8-10 | inventory / reconciliation |
| Wrong identity | 4 | identity at rest, sometimes linking |

Track linking during motion (the core of SORT-family trackers) is a minor cause. The large blockers are incomplete
footage and table-state reasoning.

## The approaches, one by one
| Approach | Core idea | Already in Chalkline | Fit for colliding, look-alike pool balls | Architecture change | iPhone real time |
|---|---|---|---|---|---|
| SORT / ByteTrack | Kalman motion model + one-to-one assignment; ByteTrack adds a second pass with low-confidence detections | Mostly. v0.6 (`tools/tracker.js`) matches closest pairs first inside a speed-scaled gate. It gives a second, wider look for struck balls (launch gate), re-finds hidden balls, uses keep-first outline detections (more low-score spots kept) and requires 5 hits before a new spot is a ball. Not present: Kalman filter (a straight / cushion coasting experiment exists, off) and optimal (Hungarian) assignment instead of greedy | Good for motion. ≤16 objects with physics-like motion is an easy case | Small: Hungarian in place of greedy is a local change | Yes, trivially |
| Deep SORT | Adds an appearance embedding (re-ID network) to the matching cost | Partly, in a better form. The reader gives each still spot class probabilities for the 16 balls, which is a ball-specific appearance model. It is used for naming, not for linking moving balls | Weak as designed. A generic embedding cannot separate 1/9, 2/10, … reliably, and moving balls are blurred. A cheap "white vs coloured vs dark" cost at crossings could help cue/object swaps (Proposal) | Medium (per-frame appearance in the matcher) | Full re-ID per frame: heavy in Safari; colour class only: yes |
| BoT-SORT | ByteTrack + camera-motion compensation + better Kalman | No camera compensation. Measured wobble is 1-2 px (~0.5 in at the far rail) against a 3 in gate | Not needed while the phone sits on a tripod. Would matter for bumps or a handheld phone; the recorder logs motion for that | Medium | Optical flow per frame: possible but a cost we don't need |
| Global data association (whole-clip / tracklet stitching, min-cost flow) | Link over the whole video at once instead of frame by frame | Partly, at the still-table level: each number at most once per look; Cycle 2 whole-table elimination (+1 table per pick, Demonstrated); delayed confirmation across 2 clips (+3 continuous, Demonstrated) | Good at the still-table level (16 balls, few events). Over raw frames it adds little to the motion problems we don't have | Small at table level; large over every frame | Table level: yes, after each settle (one shot of delay) |
| Multiple-hypothesis tracking (MHT) | Keep several explanations open and prune when later evidence arrives | A light form: "possibly pocketed" pending for 2 clips, "unsure" names, the guard's "contested" flag | The idea fits pocket / hidden / misread doubts. A full hypothesis tree per frame is not justified by the data | Major (the tracker state becomes a hypothesis tree) | Pruned for 16 balls: probably; the cost is engineering complexity |

## Answers to the seven questions
1. **Already implemented (Demonstrated):**
   - Gated nearest-neighbour association with a second wide pass and hidden-track re-finding (ByteTrack/SORT-like, no
     Kalman).
   - Unique-number naming per still look.
   - Whole-table elimination (Cycle 2 X4).
   - Delayed pocket confirmation over 2 clips (Cycle 2 X3, an MHT-like pending state).
   - Contested flag (guard).
2. **Which remaining failures could benefit:**
   - Absence / count mismatch (8-10) and unnamed spots (12): table-level global reconciliation over a whole rack
     (Proposal), once the starting layout is recorded.
   - Wrong identity (4): possibly Hungarian assignment + a colour-class cost at contacts (Proposal, 0-4 shots at most).
   - Incomplete recordings (21) and shot detection (11): **none** of these methods. They need complete footage, and a
     shot defined as the motion between two settled tables in a continuous recording.
3. **Best suited to pool balls:** motion-gated one-to-one assignment (already there), plus reasoning at the level of
   table states and events. Least suited: appearance re-ID (Deep SORT), because identical-looking pairs exist and
   moving balls are blurred.
4. **Major architectural change:** full MHT, and frame-level global association. Deep SORT and BoT-SORT are medium.
   Hungarian assignment and table-level reconciliation are small and local.
5. **Real time on iPhone:** association (greedy or Hungarian), Kalman, colour-class cost and table-level reconciliation
   are all cheap. Per-frame re-ID networks and optical-flow camera compensation are the expensive ones (avoid in
   Safari). The reader itself runs only on still balls.
6. **Historical observations without locking in mistakes:**
   - Yes, if history is kept as evidence (votes), never as a fixed label. In practice: carry a ball's votes forward only
     while its track provably did not move between two still tables (continuous footage makes this checkable). Votes
     stay open to contradiction: a strong opposite read reopens the name.
   - Caveat (Demonstrated, identity-continuity diagnostic 2026-10-20): on the old per-shot clips, identity memory fixed
     about nothing (24 → 25 of 58 end tables), and Nackers decided against look-level identity memory. This is
     therefore a narrow proposal: pooling votes for unmoved balls only. Test it on complete racks before relying on it.
7. **Whole-table assignment + event reconciliation for complete racks:**
   - Probably the most useful direction. Every rack is a chain of settled tables S0 … Sn, and each step must be
     explained by events (balls pocketed, balls moved).
   - With S0 recorded (continuous mode), the count / inventory checks that block the absence rule today become
     well-defined.
   - Today's evidence: the small safe pieces gave +1 and +3 with no new errors (Demonstrated). Complete racks are
     unmeasurable (0/5) until complete footage exists.

## Recommendation (next cycle, after the 3 complete racks exist; not started)
"Rack-level reconciliation on continuous footage", with these steps, in this order and each with a stop rule:
1. A harness that turns a rack video into settled / moving periods, with ground truth per settled table (drafted by
   Claude from the video, and a short list checked by Nackers). This also measures the recorder's real fps and gaps.
2. A table-state chain: S0 from the pre-break look; each transition reconciled with pending events that are resolved at
   later settles (X3 extended beyond 2 clips, with the same false-pocket guards).
3. Vote pooling for balls that did not move between settles (question 6), contradiction-safe.
4. A cheap check on existing data: Hungarian vs greedy association, and a white / colour cost at contacts.

Not recommended now: Deep SORT-style embeddings, BoT-SORT camera compensation, full MHT. The failure data does not point
at them.
