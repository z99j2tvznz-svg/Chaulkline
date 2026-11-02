# Session review helpers

Used by Claude to review a debug session (folder with log.json, shotNNN-before/after.jpg, clips/). Run with Python's -I
flag (the folders are downloaded data) and from the repository root for the .js ones.

- `python3 -I mksheet.py <session> <outdir> <shots>`: contact sheets, 5 shots a page, before | after.
- `python3 -I hgrid.py <clips dir> <out.jpg> <clip name> <frames> [cols]`: frames of one clip in a grid, with times.
- `python3 -I hstrip.py <clips dir> <out.jpg> <clip,clip,...>`: six frames of each clip in a row.
- `python3 -I farrail.py <session> <out.jpg> <from> <to>`: the far rail and the near rail zoomed, per shot.
- `node names4.js <session> <outdir> '<json: wh, rot, lens, quad, crop, cols, shots>'`: the live names drawn on the
  after pictures (quad, rot, lens from log.json's header; crop in the 960 px picture).
- `node colnames.js <session> <outdir> <shot,shot,...>`: a zoomed strip with one label per ball (for tight lines).

Then: truth as `[shot start s, [made]]` (or `[[from, to], [made]]`) per real shot into a fixture
(tests/fixtures/v3/session-*.json: header, events, looks, truth), `node tools/v3/photos.js <session> <fixture> --write`,
`node tools/v3/score.js <fixture> --detail`, and `node tools/v3/stroke.js <session>` for the stroke on the clips.
