# Chalkline design notes (not built yet; build only when user says "make it")

## Table detection
- Auto: felt, corner pockets, side pockets. Retry with tips, or tap the 4 corner pockets (sides assumed).
- NEW: also detect the rail diamond dots as a second way to find the table (RANSAC lines through the dots, homography to top-down). Helps with glare or a hidden pocket. Source idea: pix2pockets paper.
- NEW: setup hint, frame the table so it fills about 40% or more of the screen (detection drops a lot when it is small).
- Reference bar: Railbird finds the table from any phone position as long as six pockets are visible.

## Play screen (sideways, full screen, no writing during play)
- Tip diagram, strength 1-10, option arrows, Safe/Bold slider, menu buttons only. Text lives in training mode.
- Pick a candidate, it locks and stays drawn even if someone blocks the camera. Re-read the table only when the cue ball has moved a meaningful distance and held still for a moment.
- Landing zone: green brightest at the ideal distance, fading nearer and farther. Amber and red only along the sides and only where the situation calls for them. Hatched shadow behind blocking balls. Zone stops at the cushions.
- This shot: simple tier = one real curved line (spin and speed included). Advanced tier = draw/stun/follow slices plus the target zone, player decides. Side spin later.
- Aim always at pocket center. Cheating the pocket only in the math, shown only on Bold.
- Second slider later: run-out depth (next shot only to full run-out), tied to skill and aggression.

## Pocket style
- Three choices only: Pro (tight), Amateur, Bar box. No custom. Difficulty dial for planner margins only, never the physics.

## Tables and profiles
- Per-table profiles (name + GPS suggestion). New table starts from clean textbook physics. Refelt: reset buried in settings, plus a gentle drift suggestion based on simple shots only, never automatic.

## Shots, banks, breaks, scratches
- Everything automatic from the camera. No made/missed prompts.
- Bank/kick: aim in diamonds, per-rail corrections learned from every real shot.
- Break: observational, live nudge only at the break (like "last 3 scratched, move here").
- Scratch or ball off table: wait for the cue ball to be placed, suggest ball-in-hand spot looking 3 balls ahead.
- Hand-reset of an attempt is recognized and not counted as a result. Bumped object balls do not matter until the next shot.
- New game inferred from a full rack appearing again.

## After the session
- One stats screen: make rate, breaks, bank/kick learning, decision quality (what you chose vs the top option), optional one-tap session rating.
- Shot list with trimmed clips (3 sec before the shot to 1-2 sec after balls stop) plus a top-down diagram of the shot. Top 10 shots, top 10 misses, filters. Star a clip to save it to the phone.

## Other
- Billiard theory baked into scoring: cluster break-up, safety vs pot, cue ball path into the shot line.
- TV mode (bigger, higher contrast) for AirPlay mirroring.
- Not doing: social feed, match score tracking, pro-footage learning, humidity drift, multi-camera (maybe v3), left/right spin (later).

