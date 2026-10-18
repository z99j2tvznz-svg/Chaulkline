# Ball label page (label-set-v1)

Source of the published labelling page: https://claude.ai/artifact/RKztt8ebgFqvunYmLjxCeF
The 185 pictures are in the project folder `chalkline-data/label-set-v1/images` (picked by `tools/pick-label-set.js`);
the page is published with them next to it. `data.json` = each picture's size and the app's own guesses (scaled to
picture pixels), never truth.

Answers are saved in the page's project store, collection `labels`, one document per picture (id = picture file name
with non-alphanumerics as `_`): `status` (not started / in progress / done), `balls` [{x, y, r, num (0 = cue, 1-9),
unknown, partial, src (proposed / added), proposedNum, checked, bulk, moved, resized, renumbered}], `removed` (app
guesses deleted as not a ball), `warningsSeen`. "Export all labels" saves the same as one JSON file with a box per ball.
A guess counts as checked only when the reviewer acts on it, or accepts the remaining guesses explicitly when finishing
the picture (`bulk: true`).
