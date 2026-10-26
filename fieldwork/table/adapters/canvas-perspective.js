/* Chalkline Fieldwork — dependency-free Canvas 2D perspective backup.
 * Uses standard browser Canvas APIs. Does not replace the optional OpenCV.js
 * provider; both implement ready() and rectify(), return the same contract.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChalklineCanvasPerspectiveAdapters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ID = 'canvas2d-perspective@1';

  // Solve the eight projective coefficients mapping four observed points to
  // a rectangle. Pivoting detects unstable/repeated or nearly collinear input.
  function homography(points, width, height) {
    if (!Array.isArray(points) || points.length !== 4 || !points.every(p =>
      Number.isFinite(p?.x) && Number.isFinite(p?.y))) throw Error('Four valid corners are required.');
    const dest = [[0, 0], [width, 0], [width, height], [0, height]];
    const rows = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = points[i], [u, v] = dest[i];
      rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
      rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }
    for (let k = 0; k < 8; k++) {
      let pivot = k;
      for (let j = k + 1; j < 8; j++) if (Math.abs(rows[j][k]) > Math.abs(rows[pivot][k])) pivot = j;
      if (Math.abs(rows[pivot][k]) < 1e-10) throw Error('The four corners cannot form a stable perspective transform.');
      [rows[k], rows[pivot]] = [rows[pivot], rows[k]];
      const value = rows[k][k];
      for (let j = k; j < 9; j++) rows[k][j] /= value;
      for (let i = 0; i < 8; i++) {
        if (i === k) continue;
        const f = rows[i][k];
        for (let j = k; j < 9; j++) rows[i][j] -= f * rows[k][j];
      }
    }
    const h = rows.map(row => row[8]);
    h.push(1);
    if (!h.every(Number.isFinite)) throw Error('Perspective transform is not finite.');
    return h;
  }

  function invert3(m) {
    const [a,b,c,d,e,f,g,h,i] = m;
    const A=e*i-f*h, B=c*h-b*i, C=b*f-c*e;
    const D=f*g-d*i, E=a*i-c*g, F=c*d-a*f;
    const G=d*h-e*g, H=b*g-a*h, I=a*e-b*d;
    const det=a*A+b*D+c*G;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12) throw Error('Perspective inverse is singular.');
    return [A,B,C,D,E,F,G,H,I].map(v => v/det);
  }

  class CanvasPerspectiveAdapter {
    constructor() { this.id = ID; this.license = 'Chalkline custom fallback (no third-party runtime)'; }
    async ready() { return this; }
    rectify(sourceCanvas, calibration, outputCanvas, outputWidth = 960) {
      if (!calibration || calibration.cornersPx?.length !== 4) throw Error('Validated table calibration is required.');
      if (!Number.isInteger(outputWidth) || outputWidth < 100 || outputWidth > 2400) throw Error('Invalid output width.');
      if (!sourceCanvas || !outputCanvas || !Number.isInteger(sourceCanvas.width) ||
          !Number.isInteger(sourceCanvas.height) || sourceCanvas.width < 2 || sourceCanvas.height < 2)
        throw Error('A source canvas containing an image is required.');
      const ratio = calibration.table.playingHeightIn / calibration.table.playingWidthIn;
      if (!(ratio > 0 && Number.isFinite(ratio))) throw Error('Invalid playing-surface dimensions.');
      const outputHeight = Math.max(1, Math.round(outputWidth * ratio));
      const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
      const srcPixels = srcCtx?.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
      if (!srcPixels) throw Error('Could not read the captured image.');
      const h = homography(calibration.cornersPx, outputWidth, outputHeight);
      const inv = invert3(h);
      outputCanvas.width = outputWidth;
      outputCanvas.height = outputHeight;
      const dstCtx = outputCanvas.getContext('2d');
      if (!dstCtx) throw Error('Canvas output is not available.');
      const dstPixels = dstCtx.createImageData(outputWidth, outputHeight);
      const s = srcPixels.data, d = dstPixels.data, sw = sourceCanvas.width, sh = sourceCanvas.height;
      for (let yy = 0; yy < outputHeight; yy++) {
        for (let xx = 0; xx < outputWidth; xx++) {
          const u = xx + 0.5, v = yy + 0.5;
          const den = inv[6] * u + inv[7] * v + inv[8];
          if (!Number.isFinite(den) || Math.abs(den) < 1e-12) continue;
          // Pixel centers are at 0.5 in the projective coordinate system.
          const sx = (inv[0] * u + inv[1] * v + inv[2]) / den - 0.5;
          const sy = (inv[3] * u + inv[4] * v + inv[5]) / den - 0.5;
          if (!Number.isFinite(sx) || !Number.isFinite(sy) ||
              sx < -0.5 || sx > sw - 0.5 || sy < -0.5 || sy > sh - 0.5) continue;
          const cx = Math.min(sw - 1, Math.max(0, sx));
          const cy = Math.min(sh - 1, Math.max(0, sy));
          const x0 = Math.floor(cx), y0 = Math.floor(cy);
          const x1 = Math.min(sw - 1, x0 + 1), y1 = Math.min(sh - 1, y0 + 1);
          const fx = cx - x0, fy = cy - y0;
          const a = (y0 * sw + x0) * 4, b = (y0 * sw + x1) * 4;
          const c = (y1 * sw + x0) * 4, e = (y1 * sw + x1) * 4;
          const dst = (yy * outputWidth + xx) * 4;
          for (let channel = 0; channel < 4; channel++) {
            const top = s[a + channel] + fx * (s[b + channel] - s[a + channel]);
            const bottom = s[c + channel] + fx * (s[e + channel] - s[c + channel]);
            d[dst + channel] = top + fy * (bottom - top);
          }
        }
      }
      dstCtx.putImageData(dstPixels, 0, 0);
      return { provider: ID, widthPx: outputWidth, heightPx: outputHeight, homography: h };
    }
  }
  return Object.freeze({ ID, CanvasPerspectiveAdapter, homography, invert3 });
});