## Look and feel (decided)
- Always dark, premium, simple, modern with a little style. Frosted-glass panels, thin type (Inter, light weights for big numbers), one accent only.
- Accent: ice teal (#59d6e8). Gold was the alternative, not chosen.
- Landing zone look approved (green core fading with distance, amber/red only on the sides where they apply). Number tags on balls (5, 7) shown in the mockup.
- Reference mockup: scratchpad/real/out5.png (drawn over the user's Diamond-table photo; geometry there is placeholder, not real physics).
- Mock layout: top glass pills (Menu, game, Plan, more), bottom-left glass panel (cue-tip diagram, big strength number, option arrows), Safe-to-Bold slider on the right edge.
- Ball number tags over the balls: a menu toggle, OFF by default. Use it to double-check the app identified the balls correctly.

## Keeping the math small (battery and heat)
- Do not calculate constantly. Plan only when the table has settled; analyze the camera less often while you line up a shot.
- Prune first with geometry and theory: for each object ball keep only the pockets it can really reach (cut angle possible, nothing blocking), then only cue-ball lanes that are clear. Run the full physics (speed, spin, position) only on the few survivors. Banks and combos get their own small pass, only when direct shots are weak or a safety is better.
- Theory layer: check the layout against several known patterns at once, weigh how strongly each applies, and blend their suggestions instead of picking one rule.
- User says lighting is not a concern for now (home and good-light venues).

## Resume session
- Save session state after every shot (shots, results, table profile, mode, aggression). Save clips to local storage as they are recorded.
- If the last session ended abnormally (battery, call, crash), the home screen shows a Resume card (shot count, time ago) with Resume and Discard.
- Limits: clip for the shot in progress may be lost; the camera may re-ask permission after a restart on the Home Screen app; a phone call pauses the camera, resume tracking afterwards.

## Shot classification and insights (replaces the single break tip)
- Every shot gets labels: cut angle (straight-in, slight, medium, thin, very thin; rough bands ~5/20/40/60 degrees, tune later), shot type (stun/follow/draw, short/medium/long), bank/kick (rails used), safety, combo, break.
- Insights show only when the user filters to a category. End-of-session screen stays headline numbers only (remove the "move half a diamond right" tip from that screen).
- Breaks: group by where you broke from (left/center/right of head string, distance from rail in diamonds), what you aimed at (head ball / second ball), and results (balls made, cue ball position, scratches).
  - Different spots with enough breaks each (about 4-5+): comment only on the difference between groups.
  - Same spot every time: no position advice, offer a theory-based tweak (speed, tip position) as a suggestion.
  - Too few breaks: say nothing. Always say how many breaks it is based on.
- Still open: cut band names, whether to track which ball the break aims at.

## Decided: cut names and breaks
- Cut names by ball coverage: Straight 0-7, Three-quarter ~7-22, Half ball ~22-39, Quarter ball ~39-56, Sliver 56+ (degrees on tap).
- Break aim (head ball / second ball) tracked automatically from first contact; shown only in the Breaks filter.
- Filters can be combined (e.g. Quarter ball + draw + long). Insights only with enough matching shots; always show sample size. Optional trend (make rate over recent sessions).

## Build stages (proposed, build only on "make it")
1. Feel test: home, landscape camera, auto/manual calibration, ball detection + tag toggle, one best shot (ghost ball, aim line to pocket center, strength 1-10), pocket presets, diamonds, teal look, strength calibration. Goal: prove table + ball reading on a real table.
2. Position play: landing zone, locked candidate, Safe-Bold slider, scratch/ball-in-hand, diamond ruler toggle, advanced slices.
3. Memory: auto made/missed, shot labels (start saving in stage 1-2), table profiles, save/resume, end-of-session stats.
4. Review: clips, top 10 / misses, combined filters, insights, break grouping (most costly for battery/storage).
5. Extras: bank/kick trainer, training mode, safeties detail, TV mode, drift suggestion.

## Stage 1 UI decision
- Stage 1 shows the full play-screen UI over live video (top pills, bottom-left tip diagram + strength + option arrows, Safe-Bold slider on right edge). Controls for later stages are visible but inert. Open: dim inert controls slightly vs full brightness.
- DECIDED: controls not running yet are drawn in a red hue, same transparency and glass look as the teal ones (replaces the dim-vs-full-brightness question). Temporary: each turns teal when its stage ships. Watch for confusion with red = hard in the landing zone (zone not in stage 1, so no clash yet).

## STATUS: Stage 1 built (user said "make it") and delivered as site/index.html
- Teal glass dark UI, Inter. Red glass = not running yet: Train (home), Safe-Bold slider, diamond ruler, shot style, table profile.
- Working: home, auto/manual calibration, play 9/8-ball plan (ghost ball, aim line, strength 1-10, option arrows), teach balls, strength calibration, pocket presets (planner scale 0.9/1/1.17), ball number tags toggle (off).
- Removed for now: landing zone, target ring, pct/text in HUD.
- Not yet shown anywhere in Stage 1: diamond units (no distances displayed).
- Tested only on synthetic fake camera. Real-table test is the point of Stage 1.
- Fix after first real test: video skewed after rotating (size read while upright). Now syncs size to the live video each frame and waits for sideways before table detection; Back to menu on rotate screen.

## Round 2 fixes (internal only, built into /home/claude/site/index.html but NOT delivered; waiting for "make it")
Tested against the user's real photo (blue cloth, long-side low angle) used as the fake camera.
- Table finder: felt-colour mask (cushion faces excluded) -> hull -> best 4-gon -> straightened edges. Works from any side/angle. Rot (which way table is turned) chosen from side-pocket darkness, not edge length.
- Diamonds: finds white marks on the rails, fits rail offset/height automatically, refines the 4 corners. 18 of 18 on the photo at 800, 1280 and 16:9 crop. Teal diamond marks shown on the verify screen with the count.
- Balls: sphere-size model (balls are circles, not ellipses), thin-strip filter, pocket-blob filter, navy ball on blue felt, colour priors retuned (stripe vs solid). Auto table-size guess from ball size (photo picked 8 ft).
- Cards: verify/manual card is a slim bar at the bottom (or top when table is low), taps pass through except on buttons, so corner dots can be dragged anywhere.
- Open: ids can still swap on odd colour sets (Teach mode fixes); far-rail diamonds are tiny at this angle; lens fixed at 0.86 (auto lens estimate was too noisy); glove/chalk on felt shows up as an unknown ball (tap it, Not a ball).

## Round 3 fixes (live corner-angle report) — built in site/index.html but NOT yet sent
- Cause of phantom/duplicate balls: saved-table path skipped autoSize, wrong ft -> blobs split into extras. Now autoSize + diamond refine run on every table lock (fresh or saved), and liveScan re-runs autoSize if median single-ball area ratio is off (<0.72 or >1.4) three scans running.
- autoSize uses only single-ball blobs (k==1) for scoring.
- Settle logic ignores unlabeled blobs (layoutDiff on labeled only). Unlabeled blobs not drawn except in teach mode.
- Camera-move detection: 128px grayscale reference of area outside the table; diff>9 -> autoCalibrate, if conf>=.75 and corners moved >4px -> re-lock + diamonds + toast; 3 failures -> back to auto-find card.
- Known limit: 4 touching balls in a clump get split as 3.
- Test frame live1 has the app's own overlay baked in, so it is a noisy test; photo169 and move.y4m (A/B shifted frames) used instead.
- Sway tolerance: balls within 0.7" of their previous spot keep it; labeled balls missing <3 scans are held; once settled (stable>=8) full ball scan only every 3rd pass. Whole-picture slide up to 6% of width is followed by sliding the table outline (no re-find, balls keep table coords); only non-slide/big changes re-find the table. Tested with sway.y4m (shifts up to ~2px each 0.3 s): 0 toasts, 0 drift, ids stable.
- Round 3 sent to user after "build it".

## Round 4 (user live test 2) — sent after "build it"? NO: wait for "make it"
- Named/placed/dragged balls are pinned: stay while something non-felt sits there (spotHasBall).
- Table size: once user sets ft (S.ftSet) auto-size only hints, never overrides.
- Shot timing: rVFC frame timestamps (mediaTime) instead of uniform dt; real timestamps passed to analyzeTrack. Old calibrations reset (calVer 2).
- 9-ball/8-ball judging after shot (judgeShot): lowest ball first, rail/pocket after contact, scratch, 9 on foul spotted, win on legal 9. Status "Hit the N first".
- Learn the balls mode (home): circle at 46% height, bg colour from ring, blob in circle, features via 28px shrunk crop, 18 samples per ball (>=250ms apart), saved as walk samples (cl weight 0.2). Look-alike report at end. Portrait allowed.
- Round 4 sent to user after 'Make it'.
- Round 5: half-diamond motion threshold, 9-ball elimination of last unlabeled ball, End session + stats (makes/misses, tracked, ignored nudges), last-session button on home. Sent after 'let's do it'.

## Round 6
- Big bottom-right End session button (#endFab), single tap -> stats.
- Cue vs 9: ball "band" feature (stripe band vs specks) added to featCost/priors; after a shot, unmoved balls keep ids, cue = tracker end point.
- Persistent pinch zoom 1-4x (digital crop = view rect), detector/diamonds get the crop; quad stored in whole-frame coords; saved; badge resets to 1x. Learn mode forces 1x.
- Scratch: when cue ball is missing after a shot -> SCRATCH banner (fades after ~4s) + pulsing ring at best ball-in-hand spot (bestCuePlacement via bestEase vs legal targets).
- Sounds: ding at shot detect, dong at result; More menu Sound toggle.
- Motion threshold = full diamond (L/8) for stable/plan invalidation (testing).
- Calibration version bumped (calVer 2) -> old saved calibrations reset.

## Round 7
- Debug log (DBG): events table/hb/flip/unid/unsettle/relock/shot_start/shot_end/after/judge/plan*/manual/toast/snd/error; Save debug button on stats (share sheet -> download -> textarea); persisted to localStorage 'chalkline.dbg'.
- Sound: WAV clips via Audio elements unlocked on touchend/click, WebAudio back-up, all logged ('snd').
- mergeLabels: global nearest pairing, reach 2.6"; shake skip in checkMoved (jump>1.5px or fd>5, up to 4 passes); setN threshold 4.

## Versioning (agreed with user)
- Major round N: label V1.N, file indexN.html (const BUILD in app.js). Minor revision k of the same round: label V1.N.k, file indexN.k.html (set MINOR in app.js). Only deliver on "make it". User deletes old files. Home-screen icon opens index.html, so the user also uploads a copy named index.html if they want the icon to follow.

## Versioning, revised (user, Oct 9)
- No more "stages": the version number IS the stage. V1 = current (core recognition, planner, stats, debug). V2 = what used to be stage 2, etc.
- Roadmap: V1-V2 alpha builds -> V3 = debugging-finished -> V4 = finished, polished first release -> updates afterwards; alpha -> beta later, using normal release practice.
- Label: V<major>.<round>[.<minor>]  (V1.7, V1.7.1, V2.1). Files carry the full version from the next build on: index1.8.html, index1.7.1.html, index2.1.html (V1.7 shipped as index7.html).

## Versioning, final (user, Oct 9)
- Always ship a single file named index.html. Version is shown only inside the app (top of first screen, V1.7.1 style, and in the debug file). No versioned file names.

## V1.7.2 (Oct 10)
- Duplicate numbers fixed: hold step skips a ball whose number is already on the table; dedupeIds() after hold and after eliminate().
- Positions: median of last 7 readings (f.obs); "moved" still = a diamond; plan redone when a ball shifts >1.5in on 2 scans.
- Player in the way: detectBalls() marks blockers (edge-touching ratio>6, ratio>22, long-thin fill<0.2 ratio>=2.5) -> info.occ grid (+1.3 ball radius) and occFrac; never split into phantom balls. Hidden balls kept (hid) with no countdown; fragments next to blockers dropped (1.6in). Arming needs a visible cue; cue hidden by the cue tip within 2in keeps arming alive.
- checkMoved(): edge-pixel match (ref.eb, gmatch) tells person-in-front from camera move; relock keeps balls (table inches); no automatic beginAuto; "Cannot see the table" status; ref re-snapped after 10 clear steady scans if it contained a person.
- Shot result: afterShot -> S.pend when blocked; pendReady (all balls seen with trusted count / clear view), forced on next kept shot (endShot), timeout 20s -> partial (only certain drops). Count from S.tableN (updated only on clear, steady views; not between shot end and afterShot). cueGone remembered (scratch survives cue put back). firstHit 0 = unknown. Unread drops '?' handled in judge text. holdStatus keeps results on screen.
- Tracking runs inside requestVideoFrameCallback (generation token). Camera restart (track ended / no frames 3 s / back from background) with 8 s timeout; camera settings logged ('cam').
- Tests: scratchpad t172a (dups/median), t172occ (occ.y4m, big.y4m), t172pend, t172shot (shot, shotocc2, scratch), t172cam, rail.py (rail3) + runall.sh regression.
- Known: autoSize can flip 8<->9 ft on some frames (pre-existing); color ID still confuses 4/2 when the real 2 is hidden.

## V1.7.3 (Oct 10, from the user's first real debug log, home 7 ft table)
- Log showed 14 false "camera moved" relocks (people walking by) onto outlines 60-175 px off -> balls jumped -> phantom shots; autoSize flipped 7->9 ft mid-game; ding fired for white things off the table; 2 never learned.
- checkMoved: rail-diamond check first (diamondsFit, small refit) when S.diaLock >= 8; else / then only after ~2 s of a still picture (S.stillN), candidate within 0.12W, area 0.8-1.25, found twice, diamonds confirm (if available). Failed relock -> S.relockWait (4 s, scans paused) not "in place". tableMoved(): clears arming, no shots for 2.5 s. After 20 s lost: card "Find the table again / Keep waiting". Ref never snapped while someone is over the table.
- Table size: chips on the Table found card (guess preselected), accept = ftSet; never changed mid-game.
- Shots: candidate within 22 in, on the cloth, not in a blocker; ding only after >3 in over 4 points. 3+ balls on a non-break = "not counted".
- Vision: navy-on-blue isCloth rule; SET_LOOK priors measured from the user's own set photo (cue..9); assignIds = optimal (Hungarian) with unnamed/absent options. Synthetic test balls/set_on_table: 9/10 right (8 lost to a black glove left on the cloth).
- Home screen lists balls not yet learned.
- Position zone for the NEXT ball (V1.7.3, user: 'where you want the cue ball to finish for the next one'): next legal ball after the planned pot, its best pocket (2nd only if >=80% as good; side pockets need entry <=55deg, corners <=60, path clear). Cells (1.25in) within 3.6 diamonds: green cut<=15deg & 0.6-2.6 diamonds from the ghost ball; amber <=25deg 0.4-3.0; red <=33deg 0.3-3.3; grey striped = angle fine but another ball blocks (hooked). Skips near pockets and balls. Soft layers 22% (grey 32%), dashed ring on the next ball, faint line to its pocket. Path lines lighter (.55).

## V1.8 (Oct 11)
- Every 9-ball/8-ball start finds the table fresh (phone may have moved). Auto-starts when confident (conf>=0.85, size already set, >=12 diamonds) with toast "Table found (7 ft)"; else the Table found card.
- Fixed cushion shadows (STILL): first 8 scans on a found table record dark/bright non-cloth spots in 0.25in cells. Cells dark in >=half the scans within 4.5R of a cushion are the shadow; dark spots joined to them (glove/chalk lying at the rail) out to 10in go too; 1-cell dilation. Balls are protected in IMAGE space (1.6x their image radius; ball well clear of the band always protected, near the band only if ball-shaped). A learned cell showing plain cloth (dark<5%) 6 scans in a row is given back (arm resting during learning). Reset on new table / tableMoved. With mask on, the 'reaches in from the edge' band widens to 3.5R.
- Ghosts on the cushion line ignored (centre within 0.9R of the cushion). Max 10 balls in 9-ball (16 otherwise), keep best-scored. Pocketed numbers not reused until a new rack (S.gone; 9 on a foul goes back). Ball picker: "Taken off by hand".
- Shot validity: first sighting >9in from the armed cue = not the cue; per-hop speed/off-table checks count rec.bad; ding only after 5 good points and >3in; shot rejected if bad >=3 and >=half the points (walk-by).
- Unseen shots: last settled clear layout (S.snap); next clear settled layout with cue moved and another ball moved/dropped, no shot recorded in between -> recorded from before/after (no speed, first hit unknown), stats "not seen, read after". Cue alone moving = ball in hand. Snap cleared on kept shot / tableMoved.
- Self-correction (9-ball): judged first hit != lowest, no scratch -> S.fix. Next shot starts within 4in of where the cue stopped (no ball in hand) -> it was legal: swap the two numbers everywhere, fix the stats row, learn both looks, toast. Cue moved (ball in hand) -> labels stand.
- Planner/zone: zone graded with two-ball lookahead (shotGrade on next ball + shapeOK natural stop/stun/follow/draw lines to the ball after); on 8->9 only the 9 matters; never in a pocket. valueOf position term uses zone quality; extra phase B2 refines speed/spin for the top 6 pots. Drawn: solid white cue line after contact through each rail to the planned stop, small dot ringed by zone colour; grey striped = hooked.
- Tests: t18strip (synthetic cushion strip + glove: 6 balls, occ 0, tableN set), t18unseen (oc/unseen.y4m), t18auto (second start auto-lock + applyFix both cases), regression runall.sh.
- Review fixes (V1.8): mask stores each learned cell's average colour; a pixel there is skipped only while it still looks like that (sum |dRGB| < 60), so a ball stopping on the shadow is seen. Protection = every found ball and every tracked ball (rail-frozen too), in image space. Heal judged over 6-scan windows (far-side cells have 1-2 px). Per-scan buffers reused. After-shot read uses the mask. Cushion-line ghost cut at 0.6R (frozen balls sit at R). First sighting limit 14in once the cue has been out of sight >0.3s. unseenCheck: movement on named balls, drop must show in named and full counts, layout equal to the last shot's start = re-setup (no shot), "Taken off by hand" removes the ball from the snapshot. applyFix runs in endShot after the shot is kept. S.gone resets when more balls show than could still be up. Ding tolerates the odd bad hop.
- Table map look (user, Oct 11): cloth = median RGB of cloth pixels the camera sees, sampled once at acceptTable (S.felt, saved). Charcoal rails (gradient, bevel line, soft drop shadow), cushions = cloth 35% darker, cloth lit slightly in the middle, faint head string + foot spot, pearl diamonds, pockets with dark rim. Painted into a cached canvas (feltCache). Map balls glossy: shadow, edge darkening, highlight, number on a white disc.

## V1.8.1 (Oct 11) and saved for later
- Post-shot card ("You hit strength X, N mph off the tip, estimated spin, aim vs plan") removed from the screen (user didn't like it). The read is still computed and saved (S.meas, S.history, stats mph) and written to the debug log as 'shot_read'.
- FUTURE (user): when shot VIDEO saving is added, bring this back there: each saved shot clip carries "what happened during the shot" (strength, speed, spin, aim vs plan, first ball hit, result).

## V2 — new path (user, Oct 12). Version plan scrapped and restarted.
Why: the hand-written colour detector can't reliably see/name balls (the navy 2 on blue cloth is often never seen whole).
Direction: collect labeled pictures from real play -> train a small detector (YOLO-nano class) -> run it in Safari
(onnxruntime-web, WebGPU in iOS 26; model file ~6 MB next to index.html, so the repo will hold 2 files then).
Training: in Claude's workspace on CPU (slow, free) or Google Colab free GPU. No Mac, no paid service.
Long-term goals KEPT (come back on top of the new detector): shot planner + cue line through rails + position zone with
two-ball lookahead + hooked areas; 9-ball training/runout practice; replay/video with per-shot read (strength, speed, spin,
aim vs plan, first hit, result) — the post-shot card lives there; drills; strength calibration; table map look (player's
cloth colour, charcoal rails); smaller overlays over the cloth; no text on the cloth; balls always clearly visible.

### V2.0 (Oct 12) — Watch & Learn
- New home mode "Watch & Learn" (S.watch on top of play9 machinery). 8-ball removed (S.game forced 9ball; menu game row hidden).
  Play 9-ball kept as "The V1 shot planner", plus Learn the balls / Calibrate.
- Watch mode: no planning, no zones/lines/ghost/spin panel, no Bold/Safe, no rules/fouls/results panel. Draws only ball rings
  with number tags. Status line: "Watching. Rack N · next: the K · M shots". Ding at shot start, dong when the result is in.
- Shot end = all balls stopped (all modes): settleWatch after the cue ball stops: detectBalls + luminance diff on open cloth
  (occluder grid excluded), quiet >= 0.9 s (balls within 0.4in, changed points < max(6, 0.15%)), cap 25 s; liveScan paused.
- Microphone (watch only, menu toggle, default on): AnalyserNode on AU.ctx polled every 20 ms; onset = 1 ms block energy of
  first difference > 10x running floor; 45 ms refractory; own ding/dong ignored. Strike click = within -450..+80 ms of the
  first cue sighting; contact click = first later click with the cue ball (track, extrapolated <=0.5 s if lost) within
  2R+2in of a ball. Mic retry with audioSession 'play-and-record' if refused.
- First ball hit: camera = first track segment passing a ball (moving toward it) with gap < 0.4+2.5*ipp ("sure") or
  < 1.0+6*ipp with a bend (>=8 deg) / slow-down (<0.6) (ipp = inches per pixel at that ball); else mic; else the fit.
- Truth (lowest-ball rule): rack starts target 1 (session start with n<=7 object balls: target 10-n). Shot with >=1 object
  ball down -> target+1 (2+ down -> rack unsure). New rack when clear count >= min+3 and >= 6. Learning: the first ball
  hit (track, or mic with a strike) -> play sample {id: target, play:1} (cap 15 per id) + cue sample. Logged as 'truth'.
- Pictures: before = last clear settled view (refreshed each second, dropped at each shot end), after = when settled.
  Full-res crop of table+rails (<=1280 px), JPEG 0.85, IndexedDB 'chalkline'/'files' key s<t0>/shotNNN-before|after.jpg +
  labels.json (per ball: vision id, table x/y, px/py/pr in the picture, conf, top matches; truth target, via, objAt, drop,
  mic). Last 3 sessions kept.
- Save debug = zip (store) of log.txt + pictures + labels.json, shared as the file only (no title — the title-only share was
  why the user got a 15-byte "Chalkline debug" text). Fallback: download.
- Pop-ups (menu, ball picker, stats) close on a tap outside; Table found card does not.
- Tests: t2watch(.py/_noft) end-to-end + zip, t2mic (detector), t2micmatch (track/mic first hit), roll.y4m settle test.
- V2.0 review fixes: audioSession 'auto' while the mic listens (audioInit no longer forces 'playback' then), back to
  'playback' on micStop; track ended/mute logged. Analyser fftSize 32768. Settling: motion = cloth/not-cloth flips on open
  cloth (shadows ignored), balls blinking in/out ignored, 12 s cap (timeout noted on the shot). Pictures held on the shot
  (frBef at shot start, frAft at settle end), canvas pool (<=6, busy flag). Mic clock: rVFC captureTime when present
  (VF.cap); lag from the strike click (clamped). Save debug = two taps (pack, then "Share debug file (x MB)") because iOS
  needs the share call right after a tap. "Clear and keep playing" restarts the picture session. Walk samples always kept
  when saving (others trimmed to 260). IndexedDB: onabort, reconnect. Truth waits for a non-empty table to start.
- Tests added: t2truth (target across shots/racks), t2shots (home/live/menu screenshots, tap-outside for picker/stats).

## V2.1 (Oct 12, from the first real Watch & Learn session: 35 shots, 70 pictures)
Findings: table only ~130 of 720 camera rows (low, side view; tall wobbly tripod); balls near the far rail lost at 800 px ->
counted as pocketed -> target drift -> false new racks; arm/cue fragments counted as balls in the before list; ~5 of 9
learned looks had the wrong number; ~30 camera-moved corrections, many during screen taps.
- Analysis picture at up to 1280 px (SRC_MAX) instead of 800.
- Truth model rewritten: clean looks only (no occluder at all, nothing hidden) at arming; nArm = median of last 7; a shot's
  drop = nBefore (clean, before the shot) - nArm (clean, before the next shot), confirmed in truthLook (fallback: the shot's
  own drop if no clean look happened). New rack: nArm >= 8 after min <= 3 or a finished rack. Start: nArm>=8 -> 1 else 10-n.
- Learning only if: target known, rack not unsure, count steady before the shot, hit clearly seen (track sure / bend, or mic
  with strike), not unseen, not doubt. V2.0 play samples dropped once on load (v21 flag).
- Frozen cue ball: a ball within 0.3+2*ipp gap of where the cue sat counts as hit when the cue heads off within ~105 deg.
- Hidden ball: no ball near the path -> first sharp bend (>=15 deg or speed x0.5) >=3in from cushions; object at contact +
  2R along (v_in - v_out); 'see' = fraction of that spot in the before picture unlike the cloth. Logged + labels (inferred).
- Mic: weak clicks (5x floor) kept for contact; strike needs a strong one.
- Ball in hand: hand (occluder) at the cue ball at the start, and (mic healthy, no strike click, v0 < 25 in/s) or v0 < 15
  -> no ding, not a shot, counted as ball in hand.
- Wobble: finger down + 2 s after, and motion sensor rotation > 3 deg/s (+0.7 s) -> nothing read, no shot can start;
  afterwards diamondsFit recheck (refit if moved > max(3 px, 0.3% width)), fresh reference picture.
- "Throw out last shot" button (bottom left): shot leaves stats, its learned looks removed, truth restored from the shot's
  snapshot, labels marked thrown (pictures kept).
- Before pictures only with no occluder at all.
- Tests: t21truth (model + throw-out + migration), t21info (frozen, hidden, hand, wobble).
- Review fixes + later changes (V2.1): 1280 analysis REVERTED (tracking frames dropped in tests) -> instead autoFrame(): after
  the table is accepted in Watch & Learn, zoom the working picture onto table+7in rails (+6%/25% room), z<=2.5; each Watch
  session starts unzoomed. Real session geometry -> z ~1.4 (the user had pinched 1.44 by hand).
- Real-picture replay (shot 3 after-frame rebuilt from labels crop + session quadN): far-rail cue ball and 9 were missed
  because (a) pixels inside-table test used the cloth plane, cutting off the upper half of balls near the far cushion ->
  now pixels past a far side (away from the camera, from cam.C) are re-measured at ball-centre height (rail is higher, still
  outside); far pocket holes excluded from those (pk.r+2.5); bbox includes corners at 2R height; (b) learned shadow mask
  skipped white/bright ball pixels -> mask now skips only cloth-hued pixels (|dh|<28, s>0.2) or dark ones on a dark learned
  spot; (c) pocket filter dropped balls near pocket mouths (pk.r+1) -> now only inside 0.75 pk.r, near the mouth only if
  ball-like. Result on that frame: all 8 balls found (was 6).
- detectBalls work buffers reused (DETB). Truth: odd window median rounded; count went up -> shot's own drop; clean-look
  fallback after 20 s; ball-in-hand only with a hand ON the ball and v0<12 (no strike) or <6; weak click upgraded inside
  the refractory; frozen-ball cos>-0.1, sure only cos>0.2; throw-out disabled while a shot is in flight; LEARNED cleared per
  session; touch freeze capped at 10 s and reset on hide; motion permission asked before the camera; recheck keeps the old
  camera-moved reference unless the diamonds confirmed the table; checkMoved px thresholds scale with S.W/800.
- Known: shotocc2 (V1 play mode test) now arms later because of the 2 s freeze after tapping "Looks right" (test timing).

## V2.2 (built Oct 13) — plan as agreed Oct 12
- Home: Watch & Learn (keep) + NEW "Learn the balls" guided drill (replaces walk-around). Remove Play 9-ball and Calibrate
  strength from home (keep code).
- Drill: balls 1..9, 3 MADE shots each. App draws a ghost zone (hand-sized, turns green when a ball is in it) for the object
  ball and for the cue ball; "Step back… Watching"; ding/dong; a miss -> "shoot it again"; then next spot; then next ball.
  Spots: mostly straight, easy, object near enough to a pocket, cue ball a few feet back; vary pocket/middle/far rail/side
  pockets/shade; choose shots so the shooter stands on the far side or ends (shooting toward the camera; never between
  the phone and the balls; use cam.C). If the ball can't be seen on its ghost (the 2), carry on anyway (certain label).
  Learns live (labels certain) + saves pictures. Summary at the end. Later: stripes 10-15 (more shots, rotate the ball).
- Fix the navy 2: real pictures (session 3) show the 2 hue 199-204 (cloth 199), s 0.98-0.99 (cloth 0.86), v 0.36-0.46
  (cloth 0.93); isCloth navy rule needs s > cl.s+0.15 (=1.01) -> misses. Loosen (e.g. s > min(0.97, cl.s+0.1), v < 0.65 cl.v)
  and test offline on real3 pictures (shots 7-17 are the 2).
- Turn off learning in Watch & Learn (count-based truth drifted when the invisible 2 dropped; 9/13 lessons wrong in session
  2); clear play samples again. Later re-enable only when the order rule AND the camera's top-2 agree.
- Ball in hand: picked-up cue logged as "unseen shot" -> fix. Hand-named balls must stay pinned (spotHasBall fails on the 2).
- Lag (user felt it in V2.1 sessions; hb fps avg ~60, so short stalls): add a stall meter (long frames + what ran), cut work
  after touches (diamondsFit/hiFrame on every recheck, still relearn).
- Ghost balls on arms/cue in before pictures when the arm isn't classed as a person -> tighten.
- Data so far: real1 (35 shots), real2 (56), real3 (51, single ball, certain labels) in scratchpad.

### What V2.2 actually does
- Home: Watch & Learn + Learn the balls (drill). Play 9-ball / Calibrate / walk-around learn: code kept, no home buttons
  (tests start them with __chalk.startMode).
- Navy 2 (vision.js): isCloth navy rule `v < 0.66 cl.v && s > min(0.95, cl.s+0.15)`; navy-core pixels marked (DETB.nv); a blob
  that is mostly navy core (and not thin) is rebuilt by navyBall(): core + felt-hued pixels clearly darker than the felt
  (v < 0.85 cl.v) within 1.6 then 1.1 ball radii, recentred 3x, accepted at ratio 0.5-1.5; same pocket/cushion checks.
  Real3 harness (h22.py/chk2.py): the 2 found in 7 of 7 checkable shots (was 2), and shots 13/15 found a real 2 on the far
  rail; hand-shadow ghosts (shots 8, 41) dropped by the compactness check. No new ghosts over all 51 shots.
- Drill: S.drillMode on top of Watch (S.truth off). drillCands(): pockets x angle x distance, cue 26-42" behind, cut <= 5 deg,
  body (behind the cue, off the table) and lean point must stay out of the camera's sight lines to obj/cue/pocket and must
  not be on the camera's side of the table. drillPlan(): 27 spots over 6 table regions (near/far alternated), easiest few
  per region, pocket varies. Rings 3"/4" (accepted 1.5x), green when in. Ring ball forced to the drill number, other to cue.
  Shot start snapshot (drillShotStart) -> drillResult: made = object drop >= 1, or ball never seen on its ring (taken as
  made; Throw out reverts). Learns the ring ball's look every shot (made or not) as {walk,drill} samples (12 per ball; the
  old walk-around looks of that ball are dropped at the first drill sample). Pictures saved with drill labels.
- Watch & Learn: learns nothing (sureHit still logged); v22 migration clears play samples; unseen shots only logged
  (ball in hand looked like one); pinned (hand-named) balls stay until the next shot; before pictures need stable >= 5;
  no diamond search after touches; 9 ft size toast removed (logged); stall meter in hb (late frames, max ms per work kind).
- Review fixes (V2.2): Watch/drill afterShot names the ball at the tracker's end point the cue ball first (a soft straight
  shot left the cue on the object's spot and it took the object's number -> "scratch, missed"); unseen shots in Watch are
  skipped only when nothing but the cue ball changed (real unseen makes still move the target); pins last until the next
  shot AND at most 60 s; navyBall rejects a core inside a big dark patch (ring 1.3-1.8 r must be mostly ordinary felt);
  drill labels only from balls in view, cue must look white; plan rebuilt on every table lock; throw-out gives back looks
  a drill shot replaced; drill before pictures at stable >= 3; LAG.last reset on stop/hidden.
- Tests: t22drill.py (plan, status, rings, make/miss/throw-out/blind/summary, one real shot through the pipeline),
  t22unseen.py, h22plan.py (spots drawn on a real3 picture), h22.py/chk2.py (navy 2). Old tests start removed modes with
  __chalk.startMode. Known flaky: s11 sway ghosts (V2.1 too), s20 scratch race, t2micmatch stale.

## Ball library (Oct 13, after real4/real5)
- /home/claude/library (see its README): 1851 crops from all sessions, every label checked by eye; feat_data.json.
- Leave-one-session-out naming test: built-in looks 78% -> + library looks 98%. Not-a-ball looks catch 81% of hands
  but call 3.6% of balls not-a-ball. Candidate for the app: ship the library looks as built-in samples (needs "build it").
- real4 (drill) findings: unseen-shot check still fires in the drill (ball moved to next ring); player at the table end
  read as 6 balls (k-split blob) -> allN 8, drops 5-7; drill "made" should be "ring ball gone", not dropN.
- real5 (watch) findings: bridge hand fingers read as 3-4 low-number balls in before pictures -> multi-drops, target
  drift. Plan: a ball must be settled for a few seconds to count as dropped; edge-touching medium blobs = person.
- Lag: hb shows 60 fps, scans 30-60 ms, one 3.5 s stall at a camera restart.
- Replay (replay22.py, truth = hand-checked library): drill "ring ball gone" rule right on 30/31 shots (app 29/31; fixes
  the thrown-out shot 22); 3 ball-move "shots" ignored. Watch: "a ball must have sat still >= 3 s (cue ball always
  counts) before it can count as dropped" -> drop count right on 22/24 shots (app 18/24); 6 s is worse (21).
- Small trained recognizer (library/train2.py, mlp24.json): 24x24 crop + 5 colour numbers -> 64 hidden -> 11 classes
  (cue, 1-9, not-a-ball). Leave-one-session-out 96.5% overall, not-a-ball 194/196. Weak spot: the 9 with its stripe
  turned away reads as the cue ball (real2 shots 45-56). int8 weights 148 KB JSON; 0.14 ms per spot in headless
  Chromium (container CPU), so a scan of ~10 spots costs ~1-2 ms. Candidate to ship alongside or instead of colour naming.
- User wants a TV / big-screen view in the final product (he mirrors the phone to a Roku while testing at home; the
  stutter he saw was the mirroring, not the app). Options for later: a light TV page fed by the phone (laptop/smart-TV
  browser; Roku has no real browser), or a native app with AirPlay/Chromecast second-screen. Shares plumbing with the
  projector mode.

## real6 — pool hall, 9 ft, Watch & Learn (Oct 13 evening)
- Cloth lighter cyan (felt rgb 89,210,245; h~188 s~0.62 v~0.95 vs home s 0.87). Different ball set: bright royal-blue 2,
  black 8 (home: navy 2) -> app swapped 2 and 8 constantly; 33 hand corrections. Spectators' heads/hats/arms in frame.
- Table filled the frame edge to edge (near-left pocket at the picture edge); auto-find gave unstable near corners.
- Outline drifted INSIDE the real table (near corners ~35-60 px, far-left ~27 px): 54 "camera moved" relocks (people
  walking in view of the reference area) each followed by a diamond refit; bright lamp glare on the near rail competes
  with the diamonds. Result: cue ball/balls near the near cushion and left end fell outside -> "not catching balls".
  Fix ideas: cap refits to a small distance from the accepted outline; ignore person areas in the moved check;
  tip: phone farther/higher so every pocket has margin.
- Library: +426 hall crops reviewed (148 labels corrected); app was right 278/341 (82%). Recognizer: home sessions stay
  95-99%; hall judged with home-only training 39% (new venue/ball set); with hall pictures from the first 15-22 shots
  in training, later hall shots 75-88%. => a short Learn-the-balls drill per venue/ball set is the way.
- Lag fine (58 fps, scan p90 68 ms).

## Stripes / 15 balls (agreed Oct 13)
- Goal: know every ball's number (10-15 too). Fallback if stripes prove too hard: groups only — cue, 8, solid, stripe.
- What each game really needs: straight pool / one pocket / bank pool = cue + which balls dropped where; 8-ball = cue,
  8, solid/stripe; 9-ball = 1-9 (the 9 is the only stripe); 10-ball = 1-10 with two stripes, the 9 (yellow) and the
  10 (blue) -> stripe-or-solid + colour settles them (blue solid = 2, blue stripe = 10). Drills need numbers only for
  rotation drills (keep those to 9/10 balls); free-order and pattern drills need "a ball dropped" / position only.
- Hard case: a stripe rolled band-up/away looks white (the 9 vs cue confusion already seen). Handle with: numbers held
  while a ball doesn't move, elimination, the cue ball's red dots, a stripes drill that shows each stripe in several turns.
- Order: after 1-9 are solid (likely ~V2.5). Play 9-ball returns (experimental) once Watch & Learn tracks a full rack.
- Next build (V2.3) list: auto camera zoom 0.5-1x (narrowest that fits table + margin, lens model follows zoom); outline
  held to the accepted one (tiny refits only), people ignored in the camera-moved check; ball must sit still 3 s to
  count as dropped (cue always); drill = only cue + called ball, made = ring ball gone, no unseen shots, own-guess vs
  called logged + per-ball score, extra blobs saved as not-a-ball; trained recognizer (library) for naming + hands;
  Watch & Learn learns from hand corrections (certain labels).

## Delivery rule (user, Oct 13)
- Every new index.html delivery also includes DESIGN_NOTES.md (upload both to the repo).
- chalkline-backup.zip (sent Oct 13): notes, source (src/, build.py), library labels (manifest.csv), recognizer
  weights (mlp24.json), library scripts. Crops not included: rebuild them from the session zips with library/build.py
  + the real6 append step (labels come from manifest.csv).

## Home / Away and future modes (user, Oct 14)
- V2.3: Home / Away switch instead of naming every venue. Home = the user's own table and balls (its own learned looks).
  Away = any other table: uses everything learned from away ball sets (pooled), and asks for the short
  "show me the balls" setup (place each ball on the ring, no shots) before playing. Learning at away never touches home.
- V2.3 also: table-setup check (pocket circles on the outline, warning when a pocket is near the picture edge).
- Future modes, table profiles, other cue sports and business ideas from this day are kept with the private project plans.

## V2.3 (built Oct 14)
- Camera zoom: starts at the zoom saved for this profile (else the widest, 0.5x), finds the table, then zooms to the
  narrowest that fits the outline + margin (zoomToFit keeps the picture centre; up to 2 refits), or zooms out once if
  the table is not found / a pocket is at the edge. Verify card: edge warning, "Camera 0.7x · Wider · Closer" chips,
  bright pocket rings. lensZ() = lens x zoom feeds every camera model. Re-applied after a camera restart.
  Resolution stays 1280x720 (1080p at <1x left for later).
- Outline hold: the accepted outline (S.quadAcc, frame-normalised) may only be nudged by a diamond refit up to 0.8% of
  the frame; bigger "refits" are logged (refit_skip) and ignored. 3 skips in a row -> full relock check (autoCalibrate,
  same place twice); a real camera move resets the accepted outline.
- Home / Away profiles (S.profiles, S.prof): table size, last outline, zoom, learned looks each. Home screen "Table:
  Home | Away". Away + Watch & Learn offers "Show me the balls" first. recPen: home 0.15, away 0.3 per ball (0.8 for
  a ball the away profile has its own looks for). Switching profile clears the last session's outline in memory.
- Show me the balls (mode 'quick', also from the away prompt): cue ball then 1-9, each on a near ring then a far ring;
  captured when the ball has sat still 3 looks with nobody over the table and the ring was seen empty since the last
  capture; learns the look (drill sample) for this profile, saves lookNNN.jpg with its label; no shot tracking.
- Recognizer (src/recog.json = library/mlp24.json, trained on all 6 sessions; build.py injects it into vision.js):
  run on 24x24 crops cut from the full camera picture (3.2 radii); naming cost = min(recognizer -0.7 ln p + recPen,
  colour prior + 0.4, learned look). Not-a-ball spots dropped only if p_nb > 0.8, > 3x any ball, and (split blob or
  fill < 0.55 or p_nb > 0.97), never next to a long-seen ball or on the drill ring; a "not-a-ball" spot that stays
  put is kept (1 s with nobody over the table, or 4 s; dbg nb_keep); after a shot a split blob alone is not enough
  (two balls frozen together). ?norecog=1 switches it off (the old
  synthetic-video tests use it). Offline: real3/real5/real6 pictures 91/80/48% -> 100/99/89% (in-sample).
- Drop rule: at a shot, balls (not the cue) that appeared after the table settled (S.settleT0 + 0.3 s) and < 3 s
  before the shot are left out of "before" and the ball count (dbg 'young'). Not in the drill. (v1 used "< 3 s" alone
  and threw out the whole table when a shot came right after the lock.) The ball count only loses spots it counted
  (S.tableNT); a ball that blinked out and came back on the same spot within 10 s keeps its first-seen time.
