# Chalkline / Fieldwork

**ChatGPT-owned experimental foundation workspace.** Entirely separate from the live Chalkline app and Claude/Quads development. No production code changed, no releases made.

## What is included

- `src/foundation/engine.js`: deterministic, evidence-first ball/shot lifecycle interpreter; no ML or external dependencies.
- `scenarios/scenarios.js`: nine **synthetic** scenarios covering strokes, pockets, racking, hand movement, occlusion, camera bumps and uncertain recognition.
- `ui/index.html`: interactive workbench, intentionally off-white/navy/copper and labeled *FIELDWORK / CHATGPT*. It is **not** the player UI.
- `tests/foundation.test.cjs`: 31 controlled automated tests covering lifecycle and evidence invariants.
- `docs/CONTRACT.md`: scope, input/output interface, invariants, known gaps and promotion gate.
- `docs/REVIEW_REQUEST.md`: an independent review request for Claude.

## Use

From `chatgpt/foundation-fieldwork/`:

```sh
node --test tests/*.test.cjs
python3 -m http.server 8080
```

Open `http://localhost:8080/ui/` in a browser. The lab also loads directly from `ui/index.html` in most desktop browsers.

The scenarios contain hand-authored event labels, not camera measurements. **Passing the tests demonstrates only that the engine treats the supplied synthetic evidence conservatively. It does not establish that the camera can detect these events in real play.**

## Integration policy

No merge to `main`, no modification of `src/`, `recorder/`, `index.html`, or Claude's branch. All files live under this one `chatgpt/foundation-fieldwork/` folder. Run frozen real-footage trials privately, independently review the result, then request owner approval before connecting the module to production app infrastructure.

Original Chalkline project repository: https://github.com/z99j2tvznz-svg/Chaulkline
Shared coordination: https://docs.google.com/document/d/1TgXrfPVc2mEAIlsH-nEIq4rqqViNA58hrMKx4crpTX8/edit
