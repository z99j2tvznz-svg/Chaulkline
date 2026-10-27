# Chalkline features: the running list

Every feature and future capability we intend to have, built or not. Imported on Oct 27, 2026 from
`Chalkline_Master_Feature_Register_2026-10-22.xlsx` (Google Drive, Chalkline test uploads → Project documents), which
ChatGPT compiled on Oct 22 from the design notes, the repo docs and earlier conversations. Its 263 entries and IDs are
kept as they were; the last column is new and says what V3 does today. From now on this file is the list: each new
version updates the V3 column, and new ideas are added at the end of their group with the next free ID.

**Reading it:** "Intent" is how the idea was agreed (Near-term approved = picked for the next work; Enduring goal = part
of the final product; Planned later; Exploratory = talked about, not committed; Superseded = replaced). "Phase" is when
it is likely to come. "V3.0" is what the app at the main link does now: Yes, Partly, No, or blank (not started). None of
the Yes entries has been checked on real shots yet. The owner has not yet reviewed any entry (all were "Not reviewed").

## Added since the register

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| DR-022 | Lag drill (solo) | One ball from behind the head string to the foot rail and back. Score: gap to the head cushion in balls, to the nearest quarter ball. Faults: side rail, foot rail missed or hit twice, pocketed, crossed the long string. Replaces the Oct 22 cue-ball test (owner, Oct 27: not realistic). | Near-term approved (Oct 27) | First drills | No (next: V3.1) |
| CA-022 | Phone upright or sideways, no forced rotation | The app finds the table in whichever way the phone is held; table coordinates stay the same. | Near-term approved (Oct 27) | First drills | Yes |

## Product purpose & experience

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| PV-001 | Automatic personal pool coach | Observe real play, understand the shot, and help the player improve with minimal manual entry. | Enduring goal | Product foundation |  |
| PV-002 | Physics-based table digital twin | Maintain a persistent model of table, balls, motion, identity, and uncertainty in table coordinates. | Enduring goal | Product foundation |  |
| PV-003 | Practice-first primary use | Optimize for serious home and pool-hall practice sessions, not only a scorekeeper for matches. | Enduring goal | Initial product |  |
| PV-004 | Play naturally without prompts | Set up the phone, choose a mode, shoot normally; don't answer made/miss questions after every shot. | Enduring goal | Initial product |  |
| PV-005 | Multiple complementary modes | Support drills, free practice, games, coaching, analysis/review, and appropriate spectator experiences. | Planned later | Initial product |  |
| PV-006 | One engine shared across features | Tracking, planning, coaching, displays and games use the same verified physical state. | Enduring goal | Product foundation |  |
| PV-007 | Meaningful uncertainty disclosure | Show when a ball, pocket, contact or physical event cannot be established; never invent certainty. | Enduring goal | Product foundation |  |
| PV-008 | Explicit distinction between observed and simulated | Real measurements are separate from predictions, hypotheses and suggestions. | Enduring goal | Product foundation |  |
| PV-009 | Support eventual ordinary 16-ball pool set | Plan product for cue + 15 object balls and variable ball sets even if early drills need fewer. | Enduring goal | Initial product |  |
| PV-010 | Avoid unnatural play requirements | Do not require a special camera position, hand placement, ball-number order or modified stroke merely for computer vision. | Enduring goal | Initial product |  |

## Capture, setup & device

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| CA-001 | iPhone camera as the entry product | Record and analyze play with the customer's own phone mounted beside the table. | Enduring goal | Initial product | Yes |
| CA-002 | Landscape, full-table live camera | Use a side-mounted phone with all six pockets in frame and adequate margins. | Current emphasis | First drills | Yes (any orientation) |
| CA-003 | Auto table finding and recovery | Find the playing surface, pockets and rail geometry, with a usable recovery path if confidence is low. | Enduring goal | Product foundation | Yes (auto find; "Find the table again" in Menu) |
| CA-004 | Manual table corner correction | Allow user to confirm, tap pocket corners, and drag the detected outline when needed. | Enduring goal | Product foundation | Partly (tap the 4 corner pockets; no dragging) |
| CA-005 | Lens and camera geometry calibration | Correct perspective, ball-center height and relevant lens effects so table measurements remain valid. | Enduring goal | Product foundation |  |
| CA-006 | Camera bump and moved-phone detection | Recognize changes caused by taps, people passing, vibration or deliberate repositioning; re-establish geometry safely. | Enduring goal | Product foundation |  |
| CA-007 | Different camera angles | Support low side, opposite side, far end, and different heights without camera-specific rules. | Enduring goal | Initial product | Partly (not tested at other spots) |
| CA-008 | Portrait/end-of-table options | Eventually allow alternate phone orientation and end-table placement if practical. | Planned later | Expansion | Yes (upright works; not tested at the table end yet) |
| CA-009 | 1x camera lens as tested default | Use sharp 1x capture; earlier sub-1x auto-zoom produced degraded ball images. | Current emphasis | First drills | Yes (1x) |
| CA-010 | Flexible framing beyond 1x constraint | Investigate higher placement/crop/native lenses while preserving image sharpness and full table. | Needs decision | Initial product |  |
| CA-011 | Higher frame rate captures | Evaluate 120/240 fps where beneficial for fast breaks, strokes or detailed movement, without assuming higher fps solves recognition. | Planned later | Expansion |  |
| CA-012 | Microphone recording and acoustic events | Record impact sounds and use sound as corroborating evidence for shot timing and collisions. | Enduring goal | Product foundation |  |
| CA-013 | Recover microphone dropouts | Handle denied or lost microphone connections and retain video-only capability. | Current emphasis | First drills |  |
| CA-014 | Video record entire shot lifecycle | Capture preparation, impact, motion and enough settling time after the shot. | Enduring goal | Product foundation |  |
| CA-015 | Continuous recording of full racks | Capture uninterrupted play, racking and between-shot interactions; support shot segmentation. | Enduring goal | Product foundation |  |
| CA-016 | Short controlled-shot recording | Record individual drill attempts and their audio, labels, and outcomes without excessive phone storage. | Current emphasis | First drills |  |
| CA-017 | Low-friction guided recorder | Simple prompts, automatic files, manageable exports and player truth taps for tests. | Current emphasis | First drills |  |
| CA-018 | Local-first processing and privacy | Prefer on-device analysis; do not upload private recordings without an intentional share. | Enduring goal | Initial product | Yes (all on the phone; files leave only via Save debug) |
| CA-019 | Session pause/resume | Handle phone calls, camera permission restarts, screen changes, heat, battery and crashes. | Planned later | Initial product |  |
| CA-020 | Battery/heat and long-session reliability | Avoid constant heavy work; verify sustained use over realistic practice durations (including 2-hour sessions). | Enduring goal | Initial product | Not checked (about 5 looks a second when still) |
| CA-021 | Eventual native iOS/Android options | Move beyond Safari/PWA if native camera, performance or product needs justify it. | Planned later | Expansion |  |