- Drill: made = ring ball not seen after (hidden counts as still there) and (called gone or, with a clear view,
  nothing else left); no unseen shots in drill; recognizer's
  own guess logged per shot, "knew it x/y" per ball in the summary; picture labels carry rec/nb/extra.
- Watch & Learn: naming a ball by hand teaches that look to the current profile (addLook, max 16 per ball).
- Review fixes (independent review, Oct 14): fresh shot state when going to/from Show me the balls (no phantom shot);
  zoom callbacks ignored after leaving the mode (S.modeTok); either empty ring counts as seen empty in the setup.
- Tests: regression suite (norecog) same as V2.2 except t172shot now right ("Off the table: 4"); shotocc2 (shot with
  3 balls hidden at the start) still reads "No ball dropped", same as V2.2 (known). t22drill, t23quick, t23rec
  (100/99/88%), t2watch, t21truth, t21info, t18unseen, t22unseen pass.
- To test next: Show me the balls + Learn the balls at home; at the hall pick Away + 9 ft, run Show me the balls,
  then Watch & Learn. Check the zoom chosen, the pocket rings, and whether the outline stays put while people walk by.

## real7 — V2.3 at home, 7 ft (Oct 14 evening: Show me the balls + Watch 13 shots, Learn the balls 31 shots, Watch 10 shots)
Truth checked by eye (scratchpad r7truth.py). Same balls as always.
- Names right (app): first Watch 91% (121/133), second Watch 67% (69/103). Recognizer alone: 72% / 80%; its guess on
  the single ring ball: Show me the balls 14/20, drill 18/28 (was ~96% on V2.2 pictures).
- MAIN CAUSE (V2.3 regression): auto zoom settled at 0.95x. Below 1x the iPhone switches to the ultra-wide lens, cropped
  ~2x: balls come out smeared, stripes and the purple 4 wash out (side-by-side crops vs real5 look like a different
  camera). Recognizer confusions all point that way: 9->cue, 4->8, 1->9, 5->3. Fix: stay at 1x whenever the table
  fits at 1x; go below 1x only when it must (hall), and then capture at higher resolution.
- Swaps after shots: the cue ball stopping next to the 4 took the "cue" name and the 4 was called pocketed (shot 5);
  cue/9 swapped after they touched (shots 10-11).
- Wrong names from the start never corrected: second Watch began with 4 and 7 swapped and the 8 called 4 (later 3)
  for the whole session, while the recognizer had them right on most pictures.
- Ideas agreed to discuss: follow every moving ball through the shot (not just the cue ball) so names travel with the
  balls; keep re-checking names over many looks and swap when the evidence clearly disagrees.
