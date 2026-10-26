# Chalkline / Fieldwork — Photo Session Pocket Lab

**Revision: 0.4.0 · October 26, 2026 · Experimental, not production-calibrated.**

PhotoLab is an isolated iPhone Safari-friendly web tool served under `/photolab/`. It does **not** modify the site's root `index.html`, existing `src/` pool tracker, or the separate `/fieldwork/table/` Stage 01. The five-station UI is intentionally recognizable as ChatGPT's Chalkline Fieldwork, not Claude's existing interface. Photographs are stored locally in IndexedDB; nothing uploads until the user exports a review ZIP.

## What this revision adds

- A **persistent REV 0.4.0** label in the top header on desktop and mobile, checked against the actually loaded detector version. Every review overlay also carries `REV 0.4.0`. Export summary records both app and detector versions. Cache-busted assets use `?v=0.4.0`.
- New optional independent `js/pockets.js` evidence adapter. Input is `{width,height,data:RGBA}`, virtual cushion-line corners (image pixels), homography, and estimated cloth hue. Output is six pocket records (`corner_TL`, `side_top`, `corner_TR`, `corner_BR`, `side_bottom`, `corner_BL`).
- **Two independent evidence types**: (a) existing dark image region near a *predicted* pocket; (b) blue-cushion termination signals near its projected mouth. A corner needs a one-sided dark-to-cushion transition on **both adjacent rails**. A side pocket needs a dark gap **bounded by blue cushion on both sides**. Width plausibility checks reject tiny dark cores as two physical jaw tips.
- Each pocket has `mouth.status`: `paired_image_candidate`, `partial_dark_gap`, `partial_two_rail_truncation`, or `unresolved`. `jawTips` are returned only for the provisional `paired_image_candidate`. Every point is flagged `physicalJawVerified:false`, includes heuristic positional uncertainty, and records the supporting colour/dark evidence. A partial dark core is *not* presented as two jaws.
- Review overlay shows projected P1–P6 mouth locations, **cyan** diamonds for provisional jaw pairs, amber **GAP** when there is an image signal but no credible pair, and coral question marks for unresolved. Yellow lines remain the previously reviewed inner cushion-edge candidates; dashed magenta is the rejected wood/cushion seam. Virtual V1–V4 remain separate from any pocket opening.
- Existing ZIP imports are allowed but old `analysis.version` results are invalidated in the local session on open; reanalysis is required. The old analysis is retained in the local `previousAnalysis` property for comparison but is not trusted as the current result.

## What it does *not* do

- No claim of actual calibrated jaw tip coordinates, exact opening width, pocket aiming acceptance, or ball going in; `physicalPocketOutcome` remains `unknown`.
- The blue-felt/cushion heuristic is known to be table-specific. Colour changes, camouflage/lighting, hand occlusion, cloth seams, plastic rails, asymmetrical pocket jaws, and oblique viewing may defeat it. It is replaceable; failures are expected to be measurable. In particular a small dark core in a visible opening can **underestimate its true jaw-to-jaw width**; a narrow core is deliberately flagged partial.
- The 18 rail-diamond locations are only **proposals** for a future coaching calibration stage. Bright spots are not automatically official diamond detections. Later mapping should store orientation, rail side, numbering, physically observed center and uncertainty for one/two/three/four-rail kicking and banking systems. Do not use the current provisional markers for coaching instructions.
- No ball detection, identity, live tracking, drill judging, or shared authoritative state integration.

## Actual executed checks

Run unit tests with `node --test photolab/tests/unit.test.js` and the synthetic smoke workflow with `python3 photolab/tests/browser.py` (requires local Chromium + Playwright). The separate negative workflow runs with `python3 photolab/tests/browser-negative.py`. Build a standalone offline test file by running `python3 photolab/scripts/build-standalone.py`.

Five **owner-supplied real photos** (captures 001–005, 1600×900) were replayed against this code. All five produced geometries and image signals without browser JS errors. Each result is **REVIEW**, never PASS. **There is no independent, manually labelled pocket/jaw dataset**, so do not translate the number of detected candidates into accuracy claims. The real photos and ZIP remain private in the owner's conversation; **never commit the owner’s room or table images to this public repository.**

## Next gate and architecture

Before treating a mouth/jaw as calibrated, collect short manual jaw-end labels for the existing five photos, measure reprojection and pixel errors *by corner/side pocket and camera angle*, and add click-to-adjust/confirm jaw markers. Check the corrected geometry on a different pool table and under poor hall lighting.

Once table/rails/pockets/jaws are verified, **next stage is ball center localization in table coordinates**, with separate uncertain identity and visibility/occlusion, then robust shot state and actual pocket/rail events from before-and-after evidence. Keep one authoritative table/shot state and a replaceable vision adapter; physics predictions must not become authoritative events. Coordinate with the existing `/fieldwork/table/` stage before any integration.