## Table geometry & environment

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| TG-001 | Table size selection | Recognize or ask 7-, 8-, 9-foot table size; later accommodate other sport dimensions. | Enduring goal | Product foundation | Yes (7/8/9 ft) |
| TG-002 | Table and pocket geometry | Map six pockets, cushions, cloth boundaries and ball centers to real table coordinates. | Enduring goal | Product foundation | Yes |
| TG-003 | Rail-diamond detection | Use rail diamonds as geometry cues and for a user-friendly measuring system. | Enduring goal | Product foundation |  |
| TG-004 | Diamond-based distances | Use diamonds as the familiar user-facing unit; retain inches internally as needed. | Current emphasis | First drills |  |
| TG-005 | Cue-ball height/perspective correction | Account for ball center elevated above the cloth; test near/far positional bias. | Enduring goal | Product foundation | Yes (balls mapped at ball-centre height) |
| TG-006 | Table-out-of-frame warnings | Warn when pockets or rail edges are too close to the frame and observation may be incomplete. | Enduring goal | Initial product | No |
| TG-007 | Different cloth colors and lighting | Work on blue/light cyan cloth and changed, dim or mixed pool-hall lighting. | Enduring goal | Initial product |  |
| TG-008 | Different ball sets per venue | Accommodate differing colors, striping and cue-ball markings across venues. | Enduring goal | Initial product |  |
| TG-009 | Named table profiles | Remember table dimensions, looks and playing characteristics for individual tables. | Planned later | Initial product |  |
| TG-010 | Home and Away modes | Preserve home calibration and avoid contaminating it with other tables' appearances. | Current emphasis | First drills |  |
| TG-011 | GPS/venue/table-number suggestion | Suggest or choose pool hall and specific table (e.g., Table 12); do not silently assume GPS is exact. | Planned later | Advanced coach |  |
| TG-012 | Cloth speed estimation | Learn roll resistance from shots and update predictions on that table only. | Planned later | Advanced coach |  |
| TG-013 | Rail rebound characterization | Learn cushion angle/speed effects from repeated observed rebounds. | Planned later | Advanced coach |  |
| TG-014 | Pocket acceptance profiles | Offer Pro/Tight, Amateur and Bar Box styles; ultimately calibrate pocket jaws and rattle/make behavior. | Planned later | Advanced coach |  |
| TG-015 | Table wear/refelt reset | Offer explicit profile reset when a table is refelted, with optional drift suggestion rather than silent changes. | Planned later | Advanced coach |  |

## Ball detection, naming & physical identity

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| BI-001 | Detect all balls at rest | Locate ordinary pool balls, including dark balls on similar-colored cloth. | Enduring goal | Product foundation | Yes |
| BI-002 | Detect balls while moving | Maintain detections in motion blur, rapid rebounds, breaks and collisions. | Enduring goal | Product foundation | Partly (finder runs during shots; untested on real shots) |
| BI-003 | Separate balls from false positives | Reject chalk, reflections, rail details, gloves, pocket shadows and other non-balls. | Enduring goal | Product foundation | Yes (new finder + "not a ball" + must rest about 1 s) |
| BI-004 | Recognize cue ball robustly | Keep cue identification distinct from white-looking stripes and reflections. | Enduring goal | Product foundation | Yes (measle cue vs 9 colour check, first mover = cue) |
| BI-005 | Recognize individual numbered balls | Eventually recognize 1 through 15, retaining ability to say unknown when unreadable. | Enduring goal | Initial product | Partly (cue and 1-9 only) |
| BI-006 | Temporary number-free drill tracking | For current drills, don't require correct numbered-ball identification if physical balls and pocketing can be tracked. | Current emphasis | First drills |  |
| BI-007 | Recognize solid and stripe groups | Provide a fallback when exact numbers are unreadable, especially for 8-ball. | Planned later | Initial product |  |
| BI-008 | Handle rotating or stripe-down balls | Carry identity through changing orientation when stripe or printed numeral disappears. | Enduring goal | Product foundation |  |
| BI-009 | Track each physical ball continuously | Maintain unique track IDs through motion, contact, stopping and next shot. | Enduring goal | Product foundation | Yes |
| BI-010 | Do not confuse identity and game role | Physical-ball identity, cue role, number and game status must be separate variables. | Enduring goal | Product foundation | Partly |
| BI-011 | Occlusion-aware ball memory | Remember balls temporarily hidden by a bridge hand, body, cue or another ball. | Enduring goal | Product foundation | Yes (hidden balls keep spot and name) |
| BI-012 | Separate touching/clustered balls | Deal with balls touching, near rails, hanging in jaws and stacked reflections. | Enduring goal | Product foundation | Partly (finder only; touching balls read only when sure) |
| BI-013 | Retain each ball's evidence | Preserve raw observations, competing identities, confidence and later corrections. | Enduring goal | Product foundation | Yes (read votes per ball) |
| BI-014 | User labels/corrects a ball when useful | Optional correction serves play and provides verified recognition examples; routine play stays hands-free. | Current emphasis | First drills | Yes (tap to rename; it sticks) |
| BI-015 | Per-ball/per-venue appearance learning | Use verified examples or setup to learn a new ball set, without contaminating other profiles. | Planned later | Initial product | Started (every tap saved as a labelled picture for retraining) |
| BI-016 | Avoid identity duplication and resurrection | Prevent two balls having the same verified number and prevent pocketed balls spontaneously returning. | Enduring goal | Product foundation | Yes (each number once; pocketed numbers do not come back unless tapped) |
| BI-017 | Uncertainty instead of forcing a label | Uncertain observations remain unknown; fewer confident false conclusions preferred over fabricated accuracy. | Enduring goal | Product foundation | Yes ("?" instead of a guess) |

