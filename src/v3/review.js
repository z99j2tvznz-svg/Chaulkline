// Session review (V3.2, owner Nov 2: "bigger chunks", something to see in play): after a session, and for the last one from
// the home screen, every shot as a top-down drawing of the table with each ball's path, its before and after pictures
// and its clip; the session and each rack in numbers; and every session kept on the phone so progress shows over time.
// The numbers (stats, racks) are plain functions, tested in tests/review.test.js; the screens use the app's globals.
const REVIEW = (() => {
  const HIST = 'chalkline-v3-history';
  // balls in on a shot: object balls (an unknown ball counts; the cue ball is a scratch, not a ball in)
  const objIn = s => s.made.filter(m => m.num !== 0 && !(m.num != null && m.num === s.cue)).length;
  const scored = s => objIn(s) > 0 && !s.scratch;
  // runs: shots in a row in one rack that put a ball in without a scratch (the break counts when it does)
  function runs(shots) { let best = 0, cur = 0, rack = null; for (const s of shots) { if (s.rack !== rack) { cur = 0; rack = s.rack; } cur = scored(s) ? cur + 1 : 0; best = Math.max(best, cur); } return best; }
  function stats(shots) {
    const play = shots.filter(s => !s.break);
    return { shots: shots.length, ballsIn: shots.reduce((a, s) => a + objIn(s), 0), potted: play.filter(s => objIn(s) > 0).length, tries: play.length,
      potRate: play.length ? play.filter(s => objIn(s) > 0).length / play.length : null, scratches: shots.filter(s => s.scratch).length, bestRun: runs(shots),
      misses: play.filter(s => objIn(s) === 0 && !s.scratch).length };
  }
  function racks(shots) {
    const by = new Map(); for (const s of shots) { const r = s.rack || 1; if (!by.has(r)) by.set(r, []); by.get(r).push(s); }
    return [...by.entries()].map(([rack, ss]) => Object.assign({ rack }, stats(ss)));
  }
  const pct = x => x == null ? '–' : Math.round(100 * x) + '%';
  // ---- the table drawing (table inches; y flipped so the near rail is at the bottom, as the camera sees it from the side)
  // (balls drawn a fifth larger than life, so their numbers read on a phone)
  function diagram(s, ft) {
    const P = makeP(ft || 7), L = P.L, W = P.W, R = P.R * 1.2, Y = y => (W - y).toFixed(2), X = x => x.toFixed(2), col = n => n == null ? '#9aa7ae' : BALLCOL[n % 10] || '#9aa7ae';
    const o = [`<svg viewBox="-5 -5 ${L + 10} ${W + 10}" class="tbl" role="img" aria-label="Shot ${s.n} from above">`,
      `<rect x="-5" y="-5" width="${L + 10}" height="${W + 10}" rx="3" fill="#3b2a1d"/><rect x="0" y="0" width="${L}" height="${W}" fill="#1c6fa8"/>`];
    for (let i = 1; i < 8; i++) if (i !== 4) o.push(`<circle cx="${X(L * i / 8)}" cy="-2.5" r=".45" fill="#e9e2d0"/><circle cx="${X(L * i / 8)}" cy="${W + 2.5}" r=".45" fill="#e9e2d0"/>`);
    for (let i = 1; i < 4; i++) o.push(`<circle cx="-2.5" cy="${X(W * i / 4)}" r=".45" fill="#e9e2d0"/><circle cx="${L + 2.5}" cy="${X(W * i / 4)}" r=".45" fill="#e9e2d0"/>`);
    const inPk = new Set(s.made.map(m => m.pocket).filter(p => p != null));
    P.pockets.forEach((p, i) => o.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r}" fill="#05080a" ${inPk.has(i) ? 'stroke="#ffb84d" stroke-width=".6"' : ''}/>`));
    const madeN = new Set(s.made.map(m => m.num)), moved = new Set((s.paths || []).map(p => p.num));
    const ball = (num, x, y, faint) => `<g opacity="${faint ? .35 : 1}"><circle cx="${X(x)}" cy="${Y(y)}" r="${R}" fill="${col(num)}" stroke="${num === 9 ? '#f4f1e8' : '#000'}" stroke-width="${num === 9 ? .4 : .15}"/>` +
      (num ? `<circle cx="${X(x)}" cy="${Y(y)}" r=".8" fill="#f4f1e8"/><text x="${X(x)}" y="${(W - y + .45).toFixed(2)}" font-size="1.25" font-weight="700" text-anchor="middle" fill="#111">${num}</text>` : '') + '</g>';
    // the balls that did not move, where they rested
    for (const b of s.before || []) if (!moved.has(b[0]) && !madeN.has(b[0])) o.push(ball(b[0], b[1], b[2]));
    // each moving ball: where it started (faint), its path, where it stopped or the pocket it went to
    for (const p of s.paths || []) {
      const pts = p.p.slice(), m = s.made.find(q => q.num === p.num);
      if (m && m.pocket != null) { const k = P.pockets[m.pocket]; pts.push([k.x, k.y]); }
      if (pts.length < 2) continue;
      o.push(ball(p.num, pts[0][0], pts[0][1], true));
      o.push(`<polyline points="${pts.map(q => X(q[0]) + ',' + Y(q[1])).join(' ')}" fill="none" stroke="${p.num === 0 ? '#ffffff' : col(p.num)}" stroke-width="${p.num === 0 ? .55 : .45}" stroke-linejoin="round" stroke-linecap="round" opacity=".95"${p.num == null ? ' stroke-dasharray="1 1"' : ''}/>`);
      if (!m) { const e = pts[pts.length - 1]; o.push(ball(p.num, e[0], e[1])); }
    }
    o.push('</svg>'); return o.join('');
  }
  // ---- what a session keeps for its review (on each shot, from the tracker's shot)
  const r1 = v => Math.round(v * 10) / 10;
  function shotDetail(sh) {
    return { before: (sh.before || []).filter(b => b.state !== 'hidden').map(b => [b.num, r1(b.rx != null ? b.rx : b.x), r1(b.ry != null ? b.ry : b.y)]),
      paths: (sh.paths || []).map(p => ({ num: p.num, p: thin(p.p.map(q => [r1(q[1]), r1(q[2])])) })) };
  }
  // drop points closer than half an inch to the last kept one (a path stays its shape, a resting ball adds nothing)
  function thin(pts) { const o = []; for (const q of pts) { const e = o[o.length - 1]; if (!e || Math.hypot(q[0] - e[0], q[1] - e[1]) >= 0.5) o.push(q); } const z = pts[pts.length - 1]; if (z && o[o.length - 1] !== z) o.push(z); return o; }
  // ---- every session's numbers, kept on the phone
  function history() { try { return JSON.parse(localStorage.getItem(HIST) || '[]'); } catch (e) { return []; } }
  function remember(sess, mins) {
    if (!sess || !sess.shots || !sess.shots.length) return;
    const h = history().filter(x => x.t0 !== sess.t0), st = stats(sess.shots);
    h.push({ t0: sess.t0, ft: sess.ft, mins, racks: racks(sess.shots).length, shots: st.shots, ballsIn: st.ballsIn, potted: st.potted, tries: st.tries, scratches: st.scratches, bestRun: st.bestRun });
    try { localStorage.setItem(HIST, JSON.stringify(h.slice(-300))); } catch (e) { }
  }
  // the stroke in words (from the side only; else what is known)
  function strokeWords(st) {
    if (!st || st.none) return null; if (!st.side) return 'Stroke: the cue was not seen from the side on this shot.';
    const w = []; if (st.strokes != null) w.push(st.strokes + ' practice stroke' + (st.strokes !== 1 ? 's' : ''));
    if (st.back != null) w.push('backswing ' + Math.round(st.back) + ' in'); if (st.pause != null) w.push('pause ' + st.pause.toFixed(1) + ' s'); if (st.follow != null) w.push('follow-through ' + Math.round(st.follow) + ' in');
    return w.length ? 'Stroke: ' + w.join(' · ') : null;
  }
  // the session's strokes from the side, on average
  function strokeAvg(shots) {
    const ss = shots.map(s => s.stroke).filter(st => st && st.side), avg = k => { const v = ss.map(x => x[k]).filter(x => x != null); return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null; };
    return { n: ss.length, strokes: avg('strokes'), back: avg('back'), pause: avg('pause'), follow: avg('follow') };
  }
  return { objIn, stats, racks, runs, diagram, shotDetail, thin, history, remember, pct, strokeWords, strokeAvg };
})();

