# Fieldwork v0.1 - foundation contract

**Status:** Experimental / isolated ChatGPT development workspace.
**Date:** 2026-10-25.
**Not a vision detector. Not a production result.**

## Purpose

The foundation engine receives time-stamped, pre-classified observations from an upstream perception system, preserves the provenance of the evidence, and produces cautious shot/ball/event states. It does not identify hands, classify cue strokes, or estimate camera calibration itself. It does not call the simulator. Those capabilities must be provided by separately tested, replaceable modules.

## Input (`FoundationEngine.step(frame)`)

- `t`: strictly increasing seconds since clip/session start.
- `camera: { valid: boolean, revision: string }`: upstream table calibration validity and unique version; a change aborts any active shot as uncertain.
- `table: { moving: boolean }`: upstream measured overall ball/table motion.
- `view: { clear: boolean }`: whether camera evidence can support a complete settled-table reading.
- `player: { activity }`: `clear`, `shooting`, `practice`, `handling`, `racking`, `occluding`, `unknown`.
- `cue: { strike, evidenceRef? }`: `none`, `candidate`, or `supported`. `supported` means the upstream evidence provider has supplied supporting strike evidence. The foundation DOES NOT independently validate the strike classification. Candidate/supported require an evidence reference.
- `balls`: array of physical tracks `{ track, number, conf, x, y }` with positions in a consistent table-inch coordinate frame. Number is a **role/identity guess**, not a physical track key. `number` may be `null`.
- `pocketEntries`: optional entries `{ track, pocket, status: 'candidate' | 'supported', evidenceRef }`.
- `corrections`: optional player-confirmed identity updates `{ track, number, evidenceRef }`.

The source of any `supported` upstream claim must be independently calibrated and evaluated before production use. The engine does not reject physically implausible tracker jumps in v0.1.

## Output

- `snapshot()` returns copy-on-read `phase`, `balls`, `shots`, `events`, camera and frame metadata. Caller mutation cannot alter the engine.
- Physical tracks have `status: on | unknown | pocketed`; `number` can be null; `source: observed | inferred | confirmed`; and confidence.
- Shot records distinguish `status: supported | uncertain`, pocketed balls and unresolved pocket candidates.
- The ordered event ledger includes event type, evidence status and timestamps. The event ledger is append-only; player corrections are separate traceable events.
- `toSharedState()` provides a payload compatible in shape with Chalkline's existing `src/state.js` `makeState(...)`; this has not been wired into or run inside the live app.

## Mandatory safety invariants

1. Camera invalidation or calibration change terminates the current shot as uncertain; invalid-camera detections cannot overwrite prior physical coordinates.
2. Racking, hand relocation and practice strokes must not be counted as regular strokes when the upstream interaction classifier identifies them.
3. Strike candidate without supporting strike evidence cannot create a supported shot.
4. A ball disappearing cannot be counted as pocketed solely because it vanished. A supported pocket entry AND continued absence on a settled, clear table are required.
5. If a shot is occluded or its pocket evidence remains unresolved, its final record is uncertain.
6. Duplicate high-confidence ball numbers on distinct physical tracks are not arbitrarily assigned; the uncertain state remains visible.
7. Manual corrections are logged with their own evidence reference and override contradictory reader output, without altering the earlier event ledger.
8. No physics prediction may be injected as camera observation by this module; game rules and drills must consume, not overwrite, observed evidence.

## Known gaps - deliberate and blocking before live use

- **No actual upstream detectors:** vision model, camera mapping, player/hand/cue classification, strike evidence, tracker identity and pocket mouth evidence are simulated by the scenario package.
- **Synthetic-only 31 tests:** no benchmarks on the user's side-mounted iPhone video; no evidence that real-world upstream classifiers produce accurate labels.
- **No production integration:** existing `src/app.js`, `src/state.js`, the recorder, and Three-Ball Runout remain unchanged. The adapter shape was tested, not a full production integration.
- **No robust uncertainty propagation:** approximate confidence and missing-data rules are demonstration logic and require calibration.
- **No full 16-ball inventory, rules or game mechanics:** these belong to the next architecture gate and independent review.
- **No physical motion validation:** v0.1 trusts upstream `table.moving` and `cue.strike`, without independently checking sound/video agreement or temporal alignment.
- **No secure private footage in the public repo:** only synthetic inputs should be committed here.
- **No automatic recovery from occluded cue strike:** hidden strikes need a separate, evaluated fallback before broader tests.

## Completion / promotion gate

Before any claim of reliable real-world accuracy: run frozen, labeled clips from multiple sessions and camera positions; report supported, uncertain and confidently wrong shot and pocket states; verify no falsely invented pockets; test camera bumps, practice strokes and hands/racking. Claude or another independent reviewer must review the module-level invariants and the licensing of any reused third-party code. **Do not merge to `main` or release without explicit owner authorization.**
