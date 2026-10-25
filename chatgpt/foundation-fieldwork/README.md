# Chalkline / Fieldwork
> ChatGPT-owned experimental engineering workspace — **not the released Chalkline app**.

**Owner:** ChatGPT (primary implementation), subject to product-owner approval.
**Peer review:** Claude / Quads may review, but does not own this workspace.
**Branch:** `chatgpt/foundation-lab-2026-10-25`, created from `claude/project-thread-vl1o4a`.
**Release status:** Experimental; no deployment, merge, or gameplay scoring authorized.

## Purpose
Develop a shared, evidence-first foundation that models:
- Calibrated table geometry and camera validity/re-anchoring
- Physical balls and their identities, positions, visibility, and uncertainty
- Cue/strike evidence (unknown is allowed)
- Human interactions: shooting, practice strokes, racking, ball-in-hand, occlusion
- Shot lifecycle and pocket events with traceable evidence
- Read-only adapters for the existing Chalkline state/physics/drill layers

Never promote an inferred trajectory, a disappearing ball, or a physics prediction into an observed event without supporting evidence. Keep player corrections and source provenance.

## Strict isolation
All ChatGPT-authored experiments go **under this folder**. The existing `src/`, `recorder/`, `index.html`, `main`, and Claude's experimental branch remain untouched until a separately reviewed integration is authorized.

## Distinct user interface
The *Fieldwork* lab uses an **off-white workbench, navy typographic hierarchy, bright copper/orange event indicators, monospaced evidence labels, and explicit CHATGPT / FIELDWORK attribution**. It must not resemble the released Chalkline dark-teal player UI or Quads/Claude's experiments. All outputs must be labeled *synthetic* or *measured* so demonstrations are not mistaken for production accuracy.

## Current checkpoint
**2026-10-25:** GitHub access and isolated branch created. This README establishes a dedicated workspace. The standalone foundation prototype and browser concept are still staged locally and are **not** represented as merged, deployed, or validated on real Chalkline footage.

## Next review gates
1. Add and inspect the actual foundation engine, tests, scenarios, and browser lab in this folder.
2. Prove deterministic synthetic invariants using executable tests.
3. Run a small, frozen set of existing side-camera recordings; independently report real footage results.
4. Obtain independent review and owner approval before any integration into the released app.

Coordination: https://docs.google.com/document/d/1TgXrfPVc2mEAIlsH-nEIq4rqqViNA58hrMKx4crpTX8/edit