## Player, cue & stroke perception

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| PS-001 | Detect a person near or over table | Recognize player presence and the regions their body obscures. | Enduring goal | Product foundation |  |
| PS-002 | Recognize hands/bridge positions | Identify bridge hand/arm and distinguish deliberate player actions from disappearing balls. | Enduring goal | Product foundation |  |
| PS-003 | Recognize cue stick | Treat the cue as a tracked object/evidence source rather than a false ball. | Enduring goal | Product foundation |  |
| PS-004 | Detect approach and shot preparation | Recognize when a player is lining up vs racking, cleaning, walking or repositioning. | Enduring goal | Product foundation |  |
| PS-005 | Detect practice strokes separately | Do not interpret practice strokes or cue motion without impact as a completed shot. | Enduring goal | Product foundation |  |
| PS-006 | Recognize cue delivery/impact | Use cue motion, contact audio and cue-ball acceleration as complementary evidence. | Enduring goal | Product foundation |  |
| PS-007 | Estimate cue alignment/aim | Estimate approximate aiming direction where observable, with camera perspective limitations. | Planned later | Advanced coach |  |
| PS-008 | Estimate tip contact and elevation | Infer cue-tip placement and elevated cue where feasible; do not claim precision from one view. | Planned later | Advanced coach |  |
| PS-009 | Differentiate hand placement vs a shot | Moving or lifting the cue ball, moving object balls and correcting fouls must not count as strokes. | Enduring goal | Product foundation |  |
| PS-010 | Detect player switching and attribute shots | Associate records, stats and drills to the correct player when multiple people are at the table. | Planned later | Initial product |  |
| PS-011 | Recognize stroke fundamentals | Eventually evaluate straightness, delivery and other mechanics only where measured. | Planned later | Advanced coach |  |
| PS-012 | Separate player intent from outcome | Do not assume that the ball's final pocket was necessarily intended; distinguish shot selection from measured result. | Enduring goal | Advanced coach |  |
| PS-013 | Optional in-cue motion sensor | Explore weight-bolt cavity electronics sensing pitch/yaw, lateral drift, acceleration and impact. | Exploratory | Expansion |  |

## Shot events, scoring evidence & table memory

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| SE-001 | Recognize shot lifecycle | Represent preparation, impact, rolling/collisions, settling and post-shot state as one continuous event. | Enduring goal | Product foundation | Yes |
| SE-002 | Automatic shot start detection | Detect legitimate cue strikes while minimizing missed and false shots. | Enduring goal | Product foundation | Yes |
| SE-003 | Automatic shot end detection | Wait for all relevant balls to finish moving; allow long rolls and interrupted views. | Enduring goal | Product foundation | Yes |
| SE-004 | Identify first object ball contacted | Report the first-hit ball or unknown based on physical evidence, not rule expectation. | Enduring goal | Initial product | Yes (unknown on a break when the rack was not read) |
| SE-005 | Reconstruct ball-to-ball collisions | Record observed contacts and contact order, explicitly marking occluded/ambiguous portions. | Enduring goal | Product foundation |  |
| SE-006 | Track rail contacts and banks/kicks | Record number and identity of cushion contacts when supported by frames. | Enduring goal | Product foundation |  |
| SE-007 | Track full cue-ball path | Retain incoming and post-contact cue trajectories, rails, travel distance and final stop. | Enduring goal | Product foundation | Partly (followed, not drawn) |
| SE-008 | Track every object-ball path | Follow other balls from rest through collisions into rest or pocket. | Enduring goal | Product foundation | Partly (followed, not drawn) |
| SE-009 | Detect a real pocketed ball | Confirm physical pocket entry/settled absence, not a temporary cover, shadow or jaws stop. | Enduring goal | Product foundation | Yes (lost rolling at a pocket and gone 1 s) |
| SE-010 | Identify which pocket | Maintain stable six-pocket mapping, adjust if the camera moves, and allow unknown pocket. | Enduring goal | Initial product | Yes |
| SE-011 | Handle balls resting in jaws | Do not call a ball down if it stops in a pocket mouth and later falls. | Enduring goal | Product foundation | No |
| SE-012 | Handle pots made on the break | Account for balls that left a tightly packed rack before being individually recognized. | Enduring goal | Product foundation | No |
| SE-013 | Recognize cue-ball scratches | Handle cue ball pocketed or off table with time-appropriate certainty. | Enduring goal | Initial product | Yes |
| SE-014 | Recognize off-table balls and ball-in-hand | Treat balls jumping off the cloth, foul recovery and hand ball placement as distinct events. | Enduring goal | Initial product |  |
| SE-015 | Recognize racking and reracking | Start a rack only once it is ready; separate between-rack hand movement from game shots. | Enduring goal | Product foundation | Partly (New rack button; hands/racking is not a shot) |
| SE-016 | Detect rack boundaries automatically | Recognize a new rack with a conservative fallback to manual New rack marking. | Enduring goal | Product foundation | No (New rack button) |
| SE-017 | Record multiple racks in one session | Preserve continuity across consecutive racks and players without corrupting shot identity. | Enduring goal | Initial product |  |
| SE-018 | Persistent trustworthy table state | After each event retain which physical balls are on, off, pocketed, hidden or unknown. | Enduring goal | Product foundation | Partly |
| SE-019 | Repair earlier state from later evidence | Reconcile evidence across subsequent shots without silently rewriting history or inventing pot times. | Enduring goal | Product foundation |  |
| SE-020 | Save immutable shot record and evidence | Store start/end tables, observations, tracks, sounds, contacts, pocket calls and confidence per shot. | Enduring goal | Product foundation |  |
| SE-021 | Physical events independent of game rules | Produce what happened without knowing whether the game is 8-ball, 9-ball, or a drill. | Enduring goal | Product foundation | Yes (no game rules in the tracker) |
| SE-022 | Unknown/unobserved event reporting | Flag hidden shots, unknown first hits, uncertainty and incomplete evidence rather than guessing. | Enduring goal | Product foundation | Partly |
| SE-023 | Never mislabel a nudge as a shot | Exclude player nudges, object placements, cue placements and racking from shot totals. | Enduring goal | Product foundation | Partly (several balls moving together = hands) |

