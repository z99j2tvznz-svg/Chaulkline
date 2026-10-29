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