- User (Oct 14, 18:50): NEVER go below 1x, period (no auto zoom out, no Wider below 1x; hall table must fit at 1x —
  the app should say "move the phone back/up" instead). Track every ball's path so the app can say continuously
  "this is the x, these are the y's". Order of real7: Show me the balls (+ Watch shots 1-13 right after), Learn the
  balls drill, then Watch session. Note: the last session, after both trainings, was the worst (67%): the looks
  learned in V2.3 were taken through the blurry 0.95x lens and the min() rule lets a bad learned look win.
  Next version is V2.3.1 (user: not really adding anything): 1x lock, track every ball, keep re-checking names, drop
  the looks learned in V2.3 sessions (keep V2.2's), user re-runs Show me the balls at 1x.

## V2.3.1 (built Oct 14 evening) — 1x lock, ball paths, names re-checked
- Camera: always 1x (setCamZoom only sets 1; no auto fit, no Wider/Closer). Table not fitting -> "move the phone back
  or higher" on the verify card.
- Migration (flag v231): learned looks taken after Oct 14 20:00 UTC are dropped from a profile whose saved camera zoom
  was below 1x (the user's Home: 0.95x). V2.2 looks kept. Re-run Show me the balls at 1x.
- Ball paths (MT, mtStart/mtStep/mtFinish): from shot start until the table settles, every camera frame (every other
  one after the cue ball stops) on the tracker picture (<=640 px): not-felt mask on a 2-px grid over the cloth (z=0 cells,
  learned cushion shadows and pocket holes left out), blobs. A ball at rest holds its spot while its middle is not felt;
  2 felt looks = it left. Moving balls matched closest-pair-first over all balls at once; a blob already holding k
  balls is taken only if bigger than k+0.55 balls (position = (k+1)*centroid - others). Picked up only after a long gap
  = unsure. Vanished within pocket r+2.5" after being seen moving = 'pocket'. The cue ball uses its own tracker while
  that runs. Cost about 0.7 ms a frame (desktop test). dbg 'paths' has every moved ball's path (<=30 points).
- After the shot: path ends name balls first (not unsure; the cue only if its tracker saw it settle there; never
  against a recognizer >0.9 sure of another number), then the cue-end rule, the did-not-move rule, then colour.
  A ball whose path went into a pocket is kept out of colour naming (if the count, hidden balls included, allows) and
  is counted down even when the ball count could not show it (count untrusted / lower than now). This fixed the old
  "shot while 3 balls were blocked" case (shotocc2: now "Off the table: 4").
- Names re-checked (S.ev, evAdd/recheckNames): every live look at a still, separate, named ball adds its cost for each
  number (idCost = recognizer / colour guesses / learned looks); the last 40 looks count. With >= 6 looks, a Hungarian
  reassignment with 0.3 bonus for the current name; applied only if every changed ball fits its new number by >= 0.45
  better. Pinned (hand-named) balls and the drill are never touched; pocketed numbers are not handed out. Evidence moves
  with the name; colour-assigned names start fresh; path/cue-named keep only 3 looks. Status "Names fixed: ...".
  Simulated on saved pictures (truth by eye): real3 95->99%, real5 93->99% (21 fixed, 0 broken), real7 1707 94->95%,
  1729 75->81% (blurry 0.95x pictures).
- Synthetic tests added: frozen.y4m (cue stops against the 4), follow.y4m (cue follows onto the 4's old spot while the 4
  rolls on; V2.3 called the cue ball the 4 in 9-ball mode, V2.3.1 right in both modes).
- Independent review (12 findings) fixed: global matching, unsure pick-ups, cue path only when settled, pocket only after
  moving, hidden balls in the count, shadow/pocket cells in the right frame, small far balls "unknown" not "left",
  no double claims, cue seenT, evidence shrink, migration only for <1x profiles, setCamZoom always applies 1x.

## real8 — V2.3.1 at home (Oct 15 evening): Learn the balls drill (35 shots), Show me the balls, Watch (26 shots, 2 racks)
- Pictures at 1x are sharp again. Show me the balls: recognizer knew 18/20 before the ball was placed (1 called 9 once,
  9 called cue once). Watch naming good; names re-check fixed 3 (9->cue, 8->1, 6->8 at the re-rack). Paths logged.
- Data looked freshly cleared (drill started with 0 learned looks and the 9 ft default).
- Drill: 35 shots recorded (29 made). 2 were hand placements recorded as shots (thrown out by user). 3 real shots missed
  ("made it and nothing happened"):
  * t=872 s: a white thing just off the cloth near the cue ball (hand/sleeve, 'not_cue' at y=41.7) was the CLOSEST white
    to the cue's spot every frame; findWhite returns only the closest, it was rejected, so the real cue ball rolling away
    was never picked up. Fix: skip off-cloth / inside-person candidates inside the search, take the next closest.
  * t=161 s, 334 s: cue ball placed by hand (rightly ignored as not a shot), then shot within ~1 s, before the table had
    re-settled (arming needs the whole table still for ~3 scans). Fix: arm on the cue ball alone being still ~0.5 s.
  * In the drill a missed shot can't be recovered (unseen-shot check is off in the drill).
- Watch: the "next: the N" target is count-based (target+1 per drop, from V2.1 when names were unreliable): after the 3
  went in out of order it said "next: the 3" while the 4 was lowest; a ghost named 4 (4 already made) appeared at rack 2.
  Bridge-hand pieces at the rail kept by the V2.3 "still not-a-ball is kept after 1 s" rule (nb_keep at the rails, k 2-5).
- User ideas (Oct 15): drop the rings in both drills if they are not needed ("put the 1 ball and the cue ball on the
  table, let them come to rest"); maybe a reset gesture (move the cue ball back and forth); target = the lowest-numbered
  ball actually on the table; a ball made 3 shots ago can't be back on the table (smarter understanding of the rack);
  the top label should say "shoot the lowest ball next" from what is on the table.
- Rings, what they were for: (1) the one spot that is surely the called ball (hands/ghosts not learned), (2) looks from
  two parts of the table (near/far light), away from cushions and pockets, (3) a known pocket/shot so made/miss could be
  judged. Now: only one object ball is on the table, the recognizer and hand filter are better, and paths show which
  pocket it went in, so rings can go; variety by prompts ("now the far half").

## V2.3.2 (built Oct 15 evening) — no rings, shots not missed, lowest ball on the table
- Shot start: findWhite(…, skip) looks past white things off the cloth or inside a person (dbg not_cue now has `next`:
  what it found instead). Arming on the cue ball alone being still for 2 looks (cueReady; dbg arm_quick), not only on
  the whole table settled. Drill only: cue ball lost at once mid-table (<0.8 s, <25", not near a pocket, no strike
  heard) = picked up by hand (dbg hand_lift), not a shot.
- Learn the balls, no rings: "put the N and the cue ball on the table" (shot 2 suggests the far half, shot 3 the near
  half); "shoot the N into any pocket". drillLabel: whitest ball = cue ball, best idCost fit to N = drill ball (bonus
  for still / near where it was), all else unnamed; re-applied after the position merge. Made = its path ended in a
  pocket (message names the pocket), or gone after the shot. drillUnseen: both balls seen settled, then the drill ball
  vanished in clear view (no hand near it) and stays gone 3 looks while the cue ball moved > 4" with no shot recorded
  -> counted as made ("the shot was not seen: Throw out if you missed"; dbg drill_unseen). drillPlan/drillCands kept
  (unused) for later Train modes.
- Show me the balls, no rings: "put the N on the near half, away from the cushions", then "now move it to the far
  half". The one new still ball in that half, > 3" from the cushions, nobody over the table, 3 holds. Balls shown
  earlier and still lying there are parked (ignored) until their spot is seen empty. Two new balls -> "only one new ball
  on the near half, please". The half is outlined on screen with the ball's number.
- Watch: S.gone used in Watch too (made numbers, not the 9 on a scratch; back on throw-out; cleared at a new rack).
  Colour naming never hands out a made number; the re-check can bring one back only with +1.0 cost (then 'ungone').
  "next: the N" = lowest named ball on the table (lowestUp); "(unsure)" when the named count != the clean count.
- Ghost keep: only a single round spot (k=1, fill >= 0.55), still 2.5 s (or 4 s with people around).
- Tests: t232quick (20 steps with balls left lying, two-new-balls prompt, same spot not emptied, cushion), t232drill
  (path make with pocket word, missed make counted, hand pickup and cue-still not counted, throw-out, real video shot:
  path into pocket 2 -> made), t232target (out-of-order 3 -> next 4, unnamed -> unsure, rack done, new rack clears).
- Independent review (12 findings) fixed: parked spots freed only after 2 clear empty looks, balls on the table when the
  setup starts are parked; drill made only if the ball is not still there (a path "pocket" alone is not enough); drill
  naming falls back (only one other ball = the drill ball; cue ball = whitest by recognizer or colour, else the colour
  naming's cue ball); a drill ball not picked out = made only if a ball went down; drillUnseen needs the spot really
  empty and no hand on it (the player may still be at the table); hand_lift only if no other ball moved; named balls
  just placed by the after-shot reading protected from the not-a-ball drop; Watch S.gone filled at once, never the 9,
  not from a doubtful result; 9 made without a scratch = rack over; count-based rack reset off in Watch; lowest-ball
  target only when names and the clean count agree (else unsure, count target kept); truthLook only on a settled
  table; early arming only when nothing else moved (and sets the settle time for the young-ball rule); drill state
  cleared per setup.
- Paths: a ball lost for good while last seen rolling straight at a pocket in reach = 'pocket' (via 'heading'); made
  shotocc2 stable ("Off the table: 4" every run).
- Tests: regression suite same results as V2.3.1; t232truth (t21truth with realistic names: after the 1 -> next 2,
  two down -> next 4); t23rec 100/99/89%.

## real9 — V2.3.2 at home (Oct 15, 21:07): Show me the balls, then Watch & Learn 51 shots / 4 racks (no drill)
- Pictures sharp; setup: recognizer knew 19/20 before being shown (the 9 stripe-down read as cue once).
- Rack 3 perfect: 9 shots, every target / first ball / ball down right. Lowest-ball target worked all session.
- App names vs recognizer agree 88%; checked by eye, the app was right on most disagreements (recognizer: 9 stripe
  hidden -> cue 36x, maroon 7 half hidden -> 4 13x). Real app errors:
  * shot 41: the cue tracker jumped to the red 3 after contact and followed it; the 5" cue-end rule then named the red 3
    "cue" and left the real cue ball unnamed. Next, the re-check (real cue not in the matching) turned the real 9
    (stripe down, reads as cue) into "cue" and the red 3 into 9, then 3. User had to tap the 9.
  * 1<->9 swapped for shots 26-27 (yellow solid vs yellow stripe); the re-check was blocked 3x at gain 0.37-0.41 (< 0.45)
    and only fixed it after 40 looks.
  * 3<->7 swap (red vs maroon) in rack 4, fixed by the re-check after one shot.
  * shot 37: the 8 stopped frozen to the cue ball, detection saw one ball, the count dropped -> "8 down" (false), the 8
    then could not be named (made numbers excluded) and the 1 made next shot was not counted (count unchanged).
  * shot 6: a ghost at the corner pocket was named 1 (conf 0.3 = eliminate(), which also resets S.gone when 9 numbers
    are visible) -> "3, 7, 1 down" when only 3 and 7 went.
- Fix ideas (V2.3.3): recognizer veto on the cue-end rules and a cue check after each shot (a ball read as clearly not
  the cue is never named cue; the unnamed ball that reads as cue takes it); re-check never hands out "cue" while an
  unnamed white ball is on the table, and M 0.45 -> 0.35; a ball whose path ended at rest touching another ball is not
  down (the count saw one blob); eliminate() off in Watch.

## Reviews (Oct 15, ChatGPT x2) and agreed direction
- Agreed next step V2.3.3 = testing foundation: per-shot video clips (frame-rate check), "this shot was wrong" button,
  path trails (diagnostic), remove eliminate() and the 5" cue-end rule, end-of-shot cue-ball check. Later (tested on
  clips): colour-aware cue tracking, touching balls, evidence kept per physical ball, confirmed/likely/unsure results
  with later evidence correcting earlier shots, hall + 2-hour test. Detector experiment only if measurements point there.
- User (Oct 15): balls frozen on the near and far rails were NOT seen until moved by hand. Detection misses leave no
  trace in the logs, so the error count from logs under-counted detection. Two suspected causes in the code (not yet
  proven): (1) the learned cushion-shadow mask (STILL) learns a rail ball the detector missed as "shadow" and only frees
  a cell when plain cloth shows there, i.e. after the ball is moved; (2) a blob touching the cushion edge counts as
  something coming in from outside (arm/person -> occluder), so a ball merged with the cushion shadow is not a ball.
  Plan: find these cases in saved pictures (real8/real9), confirm the cause, fix (check rail spots with the recognizer
  before masking or calling them occluders), add to V2.3.3.
- Confirmed in real9 pictures (rack 3 start, shots 26-27): the blue 2 sitting by the far cushion just right of the far
  side pocket was never detected (no spot in 3 pictures); the maroon 7 near the far cushion was detected ~1.5" off.
  Suspect the far-pocket-hole exclusion zone (pk.r + 2.5" around far pockets) and/or the learned cushion mask. The
  6-on-the-near-rail case the user remembers was not found in racks 3-4 of real9 (may be another session).
- User is not confident the table geometry overlay matches the real table. Proposal: a one-time geometry check —
  balls on known spots (frozen to the rails at given diamonds, foot/head spot), save debug, compare app positions to
  the true ones in inches. Turns "not confident" into numbers; decides whether lens distortion / outline fit need work.

## V2.3.3 (built Oct 15, late) — testing foundation + rail balls + geometry check
- Rail / pocket balls (cause found in real9 pictures, both confirmed offline):
  - The learned cushion-shadow mask (STILL) had grown to ~890 sq in and covered a blue ball by the far rail. New:
    `still_bad` — a mask larger than a 2.5"-wide band around the whole cushion is thrown away and relearned.
  - `maskRecheck` (every 15 scans, table clear): detection is run once without the mask; a spot the recognizer is sure
    is a ball (p ≥ 0.6, not "not-a-ball") clears the mask cells under the ball's picture (dbg `unmask`).
  - Rail balls merged with a piece of cushion shadow failed the fill/aspect test. New `discFit` fallback in vision.js:
    the best ball-sized disc inside the blob; kept if it is ≥ 72% covered and passes the pocket/edge checks (`fit: 1`).
  - Checked: real9 shots 26/27/41 now find the far-rail 7, 3 and 9; real3/5/6 recognition regression: more balls found
    (152/369/356 vs 150/366/357), no ghost spots named.
- Shot videos: one clip per shot (MediaRecorder, H.264 mp4 on iPhone, 1 Mbps, mic audio when listening), stored with
  the pictures as shotNNN.mp4 and in the debug zip. Recording starts when the cue ball is ready; while nobody shoots a
  fresh recording starts every 12 s and the old one is dropped 3 s later, so each clip has ≥ 3 s before the shot (~1.5 MB
  per shot). labels.json: clip {file, secs, shotAt (seconds into the clip the shot starts), kb}. Only the current and
  previous session keep clips. Turned off for the session if the camera frame rate drops > 20% while recording
  (dbg `clip_off`). Menu: "Video of every shot" On/Off. Purpose: replay real shots through new versions (real-video
  regression), as the reviews asked.
- "⚑ This shot was wrong" button above "Throw out last shot": marks the shot (shots[].flag, labels flag, dbg `flag`).
  Flagged shots + their clips are the first test cases.
- Ball path dots: a dot for every frame each ball was seen, in the ball's colour; ring = counted into a pocket, "?" =
  path lost/unsure. Live during the shot, kept until the next. Also saved as shotNNN-paths.jpg (after picture stays
  clean). Menu: "Ball path dots".
- Removed: eliminate() in Watch (named a pocket shadow the 1, real9 shot 6); the 5" cue-end rule (named the red 3 the
  cue ball, real9 shot 41). The 1.5" cue-end rule now applies in all modes, unless the recognizer is sure it is a
  coloured ball.
- cueCheck after every shot: if the ball named the cue ball is confidently a coloured ball, the cue name moves to the
  whitest ball (rec cue ≥ 0.8) and the rest are named again (dbg `cue_check`).
- Geometry check (More → Geometry check): balls frozen to the cushions at the real diamonds — 1-4 near rail and 5-8 far
  rail at diamonds 1, 3, 5, 7 from the screen-left end, the 9 at the middle diamond of the left short rail. Measure
  reports average error along the rail and off the rail per rail, the max, and per ball (dbg `geo`, picture geo-*.jpg
  in the zip). No shots are armed while it is open. Reading it: a whole rail off in the same direction = outline/lens
  fit; scattered errors = detection.
- Still deferred until clips exist: colour-aware cue tracking, touching balls, re-check thresholds, confirmed/likely/
  unsure results, hall test, 2-hour test.
- Independent review before delivery (13 findings, all fixed): mask re-check counter never started (NaN), debug zip
  now holds at most 80 MB of videos (flagged shots first, then newest; the log says which were left out), 250 MB of
  videos per session and none once the app's storage is 85% full, discFit size guard was inside a comment (+ cost cap),
  flag tapped while a shot was being saved could be lost, false shot starts left the clip's shot time set, cueCheck no
  longer removes the cue name when no white ball can take it (no made-up scratch), recorder stopped on camera restart
  and errors handled (overlap turned off if two recordings at once fail on the phone), flag button disabled while the
  next shot is read, path dots drawn with the camera of that moment, clips only start once the normal frame rate is
  known, old path dots cleared on a new session, geometry check cannot reopen the camera after leaving.
- Known flake (pre-existing, also in V2.3.2): the camera-moved test (s9) briefly shows a ghost spot by the corner
  pocket until the table is found again.

## Repo in order (Oct 16, step 1 of the engineering assessment) — no change to the app
- The source now lives in the repo: src/ (app.js, vision.js, core.js, template.html, recog.json) + build.py (relative
  paths; `--check` proves index.html is exactly what src/ builds). index.html is a built file from now on.
- Tests in the repo (the old workspace tests were lost): tests/unit.test.js (homography, camera model, table sizes,
  Hungarian matching, colour conversion), tests/smoke.test.js (built app loads in headless Chromium with a fake camera,
  right version shown, Watch / Show me the balls / Learn the balls each start without an error). `npm test`.
- Real-session data: data/sessions.csv lists all 13 debug zips (real1-real9); the pictures stay out of this public repo,
  in the project's shared files (chalkline-data/sessions/). library/manifest.csv = the hand-checked labels (real1-6).
- tools/replay-pictures.js: the V2.3.3 ball finder + recognizer over every saved picture, scored against the labels with
  failure types kept apart. Baseline (finder alone, without the live filters: shadow mask, not-a-ball drop, tracking):
  balls found again real1 88%, real2 95%, real3 91%, real4 87%, real5 96%, real6 (hall) 94%; recognizer names found balls
  right 98-100% at home (in-sample: it was trained on these sessions) and 89% at the hall. real7-real9 have no labels yet.
  Outline check (saved spots vs the logged outline): median 2-11 px; real1 (digital zoom) and real4 highest.
- Still missing: shot-level tests (need the V2.3.3 shot clips), labels for real7-real9, the old synthetic-video tests.

## V3.0 (built Oct 27, after "build it") — new ball finder and reader, names ride with the balls
V2.3.3 stays at `/v2/`, byte for byte as it was.
- Check page first (`/check/`), on the owner's iPhone 16 Pro Max (Safari 26.6): finder on the GPU (WebGPU) 77 ms at
  960x544, 155 ms at 1280x736, 446 ms at 1920x1088; on the CPU about 480 ms at 1280 (too slow). Reader 35-46 ms for 10
  balls on the CPU. All 10 spread-out balls found and read "sure" at every size. Two lessons: Safari kept an old copy of
  one script and mixed it with a new page (every look failed) -> scripts carry version queries and the page checks
  DET.VERSION; switching models in and out (the speed test) made Safari close the page -> the app loads one model once.
- Owner's photo, balls bunched at one end, low side view: the finder missed the balls hidden behind others (960: 6 of
  10). New: the finder looks only at the table strip, in one of 7 strip-shaped graphs (about 550 thousand pixels each,
  one shared 10 MB weights file, `models/v3`), enlarged at most until near balls are about 23 px across. On that photo
  8 of 10; on the 14 verified frames still 110 of 110.
- Tracker (`src/track.js`) replaces the V2 naming rules. Each ball is followed in table inches; reads add up as votes
  only while it rests (next to another ball only a sure read counts); names are shared out over all balls at once, each
  number once, with "no number" allowed instead of a poor fit; a tap pins a name; hidden balls keep spot and name;
  pocketed only when lost rolling at a pocket and gone 1 s; the first ball to roll after a still table is the cue ball
  (and gets cue votes); several starting together = hands or racking; a rolling ball is expected to stop at the contact
  point of a resting ball in its path, and the struck ball may leave along the line of centres (without that the cue
  ball took the struck ball's name); new spots count as balls only after resting about a second and looking like one.
  Measle cue (white, red dots) vs the 9 (yellow stripe): on a close cue/9 call the yellow share of the ball decides.
- Screen: works upright or sideways (no rotate message); teal ring + number = sure, amber "?" = unsure, white "?" =
  not named yet, dashed = hidden. Tap a ball: pick its number, "Not a ball" or "It went in". New rack button. A short
  summary after each shot. Save debug: log (every look's spots, tracker events, shots), before/after pictures per shot,
  and every tapped ball as a labelled picture (for retraining the reader on the owner's balls).
- Tests: tracker 16 made-up cases (shot, pocket, scratch, hidden, arm, hands, tap, measle, bunch, break, ball in hand);
  V3 end to end on a fake camera made from the owner's photo, sideways and upright (table found, 7-9 balls, 4-5 named,
  a tap sticks, debug zip). Not tested here: real shots on real video, WebGPU (headless runs the CPU engine).
- Not in V3.0: the lag drill (V3.1), head-rail choice, 8-ball, camera-bump recovery beyond "Find the table again".

## V3.0.1 (Oct 27, late) — no more crashes on the graphics chip, outline follows a swaying phone
- Owner's V3.0 run (mirroring off): Safari closed the page about 10 s after the ball finder started on the graphics chip
  (WebGPU); the check page did the same, while the processor ran 188 looks without trouble. Now the finder runs on the
  processor by default, on several cores: `sw.js` (a service worker) adds the two headers Safari needs before a page may
  use threads, which GitHub Pages cannot send; the first visit reloads once. 3 threads here: about 350 ms a look against
  750 ms on one (the phone's own number is not measured yet). The graphics chip stays a choice on the home screen, and
  if the app died there last time it switches back to the processor by itself.
- Crash notes after every look (step, looks, engine, cores); the home screen says how the last session ended, and Save
  debug carries it. The web font is gone (an isolated page blocks it).
- Steady: the owner's tripod sways and the outline stayed put, so resting balls would look like they move. Now a small
  picture of each corner and side pocket is kept when the table is accepted and found again on every look (within
  about 30 px); the outline moves with them, measured against the accepted outline so errors do not add up. On a fake
  camera rocking 10 px: the outline followed, every ball stayed at rest, no hands, no shots.

## V3.0.2 (Oct 27) — shots end when the balls stop
- Owner's V3.0.1 session (no crashes; 207 ms a look on 3 cores; balls named right): "after a shot it never stops
  rolling". Shots ended 11-40 s late, and several real shots were merged into one. Two causes, both in `src/track.js`,
  found by replaying the session's logged looks (`tools/v3/replay.js`):
  1. A ball rests again once it has stayed within 0.8 in for 0.3 s, but the check only used looks inside the last
     0.3 s; at the phone's 0.23 s between looks that was never two looks, so a stopped ball stayed "rolling" until it
     happened to be hidden. Now it uses as many looks as it takes to cover 0.3 s.
  2. A ball lost at a pocket and seen again logged "back" but stayed "may have gone in": the shot could not end, and
     later the ball was called pocketed while it sat there (the "cue in" on the owner's screenshot). Now it is rolling.
- Replayed: 7 shots instead of 4, each over in 3.5-7 s; no ball called in after it was seen again. The session's looks
  are kept as a test (`tests/fixtures/v3/session-20261026-2312.json`), plus made-up shots at 0.23 s between looks.
- Brainstorm, not built (owner): table size stays the standard 78 x 39 in for a 7 ft table unless evidence shows the
  owner's tape measurement (79.06 x 39.03) is better. Table fit from cushion edges + diamonds (+ balls when present),
  to replace corner finding; not started.

## V3.0.3 (Oct 27) — balls going in, the cue ball kept, the 9 on the rail
- Owner's V3.0.2 session (Oct 26, 23:50; 18 shots, 9-ball): "missed pocketing a couple times, called a ball in that
  wasn't, kept losing the cue ball, the 9 on the rail lost its name and couldn't be tapped, a one-rail miss wasn't seen
  as a shot". All six matched the log. Truth for every shot was taken from the shot pictures
  (`tests/fixtures/v3/session-20261026-2350.json`, scored by `tools/v3/score.js`). Live V3.0.2: 11 of 18 right,
  5 balls missed, 5 called in that were not. Replayed with V3.0.3: 17 of 18 right, 1 missed, none called in wrongly.
- Changes, all in `src/track.js` except the last:
  1. The cloth edge allows the outline to be an inch off (the 9 frozen to the near rail came out 0.3 in from it and was
     dropped as "off the cloth" every other look).
  2. Fast balls: a ball lost while rolling may be found again up to its speed times the time since; a new spot that is
     rolling fast, right after a ball went hidden, is that ball (the cue ball went 24 in in one look on the one-rail
     miss, so no shot started). When two balls went hidden at once, white or not tells which.
  3. A ball lost rolling toward a pocket is looked for along its path (up to half a second on, not through a cushion).
     A ball resting by a pocket that vanishes the look another ball reaches it was knocked in.
  4. In a collision the cue ball's track took the struck ball's spot (the 4 going in became "cue in"). Contacts are now
     found after the fact along each rolling ball's path, and both balls' speeds are measured from the contact; a
     speed that turned round (off a cushion) is taken as it is, not smoothed. White or not is part of every match.
  5. Something not yet confirmed as a ball that vanishes at a pocket mid-shot is noted; 2.5 s after the shot, if as
     many numbers are missing from the table as such entries were noted, those numbers went in.
  6. `src/v3/app.js`: the number reader runs every look (10 ms against 220 for the finder), so the cue ball can be told
     from the rest during a shot too. Shot looks are logged as "S" (they read "s", like still).
- Left: the 8 at 7:37, sent out of sight right behind the cue ball and never seen again.

## V3.0.4 (Oct 28) — ghosts clear themselves, shots seen in one look, balls lying in a pocket, new labels
- Owner's V3.0.3 session (Oct 27, 22:27; 3 racks): first naming very good; a pocketed ball (the 5) left a dashed ghost
  that never cleared; the ring lags a rolling ball. Truth for all 41 real shots taken from the pictures (rack 2 began
  with the balls rolled out by hand, which live V3.0.3 counted as a shot). Live: 28 of 41 right, 13 balls in missed,
  1 false scratch. Replayed with V3.0.4: 40 of 41 right, none called in wrongly; the Oct 26 23:50 session stays 17 of 18.
- Most misses were one thing: the phone looks about 4 times a second, so a hard-hit ball is gone before the next look,
  never seen moving, and was kept "hidden" for good (the ghost). Now (`src/track.js`, clearGone) a hidden ball whose spot
  shows bare cloth on 3 looks in a row, 1.5 s after it vanished, is not there: gone during a shot (or hidden when one
  started), it went in that shot, said by the app as "Shot n: the 8 went in too"; gone with no shot, it was taken off by
  hand and is cleared. The cloth check is `bareCloth` (`src/v3/cloth.js`): the pixels within 0.7 ball radii of the spot,
  against the cloth colour taken when the table is accepted (the V2 cloth test, which keeps the navy 2 apart from the
  blue felt). An arm, the player or a ball over the spot is not cloth, so a ball behind the player keeps its spot.
- A shot can happen in one look: the cue ball went 20 in into the 5 and stopped, so it was never "rolling" and no shot
  started. A new spot that turns up at once, at least 3 in off and 20 in/s from where a ball just vanished, and reads
  like that ball (its number, or white or not for an unnamed one), is that ball: a shot starts, dated back.
- A ball sitting in the jaws that vanishes when the shot reaches it went in (the 1, shot 3).
- Balls lying in a far pocket: the camera sees into the far pockets, and a ball in one maps onto the table 4 to 10 in in
  front of it (the 7 "came back out" at 76, 33; the same phantom was in the Oct 26 session). `pocketBags` gives that line
  for each pocket from the camera; a spot on it scoring under 0.6 (those score 0.3 to 0.5, balls on the cloth 0.7 to 0.9)
  is a ball in that pocket: not tracked, and a ball lost at that pocket is in at once. It also names the pocket for a ball
  found in late.
- White or not counts the 9 as white (the owner's 9 is a white ball with a yellow band, and the resting cue ball was read
  "9, sure" now and then). A rolling ball refuses a spot read surely as the other colour, even close by (the cue ball drew
  back off the 2 and the 2's track took it: "cue in"); a resting ball on its own spot does not (one misread pushed the 9
  off the rail).
- Drawing (`src/v3/app.js`): rings 1 px outside the ball with a 1.3 px line (were 3 px out, 2.2 px); 11 px labels; Q for
  the cue ball; labels on rolling balls too, so a lost name shows where it happens; a rolling ball's ring is drawn where
  it should be by now (last spot plus speed times the time since, at most 0.3 s, not past a cushion). Labels that would
  cover another label or ball try the other sides; with no side free they go further out on a leader line; each keeps
  its side while it stays free.
- Tools: `tools/v3/replay.js` applies the player's taps and New rack presses; `tools/v3/photos.js` runs the cloth check on a
  session's shot pictures and stores per-picture cloth maps in the fixture (1 in grid), so the tests replay with it.
  Sessions live on the `sessions` branch.
- Left: the 2 at 8:49 (its check needs a frame between the pictures; the live app has it).

## V3.0.5 (Oct 28) — the cue ball named again after a scratch, colour trails
- Owner's V3.0.4 session (Oct 27, 23:38; 2 racks, phone sideways after two tries upright with the corners tapped): 31
  real shots; live V3.0.4 got 30 right (one false "3 in" on a scratch shot), and the "went in too" messages were right
  all 9 times. Not right: two "shots" while rack 2 was rolled out by hand (one called a scratch), and after every scratch
  the cue ball put back stayed "?" until tapped.
- Cue ball after a scratch: a pocketed ball's number is kept out of the naming for the rest of the rack, and the cue ball
  was treated the same. It always comes back, so its number now stays free: the reader names the ball put back (it reads
  the cue ball "sure" almost always), and a ball first to move in a shot still gets a vote for the cue ball. No rule makes
  an unknown ball the cue ball: a different ball put back is named by what it reads as. Replayed without the taps: the
  cue ball is named again 8 to 11 s after each scratch.
- The false "3 in": in the scratch shot the 3 was knocked from the far rail to the near one, unseen; its old spot showed
  bare cloth and it was called in, while the real 3 sat there as a "?". Now the ghost rule waits (up to 8 s after the
  shot) while a ball not yet named, seen since the vanished one went, could be it (same white or not); the reader then
  names it and the ghost goes quietly.
- Trails (owner): each rolling ball leaves a tail of where the tracker had it over the last 0.7 s, fading out, so it is
  longer the faster the ball goes and jagged if the tracking jumps. Its colour is read from the ball itself while it rests
  (median of its coloured pixels; mostly white, mostly black, or banded white and a colour), not from a fixed chart: ball
  sets differ (a pink 4, a teal 2, a black 9 with a yellow band). A banded ball's tail alternates white and its colour.
- Tried and dropped: counting new balls rolling about as "hands" (to stop the rack roll-out being taken for shots); it
  also lost real shots. A hand moving a ball needs the player work (the not-cloth mask next to the ball) to tell apart.
- The debug header keeps the picture size the table was accepted with (this session's phone turned upright again at the end).

## V3.0.6 (Oct 29) — hard-hit balls followed by their reads, paths that stay
- Owner's V3.0.5 session (Oct 28, 17:10; 8-ball runout practice with balls 1-9, 2 racks, phone sideways): 25 real shots;
  live V3.0.5 got 22 right. Rack 1 (played softly) all right. Rack 2 (played hard) wrong 3 times: a bank shot with the 8
  called "8 in, scratch" (nothing went in), the 8 into the bottom-right corner missed (the owner marked it), a hard shot at
  the 9 called "9 in, scratch" (nothing went in). Also counted as shots: two while rack 1 was set out by hand, the rack 2
  roll-out, and a tap on the screen to rename the 9.
- What the looks show: on the hard shots the finder saw every ball on almost every look, and the reader was sure of most
  of them even blurred (3,124 of 3,215 spots during shots read "sure"). The tracker lost them: the cue ball went 66 in in
  under 0.3 s, unseen behind the cue when struck, and sat on the 8's spot by the next look (the 8's track took it, so the
  shot was followed as "the 8 struck"); balls coming back off a cushion were looked for past it.
- Now: a sure read of a ball's own number ties a spot to it, and a sure read of another number (not one the reader mixes
  up with it: the 9 with the cue ball or the 1) rules the spot out for a rolling ball. A rolling ball read as itself may be
  well past the prediction (up to 150 in/s since its last look). A rolling spot read twice, sure, as the number of a lost
  ball (hidden, lost at a pocket, or called in during this shot) is that ball, however long ago and far off it was lost;
  a ball called in that is found rolling on is taken back out. The cue ball struck hard is found past the launch gate by
  its read; a white sure read on the spot of a ball that is not white, while the cue ball is out of sight, is not that
  ball. The prediction comes back off a cushion (unless the ball is heading into a pocket).
- The cue ball named on the table while a shot is still on did not go in: a "cue ball in" call is taken back, and it is
  the shot's cue ball (two false scratches in the Oct 27 22:27 session, hidden until the scorer counted a scratch as the
  cue ball made).
- A finger on the screen shakes the phone: no shot starts for 0.7 s after a touch. (Tried first: taking off a shift that
  all resting balls share. Real shots also move the balls a little together, and it lost two of them.)
- A ball's name is "sure" also when it fits well among the numbers still free (the 9 by the far rail, read "1" now and
  then, after the 1 went in).
- Trails (owner): a thin line in the ball's colour for its whole path in the shot, kept after the shot ends (and for the
  balls that went in) until the next shot starts; over it a tail behind a rolling ball, solid and wide at the ball,
  narrowing and fading behind it, its length set by the ball's speed (0.45 s of travel, at most 40 in) and shrinking away
  as it stops. Unnamed balls get them too. Each shot's paths go into the debug file (shots[].paths, table inches).
- Replays: Oct 28 17:10 25 of 25 (live 22), Oct 27 23:38 31 of 31, Oct 27 22:27 40 of 41, Oct 26 23:50 17 of 18; nothing
  called in that was not, and no false scratch (the scorer now counts a scratch as the cue ball made).
- Still open: setting balls out by hand and rolling out a rack count as shots (needs the player work: a hand next to a
  moving ball), and which pocket a ball knocked in unseen went into.

## V3.0.7 (Oct 29) — paths start where the ball was
- Owner's V3.0.6 session (Oct 28, 18:08; one rack of 8-ball practice, phone sideways): all 14 real shots right live,
  including a scratch, two "went in too" and a ball left in the jaws then knocked in. Counted as shots: the owner moving
  balls with the cue while setting up, and the cue laid on the table before the phone was turned. Replayed: 14 of 14.
- Owner on the paths: keep them. Each path now starts at the centre of the spot the ball rested on when the shot started
  (from the shot's "before", which now keeps each ball's resting spot as rx, ry), even when its first moments were not
  seen, with a dot about half an inch across there. Later (owner, not now): a setting for how long the paths stay.

## V3.0.8 (Oct 29) — End session, corners set on a still picture, table-finding pictures in the debug file
- Owner: Save debug was pressed with the camera still watching, and turning the phone upright to do it counted as a shot
  and sent the app looking for the table. Now the bar has New rack and End session. End session turns the camera off and
  shows the session: minutes, table size, racks, shots, balls in, shots with nothing in, scratches, and every shot's line,
  with Start again, Save debug and Home. Save debug is also in the Menu, for a mid-session save.
- Owner: upright, the automatic outline kept landing on the outer edge of the rails (where the cushion top meets the
  brown trim with the diamonds); tapping the pockets by hand was not exact, and pressing the screen moved the phone. Now
  "Tap the corners" freezes the picture: a finger puts a corner down and slides it, with a 4x magnifier above the finger;
  any corner can be dragged again; "Use these corners" when all four look right. Only small buttons show, in the bottom
  corner (a card in the middle covered the near pockets). Once accepted, the steady check takes its reference from that
  still picture, so if the phone moved while being touched, the outline moves with it.
- The debug file now has the picture each table search ran on (find-NN.jpg) and the one the corners were set on
  (manual-NN.jpg), and the outline found, so a wrong outline can be looked at and the table finder fixed. (The finder
  itself is shared with V2.3.3 and stays unchanged until there are upright pictures to work from.)

## V3.0.9 (Oct 29) — the tracking test on the home screen
- Owner: show how far the testing is toward the targets for moving on to V3.1, in the app. The home screen has a
  "Tracking test" card: racks (of 10), sessions (of 3), camera spots (of 2), shots found (98%), what went in called right
  (95%), false "in" and false scratches (at most 1 per 50 shots each), every ball named right after a shot (97%), each
  with a bar and a tick once met, and the shots counted that were not shots. The numbers are the live results of reviewed
  sessions, from V3.0.6 on, kept in data/v3-gate.json and updated by Claude after each review (the app cannot know the
  truth itself). First entry: Oct 28 18:08, 1 rack, 14 of 14 on everything (names checked on the after pictures).

## V3.0.10 (Oct 30) — the table the right way round from the end rail, the right lens, the 9 hit hard
- Owner's V3.0.9 session (Oct 29, 17:02; 9-ball practice, 5 racks): rack 1 with the phone upright at the end rail and the
  corners set by hand ("tracking about 1.5 diamonds off"), then 4 racks sideways at the side rail, 51 real shots.
- The 1.5 diamonds: the app had the table turned a quarter. Which way a table runs was decided by looking for the dark
  side pockets at the middle of each pair of rails (pickRot); from the end, the dark floor and brown rails beyond the short
  rails won. With the long and short rails swapped, the camera fitted to the outline does not fit it (the rings were drawn
  up to 160 px from where the finder saw the balls) and every table position came out stretched. The finder had found the
  balls in the right places all along. Now the way the table runs comes from the outline's shape: through the lens, the
  four corners give the rectangle's true length to width, and a table is 2 to 1 (rotByShape, src/v3/cloth.js; pickRot is
  kept for an outline that cannot tell). Every upright outline so far, the Oct 27 23:38 one too, had been turned.
- The lens: the same check says the V2 value 0.86 (focal length over the long picture side) is wrong for the owner's
  phone in video. Four sideways sessions come out exactly 2 to 1 at 0.71-0.72 (1.7 to 1 at 0.86), which also fits a
  24 mm-equivalent main camera with the video stabilisation crop. LENS is now 0.72 and goes into the debug header (the
  tools use the header's value, 0.86 for older logs).
- An outline that is not about 2 to 1 (under 1.6 or over 2.5) gets a warning on the check card: it may be on the outer
  edge of the rails (the owner's upright problem); set the corners by hand.
- The debug file's table-finding pictures were thrown away first when the shot pictures were trimmed (they sort first):
  now only shot pictures are trimmed.
- The 9 hit hard (owner: the line drawn to the 9, then the cue ball takes another name): live, three times the 9 went in
  and a scratch was called, and once the names swapped. The cue ball, struck hard, sits on the 9's spot by the next look
  and reads "cue ball"; the 9's track took that spot (the cue ball and the 9 are a pair the reader mixes up, so its read
  did not count against it), and the cue ball's track then took the 9 rolling away. Now a sure read of another number
  costs a match for every pair (readCost 2.5 in): a ball alone on its spot still takes it, a ball arriving there read as
  itself wins it. And when the cue ball has just left its resting spot and one spot alone reads as the cue ball, no other
  resting ball, the 9 included, may take that spot, in either matching pass (two spots read as the cue ball, as in a
  shaken look on Oct 27, is not clear enough). Replay of the 4 sideways racks: 48 of 51 (live 46), no false scratch; the
  other sessions unchanged.
- Still missed in replay: a 7 rolling into the far corner before the shot was seen (left hidden by the far cushion,
  where the bare-cloth check cannot tell), and a 5 that vanished just after its shot was over.
- Tracking test: the 4 sideways racks added (live: 51 found, 46 called right, 3 false scratches, names right after 47);
  the upright rack is not counted (the turned table).

## V3.0.11 (Oct 30) — the end rail works; the reader's shares in the log
- Owner's V3.0.10 session (Oct 29, 17:50; 9-ball practice): 3 racks with the phone upright at the end rail (corners set
  by hand; the shape check turned the table the right way round, twice), then 1 rack sideways. The first session from a
  second camera spot. Live, end rail: 44 real shots, 42 right; the 8 stopped in a far corner's jaws was called in, and
  dropped on the next shot (counted as missed there). Names right after 40 (the 9 by the near left corner left unnamed
  twice; the 8 in the jaws; the 9 hidden once). Side: 11 shots, 10 right; the 9 in the far corner read as the cue ball
  (the real cue ball unnamed), and the last 9 not called (the session ended 5 s later). All shot and table pictures
  were in the file (V3.0.10's trimming fix).
- The replay of the end-rail racks scores 37 of 44 (live 42): the log kept only each read's number and sure / unsure,
  and a replay makes every sure read 90%, which turns the votes harder than the phone's own reads. From V3.0.11 each
  look also keeps the reader's share for its number and its second choice and share; the replay uses them when there.
- Tracking test: the end rail is the second camera spot; one session can now hold racks from two spots (counted once).
  Now 9 racks, 3 sessions, 2 spots, 120 shots: found 100%, called right 93% (need 95), 1 false "in", 3 false scratches
  (1.25 per 50, need at most 1), names 92.5% (need 97).

## V3.0.12 (Oct 31) — room for 100 shots' pictures
- Owner's V3.0.11 session (Oct 30, 17:46; 4 racks sideways, 71 shots): racks 1-2 normal play, racks 3-4 drills (the
  balls on one line across the table; then a drill shot with the 8 instead of the cue ball). The debug file kept only
  the latest 120 shot pictures, so shots 1-11 had none. Now 200 (100 shots), at JPEG quality 0.7 (was 0.8).
- Counted for the tracking test: shots 12-34, 23 shots, live 22 right (one false scratch: the cue ball had just
  stopped and was not yet confirmed as a ball when the shot ended), names right after 20. Not counted: shots 1-11
  (no pictures) and the drills. In the line drill the 8, 6, 1, 2 and 5 were called right, the 4 missed, and with the
  last balls re-set by hand by the far rail the 9 next to the cue ball went in as "cue ball, scratch". With the 8 used
  as the cue ball the app takes the 8 for the struck ball and calls its pots scratches: a drill mode will need to be
  told which ball is the cue ball.
- Tracking test now: 11 racks, 4 sessions, 2 spots, 143 shots; called right 93.7%; false "in" 1; false scratches 1.4 per
  50 (3 of the 4 from V3.0.9, fixed in V3.0.10); names right 91.6%.

## V3.0.13 (Oct 31) — no hidden ball on top of a ball that is there
- Oct 30, 18:21: the 5 went in unseen and stayed a hidden 5 on the 9 (0.6-0.7 in apart) for five shots, the 9 shown
  as the 5 until the owner tapped Not a ball. The cloth check could not clear it: the spot showed the 9, never bare
  cloth. Two balls are never closer than 2.25 in, so a hidden ball under 1.5 in (sitOn) from a ball sitting there now
  counts as bare cloth and goes through the usual ghost rule (in, if it went out of sight in a shot).
- Only when it is plain (sitsOn in src/track.js): the rack has been broken since New rack (in a rack two touching balls
  can be found as one spot between them, about 1.1 in from each); the ball there has rested and been seen for 2 s
  (sitHold), so never during a shot or on a blurred look; it reads sure as another number; no other ball within 3 in of
  it; and the hidden ball was not already on a resting ball when it went out of sight (onBall).
- That last check comes from replaying all recorded sessions: on Oct 26 (23:50) the 8 rolled behind the 3, two spots
  on the 3 pulled the 8's track onto it, and without the check the rule would have called the 8 in (it was still on
  the table). The only other place it acts is Oct 29 17:50, shot 10: the 4 went in and the cue ball stopped 1.2 in from
  its spot; it is now called in 13 s sooner (was right already). No other result changes. The 18:21 case itself
  does not happen in the replay (the replay pockets the 5 in shot 7), so it has a made-up test of its own.