## Drills & structured practice

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| DR-001 | Three-Ball Runout | Use cue ball plus any three object balls; any pot order; track every stroke, made ball, miss, scratch and runout completion. | Near-term approved | First drills |  |
| DR-002 | Line-Up drill | Recognize a line-pattern setup and track makes and cue-ball positioning; exact layout and scoring require confirmation. | Near-term approved | First drills |  |
| DR-003 | L Drill | Recognize an L-shaped object-ball pattern and track attempts and cue-ball position; exact setup/scoring require confirmation. | Near-term approved | First drills |  |
| DR-004 | Stop in the Zone | Target a marked landing zone and score the cue ball's actual resting position per shot. | Planned later | First drills |  |
| DR-005 | Speed Ladder | Run multiple cue-ball speed-control targets, tracking stop position, consistency and improvement. | Planned later | First drills |  |
| DR-006 | Two-cushion speed calibration | At five speed levels, five consecutive shots each, use far then near short rail and target marks about 1, 2.5, 4.5, 6, 7 diamonds. | Near-term approved | First drills |  |
| DR-007 | Straight-Line Challenge | Repeat cue-ball control strokes over a chosen line/distance and score direction and stopping location. | Exploratory | First drills |  |
| DR-008 | One-Rail Position Challenge | Score controlled cue-ball position after one cushion interaction. | Exploratory | First drills |  |
| DR-009 | Two-Rail Position Challenge | Score controlled cue-ball position after two cushion interactions. | Exploratory | First drills |  |
| DR-010 | Learn the Balls | Optional setup/drill for named balls; practice each one and gather visually verified examples. | Planned later | Initial product |  |
| DR-011 | Show Me the Balls setup | User presents ball numbers or groups at known areas to calibrate their physical appearance. | Planned later | Initial product |  |
| DR-012 | Break training | Practice break speed, where the cue ball stops, scratching, balls made and the initial breaking spot. | Planned later | Advanced coach |  |
| DR-013 | Recreate the Break | Load a reference break/layout (including the saved nine-on-break example) and compare outcomes. | Exploratory | Advanced coach |  |
| DR-014 | Recreate professional shot patterns | Practice a chosen real shot or runout with similar balls and compare result/position. | Planned later | Advanced coach |  |
| DR-015 | Custom drill library and user-defined drills | Choose from established pool drills and let players/coaches save additional structured practice drills. | Planned later | Advanced coach |  |
| DR-016 | Adaptive drill selection | Assign targeted drills based on evidence-based weaknesses and readiness rather than random tasks. | Enduring goal | Advanced coach |  |
| DR-017 | Coach-assigned drill programs | Human coach can assign drills, observe completion and compare results to prior sessions. | Planned later | Advanced coach |  |
| DR-018 | Attempt and failure tracking | Keep each attempt, missed ball, scratch, successful completion, position result and time/shot count. | Enduring goal | First drills |  |
| DR-019 | Compare practice with actual games | Measure whether a trained weakness improves in real racks/matches, not only under drill conditions. | Enduring goal | Advanced coach |  |
| DR-020 | Track controlled drill setup accuracy | Record intended vs actually seen zone/markers; avoid assuming marker placement and player setup are exact. | Enduring goal | First drills |  |
| DR-021 | Do not require number naming for free-order drills | Follow and score physical makes when ball number is irrelevant to the drill's rules. | Near-term approved | First drills | Ready (V3 tracks unnamed balls too) |

## Games, rules & scoring

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| GR-001 | Free practice/watch mode | Observe unstructured practice and save physical shot events without imposing a specific rule set. | Enduring goal | Initial product | Yes (Watch) |
| GR-002 | 9-ball play | Support rotation order, first legal object ball, pocketed balls, fouls, spotting and 9-ball wins. | Planned later | Initial product |  |
| GR-003 | 8-ball play | Support groups/solids/stripes, the 8 ball, turns and game legality. | Planned later | Initial product |  |
| GR-004 | 10-ball play | Support rotation order and distinctive 10 ball, with appropriate rule variations. | Planned later | Expansion |  |
| GR-005 | Straight pool / 14.1 | Support continuous rack scoring and respotted balls. | Planned later | Expansion |  |
| GR-006 | One-pocket | Support pocket assignment, turns and scorekeeping based on observed pocket events. | Planned later | Expansion |  |
| GR-007 | Bank pool | Support scoring by banked pockets and cushion contact evidence. | Planned later | Expansion |  |
| GR-008 | Shot outcome and foul judging | Judge legality from physical events in a separate game-specific rules layer. | Enduring goal | Initial product |  |
| GR-009 | Scratch, ball-in-hand and 9-on-foul handling | Apply relevant rule-set decisions after physical evidence, not before. | Planned later | Initial product |  |
| GR-010 | Run length and innings | Count consecutive makes, misses, turns and innings for play/training stats. | Planned later | Initial product |  |
| GR-011 | Two-player match record | Track outcomes, points and shot stats by player where that mode is selected. | Planned later | Initial product |  |
| GR-012 | Ruleset selectable by league/type | Let players choose among supported game formats and rule variations rather than assuming one universal set. | Planned later | Advanced coach |  |
| GR-013 | Break result and rack completion | Record legal rack start/end, break shot, pot/foul outcomes and winner when reliably observable. | Enduring goal | Initial product |  |
| GR-014 | Additional games and cue sports | Longer term evaluate blackball, Chinese 8-ball, snooker, carom/3-cushion, English billiards and Russian pyramid. | Exploratory | Expansion |  |
| GR-015 | Pocketless and unusual table variants | Support different ball sizes, colored cue balls, respotting and pocketless tables in a future rules/geometry engine. | Exploratory | Expansion |  |
| GR-016 | Assisted scoring and corrections | Allow low-friction correction when the camera legitimately cannot determine a rule/event. | Planned later | Initial product |  |

