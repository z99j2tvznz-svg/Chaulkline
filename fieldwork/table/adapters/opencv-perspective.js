/* Optional open-source dependency boundary. OpenCV.js 4.10.0 is Apache-2.0.
 * https://opencv.org/license/ ; https://docs.opencv.org/4.10.0/opencv.js
 * The adapter is replaced by implementing ready() and rectify().
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChalklinePerspectiveAdapters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const OPENCV_JS_URL = 'https://docs.opencv.org/4.10.0/opencv.js';
  const ID = 'opencv-js-perspective@4.10.0';
  class OpenCVPerspectiveAdapter {
    constructor(options = {}) {
      this.id = ID;
      this.license = 'Apache-2.0';
      this.cv = options.cv || null;
      this.url = options.url || OPENCV_JS_URL;
      this._loading = null;
    }
    async ready() {
      if (this.cv && typeof this.cv.getPerspectiveTransform === 'function') return this.cv;
      if (this._loading) return this._loading;
      if (typeof document === 'undefined') throw Error('Load OpenCV.js in a browser or inject a test implementation.');
      this._loading = new Promise((resolve, reject) => {
        let finished = false;
        const script = document.createElement('script');
        const fail = reason => { if (!finished) { finished = true; clearTimeout(timer); clearInterval(check); this._loading = null; script.remove(); reject(new Error(reason)); } };
        const check = setInterval(async () => {
          try {
            let cv = globalThis.cv;
            if (cv && typeof cv.then === 'function') cv = await cv;
            if (cv && typeof cv.Mat === 'function' && typeof cv.getPerspectiveTransform === 'function' && typeof cv.warpPerspective === 'function') {
              if (!finished) { finished = true; clearTimeout(timer); clearInterval(check); this.cv = cv; resolve(cv); }
            }
          } catch (e) { /* runtime may still initialize */ }
        }, 100);
        const timer = setTimeout(() => fail('OpenCV.js was unavailable after 12 seconds. You can use the local Canvas backend instead.'), 12000);
        script.src = this.url;
        script.async = true;
        script.onerror = () => fail('Unable to download OpenCV.js from the external host.');
        document.head.appendChild(script);
      });
      return this._loading;
    }
    rectify(sourceCanvas, calibration, outputCanvas, outputWidth = 960) {
      const cv = this.cv;
      if (!cv || !cv.Mat || !cv.getPerspectiveTransform) throw Error('OpenCV is not initialized.');
      if (!calibration || calibration.cornersPx?.length !== 4) throw Error('Validated table calibration is required.');
      if (!Number.isInteger(outputWidth) || outputWidth < 100 || outputWidth > 2400) throw Error('Invalid output width.');
      const outHeight = Math.round(outputWidth * calibration.table.playingHeightIn / calibration.table.playingWidthIn);
      const corners = calibration.cornersPx;
      let src, dst, from, to, h;
      try {
        src = cv.imread(sourceCanvas);
        dst = new cv.Mat();
        from = cv.matFromArray(4, 1, cv.CV_32FC2, corners.flatMap(p => [p.x, p.y]));
        to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outputWidth, 0, outputWidth, outHeight, 0, outHeight]);
        h = cv.getPerspectiveTransform(from, to);
        cv.warpPerspective(src, dst, h, new cv.Size(outputWidth, outHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        outputCanvas.width = outputWidth;
        outputCanvas.height = outHeight;
        cv.imshow(outputCanvas, dst);
        const data = h.data64F?.length === 9 ? h.data64F : h.data32F;
        if (!data || data.length !== 9) throw Error('OpenCV returned an unsupported homography matrix.');
        return { provider: this.id, widthPx: outputWidth, heightPx: outHeight, homography: Array.from(data) };
      } finally {
        for (const m of [h, to, from, dst, src]) if (m && typeof m.delete === 'function') m.delete();
      }
    }
  }
  return Object.freeze({ OPENCV_JS_URL, ID, OpenCVPerspectiveAdapter });
});
