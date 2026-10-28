// ---------- V3: what the picture says about a spot (bare cloth; a ball lying in a pocket) ----------
// Uses rgb2hsv and isCloth from src/vision.js (loaded before this file in the page; required at the bottom in Node).
// V3: is a ball's spot bare cloth? Samples a disc of 0.7 ball radii around the spot (picture px, k = picture scale) and
// counts the cloth-coloured pixels: true if nearly all are cloth (no ball, no arm, no cue there), false if most are not,
// null in between. A pocket mouth is never cloth, so a ball there is never cleared this way.
function bareCloth(img, px, py, rpx, cl) {
  if (!cl) return null; const r = Math.max(2, rpx * 0.7), st = Math.max(1, r / 4); let n = 0, c = 0;
  for (let dy = -r; dy <= r; dy += st) for (let dx = -r; dx <= r; dx += st) {
    if (dx * dx + dy * dy > r * r) continue; const x = Math.round(px + dx), y = Math.round(py + dy);
    if (x < 0 || y < 0 || x >= img.width || y >= img.height) return false; // off the picture: cannot tell, so not bare
    const o = (y * img.width + x) * 4, [h, s2, v] = rgb2hsv(img.data[o], img.data[o + 1], img.data[o + 2]); n++; if (isCloth(h, s2, v, cl)) c++;
  }
  if (!n) return null; const f = c / n; return f >= 0.8 ? true : f <= 0.5 ? false : null; // a cushion shadow or a chalk mark can take a few pixels
}

// V3: where a ball lying in a pocket shows up. The camera sees down into the far pockets; a ball there, 1 to 4 in below
// the cloth, is found by the ball finder (weakly, part of it hidden by the rim) and maps onto the table 4 to 10 in in
// front of the pocket (Oct 27: the 7 in the far right corner came out at 76, 33 and looked like it rolled back out).
// One line per pocket, in table inches, from a ball 0.5 in down to 4 in down; only the pockets whose line lands on the cloth.
function pocketBags(cam, P) {
  const out = [];
  P.pockets.forEach((pk, i) => {
    const a = cam.proj(pk.x, pk.y, -0.5), b = cam.proj(pk.x, pk.y, -4); if (!a || !b) return;
    const ua = cam.unproj(a[0], a[1], P.R), ub = cam.unproj(b[0], b[1], P.R);
    if (ub[0] < 0 || ub[1] < 0 || ub[0] > P.L || ub[1] > P.W) return;
    out.push({ i, ax: ua[0], ay: ua[1], bx: ub[0], by: ub[1] });
  });
  return out;
}

if (typeof module !== 'undefined') { var { rgb2hsv, isCloth } = require('../vision.js'); module.exports = { bareCloth, pocketBags }; }