## Physics, shot planning & strategy

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| PL-001 | Physics model of ball travel | Model roll/slide, energy loss, ball-ball impacts and cushion rebound. | Enduring goal | Advanced coach |  |
| PL-002 | Follow, draw, stun and side-spin modeling | Simulate cue-tip influence on cue-ball path, with sensible uncertainty. | Enduring goal | Advanced coach |  |
| PL-003 | Shot recommendation list | Offer ranked direct pots, combinations, safety alternatives and plausible routes. | Enduring goal | Advanced coach |  |
| PL-004 | Ghost-ball aiming guide | Overlay contact/alignment position to make an object ball along a selected pocket route. | Enduring goal | Advanced coach |  |
| PL-005 | Suggested cue-ball travel path | Display after-contact cue-ball route, rebounds and intended finishing point. | Enduring goal | Advanced coach |  |
| PL-006 | Position / shape landing zones | Show good/bad cue-ball finish zones for the next shot, including hooked/blocked areas. | Enduring goal | Advanced coach |  |
| PL-007 | Cue-tip contact diagram | Show where to strike the cue ball for the suggested tip action. | Enduring goal | Advanced coach |  |
| PL-008 | Calibrated strength scale 1–10 | Translate suggested speed into a player/table calibrated strength level, rather than arbitrary power. | Enduring goal | Advanced coach |  |
| PL-009 | Simple versus advanced shot views | Simple shows one realistic path; advanced shows draw/stun/follow alternatives and zone choices. | Planned later | Advanced coach |  |
| PL-010 | Safe-to-Bold slider | Let player bias recommendation toward higher conversion odds or more position risk. | Planned later | Advanced coach |  |
| PL-011 | Runout-depth preference | Optional setting for how many balls ahead to plan, from immediate shot to complete rack. | Exploratory | Advanced coach |  |
| PL-012 | Multi-shot position planning | Evaluate current pot together with its future cue-ball position for one or more balls. | Enduring goal | Advanced coach |  |
| PL-013 | Whole-rack runout planning | Look backward/forward across rack, clusters, patterns, kickouts and safeties rather than a single pot. | Enduring goal | Advanced coach |  |
| PL-014 | Replan after shot variance | Compare measured rest positions to expected outcomes and compute a new plan using the observed table. | Enduring goal | Advanced coach |  |
| PL-015 | Banks and kicks via diamond systems | Recommend bank/kick paths with cushion corrections and table-specific learning. | Planned later | Advanced coach |  |
| PL-016 | Break advice as evidence-driven nudges | Limit live break suggestions to patterns supported by multiple recorded breaks. | Planned later | Advanced coach |  |
| PL-017 | Scratch avoidance and ball-in-hand suggestions | Warn of likely cue-ball pocket routes and suggest placement after legitimate ball-in-hand. | Planned later | Advanced coach |  |
| PL-018 | Shot robustness / Monte Carlo spread | Show how small speed/aim variations affect make odds and position zones. | Enduring goal | Advanced coach |  |
| PL-019 | Personalized make probabilities | Eventually use observed player accuracy and shot conditions, not invented ratings, to estimate personal chances. | Enduring goal | Advanced coach |  |
| PL-020 | Theoretical vs personal strategy | Compare textbook optimal shot to what this specific player has measured ability to execute. | Enduring goal | Advanced coach |  |
| PL-021 | Physics fitting from real footage | Tune existing simulation model using observed shot trajectories, rolls and rails. | Enduring goal | Advanced coach |  |
| PL-022 | No false professional accuracy claims | Label model outputs experimental until checked on real shots; avoid overconfident precision on spin/throw. | Enduring goal | Advanced coach |  |
| PL-023 | Decision Lab scenario explorer | Interactive what-if shot choice, outcomes and probability tradeoffs based on plausible alternatives. | Exploratory | Advanced coach |  |
| PL-024 | Pool theory for pattern selection | Weight blockers, safety, cluster breakup, tangent lines, position routes and breakouts in suggestions. | Enduring goal | Advanced coach |  |

## Coaching, player development & instructors

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| CO-001 | Always-available personalized coach | Build an assistant that explains strategy, evaluates performance and prescribes practice. | Enduring goal | Advanced coach |  |
| CO-002 | Individual skill profile | Learn strengths/weaknesses by shot type, cut, speed, distance, table conditions and history. | Enduring goal | Advanced coach |  |
| CO-003 | Evidence-based player calibration | Run structured establishment shots to measure ability, cue-ball speed and stroke consistency. | Enduring goal | Advanced coach |  |
| CO-004 | Goals and self-assessment check-ins | Ask what the player feels they need and want to improve, then compare that perception to observed evidence. | Enduring goal | Advanced coach |  |
| CO-005 | Readiness-based progression | Move a player through practice levels once evidence shows they are ready, rather than repeating fixed drills. | Enduring goal | Advanced coach |  |
| CO-006 | Weakness-to-drill prescriptions | Explain the underlying weakness, select a specific drill, set a measurable target and review progress. | Enduring goal | Advanced coach |  |
| CO-007 | Verify improvement transfers to play | Re-evaluate the weakness in real games/racks after targeted practice. | Enduring goal | Advanced coach |  |
| CO-008 | Player-specific position tolerance | Recommend shape zones reflecting an individual's actually measured cue and object ball control. | Enduring goal | Advanced coach |  |
| CO-009 | Explain shot selection mistakes | Show the reasons a choice underperformed and what alternatives were available at the moment. | Enduring goal | Advanced coach |  |
| CO-010 | Explain execution versus planning errors | Separate poor choice from poor delivery, and uncertainty from genuine skill gaps. | Enduring goal | Advanced coach |  |
| CO-011 | Live tips toggle | Optional live coaching/hints during practice; quiet/disabled when player wants to shoot normally. | Planned later | Advanced coach |  |
| CO-012 | After-session coaching review | Detailed coaching feedback after play rather than intrusive prompts throughout shots. | Enduring goal | Advanced coach |  |
| CO-013 | Selectable coach presentation/tone | Concise/direct vs collaborative guidance; visual, written or spoken output when available. | Planned later | Advanced coach |  |
| CO-014 | Conversational coach with voice | Potential text, text-to-speech, speech input and back-and-forth questions at table. | Planned later | Advanced coach |  |
| CO-015 | Instructional reference library | Show known teaching patterns and drills; cite/reference proven pool instruction rather than inventing all drills. | Planned later | Advanced coach |  |
| CO-016 | Pro-game teaching examples | Review professional decisions/shots with explanations, subject to content rights and evidence quality. | Exploratory | Advanced coach |  |
| CO-017 | Remote coach review and comments | Let a human instructor inspect verified shots, annotate and provide feedback remotely. | Planned later | Expansion |  |
| CO-018 | Human coach calls and live instruction | Optional one-on-one sessions and coach/student interaction, not a prerequisite for the app. | Exploratory | Expansion |  |
| CO-019 | Instructor-assigned goals and reminders | Remember coach's drills/targets and remind player at table; show completion history. | Planned later | Expansion |  |
| CO-020 | Player skill/rating trends | Track an unofficial skill estimate and compare with optionally supplied APA/BCA/Fargo-style baselines; never claim official FargoRate. | Planned later | Advanced coach |  |
| CO-021 | Robustness and confidence for coaching | Every claim or skill number includes sample size, date, context and uncertainty. | Enduring goal | Advanced coach |  |
| CO-022 | Improve fundamentals / stroke mechanics | Where measurement permits, coach stance, bridge, straightness, speed consistency and cue delivery. | Planned later | Advanced coach |  |

