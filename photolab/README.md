# Chalkline / Fieldwork — Photo Session Table Analyzer

**Version:** `0.1.0` (experimental, 25 October 2026)

This is a **separate Safari-targeted photo session application**, not a replacement for the published Chalkline `index.html`. It has a deliberately different **cream / navy / coral editorial field-journal UI** and an explicit five-stage workflow: **Setup → Capture → Analyze → Inspect → Export**. Nothing is uploaded by the application.

## Run it

On any HTTPS static website, serve this directory as `/photolab/` and open `https://your-website/photolab/`. For local desktop inspection, `fieldwork-standalone.html` embeds all scripts/styles and has no external dependencies. However, **the iPhone camera requires a secure context (HTTPS)**; opening an HTML file from Files may not provide camera or reliable local persistence. If camera permission is unavailable, use **Add from Camera Roll / Files**. Actual Safari/iPhone testing is still required.

**Deployment status:** The photo-session UI is served from the independent `/photolab/` GitHub Pages route. Version 0.2 is an isolated prototype, not the production Chalkline app. **GitHub branch created and code committed** to `chatgpt/fieldwork-photo-session-v01` (commit `4a31c017c34a456a1e7e941e9685e76c971eb97d`) with [draft PR #13](https://github.com/z99j2tvznz-svg/Chaulkline/pull/13) targeting the experimental `claude/project-thread-vl1o4a` branch. The production app and `main` were not modified. Initial create-branch attempt returned 403, but a later retry succeeded.

Recommended next step: independently review [draft PR #13](https://github.com/z99j2tvznz-svg/Chaulkline/pull/13), then deploy the isolated `/photolab/` page to a separate HTTPS staging location. Do not merge to `main` or resume Three-Ball Runout before real-table and device validation.

## What is implemented

- New local photo session, table-size selection (7, 8, 9 ft), saved session list using IndexedDB, deletion, ZIP import.
- Live back-camera capture using `getUserMedia` with `playsinline`; native photo picker fallback. Maximum 10; 5–10 recommended, fewer allowed for diagnostics.
- Automatic heuristic **felt surface candidate** via HSV segmentation, largest connected region, convex boundary and four-corner geometry. Independent candidate scoring for **four corner + two side pockets** from near-black image evidence; **rail positions derived from the cloth outline**; **18 expected diamond positions** with conservative bright-mark candidate search. These are candidates, **not independently validated detections**.
- Two image representations: raw **source original when available** and the downscaled JPEG that the detector actually analyzed (maximum side 1600 px). The JSON documents the normalization.
- Overlaid photo (red geometry, green image-evidence candidates, hollow unverified proposals), proposed projective top-down JPEG, per-image status and measurements.
- Manual four-corner adjustments by dragging on the review image, **tagged `manual-adjusted`**, with revert to automatic; never treated as an automatic success.
- Each image has separate `pass`, `review`, `fail` outcomes. `pass` is a **heuristic gate requiring 4/4 corner + 2/2 side pocket image evidence and sufficient cloth shape score**; not a probability that detection is correct. Diamond problems do not suppress a valid table but are reported.
- Export ZIP with per-image JPEG input, original uploaded source file bytes (where available), overlay JPEG, top-down JPEG, analysis JSON, `session_summary.json`, `debug_log.txt`, README. Supports Apple Share Sheet when browser allows file sharing, otherwise a ZIP download. ZIP import is limited to this application's own **stored/uncompressed** format and verifies CRC32.

## Evidence vs inference

All coordinates and heuristic confidence fields refer to **the analyzed JPEG pixels** (not necessarily the original file's size). Every pocket and diamond has `source: "observed_candidate"` only when there is a supporting image signal; otherwise `source: "geometric_proposal"`, `observed: false`. Rails are `inferred_from_cloth`. These signals are **not calibrated probabilities**; a dark mark does not prove a real pocket and a bright point does not prove a real diamond. The perspective view is a projective warp, not a metric 3-D reconstruction.

**Accuracy:** The v0.1 baseline had not been validated. For v0.2, five real photos from one user-provided private review bundle were used for regression checks and to correct the nose geometry. All five produced an image-supported four-rail fit, but there were no independent, manually measured ground-truth corner coordinates: **no pixel-accuracy or physical pocket-scoring accuracy claim**. Synthetic test image results must never be included in product accuracy measurements.

## ZIP layout

```
photos/capture_001.jpg                 # exact normalized JPEG fed to detector
source_originals/source_001.jpeg       # optional; exact uploaded source bytes, if supplied
analysis/capture_001.analysis.json     # status, image geometry, coordinate provenance
rectified/capture_001_topdown.jpg      # geometry proposal (if available)
overlays/capture_001_overlay.jpg       # evidence overlay (if available)
session_summary.json                   # device/browser, statuses, metadata
debug_log.txt                          # frame outcomes and runtime notes
README.txt                             # how to interpret the bundle
```

If a source was originally PNG, its raw file will have `.png`; likewise for other supported image types. Browser camera frames are captured as JPEG and have no separate original uploaded file. A failed image is still included in the ZIP.

## Build / test

There are **no external JavaScript dependencies**. The application is kept in editable source form under `js/`, and the standalone HTML is generated, not hand-maintained:

```
python3 scripts/build-standalone.py
node --test tests/unit.test.js
```

For browser smoke tests, Python Playwright and a local Chromium executable are needed:

```
python3 tests/browser.py
python3 tests/browser-negative.py
```

The smoke test uses a self-contained HTML page with `about:blank` because this evaluation browser has an administrator URL blocklist. That means these tests **do not prove HTTPS hosting, IndexedDB persistence, real Safari camera access, iOS Share Sheet behavior, or real-image recognition accuracy**. `browser-negative.py` exercises a green felt image with **no dark pockets**, verifies no pockets are falsely recorded as observed, verifies manual edits/revert, ZIP export and ZIP import.

## Limitations and next acceptance gate

1. Exercise Safari camera permissions, saved sessions across reloads, background/foreground, camera roll, and Share Sheet on a real iPhone.
2. Freeze independent hand-measured reference lines/corners on the five already supplied photos before any additional tuning. Add other lighting/table types as held-out tests.
3. Report separately: table geometry pass rate, mean corner reprojection error, independently verified corner/side pockets, precision/recall of candidate diamonds, orientation errors, and rejection rates. Break down by session/camera/lighting. No fabricated numbers.
4. Revisit existing Chalkline `src/vision.js` auto-calibration and other open-source candidates on this **same frozen footage** before deciding which detector to productionize. This prototype borrows the existing Chalkline color-segmentation *approach* but does not include OpenCV.js or an unreviewed third-party model.
5. Integrate any successful detector behind the shared physical state interface only after acceptance; don't turn geometric proposals into authoritative tracking events.

## Geometry correction — v0.2

The October 25 real five-photo review bundle demonstrated that v0.1 followed outside-rail edges and even expanded into the room on capture 001. It also marked capture 002 PASS despite wrong physical reference. v0.2 anchors the playing surface to **inner cushion-nose lines** and computes **virtual sharp intersections** where each pair of extended lines meets at the four corner pockets. These **four reference coordinates are not pocket-opening centres**. Six pockets still have separately labelled candidate locations and dark-region evidence; actual jaw-tip positions, opening centres and ball acceptance geometry remain **unknown**. The app deliberately reports **REVIEW** until real labels/physical mouth criteria are established; no synthetic/heuristic PASS assertion is accepted.

Automatic detection uses a high-chroma felt mask, robustly fits the *last dark-to-felt transition* across each of four projected edges, then intersects adjacent extended lines. Per-rail inlier counts, masks and corner provenance are exported. If any rail lacks support, the app falls back to an unverified felt outline and raises a review warning. This is a conservative heuristic prototype: coloured cushions, green cloth, severe glare, hidden rails, steep foreshortening or different table geometry may require an alternate provider. Please send a v0.2 ZIP for actual iPhone validation.

**Privacy**: User's real table photos remain local to the evaluation session and are not committed into the public GitHub repository. Visual labels and confidence scores are provisional, and none should be treated as physics scoring truth.