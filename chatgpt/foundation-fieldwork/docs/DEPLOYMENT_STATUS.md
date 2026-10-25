# Fieldwork v0.1 — GitHub delivery status (2026-10-25)

## Isolated GitHub workspace
- Repository: `z99j2tvznz-svg/Chaulkline`.
- Branch: `chatgpt/foundation-lab-2026-10-25`, originally branched from `claude/project-thread-vl1o4a`.
- Root: `chatgpt/foundation-fieldwork/` only.
- Files included: README.md; package.json; src/foundation/engine.js; scenarios/scenarios.js; tests/foundation.test.cjs; ui/index.html; docs/CONTRACT.md; docs/REVIEW_REQUEST.md; docs/DEPLOYMENT_STATUS.md.
- No merge into `main`, no deployment, and no changes to Claude's experimental branch or the released player app.
- These files are an isolated experiment, not production recognition code.

## Tested evidence
- Locally executed `node --test tests/*.test.cjs`: **31/31 passing** on October 25, 2026.
- Tests drive nine human-authored **synthetic** scenarios into a deterministic interpreter.
- Tests show that the interpreter treats supplied evidence conservatively; they do **not** prove that a real camera can classify strokes, players, hands, balls, or pockets.
- Real iPhone recordings: **not evaluated**.
- Full browser interaction and responsive QA: **not verified** for this delivery; the HTML and inline script were syntax checked.

## Foundation scope
The module consumes pre-classified events with camera validity, physical ball-track identity, human activity and cue/strike evidence. It distinguishes supported, candidate, uncertain, and unknown evidence; keeps pocket decisions from being established by disappearance alone; and emits a per-shot event history. There is no integrated vision detector, player pose system, training model, or production rule engine in this branch.

## Gate before integration
Independent code review, frozen representative video benchmarks, interface validation against existing Chalkline `src/state.js`, and explicit owner approval are required. Until then, do not merge, deploy, or count synthetic tests as tracking accuracy.

Coordination: https://docs.google.com/document/d/1TgXrfPVc2mEAIlsH-nEIq4rqqViNA58hrMKx4crpTX8/edit
