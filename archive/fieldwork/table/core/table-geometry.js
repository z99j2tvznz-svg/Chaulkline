/* Chalkline Fieldwork — neutral table-calibration contract (no CV dependency).
 * Copyright 2026. No external data is accessed by this module.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChalklineTableGeometry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  const CORNER_LABELS = Object.freeze(['Top left', 'Top right', 'Bottom right', 'Bottom left']);
  const TABLES = Object.freeze({
    '7ft': Object.freeze({ name: '7-foot', widthIn: 78, heightIn: 39 }),
    '8ft': Object.freeze({ name: '8-foot', widthIn: 88, heightIn: 44 }),
    '9ft': Object.freeze({ name: '9-foot', widthIn: 100, heightIn: 50 })
  });
  const finite = n => typeof n === 'number' && Number.isFinite(n);
  const cross = (a, b, c) => (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const area = pts => Math.abs(pts.reduce((s, p, i) => s + p.x * pts[(i + 1) % 4].y - p.y * pts[(i + 1) % 4].x, 0) / 2);

  function checkCorners(points, width, height) {
    if (!finite(width) || !finite(height) || width <= 0 || height <= 0) throw Error('A valid source-image width and height are required.');
    if (!Array.isArray(points) || points.length !== 4) throw Error('Mark all four corners in order: top-left, top-right, bottom-right, bottom-left.');
    for (const p of points) {
      if (!p || !finite(p.x) || !finite(p.y) || p.x < 0 || p.y < 0 || p.x > width || p.y > height)
        throw Error('Every corner must be inside the captured image.');
    }
    const minSeparation = Math.max(5, Math.min(width, height) * 0.025);
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++)
      if (distance(points[i], points[j]) < minSeparation) throw Error('Corners are too close together. Select four distinct rail intersections.');
    const turns = points.map((p, i) => cross(p, points[(i + 1) % 4], points[(i + 2) % 4]));
    if (turns.some(t => t <= 0)) throw Error('The four corners must follow the table perimeter clockwise without crossing.');
    const coverage = area(points) / (width * height);
    if (coverage < 0.012) throw Error('The chosen table occupies too little of the image; move closer or correct the corner order.');
    return { coverage: +coverage.toFixed(5), signedClockwise: true };
  }

  function createCalibration({ points, imageWidth, imageHeight, table = '7ft', revision = 1, sourceType = 'camera' }) {
    if (!TABLES[table]) throw Error('Table size must be 7ft, 8ft, or 9ft.');
    if (!Number.isSafeInteger(revision) || revision < 1) throw Error('Revision must be a positive integer.');
    if (!['camera', 'image'].includes(sourceType)) throw Error('Unsupported frame source.');
    const quality = checkCorners(points, imageWidth, imageHeight);
    const corners = points.map(p => ({ x: +p.x.toFixed(3), y: +p.y.toFixed(3) }));
    return {
      schema: 'chalkline.table-calibration', version: VERSION, provider: 'manual-corners',
      revision, sourceType,
      source: { widthPx: imageWidth, heightPx: imageHeight },
      table: { preset: table, playingWidthIn: TABLES[table].widthIn, playingHeightIn: TABLES[table].heightIn },
      cornersPx: corners,
      cornersNormalized: corners.map(p => ({ x: +(p.x / imageWidth).toFixed(7), y: +(p.y / imageHeight).toFixed(7) })),
      interpretation: '2D playing-surface corners manually selected; not camera pose, ball positions, or a physics calibration',
      verification: { mode: 'manual', areaFraction: quality.coverage, videoValidated: false }
    };
  }
  function withProjection(calibration, projection) {
    if (!projection || !Array.isArray(projection.homography) || projection.homography.length !== 9 ||
      !projection.homography.every(finite) || !finite(projection.widthPx) || !finite(projection.heightPx)) throw Error('Invalid projection output.');
    return {
      ...calibration,
      perspective: {
        provider: projection.provider, widthPx: projection.widthPx, heightPx: projection.heightPx,
        homographyImageToOutput: projection.homography.slice(),
        units: 'rectified-image-pixels',
        verifiedOnRealFootage: false
      }
    };
  }
  function projectPoint(h, point) {
    if (!Array.isArray(h) || h.length !== 9 || !h.every(finite)) throw Error('Invalid homography.');
    if (!point || !finite(point.x) || !finite(point.y)) throw Error('Invalid point.');
    const d = h[6] * point.x + h[7] * point.y + h[8];
    if (Math.abs(d) < 1e-9) throw Error('Homography denominator is zero.');
    return { x: (h[0] * point.x + h[1] * point.y + h[2]) / d,
      y: (h[3] * point.x + h[4] * point.y + h[5]) / d };
  }
  return Object.freeze({ VERSION, TABLES, CORNER_LABELS, checkCorners, createCalibration, withProjection, projectPoint });
});