## Metrics, progress & session analytics

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| AN-001 | Shot-by-shot history | Store the record of each shot, not merely session-level totals. | Enduring goal | Initial product |  |
| AN-002 | Make/miss and scratch rates | Track accepted successful and failed shots with denominators and corrections. | Enduring goal | Initial product |  |
| AN-003 | Runout and rack statistics | Track finished racks, run length, shots, fouls, breaks and player results. | Planned later | Initial product |  |
| AN-004 | Per-shot classification labels | Categorize cut angle, distance, follow/draw/stun, combo, rail/bank/kick, break and safety. | Planned later | Advanced coach |  |
| AN-005 | Cut-angle groups | Use Straight, Three-quarter, Half, Quarter and Sliver, with angle shown if requested. | Planned later | Advanced coach |  |
| AN-006 | Break performance filters | Group outcomes by break spot, target, speed and scratch/ball count; withhold advice on tiny samples. | Planned later | Advanced coach |  |
| AN-007 | Shot-type weakness dashboard | Show makes, misses, accuracy and trends by difficulty/category, with sample sizes. | Enduring goal | Advanced coach |  |
| AN-008 | Cue-ball position/route accuracy | Score speed, position, rail hits and target-zone outcomes in diamonds or table units. | Near-term approved | First drills |  |
| AN-009 | Practice volume and deliberate-practice progress | Track sessions, attempts, time spent on targets and performance relative to stated goals. | Enduring goal | Advanced coach |  |
| AN-010 | Decision-quality metric | Compare selected player route versus measured/validated alternatives and strength rather than pretending model output is truth. | Planned later | Advanced coach |  |
| AN-011 | Shot speed and contact mechanics estimates | Show measured where possible; clearly mark guessed spin/strike/velocity from single camera. | Planned later | Advanced coach |  |
| AN-012 | Player trend and improvement summaries | Show trend over time and real transfer from drills to unstructured play. | Enduring goal | Advanced coach |  |
| AN-013 | Optional session self-rating | Let player annotate session perception or difficulty in one low-friction action. | Planned later | Initial product |  |
| AN-014 | Error correction/record amendment | Flag a wrong result, explain uncertainty and repair the record with provenance. | Enduring goal | Initial product |  |
| AN-015 | Share progress and drill records | Export a coach-ready or self-review report; possible email/share-sheet integration. | Planned later | Advanced coach |  |
| AN-016 | Opponent/partner identity safeguards | Where multiple players are present, avoid crediting stats to the wrong person. | Planned later | Initial product |  |

## Review, replay & learning assets

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| RV-001 | Per-shot video clips | Keep enough video around a shot to show setup, result and clear ball settling. | Enduring goal | Initial product |  |
| RV-002 | Automatic shot replay with digital twin | Replay trajectories on top-down table with observed paths and uncertainty. | Enduring goal | Advanced coach |  |
| RV-003 | Before-and-after shot images | Review exact starting and ending positions for verification and error diagnosis. | Enduring goal | Product foundation | Yes (in Save debug) |
| RV-004 | Top-down shot diagrams | Show shot start, contacts, balls moved, pockets and ending table. | Enduring goal | Initial product |  |
| RV-005 | Shot highlight reel and filters | Review best shots, missed shots, biggest mistakes, breaks or selected types. | Planned later | Advanced coach |  |
| RV-006 | Star or save selected clips | Keep exceptional shots locally, with simple export/share. | Planned later | Initial product |  |
| RV-007 | Player correction on a specific shot | Mark 'this shot was wrong' and associate with the underlying evidence for debugging. | Current emphasis | First drills | Partly (rename a ball; no per-shot fix yet) |
| RV-008 | Throw out last invalid shot | Remove an accidental logging event from practice records without discarding underlying evidence. | Current emphasis | First drills | No |
| RV-009 | Clip viewer showing observations | Inspect video alongside raw spots, identities, tracked path, pocket calls and uncertain judgments. | Enduring goal | Product foundation |  |
| RV-010 | Professional shot/position recreation | Reference layout or clip becomes a guided setup and outcome comparison, rather than training data without permission. | Exploratory | Advanced coach |  |
| RV-011 | Reset a drill layout | Use saved table pattern for repeat attempts and notice whether a player physically restored it. | Planned later | Advanced coach |  |
| RV-012 | Evidence export for independent testing | Save footage, sound, frame metadata, labels, hashes and measured outcomes for replay/regression. | Enduring goal | Product foundation |  |