## V3.0.14 (Oct 31) — the rest of the list agreed after the 18:21 review
- New rack and End session settle the last shot's calls first (finish in src/track.js). A shot still on ends; a ball
  lost at a pocket, or one in play (rolling or knocked) that went out of sight during the last shot, is in; a pocket
  entry waiting to be counted is counted now; and a number on the table before the last shot that no ball holds now
  went in, when the count of balls agrees (one fewer for each, no unnamed ball on the table). If the vanished ball had
  no name, the numbers not yet in are used when there are exactly as many as vanished. Replays: the last 9 of rack 1
  on Oct 29 17:50 (unnamed) and Oct 30 18:21 are now called; nothing else changes, no false "in" (every New rack in
  the recordings checked). Balls picked up after the shot to rack are not counted (lost after it ended), and nothing
  is counted once a ball has been taken off or moved by hand since the shot (cleared, hands).
- A cue ball called in waits for something just seen that is not yet a named ball, white or not known, appearing since
  the cue ball was lost: up to 2 s more (cueWait) before the shot ends, so it can be named the cue ball and take the
  call back (Oct 30, 17:46, shot 28: found 10 in from the side pocket a third of a second after the shot ended,
  a false scratch). Replay of 17:46: that scratch gone, the others unchanged; no other session changes.
- Ball in hand and hand moves: not a rule yet. On a real shot the cue lies behind the ball too, and no recording has
  the picture around the ball as a shot starts, so a rule could not be checked. The debug file now logs it with each
  shot start (around: 12 spots 3.5 in from where the cue ball rested, the first straight ahead of its roll, 1 = not
  cloth; v0: its speed), to set the rule from the next sessions.
- The tracking card has the goals revised with the owner: only the version being measured counts (data/v3-gate.json
  "measuring", now V3.0.14), its latest 10 racks; called right 95%; false "in" and false scratches at most 1 per 50
  shots; the cue ball and the lowest ball named right after 97% of shots; 98% of balls named right; a wrong number on
  at most 1 in 200 balls; at most 1 shot per rack counted that was not a shot. Earlier versions show as one line.
- Replays apply End session from the log too (tools/v3/replay.js).
- Owner's V3.0.14 session (Oct 30, 23:17; 3 racks of 9-ball sideways, balls set out by hand, no break), the first on
  the tracking card: live all 35 real shots right, no false "in" or scratch; the 9 of rack 2 called at New rack (finish).
  Names right after 34 of 35 shots (after rack 2's last 9 the cue ball showed ? with its own hidden copy on it); 181 of
  182 balls named right, no wrong number. A 5 gone into the top-right corner left a hidden 5 on the top rail for three
  shots (the cloth check on a spot against the cushion never reads bare). Four hand moves counted as shots: the cue ball
  rolled into place (8.7 in/s), rack 2 set out (two), rack 3 spread with the cue shaft. In three of them the first ball
  to move was not the cue ball, which sat named and still elsewhere: a rule on that (cueFirst, not built: with the cue
  ball seen on that look and not touching the mover) takes 8 of the 23 such moves off across all sessions and loses 2
  real shots, both nothing-made shots in the Oct 27 22:27 (V3.0.3) replay.

## V3.0.15 (Oct 31) — the rack done by itself; a shot starts with the cue ball (owner's ideas)
- Rack complete: once a rack has had a shot and only the cue ball is left (named, not hidden), still for 2 s (rackHold),
  the tracker does New rack itself (rack_done) and the app says "Rack complete" (for testing; later quietly). In the
  replays it comes 4 to 8 s before every New rack the owner pressed, or at the end of a session, never mid-rack; a
  hidden or unnamed ball still on the table holds it back (twice), and the button stays (a 9 made early). A press of
  New rack with no shot since is logged dup and not counted as a rack; the summary counts racks with a shot.
- A shot starts with the cue ball (cueFirst): a first mover that is not the cue ball, with the cue ball named and still
  elsewhere, seen that very look and not touching the mover's spot (a frozen cue ball moves the object ball first:
  Oct 30 23:17 shot 12), is a hand. The app says "Not counted: hand move".
- Till a rack's first real shot (after New rack, and at the start), the cue ball rolling on its own with nothing else
  changed (no other ball moved, went out of sight, was dropped or replaced, or newly turned up) and nothing in is the
  cue ball put in place by hand (setupDrop, not_shot).
- All sessions replayed: shots counted that were not 23 -> 10; Oct 30 23:17 4 -> 0. Real shots lost: none from Oct 28
  on; 5 in the Oct 27 recordings (V3.0.3, V3.0.4), all with nothing in, where the old detections lost the struck balls
  so the cue ball looked alone or not first. Replays skip the app's own New rack (the tracker does it again).
- The tracking card measures V3.0.15 from now (Oct 30 23:17 moves to the earlier line).
- Owner's V3.0.15 session (Oct 31, 14:52; 5 racks of 9-ball, a new spot closer to the table, daylight): live 71 of 78
  real shots right; Rack complete came by itself after all 5 racks. The errors are mostly one pattern: a ball lost
  for a moment at a pocket mouth is "pocketed" after 1 s (pocketWait) and, when it is seen again right there (the 9
  stopped in the jaws, shot 48; the 9 stopped against the cue ball, shot 78), it comes back as a new unnamed ball,
  so it is called in a shot early and missed when it really goes. The false scratch (59) is the same thing for the
  cue ball: its old track went hidden, the ball was seen again 1.5 in away as a new track not yet confirmed (so not a
  "newcomer" holding the ghost rule), and the ghost was called in. Also a missed scratch (38) and an unknown ball
  called in with the 9 (35). Names right after 75 of 78 shots; 435 of 439 balls; no wrong number; one hand move
  counted. The log keeps the latest 4000 looks, which here cut rack 1's first 98 s.
- Owner's V3.0.15 session (Oct 31, 15:10; 4 racks, same spot): live 49 of 59 real shots right. Rack 1: the owner stood
  between camera and table for a shot; the cue ball and the 3 were never seen moving, only gone, so with no shot
  since they were cleared as taken off by hand and the 3 was never called. Rack 3: the 3 went in with a scratch while
  the owner blocked the view (33); its ghost kept the rack from finishing, so New rack never came and in rack 4 the
  app had 1, 2 and 4 to 9 as already in: the new balls stayed "??", their pots were called as unknown balls or missed,
  and the 9 at the end was called a scratch. Racks 1 to 3 otherwise all right; names right after 46 of 58 shots (all
  12 misses in rack 4); 238 of 288 balls. Three hand moves counted (rack 2 set out, the cue ball pushed into place,
  rack 4 set out).

## V3.1.0 (Oct 31) — the player and cue begin: the watcher, shot clips, the stroke test; the session kept on the phone
- Decided with the owner: stop patching V3.0 (9 racks on V3.0.15 reviewed) and start on the player and cue, which is
  what fixes unseen shots, hand moves and setup properly; the small upgrades below come in the same build.
- The watcher: every camera frame (requestVideoFrameCallback) at 320 px across, the table plus the space beside and
  above it (where the player and cue are). For now it only measures and records: the share of the table that is not
  cloth (hue more than 28 degrees off the cloth's, or grey) and the share of the picture that changed since the last
  frame, logged once a second with its frame rate and the finder's time ('watch' events), to learn whether the phone
  keeps up while the finder runs. It keeps the last 2 s of frames in memory.
- Clips: around each shot (2 s before it was seen to start, 2 s after) and each hand move (at most one every 4 s), the
  frames as small pictures (about 6 KB each) with an index (clips/<name>/index.json: file, ms, not-cloth, changed),
  written into the phone's storage as soon as the clip ends. (toDataURL, not toBlob: Chromium makes toBlob wait for idle
  time, which the busy finder never left: one frame every 2.5 s in the browser test.)
- Stroke test (Menu → Stroke test, designed with the owner): four stations, the cue ball and the 1 re-spotted each time,
  6 shots each (2 soft, 2 medium, 2 firm): shooting right and left across the picture, toward the phone, away from it;
  then 7 moves that are not shots (practice strokes then stand up, the cue ball rolled into place, pushed with the
  shaft), each recorded with a Record button (2 s before, 6 s after). Spots in diamonds as the phone sees the table
  (from the left end, out from the near long rail), each drawn as a ring lying on the cloth (an oval from the phone:
  owner, a ring drawn flat on the screen did not show where the ball had to be) that turns green when a ball sits
  within about an inch of the spot, with a dashed line to the pocket. Shots and clips carry the station and attempt;
  Rack complete is off during the test.
- The session kept on the phone (IndexedDB): every picture, tap, clip and the log (every 20 s, on hide and at the end),
  the latest two sessions. Save debug packs from there, in zips of at most 29 MB each (part.json says which part of how
  many), shared one tap per part; with no session on the page (after Safari closed it), the last session kept. Logs keep
  40000 looks (was 4000: Oct 31 lost 98 s of a 17-minute session) and 30000 events; every shot picture is kept.
- A new set of balls put out while a rack is still open starts a new rack (rackNew: 4 or more balls standing that came
  since the last shot, and more on the table than then); "New rack: balls set out". Replays: Oct 31 15:10 from 48 to 54
  of 59 right (rack 4 named again); no other session loses a shot.
- The tracking card measures V3.1.0 as a scoreboard; stroke-test sessions are not counted.

## V3.1.1 (Oct 31) — the finder in the background; the stroke test goes on by itself
- First stroke test (Oct 31 16:34, V3.1.0): the watcher got about 4 frames a second. Its own work is about 10 ms a
  frame, but the finder (ONNX Runtime on the processor) held the page about 210 ms each look and frames only came
  between looks. Now ONNX Runtime's proxy mode runs the finder and reader in a background worker (ort.env.wasm.proxy, on
  the processor only, set before the first session): in the browser test the watcher went from 2-3 to about 28 frames
  a second and a recorded move has about 27 frames a second (246 in 9 s, 1.4 MB). The clips at 4 a second already
  showed the stroke plainly (down on the shot, the black cue on the cue ball, the strike, the follow-through).
- The stroke test, after the owner's run: a shot at a station counts as an attempt when it ends and the cue ball reached
  another ball or something went in (the cue ball put back by hand is not one); after the sixth the next station comes
  up by itself with a beep. Retry throws out the last attempt (its shot marked test.discarded) and goes back to it.
  Record gives a 10 s countdown on screen with a beep, then records 8 s (and the second before), then a long beep. The
  beeps come from the speaker (Web Audio, started from the tap); nothing is recorded from the microphone.

## V3.1.2 (Nov 1) — the stroke test made easy to run
- Third stroke test (Nov 1 11:47, V3.1.1): the watcher ran at 29 frames a second on the phone (the finder in the
  background, about 260 ms a look), clips about 116 frames (1 MB) a shot. The owner: the rings far too small to set up
  to while looking back at the screen; the 1 put back from the pocket a ? every time. Cause: the test kept one rack open,
  so the 1 counted as already in and could not be named again; the first ball hit was then often not known and only 6 of
  18 shots counted as attempts.
- Rings 4 in each way (was 1.6), a chime from the speaker once both balls sit in them (once a shot). During the test no
  number stays counted in, so the 1 put back is found and named like a rack ball. A shot counts as an attempt when
  anything besides the cue ball changed (the tracker's othersChanged, now exported as changed). The card shows only the
  pace (Soft, Medium, Firm), large, with the station and shot (owner: the rings and the line say where everything goes).
- The home screen checks the site's version (index.html, not from cache) at most once a minute and offers a newer one
  with a button that reloads the page (Nov 1: a test ran on the old version because the page stayed open in Safari).

## V3.1.3 (Nov 1) — clips for the stroke work; Save debug in one share
- The full stroke test (Nov 1 12:58, V3.1.2): all four stations and the moves, 29 frames a second. The app sees a shot
  start about 0.3-0.5 s after the strike, so 2 s before held only the last practice strokes; toward the phone the
  end-on cue was a pixel or two wide in the 320 px table view.
- Clips in the stroke test: every frame, 4 s before the shot was seen to start and 2 s after, and with each frame a
  close-up of the cue ball at the camera's full size (200 x 200 picture pixels on its spot; c000.jpg ..., listed in
  index.json closeUp with where each was cut). About 2.3 MB for a 9 s move, 1.6 MB a shot. In play (not the test) the
  clips keep every other frame (15 a second) and 2 s before, about 0.5 MB a shot, so a session's file stays a size the
  owner can upload (at 29 a second an 80-shot session would have been about 90 MB).
- Save debug: parts of at most 28 MB as Files counts (a million bytes; V3.1.2's "29 MB" was 29 x 1,048,576 = 30.4 MB in
  Files, over the upload limit), sizes shown the same way, and all parts in one share when Safari takes them together,
  so Save to Files saves them at once (one at a time is still there if it does not).
- Setting corners: Safari's own press-and-hold magnifier is stopped (it came up over the app's, smaller).
- Claude leads the project; the owner tests and suggests (noted in CLAUDE.md).

## V3.1.4 (Nov 2) — a flicker in a frozen line is not a hand
- The line drill (Nov 1 18:44, V3.1.3): the 9 balls frozen in a line across the table toward the phone, shot out, set out
  again; 5 racks. Live 29 of 38 real shots right, 33 found. Five real shots (3 in rack 3, 2 in rack 5) were thrown out
  as hand moves. In each the cue ball sat still, named and seen; the "mover" was a ball in the tight part of the line
  found twice about 1.4 in apart (the 9 against the far rail read "9" at y 35.3 and 36.7), its spot flickering between
  the two. Cue ball first called that a ball moved by hand, and the phase stayed "hands" until everything was still, so
  the real shot that came a moment later was never started. The hands clips (one per throw-out) show the strikes.
- The fix: the first look of motion decides nothing while every mover is still within a ball's width (flicker, 2.2 in)
  of where it rested; the next look tells a ball on its way (it goes on, and counts as fresh, with the speed it had when
  it started) from a flicker (it is back, or resting). One such small mover is left out while another ball really rolls;
  two or more count as they did (balls racked by hand stay hands). A shot now starts a look (0.3 s) later only when its
  first look moved the cue ball under 2.2 in.
- Replays: no recording got worse; the line drill 36 of 38 right (was 35), its false 7 gone; Oct 26 23:50 and Oct 28
  17:10 one hand move fewer counted as a shot. The replay of the line drill never had the problem (it keeps the names
  differently: no camera frames for the bare-cloth check), so a made-up test holds the case: the 9's spot flickering
  1.4 in the looks before the cue ball is struck, a shot and no hand.
- Names in the line (after pictures): mostly right; in the tight part a few ? and extra spots (one ball found twice);
  one wrong number (the 9 shown as the 5 after shot 19); right once the line thinned out. Also: the 7 called in at New
  rack (21), the 1 and 9 on balls picked up (9), the 9 on 15 and the 7 on 22 missed, the 1 on 13 an unknown ball.
