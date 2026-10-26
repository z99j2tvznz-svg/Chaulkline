/* Fieldwork / Stage 01 — thin UI controller. No ball detection or scoring. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const G = globalThis.ChalklineTableGeometry;
  const cam = new globalThis.ChalklineCameraAdapters.BrowserCameraAdapter();
  const cv = new globalThis.ChalklinePerspectiveAdapters.OpenCVPerspectiveAdapter();
  const video = $('camera'), src = $('source'), overlay = $('overlay'), out = $('output');
  const points = [];
  let sourceType = null, cvReady = false, rev = 0, result = null, currentCal = null, calibrating = false;
  const setStatus = (id, text, cls = '') => { const e = $(id); e.textContent = text; e.className = 'status' + (cls ? ' ' + cls : ''); };
  const setVisible = (el, visible) => { el.hidden = !visible; };
  const updateCorners = () => {
    Array.from($('cornerbar').children).forEach((e, i) => {
      e.classList.toggle('done', i < points.length);
      e.classList.toggle('next', i === points.length);
    });
    $('metric-points').textContent = `${points.length} / 4`;
    $('undo-corner').disabled = points.length === 0;
    $('rectify').disabled = !cvReady || points.length !== 4 || !src.width || calibrating;
  };
  const drawOverlay = () => {
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!points.length) return;
    ctx.lineWidth = Math.max(2.5, src.width / 350);
    ctx.strokeStyle = '#f27c42';
    ctx.beginPath(); points.forEach((p, i) => { if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    if (points.length === 4) ctx.closePath(); ctx.stroke();
    points.forEach((p, i) => {
      ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(11, src.width / 110), 0, Math.PI * 2);
      ctx.fillStyle = '#dd6c3b'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = 'white'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `bold ${Math.max(12, src.width / 95)}px monospace`; ctx.fillText(i + 1, p.x, p.y);
    });
  };
  function invalidated() {
    points.length = 0; currentCal = null; result = null;
    setVisible(out, false); setVisible($('output-empty'), true);
    $('download').disabled = true; $('output-caption').textContent = 'OUTPUT: NO PERSPECTIVE TRANSFORM YET.';
    setStatus('cal-status', 'Tap top-left, top-right, bottom-right, bottom-left INSIDE the rails.', 'warn');
    drawOverlay(); updateCorners();
  }
  function freezeFrame(width, height, source) {
    if (!width || !height) throw Error('Unable to obtain image dimensions.');
    sourceType = source;
    $('stage').style.minHeight = '0';
    overlay.width = src.width; overlay.height = src.height;
    setVisible(video, false); setVisible(src, true); setVisible(overlay, true); setVisible($('stage-prompt'), false);
    cam.close(video);
    invalidated();
    $('metric-image').textContent = `${width} × ${height}`;
    $('capture-caption').textContent = `FROZEN ${source.toUpperCase()} FRAME / ${width} × ${height} PX / LOCAL ONLY`;
    setStatus('camera-status', 'Frame ready. Tap the inside playing-surface corners in the numbered order.', 'good');
    $('freeze').disabled = true;
  }
  $('start-camera').addEventListener('click', async () => {
    try {
      setStatus('camera-status', 'Requesting access to the rear camera...');
      $('start-camera').disabled = true;
      setVisible(src, false); setVisible(overlay, false); setVisible($('stage-prompt'), false);
      setVisible(video, true);
      await cam.open(video);
      $('freeze').disabled = false;
      setStatus('camera-status', 'Live camera active. Aim toward the table, then choose Freeze frame.', 'good');
    } catch (e) {
      setVisible($('stage-prompt'), true);
      setStatus('camera-status', `${e.message}. You can also load a photo.`, 'error');
    } finally { $('start-camera').disabled = false; }
  });
  $('freeze').addEventListener('click', () => {
    try {
      cam.capture(video, src);
      freezeFrame(src.width, src.height, 'camera');
    } catch (e) { setStatus('camera-status', e.message, 'error'); }
  });
  $('photo').addEventListener('click', () => $('photo-input').click());
  $('photo-input').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, 1280 / image.naturalWidth);
        src.width = Math.max(1, Math.round(image.naturalWidth * scale));
        src.height = Math.max(1, Math.round(image.naturalHeight * scale));
        src.getContext('2d').drawImage(image, 0, 0, src.width, src.height);
        freezeFrame(src.width, src.height, 'image');
      } catch (err) { setStatus('camera-status', err.message, 'error'); }
      URL.revokeObjectURL(url);
      e.target.value = '';
    };
    image.onerror = () => { URL.revokeObjectURL(url); setStatus('camera-status', 'Cannot decode image. Try JPG or PNG.', 'error'); };
    image.src = url;
  });
  const addCorner = e => {
    if (overlay.hidden || points.length >= 4) return;
    const r = overlay.getBoundingClientRect();
    const x = Math.min(src.width, Math.max(0, (e.clientX - r.left) * overlay.width / r.width));
    const y = Math.min(src.height, Math.max(0, (e.clientY - r.top) * overlay.height / r.height));
    points.push({ x, y });
    currentCal = null; result = null; $('download').disabled = true;
    setVisible(out, false); setVisible($('output-empty'), true);
    drawOverlay(); updateCorners();
    if (points.length === 4) {
      try {
        currentCal = G.createCalibration({ points, imageWidth: src.width, imageHeight: src.height,
          table: $('table-size').value, revision: ++rev, sourceType });
        $('metric-rev').textContent = String(currentCal.revision);
        setStatus('cal-status', 'Four valid corners recorded. Load OpenCV if needed and choose Rectify table.', 'good');
      } catch (err) {
        points.pop(); drawOverlay(); updateCorners();
        setStatus('cal-status', err.message, 'error');
      }
    } else setStatus('cal-status', `Corner ${points.length} saved. Tap ${G.CORNER_LABELS[points.length]} next.`);
  };
  overlay.addEventListener('pointerdown', addCorner);
  overlay.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') e.preventDefault(); });
  $('undo-corner').addEventListener('click', () => {
    points.pop(); currentCal = null; result = null; drawOverlay(); updateCorners();
    $('download').disabled = true; setVisible(out, false); setVisible($('output-empty'), true);
    setStatus('cal-status', `Tap ${G.CORNER_LABELS[points.length]} next.`);
  });
  $('table-size').addEventListener('change', () => {
    if (points.length !== 4) return;
    try {
      currentCal = G.createCalibration({ points, imageWidth: src.width, imageHeight: src.height,
        table: $('table-size').value, revision: ++rev, sourceType });
      $('metric-rev').textContent = String(currentCal.revision);
      result = null; $('download').disabled = true; setVisible(out, false); setVisible($('output-empty'), true);
      setStatus('cal-status', 'Table-size selection changed. Rectify again.', 'warn');
    } catch (e) { setStatus('cal-status', e.message, 'error'); }
  });
  $('load-cv').addEventListener('click', async () => {
    if (cvReady) return;
    $('load-cv').disabled = true;
    setStatus('cv-status', 'Loading official OpenCV.js 4.10.0 (first load may be large)...');
    try {
      await cv.ready(); cvReady = true;
      $('metric-cv').textContent = 'OPENCV 4.10';
      setStatus('cv-status', 'OpenCV.js is initialized. Rectification is available.', 'good');
    } catch (e) {
      setStatus('cv-status', e.message, 'error');
      $('load-cv').disabled = false;
    }
    updateCorners();
  });
  $('rectify').addEventListener('click', () => {
    if (!currentCal || !cvReady) return;
    try {
      calibrating = true; updateCorners();
      const projection = cv.rectify(src, currentCal, out);
      result = G.withProjection(currentCal, projection);
      setVisible(out, true); setVisible($('output-empty'), false);
      $('download').disabled = false;
      $('output-caption').textContent = `OPENCV.JS / ${projection.widthPx} × ${projection.heightPx} / MANUAL CORNERS / REV ${currentCal.revision}`;
      setStatus('cal-status', 'Perspective transform complete. Inspect rail alignment and export the calibration record.', 'good');
      $('output-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { setStatus('cal-status', `OpenCV rectification failed: ${e.message}`, 'error'); }
    finally { calibrating = false; updateCorners(); }
  });
  $('download').addEventListener('click', () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `chalkline-table-calibration-r${result.revision}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  });
  window.addEventListener('pagehide', () => cam.close(video));
  updateCorners();
})();
