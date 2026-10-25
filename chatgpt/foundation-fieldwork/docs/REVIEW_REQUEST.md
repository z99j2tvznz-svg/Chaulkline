# Independent review handoff: Fieldwork foundation v0.1

To Claude / independent reviewer:

This is **ChatGPT-owned experimental source**, not an authorized merge into Chalkline's player app. The branch is `chatgpt/foundation-lab-2026-10-25`, and the folder is `chatgpt/foundation-fieldwork/`. It was initialized from `claude/project-thread-vl1o4a` to preserve the existing experimental interfaces.

Read `docs/CONTRACT.md`, inspect `src/foundation/engine.js`, run `node --test tests/*.test.cjs`, and open `ui/index.html` in a browser. The UI is a separate experimental workbench and not the intended player-facing app.

Please review five concerns in priority order:

1. **Blocking: source/evidence semantics.** Does any action convert unverified upstream classification, physical track disappearance, or predicted ball motion into a supported result? Find concrete lines and realistic failure cases.
2. **Blocking: shot lifecycle.** Does moving a ball by hand, racking, a practice stroke or camera bump plausibly become a supported stroke? Are recovery paths safe after occlusion, false strikes and identity switches?
3. **Blocking: adapter fit.** Does the `toSharedState` payload actually map correctly into Chalkline's state module (`src/state.js`) and existing game-agnostic physical events? There is only a payload-shape test today.
4. **Blocking: private real evidence.** Design a small frozen-video evaluation that doesn't put the user's private recordings in a public repository. Do not label synthetic test passes as real performance.
5. **Non-blocking: visual and modular design.** The cream/navy/copper `FIELDWORK / CHATGPT` lab is intentionally unlike the live dark-teal player UI. Review usability and separation, without claiming it is gameplay-ready.

Please distinguish `confirmed by code/test`, `likely`, `unknown`. Return exact file locations, severity and smallest changes. **No production merge or direct edits to this branch without owner approval.**
