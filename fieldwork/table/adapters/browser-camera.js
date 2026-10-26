/* Reversible camera-input adapter; no camera access without a direct user click. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ChalklineCameraAdapters = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  class BrowserCameraAdapter {
    constructor(mediaDevices) { this.mediaDevices = mediaDevices || globalThis.navigator?.mediaDevices; this.stream = null; }
    async open(video) {
      this.close(video);
      if (!this.mediaDevices?.getUserMedia) throw Error('Camera API unavailable. Use HTTPS Safari or upload a photo.');
      this.stream = await this.mediaDevices.getUserMedia({ audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } });
      video.srcObject = this.stream;
      try { await video.play(); } catch (e) { this.close(video); throw e; }
      return { widthPx: video.videoWidth, heightPx: video.videoHeight };
    }
    close(video) {
      if (this.stream) { for (const t of this.stream.getTracks()) t.stop(); this.stream = null; }
      if (video) { try { video.pause(); } catch (_) {} video.srcObject = null; }
    }
    capture(video, canvas, maxWidth = 1280) {
      if (!video.videoWidth || !video.videoHeight) throw Error('Camera has not delivered a frame.');
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      return { widthPx: canvas.width, heightPx: canvas.height };
    }
  }
  return Object.freeze({ BrowserCameraAdapter });
});