## UI, access & everyday experience

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| UI-001 | Premium minimal dark interface | Dark, frosted glass, thin typography and ice-teal accent (\#59D6E8). | Enduring goal | Initial product | Yes |
| UI-002 | Full-screen simple live view | Show table, small controls, minimal text during shooting; expand detail in training/review. | Enduring goal | Initial product | Yes |
| UI-003 | Optional ball-number overlays | Show/hide ball identities on video or table map, off by default. | Planned later | Initial product | Changed: names always shown in V3 (needed while testing) |
| UI-004 | Visual shot-selection controls | Simple arrows/buttons to cycle suggested shot, chosen path remains locked if view is occluded. | Planned later | Advanced coach |  |
| UI-005 | Color-graded position/shape graphics | Green target region, amber/red poorer margin, striped gray blocking zone. | Enduring goal | Advanced coach |  |
| UI-006 | Show current version and known limits | Clear in-app version/debug identifier so trial results can be traced. | Enduring goal | Initial product | Yes (V3.0 on the home screen) |
| UI-007 | Minimal setup and calibration | Automatically detect where possible; ask only for table size/confirmation when needed. | Enduring goal | Initial product | Yes |
| UI-008 | Hands-free sound cues | Optional ding/dong or quiet haptic/visual shot/result cues during practice. | Planned later | Initial product |  |
| UI-009 | Hands-free voice controls | Later allow simple commands without tapping phone during a practice session. | Exploratory | Advanced coach |  |
| UI-010 | Phone-friendly navigation | All core tasks doable from iPhone, including short tests, recordings, basic review and managing settings. | Enduring goal | Initial product |  |
| UI-011 | Session resume/discard prompt | Recover previous session state after crash/phone call; allow discard explicitly. | Planned later | Initial product |  |
| UI-012 | Offline resilience | Continue usable playback/session logic without depending on permanent internet service. | Enduring goal | Initial product |  |
| UI-013 | Accessible confidence and warnings | Use clear labels for unsure, hidden, prediction and camera-moved rather than cryptic numbers. | Enduring goal | Initial product | Partly (sure / unsure / hidden rings) |
| UI-014 | Selectable level of coaching detail | Quiet view vs rich details, text, spoken guidance, optional during live play. | Planned later | Advanced coach |  |

## Displays, community & future hardware

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| HW-001 | AirPlay/TV practice display | Mirror or present a clean high-contrast table, paths, shape zones and statistics on a television. | Planned later | Advanced coach |  |
| HW-002 | Projector training add-on | Project setup spots, aim lines, drill goals and routes onto real cloth while camera verifies results. | Planned later | Expansion |  |
| HW-003 | Permanent pool-hall vision unit | Install an overhead camera and local computer at a table for more accurate/less occluded tracking. | Exploratory | Expansion |  |
| HW-004 | Venue display/broadcast overlays | Offer live match state, shot options, player insights and commentary graphics. | Exploratory | Expansion |  |
| HW-005 | Spectator handheld AR mode | Point phone at a table/game for annotated shot exploration and replay. | Exploratory | Expansion |  |
| HW-006 | Coach remote camera/phone viewing | Give remote coach permissioned observation and annotations, with appropriate privacy controls. | Planned later | Expansion |  |
| HW-007 | Pro/broadcast spectator analysis | Explain possible routes and actual outcomes for audience education rather than claim certainty where footage is limited. | Exploratory | Expansion |  |
| HW-008 | Event and league tournament analytics | Collect table-level scores, stats and high-level venue/tournament summaries if data use is authorized. | Exploratory | Expansion |  |
| HW-009 | Smart cue integration | Optional cue sensor pairing to augment stroke metrics; camera-only experience must still work. | Exploratory | Expansion |  |
| HW-010 | Alternative form factors and displays | Native app, desktop/TV viewer, coach portal or projector share a common digital twin. | Planned later | Expansion |  |
| HW-011 | Licensed player/rating data integration | Only integrate FargoRate or league-rating data with permissions; unofficial modeled estimate labelled as such. | Exploratory | Expansion |  |
| HW-012 | Future hardware business models | Consider venue license/revenue share or hardware rentals separately from consumer app revenue. | Exploratory | Expansion |  |

## Engineering quality, traceability & operations

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| EN-001 | Frozen real-footage regression tests | Score each algorithm revision against representative real recordings, separate from synthetic tests. | Enduring goal | Product foundation |  |
| EN-002 | Hold out new camera/light sessions | Separate training/development and unseen evaluation; don't reuse known held-out data as fresh validation. | Enduring goal | Product foundation |  |
| EN-003 | Measure full-shot and full-rack correctness | Assess end-to-end shot capture, correct end state, confidently wrong, unresolved and rack completion. | Enduring goal | Product foundation |  |
| EN-004 | Record owner-verified truth | Distinguish user-labeled balls/shot outcomes from AI guesses, unverified clips and inferred claims. | Enduring goal | Product foundation |  |
| EN-005 | Preserve underlying footage and hashes | Keep immutable clip/frame input manifests so results can be reproduced across implementations. | Enduring goal | Product foundation |  |
| EN-006 | Validate speed on actual iPhone | Test camera, memory, CPU, battery and thermal load; don't infer browser performance from server benchmarks. | Enduring goal | Initial product | Yes (check page speed test, Oct 27) |
| EN-007 | Maintain source-build reproducibility | Do not edit built index.html by hand; verify source-generated file and automated tests. | Enduring goal | Product foundation | Yes (build.py --check) |
| EN-008 | Version-controlled product requirements | Maintain a source-of-truth scope and decision record rather than re-deriving requirements from chats. | Enduring goal | Product foundation |  |
| EN-009 | Read-only independent evaluation when requested | Independent reviewer must actually run tests or clearly mark that they were not run; no unapproved repo modification. | Enduring goal | Product foundation |  |
| EN-010 | One coordinated project status register | Track work, owner, evidence, blockers, decisions and next move without duplicating 12 different conversations. | Enduring goal | Product foundation |  |
| EN-011 | Explicit approval of major builds | Honor user approval before implementation and do not silently promote research results to production. | Enduring goal | Product foundation | Yes |
| EN-012 | Avoid special-case patches and overfitting | Diagnose general failure rather than adding footage-specific thresholds that damage unseen sessions. | Enduring goal | Product foundation | Yes (V3 removed the V2 rule pile) |
| EN-013 | Measurable release acceptance gates | Use accepted targets for shot detection, pocket correctness, player usability, drift and full-rack state. | Enduring goal | Initial product |  |
| EN-014 | Separate prototype and released code | Distinguish merged main, development branch, experimental scorer, test recorder and what the user actually runs. | Enduring goal | Product foundation | Yes (V2.3.3 kept at /v2/) |
| EN-015 | Security, privacy and data rights review | Before sharing footage or venue analytics, define consent, retention, permissions and a secure distribution model. | Planned later | Initial product |  |
| EN-016 | User-friendly bug capture | From the app/recorder flag wrong shots and export enough video/evidence for reproducible defects. | Current emphasis | First drills | Yes (Save debug) |

## Superseded, deliberately excluded or not-yet-decided

| ID | Feature | What it means | Intent | Phase | V3.0 |
|---|---|---|---|---|---|
| XX-001 | Automatic zoom below 1x | Initial V2.3 auto zoom damaged recognition; replaced with 1x default for now. | Superseded | Historical only |  |
| XX-002 | Every drill requires numbered ball labels | Current free-order drills no longer need correct 1–15 numbers; preserve eventual naming vision. | Superseded | Historical only |  |
| XX-003 | Full 9-ball tracking blocks all development | Oct 19 spec uses five complete racks as a tracking acceptance target, but Oct 22 owner approved building usable drills meanwhile. | Needs reconciliation | First drills |  |
| XX-004 | Stop in the Zone exclusively first | Oct 21 selected cue-ball drill first; Oct 22 selected Line-Up, L Drill and Three-Ball Runout. Keep all; reconcile ordering. | Needs reconciliation | First drills |  |
| XX-005 | Live coaching at every shot | Practice-first preference is no compulsory prompts or unwanted hints; opt-in in-play guidance later. | Superseded | Historical only |  |
| XX-006 | Social feed feature | Explicitly excluded in the original feature plan; no later owner request to restore it. | Superseded | Historical only |  |
| XX-007 | Humidity-based table drift | Explicitly excluded from initial scope in original design notes. | Superseded | Historical only |  |
| XX-008 | Multi-camera required in phone v1 | Original notes explicitly excluded, perhaps revisitable for future professional hardware. | Superseded | Historical only |  |
| XX-009 | Pro-footage model training required now | Originally excluded from initial scope; later professional-shot teaching library is a different proposed feature. | Superseded | Historical only |  |
| XX-010 | Default subscription business model | Owner originally preferred a one-time price/paid upgrade; later venue subscriptions were brainstormed separately. | Needs reconciliation | Commercial decision |  |
| XX-011 | Cloud processing prerequisite | Original web app runs on phone without paid cloud inference. Future coaching/venue architecture is undecided. | Needs reconciliation | Commercial decision |  |

## Open decisions (from the register, Oct 22; none settled yet)

| ID | Decision | What the records say | Suggested reading |
|---|---|---|---|
| D-01 | First executable experience | Oct 19 spec: complete 9-ball rack; Oct 22: Line-Up, L Drill, Three-Ball Runout | Build and test the three selected drills first; keep complete-rack evaluation as a core quality milestone. |
| D-02 | Exact Line-Up and L Drill rules | Names and broad concepts chosen; detailed setup, allowed ball counts and scoring not fully specified | Do not pretend rules are fixed; draft a default demonstrable version for owner to accept or adjust. |
| D-03 | Numbered-ball recognition dependency | Oct 13: recognize all numbers eventually; Oct 22: number identification not core to initial free-order drills | Maintain eventual full identity vision; make current simple-drill results independent of numbers. |
| D-04 | Stop in the Zone priority | Oct 21 selected initial cue-ball-only prototype; Oct 22 added three new selected drills | Keep the exercise in backlog; do not assume it replaced the three newly prioritized drills. |
| D-05 | Two-cushion speed benchmark | Oct 22: 5 levels x 5 consecutive shots and diamond markers; earlier 38-event test incomplete | Keep as test design; do not claim validated cue-position accuracy or a finished drill. |
| D-06 | 1x camera versus universal placements | 1x chosen after sub-1x blur; final vision works across camera placement and table sizes | Keep sharp 1x default now, validate constraints, evaluate other views after capability is measurable. |
| D-07 | Live coaching vs quiet practice | Original app says no text during play; later owner accepts optional real-time hints, TTS and review | Live advice opt-in and unobtrusive; coaching after sessions always supported once evidence permits. |
| D-08 | Free play / match scoring | Original notes excluded match score; October 14+ added two-player Play mode | Treat match scoring as later planned function, not rejected and not near-term drill blocker. |
| D-09 | Manual correction behavior | Desired hands-free automation vs known vision limits and optional labels/corrections | No routine made/missed dialogs; allow explicit corrections and maintain an audit trail. |
| D-10 | Camera-only vs smart cue hardware | Phone-only first; optional cue weight-bolt sensors proposed later | Smart cue strictly optional and exploratory; no dependency for drills. |
| D-11 | Native / cloud architecture | Safari local-first and no paid API; later compute and human-coach integrations were discussed | Do not require paid cloud services or native conversion before proving phone value. |
| D-12 | Product name and pricing | Chalkline is project codename; user originally favored one-time price, other models explored | Keep name and business model undecided; do not treat projections as validated. |
| D-13 | Exact metric definitions | Code and reports compare clips alone, continuous shots, rack completion and unresolved outcomes | Version control acceptance tests and report metric definitions by mode and dataset. |
| D-14 | Perception observations versus rules | Early V1 mixed rules into tracking; later architecture requires game-agnostic physical events | Treat this as an enduring architecture constraint for every drill and game. |
| D-15 | Player mechanics from one camera | Later coaching asks for cue, stroke, posture and spin; low side phone cannot see all details | Track observable evidence now; reserve estimates or sensor-assisted measurements for later. |
| D-16 | Active branch and usable app | Main last merged recorder R0.6 Oct 19; development experiments through Oct 22 unmerged | Do not mark experimental features shipped until a specific tested build is released. |
| D-17 | Human coach and pro material rights | Remote coaching and pro teaching libraries proposed; no consent/licensing plan established | Keep future scope; require consent and licensing before footage sharing/commercial rollout. |
