# Chalkline

Chalkline turns an iPhone on a tripod beside a pool table into a ball and shot tracker. It runs entirely in Safari as a
single web page, `index.html`, served by GitHub Pages and added to the home screen.

## Where things are

| Path | What it is |
|---|---|
| `index.html` | The app the phone opens (V3). **Built file: never edit it by hand.** |
| `v2/index.html` | V2.3.3, kept unchanged at `/v2/` as a fallback. Also built (from `src/template.html` and `src/app.js`). |
| `recorder/index.html` | The guided test recorder (rebuild step 1): walks the player through the test sections and saves clips, sound, motion and tap answers as zips under 30 MB. Records only, no tracking. Hand-written, not built from `src/`. Opens at `/recorder/` on the same site. |
| `src/` | The source. Shared: `core.js` (maths, camera, physics, planner), `vision.js` (table finding; V2's ball finding and recognizer). V3: `v3/page.html`, `v3/app.js`, `detect.js` (ball finder and number reader), `track.js` (the tracker). V2.3.3: `template.html`, `app.js`, `recog.json`. |
| `build.py` | Joins `src/` into `index.html` (V3) and `v2/index.html`. `python3 build.py --check` fails if either is not what `src/` builds. |
| `tests/` | `v3.test.js` (V3 end to end on a fake camera made from the owner's photo, sideways and upright), `track.test.js` (the tracker on made-up looks), `detect.test.js` (finder and reader in the browser against the Python reference), `unit.test.js` (maths), `smoke.test.js` (V2.3.3 still loads and starts), `recorder.test.js` and others. |
| `tools/replay-pictures.js` | Runs the current ball finder and recognizer over every saved picture of the real sessions and scores it against the hand-checked labels. |
| `data/sessions.csv` | The real debug sessions: folder name, the name used in the design notes (real1 ...), app version, table, what was played. |
| `library/manifest.csv` | Hand-checked ball labels (2,277 spots, sessions real1-real6): picture, position, the app's guess and the true label. |
| `DESIGN NOTES.md` | The running design log: every version, what failed in real sessions, and what was decided. |
| `check/index.html` | V3 check page: the new ball finder and number reader live on the phone, with a speed test. Opens at `/check/`. |
| `src/detect.js` | V3 ball finder (detector-v1) and number reader (reader v2) running in the browser. |
| `models/`, `vendor/ort/` | The two trained models and ONNX Runtime Web, which runs them in Safari. Each has a README saying where it came from. |
| `archive/` | Set-aside work kept for reference only (ChatGPT's Fieldwork and PhotoLab experiments). Not built or tested. |

The session pictures themselves are not in this repo (they are photos of the owner's home and a pool hall, and this
repo is public). They live in the project's shared files under `chalkline-data/sessions/`, one folder per "Save debug"
zip.

## Building

Needs Python 3 with Pillow (`pip install pillow`).

    python3 build.py           # writes index.html from src/
    python3 build.py --check   # checks index.html matches src/

## Testing

Needs Node 20+ and Playwright's Chromium (`npm install`, then `npx playwright install chromium`).

    npm test                   # build check + unit tests + browser smoke test

Before every release, also run the picture replay and compare it with the previous version's numbers:

    CHALKLINE_DATA=/path/to/chalkline-data/sessions npm run replay -- --out reports/replay-<version>.json

It prints one row per session with the failure types kept apart: balls found, missed, spots on things that are not
balls, unlabelled spots, and how often the recognizer names a found ball right. The header of `tools/replay-pictures.js`
explains each column and its limits (stills only; labels exist for real1-real6 only; the recognizer was trained on
those same sessions).

## Releasing

1. Change files in `src/`, run `python3 build.py`, run the tests and the replay.
2. Bump `VERSION` in `src/app.js` and add the version's entry to `DESIGN NOTES.md`.
3. Commit `src/`, `index.html` and the notes together, with a message saying what changed and why.