- A drill, so not on the tracking card (as Oct 30's line racks); the card now measures V3.1.4.

## V3.2.0 (Nov 2) — the session review and the stroke from the side
Owner, Nov 2: progress had slowed to small patches and test sessions; work in big chunks, each version something to see
in play, no more dedicated tests (normal play is the test). Looking back: Oct 26-29 took the tracker from nothing to
about 95% of shots right; after that came nine small tracking patches (V3.0.7-V3.0.15) and four versions of stroke-test
tooling (V3.1.0-V3.1.3), none of it visible in play, and the stroke itself was never measured. Meanwhile every session
already kept what a review needs (each ball's path, before and after pictures, a clip per shot) and showed only a list.
- Session review (src/v3/review.js): Session over (and Last session from home) shows shots, balls in, the share of shots
  that made a ball (breaks left out), best run (shots in a row in one rack with a ball in and no scratch), misses,
  scratches; each rack in a line; the shots as a list. Tapping a shot opens it from above: the table drawn to scale
  (balls a fifth larger, to read), the balls that did not move where they rested, each moving ball from a faint start
  along its tracked path to where it stopped or into its pocket (lit), then its clip as a flip book at the pace it was
  taken, and its before and after pictures (from memory, or the phone's store for the latest two sessions). Each shot
  keeps its rack, where the balls rested and its paths thinned to half an inch (a few KB). Every session's numbers are
  kept in the phone's storage (the latest 300) and drawn on the home screen as a bar per session.
- The stroke (src/stroke.js): in the watcher's 320 px picture, every frame while the named cue ball rests: the cue ball
  followed by its white pixels; the cue as the direction with the longest unbroken run of not-cloth over the cloth (1 px
  either side, a pixel's gap allowed, at least 14 px; the rails do not count); its tip where the run starts. Not-cloth for
  this is the cloth's hue AND within 0.12 of its saturation and 40 of its brightness: the shaft, a pixel wide, only pales
  or darkens the cloth. From the frames: the strike (the ball leaves its spot and stays away), the tip's distance in table
  inches, smoothed, its turns with an inch of give (practice strokes = backswings before the last), the backswing from
  the address, the pause (how long the tip stayed within half an inch at the back) and the follow-through (the tip past
  the ball's old spot in the half second after). Reported from the side only: the cue within 25 degrees of level in the
  picture, seen in 60% of the frames. On the stroke test of Nov 1 12:58: the strike found on every shot, 0.25-0.9 s
  before the app saw the shot start; stations 1 and 2 (cue across the picture) backswing 5-10 in, pause 0.2-0.3 s,
  follow-through 6-8 in, which match the clips by eye; toward or away from the phone (stations 4, 5) the cue is too short
  to measure. The direction the cue ball left against the cue's line came out up to 17 degrees off on straight shots
  (the cue is raised at the butt, the picture small): not shown. Shown per shot in the review, averaged in Your stroke,
  logged per shot ('stroke' with its curve) for the next reviews. tools/v3/stroke.js runs it over a debug file's clips.
- Check my stroke (menu) replaces the stroke test's stations, countdowns and chimes: just play; after each shot its
  stroke shows for a few seconds, and the clips keep every frame and 4 s before (with the cue ball close-ups).
- Next with the stroke: use the strike to tell a shot from a hand (a cue at the ball before it moved), which is what the
  cue-first guess does today; the end-on view from the close-ups.

## Review: Nov 1 20:06 (V3.2.0), the first session on V3.2
Practice at the side spot with two to four balls at a time, the first shot set up again four times, Check my stroke on;
12 minutes, 48 shots, 5 parts. Truth from the shot pictures (the yellows checked close up: the striped 9 against the
solid 1). Live 35 of 46 real shots right, all found, 2 setup moves counted as shots. Wrong: false scratches on 2, 4 and
17 (the cue ball picked up to set the shot again); in the last set (37 on) no new rack was seen, because the setup move
at 36 was taken for a shot, so its balls stayed unnamed (their numbers counted in): pots called "a ball" or missed, the 9
called the 7; the 9 lying in the top-left pocket kept as a ball on the table (35). Names right on 150 of 184 balls. The
stroke from the side on 31 of 48 shots, but the strike late on 7 hard shots (see V3.3.0). Not counted as a drill: it is
play, so it is on the scoreboard (now measuring V3.2.0 on).

## V3.3.0 (Nov 2) — the same shot set up again; the review's fixes
- Set up again (review.js repeats): a shot whose cue ball starts within 4 in of the shot before's, with every other ball
  within 4 in of one of that shot's balls and as many, is a try of the same shot; consecutive tries are put together.
  Names play no part (they can be wrong as the cue strikes) and balls rolling as the shot started are left out (balls
  hidden at the strike, behind the cue or the hand, count where they rested). On the recordings: Nov 1 20:06 shots 2-4,
  nothing anywhere else. The review shows "Shots you set up again"; each opens one drawing with every try (each cue
  ball's end at its try's number, a ball's path solid where it went in, dashed where not, unnamed balls left out) and the
  tries in a list with their result and stroke.
- The cue ball put back (track.js cueBack): the cue ball gone from where it rested, about to be called in late, while a
  ball named the cue ball, or whose best read is the cue ball, has come to rest on the table since: it was picked up and
  put back, not in. 7 of the 8 late scratches in all the recordings were this; the one real one (Oct 31 14:52, 6) stays.
  Replays: Nov 1 20:06 three false scratches gone, Oct 31 15:10 one.
- A number put back (track.js reviveGone): a number counted in comes back for a ball that turned up since it went in, at
  most 15 s ago, unnamed, resting, read as that number strongly over several looks (geometric mean 0.7), with no free
  number fitting it and no ball holding it. Replays: Oct 29 17:50 +3, Oct 31 14:52 +1, Oct 31 15:10 +1, Nov 1 20:06 +3
  (35 of 46), none worse. (A ball two minutes on the table, named, read "1" for a while, brought the 1 back on Oct 30
  18:21 until the rule asked for a new, unnamed ball.)
- The strike (stroke.js): the tip back at the ball after the last backswing, when that comes before the ball is seen
  to leave (a ball hit hard is gone in one frame and the tip's white ferrule on its spot passed for the ball); a practice
  stroke is a backswing of at least 2 in from where the tip rested (a waggle is not). On the 20:06 clips the strike is
  found on 42 of 47 shots, a median 0.67 s before the shot was seen to start; 2 after it (the app started those shots
  early, a ball still rolling), against 7 live.
- Not fixed: a ball lying in a far pocket can sit where a ball on the table 1.5 in off the cushion would be (the 9 in the
  top-left pocket at 20:06, found with a full ball's score), so it stays a ball on the table.
- made_late events carry where the ball was last seen (at).

## V3.4.0 (Nov 2) — Practice and Play a rack
- Owner, Nov 2: in practice a ball is set where it is wanted and hit, the cue ball moved, balls picked up and put back,
  nothing in order; asked for a practice mode beside playing a rack properly. Agreed: almost every wrong call at 20:06
  came from rack rules that do not hold in practice (a ball picked up taken as in, numbers counted in after the balls
  were put back, "rack complete" when the balls simply ran out). Saying which removes the guess.
- Home: Play a rack (as before: racks done by themselves, a new set of balls is a new rack, runs) and Practice. Practice
  runs the tracker with practice: every number is free again as each shot starts (S.gone emptied), no rack complete and
  no new rack, and End session infers no ball in. The New rack button is hidden. The review in practice: "Practice
  over", no racks, the tries of a shot set up again in place of the best run; the history marks practice sessions. The
  debug header carries the mode and the replay uses it. Replayed as practice, Nov 1 20:06: 36 of 46 (35 as play).
- The stroke's numbers checked against the close-ups (full camera size around the cue ball, the ball 2.25 in across, about
  15 px an inch), 20:06 shot 2: the tip 1.9 in from the ball's centre at address (the app: 1.9); out of the 13 in window
  at the top of the backswing (the app: 12.5 in back); 0.15 s after the strike already more than 7 in past the ball's
  spot (V3.2 live said 5, V3.3's strike from the cue 7). Long, full strokes, not a measuring error.

## Review: Nov 1 21:18 (V3.4.0, Practice)
The first practice session. Phone at the side; first a row of balls along the near rail, each set by the far side pocket
and cut into the top-right corner (1-14), then all the balls spread out and shot one at a time (15 on); 12 minutes, 45
shots, 4 parts. Truth from the shot pictures (the far rail zoomed). Live 30 of 39 real shots right, all found; 6 not
shots counted (8, 16, 29, 39: balls moved with the cue or by hand; 9, 10: nothing moved). Wrong: false scratches on 3
(the cue ball picked up, put down a while later) and 20 (the cue ball's track jumped 43 in to a corner as the shot
started and was taken as going in); a scratch missed on 7 (the 4 and the cue ball into the top-right corner); the 4
called in when picked up (4, 34); the 9 called in a shot early (27); the 2 (2), the 7 (6) and the 7 into the near-right
corner (44) missed. The stroke from the side on 35 of 45 shots: 1 practice stroke, 10 in back, 0.27 s pause, 6 in
follow-through typical; the strike 0.58 s before the shot was seen to start. Names not checked this time; on the
scoreboard without name counts (the card now takes each share over the sessions that have that count), measuring V3.4.0.
- For the next build: in practice no late scratch (the cue ball gone without being seen going in was picked up); the
  replay as practice 32 of 39 (31 without). Not yet published (fixes ride along with the next build).

## V3.5.0 (Nov 2) — your shots: by pocket, by cut, by length
- Owner, Nov 2: in practice the object ball is not set in the same spot each time; four balls go to one pocket, five to
  another (the pockets are tight); what matters is practising cut shots and the like. So the review reads each shot:
  the ball played (the ball hit first, else the one that went in, else one that moved), its pocket (the one it went
  into; missed, the pocket within 20 degrees of the way it was sent: its own path once 3 in long, else the line of
  centres where the cue ball, going the way it set off, meets it), the cut (between the aim at the contact point, two
  radii back from the ball on the line to the pocket, and that line) and the lengths. A cut over 75 degrees, or no pocket
  that way, is left unread: a bank, a kick, or a shot not followed well enough. The way the cue ball set off is taken
  from its first point 3 in out; a cue ball hit hard has turned off the object ball by the first look (0.3 s), so a pass
  up to 3 in wide of the contact is let through.
- On the 21:18 practice log: read on 24 of the 45 shots (13 while the row along the rail made them "breaks"); the opening
  drill came out as 25-33 degree cuts into the top-right corner, as it was set up.
- Shown: "Your shots" after a session (made and tries by pocket, by cut: straight in under 10, small 10-25, medium
  25-40, thin 40 and more; by length to the pocket: under 2 ft, 2-4 ft, over 4 ft), each shot's words ("a 28° cut to
  the top-right, 2.5 ft from the pocket") and its drawing with the aim dotted to the contact (a dashed ring) and the line
  to the pocket. Every session keeps its cut and pocket rows; the home screen adds the cuts up over all sessions.
- Practice: no break (a row of balls kept along a rail packs like a rack); no late scratch (see the 21:18 review).

## V3.6.0 (Nov 2) — drills
- Owner, Nov 2: a rate by pocket means little, and a miss's pocket cannot be guessed: a thin cut over 75 degrees, or a
  thin cut banked to the other side, is practice too; the open pocket is not what was being practised. Hence practice
  tests. Agreed: free practice now reads only the balls made (their pocket is where they went), with no limit on the
  cut, and shows them by cut and by length as counts; rates come from drills, which say what each shot is for.
- Drills (src/v3/drills.js), each progressive (Bob Jewett's progressive practice: made, the next level is harder;
  missed, it steps back; the level reached is the score). Positions in diamonds as the phone sees the table (from the
  left end, from the near rail):
  - Cut ladder: the object ball a diamond off the far rail, two from the right end, into the far right corner; the cue
    ball 2.8 diamonds back from the contact point (closer when the table runs out), cut 0, 10, 20, 30, 40, 50 degrees.
  - Thin cuts: the same ball and pocket, 45, 55, 62, 68, 73, 77 degrees, the cue ball 1.9 diamonds back.
  - Cross-side bank: the object ball a diamond off the near rail at the middle, banked off the near cushion into the
    far side pocket (aimed at the pocket's mirror in the cushion line); each level moves it a quarter diamond right.
  - Stop shot: straight into the far right corner from 1.4 diamonds out; the cue ball 1.2 to 4.4 diamonds back; made
    only if the cue ball stops within a ball and a half of where it hit.
- Live: Menu → Drills (practice rules switch on), rings where the balls go (green with a ball on them; placing
  roughly is enough), the cue ball's aim to the contact (dashed ring), the ball's line to the pocket (off the cushion
  for the bank), the pocket ringed, and the drill's line at the bottom (level, made of tries). 2.5 s after each shot
  (time for late calls) it is scored on where the balls really were: the object ball is the ball nearest its ring
  (within 8 in; else the shot is not a drill shot), made if it went into that pocket (a call with no pocket counts) and
  no scratch; the cut is the one really played. Then the next setup.
- Review: a Drills card (made of tries at each level, the level reached); each shot says its drill; the home screen adds
  the drills up over all sessions (tries, makes, best level).
- Not yet: the exact Billiard University setups (drdavepoolinfo.com and billiards.colostate.edu are not allowed in
  this session's network); a drill picked from the home screen.

## Correction to the 21:18 review; what "a shot" still needs (Nov 2)
- 21:18 shot 9 is a shot: in its clip the cue ball goes across, misses the 1 and rolls back to where it started, so the
  pictures before and after look alike. Live 31 of 40 right; the replay 33. (Found while checking the stroke against the
  truth: the stroke detector had a full stroke on it, 10.6 in back, 0.4 s pause, 6.1 in through.)
- The owner, Nov 2: the cue work was for telling a shot from what is not one (setting balls out, moving them with the
  cue, picking them up). Checked on 20:06 and 21:18 (85 real shots, 7 moves counted as shots): the strike as V3.2
  measures it (the cue ball leaves its spot with a cue line at it) is seen on 74 of the 85 shots, but also on all 7
  moves, and a move with the cue (21:18, 16: the cue ball pushed toward the player from the far side) even shows a
  "stroke" (the cue going back and forth while reaching). So it cannot yet decide what is a shot. What should: a shot
  has the tip resting at the ball (the address) and coming through fast as the ball leaves along the cue; a push with the
  cue has the tip slow and staying on the ball as it moves; a hand has no cue at the ball. Next: those measures on the
  clips of these two sessions (and the hands clips of the moves thrown out), tried against the truth before they decide
  anything live.

## V3.7.0 (Nov 2) — a shot or not: the cue ball pushed with the cue; "Not a shot" in one tap
- Measured on the clips of Nov 1 20:06 and 21:18 (85 real shots; 7 moves counted as shots: 20:06 1, 36; 21:18 8, 10, 16,
  29, 39), against the truth. What the moves were, from the clips: balls set out by hand (20:06 1, 36; 21:18 8, with the
  9 nudged by the cue first), the cue ball pushed with the tip (21:18 10, 29, then picked up), raked across by the cue
  from the far side (16), swept with the cue held at the butt, no bridge (39).
- What does not tell them apart: how fast the cue ball sets off (the moves 15-58 in/s at the tracker's first look, real
  shots from 12); the tracker's path (its first points come after a near ball is hit, and on 20:06 #45 it pointed the
  wrong way); not-cloth round the ball (balls close by, and the bridge hand, on real shots too); a "strike" from the
  stroke curve (on all 7 moves, as found before); the ball reaching full speed in one frame (in the 320 px picture a
  dozen real shots look like a ramp, as the pushes do).
- What does, and only from the side: the way the cue ball sets off against the cue's line at the address. Followed in
  the small picture ahead of its way (observe's fb: a ball sent off fast leaves the old near search in one frame), real
  shots leave within about 10 degrees of the cue (all side-view shots of both sessions bar one at 38). A first move back
  toward the butt (110-180 degrees) is the tip's white ferrule in the backswing (20:06: 3, 5, 17, 22, 28, 39, 40, 45),
  looked past. A cue more than 12 degrees off level in the picture is not read: the cue then comes down from the far
  side, its height tilts it in the picture (20:06 13, 15, 20: real shots read 99-117 degrees off at up to 18 degrees).
  STROKE.moveCheck: the cue steady (80% of the last second within 8 degrees), within 12 degrees of level, the ball off
  45-110 degrees from the cue's line = pushed, not struck. On the two sessions: 21:18 10 found, no real shot. The others
  it cannot see: hands (no still ball and cue), rakes from the far side (cue not level), the sweep along the cue (20
  degrees). Fixture tests/fixtures/v3/move-2118 (21:18 10, 22, 30).
- Live: the check runs with the stroke's summary 1.6 s after a shot starts (move_check in the debug file). A move with
  nothing in and no scratch is not counted; a ball called in late counts it again.
- Not a shot, the player's word: every shot's line ("Shot 12: the 3 in · tap if not a shot") takes a tap to un-count it,
  or to count back one the app left out; the review's shot view has "Not a shot" / "Count it as a shot". A shot not
  counted stays in the list (struck through, "not counted: ...") and counts nowhere: stats, racks and runs (a move does
  not break a run), cuts, the stroke's average, shots set up again, drills (a drill try on it is dropped; live it is not
  scored), the history (redone when changed). The debug file has not_shot_mark for each tap.
- Why the tap: with the 320 px picture the cue can call only a clear sideways push; the tap lets normal play mark the
  rest, and the marks are truth for the next measure (hands and rakes).

## V3.7.1 (Nov 3) — no buttons
- Owner, Nov 3: no buttons to press while playing, no need to watch the screen; check what the app gets wrong from the
  debug files instead. The tap on a shot's line and the review's Not a shot / Count it are taken out. What stays: the
  automatic check (the cue ball pushed sideways with a level cue is not counted), and a shot not counted is struck through
  in the review's list and left out of every number. The truth for telling hand moves and rakes from shots comes from the
  reviews of the debug files (shot pictures and clips), as before.

## V3.7.2 (Nov 3) — the ball finder started twice
- Nov 2, 16:55 (V3.7.1, practice, owner: "the ball thing can't run"): the table accepted at 2.6 s; the ball finder still
  starting (a new version: its files downloaded again) when the table was found and accepted again at 24 s; the second
  start failed at 56 s with "The object can not be cloned", and no look was ever taken. Cause: on the processor the finder
  runs in the runtime's background worker, which takes the model's bytes over (postMessage with the buffer moved); the
  download kept for reuse (detect.js fetchBytes) was then empty, and a second start of the same finder had nothing to
  send (on Chromium the two starts at once hang instead). Fix: each start gets a copy of the downloaded bytes, starts run
  one at a time, and only the latest table acceptance goes on to watching (two would have started two loops). Test
  tests/finder.test.js (two starts at once, then another shape: all three finish; the old code hangs).
- The camera "would not start at first": not in this file (the camera started at once, 1920 x 1080); it was an earlier
  opening of the page, not saved.
- The drill's rings never showed on 16:55 either: they were drawn only while watching, which never began. Now they show as
  soon as the table is accepted, while the ball finder starts (each ring turns green once a ball is seen on it).

## V3.8.0 (Nov 3) — drills: ready to shoot, and laid out away from the phone
- Owner, Nov 3: moving a ball onto its ring was taken for a shot; the cut drills had him shooting from where the phone
  stands (behind the near rail at the middle); the cross-side bank left no room to shoot; the stop shot was fine.
- Ready to shoot: once a drill is on, both balls on their rings (within 4 in) and the table still for 3 s, counted down
  in the drill's line at the bottom ("Set the balls on the rings", "Ready in 3, 2, 1", "Ready: shoot"). A shot that
  starts before "Ready: shoot", or after it only nudges the cue ball (under 6 in, nothing else moved, nothing in), is
  setting up: not said, not scored, not counted, not listed in the review (kept in the debug file: drill_setup_move;
  drill_ready when ready). No button: the balls on the rings and still are the signal.
- Cut ladder: the cue ball stays 3 diamonds from the left end in the middle; the object ball 1.5 diamonds from the far
  right corner, turned round the pocket toward the end rail until the cut is right (0 to 50 degrees). Shot the long way,
  from the left end.
- Thin cuts (as the owner described): the object ball a hair off the right end rail, 1.25 diamonds from the near right
  corner; the cue ball moves out for each cut, 50 to 77 degrees, shot from the far side or the left.
- Cross-side bank: the object ball 1.5 diamonds off the near rail (was 1), a quarter to a diamond and a half right of the
  side pockets (never straight between them), the cue ball 1.2 diamonds behind it; shot from the far side.
- Test: for every level of every drill, the cue's line traced back off the table (where the player stands) is at least
  2 diamonds from the middle of the near rail.

## V3.8.1 (Nov 3) — lighter marks, rail lines, paths that clear, drills step by step
- Owner, Nov 3 (after the 18:04 drill session): placing the balls by looking at the screen is hard; the drawing is busy
  and slow; the progressive drills kept him from getting on.
- Drill spots: two faint lines in from the nearer long rail and the nearer short rail cross where each ball goes; the
  spots and the ghost ball are dashed ball outlines (green once a ball is on), the pocket a dashed ring, a tiny "cue" by
  the cue ball's spot; the old rings and words gone. Checked on a screenshot: light but visible.
- Balls: no circle; the number small, on the ball itself; to the side (as before) only where balls are bunched; a ball
  out of sight or about to be called in keeps a faint dashed outline. In a drill only its two balls are labelled (the
  rest are still followed, for the debug file).
- Paths: drawn while the balls roll and cleared 1 s after the shot ends (about 2 s after the balls rest), in play too;
  every path stays in the debug file and the review.
- Drills step by step: three shots at each step, made or missed, then the next; after the last step the drill is done
  and says made x of y. The line at the bottom: "shot 1 of 3 · step 2 of 6". The review shows made of tries per step.

## V3.8.2 (Nov 3) — countdown in double time; a hand stops it; a steadier outline
- Owner, Nov 3 (18:04 drill session): the countdown is good but slow ("3, 2, 1, ready" in double time); no shot while
  a hand is on a ball or other balls move; the outline kept bouncing.
- Ready: 3, 2, 1 at half a second each (1.5 s). While counting, it starts over if anything moves, a ball is about to be
  called in, or a hand is at a spot: round each spot, 3.5 in out, 2 or more of 8 points that are neither cloth nor a ball
  (drill_hand in the debug file).
- Steady (the outline following the phone): on the 18:04 live log it flipped 3 to 5 px from look to look (and every
  ball's table position with it), while the session's 106 still shot pictures, matched the same way offline at the same
  half size, show the phone drifting smoothly, 4 px in 20 minutes. The noise was patches half covered by the player still
  voting. Now: a patch counts at a match of 0.8 (was 0.7), at least 4 must agree within 2 px (was 3 within 3 px), and the
  outline moves only for a change of 2.5 px or more (was 1.5). A real sway (every patch agrees) is followed at once; the
  sway test still passes. (Smoothing over several looks was tried first: it lagged a swaying phone and failed that test.)
- Speed on 18:04: the finder about 260 ms a look, the watcher 29 frames a second, as before; the drill's slowness was the
  3 s countdown.

## V3.8.3 (Nov 3) — the move check decides nothing
- The 18:04 session: the V3.7 move check threw out 8 real cross-side bank shots (45 to 53; the misses, so they were not
  scored either). Shot from the far side, the cue is seen end on, short and upright in the picture; the detector took
  another line, level in the picture (352 to 2 degrees), and the ball leaving toward the near rail was 80 to 100 degrees
  off it. The cue's run length does not tell it (26 to 31 px here, the real push of 21:18 10 was 27, real shots 24 to
  29). One real push found in all, against 8 real shots lost: the check now only logs (move_check), and the drills'
  Ready to shoot handles setting up. The tool keeps the check, with the cue's run, for measuring.

## V3.8.4 (Nov 3) — the rail diamonds again
- Owner, Nov 3: the diamonds were a V2 pillar (set distances, and they do not depend on the cloth's colour); V3 had
  dropped them (vision.js still had V2's findDiamonds / refineWithDiamonds, nothing called them).
- Measured first on Nov 2 18:04's still pictures (half size, the outline as accepted): 16 to 18 of the 18 diamonds
  found; the outline off them by a median 4.1 px on the table-finding picture and 5 to 7 px later (the phone settling);
  after refineWithDiamonds 0.8 to 1.7 px; the far rail of the outline sat about 7 px (half size) below the far cushion
  (about an inch on the table there), the corrected one on it. The owner's "bank spot close to the side pocket".
- Now, when the table is accepted (not for corners set by hand): the diamonds found on the still picture, the corners
  nudged onto them when that fits better (debug: diamonds, with how far off before and after, and how far the corners
  moved). On the test photo: 18 found, 6.2 px off, 1.4 after.
- Steady: besides the 6 cloth patches, a small brightness patch on each diamond found (a white mark on the dark rail);
  the same vote (a clear match, 4 agreeing within 2 px). The sway test passes.
- Found on the way: the drill's hand check sampled points 3.5 in round each spot with a ball-wide look, and next to a
  cushion that look takes in the cushion (not cloth): with the corrected outline the cut ladder's object ball (about 5 in
  off the far cushion) never got to Ready. Points within R + 3 in of a cushion are now left out.
- The browser test now asks 3 named balls of 7, not 4: on its 1280 px photo the bunched balls read near the naming cut,
  and the 2% change in the finder's scale tips two of them (the 8 from 0.93 to 0.59). To check on the next real session.

## V3.8.5 (Nov 3) — Ready holds; drills scored on the object ball; review of Nov 2 19:34
- The 19:34 session (V3.8.4, practice, the cut ladder done through, 2 parts): 18 scored, 14 made; the cuts played now
  close to the setup (0: 0-9, 10: 11-18, 20: 26-30, 30: 28-42, 40: 40-44, 50: 47-49) with the rail lines. Diamonds: 16
  found, the outline 9.1 px off them, 2.3 after (corners moved 12.6 px).
- But the first scored shot came after almost 5 minutes: Ready was reached and then dropped before the shot (shots 2, 4,
  6, 8, 10, 14, the cue ball 24 to 48 in, counted as setting up). Cause: since V3.8.2 Ready also wanted no ball anywhere
  moving or about to be called in, and a ball at the far end (17, 6 in) was found and lost every few tenths of a second.
  Now only the drill's balls count, and Ready, once reached, holds until the shot; only balls put down by hand (the
  tracker's hands) take it back. Replayed on the looks: those six shots ready, every scored one still ready, the setup
  moves between them not.
- Owner: the drill is about the object ball; he stops the cue ball and sets up the next. Now (not the stop shot) the
  shot is scored as soon as the object ball is known: called in, made; rolled and resting 0.7 s away from the pockets,
  missed; the next setup shows at once (drill_early). A shot after Ready that never touched the object ball (the cue ball
  moved by hand) is not a try (drill_untouched).
- Steady: the outline moves only for 3 px or more (was 2.5): on 19:34, with the diamonds, x still flipped between two
  readings 2.7 px apart while y held.

## Review: Nov 2 20:27 (V3.8.5, drills) and V3.8.6
- 27 minutes, 4 parts: the cut ladder (18 tries, 16 made, in about 9 minutes, half the time of 19:34), the cross-side
  bank (18, 12 made) and the stop shot (15) all done through. 31 shots scored the moment the object ball dropped
  (drill_early); Ready dropped only by balls put down by hand (5); the hand check fired 6 times; 4 shots that never
  touched the object ball were not tries. Diamonds: 16 found, outline 7.5 to 12.2 px off, 1.9 to 2.1 after (the first
  table, found from another angle with 7 marks, was found again 33 s later).
- The stop shot was strict: 6 of 15 "in, but the cue ball did not stop". By the pictures, 64 and 89 (3.8, 4.0 in from
  where it hit) stopped where 88 (0.3 in) did: by the far rail the tracker's place wobbles an inch. Now within two balls
  (4.5 in, was 3.4): 64 and 89 made; 62 (drew back 17 in), 63 (7 in sideways) and 86 (4.8 in) still missed; 60 lost
  the cue ball.

## V3.8.7 (Nov 3) — a drill ball lying in its pocket is in; the table drawn at the cushion noses
- Owner: in the 20:27 cut ladder he missed only one. By the clips: shot 7 (the 3) rattled in the far right corner and
  came back out along the far rail (a miss, resting 5.2 in from the pocket); shot 10 (the 1) went in and lay in the
  pocket's bowl in view, scored a miss. The tracker has a line per far pocket where a ball lying in it shows up (cloth.js
  pocketBags) and takes a weak spot there (finder score under 0.6) for a ball in the pocket; the 1 sat 0.5 in from the
  far right's line at 0.67 to 0.70. Raising 0.6 for everything was tried on the 15 recorded sessions: 0.7 or 0.75, 490
  shots right against 492 (one session 14 of 14 to 11). So only the drill uses it: its object ball resting within 1.5
  in of its own pocket's line is in (early and at the shot's end; drill_bag). 20:27: 10 made, 7 still a miss.
- Owner: the outline looked off. Drawn on the 20:54 picture: the table as the app has it (after the diamonds) is right,
  the pocket mouths at nose height land in every pocket; the outline was drawn at cloth level, the line under the cushion
  noses, which the near cushion hangs over (so it ran over the near rail's top). Now, checking the table: the outline at
  the noses' height (1.4 in), on the cushions one sees, with the corners; watching: no outline, a small faint dot at each
  pocket's mouth (the owner's idea).

## Review: Nov 2 20:54 (V3.8.5, Play a rack)
Two racks of 9-ball in rotation at the side spot, the same table as the drills; 8 minutes, 31 tracked moves. Truth from
the shot pictures: 29 real shots, 2 setup moves counted as shots (1: the 1 put down by hand; 2: the cue ball nudged an
inch with the tip). Live 29 of 29 right: every ball made and every miss, both scratches (7, 19), the late calls (4, 28,
31), the break of rack 2 (nothing in). Names not checked. Diamonds: 17 found, the outline 8.6 px off, 1.9 after. On the
scoreboard; fixture session-20261102-2054 (the replay 28 of 29: shot 7's scratch, called late live once the cue ball's
spot read bare cloth, is not caught from the cloth maps of the shot pictures).

## Review: Nov 8 10:59 (V3.8.7, Play a rack, another room)
One rack of 9-ball on a different table, 4 minutes, 11 shots. Diamonds: 16 found, the outline 14 px off them, 2 after.
Live 10 of 11 right, no setup moves counted. Wrong: the break called the 2 in the top-right corner. A person stood
between the phone and the rack as it was broken, so the break was not seen as one (the 1 first taken for the cue ball),
and the 2, lost twice by that pocket, was called in after the wait; it lay about a diamond short of the corner and came
back 18 s later as a new ball (tapped as the 2). The known "ball by a far pocket" case. Fixture session-20261108-1059
(the replay 9: shot 10's 8, called late live from the cloth, is not caught from the shot pictures' cloth maps). On the
scoreboard. (A 10:48 session came as part 2 of 2; part 1 still to come.)

## Review: Nov 8 10:48 (V3.8.7, cut ladder, another room) and V3.8.8
- The cut ladder done through in 11 minutes (2 parts, part 2 first). Live 18 tries, 14 made; by the pictures and clips 20
  tries, 18 made (missed only 14 and 16). On this table made balls stay in view in the far right pocket.
- Lost: 3 and 15, made, set aside as never touched (drill_untouched 2.5 s after the shot's end), the object ball called
  in 0.05 and 1.5 s later; 6, made, scored a miss because the late call guessed the near side pocket; 20, made, the 8
  lost an inch from its spot as it went and never called (the next ball was set on its spot before the cloth there was
  looked at). 23, counted made by the ball-in-its-pocket rule (V3.8.7), was right (the 9 came to rest beside the 8 and
  the 3 in that pocket); 19 (the cue ball never moved) rightly not a try.
- V3.8.8: a late call on a drill shot scores it again (drill_late: one set aside as untouched is scored; one scored a
  miss becomes made); a late-called object ball counts in whatever pocket the call guessed (its pocket is a guess); the
  object ball lost on its way to the pocket (last seen moving within 30 degrees of the line to it) and not seen again is
  in (drill_vanished; not for the stop shot). Checked on every drill session so far: of the shots scored misses, only
  10:48's 20 changes (20:27's 25, a bank, was scored early, before the ball was lost when picked up). Replayed by hand
  on 10:48: 20 tries, 18 made.

## V3.8.9 (Nov 8) — Check my stroke taken out
- Owner, Nov 8: the stroke should be tracked all the time, without telling the app. It already was: the stroke is read
  on every shot (Nov 2 20:54, Check my stroke off: 30 of 31 read, 14 from the side; Nov 8 10:59: 6 of 11 from the side)
  and shown per shot and averaged in the review. Check my stroke only added full-rate clips with close-ups round the cue
  ball (for checking the measure, done Nov 2; they made drill debug files 4 or 5 parts) and a message after each shot
  (looking at the phone in play). The menu item, its message and its toggle are gone; the stroke is measured as before.
- Still from the side only (the cue within 25 degrees of level in the picture): about half the shots in play. The other
  half, the stroke toward or away from the phone, is the "stroke from the end of the table" item.

## Telling a shot from a move: the player's pose (Nov 8), and V3.8.10
- Owner, Nov 8: a shot is the player down on it, the tip addressing the cue ball with a bridge hand out, from any side,
  then the cue ball taking off and hitting a ball; all of that should decide, not one sign.
- Measured on 291 tracked moves with known answers (221 real shots, 70 setup moves; play sessions 20:06, 21:18, 20:54,
  10:59; drills 19:34, 20:27, 10:48), signs from the watcher's 320 px clip and the log: the cue ball in view and still
  until it leaves (real 77%, moves 46%), a cue at it before (81% / 50%), a ball hit (52% / 11%), a fast first frame
  (43% / 16%), something planted near it (63% / 20%). No cut on them keeps every real shot: about 70 real shots show two
  signs or fewer (banks and stop shots from the far side or the ends: the cue end on, the ball behind the player, 6 px
  in that picture), and pushes or rakes with the cue look like strokes there.
- The player's pose: YOLO11n-pose (Ultralytics' release, 17 body points; exported to ONNX, 11.7 MB, 640 x 384, runs in
  the app's onnxruntime-web, about 0.3 s a picture in a test browser) on each move's before picture. How low the head is
  against the hands (as a share of the person's height): real shots a median 0.16 (p75 0.27), setup moves 0.63 (p25
  0.38). Going through all 70 setup moves by eye: 6 were real shots mislabelled (20:27, 58, 61, 68, 71, 78, 80: the
  player down on the shot, the pose reading the head low), the bank drill's setups show the player upright with a hand
  at a ball, and in the cut ladders the player stands at the left end, often out of the picture (no pose).
- But the before picture is the last still picture, up to 1.5 s before the move: a hand has not reached the ball yet,
  the player has not got down yet. "Upright, a wrist at a ball, nothing hit or made" catches only 1 to 4 of the 64 there.
  The pose has to be read on the looks just before the ball moves, which no debug file has kept (the clips are the table
  only, 320 px).
- V3.8.10: each look keeps a 640 px copy of the whole picture for 2 s; when a move starts the three looks before it are
  saved (shotNNN-pre1..3.jpg; handsNNN-pre for a move taken for hands; pre_frames in the log). The next sessions give the
  player at the moment that matters, from every side; the rule comes from them. Nothing decides on it yet.

## V3.8.11 (Nov 8) — a shot told by the player's pose
- The three practice racks of Nov 8 (13:04, 13:09, 13:13; V3.8.10; 15 balls) brought the looks just before every move
  (0.8, 0.5, 0.25 s). By eye, of 38 moves the tracker counted, 32 had the player down on the shot and 6 out of the
  picture (shooting from the ends, only the bridge hand in view); of 25 it threw out as hands, 15 were real shots with
  the player down on them (13:13: 12 of 16; a striped ball read as the cue ball, so the real cue ball setting off looked
  like a ball moved by hand) and 9 had the player standing.
- YOLO11n-pose (Ultralytics, AGPL-3.0, exported to ONNX: models/pose/yolo11n-pose.onnx, 11.7 MB, 640 x 384) on those
  looks, and a logistic model on the biggest person's body shape (src/v3/pose.js: the 17 points round the box, mirrored
  so the hand further out is on the right, torso lean, arm reach, head over the lower hand), learned on 190 frames (those
  three sessions, and earlier setup moves seen standing). Left out one session at a time: of 54 moves down on the shot 53
  called so (the one wrong an early before picture of Nov 2), of 24 standing 22 caught. In the app's onnxruntime-web on
  four of the frames: down 0.997 and 0.80 (far side facing the phone), standing 0.005 and 0.011 (tests/pose.test.js).
- Live: the pose model loads after the finder; while no shot runs it reads the picture of the last look about every
  0.8 s, in the idle time between looks (never during a shot). The tracker asks when a ball sets off (O.stance): down
  (0.6 or more in the last 1.5 s) and a ball setting off is a shot, whatever the hand rules say, even straight after a
  hand move; standing (0.3 or less, the person over the table) it is a hand move; otherwise (nobody seen, unsure) the
  rules as before. Logged: pose (every 2 s), stance (each time the tracker asks), tracker events stance / hands with
  stance up. On the three racks' looks: 34 counted shots stay, 14 of the 15 real shots thrown out would be counted, the
  8 standing moves stay out, no wrong call; 5 out of the picture as before.
- Not yet measured on the phone: the time the pose takes there (the next debug file: pose events and the finder's ms).
  The licence: AGPL is fine for this public app; a closed product would need Ultralytics' licence or an Apache-2.0
  pose model (RTMPose, MoveNet; their downloads blocked from this session).

## Review: Nov 8 14:09 (V3.8.11, practice) and V3.8.12
- The pose model loaded, read once (standing: one move kept out, rightly), then failed on every look after (268 errors,
  "Tensor's size does not match data length(0)"): on the phone the runtime runs in its background worker and takes the
  input over, and the pose kept its input buffer for reuse. The browser test had not put the runtime in the worker (no
  finder loaded first). V3.8.12: a new buffer each time; the test now loads the finder first and runs each picture twice
  (on the old code it fails with the phone's error).
- Offline on the session's looks before each move: the 14 counted moves all real shots, the player down on each (0.63 to
  1.00); of 7 moves thrown out as hands, 3 standing (racking, setting out, the cue held upright: rightly out), 2 real
  shots with the player down (0.6 to 1.0: the rule counts them), 2 real shots from the left end with only the hand and
  the cue in the picture (nobody seen: still lost). With the fix the rule would have been right on every move it can see.
  Finder 257 ms a look, watcher 29 fps (the pose had not been running).

## Review: Nov 8 14:15 (V3.8.11, practice) and V3.8.13
- The pose check failed live as at 14:09 (266 errors, the bug fixed in V3.8.12). Offline on the looks before each move:
  23 of the 24 counted moves real shots, read down on the shot (0.63 to 1.00) where the player is in the picture; shot 1
  the player setting balls at the right end, standing and facing the phone (upright 0.01: rightly out). Hand moves 1 and
  2 standing (rightly out), 3 a real shot down on it (0.99: counted).
- Two real shots read upright, which the V3.8.11 rule (the last reading upright, over the table) would have thrown out:
  shot 15, a long reach from the left end, bent over 0.8 s before and upright with the cue out at the last look (0.56,
  0.34, 0.05; the 7 made); shot 12, a short pot of the 5 with his back to the phone (0.02 each look, the face not seen:
  from behind the body shape does not show a lean over the table).
- V3.8.13: the stance call moved into POSE.stance (tested). Down as before (0.6 or more in the last 1.5 s). Upright only
  when every reading of the last 2 s (two at least, 0.8 s apart) is 0.3 or less, the person is over the table and the
  face (nose or an eye) is seen; otherwise unsure, and the hand rules decide. On all five Nov 8 15-ball sessions: every
  standing move still called upright where the face is seen, shots 12 and 15 not, no down shot called upright. The back
  view standing moves (14:15 hands 1, 2) fall to the hand rules, which kept them out before.

## V3.9.0: all fifteen balls, 8-ball (several upgrades in one version, owner Nov 8)
- Reader v3 (models/reader-v3.onnx, tools/v3/reader3): the cue ball, 1-15, not a ball. 1,116 balls from the five 15-ball
  sessions of Nov 8 labelled: colour from reader v2, solid or stripe from the white shown (each colour splits cleanly:
  the 2 at most 16% white, the 10 at least 24%), stripes end on (white cap, coloured ring, read as the cue ball by v2:
  10, 13, 14, 15, 9, 11) one by one, the measle cue ball by its red dots; checked that no picture has a number twice
  (it found the 11 and the 15 swapped in 13:04). 59 left out (two balls in a crop, blurred, too small).
- Held out a session at a time: 95.5% right first choice; sure and wrong 2.6% (v2 on 1-9 about 3%), most of it two balls
  each in one pose for a whole session. On v2's test crops it beats v2 (sure wrong 362 against 528); on the verified
  9-ball frames 110 of 110. The first training called the 9 behind the 2 on the Oct 27 photo "not a ball" (the swaying
  test lost it): retrained with a neighbour ball pasted on 30% of crops, the 9 is a ball again and the 4 there is sure.
- detect.js: 17 outputs, temperature 1.21 (fitted on the held-out readings); read(img, spots, ids) takes the numbers not
  in play out. track.js: "not a ball" is the last output, names only from O.ids, the stripes count as white (the white
  test that ties blurred spots to the cue ball), a stripe "mixed" with its solid and with the cue ball (a sure read of
  one does not rule out the other on a rolling ball). With ids 0-9 (9-ball) everything is as before (100 tracker tests).
- Practice reads 0-15. Play a rack has a Game choice on the home screen: 9-ball (0-9, as before) or 8-ball (0-15; the
  rack over when the 8 goes in and the balls are still, O.eightEnds, or when only the cue ball is left). Session and
  history keep the game. Check page needs det 6.

## V3.10.0: the coaching test (owner Nov 9)
- A third choice on the home screen, Coaching test: small runouts with the 9 always on; the player sets out any balls and
  shoots the lowest first, whatever the plan says (the plan is what is being tested). Tracker as practice (balls set out
  and moved at will), the cue ball and 1-9.
- src/v3/coach.js: the planner, three balls ahead (the ball to shoot, the next, the one after). For the next ball every
  spot (1.5 in grid) is graded as a place to shoot it from, for the pocket with the biggest, best zone: green (makeable
  with an angle, and the cue ball can be sent on to a good shot on the ball after), red (makeable, the cue ball heads away
  from the ball after: the wrong side), grey (a ball in the way, unnamed balls included), yellow (harder). The cue ball
  after contact: 5/7 of the sliding speed along the tangent line plus 2/7 of the follow or draw along the shot line;
  traced with up to two cushions, stopped at balls, a scratch ruled out. A path counts more coming into the next zone along
  its line than across it, less the further it goes, the harder the stroke and the harder the hit; spots on a cushion
  count less. The shot on the lowest ball: the pocket and stroke that bring the cue ball through the green; from the
  zone's spot nearest that path, the stroke on to the ball after and its pocket. One smoothing pass on the grades.
  On the Nov 2 rack (the 1, 2, 3): the 1 top-right, the 2 bottom side, the 3 bottom-right; the 6 blocks the upper left.
- In the app (in a background worker made from the planner's own source; about 0.25 s on a desktop): planned once per
  layout while the balls rest, all named for sure. Drawn lightly: a ring round the pocket for the ball to shoot, the next
  and the one after, each in that ball's colour (concentric when two share a pocket), the zone (green and red outlined),
  the cue ball's way into the green and the spot. Hidden during a shot and when the balls have moved since. Logged:
  coach_plan (order, pockets, zone counts, ms, balls), coach_shot (the plan's pockets, lowest ball hit first, the pocket
  the lowest ball went in, where the cue ball stopped and its grade in the zone). The shot's words add where the cue
  ball landed (in the green, at the edge, on the wrong side, behind a ball, outside the zone).
- Not yet: banks, kicks, safeties, combinations; the physics not checked against the owner's shots (the coach_shot rows
  are for that); some banding in the zone from the strokes tried at fixed steps.
- V3.10.1 (owner, Nov 9: natural straight lines, not squares; the green strongest near the next ball, lighter further
  away): the zones drawn as straight-edged shapes (coach.js shapes: the cells' connected pieces, round them the convex
  outline of their corners; the green as one shape, the piece holding the spot with those near it; red its biggest piece;
  each piece of "in the way"). The green filled with a fade from the next ball (strong near it, faint at the far end). The
  spot: the best-graded green spot (inside the zone) within 6 in of where the planned path stops; the path drawn to it.
- V3.10.2 (owner, Nov 9): no hard edge round the zone. The zone a cone fanning out from the next ball, as wide as the green
  seen from that ball (2-degree bins grown from the spot's direction, a one-bin gap allowed) and as far as its reach (95th
  percentile), from the ball's edge; the outer tenth on each side faint yellow (good, but harder to make and to get on
  from; to be set from play), the ideal line down the middle through the spot; the green strongest near the ball. The
  path into the zone scored on running along the zone's line (toward or away from the next ball) rather than across it.
  The stroke shown bottom left: a cue ball with the tip where it should meet it (a natural roll 2/5 of the radius above
  the middle, draw below; no side spin planned yet) and the power, 1-10 (4 a medium stroke, about 40 in of travel leaving
  at half the hit's speed). The plan stays on the screen during the shot and until the next one is made, at 42% (to see
  the cue ball's real path against the planned one).

## Review: Nov 8 19:32 (V3.10.2, Coaching test) and V3.11.0
- 12 minutes, 25 moves, 145 plans (the positions' jitter crossing the 1 in rounding of the plan's key: the plan flickered).
  Owner: the first plan (the 5 rolled in) made sense; the 7 (super hard, a little draw, two rails to get behind the 9) made
  no sense; after a scratch nothing; the 2 (hard, half a tip of draw to come below the 9) not playable; the straight-in 4
  with the 7 behind the cue ball gave no shot line; no side spin; the power scale off. Wants: the cue ball's real movement
  against the plan; the path as a band from cheating the pocket inside to outside, widening; a power scale test.
- The cause: the A plan used the ray model (any distance along any direction the spin allows), so it took long multi-rail
  paths with strokes nobody can play, and a one-pocket zone for B (landing for another pocket of B counted nothing).
- V3.11.0, coach.js: the stroke on A in core.js simulate (the V1 physics: tip, side, speed, throw, cushions with side
  spin): tips -0.5..0.5, power 1-10 (1.5 to 15 mph), each pocket A can go in, the aim nudged up to 1 degree where throw
  would miss; kept when A goes in, the first ball hit is A and the cue ball stays up. Value: where the cue ball stops in
  B's zone (green clearly above yellow: value^1.6; more when it rolls in along the zone's line), and for the best 12 the
  same stroke with small mistakes (aim 0.35 degrees, speed 12%, tip 0.1 either way): worth mostly that robustness; strokes
  simple first (power 5 or less, tip within 0.2 of the middle, no side unless it pays: side tried on the best three).
  Position counts for any pocket of B; B's pocket is then the one the planned stroke leaves best. A ball within 9 in behind
  the cue ball: the cue raised, no draw below 0.2, no power over 5. The best four strokes kept in the log (alts). The spot
  is where the planned stroke stops. The last ball: still a line and a stroke. Ball in hand after a scratch: the zone is
  the lowest ball's (with the next after it), the spot its best place near the ball.
- The band: the same stroke aimed from the inside to the outside of the pocket (the ball still in), its two cue-ball paths.
- App: the worker gets the physics (clamp, stepBall, cushion, simulate) and the whole table P; re-plans only when a ball
  moved over 1.2 in from the plan's layout. The stroke box shows side spin and "Tough: little room for error" (robust under
  0.3) or "Cue raised: a ball behind". After each shot (coach_compare): the angle the cue ball came off at against the plan
  (8 in past contact), the travel ratio, the stop's distance from the planned stop and the power seen (the plan's power x
  the square root of the travel ratio); short in the shot's words.
- Power test (Menu, Coaching test): the cue ball alone at the player's 2, 4, 6, 8 (three each); each roll's speed from its
  start, first direction and length in the simulation without pockets (COACH.speedFor); on the plan's scale (powerOf); a
  line through zero (ours = k x the player's), kept on the phone; the plan's power then shown in the player's numbers.
- Not yet: the simulation's cloth and cushions measured on the owner's table (the compare rows and the power test are
  the data for that).
- V3.11.1, checked against Dr. Dave (drdavepoolinfo.com, billiards.colostate.edu; reachable from this project's environment
  from Nov 9): his pool physics constants (ball-cloth sliding 0.15-0.4, typical 0.2; rolling resistance 0.005-0.015; spin
  deceleration 5-15 rad/s2; ball-ball friction 0.03-0.08, restitution 0.92-0.98; ball-rail restitution 0.6-0.9) contain
  core.js's (0.2, 4.5 in/s2 = 0.012, 12, 0.06, 0.95, 0.72): the simulation's defaults stand until measured on the owner's
  table. His typical speeds (slow 1-2 mph, medium 2-4, fast 4-7, power shot 7-10) put the old power scale too fast (power 5
  was 5.5 mph, 10 was 15): now power 1-2 slow, 3-5 medium, 6-8 fast, 9-10 a power shot (0.9 to 9.5 mph). His ten pattern
  play principles (BD Feb 2021) against the planner: keep it simple (stop or roll; avoid sidespin and multiple rails;
  banks rarely), leave the correct angle, three balls ahead, come into the line, cushions as brakes, stay off the
  cushions, corners before sides: all in the scoring; added a cost per cushion the cue ball meets after the first.

## Review: Nov 8 20:24 (V3.11.1, Coaching test) and V3.11.2
- 2.5 minutes, 5 shots, 15 plans. Owner: no dashed line, no path lines, no inside/outside band, no tip-and-power box; a
  plan came after a shot but it could not be told what it wanted.
- Cause: 2,848 errors "The provided value is non-finite" from the cone's createRadialGradient: since V3.11.0 the spot is
  where the planned stroke stops, which can be outside the green; the cone was centred on the spot's direction, found no
  green there, had no radii, and its size was not a number. The canvas threw every frame part way through the plan, so
  nothing after the cone (lines, band, spot, rings, stroke box) was drawn.
- V3.11.2: the cone centred on the green's own middle direction when the spot is outside it, and no cone without radii;
  the coaching drawing in a try (one bad number cannot take the rest off the screen; the first error logged once); finite
  checks before the gradient. Four of the 15 plans had no clean pot on the lowest ball at all (the 2 blocked by the 3 and
  the 7, the 4 blocked by the 8 with the other corner too thin): those now say "No clean pot on the N: a bank or a safety
  (not planned yet)" and put no ring on a pot that is not there. The stroke reader no longer looks for a cue ball it is
  not following (one error "stroke null ... at[0]"). Test: every layout of the session gives a stroke, ball in hand or
  "no clean pot", with a drawable cone.

## V3.12.0: always a plan, in percentages (owner, Nov 9)
- Owner: there is always a shot (kick, bank, two-rail kick, jump...), and in a match one gets left safe or hooked: show the
  highest-percentage plan first, and a low one when that is all there is; colours as percentages: green 90-100, light green
  80-90, yellow 60-80, red 50-60, darker below (the scale to be adjusted).
- The zone's value per spot is now a probability: the make (a good amateur's aim error, 0.2 degrees on the cue ball's line
  plus 0.6 degrees on the object ball, magnified by the cut, against the pocket's width seen from the ball: corner 2.8 in,
  side 2 in, narrower from a steep entry) times the leave for the ball after (0.55 to 1, from the path value), less straight
  in (0.9) and on a cushion. Bands: 1 green 90%+, 5 light green 80-90, 2 yellow 60-80, 3 red 50-60, 6 under 50, 4 in the way.
  The cone is drawn over 80%+, the yellow and red bands as shapes round it.
- The plan for A: every candidate stroke run again N times (12, the chosen one 24) with errors (aim 0.2 degrees, speed 8%,
  tip and side 0.05): its percentage to make and the mean chance of the next shot where the cue ball stops. Value of a pot
  = make x (0.6 + 0.4 next) x simplicity: a sure pot with a poor leave (0.6) beats the best safety (0.5), a 50/50 does not.
  Banks (A off one cushion: the pocket mirrored in the cushion, the hit point clear of pockets, aim nudged up to 2.1
  degrees) when the best pot is under 0.55; kicks (the cue ball off one cushion to A's ghost, or two adjacent cushions) under
  0.4; safeties (A hit full or thin either side, or off a cushion when A cannot be seen; soft; legal: A first, no scratch, a
  cushion after contact or a ball in) under 0.5, valued 0.5 x legal x (1 - the other player's best straight pot on the lowest
  ball from where the cue ball stops). The best of another kind kept as the alternative. Jump shots are not planned.
- Drawn: the kick's dashed line along the cue ball's simulated way off the cushions; the bank's object-ball path in its
  colour; no zone for a safety. The stroke box: what (pot, bank, kick 1 or 2 rails, safety), the stroke and power, the
  percentages (coloured by band), the alternative, the zone's legend. Ball in hand shows its percentages.

## Review: Nov 8 20:50 (V3.12.0, Coaching test) and V3.13.0
- 11 minutes, 27 shots, 46 plans, no errors. Owner: the zones too transparent; the cue ball's deviation not seen (wants a
  line for the thin hit, one for the thick hit, see-through white between); power 5 on a thin cut expecting the cue ball
  to stay where the object ball was; no paths into the shot line; the planned stop not in the zone (conflicting).
- Found: most planned stops outside the zone (value = make x (0.6 + 0.4 next) let a sure pot with no leave win); the "stays
  where the ball was" plans were the cue ball meeting a cushion a few inches away and dying there: core.js's cushion keeps
  the incoming topspin, so a ball off a rail slides to a stop. Real cushions (the nose above the ball's middle) turn part
  of that spin into roll the new way.
- V3.13.0: core.js cushion: P.cushionRoll (the coaching planner sets 0.6; unset elsewhere, V2 unchanged in behaviour) blends
  the spin toward roll in the new direction at each cushion. Pot value = make x (0.4 + 0.6 next); safety 0.35 x legal x
  (1 - theirs). The next shot counts more coming into the zone's line (0.75 + 0.25 along). Ball positions known to 0.3 in:
  the make is counted on the balls as seen (the player aims at the real ones), the leave on the balls moved by that much
  with the aim to the moved ghost ball (a plan that only works with exact positions, e.g. follow near straight in that
  scratches if the cut is the other way, loses its percentage). The short list favours soft-to-medium strokes and is 14
  long (10 runs each); the best three run 24 times again before one is picked (a 10-run sample flatters the lucky one).
  On the 20:50 layouts: 22 of 35 plans leave 60%+ for the next shot with the position doubt counted (V3.12 live: 22
  without it), mean make 0.84, one plan under 60%; about 0.7 s each on the desktop.
- Drawn: the zone stronger (cone up to 0.78, yellow and red bands 0.24, the ideal line brighter); the band: two clear
  lines (the thin hit and the thick hit, labelled at their ends), see-through white between; "No stroke reaches the zone
  from here" when the plan's leave is under 60%.
- Reject plan (owner, Nov 9): a button in the Coaching test while a plan shows; one tap logs coach_reject (the plan, the
  layout, a picture reject-NNN.jpg) and the next shot's row says rejected. coach_shot also keeps the planned shot's
  geometry (cut, cue ball to object ball, object ball to pocket) for the player's own percentages later.

## Review: Nov 9 20:32 (V3.13.0, 40 shots, 3 rejects) and 21:03 (power test), and V3.14.0
- 20:32 rejects. 1: the 1 was "blocked" by the 4 by a quarter inch, so the plan played a safety. 2 and 3: a pot was there
  (54%), but the safety scored higher. Owner: the thin/thick labels were backwards; "30% off plan" said nothing; the zone was
  too big and too faint; the plan's power numbers did not match the player's.
- 21:03 power test: five rolls, all "Not counted: hand move". The cause: until the rack's first real shot, the tracker's
  setupDrop takes a lone cue ball roll (nothing else moved, nothing in) for the cue ball put in place by hand. Every
  power-test roll is exactly that. The V3.11 test only covered the speed maths, not the tracker. The strokes themselves
  were seen (back swing 7.5 in, pause, follow-through). The sixth roll scratched and got "only the cue ball".
- V3.14.0, power: ptestArm sets tk.S.setup = false when the test starts and before each roll. A scratch or a moved ball
  is "roll it again". The levels are soft, medium and hard, three rolls each; each word keeps the middle of its three
  speeds (localStorage chalkline.v3.power2; the old 1-10 key is ignored). It is kept only when soft < medium < hard.
  The stroke box says soft, medium or hard, picked by the nearest of the player's speeds on a log scale. Before the test it
  uses Dr. Dave's bands: soft to 2.1 mph, medium to 4.3, hard beyond. There is a 3-step bar. Tracker test added at the end
  of track.test.js. (Note: track.test.js shares one seeded noise stream, so a test added mid-file changed the "frozen line"
  test's noise and broke it. That test is fragile to its noise; worth hardening.)
- V3.14.0, planner (coach.js):
  - A ball in the way by under 0.45 in is a tight pot: it is tried with that ball moved just clear, at 0.9 of its value, and
    the plan says "Tight past the N".
  - A safety is tried only when no pot is 40%+.
  - Thin/thick is labelled by the object ball's cut (thinner = more cut = overcut): "thin (overcut)" / "thick (undercut)".
  - zoneFan: a sector seen from the next ball at the spot's distance, centred on the spot's direction. Each side widens
    while the next shot stays within 0.2 of the spot's value (and 60%+), at least 2 degrees and 30 in all, so it leans to
    the good side. Its depth goes along the line while the value holds, from 3 to 15 in each way. The outer seventh on each
    side is yellow.
  - path.ob: the object ball's simulated path for every pot, bank and kick.
- V3.14.0, app:
  - The zone is drawn as the fan: a green gradient brightest at the spot, yellow sides, the ideal line, no outlines. The
    red and yellow hulls and the blocked shadows are no longer drawn.
  - The object ball's line goes to the pocket in its colour, with a dark edge, for every non-safety plan (ball in hand
    too).
  - Band labels sit on the outer side of each line.
  - After the shot: c.stop = {off, along, side} against the perfect spot, along the planned arrival direction. The words are
    "stopped on the spot" (4 in or less) or "N in long/short, N in to the side". The % travel words are gone.
- V3.14.1 (owner, Nov 10: things drawn on top of each other):
  - The pocket rings are gone. Each pocket gets a dot (in the ball's colour, white when shared) and a 34 px line pointing
    away from the table: corners diagonal, sides straight out, found from a point 6 in outside the pocket. The line ends in
    a disc in the ball's colour with its number.
  - Several balls on one pocket fan out 34 degrees apart, and the ends are sorted by screen x so they read left to right
    in shot order. The ends are kept inside the picture.
  - The band labels are now OC and UC.
  - Thinner lines: the cue ball's planned path 1 px, the object ball's line to the pocket 1.1 px (2.4 px dark under it),
    the zone's ideal line 0.9 px.

## Review: Nov 9 21:33 (V3.14.1, Coaching test, 12 shots) and V3.15.0
- The owner ran the power test (it worked) in a session before this one, but it never reached a debug file. The app read
  the "previous session" backup (localStorage .dbg) only when the page loaded, so a second session in the same page carried
  the one before that (21:03). V3.15: at each session start, the last session is saved and read back as previous.
- The owner moved a ball by hand during the power test and it counted as a soft roll (no log to check). V3.15 rules for
  all stroke tests:
  - A move that ends where the rolls start (the first counted roll's start; the foot spots in the spin test) is set-up.
  - A cue ball that moved under 3 in is set-up.
  - In the power test, a roll under 2 ft is "again".
  - The tracker's standing-hand rule still applies.
  - Each level keeps its median, so one bad roll does not move it.
- Coaching: "hit soft and barely come across, not near the next ball". On the 19 plans, several chose soft rolls that left
  the next shot under 50%, with a good zone 30 to 50 in away. The cause: side spin was tried only on the best three
  strokes after the rest was picked, as ±0.3; extra cushions cost 15% each; and the final check of the best three
  replaced their earlier runs, so luck picked between them.
- V3.15.0 planner:
  - Five speeds: the player's soft, medium and hard from the power test (default 1.6, 3.2 and 6 mph) and their geometric
    middles, named soft / soft to medium / medium / medium to hard / hard.
  - Tips from the draw test's hardest draw to its hardest follow (default ±0.45), at 5 levels.
  - Side spin of -2..2 tips in the main search with every speed and tip. A tip is the spin test's value (default 0.17 R).
    The best three are tried with 3 tips when they used 2.
  - The throw aim is found once per speed and side and reused for the other tips.
  - The cost of extra cushions is down to 6% each, side 4% a tip, speeds over medium 10%.
  - Cue raised (jacked): no draw, medium at most.
  - Monte Carlo runs are pooled across the screening and the final check.
  - stroke = {tip, side, tips, power 1-5, mph, speed, kind}.
  - On the 19 layouts the average of make x next went from 0.376 to 0.430; the worst plans gained most (3: 0.15 to 0.51;
    13: 0.20 to 0.42). Planning time is about 1.3x (20 s to 26 s for the 19 in node).
- V3.15.0 stroke tests (Menu, Coaching test):
  - Power: soft, medium, hard x3.
  - Spin: 1, 2, 3 tips left x soft, medium, hard from a foot spot into the short cushion. COACH.fitSpin finds the cushion
    contact, the way in and the way out, and fits the simulation's side a so the simulated turn off the cushion matches;
    tip = the median of |a|/k over rolls that turned at least 3 degrees. The way-in angle is logged (swerve).
  - Draw: soft, medium, hard draw then follow on a straight shot. COACH.fitDraw fits tip b (and the speed from how far the
    object ball went, when it stayed on the table) so the simulated cue ball stops where the real one did. The hard draw
    and the hard follow bound the plan's tips.
  - Stored in localStorage chalkline.v3.stroke {spin, draw}; power in chalkline.v3.power2. The planner gets
    {speeds, spinTip, tipRange} (coachOpts).
- Found while testing: the simulation's cushion turn with side spin levels off at about 20 degrees by a third of the
  radius, and at soft speed with 1 tip it hardly turns at all. The spin test will show how the real table differs; the
  cushion model may need work after it.

## Review: Nov 9 22:20 (V3.15.0: power, spin x2, coaching, draw tests; 66 moves) and V3.16.0
- Power test kept: soft 3.1, medium 5, hard 7.5 mph. The soft rolls spread from 1.4 to 4.1 (the median is kept).
- Spin test, run twice (18 rolls), turn off the short cushion in degrees:
  - 1 tip: 3-16;
  - 2 tips: 10-29;
  - 3 tips: 29-45.
  The same roll varied by 6-11 degrees between runs. The simulation could not pass about 22 degrees, because the
  cushion's tangential impulse was capped at 0.15(1+e)vn. core.js now takes P.railMu (default 0.15, unchanged elsewhere).
  COACH.fitSpinAll fits railMu and one tip together. On the owner's rolls: railMu 0.25, tip 0.14, mean error 5.7 degrees,
  and each run alone gives the same. The planner now defaults to railMu 0.25. An older stored spin test is refitted once in
  coachOpts.
- railBounce took the farthest point toward the cushion. A hard roll goes round the table and meets the same cushion again,
  so it now takes the first contact.
- Draw test: soft and medium were measured (both stopped dead, from 21 and 26 in away; the pictures confirm it). Both hard
  draws were thrown out, "hit one object ball": the ball was in the pocket before the next look (0.4 s), so it had no path.
  - Now the object ball is taken from the before-snapshot: the ball nearest the line through the cue ball's start, either
    way (the first seen move can already be on the way back), within 7 in.
  - The fit compares along the line only, and only on the side asked for: a follow that comes back off the cushion near the
    pocket ends where a stop shot does.
  - Speeds follow the owner's definitions: a soft draw at the medium roll, a medium draw at the hard roll, a hard draw at
    1.5x the hard roll (near break speed); follow at the roll speeds.
  - On the four shots: soft -0.28 (stop), medium -0.16 (stop), hard -0.56 (back 47 in) and -0.32 (back 36 in). The plan's
    draw limit is the most draw measured.
- Coaching (10 shots) "seemed better" (owner). One reject: the 9 frozen on the rail, read 0.3 in into the cushion
  (y 0.8 < R). No pot was found, so the plan was a kick. Now every ball is clamped onto the cloth before planning.
- Aim (owner, Nov 10: a typical Fargo 550 until the player's own data). Benchmarks found the old 0.2 degree aim gave a
  straight-in with 3 ft each way 44%, a 30-degree cut at 2.5 ft each way 45%, 45 degrees 36%: a weak player. I had told
  the owner it was near pro; that was wrong. The pure simulation's potting window for 3/3 straight-in is 0.22 degrees
  (Dr. Dave's margins agree). AIM_SD is now 0.09 degrees: 81%, 77%, 61%, and 87% for 4 ft to a ball 2 ft out at 15 degrees.
- The planner's make came out lower than that, because the first potting aim can sit at the window's edge. centre() now
  moves each top candidate's aim to the middle of its window (steps of 0.05 degrees, up to 0.8). Banks and kicks too.
- Stroke difficulty: the aim SD in the runs is multiplied by
  1 + 0.3 x |tips| + 1.2 x max(0, |tip| - 0.25) + 0.12 x max(0, speed index - 2).
- No cushion cost (railF = 1). simple() keeps a small preference: 5% past medium, 2% a tip.
- On the 19 layouts of Nov 9 21:33, make x next went from 0.38 to 0.67. Planning takes 0.4 to 3.6 s a layout in node.
- Not done yet: planner speeds stop at the player's hard roll (7.5 mph), so draw shots near break speed are not planned.
  The squirt and swerve the player allows for are not modelled beyond P.squirt.

## V3.17.0 (owner, Nov 10: no vision, shallow pockets, coaching one level up)
- Unseen pockets: at 2-3 looks a second a fast ball is gone between looks, so the tracker gives a made ball without a
  pocket (late made, inferred). guessPockets(sh) at the end of a shot and on late-made notes works one out:
  - the ball's way is its own path if it was seen moving; else the line from the cue ball's start through where the ball
    sat, when it was the first ball hit, or when the first hit is unknown and it is the only object ball made;
  - the pocket within 40 degrees of that way scores angle + distance/20; with no way known, the nearest pocket.
  It sets m.pocket and m.seen = false (kept in shotRow) and logs pocket_guess. The words say "(top-left, ⊘ not seen)".
  On Nov 9 22:20 the two unseen balls (the hard draws) both came out bottom-left, which is right.
- Shallow pockets (the owner's table: a made ball lies in view and the far pockets map it about 3 in onto the table along
  the pocket's bag line, cloth.js pocketBags):
  - A "not a ball" tap on a spot within 2.25 in of a bag line sets S.shallow[pocket] = max(-0.1, its u on the line).
  - From then on, a spot on that line with u >= shallow - 0.15 and no live track within 2.5 in is "in_pocket_seen", not a
    ball. A ball hanging in the jaws sits further forward (u about -0.4 at the top side pocket) and stays a ball.
  - The app keeps S.shallow per table size (chalkline.v3.shallow.<ft>) and passes it as O.shallow.
  - A tap anywhere else adds S.notAt (1.3 in, for the session), skipped unless a live track is within 3 in. Before, the
    tap dropped only the track and the next look made a new one (Nov 9 22:20: the 5 in the top side pocket).
- Coaching is billiard theory one level up (owner): home screen "Your level, about (Fargo)" 300-700, default 500,
  chalkline.v3.fargo. The planner gets level = Fargo + 100:
  - AIM_SD = 0.09 x 2^((550 - level)/150) degrees;
  - hard strokes cost more below 550: DIFF_K = 2^((550 - level)/300).
  The draw test no longer bounds the plan's tips (the owner: the measured draws were not their real ones); it is kept for
  the review.
- A sixth speed, "very hard" (1.5 x the hard roll), tried only with a real draw or follow (|tip| >= 0.2). The stroke box
  bar has 6 steps.
- "great position" and "good position" in the shot's words when the cue ball lands in the green or the light green.

## Review: Nov 10 22:54 (V3.17.0, Coaching test, 18 shots) and V3.18.0
- Owner: the plans went back to easy pots with long leaves, instead of shape with spin. Ideally closer, if position allows.
  The zone should be longer, to show how good it is further out and how it narrows near the ball, with the target in its
  middle. Of 46 plans, several left the cue ball 38-60 in from the next ball (fan r0 38-43). At level 600 a 4-5 ft shot is
  a ~90% make in the model, so near and far leaves looked alike.
- Zone values get a comfort factor:
  - cue to ghost distance dl: up to 30 in = 1, falling to 0.5 at 72 in; under 5 in = 0.85 (cramped);
  - the object ball's run o.dist: past 36 in, down to 0.85.
  On 9 of the session's long-leave layouts the average leave went from 45 to 35 in (the 5 then the 7: 58 to 32 in, with
  2 tips of side). Over all 33 distinct layouts: 27 to 25 in with the gentler first version.
- lineRun(c, a0, q): the zone's value every inch along a line from the next ball to the cushion; the run of good values
  holding the best one (T = max(0.6, best - 0.25), or 0.8 x best under 0.6); its middle.
- zoneFan is now rings along the good stretch of the planned leave's line (3-10 rings of about 4 in). Each ring is as wide
  as the good window at its distance (at most 30 degrees, at least 1.5 a side), with q = the next shot's value on the line.
  It returns rings, line, ideal (the middle), r0, r1, rm, qmax. out.target = ideal: the perfect spot and the after-shot
  stop words use it.
- searchA: among strokes within 5% of the best, of the same kind, stopping within 14 in of its stop, the one stopping
  nearest the middle of the good stretch, on the zone of the pocket that leave is best for. Without that last condition the
  next ball's pocket switched to a long cut down the rail (Nov 2 test).
- App: rings coloured by the owner's bands (alpha .6); the planned path ends at its own stop; coach errors log the layout
  and options (Nov 10 22:54: "undefined is not a function (near '...[A, B, C]...')" in the worker, not reproduced in node
  on any of the session's layouts).
- Not done: ball in hand with no next ball gives a spot but no stroke.