// ---------- the review screens ----------
const RV = { sess: null, i: 0, urls: [], play: null, live: false };
function dateWords(t) { const d = new Date(t); return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
function renderReview(sess, live) {
  RV.sess = sess; RV.live = live; const sh = sess.shots || [], st = REVIEW.stats(sh), rk = REVIEW.racks(sh);
  $('#sumTitle').textContent = live ? 'Session over' : 'Last session';
  $('#sumSub').textContent = (live ? '' : dateWords(sess.t0) + ' · ') + (sess.mins ? sess.mins + ' min · ' : '') + (sess.ft || 7) + ' ft table · ' + rk.length + ' rack' + (rk.length !== 1 ? 's' : '') + (sess.version ? ' · ' + sess.version : '');
  $('#sumStats').innerHTML = [[st.shots, 'shots'], [st.ballsIn, 'balls in'], [REVIEW.pct(st.potRate), 'shots that made a ball'], [st.bestRun, 'best run'], [st.misses, 'misses'], [st.scratches, 'scratches']]
    .map(([n, l]) => '<div><b>' + n + '</b><span>' + l + '</span></div>').join('');
  $('#sumRacks').innerHTML = rk.map(r => '<div class="rrow"><b>Rack ' + r.rack + '</b><span>' + r.shots + ' shot' + (r.shots !== 1 ? 's' : '') + ' · ' + r.ballsIn + ' in · ' + r.misses + ' missed' + (r.scratches ? ' · ' + r.scratches + ' scratch' + (r.scratches > 1 ? 'es' : '') : '') + (r.bestRun > 1 ? ' · run of ' + r.bestRun : '') + '</span></div>').join('');
  $('#sumRackCard').hidden = rk.length < 2;
  const sa = REVIEW.strokeAvg(sh), f1 = v => v == null ? '–' : (Math.round(v * 10) / 10).toString();
  $('#sumStrokeCard').hidden = !sa.n;
  if (sa.n) $('#sumStroke').innerHTML = '<div class="stats">' + [[f1(sa.strokes), 'practice strokes'], [sa.back == null ? '–' : Math.round(sa.back) + '″', 'backswing'], [sa.pause == null ? '–' : sa.pause.toFixed(1) + ' s', 'pause'], [sa.follow == null ? '–' : Math.round(sa.follow) + '″', 'follow-through']].map(([n, l]) => '<div><b>' + n + '</b><span>' + l + '</span></div>').join('') + '</div><div class="lbl" style="margin-top:6px">Average of ' + sa.n + ' shot' + (sa.n !== 1 ? 's' : '') + ' where the cue was seen from the side.</div>';
  $('#sumList').innerHTML = sh.length ? sh.map((s, i) => '<button class="srow sbtn" data-i="' + i + '"><b>' + s.n + '</b><span>' + shotWords(s) + '</span><i>›</i></button>').join('') : '<div class="lbl">No shots.</div>';
  for (const b of $('#sumList').querySelectorAll('.sbtn')) b.onclick = () => openShot(+b.dataset.i);
  $('#sumDbg').hidden = !live; $('#sumAgain').hidden = !live;
}
function picUrl(data) { const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: 'image/jpeg' })); RV.urls.push(u); return u; }
function dropUrls() { clearTimeout(RV.play); RV.play = null; for (const u of RV.urls) URL.revokeObjectURL(u); RV.urls = []; }
async function openShot(i) {
  const sh = RV.sess.shots; if (i < 0 || i >= sh.length) return; RV.i = i; dropUrls(); const s = sh[i];
  $('#shotView').hidden = false;
  $('#svTitle').textContent = 'Shot ' + s.n + (s.rack ? ' · rack ' + s.rack : '');
  $('#svWords').textContent = shotWords(s); const sw = REVIEW.strokeWords(s.stroke); $('#svStroke').textContent = sw || ''; $('#svStroke').hidden = !sw;
  $('#svTable').innerHTML = s.paths || s.before ? REVIEW.diagram(s, RV.sess.ft) : '<div class="lbl">No drawing for this shot (sessions before V3.2 kept none).</div>';
  $('#svPrev').disabled = i === 0; $('#svNext').disabled = i === sh.length - 1;
  const nm = 'shot' + String(s.n).padStart(3, '0'), seg = $('#svSeg'); seg.innerHTML = ''; const media = $('#svMedia'); media.innerHTML = '';
  // the pictures and the clip: in memory for the session just played, else from the phone's store (the latest two sessions)
  const sid = RV.sess.sid, files = {};
  for (const k of ['before', 'after']) { const d = RV.live && A.pics.get(nm + '-' + k + '.jpg'); if (d) files[k] = d; }
  if (sid && STORE) { for (const f of await STORE.prefix(sid, nm + '-')) { const k = f.name.slice(nm.length + 1, -4); if (!files[k]) files[k] = f.data; } }
  if (RV.i !== i) return;
  const clip = sid && STORE ? (await STORE.prefix(sid, 'clips/' + nm + '/')).filter(f => /^clips\/shot\d+\/\d+\.jpg$/.test(f.name)) : [];
  const ixf = sid && STORE ? (await STORE.prefix(sid, 'clips/' + nm + '/index.json'))[0] : null;
  if (RV.i !== i) return;
  const tabs = [];
  if (clip.length) tabs.push(['Clip', () => playClip(media, clip, ixf)]);
  if (files.before) tabs.push(['Before', () => { media.innerHTML = '<img alt="Before the shot" src="' + picUrl(files.before) + '">'; }]);
  if (files.after) tabs.push(['After', () => { media.innerHTML = '<img alt="After the shot" src="' + picUrl(files.after) + '">'; }]);
  if (!tabs.length) { media.innerHTML = '<div class="lbl">No pictures kept for this shot (the phone keeps them for the latest two sessions).</div>'; return; }
  tabs.forEach(([l, f], k) => { const b = document.createElement('button'); b.textContent = l; b.onclick = () => { clearTimeout(RV.play); for (const x of seg.children) x.className = ''; b.className = 'on'; f(); }; seg.appendChild(b); if (k === 0) b.click(); });
}
// the clip as a flip book at the pace it was taken, over and over with a pause at the end
function playClip(media, clip, ixf) {
  const fr = clip.sort((a, b) => a.name < b.name ? -1 : 1); let times = null;
  try { const ix = JSON.parse(new TextDecoder().decode(ixf.data)); const m = new Map(ix.list.map(r => [r[0], r[1]])); times = fr.map(f => m.get(f.name.split('/').pop())); if (times.some(t => t == null)) times = null; } catch (e) { }
  const urls = fr.map(f => picUrl(f.data)), img = new Image(); img.alt = 'The shot'; media.innerHTML = ''; media.appendChild(img);
  let k = 0; const step = () => { img.src = urls[k]; const gap = k === urls.length - 1 ? 1200 : times ? Math.max(15, Math.min(200, times[k + 1] - times[k])) : 66; k = (k + 1) % urls.length; RV.play = setTimeout(step, gap); };
  step();
}
function closeShot() { dropUrls(); $('#shotView').hidden = true; }
$('#svPrev').onclick = () => openShot(RV.i - 1); $('#svNext').onclick = () => openShot(RV.i + 1); $('#svClose').onclick = () => closeShot();
// home: every session's numbers, newest first, with the share of shots that made a ball as bars
function renderHistory() {
  const h = REVIEW.history().slice().reverse(), card = $('#histCard'); card.hidden = !h.length; if (!h.length) return;
  const last = h.slice(0, 12).reverse(), bw = 100 / Math.max(6, last.length);
  $('#histChart').innerHTML = '<svg viewBox="0 0 100 34" preserveAspectRatio="none" class="hbars" aria-hidden="true">' + last.map((x, i) => { const r = x.tries ? x.potted / x.tries : 0, hh = Math.max(1, 30 * r); return '<rect x="' + (i * bw + bw * .15).toFixed(2) + '" y="' + (32 - hh).toFixed(2) + '" width="' + (bw * .7).toFixed(2) + '" height="' + hh.toFixed(2) + '" rx="1" fill="var(--accent)" opacity="' + (i === last.length - 1 ? 1 : .55) + '"/>'; }).join('') + '</svg>';
  $('#histList').innerHTML = h.slice(0, 8).map(x => '<div class="rrow"><b>' + dateWords(x.t0) + '</b><span>' + x.shots + ' shots · ' + x.ballsIn + ' in · ' + REVIEW.pct(x.tries ? x.potted / x.tries : null) + ' made a ball · best run ' + x.bestRun + '</span></div>').join('');
}
renderHistory();
