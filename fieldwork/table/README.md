# Chalkline Fieldwork — Stage 01: Table geometry

**Experimental, isolated, ChatGPT-owned module.** This is the first *real-data* module, not the existing synthetic state-machine demo or a playable tracker.

## What it does

1. User opens Safari on HTTPS and starts the camera, or loads a local still photograph.
2. A real frame is frozen locally. User taps the **four inside playing-surface corners**, clockwise from top left.
3. Dependency-free geometry code validates the four points, source dimensions, table-size preset (7, 8, or 9 feet), and revision.
4. An interchangeable **OpenCV.js 4.10.0** adapter computes a planar perspective transform and displays a rectified view.
5. Export calibration JSON with corner observations, normalized coordinates, table dimensions in inches, revision, image-to-output homography, and provider metadata.

**Not implemented:** Automatic rail/corner detection, balls, cue stick, hands, player pose, shots, scoring, camera movement recovery, real-accuracy benchmarks. A perspective image is only a table-plane projection: the elevated surfaces of balls will not align perfectly with the felt plane.

## Architecture / swapping components

- `core/table-geometry.js`: canonical `createCalibration()` / `checkCorners()` / `projectPoint()`; **zero external dependencies**.
- `adapters/browser-camera.js`: `open(video)`, `capture(video,canvas)`, `close(video)`; replace for uploaded video/recorder.
- `adapters/opencv-perspective.js`: `ready()` and `rectify(sourceCanvas,calibration,outputCanvas)`; replace with alternative rectification backend without rewriting the UI/core.
- `app.js`: thin browser orchestration; no drill or physics logic.
- `tests/`: Node-based pure contract and fake-OpenCV tests; no browser/camera fixtures.

**Adapter contract**: rectification returns `{ provider, widthPx, heightPx, homography:[9 numbers] }`, with homography mapping source-image pixels to the rectified image pixels. In a later approved integration, a downstream ball or physics module should consume only exported calibration data—not OpenCV or camera internals. Calibration `revision` increments when manually recalibrated.

## Source and license

OpenCV.js 4.10.0 is requested at runtime from `https://docs.opencv.org/4.10.0/opencv.js` (version-pinned **upstream** official binary, not copied into this repo); OpenCV 4.5+ is Apache License 2.0: https://opencv.org/license/. The app should preserve notices/attribution when bundling or distributing OpenCV. No camera frames are sent to a Chalkline backend. Loading the OpenCV script itself requires network access to the upstream documentation host; this is a documented limitation, not offline-ready deployment.

No BilliardsTrainer code has been copied in this stage. Its runtime is Python and its licensing/dependency chain must be separately checked before integrating it into a distributed Safari product.

## Run

From this folder: `npm test`. Serve the repository root over localhost (e.g. `python3 -m http.server 8080`) and open `/fieldwork/table/`. On the GitHub Pages site, this route works over HTTPS. Video capture requires user permission. The user can choose **Load photo** if no camera is available.

## Promotion gate

- Browser iPhone test for permission, freeze, four-tap calibration, OpenCV load and perspective view.
- Test across different camera positions/lighting conditions and 7/9-foot geometry.
- Verify corner alignment with annotated footage and establish quantitative calibration error.
- Confirm commercial license obligations before bundling dependencies.
- **Do not connect ball detection or merge this into a production tracking pipeline without product-owner approval.**
