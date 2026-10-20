// ===== APP =====
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const KEY = 'chalkline.v2';
const BALLCOL = ['#f4f1e8', '#e8c11d', '#2a52c9', '#d03a2f', '#6a3fa0', '#e8782a', '#1f8a4c', '#8c2433', '#16181b'];
const ballColor = id => id == null ? '#8a96a3' : BALLCOL[id === 0 ? 0 : ((id - 1) % 8) + 1];
const ballName = id => id === 0 ? 'cue ball' : id + ' ball';
const MODE_LBL = { watch: 'Watch & Learn', drill: 'Learn the balls', quick: 'Show me the balls', play9: '9-ball', play8: '8-ball', train: 'Train', teach: 'Teach balls', learn: 'Learn the balls', calib: 'Calibrate' };
const S = {
  screen: 'home', mode: null, phase: 'boot', view: 'photo',
  game: '9ball', group: 'open', ft: 9, skill: 0.35, speedSd: 0.1, lens: 0.86, rot: 0, anchors: {}, phys: null,
  src: null, W: 0, H: 0, quad: null, quadN: null, cam: null, cloth: null, P: null,
  balls: [], example: false, samples: [], cands: [], sel: 0, planning: false, plannedBalls: null,
  drill: null, drillStats: {}, history: [], meas: null, teach: null, live: false, stream: null,
  pickFor: null, auto: true, stable: 0, armPos: null, armBalls: [], recording: false, placeMsg: '', onMarks: false,
  calRes: null, man: null, cal: null, aimSd: null, pocket: 'amateur', tags: false, ftSet: false,
  sess: null, lastSess: null, gone: [], zoom: { z: 1, cx: 0.5, cy: 0.5 }, vr: null, sound: true, scratch: null, watch: false, micOn: true, clips: true, trails: true,
};
// Home / Away (V2.3): the player's own table and balls, and every other table. Each keeps its own table size, last
// outline, camera zoom and learned ball looks, so what is learned at a pool hall never changes how the home balls are read.
function profSnap() { return { ft: S.ft, ftSet: S.ftSet, quadN: S.quad && S.W && S.vr ? S.quad.map(vnFromSrc) : S.quadN, samples: S.samples.filter(x => x.walk).concat(S.samples.filter(x => !x.walk).slice(-260)) }; }
function profApply(p) {
  const d = (S.profiles && S.profiles[p]) || {}; S.prof = p;
  S.ft = d.ft || (p === 'away' ? 9 : S.ft || 7); S.ftSet = !!d.ftSet; S.quadN = d.quadN || null; S.samples = d.samples || [];
  S.P = mkP(); S.quad = null; S.cam = null; S.ref = null;
}
function setProfile(p) { if (p === S.prof) return; S.profiles[S.prof] = profSnap(); profApply(p); S.quickDone = false; save(); renderHome(); renderMenu(); }
const awayLooks = () => S.prof === 'away' && S.samples.some(x => x.walk && !x.prior);
// per ball: at an away table the recognizer is trusted less only for a ball this table has its own looks for
const recPen = () => S.prof !== 'away' ? 0.15 : Array.from({ length: 10 }, (_, id) => S.samples.some(x => x.walk && !x.prior && x.id === id) ? 0.8 : 0.3);
function save() {
  try {
    if (S.profiles) S.profiles[S.prof] = profSnap();
    localStorage.setItem(KEY, JSON.stringify({ profiles: S.profiles, prof: S.prof, v23: true,
      ft: S.ft, game: S.game, group: S.group, skill: S.skill, speedSd: S.speedSd, lens: S.lens, rot: S.rot, anchors: S.anchors, phys: S.phys,
      quadN: S.quad && S.W && S.vr ? S.quad.map(vnFromSrc) : S.quadN, samples: S.samples.filter(x => x.walk).concat(S.samples.filter(x => !x.walk).slice(-260)), drillStats: S.drillStats, history: S.history.slice(-40), aimSd: S.aimSd, pocket: S.pocket, tags: S.tags, ftSet: S.ftSet, calVer: 2, lastSess: S.lastSess, zoom: S.zoom, sound: S.sound, felt: S.felt, micOn: S.micOn, clips: S.clips, trails: S.trails, v21: true, v22: true, v231: true,
    }));
  } catch (e) { }
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!d) return;
    for (const k of ['ft', 'game', 'group', 'skill', 'speedSd', 'lens', 'rot', 'anchors', 'phys', 'quadN', 'samples', 'drillStats', 'history', 'aimSd', 'pocket', 'tags', 'ftSet', 'lastSess', 'zoom', 'sound', 'felt', 'micOn', 'clips', 'trails']) if (d[k] !== undefined && d[k] !== null) S[k] = d[k];
    S.game = '9ball'; // 8-ball is gone for now
    if (!d.v22) { const n0 = S.samples.length; S.samples = S.samples.filter(x => !x.play); S.dropPlay = n0 - S.samples.length; } // V2.0 and V2.1 learned some balls under the wrong number during play
    // shot timing was corrected in this version, so strength readings saved by older versions no longer line up: start them fresh
    if (d.calVer !== 2) { S.anchors = {}; S.phys = null; S.speedSd = 0.1; }
    if (d.profiles && d.profiles.home) { S.profiles = d.profiles; S.prof = d.prof === 'away' ? 'away' : 'home'; }
    S.v231 = !!d.v231;
  } catch (e) { }
}
// pocket style only changes how wide the planner treats the pocket mouth, never the cloth or ball physics
const POCKETS = { pro: 0.9, amateur: 1, bar: 1.17 };
const mkP = () => makeP(S.ft, S.phys, POCKETS[S.pocket] || 1);
S.profiles = null; S.prof = 'home';
load();
// before V2.3 there was one set of everything: it becomes Home
if (!S.profiles) S.profiles = { home: { ft: S.ft, ftSet: S.ftSet, quadN: S.quadN, samples: S.samples, camZoom: null }, away: { ft: 9, ftSet: false, quadN: null, samples: [], camZoom: null } };
// V2.3.1: ball looks learned while V2.3 had the camera below 1x (the blurry ultra-wide lens, from Oct 14 afternoon on) are
// dropped, so they cannot outvote the recognizer; the V2.2 looks stay. Run "Show me the balls" again at 1x.
if (!S.v231) { const cut = Date.UTC(2026, 9, 14, 20, 0); let n = 0;
  for (const k of Object.keys(S.profiles)) { const pr = S.profiles[k]; if (!pr || !pr.samples) continue; if (pr.camZoom && pr.camZoom < 0.98) { const n0 = pr.samples.length; pr.samples = pr.samples.filter(x => !(x.walk && !x.prior && x.t && x.t >= cut)); n += n0 - pr.samples.length; } pr.camZoom = undefined; }
  S.dropV23 = n; }
profApply(S.prof);
S.P = mkP();
if (!S.v231) { S.v231 = true; save(); }
const labelIds = () => S.drillMode && S.dr && S.dr.quick && !S.dr.done ? [S.dr.seq[S.dr.qi] ? S.dr.seq[S.dr.qi][0] : 0] : S.drillMode && S.dr && !S.dr.done ? [0, S.dr.ball] : (S.mode === 'train' || S.mode === 'calib') ? [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] : (S.mode === 'play9' || S.mode === 'play8') && !S.drillMode && S.gone && S.gone.length ? candIds().filter(i => !S.gone.includes(i)) : candIds(); // a ball already made cannot come back (V2.3.2: Watch too)
const allSamples = () => priorSamples().concat(S.samples);

// ---------- debug log (kept for the whole session, saved from the stats screen) ----------
// V2 = the new path (user, Oct 12): watch real play, collect labeled pictures, train a ball detector. V1 ideas are kept for later.
const VERSION = 'V2.3.3';
const DBG = { t0: Date.now(), ev: [], hdr: null, snap: '', snapT: 0, hbT: 0, drop: 0, seen: {}, c: { scans: 0, skip: 0, shift: 0, maxSh: 0, maxD0: 0, maxFd: 0, relock: 0, f0: 0 } };
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100;
function dbg(k, d) {
  try {
    DBG.ev.push(Object.assign({ t: Date.now() - DBG.t0, k }, d));
    if (DBG.ev.length > 6000) { DBG.ev.splice(0, 600); DBG.drop += 600; }
  } catch (e) { }
}
function dbgOnce(key, ms, k, d) { const n = Date.now(); if (DBG.seen[key] && n - DBG.seen[key] < ms) return; DBG.seen[key] = n; dbg(k, d); }
function dbgHeader() {
  const v = typeof vid !== 'undefined' ? vid : null, dpr = window.devicePixelRatio || 1;
  return {
    app: 'chalkline', build: VERSION, started: new Date(DBG.t0).toISOString(), ua: navigator.userAgent, screen: [screen.width, screen.height], inner: [innerWidth, innerHeight], dpr,
    mode: S.mode, game: S.game, ft: S.ft, ftSet: S.ftSet, lens: S.lens, zoom: S.zoom, video: v ? [v.videoWidth, v.videoHeight] : null, vr: S.vr && { x: Math.round(S.vr.x), y: Math.round(S.vr.y), w: Math.round(S.vr.w), h: Math.round(S.vr.h), z: r2(S.vr.z) },
    W: S.W, H: S.H, quadN: S.quad && S.vr ? S.quad.map(vnFromSrc).map(p => [r2(p[0]), r2(p[1])]) : null, cloth: S.cloth && { h: r2(S.cloth.h || 0), s: r2(S.cloth.s || 0), v: r2(S.cloth.v || 0) },
    cam: S.camInfo || null, samples: S.samples.length, walkSamples: S.samples.filter(x => x.walk).length, learnedIds: [...new Set(S.samples.filter(x => x.walk).map(x => x.id))].sort(), pocket: S.pocket, speedSd: S.speedSd, sound: S.sound, watch: !!S.watch, mic: typeof MIC !== 'undefined' ? { on: MIC.on, clicks: MIC.n } : null, truth: S.truth || null,
  };
}
function dbgStart(mode) {
  DBG.t0 = Date.now(); DBG.ev = []; DBG.snap = ''; DBG.snapT = 0; DBG.hbT = 0; DBG.drop = 0; DBG.seen = {}; DBG.c = { scans: 0, skip: 0, shift: 0, maxSh: 0, maxD0: 0, maxFd: 0, relock: 0, f0: frameN || 0, v0: VF.n };
  dbg('start', { mode });
}
function dbgBalls(list) { return list.map(b => [b.id == null ? '?' : b.id, r1(b.x), r1(b.y), Math.round((b.conf || 0) * 100) + (b.locked ? 'L' : '') + (b.pin ? 'P' : '') + (b.elim ? 'E' : '') + (b.miss ? 'm' + b.miss : '')]); }
const featArr = f => f ? [f.wf, f.bf, f.cf, f.cx, f.cy, f.vc, f.band].map(v => v === undefined ? null : r2(v)) : null;
function topIds(f, n) {
  if (!f || !f.feat || !S.cloth) return null; const best = {};
  for (const s of allSamples()) { const c = featCost(f.feat, s, S.cloth); if (best[s.id] === undefined || c < best[s.id]) best[s.id] = c; }
  return Object.keys(best).map(i => [+i, r2(best[i])]).sort((a, b) => a[1] - b[1]).slice(0, n || 3);
}
// called after every live scan: writes a picture of the table when something changed, and a heartbeat every few seconds
function dbgScan(found, dd, why) {
  const key = found.map(b => (b.id == null ? '?' : b.id) + ':' + Math.round(b.x) + ',' + Math.round(b.y)).sort().join('|'), now = Date.now();
  if (key !== DBG.snap) { DBG.snap = key; DBG.snapT = now; dbg('table', { n: found.length, b: dbgBalls(found), st: S.stable }); }
  if (now - DBG.hbT > 5000) {
    const c = DBG.c, secs = Math.max(1, (now - (DBG.hbT || DBG.t0)) / 1000);
    clipFps(Math.round((VF.n - (c.v0 || 0)) / secs));
    dbg('hb', { n: found.length, unl: found.filter(b => b.id == null).length, st: S.stable, setN: S.setN || 0, mv: r1(dd.mv), scans: c.scans, skip: c.skip, shifts: c.shift, maxShPx: r1(c.maxSh), maxD0: r1(c.maxD0), maxFd: r1(c.maxFd), relock: c.relock, blocked: c.blocked || 0, tableN: S.tableN == null ? null : S.tableN, occ: r2(S.occFrac || 0), hidden: found.filter(b => b.hid).length, pend: !!S.pend, fps: Math.round(((frameN || 0) - c.f0) / secs), camFps: Math.round((VF.n - (c.v0 || 0)) / secs), phase: S.phase, rec: !!S.recording, clip: CLIP.rec ? 1 : CLIP.off ? 'off' : 0, arm: !!S.armPos, cands: S.cands.length, mic: typeof MIC !== 'undefined' && MIC.on ? { clicks: MIC.n, floor: +MIC.floor.toExponential(1) } : undefined, wobble: typeof WOB !== 'undefined' && WOB.on ? { n: WOB.n, max: Math.round(WOB.max) } : undefined, lag: typeof LAG !== 'undefined' ? { late: LAG.n, maxMs: Math.round(LAG.max), ...Object.fromEntries(Object.entries(LAG.w).map(([k, v]) => [k, Math.round(v)])) } : undefined });
    if (typeof LAG !== 'undefined') { LAG.n = 0; LAG.max = 0; LAG.w = {}; }
    DBG.hbT = now; DBG.c = { scans: 0, skip: 0, shift: 0, maxSh: 0, maxD0: 0, maxFd: 0, relock: 0, f0: frameN || 0, v0: VF.n };
  }
}
function dbgText() {
  const out = { header: Object.assign(dbgHeader(), { events: DBG.ev.length, dropped: DBG.drop, lengthSec: Math.round((Date.now() - DBG.t0) / 1000), shots: (S.sess || S.lastSess || {}).shots || [] }), events: DBG.ev };
  return JSON.stringify(out).replace(/\},\{"t":/g, '},\n{"t":');
}
function dbgPersist() { try { localStorage.setItem('chalkline.dbg', JSON.stringify({ t0: DBG.t0, ev: DBG.ev.slice(-3500), drop: DBG.drop, hdr: dbgHeader() })); } catch (e) { } }
try { const d = JSON.parse(localStorage.getItem('chalkline.dbg') || 'null'); if (d && d.ev) { DBG.t0 = d.t0; DBG.ev = d.ev; DBG.drop = d.drop || 0; } } catch (e) { }
window.addEventListener('error', e => dbg('error', { m: String(e.message || e).slice(0, 200), at: (e.filename || '').split('/').pop() + ':' + e.lineno }));
window.addEventListener('unhandledrejection', e => dbg('error', { m: 'promise: ' + String(e.reason && e.reason.message || e.reason).slice(0, 200) }));
document.addEventListener('visibilitychange', () => { dbg('vis', { s: document.visibilityState }); if (document.visibilityState === 'hidden') { dbgPersist(); S.touchDown = false; } LAG.last = 0; });
// Save debug: one zip with the log (and, after a Watch & Learn session, every shot's pictures and labels). Shared as the file
// alone, with no title or text riding along, so the file itself is what lands in the other app. Packing takes a moment, and
// iPhone only lets a page share right after a tap, so it is two taps: the first packs, the second ("Share debug file") shares.
let DBGZIP = null;
async function packDebug() {
  const d = new Date(DBG.t0), pad = n => String(n).padStart(2, '0'), name = 'chalkline-debug-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + '.zip';
  dbgPersist();
  const files = [{ name: 'log.txt', data: new TextEncoder().encode(dbgText()) }];
  const se = S.sess && S.sess.watch ? S.sess : S.lastSess && S.lastSess.watch ? S.lastSess : null;
  if (se) {
    try {
      const pre = 's' + se.t0 + '/', keys = (await idbKeys()).map(String).filter(k => k.startsWith(pre)).sort();
      // shot videos: the flagged shots first, then the newest, up to 80 MB in one file (the phone builds the zip in memory)
      const isVid = k => /\.(mp4|webm)$/.test(k), vids = keys.filter(isVid); let flagged = new Set(), vb = 0; const vin = [], vout = [];
      for (const k of keys) { if (isVid(k)) continue; const v = await idbGet(k); if (v) { files.push({ name: k.slice(pre.length), data: new Uint8Array(v) }); if (k.endsWith('/labels.json')) { try { flagged = new Set(JSON.parse(new TextDecoder().decode(v)).shots.filter(x => x.flag).map(x => x.shot)); } catch (e) { } } } }
      const num = k => +((k.match(/shot(\d+)\./) || [])[1] || 0); vids.sort((a, b) => (flagged.has(num(b)) - flagged.has(num(a))) || num(b) - num(a));
      for (const k of vids) { if (vb > 80 * 1048576) { vout.push(num(k)); continue; } const v = await idbGet(k); if (!v) continue; if (vb + v.byteLength > 80 * 1048576 && vin.length) { vout.push(num(k)); continue; } vb += v.byteLength; vin.push(num(k)); files.push({ name: k.slice(pre.length), data: new Uint8Array(v) }); }
      if (vids.length) dbg('export', { clips: vin.length, clipMB: r1(vb / 1048576), left: vout.sort((a, b) => a - b) });
    } catch (e) { dbg('frames', { err: 'export ' + String(e).slice(0, 80) }); }
  }
  try { const gk = (await idbKeys()).map(String).filter(k => k.startsWith('geo/')).sort(), old = gk.slice(0, Math.max(0, gk.length - 4)); for (const k of old) idbDel(k); for (const k of gk.slice(-4)) { const v = await idbGet(k); if (v) files.push({ name: k.replace('/', '-'), data: new Uint8Array(v) }); } } catch (e) { }
  const blob = makeZip(files); dbg('export', { files: files.length, kb: Math.round(blob.size / 1024) });
  let file = null; try { file = new File([blob], name, { type: 'application/zip' }); } catch (e) { }
  return { blob, file, name, t: Date.now(), mb: blob.size / 1048576 };
}
function downloadDebug(z) {
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(z.blob); a.download = z.name; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500); toast('Debug file saved'); return true; } catch (e) { return false; }
}
async function saveDebug() {
  const btn = $('[data-s=dbg]'), z = DBGZIP;
  if (z && Date.now() - z.t < 5 * 60000) { // second tap: share right away, nothing awaited before it
    DBGZIP = null; if (btn) btn.textContent = 'Save debug';
    if (z.file && navigator.canShare && navigator.canShare({ files: [z.file] })) {
      try { await navigator.share({ files: [z.file] }); dbg('export', { shared: true }); } catch (e) { dbg('export', { shared: false, e: String(e && e.name || e) }); if (!(e && e.name === 'AbortError')) downloadDebug(z); }
      return;
    }
    downloadDebug(z); return;
  }
  toast('Packing the debug file…'); if (btn) { btn.disabled = true; btn.textContent = 'Packing…'; }
  const p = await packDebug(); if (btn) btn.disabled = false;
  if (!(p.file && navigator.canShare && navigator.canShare({ files: [p.file] }))) { if (btn) btn.textContent = 'Save debug'; if (!downloadDebug(p)) toast('Could not save the debug file on this phone.'); return; }
  DBGZIP = p; if (btn) btn.textContent = 'Share debug file (' + (p.mb < 0.1 ? '<0.1' : p.mb.toFixed(1)) + ' MB)'; toast('Ready. Tap Share debug file.');
}
const candIds = () => (S.mode === 'train' || S.mode === 'calib') ? [0, 1] : S.mode === 'teach' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : S.game === '9ball' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

// ---------- strength scale: 1 (barely moving) to 10 (your break) ----------
const DEF_MPH = [0.8, 1.6, 2.6, 3.8, 5.2, 7, 9.5, 12.5, 16.5, 22];
function levelTable() {
  const m = Object.keys(S.anchors).map(Number).filter(L => S.anchors[L] > 0).sort((a, b) => a - b), out = DEF_MPH.slice();
  if (!m.length) return out;
  for (let L = 1; L <= 10; L++) {
    if (S.anchors[L] > 0) { out[L - 1] = S.anchors[L]; continue; }
    const lo = [...m].reverse().find(x => x < L), hi = m.find(x => x > L);
    if (lo !== undefined && hi !== undefined) { const f = (L - lo) / (hi - lo); out[L - 1] = Math.exp(Math.log(S.anchors[lo]) + f * (Math.log(S.anchors[hi]) - Math.log(S.anchors[lo]))); }
    else if (lo !== undefined) out[L - 1] = S.anchors[lo] * DEF_MPH[L - 1] / DEF_MPH[lo - 1];
    else out[L - 1] = S.anchors[hi] * DEF_MPH[L - 1] / DEF_MPH[hi - 1];
  }
  for (let i = 1; i < 10; i++) if (out[i] <= out[i - 1]) out[i] = out[i - 1] * 1.08;
  return out;
}
function speedOfLevel(L) {
  const t = levelTable(), i = clamp(L, 1, 10) - 1, lo = Math.floor(i), hi = Math.ceil(i);
  return (t[lo] + (t[hi] - t[lo]) * (i - lo)) * MPH;
}
function levelOfSpeed(v) {
  const t = levelTable().map(x => x * MPH); if (v <= t[0]) return Math.max(0.5, 1 - (t[0] - v) / t[0]);
  for (let i = 1; i < 10; i++) if (v <= t[i]) return i + (v - t[i - 1]) / (t[i] - t[i - 1]);
  return 10 + Math.min(1, (v - t[9]) / t[9]);
}
const levelWord = L => L <= 1.5 ? 'touch' : L <= 3.5 ? 'soft' : L <= 5.5 ? 'medium' : L <= 7.5 ? 'firm' : L <= 9.5 ? 'hard' : 'break';

// ---------- helpers ----------
function setStatus(t) { if (S.status !== t && S.phase === 'run') dbg('status', { s: t.slice(0, 120) }); S.status = t; const e = $('#status'); if (e) e.textContent = t; }
function imgData() { return S.src.getContext('2d').getImageData(0, 0, S.W, S.H); }
function spinWords(s) {
  const w = [];
  if (s.b > 0.15) w.push(s.b > 0.35 ? 'follow' : 'light follow'); else if (s.b < -0.15) w.push(s.b < -0.35 ? 'draw' : 'light draw');
  if (s.a > 0.12) w.push('right english'); else if (s.a < -0.12) w.push('left english');
  return w.length ? w.join(' + ') : 'center ball';
}
function candText(c) {
  if (c.kind === 'safety') return 'Safety on the ' + ballName(c.target);
  if (c.kind === 'combo') return ballName(c.target) + ' into the ' + ballName(c.via);
  return ballName(c.target) + ' to ' + S.P.pocketNames[c.pocket];
}
function layoutDiff(a, b) {
  if (!a || a.length !== b.length) return 99; let m = 0;
  for (const p of a) { let d = 1e9; for (const q of b) d = Math.min(d, Math.hypot(p.x - q.x, p.y - q.y)); m = Math.max(m, d); }
  return m;
}

// ---------- home ----------
function seg(el, opts, val, fn) {
  el.innerHTML = '';
  opts.forEach(([v, l]) => { const b = document.createElement('button'); b.textContent = l; b.className = v === val ? 'on' : ''; b.onclick = () => fn(v); el.appendChild(b); });
}
function renderHome() {
  { const vt = $('#verTag'); if (vt) vt.textContent = VERSION; }
  { const lb = $('#lastBtn'); if (lb) { lb.hidden = !(S.lastSess && S.lastSess.shots && S.lastSess.shots.length); lb.onclick = () => showStats(false); } }
  seg($('#segFt'), [[7, '7 ft'], [8, '8 ft'], [9, '9 ft']], S.ft, setFt);
  { const sp = $('#segProf'); if (sp) seg(sp, [['home', 'Home'], ['away', 'Away']], S.prof, setProfile); const ph = $('#profHint'); if (ph) ph.textContent = S.prof === 'home' ? 'Your own table and balls.' : 'Any other table. Show the app the balls first (about 2 minutes).'; }
  const calibrated = Object.keys(S.anchors).length, learned = new Set(S.samples.map(s => s.id)).size;
  const row = (a, b, c) => '<div class="stat"><span>' + a + '</span><em class="' + (c || '') + '">' + b + '</em></div>';
  $('#status0').innerHTML = row('Table position', S.quadN ? 'saved from last time' : 'not set yet', S.quadN ? 'ok' : 'warn') + (() => { const lw = new Set(S.samples.filter(x => x.walk).map(x => x.id)), need = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(i => !lw.has(i)); return row('Balls learned (' + (S.prof === 'home' ? 'Home' : 'Away') + ')', need.length ? (10 - need.length) + ' of 10 · not yet: ' + need.map(i => i === 0 ? 'cue' : i).join(', ') : 'all 10', need.length ? 'warn' : 'ok'); })();
}
function setFt(v) { S.ft = v; S.ftSet = true; S.P = mkP(); S.cands = []; S.quadN = null; save(); renderHome(); renderMenu(); if (S.cam) { rebuildCam(); } }

// ---------- camera ----------
const vid = document.createElement('video'); vid.setAttribute('playsinline', ''); vid.setAttribute('webkit-playsinline', ''); vid.muted = true; vid.autoplay = true;
vid.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none'; document.body.appendChild(vid);
// The picture we analyse is the part of the camera frame the player has pinched in on (zoom 1 = the whole frame).
// The table outline is kept against the whole camera frame (0 to 1), so zooming never loses it.
function viewRect() {
  const vw = vid.videoWidth, vh = vid.videoHeight, z = S.mode === 'learn' ? 1 : clamp(S.zoom.z, 1, 4), w = vw / z, h = vh / z;
  return { x: clamp(S.zoom.cx * vw - w / 2, 0, vw - w), y: clamp(S.zoom.cy * vh - h / 2, 0, vh - h), w, h, vw, vh, z };
}
function vnFromSrc(p) { return S.vr ? [(S.vr.x + p[0] / S.W * S.vr.w) / S.vr.vw, (S.vr.y + p[1] / S.H * S.vr.h) / S.vr.vh] : [p[0] / S.W, p[1] / S.H]; }
function srcFromVn(p, r = S.vr) { return r ? [(p[0] * r.vw - r.x) / r.w * S.W, (p[1] * r.vh - r.y) / r.h * S.H] : [p[0] * S.W, p[1] * S.H]; }
// focal length and picture centre of the analysed picture, in its own pixels
const lensZ = () => S.lens * (S.camZoom || 1); // the lens setting is for the main camera at 1x; zooming out to the ultra-wide shortens it
function focalPx() { const r = S.vr; return r ? lensZ() * Math.max(r.vw, r.vh) * S.W / r.w : lensZ() * Math.max(S.W, S.H); }
function ppPx() { const r = S.vr; return r ? [(r.vw / 2 - r.x) * S.W / r.w, (r.vh / 2 - r.y) * S.H / r.h] : [S.W / 2, S.H / 2]; }
// The working picture is at most 800 px; Watch & Learn makes the most of it by framing just the table (autoFrame).
const SRC_MAX = 800;
function grab() {
  if (!vid.videoWidth) return false;
  const r = viewRect(), sc = Math.min(1, SRC_MAX / Math.max(r.w, r.h)), w = Math.round(r.w * sc), h = Math.round(r.h * sc), pv = S.vr;
  const changed = !S.src || !pv || S.W !== w || S.H !== h || pv.x !== r.x || pv.y !== r.y || pv.w !== r.w || pv.h !== r.h || pv.vw !== r.vw || pv.vh !== r.vh;
  if (changed) {
    let keep = null;
    if (S.quad && S.W && pv) keep = S.quad.map(p => [(pv.x + p[0] / S.W * pv.w) / pv.vw, (pv.y + p[1] / S.H * pv.h) / pv.vh]);
    else if (S.quad && S.W) keep = S.quad.map(p => [p[0] / S.W, p[1] / S.H]);
    else if (S.quadN) keep = S.quadN;
    if (!S.src || S.W !== w || S.H !== h) { S.src = document.createElement('canvas'); S.src.width = w; S.src.height = h; S.src.getContext('2d', { willReadFrequently: true }); }
    S.W = w; S.H = h; S.vr = r;
    if (keep) S.quad = keep.map(p => srcFromVn(p, r));
    if (S.quad && S.cam) { S.cam = makeCam(tableCorners(), S.quad, S.W, S.H, focalPx(), ppPx()); S.ref = null; TR.cam = null; zoneCache = null; }
  }
  S.src.getContext('2d').drawImage(vid, r.x, r.y, r.w, r.h, 0, 0, w, h);
  return true;
}
function setZoom(z, cx, cy) { S.zoom = { z: clamp(z, 1, 4), cx: clamp(cx, 0, 1), cy: clamp(cy, 0, 1) }; if (S.zoom.z < 1.02) S.zoom = { z: 1, cx: 0.5, cy: 0.5 }; grab(); syncZoomUI(); dbgOnce('zoom', 800, 'zoom', { z: r2(S.zoom.z), cx: r2(S.zoom.cx), cy: r2(S.zoom.cy) }); }
function syncZoomUI() { const b = $('#zoomBtn'); if (!b) return; const on = S.zoom.z > 1.02 && S.mode !== 'learn' && !$('#cam').hidden; b.hidden = !on; b.textContent = S.zoom.z.toFixed(1) + '×'; }
// Orientation: iOS flips the camera picture when the phone turns, so keep our copy of its size in step
// with the real video, and do nothing with the table until the phone is sideways.
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isLand = () => window.innerWidth > window.innerHeight && (!vid.videoWidth || vid.videoWidth > vid.videoHeight);
let vdim = '';
function syncSize() {
  if (!vid.videoWidth) return;
  const d = vid.videoWidth + 'x' + vid.videoHeight; if (d === vdim) return; vdim = d;
  grab(); if (S.quad) rebuildCam(); TR.cam = null; zoneCache = null;
}
async function waitLandscape() {
  const t0 = performance.now(); let sideways = 0;
  while (S.live && !$('#cam').hidden) {
    if (window.innerWidth > window.innerHeight) { if (!sideways) sideways = performance.now(); } else sideways = 0;
    // some phones keep sending an upright picture even when held sideways; give it 3 s, then go on with what we get
    if (isLand() || (sideways && performance.now() - sideways > 3000)) break;
    await sleep(150);
  }
  syncSize(); grab(); await sleep(150);
}
async function startCamera() {
  if (S.live) return true;
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { setStatus('This browser cannot reach the camera. Open the page in Safari from its https address.'); return false; }
  setStatus('Asking for the camera…');
  try {
    await openStream();
    grab(); S.live = true; startLoops(); wakeLock(); return true;
  } catch (e) {
    showCard('<h3>Camera is off</h3><p>' + (e && e.name === 'NotAllowedError' ? 'Camera access was blocked. In Safari tap aA, then Website Settings, then Camera, then Allow. Reload and try again.' : 'The camera could not start: ' + ((e && (e.message || e.name)) || 'unknown error')) + '</p><div class="row"><button class="btn primary" data-act="home">Back to menu</button></div>');
    return false;
  }
}
const CAM_REQ = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } }, audio: false };
async function openStream() {
  const stream = await navigator.mediaDevices.getUserMedia(CAM_REQ);
  S.stream = stream; vid.srcObject = stream; await vid.play();
  for (let i = 0; i < 60 && !vid.videoWidth; i++) await new Promise(r => setTimeout(r, 50));
  const tr = stream.getVideoTracks()[0];
  if (tr) {
    tr.addEventListener('ended', () => { dbg('cam_ended', {}); if (S.live) restartCamera('ended'); });
    tr.addEventListener('mute', () => dbg('cam_mute', {})); tr.addEventListener('unmute', () => dbg('cam_unmute', {}));
    try {
      const st = tr.getSettings ? tr.getSettings() : {}, cp = tr.getCapabilities ? tr.getCapabilities() : null, pick = o => { const r = {}; for (const k of ['width', 'height', 'frameRate', 'aspectRatio', 'facingMode', 'zoom', 'focusMode', 'exposureMode', 'whiteBalanceMode', 'torch', 'resizeMode']) if (o && o[k] !== undefined) r[k] = o[k]; return r; };
      S.camInfo = { label: tr.label, settings: pick(st), caps: cp ? pick(cp) : null, video: [vid.videoWidth, vid.videoHeight] }; dbg('cam', S.camInfo);
    } catch (e) { }
  }
  return stream;
}
// iPhone stops the camera when the phone locks, another app takes the camera, or a call comes in. Start it again,
// keeping everything the app knows about the table and the balls.
async function restartCamera(why) {
  if (S.camBusy || !S.live) return; S.camBusy = true; dbg('cam_restart', { why }); clipStop(null);
  try {
    if (S.stream) S.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } });
    await Promise.race([openStream(), new Promise((_, no) => setTimeout(() => no(new Error('timed out')), 8000))]);
    await setCamZoom(1, 'restart'); S.camZoom = 1; // always the main camera at 1x
    syncSize(); hookFrames(true); setStatus('Camera back on.');
  } catch (e) { dbg('error', { m: 'camera restart: ' + String(e && (e.name || e.message) || e).slice(0, 120) }); setStatus('The camera is off. Tap Menu, then start again.'); }
  finally { S.camBusy = false; VF.last = performance.now(); }
}
// ---------- camera zoom ----------
// V2.3.1: always 1x, never below. Under 1x the iPhone switches to the ultra-wide lens and crops it: the balls come out
// smeared (stripes and the purple 4 wash out) and ball naming fell from about 96% to 65-80% (real7). If the table does not
// fit at 1x the player moves the phone back or higher. The camera is only ever set back to 1x here.
function camZoomCaps() { try { const tr = S.stream && S.stream.getVideoTracks()[0], c = tr && tr.getCapabilities ? tr.getCapabilities() : null; return c && c.zoom && c.zoom.min < 0.98 ? { min: Math.max(0.5, c.zoom.min), max: c.zoom.max } : null; } catch (e) { return null; } }
async function setCamZoom(z, why) {
  const caps = camZoomCaps(), tr = S.stream && S.stream.getVideoTracks()[0]; if (!caps || !tr) return false;
  z = 1; let cur = null; try { cur = tr.getSettings ? tr.getSettings().zoom : null; } catch (e) { }
  if (typeof cur === 'number' && Math.abs(cur - 1) < 0.02) { S.camZoom = 1; return false; }
  try {
    await tr.applyConstraints({ advanced: [{ zoom: z }] });
    if (tr.readyState !== 'live' || !S.live) return false;
    const got = tr.getSettings ? tr.getSettings().zoom : null; S.camZoom = typeof got === 'number' ? got : z;
    dbg('cam_zoom', { z: r2(S.camZoom), want: z, why }); await sleep(450); syncSize(); grab(); S.ref = null; S.lastCa = null; TR.cam = null;
    return true;
  } catch (e) { dbg('cam_zoom', { err: String(e && (e.name || e.message) || e).slice(0, 80), want: z }); return false; }
}
// the zoom at which this outline (on the current picture) plus a margin just fills the picture
function zoomToFit(q) {
  const vn = q.map(vnFromSrc), u0 = Math.min(...vn.map(p => p[0])), u1 = Math.max(...vn.map(p => p[0])), v0 = Math.min(...vn.map(p => p[1])), v1 = Math.max(...vn.map(p => p[1]));
  const du = Math.max(Math.abs(u0 - 0.5), Math.abs(u1 - 0.5)) + 0.05, dv = Math.max(Math.abs(v0 - 0.5), Math.abs(v1 - 0.5)) + 0.08; // zoom keeps the centre: room for the farther side
  return (S.camZoom || 1) * Math.min(0.5 / du, 0.5 / dv);
}
const edgeNear = q => q.some(p => { const v = vnFromSrc(p); return v[0] < 0.025 || v[0] > 0.975 || v[1] < 0.025 || v[1] > 0.975; });
function camAlive() {
  if (!S.live || document.visibilityState !== 'visible' || S.camBusy) return;
  const tr = S.stream && S.stream.getVideoTracks()[0];
  if (!tr || tr.readyState === 'ended') { restartCamera('track gone'); return; }
  if (vid.paused) { vid.play().catch(() => { }); }
  // no new picture for 3 seconds while the app is on screen: the camera has stalled
  if (VF.on && VF.last && performance.now() - VF.last > 3000) { VF.last = performance.now(); restartCamera('no frames'); }
}
setInterval(camAlive, 1500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.live) { VF.last = performance.now(); setTimeout(camAlive, 600); } });
function stopCamera() {
  if (S.stream) S.stream.getTracks().forEach(t => t.stop());
  clipStop(null); S.stream = null; S.live = false; S.armPos = null; stopLoops();
}
let wl = null;
async function wakeLock() { try { if (navigator.wakeLock && S.live) wl = await navigator.wakeLock.request('screen'); } catch (e) { } }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.live) wakeLock(); });
function setQuad(q, rot) {
  S.ref = null; S.quad = q; S.rot = rot !== undefined ? rot : (S.src ? pickRot(imgData(), q) : 0); rebuildCam();
}
// Full-size camera frame, for the small things (rail diamonds) that vanish in the smaller working picture.
function hiFrame() {
  if (!vid.videoWidth || !S.vr) return null; const r = S.vr;
  const c = document.createElement('canvas'); c.width = Math.round(r.w); c.height = Math.round(r.h);
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(vid, r.x, r.y, r.w, r.h, 0, 0, c.width, c.height); return x.getImageData(0, 0, c.width, c.height);
}
function runDiamonds(refine) {
  S.dia = null; const hi = hiFrame(); if (!hi || !S.quad) return;
  const sc = hi.width / S.W, q = S.quad.map(p => [p[0] * sc, p[1] * sc]), fr = lensZ() * S.vr.z, pp = [S.vr.vw / 2 - S.vr.x, S.vr.vh / 2 - S.vr.y];
  let d = findDiamonds(hi, q, S.rot, S.ft, fr, pp);
  if (refine && d.n >= 8) {
    const rq = refineWithDiamonds(hi, q, S.rot, S.ft, fr, d, pp);
    if (rq) { const d2 = findDiamonds(hi, rq, S.rot, S.ft, fr, pp); if (d2.n >= d.n) { d = d2; setQuad(rq.map(p => [p[0] / sc, p[1] / sc]), S.rot); } }
  }
  S.dia = { n: d.n, exp: d.expected, pts: d.found.map(f => [f.px / hi.width, f.py / hi.height]) };
}
// Balls are 2.25 in across, so how big they look against the table says whether it is a 7, 8 or 9 foot table.
// change=true only while setting up a new table whose size the player has not confirmed; otherwise it only mentions it once
function autoSize(change) {
  if (!S.cam || !S.cloth || !S.src) return; grab();
  const img = imgData(), res = {};
  for (const ft of [7, 8, 9]) {
    const P = makeP(ft, S.phys, POCKETS[S.pocket] || 1), { L, Wd } = tableDims(ft), info = {};
    const cam = makeCam(tableCornersFor(S.rot, L, Wd), S.quad, S.W, S.H, focalPx(), ppPx());
    detectBalls(img, cam, P, S.cloth, info);
    const rs = (info.ratios || []).filter(r => r > 0.35 && r < 3);
    if (rs.length >= 2) { const e = rs.map(r => Math.abs(Math.log(r))).sort((a, b) => a - b); res[ft] = e[e.length >> 1]; }
  }
  const keys = Object.keys(res).map(Number).sort((a, b) => res[a] - res[b]), best = keys[0], cur = res[S.ft];
  dbg('size', { res: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, r2(v)])), ft: S.ft, best: best || null, set: !!S.ftSet, change: !!change });
  if (best && best !== S.ft && (cur === undefined || res[best] < 0.6 * cur) && (S.ftSet || !change)) {
    // the player told us the size: never override it, only mention it once
    if (!S.sizeHinted) { S.sizeHinted = true; dbg('size_hint', { best, ft: S.ft }); } // only written down: from a low, far camera the ball size reads too small and the toast was wrong
  } else if (best && best !== S.ft && (cur === undefined || res[best] < 0.6 * cur)) {
    S.ft = best; S.P = mkP(); S.cands = []; save(); renderHome(); renderMenu(); rebuildCam();
    if (S.phase === 'run') toast('Table size set to ' + best + ' ft from the ball size. Change it in More if that is wrong.');
  }
}
function tableCorners() {
  const P = S.P, base = [[0, P.W], [P.L, P.W], [P.L, 0], [0, 0]];
  return [0, 1, 2, 3].map(i => base[(i + S.rot) % 4]);
}
function rebuildCam() {
  if (!S.quad || !S.src) { S.cam = null; return; }
  S.cam = makeCam(tableCorners(), S.quad, S.W, S.H, focalPx(), ppPx());
  const c = sampleCloth(imgData(), S.quad); if (c) S.cloth = c;
  S.cands = []; TR.cam = null; zoneCache = null;
}
// A saved table position is trusted if the felt still fills it.
function quadLooksRight() {
  if (!S.quad) return false;
  const q = S.quad, d = imgData(), cl = sampleCloth(d, q); if (!cl) return false; let ok = 0, n = 0;
  for (let i = 0; i < 160; i++) {
    const u = 0.1 + Math.random() * 0.8, v = 0.1 + Math.random() * 0.8;
    const x = Math.round((1 - v) * ((1 - u) * q[0][0] + u * q[1][0]) + v * ((1 - u) * q[3][0] + u * q[2][0])), y = Math.round((1 - v) * ((1 - u) * q[0][1] + u * q[1][1]) + v * ((1 - u) * q[3][1] + u * q[2][1]));
    if (x < 0 || y < 0 || x >= S.W || y >= S.H) continue; const o = (y * S.W + x) * 4, [h, s, vv] = rgb2hsv(d.data[o], d.data[o + 1], d.data[o + 2]);
    n++; if (isCloth(h, s, vv, cl) || vv > 0.9) ok++;
  }
  return n > 50 && ok / n > 0.75;
}

// ---- camera moved? Compare the room around the table with how it looked when the table was locked.
// A small slide of the whole picture (tripod sway) is followed by sliding the table outline with it, so balls keep their spots.
// A big or non-sliding change makes the app look for the table again.
function smallGray(w) {
  const c = smallGray.cs[w] || (smallGray.cs[w] = document.createElement('canvas')); c.width = w; c.height = Math.round(w * S.H / S.W);
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(S.src, 0, 0, c.width, c.height);
  const d = x.getImageData(0, 0, c.width, c.height).data, g = new Float32Array(c.width * c.height);
  for (let i = 0; i < g.length; i++) g[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11;
  return { w: c.width, h: c.height, g };
}
smallGray.cs = {};
function outsideMask(sm, q) {
  const k = sm.w / S.W; let cx = 0, cy = 0; q.forEach(p => { cx += p[0] / 4; cy += p[1] / 4; });
  const e = q.map(p => [cx + (p[0] - cx) * 1.1, cy + (p[1] - cy) * 1.1]), mask = [];
  for (let y = 0; y < sm.h; y++) for (let x = 0; x < sm.w; x++) {
    const px = x / k, py = y / k; let inside = true, s0 = 0;
    for (let i = 0; i < 4; i++) { const a = e[i], b = e[(i + 1) % 4], cr = (b[0] - a[0]) * (py - a[1]) - (b[1] - a[1]) * (px - a[0]); if (cr === 0) continue; if (!s0) s0 = Math.sign(cr); else if (Math.sign(cr) !== s0) { inside = false; break; } }
    if (!inside) mask.push(y * sm.w + x);
  }
  return mask;
}
function refSnap() {
  if (!S.quad || !S.src) { S.ref = null; return; }
  const a = smallGray(128), b = smallGray(400);
  const mb = outsideMask(b, S.quad), w = b.w, g = b.g;
  // the outlines and edges in the room (door frames, chair legs, light switches): these only line up again if the camera has not moved
  const eb = mb.filter(i => { const x = i % w; if (x < 1 || x >= w - 1 || i < w || i >= g.length - w) return false; return Math.abs(g[i + 1] - g[i - 1]) + Math.abs(g[i + w] - g[i - w]) > 28; });
  S.ref = { a, b, ma: outsideMask(a, S.quad), mb, eb, W: S.W, H: S.H, quad: S.quad.map(p => p.slice()), shifted: false };
}
function gdiff(ref, cur, mask, dx, dy) {
  const w = ref.w, h = ref.h; let t = 0, n = 0;
  for (const i of mask) { const x = i % w + dx, y = ((i / w) | 0) + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue; t += Math.abs(cur.g[y * w + x] - ref.g[i]); n++; }
  return n > 100 ? t / n : 0;
}
function refDiff() { const r = S.ref; if (!r || r.W !== S.W || r.H !== S.H) return 0; return gdiff(r.a, smallGray(128), r.ma, 0, 0); }
function applyShift(dx, dy) {
  const r = S.ref; S.quad = r.quad.map(p => [p[0] + dx, p[1] + dy]); r.shifted = !!(dx || dy);
  S.cam = makeCam(tableCorners(), S.quad, S.W, S.H, focalPx(), ppPx()); TR.cam = null; zoneCache = null;
}
// share of the room around the table that still looks the same (a person walking through changes only part of it)
function gmatch(ref, cur, mask, dx, dy, thr) {
  const w = ref.w, h = ref.h; let ok = 0, n = 0;
  for (let k = 0; k < mask.length; k++) { const i = mask[k], x = i % w + dx, y = ((i / w) | 0) + dy; if (x < 0 || y < 0 || x >= w || y >= h) continue; n++; if (Math.abs(cur.g[y * w + x] - ref.g[i]) < thr) ok++; }
  return n > 50 ? ok / n : 0;
}
function checkMoved() {
  const now = performance.now(), r = S.ref;
  if (!r || r.W !== S.W || r.H !== S.H) { if (S.occFrac > 0.02 && S.phase === 'run') return false; refSnap(); return false; }
  const ca = smallGray(128), d0 = gdiff(r.a, ca, r.ma, 0, 0);
  DBG.c.maxD0 = Math.max(DBG.c.maxD0, d0);
  // is the picture still changing from one look to the next? People walking keep it changing; a bumped camera jumps once, then holds still.
  { const pg = S.lastCa; let t = 0; if (pg && pg.g.length === ca.g.length) { for (let i = 0; i < ca.g.length; i += 3) t += Math.abs(ca.g[i] - pg.g[i]); t /= ca.g.length / 3; } else t = 99; S.lastCa = ca; S.stillN = t < 4 ? (S.stillN || 0) + 1 : 0; }
  if (d0 < 3) { if (r.shifted) { if (Math.hypot(r.lastSx || 0, r.lastSy || 0) > 4 * S.W / 800) tableMoved(); r.lastSx = r.lastSy = 0; applyShift(0, 0); } S.moveN = 0; S.lastSh = null; S.shakeSkip = 0; S.lostT = 0; S.lostSaid = false; return false; }
  // best slide: small slides first (fine pass at the 400 px picture), a coarse pass only if that does not explain it
  const cb = smallGray(400); let fx = 0, fy = 0, fd = gdiff(r.b, cb, r.mb, 0, 0);
  const fine = (cx, cy) => { for (let dy = cy - 3; dy <= cy + 3; dy++) for (let dx = cx - 3; dx <= cx + 3; dx++) { const d = gdiff(r.b, cb, r.mb, dx, dy); if (d < fd) { fd = d; fx = dx; fy = dy; } } };
  fine(0, 0);
  if (fd >= 9) {
    let bx = 0, by = 0, bd = d0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { if (!dx && !dy) continue; const d = gdiff(r.a, ca, r.ma, dx, dy); if (d < bd) { bd = d; bx = dx; by = dy; } }
    if (bx || by) fine(Math.round(bx * 400 / 128), Math.round(by * 400 / 128));
  }
  const k = S.W / 400, sx = fx * k, sy = fy * k, sh = Math.hypot(sx, sy);
  // how much of the surroundings still lines up at that slide: a person in front of the camera spoils the average but not this
  // edges in the room that still line up exactly, at the best slide and with no slide at all
  const fm = fd < 9 ? 1 : gmatch(r.b, cb, r.eb, fx, fy, 14), f0 = fd < 9 ? 1 : (fx || fy ? gmatch(r.b, cb, r.eb, 0, 0, 14) : fm);
  S.dbg = [d0, fd, sx, sy, fm, f0];
  DBG.c.maxSh = Math.max(DBG.c.maxSh, sh); DBG.c.maxFd = Math.max(DBG.c.maxFd, fd);
  if (fd >= 9 && Math.max(fm, f0) >= 0.6) {
    // someone is in the picture, but the rest of the room still lines up: carry on with the part of the table we can see
    S.lostT = 0; S.lostSaid = false; DBG.c.blocked = (DBG.c.blocked || 0) + 1;
    if (fm >= f0 + 0.1 && sh <= 0.06 * S.W) { if (Math.hypot(sx - (r.lastSx || 0), sy - (r.lastSy || 0)) > 4 * S.W / 800) tableMoved(); r.lastSx = sx; r.lastSy = sy; applyShift(sx, sy); DBG.c.shift++; } else if (r.shifted && f0 >= fm) { if (Math.hypot(r.lastSx || 0, r.lastSy || 0) > 4 * S.W / 800) tableMoved(); applyShift(0, 0); r.lastSx = r.lastSy = 0; }
    return false;
  }
  if (fd < 9 && sh <= 0.06 * S.W) {
    S.lostT = 0; S.lostSaid = false;
    if (sh >= 1.2 || r.shifted) { if (Math.hypot(sx - (r.lastSx || 0), sy - (r.lastSy || 0)) > 4 * S.W / 800) tableMoved(); r.lastSx = sx; r.lastSy = sy; applyShift(sx, sy); DBG.c.shift++; }
    // the reference picture had a person in it (or the light changed): once the table is clear and steady, take a fresh one
    if (!fx && !fy && d0 >= 3 && !S.occFrac && S.stable >= 3) { if ((S.rebase = (S.rebase || 0) + 1) >= 10) { S.rebase = 0; dbg('rebase', { d0: r1(d0) }); refSnap(); return false; } } else S.rebase = 0;
    // a camera that is still wobbling gives smeared balls: wait for a calmer picture (at most a few passes in a row)
    const jump = S.lastSh ? Math.hypot(sx - S.lastSh[0], sy - S.lastSh[1]) : 0; S.lastSh = [sx, sy];
    if ((jump > 1.5 || fd > 5) && (S.shakeSkip = (S.shakeSkip || 0) + 1) <= 4) { DBG.c.skip++; return true; }
    S.shakeSkip = 0; return false;
  }
  // most of the surroundings changed: either the camera really moved, or someone is standing right in front of it.
  // Nothing is thrown away because of a person.
  if (!S.lostT) S.lostT = now;
  if (now - (S.sameT || 0) < 5000) return false; // the table was confirmed in place a moment ago: keep going
  if (now - (S.relockT || 0) < 1200 || now - (S.relockWait || 0) < 4000) return true;
  S.relockT = now; DBG.c.relock++;
  // 1) The rail diamonds are part of the table. If they are still where the outline puts them, the camera has not moved
  //    (or moved only a little, and the outline is nudged onto them). A person can hide a few, not most of them.
  const useDia = (S.diaLock || 0) >= 8, df = useDia ? diamondsFit() : null;
  dbg('relock', { d0: r1(d0), fd: r1(fd), fm: r2(fm), dia: df ? df.n : 0, moved: df ? r1(df.moved) : null });
  if (df) {
    const dev = S.quadAcc ? Math.max(...df.q.map((p, i) => { const v = vnFromSrc(p); return Math.hypot((v[0] - S.quadAcc[i][0]) * S.vr.vw, (v[1] - S.quadAcc[i][1]) * S.vr.vh); })) : 0, devMax = 0.008 * Math.max(S.vr.vw, S.vr.vh);
    // the diamonds say the outline is off from the accepted one: glare or people (ignored), or the camera really moved. Three
    // times in a row: look for the whole table again (below), which only moves the outline if it finds the same place twice.
    if (df.moved > 2.5 && dev > devMax) { S.refSkip = (S.refSkip || 0) + 1; dbg('refit_skip', { moved: r1(df.moved), dev: r1(dev), dia: df.n, n: S.refSkip }); if (S.refSkip < 3) return false; }
    else { S.refSkip = 0; S.sameT = now; S.lostT = 0; S.lostSaid = false; S.relockCand = null; }
    if (S.refSkip >= 3) { /* fall through to the full relock */ }
    else if (df.moved > 2.5) { setQuad(df.q, S.rot); S.quadN = S.quad.map(vnFromSrc); save(); tableMoved(); if (!S.occFrac) refSnap(); dbg('refit', { moved: r1(df.moved), dia: df.n, dev: r1(dev) }); }
    if (!(S.refSkip >= 3)) return false;
  }
  // 2) The diamonds are not where they should be. Only look for the table again once the picture has held still for about
  //    two seconds (people walking keep it changing) and nobody is over the table; then only close to where it was
  //    (never another table or a piece of this one), about the same size, and only if the same place is found twice in a row.
  if ((S.stillN || 0) < 6) { S.relockCand = null; return true; }
  const c = autoCalibrate(imgData(), S.ft), qd = (a, b) => { let d = 0; for (let i = 0; i < 4; i++) { let m = 1e9; for (let j = 0; j < 4; j++) m = Math.min(m, Math.hypot(a[j][0] - b[i][0], a[j][1] - b[i][1])); d += m / 4; } return d; };
  const area = q => Math.abs(polyArea(q));
  if (c.quad && c.conf >= 0.75) {
    const d = qd(c.quad, r.quad), ar = area(c.quad) / area(r.quad);
    dbg('relock_cand', { d: r1(d), area: r2(ar), conf: r2(c.conf) });
    if (d <= 4) { S.sameT = now; S.relockCand = null; S.refSkip = 0; return false; } // the table is where it was: someone is just in the way
    if (d <= 0.12 * S.W && ar > 0.8 && ar < 1.25) {
      if (S.relockCand && qd(c.quad, S.relockCand) < 10) {
        // last check: the rail diamonds must sit where the new outline puts them (a table half hidden by a person fails this)
        const cf = useDia ? diamondsFit(c.quad) : { q: c.quad, n: 0 }; dbg('relock_dia', { n: cf ? cf.n : 0, used: useDia });
        if (!cf) { S.relockCand = null; S.relockWait = now; return true; }
        // the ball positions are kept in table inches, so they stay right after the table outline moves
        setQuad(cf.q, S.rot); runDiamonds(true); S.diaLock = S.dia ? S.dia.n : S.diaLock; S.quadN = S.quad.map(vnFromSrc); S.quadAcc = S.quadN.map(p => p.slice()); save(); tableMoved(); S.lostT = 0; S.relockCand = null; S.refSkip = 0; refSnap(); toast('Camera moved. Table found again.'); return false;
      }
      S.relockCand = c.quad; return true;
    }
  }
  S.relockCand = null;
  if (now - S.lostT > 20000 && !S.lostSaid) { S.lostSaid = true; dbg('lost', {}); showCard('<div class="slimtxt"><b>Cannot see the table</b><span>If the phone was moved, find the table again. If someone is just in the way, keep playing.</span></div><div class="row"><button class="btn primary" data-act="retry">Find the table again</button><button class="btn" data-act="dismiss">Keep waiting</button></div>', 0, 'slim'); }
  if (S.mode === 'play9' || S.mode === 'play8') setStatus('Cannot see the table right now. Waiting for a clear view…');
  return true;
}
// After the table outline changes, positions jump a little: settle again before watching for a shot.
function tableMoved() { MT.on = false; S.settleT0 = null; S.stable = 0; S.armPos = null; S.noShotUntil = performance.now() + 2500; TR.pre = 0; S.snap = null; STILL.cnt = null; STILL.mask = null; }
// Are the rail diamonds where the current outline says? Returns the (slightly corrected) outline, or null.
function diamondsFit(q0) {
  q0 = q0 || S.quad; const hi = hiFrame(); if (!hi || !q0 || !S.vr) return null;
  const sc = hi.width / S.W, q = q0.map(p => [p[0] * sc, p[1] * sc]), fr = lensZ() * S.vr.z, pp = [S.vr.vw / 2 - S.vr.x, S.vr.vh / 2 - S.vr.y];
  const d = findDiamonds(hi, q, S.rot, S.ft, fr, pp), need = Math.max(5, Math.round(0.6 * (S.diaLock || 0)));
  if (d.n < need) return null;
  const rq = refineWithDiamonds(hi, q, S.rot, S.ft, fr, d, pp), nq = rq ? rq.map(p => [p[0] / sc, p[1] / sc]) : q0.map(p => p.slice());
  const moved = Math.max(...nq.map((p, i) => Math.hypot(p[0] - q0[i][0], p[1] - q0[i][1])));
  return { q: nq, n: d.n, moved };
}

// ---------- mode start and table calibration ----------
async function startMode(mode) {
  audioInit(); S.modeTok = (S.modeTok || 0) + 1;
  // Watch & Learn runs on top of 9-ball (same table finding, ball reading, shot following and result reading) with all the
  // planning and rules switched off; it only watches, listens and writes everything down.
  const quick = mode === 'quick', drill = mode === 'drill' || quick, watch = mode === 'watch' || drill; if (watch) mode = 'play9'; S.watch = watch; S.drillMode = drill; S.dr = quick ? quickNew() : drill ? drillNew() : null; S.quickThenWatch = false;
  const motionAsked = watch ? motionStart() : null; if (watch) LEARNED.clear(); S.touchDown = false; S.freezeUntil = 0;
  if (mode === 'play9' || mode === 'play8') dbgStart(quick ? 'quick' : drill ? 'drill' : watch ? 'watch' : mode); dbg('profile', { prof: S.prof, ft: S.ft, looks: S.samples.filter(x => x.walk).length, dropV23: S.dropV23 || undefined });
  S.truth = watch && !drill ? { rack: 1, target: 1, uncertain: false, why: 'start', looks: [], nArm: null, seen: false, pend: null, minArm: 99 } : null; FR.bef = null; FR.pend = null;
  S.mode = mode; S.phase = 'boot'; S.cands = []; S.balls = []; S.ev = {}; resetShotState(); S.meas = null; S.cal = null; S.drill = null; S.view = 'photo'; S.gone = [];
  if (mode === 'play9' || mode === 'play8') S.sess = { t0: Date.now(), shots: [], ignored: 0, game: mode === 'play9' ? '9ball' : '8ball' }; else S.sess = null;
  
  if (mode === 'play9') S.game = '9ball'; if (mode === 'play8') S.game = '8ball';
  if (watch) { S.sess.watch = true; S.sess.drill = drill || undefined; frameSessionStart(S.sess.t0); }
  $('#home').hidden = true; $('#cam').hidden = false; $('#modeLbl').textContent = MODE_LBL[quick ? 'quick' : drill ? 'drill' : watch ? 'watch' : mode] + (S.prof === 'away' ? ' · Away' : '');
  $('#planBtn').hidden = !(mode === 'play9' || mode === 'play8') || watch; renderMenu(); updHud(); hideCard();
  try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => { }); } catch (e) { }
  if (motionAsked) await Promise.race([motionAsked, sleep(20000)]);
  const ok = await startCamera(); if (!ok) return;
  if (watch && S.micOn) micStart(); // after the camera, so the two permission questions do not overlap
  if (watch && S.zoom && S.zoom.z > 1.02) setZoom(1, 0.5, 0.5);
  if (mode === 'learn') { S.phase = 'run'; S.view = 'photo'; document.body.classList.add('learnmode'); syncSize(); grab(); learnStart(); return; }
  await waitLandscape(); if (S.mode !== mode || !S.live) return;
  await setCamZoom(1, 'start'); S.camZoom = 1; // 1x, the main camera (never the ultra-wide)
  if (S.mode !== mode || !S.live) return;
  // The phone may have been picked up since last time: always find the table fresh from where the camera is now.
  beginAuto();
}
// anything waiting on a shot, or about what blocks the view, belongs to one session on one table
function resetShotState() { MT.on = false; MT.last = null; S.settleT0 = null; S.settling = null; S.snap = null; S.lastBefore = null; S.fix = null; STILL.cnt = null; STILL.mask = null; S.stillN = 0; S.lastCa = null; S.noShotUntil = 0; S.relockCand = null; S.pend = null; S.awaitAfter = false; S.armTrust = false; S.occ = null; S.occFrac = 0; S.tableN = null; S.armAll = 0; S.holdT = 0; S.lostT = 0; S.lostSaid = false; S.sameT = 0; S.rebase = 0; }
function beginAuto() {
  S.phase = 'auto'; S.calRes = null; S.cands = []; hideCard(); setStatus('Looking for the felt and pockets…');
  let tries = 0, best = null;
  const step = () => {
    if (S.phase !== 'auto' || !S.live) return;
    if (!isLand()) { setTimeout(step, 300); return; }
    grab(); const r = autoCalibrate(imgData(), S.ft); tries++;
    if (r.quad && (!best || r.conf > best.conf)) best = r;
    if ((best && best.conf >= 0.85) || tries >= 7) { finishAuto(best); return; }
    setTimeout(step, 260);
  };
  setTimeout(step, 400);
}
function finishAuto(best) {
  S.phase = 'verify';
  if (!best || !best.quad) { S.calRes = { conf: 0, tips: ['The felt was not found. Make sure the whole table is in view, the lights are on, and nothing is draped over the cloth.'], corners: 0, sides: 0 }; S.dia = null; setQuad([[S.W * .2, S.H * .25], [S.W * .8, S.H * .25], [S.W * .85, S.H * .8], [S.W * .15, S.H * .8]], 0); }
  else { S.calRes = best; setQuad(best.quad, best.rot); if (!S.ftSet) autoSize(true); runDiamonds(true); }
  // a clear lock on a table whose size you already confirmed: just start
  if (best && best.quad && best.conf >= 0.85 && S.ftSet && S.dia && S.dia.n >= 12) { dbg('autolock', { conf: r2(best.conf), dia: S.dia.n }); setStatus(''); acceptTable(); toast('Table found (' + S.ft + ' ft).'); return; }
  setStatus(''); showVerify();
}
function showVerify() {
  const r = S.calRes || { conf: 0, tips: [], corners: 0, sides: 0 }, good = r.conf >= 0.7, d = S.dia;
  const title = good ? 'Table found' : 'Not sure about this one';
  const edge = S.quad && edgeNear(S.quad);
  const sub = [d ? 'Diamonds ' + d.n + ' of ' + d.exp : '', edge ? 'A pocket is at the edge of the picture: move the phone back or higher.' : '', good ? 'Drag a dot if the outline is off the pockets.' : ((r.tips && r.tips[0]) || 'Try again, or tap the four corner pockets.')].filter(Boolean).join(' · ');
  const btns = good ? '<button class="btn primary" data-act="accept">Looks right</button><button class="btn" data-act="retry">Retry</button><button class="btn" data-act="manual">Tap pockets</button>' : '<button class="btn primary" data-act="retry">Retry</button><button class="btn" data-act="manual">Tap pockets</button><button class="btn" data-act="accept">Use anyway</button>';
  const sizes = '<div class="row sizes"><span class="lbl">Table</span>' + [7, 8, 9].map(f => '<button class="chip' + (S.ft === f ? ' on' : '') + '" data-act="ft' + f + '">' + f + ' ft</button>').join('') + '</div>';
  showCard('<div class="slimtxt"><b>' + title + '</b><span>' + sub + '</span></div>' + sizes + '<div class="row">' + btns + '</div>', 0, 'slim');
}
function beginManual() { S.phase = 'manual'; S.man = { i: 0, pts: [], hold: null }; showManual(); }
const MAN_NAMES = ['top-left', 'top-right', 'bottom-right', 'bottom-left'];
function showManual() {
  const m = S.man;
  showCard('<div class="slimtxt"><b>Tap the ' + MAN_NAMES[m.i] + ' corner pocket</b><span>Press and slide to the middle of the pocket, then lift. Side pockets are assumed.</span></div><div class="dots">' + [0, 1, 2, 3].map(i => '<i class="' + (i < m.i ? 'on' : '') + '"></i>').join('') + '</div><div class="row"><button class="btn" data-act="undo">Undo</button><button class="btn" data-act="retry">Back to auto</button></div>', 0, 'slim');
}
// The table map is painted in the player's own cloth colour: the middle colour of the cloth the camera sees, taken once
// when the table is found and kept for the session (and remembered for next time).
function sampleFelt() {
  if (!S.cam || !S.cloth || !S.src) return;
  try {
    const img = imgData(), W = img.width, H = img.height, Hm = S.cam.Hit, P = S.P, rs = [], gs = [], bs = [];
    for (let y = 0; y < H; y += 3) for (let x = 0; x < W; x += 3) {
      const w = Hm[6] * x + Hm[7] * y + Hm[8], tx = (Hm[0] * x + Hm[1] * y + Hm[2]) / w, ty = (Hm[3] * x + Hm[4] * y + Hm[5]) / w;
      if (tx < 4 || ty < 4 || tx > P.L - 4 || ty > P.W - 4) continue;
      const o = (y * W + x) * 4, r = img.data[o], g = img.data[o + 1], b = img.data[o + 2], [h, sa, v] = rgb2hsv(r, g, b);
      if (!isCloth(h, sa, v, S.cloth)) continue; rs.push(r); gs.push(g); bs.push(b);
    }
    if (rs.length < 200) return;
    const med = a => { a.sort((p, q) => p - q); return a[a.length >> 1]; };
    S.felt = [med(rs), med(gs), med(bs)]; CSSC = {}; feltCache = null; dbg('felt', { rgb: S.felt, n: rs.length });
  } catch (e) { }
}
function acceptTable() {
  sampleFelt();
  // the size shown on the card is the one the player accepted
  S.ftSet = true; S.quadN = S.quad.map(vnFromSrc); S.diaLock = S.dia ? S.dia.n : 0; S.quadAcc = S.quadN.map(p => p.slice()); save(); enterRun();
  if (S.watch) autoFrame();
  if (S.watch && !S.drillMode && S.prof === 'away' && !S.quickDone) showCard('<div class="slimtxt"><b>Away table: show me the balls first?</b><span>About 2 minutes. Put each ball on the table when asked, no shooting. The app learns this table\'s balls before you play.</span></div><div class="row"><button class="btn primary" data-act="quickGo">Show me the balls</button><button class="btn" data-act="dismiss">Skip</button></div>', 0, 'slim');
}
// Watch & Learn: zoom the working picture onto the table and its rails (with some room around it), so the balls get as many
// pixels as the camera has. From the side the table is a thin strip, and on the far side a ball was only a few pixels across.
function autoFrame() {
  try {
    if (!S.cam || !S.vr) return; const P = S.P, m = 7;
    const vn = [[-m, -m], [P.L + m, -m], [P.L + m, P.W + m], [-m, P.W + m]].map(([x, y]) => vnFromSrc(S.cam.proj(x, y, 0)));
    let u0 = Math.min(...vn.map(p => p[0])), u1 = Math.max(...vn.map(p => p[0])), v0 = Math.min(...vn.map(p => p[1])), v1 = Math.max(...vn.map(p => p[1]));
    const pu = (u1 - u0) * 0.06, pv = (v1 - v0) * 0.25 + 0.03; u0 = Math.max(0, u0 - pu); u1 = Math.min(1, u1 + pu); v0 = Math.max(0, v0 - pv); v1 = Math.min(1, v1 + pv);
    const z = clamp(Math.min(1 / (u1 - u0), 1 / (v1 - v0)), 1, 2.5);
    dbg('autoframe', { z: r2(z), box: [r2(u0), r2(v0), r2(u1), r2(v1)] });
    if (z < 1.12) return;
    setZoom(z, (u0 + u1) / 2, (v0 + v1) / 2); S.diaLock = 0; runDiamonds(false); S.diaLock = S.dia ? S.dia.n : 0; S.quadAcc = S.quad.map(vnFromSrc);
  } catch (e) { dbg('error', { m: 'autoframe ' + String(e).slice(0, 80) }); }
}
function enterRun() {
  resetShotState();
  S.phase = 'run'; S.stable = 0; S.armPos = null; S.ref = null; S.failN = 0; S.sizeBad = 0; S.balls = []; S.cands = []; hideCard(); updHud();
  if (S.drillMode && S.dr && S.dr.quick) { quickSetSpot(); setStatus(quickStatus()); }
  else if (S.drillMode && S.dr) { S.dr.plan = null; drillSetSpot(); /* planned for where the camera is now */ setStatus(drillHead() + ' · put the ' + S.dr.ball + ' and the cue ball on the table'); }
  else if (S.mode === 'play9' || S.mode === 'play8') setStatus('Waiting for the balls to settle…');
  else if (S.mode === 'train') { setStatus(''); nextDrill(); }
  else if (S.mode === 'teach') { setStatus(''); showTeachCard(); }
  else if (S.mode === 'calib') { S.cal = { step: 0, shots: [], counts: {} }; showCalCard(); }
  if (S.geo || S.geoPending) { S.geoPending = false; S.geo = null; const tok = S.modeTok; setTimeout(() => { if (S.modeTok === tok && S.phase === 'run') geoStart(); }, 300); } // (table found again: the true spots are worked out anew)
}

// ---------- the recognizer on live spots (V2.3) ----------
// Each spot is cut from the full-size camera picture (the library it learned from was too), 3.2 ball radii across.
const RC = { cv: null, cx: null, n: 0, nb: 0, ms: 0 };
const NO_RECOG = /[?&]norecog=1/.test(location.search); // the old test videos have drawn balls the recognizer never learned
function recogFound(list) {
  if (!RECOG || NO_RECOG || !list.length) return;
  try {
    if (!RC.cv) { RC.cv = document.createElement('canvas'); RC.cv.width = RC.cv.height = RECOG.S; RC.cx = RC.cv.getContext('2d', { willReadFrequently: true }); }
    // (S.recSrc: a full-size picture for offline tests, {c, k} with k = its width / the working picture's width)
    const t0 = performance.now(), live = S.live && vid.videoWidth && S.vr, rs = !live && S.recSrc, sx = live ? S.vr.w / S.W : rs ? rs.k : 1, sy = live ? S.vr.h / S.H : rs ? rs.k : 1, src = live ? vid : rs ? rs.c : S.src;
    for (const b of list) {
      if (b.rec || b.px == null) continue;
      const r = Math.max(3, b.rpx || 6) * sx, s = 3.2 * r, x = (live ? S.vr.x : 0) + b.px * sx - s / 2, y = (live ? S.vr.y : 0) + b.py * sy - s / 2;
      RC.cx.fillStyle = '#000'; RC.cx.fillRect(0, 0, RECOG.S, RECOG.S); RC.cx.drawImage(src, x, y, s, s, 0, 0, RECOG.S, RECOG.S);
      b.rec = recogRun(RC.cx.getImageData(0, 0, RECOG.S, RECOG.S).data); RC.n++;
    }
    RC.ms = Math.max(RC.ms, performance.now() - t0);
  } catch (e) { dbgOnce('recerr', 30000, 'error', { m: 'recognizer ' + String(e).slice(0, 80) }); }
}
// Spots the recognizer is sure are not balls (fingers, a sleeve, the cue) are dropped, unless a ball has been sitting right
// there for a while (a ball is never thrown away on one picture) or it is where the drill ball was last seen.
function dropNotBalls(found, prev, after) {
  if (!RECOG) return found;
  const tn = performance.now(); S.nbTr = (S.nbTr || []).filter(q => tn - q.t < 2000);
  return found.filter(f => {
    const p = f.rec; if (!p) return true; let mb = 0; for (let c = 0; c < 10; c++) mb = Math.max(mb, p[c]);
    // fingers and sleeves usually come as a blob split into several "balls"; a single round spot must be very clearly not a ball
    // (after a shot two balls can come to rest touching, which also splits: there only a clearly ragged or certain spot goes)
    if (!(p[RECOG_NB] > 0.8 && p[RECOG_NB] > 3 * mb && ((!after && (f.k || 1) >= 2) || (f.fill || 1) < 0.55 || p[RECOG_NB] > 0.97))) return true;
    if (prev.some(q => q.id != null && !q.miss && ((q.obs || []).length >= 4 || q.locked) && Math.hypot(q.x - f.x, q.y - f.y) < 1)) return true;
    if (S.drillMode && S.dr && S.dr.objAt && Math.hypot(f.x - S.dr.objAt[0], f.y - S.dr.objAt[1]) < 2) return true; // the drill ball where it was last seen
    // hands move and come with a person over the table; a ball sits still. Kept once it has stayed on one spot for 1 s with
    // nobody over the table, or for 4 s whatever else is going on.
    if (!after) { let q = S.nbTr.find(q => Math.hypot(q.x - f.x, q.y - f.y) < 0.8); if (q) { q.t = tn; q.n++; } else S.nbTr.push(q = { x: f.x, y: f.y, t0: tn, t: tn, n: 1 });
      // V2.3.2: only a single round spot (bridge-hand pieces resting on the rail come split and ragged, and were kept)
      if ((f.k || 1) === 1 && (f.fill || 1) >= 0.55 && ((q.n >= 4 && tn - q.t0 >= 2500 && (S.occFrac || 0) <= 0.005) || (q.n >= 8 && tn - q.t0 >= 4000))) { if (!q.kept) { q.kept = 1; dbg('nb_keep', { at: [r1(f.x), r1(f.y)], n: q.n }); } return true; } }
    RC.nb++; f.notBall = true; f.since = performance.now(); (S.nbSeen = S.nbSeen || []).push(f); if (S.nbSeen.length > 40) S.nbSeen.shift(); return false;
  });
}

// V2.3.3: every ~5 s with nobody at the table, look once without the learned cushion shadows: a round spot there that the
// recognizer is sure is a ball (one was learned as "shadow" while a hand hid it, or it was set down on the strip) frees the
// learned cells under it and is a ball from now on
function maskRecheck(found) {
  const plain = detectBalls(imgData(), S.cam, S.P, S.cloth, {}), add = []; recogFound(plain);
  const R = S.P.R, cs = STILL.cs, gw = STILL.gw, m = STILL.mask;
  for (const f of plain) {
    if (found.some(g => Math.hypot(g.x - f.x, g.y - f.y) < 1.5) || f.k !== 1 || (f.fill || 0) < 0.55 || !f.rec) continue;
    let mb = 0; for (let c = 0; c < 10; c++) mb = Math.max(mb, f.rec[c]); if (f.rec[RECOG_NB] > 0.3 || mb < 0.6) continue;
    // the cells its picture falls on (as the detector maps them: on the cloth, or at ball height past a far cushion)
    let n = 0; const cam = S.cam, rr = 1.3 * f.rpx, P = S.P;
    for (let y = Math.floor(f.py - rr); y <= f.py + rr; y++) for (let x = Math.floor(f.px - rr); x <= f.px + rr; x++) {
      if ((x - f.px) ** 2 + (y - f.py) ** 2 > rr * rr) continue;
      let t = cam.unproj(x, y, 0); if (t[0] < 0 || t[1] < 0 || t[0] > P.L || t[1] > P.W) t = cam.unproj(x, y, R);
      const i = Math.floor(t[0] / cs), j = Math.floor(t[1] / cs); if (i < 0 || j < 0 || i >= gw || j >= STILL.gh) continue;
      const k = j * gw + i; if (m[k]) { m[k] = 0; n++; } }
    if (n) { dbg('unmask', { at: [r1(f.x), r1(f.y)], cells: n, top: recogTop(f.rec) }); add.push(f); }
  }
  return add;
}
// a ball that dropped out of the list (blinked out, or under a hand) is remembered for 10 s, so if it comes back on the
// same spot it is not taken for something new (the young-ball rule at shot start)
function lostSp(p) { if (p.since) (S.lostSp = S.lostSp || []).push({ x: p.x, y: p.y, since: p.since, t: performance.now() }); if (S.lostSp.length > 40) S.lostSp.shift(); }
// ---------- live loops ----------
let rafId = 0, scanTimer = 0, scanN = 0, frameN = 0, lastDraw = 0;
function startLoops() { hookFrames(); if (!rafId) rafId = requestAnimationFrame(frame); clearInterval(scanTimer); scanTimer = setInterval(() => { const t0 = performance.now(); liveScan(false); lagT('scan', t0); }, 330); }
function stopLoops() { cancelAnimationFrame(rafId); rafId = 0; clearInterval(scanTimer); LAG.last = 0; }
// Stall meter: screen frames that came late (over 100 ms apart) and the longest each kind of work took, written into the
// heartbeat every 5 s, so a laggy session shows what was running.
const LAG = { n: 0, max: 0, last: 0, w: {} };
function lagT(k, t0) { const d = performance.now() - t0; if (d > (LAG.w[k] || 0)) LAG.w[k] = d; }
function frame(ts) {
  rafId = 0; if (!S.live) return;
  if (LAG.last && ts - LAG.last > 100 && !document.hidden) { LAG.n++; LAG.max = Math.max(LAG.max, ts - LAG.last); } LAG.last = ts;
  frameN++; syncSize(); if (!VF.on) trackFrame();
  if (ts - lastDraw > 30) { lastDraw = ts; const t0 = performance.now(); render(); lagT('draw', t0); }
  rafId = requestAnimationFrame(frame);
}
// ---------- names keep being re-checked (V2.3.1) ----------
// While the balls sit still, every look at a ball adds how well it matches each number (recognizer, colour guesses,
// learned looks) to that ball's running total. The totals stay with the ball as long as its name does (the name follows
// the ball: same spot, or its path through a shot). When the totals clearly say the names are mixed up (the 4 and the 7
// swapped, the 8 called the 3), the names are swapped to match. A ball you named by hand is never changed.
const EV = { B: 0.3, M: 0.45, N: 6 };
function evForget(found) { if (!S.ev) S.ev = {}; for (const f of found) if (f.id != null && !f.locked) delete S.ev[f.id]; }
function evShrink(ids) { if (!S.ev) return; for (const id of ids) { const e = S.ev[id]; if (e && e.n > 3) { for (let i = 0; i < 10; i++) e.s[i] *= 3 / e.n; e.n = 3; } } }
function evOn() { return S.watch ? !S.drillMode : (S.mode === 'play9' || S.mode === 'play8'); }
function evAdd(found) {
  if (!S.ev) S.ev = {}; if (!evOn() || S.stable < 2 || S.recording || S.awaitAfter) return;
  const ids = candIds().filter(i => i <= 9), sm = allSamples(), R = S.P.R, pen = recPen();
  for (const b of found) {
    if (b.id == null || b.id > 9 || b.miss || b.hid || b.pin || !b.feat || (b.mvd || 0) > 0.3 || (b.obs || []).length < 3) continue;
    if (found.some(o => o !== b && !o.miss && Math.hypot(o.x - b.x, o.y - b.y) < 2.4 * R)) continue; // touching another ball: the picture of it is mixed
    const c = idCost(b, ids, sm, S.cloth, pen), e = S.ev[b.id] || (S.ev[b.id] = { s: new Array(10).fill(0), n: 0 });
    if (e.n >= 40) { for (let i = 0; i < 10; i++) e.s[i] *= 39 / 40; e.n = 39; } // the last 40 looks count
    for (let i = 0; i < 10; i++) e.s[i] += Math.min(3, c[i] !== undefined ? c[i] : 3); e.n++;
  }
}
function recheckNames(found) {
  if (!S.ev || !evOn() || S.stable < 3 || S.pend || S.awaitAfter || S.recording || TR.rec) return;
  const balls = found.filter(b => b.id != null && b.id <= 9 && !b.miss && !b.hid && !b.pin && S.ev[b.id] && S.ev[b.id].n >= EV.N);
  if (!balls.length) return;
  const fixed = new Set(found.filter(b => b.id != null && (b.pin || !balls.includes(b))).map(b => b.id)), gone = new Set(S.gone || []);
  const ids = candIds().filter(i => i <= 9 && !fixed.has(i)), n = balls.length, m = ids.length;
  if (m < n) return;
  const mean = (b, id) => S.ev[b.id].s[id] / S.ev[b.id].n, C = [];
  // a number already made costs 1.0 more: the ball has to be very clearly it (the made call was wrong) to bring it back
  for (const b of balls) C.push(ids.map(id => mean(b, id) - (id === b.id ? EV.B : 0) + (gone.has(id) && id !== b.id ? 1 : 0)));
  for (let r = n; r < m; r++) C.push(ids.map(() => 0));
  const as = hungarian(C), ch = [];
  for (let r = 0; r < n; r++) { const b = balls[r], id = ids[as[r]]; if (id !== b.id) ch.push({ b, from: b.id, to: id, gain: C[r][ids.indexOf(b.id)] - C[r][as[r]] }); }
  if (!ch.length) return;
  // every ball that changes must clearly fit its new number better than its old one
  if (ch.some(c => mean(c.b, c.from) - mean(c.b, c.to) < EV.M)) { dbgOnce('names_no', 8000, 'names_no', { ch: ch.map(c => [c.from, c.to, r2(mean(c.b, c.from) - mean(c.b, c.to))]) }); return; }
  const ev = {}; for (const k of Object.keys(S.ev)) ev[k] = S.ev[k];
  for (const c of ch) { ev[c.to] = S.ev[c.from]; if (!ch.some(o => o.to === c.from)) delete ev[c.from]; }
  for (const c of ch) { c.b.id = c.to; c.b.conf = 0.8; c.b.rechecked = true; if (gone.has(c.to)) { S.gone = S.gone.filter(i => i !== c.to); dbg('ungone', { id: c.to }); } }
  S.ev = ev;
  dbg('names_fixed', { ch: ch.map(c => ({ from: c.from, to: c.to, at: [r1(c.b.x), r1(c.b.y)], fit: [r2(mean(c.b, c.to)), r2(S.ev[c.to] ? S.ev[c.to].s[c.from] / S.ev[c.to].n : 0)], looks: S.ev[c.to] ? S.ev[c.to].n : 0 })) });
  if (S.watch && !(S.holdT && performance.now() < S.holdT)) holdStatus('Names fixed: ' + ch.map(c => (c.to === 0 ? 'cue ball' : 'the ' + c.to)).join(', ') + '.', 1500);
}
function mergeLabels(found) {
  // a ball keeps the number it had if it is still (about) where it was; closest pairs first so neighbours cannot trade numbers
  const prev = S.balls.filter(b => b.id != null && labelIds().includes(b.id)), pairs = [], reach = 2.6;
  found.forEach((f, fi) => prev.forEach((p, pi) => { const d = Math.hypot(p.x - f.x, p.y - f.y); if (d < reach) pairs.push([d, fi, pi]); }));
  pairs.sort((a, b) => a[0] - b[0]); const uf = new Set(), up = new Set();
  for (const [, fi, pi] of pairs) { if (uf.has(fi) || up.has(pi)) continue; uf.add(fi); up.add(pi); const f = found[fi], p = prev[pi]; f.id = p.id; f.locked = true; f.conf = p.conf || 1; }
  assignIds(found, labelIds(), allSamples(), S.cloth, { recPen: recPen() }); evForget(found);
}
// A diamond is an eighth of the long rail. For now a ball has to travel a whole diamond before the app says the balls are moving.
const diamond = () => S.P.L / 8;
const stickTol = () => S.P.L / 16;
// Compare two lists of numbered balls by number: how far did the ones in both move, and how many numbers came or went.
function idDiff(a, b) {
  const m = new Map(a.filter(x => x.id != null).map(x => [x.id, x])); let mv = 0, diff = 0, seen = 0, who = null;
  for (const y of b) { if (y.id == null) continue; const x = m.get(y.id); if (x) { const d = Math.hypot(x.x - y.x, x.y - y.y); if (d > mv) { mv = d; who = y.id; } seen++; } else diff++; }
  diff += m.size - seen; return { mv, diff, who };
}
// 9-ball: if exactly one ball on the table has no number and exactly one number is unaccounted for, that is its number.
function eliminate(found) {
  if (S.watch) return; // V2.3.3: off in Watch; it once named a pocket shadow the 1 and the name then stuck
  if (S.mode !== 'play9' || S.game !== '9ball' || S.drillMode) return;
  const un = found.filter(b => b.id == null); if (un.length !== 1) return;
  const have = new Set(found.filter(b => b.id != null).map(b => b.id));
  if (have.size + 1 >= 10) S.gone = []; // a full table is a new rack
  const gone = new Set(S.gone || []), missing = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(i => !have.has(i) && !gone.has(i));
  if (missing.length === 1) { un[0].id = missing[0]; un[0].conf = 0.3; un[0].elim = true; }
}
// V2.3.3, after every shot: the ball named the cue ball must look white. If the recognizer is sure it is a coloured ball,
// the cue name goes to the whitest other ball (if one clearly is the cue ball) and the rest are named again.
function cueCheck(found, cand) {
  const f = found.find(b => b.id === 0); if (!f) return null;
  const bad = f.rec ? f.rec[0] < 0.05 && Math.max(...f.rec.slice(1, 10)) > 0.85 : !!(f.feat && f.feat.wf < 0.2); if (!bad) return null;
  let g = null; for (const b of found) if (b !== f && b.rec && b.rec[0] > 0.8 && (!g || b.rec[0] > g.rec[0])) g = b;
  const was = { at: [r1(f.x), r1(f.y)], rec: f.rec ? recogTop(f.rec) : null, to: g ? [r1(g.x), r1(g.y), g.id] : null };
  if (!g) { was.kept = true; dbg('cue_check', was); return was; } // nothing clearly white to give it to: only noted (never a made-up scratch)
  f.id = null; f.locked = false; f.conf = 0; f.path = 0; g.id = 0; g.locked = true; g.conf = 0.8;
  assignIds(found, cand, allSamples(), S.cloth, { recPen: recPen() });
  was.now = f.id == null ? null : f.id; dbg('cue_check', was); return was;
}
// Is there something that is not felt where a hand-placed ball sits?
function spotHasBall(b) {
  if (!S.cam || !S.cloth) return true; const img = imgData(), q = S.cam.proj(b.x, b.y, S.P.R), r = Math.max(2, S.cam.ballRad(b.x, b.y, S.P.R, S.P.R) * 0.6); let n = 0, fg = 0;
  for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
    if (dx * dx + dy * dy > r * r) continue; const x = Math.round(q[0] + dx), y = Math.round(q[1] + dy); if (x < 0 || y < 0 || x >= S.W || y >= S.H) continue;
    const o = (y * S.W + x) * 4, [h, s, v] = rgb2hsv(img.data[o], img.data[o + 1], img.data[o + 2]); n++; if (!isCloth(h, s, v, S.cloth)) fg++;
  }
  return n > 4 && fg / n > 0.5;
}
// Is this ball's spot covered by something blocking the view (a player, an arm, the cue)? Then we simply cannot see it.
function hiddenAt(b, occ) {
  occ = occ === undefined ? S.occ : occ; if (!occ || !S.cam) return false;
  const q = S.cam.proj(b.x, b.y, S.P.R), gx = (q[0] / occ.cs) | 0, gy = (q[1] / occ.cs) | 0;
  if (gx < 0 || gy < 0 || gx >= occ.gw || gy >= occ.gh) return false; return !!occ.g[gy * occ.gw + gx];
}
const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2; };
// One number, one ball. If two balls end up with the same number, the better-supported one keeps it.
function dedupeIds(found) {
  const by = new Map(), drop = new Set(), score = x => (x.pin ? 8 : 0) + (x.miss || x.hid ? 0 : 4) + (x.locked ? 2 : 0) + (x.conf || 0);
  for (const b of found) {
    if (b.id == null) continue; const o = by.get(b.id); if (!o) { by.set(b.id, b); continue; }
    const loser = score(b) > score(o) ? o : b; if (loser === o) by.set(b.id, b);
    dbg('dup', { id: b.id, at: [r1(loser.x), r1(loser.y)], kept: [r1(by.get(b.id).x), r1(by.get(b.id).y)] });
    if (loser.miss || loser.hid) drop.add(loser); else { loser.id = null; loser.conf = 0; loser.locked = false; }
  }
  return drop.size ? found.filter(b => !drop.has(b)) : found;
}
// ---------- a shot the camera did not see (the player was in the way) ----------
// The last settled table is remembered. When the table is settled and in clear view again with no shot recorded in between,
// and the cue ball has moved and at least one other ball moved or went down, a shot happened while the view was blocked.
// It is recorded from the before and after layouts (no speed, first ball hit unknown). The cue ball alone moving is ball in
// hand, not a shot; more balls than before is a new rack.
function unseenCheck(found) {
  if (S.drillMode) return; // in the drill, balls set up for the next shot are not a shot (drillUnseen catches a missed make)
  if (!(S.mode === 'play9' || S.mode === 'play8') || S.pend || TR.rec || S.recording || S.awaitAfter) return;
  const clear = S.occFrac <= 0.02 && !found.some(b => b.hid || b.miss) && S.stable >= 3; if (!clear) return;
  const all = found.map(b => ({ id: b.id, x: b.x, y: b.y })), mk = () => ({ balls: all, t: Date.now() });
  const snap = S.snap; if (!snap) { S.snap = mk(); return; }
  // movement is judged on named balls only, and a drop has to show in both the named and the full count: an unnamed spot
  // flickering (a ghost, a chalk cube) or a ball losing its name must not turn ball in hand into a shot
  const nA = snap.balls.filter(b => b.id != null), nB = all.filter(b => b.id != null);
  const cueA = nA.find(b => b.id === 0), cueB = nB.find(b => b.id === 0);
  const movedObj = nA.filter(p => p.id !== 0 && !nB.some(q => Math.hypot(q.x - p.x, q.y - p.y) < 3)).length;
  const dropAll = snap.balls.length - all.length, drop = Math.min(dropAll, nA.length - nB.length);
  const cueMoved = !cueB || !cueA || Math.hypot(cueA.x - cueB.x, cueA.y - cueB.y) > 3;
  if (all.length >= snap.balls.length + 2) { S.snap = mk(); return; } // balls added: a new rack
  // the balls put back where the last shot started from (practising the same shot again) is not a shot
  const lb = S.lastBefore, same = lb && lb.length === nB.length && nB.every(p => lb.some(q => q.id === p.id && Math.hypot(q.x - p.x, q.y - p.y) < 3));
  if (same) { S.snap = mk(); return; }
  if (cueMoved && (movedObj >= 1 || drop >= 1) && dropAll >= 0) {
    const ids = nA.map(b => b.id);
    dbg('unseen', { movedObj, drop, before: dbgBalls(nA), now: dbgBalls(found), handOnly: (S.watch && movedObj === 0 && nA.every(p => p.id === 0 || nB.some(q => q.id === p.id))) || undefined });
    S.snap = mk();
    // Watch & Learn: the cue ball picked up (or moved) with no object ball moved or gone is ball in hand, not a shot; it was
    // saved as one. Only written down.
    if (S.watch && movedObj === 0 && nA.every(p => p.id === 0 || nB.some(q => q.id === p.id))) return;
    shotResult({ before: nA, ids, end: null, allN: snap.balls.length, trust: true, shot: { failed: true, unseen: true }, cueGone: false, seen: new Set(), maxSeen: 0, t0: performance.now() }, found.filter(b => !b.miss), true);
    return;
  }
  // nothing that looks like a shot (a nudge, ball in hand, drift): follow the table as it is now
  S.snap = mk();
}

// ---------- fixed shadows and bright edges along the cushions ----------
// In the first few seconds on a freshly found table, anything dark or bright that sits still right along a cushion in every
// look (the cushion's shadow, its lit edge) is learned as part of the table. It is kept in table inches, so a small camera
// slide does not undo it. Spots under real balls are never learned.
const STILL = { cs: 0.25, gw: 0, gh: 0, cnt: null, n: 0, mask: null, need: 8 };
function stillReset() {
  const P = S.P; STILL.gw = Math.ceil(P.L / STILL.cs) + 1; STILL.gh = Math.ceil(P.W / STILL.cs) + 1; const N = STILL.gw * STILL.gh;
  STILL.cnt = new Uint8Array(N); STILL.n = 0; STILL.mask = null;
  // per-scan buffers are kept and cleared rather than made new every scan (phone memory)
  STILL.buf = { hit: new Uint8Array(N), sr: new Float32Array(N), sg: new Float32Array(N), sb: new Float32Array(N), sn: new Uint16Array(N), dk: new Uint16Array(N), cl: new Uint16Array(N), ot: new Uint16Array(N) };
  STILL.acc = { sr: new Float32Array(N), sg: new Float32Array(N), sb: new Float32Array(N), sn: new Float32Array(N) };
  STILL.hc = new Uint16Array(N); STILL.hd = new Uint16Array(N); STILL.hn = 0;
}
function stillInfo() {
  if (!STILL.cnt || STILL.gw !== Math.ceil(S.P.L / STILL.cs) + 1) stillReset(); const B = STILL.buf;
  if (STILL.mask) { B.dk.fill(0); B.cl.fill(0); B.ot.fill(0); return { cs: STILL.cs, gw: STILL.gw, mask: STILL.mask, mr: STILL.mr, mg: STILL.mg, mb: STILL.mb, dk: B.dk, cl: B.cl, ot: B.ot }; }
  B.hit.fill(0); B.sr.fill(0); B.sg.fill(0); B.sb.fill(0); B.sn.fill(0);
  return { cs: STILL.cs, gw: STILL.gw, hit: B.hit, sr: B.sr, sg: B.sg, sb: B.sb, sn: B.sn };
}
// a learned spot that shows plain cloth again (over about six scans, so far-side spots with only a pixel or two per scan
// count too) was not a fixed shadow (an arm resting on the table while it learned, a glove picked up) and is given back
function stillHeal(st) {
  if (!STILL.mask || !st || !st.cl) return;
  const m = STILL.mask, hc = STILL.hc, hd = STILL.hd;
  for (let k = 0; k < m.length; k++) if (m[k]) { hc[k] += st.cl[k]; hd[k] += st.dk[k] + st.ot[k]; }
  if (++STILL.hn < 6) return;
  let freed = 0;
  for (let k = 0; k < m.length; k++) { if (m[k] && hc[k] >= 3 && hd[k] * 20 < hc[k]) { m[k] = 0; freed++; } }
  hc.fill(0); hd.fill(0); STILL.hn = 0;
  if (freed) { STILL.freed = (STILL.freed || 0) + freed; if (!STILL.saidFree && STILL.freed > 40) { STILL.saidFree = true; dbg('still_free', { cells: STILL.freed }); } }
}
function stillLearn(st, found) {
  if (STILL.mask) return stillHeal(st);
  if (!st || !st.hit) return;
  const A = STILL.acc;
  for (let i = 0; i < st.hit.length; i++) if (st.hit[i]) { STILL.cnt[i]++; A.sr[i] += st.sr[i]; A.sg[i] += st.sg[i]; A.sb[i] += st.sb[i]; A.sn[i] += st.sn[i]; }
  if (++STILL.n < STILL.need) return;
  const P = S.P, R = P.R, band = 4.5 * R, m = new Uint8Array(STILL.cnt.length), cs = STILL.cs; let on = 0;
  // Spots under anything found as a ball (frozen to a rail too) are never learned, judged on the picture itself: a ball's
  // image reaches well past its spot on the cloth, most of all on the far side.
  const cam = S.cam;
  const disc = b => { const c = cam.proj(b.x, b.y, R); return { u: c[0], v: c[1], r: cam.ballRad(b.x, b.y, R, R) }; };
  const hits = (list, x, y) => { const p = cam.proj(x, y, 0); return list.some(d => Math.hypot(p[0] - d.u, p[1] - d.v) < 1.6 * d.r); };
  const near = found.concat((S.balls || []).filter(b => !b.miss)).map(disc); // incl. balls hidden just now, and balls frozen to a rail
  const per = k => STILL.cnt[k] >= STILL.need / 2, seed = new Uint8Array(m.length), q = [];
  for (let j = 0; j < STILL.gh; j++) for (let i = 0; i < STILL.gw; i++) {
    const k = j * STILL.gw + i, x = (i + 0.5) * cs, y = (j + 0.5) * cs;
    if (per(k) && Math.min(x, P.L - x, y, P.W - y) <= band) { seed[k] = 1; q.push(k); }
  }
  while (q.length) {
    const k = q.pop(), i = k % STILL.gw, j = (k / STILL.gw) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= STILL.gw || jj >= STILL.gh) continue;
      const kk = jj * STILL.gw + ii; if (seed[kk] || !per(kk)) continue;
      const x = (ii + 0.5) * cs, y = (jj + 0.5) * cs; if (Math.min(x, P.L - x, y, P.W - y) > 10) continue;
      if (hits(near, x, y)) continue; // never grow into a resting ball
      seed[kk] = 1; q.push(kk);
    }
  }
  for (let j = 0; j < STILL.gh; j++) for (let i = 0; i < STILL.gw; i++) {
    const k = j * STILL.gw + i; if (!seed[k]) continue;
    // a shadow's soft edge flickers between cloth and dark from scan to scan, so a spot dark in half the scans counts, and
    // the spots right around it go in too
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= STILL.gw || jj >= STILL.gh) continue;
      const kk = jj * STILL.gw + ii; if (m[kk]) continue;
      const x = (ii + 0.5) * cs, y = (jj + 0.5) * cs;
      const out = Math.min(x, P.L - x, y, P.W - y) > band;
      if (out && !seed[kk]) continue;
      if (hits(near, x, y)) continue;
      m[kk] = 1; on++;
    }
  }
  // the look of each learned spot (its average colour while learning): later a pixel there is skipped only if it still
  // looks like that, so a ball stopping on the shadow is seen
  const N = m.length; STILL.mr = new Uint8Array(N); STILL.mg = new Uint8Array(N); STILL.mb = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (m[k]) {
    let n = A.sn[k], r = A.sr[k], g = A.sg[k], b = A.sb[k];
    if (!n) { // a spot added around the shadow's edge: borrow the look of a learned neighbour
      const i = k % STILL.gw, j = (k / STILL.gw) | 0;
      for (let dj = -1; dj <= 1 && !n; dj++) for (let di = -1; di <= 1 && !n; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= STILL.gw || jj >= STILL.gh) continue; const kk = jj * STILL.gw + ii; if (A.sn[kk]) { n = A.sn[kk]; r = A.sr[kk]; g = A.sg[kk]; b = A.sb[kk]; } }
    }
    if (n) { STILL.mr[k] = r / n; STILL.mg[k] = g / n; STILL.mb[k] = b / n; } else m[k] = 0;
  }
  on = 0; for (let k = 0; k < N; k++) on += m[k];
  // V2.3.3: a learned strip far wider than cushion shadows ever are (people standing over the table, their shadows on the
  // cloth) is thrown away and learned again later: a blue ball sitting in such a strip looked like the "shadow" and stayed
  // invisible until it was moved (real9: 890 sq in learned once, about 230 normally)
  if (on * cs * cs > 2.5 * 2 * (P.L + P.W)) { dbgOnce('stillbad', 10000, 'still_bad', { cells: on, sqin: r1(on * cs * cs) }); STILL.cnt.fill(0); STILL.n = 0; for (const k of Object.keys(A)) A[k].fill(0); return; }
  STILL.hc.fill(0); STILL.hd.fill(0); STILL.hn = 0;
  STILL.mask = m; STILL.cnt.fill(0); STILL.freed = 0; STILL.saidFree = false; dbg('still', { cells: on, sqin: r1(on * cs * cs) });
}
// writes down every time a spot's number changes between scans, with the ball's measurements and its closest matches
function dbgLabelChanges(prev, found) {
  for (const f of found) {
    let bp = null, bd = 3; for (const p of prev) { const d = Math.hypot(p.x - f.x, p.y - f.y); if (d < bd) { bd = d; bp = p; } }
    const at = [r1(f.x), r1(f.y)];
    if (bp && bp.id != null && f.id !== bp.id) dbgOnce('flip' + bp.id + '>' + f.id, 1500, 'flip', { at, was: bp.id, now: f.id == null ? '?' : f.id, conf: r2(f.conf || 0), feat: featArr(f.feat), top: topIds(f, 4) });
    else if (!bp && f.id == null) dbgOnce('unid' + Math.round(f.x / 3) + ',' + Math.round(f.y / 3), 4000, 'unid', { at, feat: featArr(f.feat), top: topIds(f, 4), kb: f.k });
  }
}
function liveScan(force) {
  if (S.mode === 'learn') { learnTick(); return; }
  if (!S.live || S.phase !== 'run' || !S.cam || !S.cloth || S.recording || S.settling || (S.planning && !force) || !isLand()) return;
  if (frozen()) { S.needRecheck = true; if (S.watch && !(S.holdT && performance.now() < S.holdT)) setStatus('Holding still while the phone settles…'); return; } // a finger on the screen, or the phone swaying: nothing is read until it settles
  if (S.pickFor || S.teach || ptr || !$('#menu').hidden) return;
  if (!grab()) return;
  if (S.needRecheck) recheckAfterFreeze();
  if (checkMoved()) return;
  if (S.stable >= 8 && S.balls.length && (S.skipN = (S.skipN || 0) + 1) % 3) return; // layout is settled: look again only every third pass
  if (++scanN % 14 === 0) { const c = sampleCloth(imgData(), S.quad); if (c) S.cloth = c; }
  const prev = S.balls, info = { still: stillInfo() }; let found = detectBalls(imgData(), S.cam, S.P, S.cloth, info); DBG.c.scans++;
  stillLearn(info.still, found);
  S.occ = info.occ; S.occFrac = info.occFrac || 0; S.occN = info.occN || 0;
  if (info.occN) dbgOnce('occ', 3000, 'occ', { n: info.occN, frac: r2(S.occFrac) });
  recogFound(found); found = dropNotBalls(found, prev);
  if (STILL.mask && (S.mkN = (S.mkN || 0) + 1) % 15 === 0 && S.occFrac <= 0.005 && !S.recording && !S.awaitAfter) found = found.concat(maskRecheck(found));
  // pieces right next to a player's arm or body are not new balls (fingers, sleeves); balls already known there are kept below
  if (S.occ) found = found.filter(f => !hiddenAt(f) || prev.some(p => Math.hypot(p.x - f.x, p.y - f.y) < 1.6));
  mergeLabels(found); if (S.drillMode) drillLabel(found);
  dbgLabelChanges(prev, found);
  // A ball only counts as MOVED once it has travelled a diamond. Its POSITION though is the middle reading of its last few
  // scans, so it settles onto where the ball really is (to a fraction of an inch) instead of staying wherever it was first seen.
  // A ball that blinks out for a scan or two is not forgotten, and a ball hidden behind the player is kept for as long as it is hidden.
  { const tol = stickTol(), pairs = [];
    found.forEach((f, fi) => prev.forEach((p, pi) => { if (p.id != null && f.id != null && p.id !== f.id) return; const d = Math.hypot(p.x - f.x, p.y - f.y); if (d < tol) pairs.push([d, fi, pi]); }));
    pairs.sort((x, y) => x[0] - y[0]);
    const usedF = new Set(), used = new Set();
    for (const [, fi, pi] of pairs) {
      const f = found[fi], bp = prev[pi]; if (usedF.has(fi) || used.has(bp)) continue; usedF.add(fi); used.add(bp);
      f.obs = (bp.obs || [[bp.x, bp.y]]).concat([[f.x, f.y]]).slice(-7); f.since = bp.since || performance.now();
      f.x = median(f.obs.map(o => o[0])); f.y = median(f.obs.map(o => o[1])); f.mvd = Math.hypot(f.x - bp.x, f.y - bp.y);
      if (bp.pin) { f.pin = true; f.pinShot = bp.pinShot; f.pinT = bp.pinT; } if (f.id == null && bp.id != null) { f.id = bp.id; f.conf = bp.conf; f.locked = true; }
    }
    for (const p of prev) {
      if (used.has(p)) continue;
      if (found.some(f => Math.hypot(p.x - f.x, p.y - f.y) < (p.pin ? 1.0 : 1.6))) { lostSp(p); continue; }
      // its number is already on the table somewhere else: the ball went there, do not keep a second copy
      if (p.id != null && found.some(f => f.id === p.id)) continue;
      // behind the player: we cannot see it, so it is still there as far as we know (no countdown, no "it moved")
      if (hiddenAt(p)) { found.push({ ...p, hid: true, miss: 0 }); continue; }
      // a ball the player named or placed by hand stays for as long as something that is not cloth is still sitting there
      // (until the next shot: a navy ball on blue felt can look like bare cloth to this check)
      if (p.pin) { if (spotHasBall(p) || (S.sess && p.pinShot === S.sess.shots.length && Date.now() - (p.pinT || 0) < 60000)) found.push({ ...p, miss: 0, hid: false }); continue; }
      if (p.id == null || (p.miss || 0) >= 3) { lostSp(p); continue; }
      found.push({ ...p, miss: (p.miss || 0) + 1, hid: false });
    }
  }
  { const t = performance.now(); S.lostSp = (S.lostSp || []).filter(q => t - q.t < 10000);
    for (const f of found) if (!f.since) { const q = S.lostSp.find(q => Math.hypot(q.x - f.x, q.y - f.y) < 1); f.since = q && q.since ? q.since : t; } }
  found = dedupeIds(found); if (S.drillMode) drillLabel(found); // (the drill's names win over names carried by position)
  { const cap = S.mode === 'play9' ? 10 : 16;
    if (found.length > cap) { // the least ball-like unnamed spots go first
      const score = b => (b.id != null ? 10 : 0) + (b.hid || b.pin ? 5 : 0) - Math.abs(Math.log(b.ratio || 1)) - (b.miss ? 1 : 0);
      found = found.slice().sort((a, b) => score(b) - score(a)).slice(0, cap);
    } }
  { const cap = S.mode === 'play9' ? 10 : 16, n = found.filter(b => !b.miss && !b.hid).length; // more balls than could still be up: a new rack
    if (S.gone.length && !S.watch && (n >= cap || n >= cap - S.gone.length + 2)) { dbg('rack', { n, gone: S.gone.length }); S.gone = []; } }
  if (S.scratch && found.some(b => b.id === 0 && !b.hid)) S.scratch = null;
  eliminate(found); found = dedupeIds(found);
  const known = found.filter(b => b.id != null), dd = idDiff(prev, known);
  // a number blinking in or out for a scan or two is not motion; only a ball that really travelled a diamond, or a number that stays gone, is
  S.setN = dd.diff ? (S.setN || 0) + 1 : 0;
  { const was = S.stable; S.stable = (known.length >= 1 && dd.mv < diamond() && S.setN < 4) ? S.stable + 1 : 0;
    if (was >= 3 && !S.stable) dbg('unsettle', { mv: r1(dd.mv), who: dd.who, diff: dd.diff, setN: S.setN, known: known.length, b: dbgBalls(known) }); }
  { const rs = found.filter(b => b.k === 1).map(b => b.ratio).filter(r => r > 0.35 && r < 3).sort((a, b) => a - b);
    if (rs.length >= 4) { const m = rs[rs.length >> 1]; S.sizeBad = (m < 0.72 || m > 1.4) ? (S.sizeBad || 0) + 1 : 0; if (S.sizeBad >= 3 && performance.now() - (S.sizeT || 0) > 5000) { S.sizeBad = 0; S.sizeT = performance.now(); autoSize(); } } }
  S.balls = found; dbgScan(found, dd); evAdd(found); recheckNames(found);
  // how many balls are on the table, from moments when the whole table can be seen (used to tell what dropped)
  if (S.occFrac <= 0.02 && !found.some(b => b.hid || b.miss) && S.stable >= 2 && !S.pend && !S.awaitAfter) { S.tableN = found.length; S.tableNT = performance.now(); }
  // a number put back on the table (the 9 re-spotted after a foul) is in play again
  if (S.gone && S.gone.length) { const vis = new Set(found.filter(b => b.id != null && !b.hid && !b.miss && b.conf > 0.3).map(b => b.id)); S.gone = S.gone.filter(i => !vis.has(i)); }
  if (S.cands.length && S.plannedBalls) { const pd = idDiff(S.plannedBalls, known); S.planN = pd.diff ? (S.planN || 0) + 1 : 0; S.planMvN = pd.mv > 1.5 ? (S.planMvN || 0) + 1 : 0; if (pd.mv > diamond() || S.planMvN >= 2 || S.planN >= 3) { S.planMvN = 0; dbg('plan_invalid', { mv: r1(pd.mv), who: pd.who, diff: pd.diff, planN: S.planN }); S.cands = []; S.planN = 0; updHud(); } }
  if (S.pend) pendCheck();
  unseenCheck(found);
  const cue = known.find(b => b.id === 0 && !b.hid), settled = S.stable >= 3 && cue;
  // V2.3.2: ready as soon as the cue ball itself has sat still for two looks (about half a second), even if the rest of
  // the table has not settled yet (a ball just set down by hand and shot right away was missed)
  const cueReady = settled || (cue && (cue.obs || []).length >= 2 && (cue.mvd || 0) < 0.3 && dd.mv < 1 && !S.setN && !S.pend && !S.awaitAfter && !S.recording && !TR.rec);
  if (cueReady && !settled && !S.settleT0) S.settleT0 = performance.now(); // for the young-ball rule
  if (S.stable >= 3 && !S.settleT0 && !S.pend && !S.awaitAfter && !S.recording) S.settleT0 = performance.now();
  const armMode = (S.mode === 'play9' || S.mode === 'play8' || S.mode === 'train' || S.mode === 'calib') && !S.geo; // (no shots while balls are set out for the geometry check)
  if (cueReady && armMode) { if (!settled && !S.armPos) dbgOnce('armq', 3000, 'arm_quick', { at: [r1(cue.x), r1(cue.y)], st: S.stable }); S.armPos = { x: cue.x, y: cue.y }; S.armT = performance.now(); }
  else if (S.armPos && !TR.rec) { const hc = known.find(b => b.id === 0 && b.hid); if (hc && Math.hypot(hc.x - S.armPos.x, hc.y - S.armPos.y) < 2) S.armT = performance.now(); } // cue tip touching the ball at address
  else if (!TR.rec && S.armPos && performance.now() - (S.armT || 0) > 2500) S.armPos = null;
  if (cueReady && S.armPos) { S.armBalls = known.map(b => ({ id: b.id, x: b.x, y: b.y, feat: b.feat, conf: b.conf, since: b.since, rec: b.rec })); S.armUn = found.filter(b => b.id == null && !b.miss && !b.hid).map(b => ({ id: null, x: b.x, y: b.y, feat: b.feat, since: b.since, rec: b.rec }));
    if (S.watch) { if (settled) truthLook(found); if (S.stable >= (S.drillMode ? 3 : 5)) frameKeepBefore(found); } S.armAll = S.tableN != null ? S.tableN : found.filter(b => !b.miss && !b.hid).length; S.armTrust = S.tableN != null; }
  if ((S.mode === 'play9' || S.mode === 'play8') && !S.watch && settled && S.auto && !S.planning && !S.cands.length) planNow();
  if (S.holdT && !S.pend && S.holdT === Infinity) S.holdT = 0;
  if (S.drillMode && S.dr && S.dr.quick) { quickTick(found); if (!(S.holdT && performance.now() < S.holdT)) setStatus(quickStatus()); }
  else if (S.drillMode) { drillUnseen(found); if (!(S.holdT && performance.now() < S.holdT)) setStatus(drillStatus(found, settled)); else drillZones(found); }
  else if (S.watch && !(S.holdT && performance.now() < S.holdT)) setStatus(watchStatus(found, settled));
  else if ((S.mode === 'play9' || S.mode === 'play8') && !S.planning && !(S.holdT && performance.now() < S.holdT)) {
    if (S.pend) setStatus('Shot recorded. Reading the result as the table comes into view…');
    else if (S.scratch) setStatus('Scratch. Put the cue ball on the ring.');
    else if (!S.cands.length) setStatus(settled ? 'Planning…' : 'Waiting for the balls to settle…');
    else if (S.armPos) { const lo = S.game === '9ball' ? Math.min(...known.filter(b => b.id >= 1).map(b => b.id)) : null; setStatus((isFinite(lo) && lo ? 'Hit the ' + lo + ' first. ' : '') + 'Take your shot. The camera is watching the cue ball.'); }
  }
  if (S.watch) clipTick();
  if (S.mode === 'train' && S.drill) trainCheck(found);
  if (S.mode === 'teach') { const un = found.filter(b => b.id == null).length; setStatus(found.length + ' balls' + (un ? ', ' + un + ' unlabeled. Tap a dashed one to name it.' : '. Tap any ball to correct it.')); }
  if (S.mode === 'calib' && S.cal && !S.cal.done) { if (!cue) setStatus('Place the cue ball on the table.'); else if (settled) setStatus('Ready. Hit at strength ' + CAL_STEPS[S.cal.step].L + '.'); }
}

// ---------- planning, uncertainty, position zone ----------
function cfgNow() { return { P: S.P, game: S.game, group: S.group, skill: S.skill, speedOf: speedOfLevel, speedSd: S.speedSd }; }
function planNow() {
  if (S.planning) return;
  const known = S.balls.filter(b => b.id != null);
  if (!known.some(b => b.id === 0)) { setStatus('The cue ball is not labeled yet.'); return; }
  const quiet = () => S.pend || (S.holdT && performance.now() < S.holdT); // a shot result on screen stays there
  S.planning = true; S.cands = []; updHud(); if (!quiet()) setStatus('Planning…'); dbg('plan', { b: dbgBalls(known) });
  const layout = { balls: known.map(b => ({ id: b.id, x: b.x, y: b.y })) }; S.plannedBalls = known.map(b => ({ id: b.id, x: b.x, y: b.y }));
  S.planLayout = layout;
  const gen = planGen(layout, cfgNow()), t0 = performance.now();
  const tick = () => {
    const end = performance.now() + 14; let r;
    do { r = gen.next(); } while (!r.done && performance.now() < end);
    if (!r.done) { setTimeout(tick, 0); return; }
    S.planning = false; const v = r.value;
    { const pd = idDiff(S.plannedBalls, S.balls.filter(b => b.id != null)); if (pd.mv > diamond() || pd.diff) { dbg('plan_drop', { mv: r1(pd.mv), who: pd.who, diff: pd.diff }); S.cands = []; setStatus('Balls moved while planning. Planning again…'); return; } }
    dbg('plan_done', { n: v.cands ? v.cands.length : 0, err: v.error || null, s: r1((performance.now() - t0) / 1000) });
    if (v.error) { S.cands = []; setStatus(v.error); } else {
      S.cands = v.cands; S.sel = 0;
      if (!quiet()) setStatus(v.cands.length ? (S.game === '9ball' && v.legal && v.legal.length ? 'Hit the ' + v.legal[0] + ' first. ' : '') + 'Plan ready in ' + ((performance.now() - t0) / 1000).toFixed(1) + 's.' : 'No makeable shot found. Try a safety by hand.');
      if (v.cands.length) selectCand(0);
    }
    updHud();
  };
  setTimeout(tick, 20);
}
function selectCand(i) {
  S.sel = i; const c = S.cands[i]; if (!c) return;
  updHud();
  if (!c.mc && !c.mcBusy && S.planLayout) {
    c.mcBusy = true; const gen = mcGen(S.planLayout, c, cfgNow(), 24);
    const tick = () => {
      const end = performance.now() + 12; let r; do { r = gen.next(); } while (!r.done && performance.now() < end);
      if (!r.done) { setTimeout(tick, 0); return; }
      c.mc = r.value; c.mcBusy = false; if (S.cands[S.sel] === c) updHud();
    };
    setTimeout(tick, 0);
  }
}

// ---------- rendering ----------
const stage = $('#stage'), sctx = stage.getContext('2d');
let MAP = null, zoneCache = null;
function layoutStage() {
  const host = $('#cam'), cw = host.clientWidth, ch = host.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1), P = S.P;
  const kk = Math.round(cw) + 'x' + Math.round(ch) + '@' + dpr;
  if (stage.dataset.k !== kk) { stage.dataset.k = kk; stage.width = Math.round(cw * dpr); stage.height = Math.round(ch * dpr); zoneCache = null; }
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const photo = S.view === 'photo' && S.src;
  if (photo) {
    const k = Math.min(cw / S.W, ch / S.H), ox = (cw - S.W * k) / 2, oy = (ch - S.H * k) / 2;
    MAP = { photo: true, w: cw, h: ch, k, ox, oy, key: kk + '|' + k + '|' + S.rot,
      p: (x, y, z = 0) => { if (!S.cam) return [x * k + ox, y * k + oy]; const q = S.cam.proj(x, y, z); return [q[0] * k + ox, q[1] * k + oy]; },
      r: (x, y) => S.cam ? S.cam.rad(x, y, P.R, P.R) * k : 8,
      inv: (cx, cy, z = 0) => S.cam ? S.cam.unproj((cx - ox) / k, (cy - oy) / k, z) : [0, 0], img: (cx, cy) => [(cx - ox) / k, (cy - oy) / k], scr: (ix, iy) => [ix * k + ox, iy * k + oy] };
  } else {
    const k = Math.min(cw / (P.L + 12), ch / (P.W + 12)), ox = (cw - P.L * k) / 2, oy = (ch - P.W * k) / 2;
    MAP = { photo: false, w: cw, h: ch, k, ox, oy, key: kk + '|t' + k, p: (x, y) => [ox + x * k, oy + (P.W - y) * k], r: () => P.R * k, inv: (cx, cy) => [(cx - ox) / k, P.W - (cy - oy) / k], img: (cx, cy) => [cx, cy], scr: (ix, iy) => [ix, iy] };
  }
}
let CSSC = {};
const css = n => CSSC[n] || (CSSC[n] = getComputedStyle(document.documentElement).getPropertyValue(n).trim());
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { CSSC = {}; }); } catch (e) { }
// colour helpers for the map: mix toward black (t<0) or white (t>0)
const shade = (rgb, t) => rgb.map(v => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t));
const rgbS = (c, a = 1) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
let feltCache = null;
// Top view: charcoal rails with a soft bevel, cushions in a deeper shade of the player's cloth, the cloth lit a little in
// the middle, pearl diamonds, pockets with a dark leather rim. Painted once into a picture and reused every frame.
function drawFelt() {
  const P = S.P, m = MAP, dpr = Math.min(2, window.devicePixelRatio || 1), felt = S.felt || [29, 107, 87];
  const key = m.key + '|' + felt.join(',') + '|' + P.L + 'x' + P.W + '|' + S.pocket;
  if (!feltCache || feltCache.key !== key) {
    const cv = document.createElement('canvas'); cv.width = Math.round(m.w * dpr); cv.height = Math.round(m.h * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = c.createRadialGradient(m.w / 2, m.h / 2, 10, m.w / 2, m.h / 2, Math.max(m.w, m.h) * 0.7);
    bg.addColorStop(0, '#15181c'); bg.addColorStop(1, '#07090b'); c.fillStyle = bg; c.fillRect(0, 0, m.w, m.h);
    const [x0, y0] = m.p(0, P.W), [x1, y1] = m.p(P.L, 0), k = m.k, rail = 5.5 * k, cush = 1.9 * k;
    // rail: charcoal with a lighter top edge and a soft shadow under the table
    c.save(); c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 18; c.shadowOffsetY = 6;
    const rg = c.createLinearGradient(0, y0 - rail, 0, y1 + rail);
    rg.addColorStop(0, '#3a3e44'); rg.addColorStop(0.5, '#2a2d32'); rg.addColorStop(1, '#1d1f23');
    c.fillStyle = rg; c.beginPath(); c.roundRect(x0 - rail, y0 - rail, x1 - x0 + 2 * rail, y1 - y0 + 2 * rail, 3.2 * k); c.fill(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 1; c.beginPath(); c.roundRect(x0 - rail + 0.5, y0 - rail + 0.5, x1 - x0 + 2 * rail - 1, y1 - y0 + 2 * rail - 1, 3.2 * k); c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.2; c.beginPath(); c.roundRect(x0 - cush - 1.5, y0 - cush - 1.5, x1 - x0 + 2 * cush + 3, y1 - y0 + 2 * cush + 3, 1.2 * k); c.stroke();
    // cushions: the cloth colour, deeper
    c.fillStyle = rgbS(shade(felt, -0.35)); c.fillRect(x0 - cush, y0 - cush, x1 - x0 + 2 * cush, y1 - y0 + 2 * cush);
    // cloth: the player's colour, a touch brighter in the middle, darker toward the cushions
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, fg = c.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(x1 - x0, y1 - y0) / 2);
    fg.addColorStop(0, rgbS(shade(felt, 0.07))); fg.addColorStop(0.65, rgbS(felt)); fg.addColorStop(1, rgbS(shade(felt, -0.18)));
    c.fillStyle = fg; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    // the cushion nose throws a thin shadow onto the cloth
    c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip(); c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 3; c.strokeRect(x0 - 0.5, y0 - 0.5, x1 - x0 + 1, y1 - y0 + 1); c.restore();
    // head string and foot spot, barely there
    c.save(); c.strokeStyle = 'rgba(255,255,255,.07)'; c.lineWidth = 1; c.setLineDash([3, 5]); const hs = m.p(P.L / 4, 0), hs2 = m.p(P.L / 4, P.W); c.beginPath(); c.moveTo(hs[0], hs[1]); c.lineTo(hs2[0], hs2[1]); c.stroke(); c.restore();
    { const f = m.p(P.L * 3 / 4, P.W / 2); c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(f[0], f[1], 1.6, 0, 7); c.fill(); }
    // diamonds: small pearl inlays with a faint glow
    const dia = (a, b) => { const g = c.createRadialGradient(a, b, 0, a, b, 3.2); g.addColorStop(0, 'rgba(240,236,226,.95)'); g.addColorStop(0.45, 'rgba(220,214,200,.55)'); g.addColorStop(1, 'rgba(220,214,200,0)'); c.fillStyle = g; c.beginPath(); c.arc(a, b, 3.2, 0, 7); c.fill(); };
    const off = 1.9 + (5.5 - 1.9) / 2;
    for (let i = 1; i < 8; i++) for (const yy of [-off, P.W + off]) { const [a, b] = m.p(i * P.L / 8, yy); dia(a, b); }
    for (let i = 1; i < 4; i++) for (const xx of [-off, P.L + off]) { const [a, b] = m.p(xx, i * P.W / 4); dia(a, b); }
    // pockets: a dark leather rim, then the hole
    for (const pk of P.pockets) {
      const [a, b] = m.p(pk.x, pk.y), r = pk.r * k * 1.1;
      c.fillStyle = '#111316'; c.beginPath(); c.arc(a, b, r + 2.2, 0, 7); c.fill();
      const g = c.createRadialGradient(a, b - r * 0.2, r * 0.1, a, b, r); g.addColorStop(0, '#000'); g.addColorStop(1, '#0b0c0e');
      c.fillStyle = g; c.beginPath(); c.arc(a, b, r, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1; c.beginPath(); c.arc(a, b, r + 2.2, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    }
    feltCache = { key, cv };
  }
  sctx.save(); sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.drawImage(feltCache.cv, 0, 0); sctx.restore();
}
function drawVideo() {
  const c = sctx; c.fillStyle = '#000'; c.fillRect(0, 0, MAP.w, MAP.h);
  if (S.live && vid.videoWidth && S.vr) c.drawImage(vid, S.vr.x, S.vr.y, S.vr.w, S.vr.h, MAP.ox, MAP.oy, S.W * MAP.k, S.H * MAP.k); else if (S.src) c.drawImage(S.src, MAP.ox, MAP.oy, S.W * MAP.k, S.H * MAP.k);
}
function modelOutline(color, alpha) {
  if (!S.cam) return; const c = sctx, P = S.P;
  c.save(); c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = 1.5; c.beginPath();
  [[0, 0], [P.L, 0], [P.L, P.W], [0, P.W]].forEach(([x, y], i) => { const q = MAP.p(x, y); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.closePath(); c.stroke();
  for (const pk of P.pockets) { const q = MAP.p(pk.x, pk.y), q2 = MAP.p(pk.x + pk.r, pk.y); c.beginPath(); c.arc(q[0], q[1], Math.hypot(q2[0] - q[0], q2[1] - q[1]) * 1.1, 0, 7); c.stroke(); }
  c.restore();
}
// the table check: a bright ring on each pocket of the outline, so it is plain at a glance whether the outline sits on them
function drawPocketMarks() {
  if (!S.cam) return; const c = sctx;
  for (const pk of S.P.pockets) { const q = MAP.p(pk.x, pk.y), q2 = MAP.p(pk.x + pk.r * 1.6, pk.y), rr = Math.max(9, Math.hypot(q2[0] - q[0], q2[1] - q[1]));
    c.save(); c.fillStyle = 'rgba(89,214,232,.18)'; c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.beginPath(); c.arc(q[0], q[1], rr, 0, 7); c.fill(); c.stroke(); c.restore(); }
}
function line(pts, color, w, dash, alpha = 1) {
  const c = sctx; if (pts.length < 2) return;
  c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = w; c.setLineDash(dash || []); c.lineJoin = 'round'; c.lineCap = 'round';
  c.beginPath(); pts.forEach(([x, y], i) => { const q = MAP.p(x, y, S.P.R); i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); c.restore();
}
function ring(x, y, r, color, w, fill, dash) {
  const c = sctx, q = MAP.p(x, y, S.P.R), pr = MAP.r(x, y) * r;
  c.save(); c.strokeStyle = color; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath(); c.arc(q[0], q[1], pr, 0, 7);
  if (fill) { c.fillStyle = fill; c.fill(); } c.stroke(); c.restore();
}
// green (sure) → amber → red (unsure) by how far the simulated outcomes spread, in inches
function uncColor(sd, a) { const t = clamp((sd - 0.6) / 3.4, 0, 1), hue = 135 * (1 - t); return 'hsla(' + hue.toFixed(0) + ',92%,56%,' + a + ')'; }
function uncLine(path, sds, w) {
  const c = sctx; c.save(); c.lineWidth = w; c.lineCap = 'round';
  for (let i = 1; i < path.length; i++) {
    const a = MAP.p(path[i - 1][1], path[i - 1][2], S.P.R), b = MAP.p(path[i][1], path[i][2], S.P.R);
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.2) continue;
    c.strokeStyle = sds ? uncColor(sds[i] || 0, 0.55) : 'rgba(120,200,255,.5)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
  c.restore();
}
function drawZone(c) {
  const z = c.zone; if (!z) return;
  if (!zoneCache || zoneCache.key !== MAP.key + '|' + S.sel) {
    const cv = document.createElement('canvas'), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = stage.width; cv.height = stage.height;
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let j = 0; j < z.ny; j++) for (let i = 0; i < z.nx; i++) {
      const e = z.ease[j * z.nx + i]; if (e < 0.18) continue;
      x.fillStyle = e >= 0.5 ? 'rgba(60,225,125,.20)' : e >= 0.3 ? 'rgba(255,190,40,.20)' : 'rgba(255,75,75,.16)';
      const s = z.step, p = [MAP.p(i * s, j * s), MAP.p((i + 1) * s, j * s), MAP.p((i + 1) * s, (j + 1) * s), MAP.p(i * s, (j + 1) * s)];
      x.beginPath(); p.forEach((q, k) => k ? x.lineTo(q[0], q[1]) : x.moveTo(q[0], q[1])); x.closePath(); x.fill();
    }
    zoneCache = { key: MAP.key + '|' + S.sel, cv };
  }
  sctx.save(); sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.drawImage(zoneCache.cv, 0, 0); sctx.restore();
}
function drawBalls() {
  const c = sctx, photo = MAP.photo;
  S.balls.forEach(b => {
    if (b.id == null && S.mode !== 'teach') return;
    const q = MAP.p(b.x, b.y, S.P.R), r = MAP.r(b.x, b.y);
    if (!photo) {
      // a glossy ball: soft shadow on the cloth, its colour (and stripe), light from the top left, darker toward the edge
      c.save(); c.fillStyle = 'rgba(0,0,0,.32)'; c.filter = 'blur(' + Math.max(1, r * 0.25).toFixed(1) + 'px)'; c.beginPath(); c.ellipse(q[0] + r * 0.22, q[1] + r * 0.3, r * 0.95, r * 0.8, 0, 0, 7); c.fill(); c.restore();
      c.save(); c.beginPath(); c.arc(q[0], q[1], r, 0, 7); c.clip();
      c.fillStyle = ballColor(b.id); c.fillRect(q[0] - r, q[1] - r, 2 * r, 2 * r);
      if (b.id != null && b.id >= 9) { c.fillStyle = '#f4f1e8'; c.fillRect(q[0] - r, q[1] - r, 2 * r, r * .55); c.fillRect(q[0] - r, q[1] + r * .45, 2 * r, r * .55); }
      const dk = c.createRadialGradient(q[0], q[1], r * 0.55, q[0], q[1], r); dk.addColorStop(0, 'rgba(0,0,0,0)'); dk.addColorStop(1, 'rgba(0,0,0,.38)'); c.fillStyle = dk; c.fillRect(q[0] - r, q[1] - r, 2 * r, 2 * r);
      const hl = c.createRadialGradient(q[0] - r * 0.38, q[1] - r * 0.42, 0, q[0] - r * 0.38, q[1] - r * 0.42, r * 0.55); hl.addColorStop(0, 'rgba(255,255,255,.75)'); hl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = hl; c.fillRect(q[0] - r, q[1] - r, 2 * r, 2 * r);
      c.restore();
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 0.8; c.beginPath(); c.arc(q[0], q[1], r, 0, 7); c.stroke();
    } else { c.strokeStyle = b.id == null ? '#ffb347' : 'rgba(89,214,232,.6)'; c.lineWidth = 1.5; c.setLineDash(b.id == null ? [4, 3] : []); c.beginPath(); c.arc(q[0], q[1], r * 1.2, 0, 7); c.stroke(); c.setLineDash([]); }
    if (S.teach && S.balls[S.teach.i] === b) { c.strokeStyle = css('--accent'); c.lineWidth = 3; c.beginPath(); c.arc(q[0], q[1], r * 2, 0, 7); c.stroke(); }
    const lab = b.id == null ? '?' : b.id === 0 ? 'Q' : String(b.id), fs = Math.max(10, r * 1.05);
    c.font = '600 ' + fs + 'px Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (photo && !(S.tags || S.watch || S.mode === 'teach' || S.mode === 'train' || S.mode === 'calib')) { /* tags are a menu option */ }
    else if (photo) { c.fillStyle = 'rgba(8,16,20,.72)'; c.beginPath(); c.arc(q[0], q[1] - r * 2.2, fs * 0.75, 0, 7); c.fill(); c.strokeStyle = 'rgba(89,214,232,.5)'; c.lineWidth = 1; c.stroke(); c.fillStyle = '#fff'; c.fillText(lab, q[0], q[1] - r * 2.2 + 1); }
    else if (b.id !== 0) { // the number on a small white disc, like the real balls
      const dr = r * 0.5; c.fillStyle = 'rgba(250,248,242,.96)'; c.beginPath(); c.arc(q[0], q[1], dr, 0, 7); c.fill();
      c.font = '700 ' + Math.max(8, r * 0.72).toFixed(1) + 'px Inter, system-ui, sans-serif'; c.fillStyle = '#16181b'; c.fillText(lab, q[0], q[1] + 0.5);
    }
  });
}
function drawScratch() {
  const sc = S.scratch; if (!sc) return; const c = sctx, w = MAP.w, h = MAP.h;
  if (sc.place && MAP.photo && S.cam) {
    const q = MAP.p(sc.place.x, sc.place.y, S.P.R), r = MAP.r(sc.place.x, sc.place.y) * (1.5 + 0.18 * Math.sin(Date.now() / 260));
    c.save(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.fillStyle = 'rgba(89,214,232,.28)'; c.beginPath(); c.arc(q[0], q[1], r, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = css('--accent'); c.lineWidth = 2; c.beginPath(); c.arc(q[0], q[1], r + 7, 0, 7); c.stroke();
    c.fillStyle = '#fff'; c.font = '600 13px Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('Cue ball here', q[0], q[1] - r - 16); c.restore();
  }
  const age = (Date.now() - (sc.t || Date.now())) / 1000, fade = age < 4 ? 1 : Math.max(0, 1 - (age - 4)); if (fade <= 0) return;
  c.save(); c.globalAlpha = fade; const bh = Math.min(76, h * 0.2), y = h * 0.3 - bh / 2;
  c.fillStyle = 'rgba(10,14,18,.66)'; c.fillRect(0, y, w, bh); c.fillStyle = css('--accent'); c.fillRect(0, y, w, 3); c.fillRect(0, y + bh - 3, w, 3);
  c.fillStyle = '#fff'; c.font = '700 ' + Math.round(bh * 0.62) + 'px Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SCRATCH', w / 2, y + bh / 2 + 2);
  c.restore();
}
// Position zone for the NEXT ball: after this shot (the planned ball down), where should the cue ball finish? It fans out
// from the next ball. Green: an easy shot on it that also leads naturally to the ball after. Amber: playable, or easy but
// awkward for the one after. Red: hard. Grey stripes: the angle would be fine but another ball is in the way (hooked).
// On the last ball (the 9) only the shot on it counts.
function landingZone(c) {
  if (c.lz !== undefined) return c.lz;
  c.lz = null;
  const res = c.res, P = S.P, R = P.R; if (!res || c.kind === 'safety' || !res.final) return null;
  if (res.pocketed && res.pocketed.some(p => p.id === 0)) return null;
  const pots = (res.pocketed || []).filter(p => p.id !== 0).map(p => p.id); if (!pots.length) return null;
  const z = zoneCtx(res.final, pots, S.game, S.group, P); if (!z) return null;
  const D = P.L / 8, step = 1.25, cells = [], tb = z.n.tb;
  for (let y = R + 0.5; y <= P.W - R - 0.5; y += step) for (let x = R + 0.5; x <= P.L - R - 0.5; x += step) {
    if (Math.hypot(x - tb.x, y - tb.y) > 3.6 * D) continue;
    if (z.rest.some(q => Math.hypot(q.x - x, q.y - y) < 2 * R + 0.3)) continue;
    if (P.pockets.some(pk => Math.hypot(pk.x - x, pk.y - y) < pk.r + 2.5)) continue; // too close to a pocket: scratch risk
    const g = zoneGrade(x, y, z);
    if (g.q) cells.push({ x, y, q: g.q }); else if (g.hooked) cells.push({ x, y, q: 0 });
  }
  const cue = res.final.find(q => q.id === 0);
  c.lz = cells.length ? { cells, step, next: { id: z.n.tid, x: tb.x, y: tb.y }, pockets: z.n.pks, after: z.after ? z.after.tid : null, endQ: cue ? zoneGrade(cue.x, cue.y, z).q : 0 } : null;
  return c.lz;
}
// Drawn as soft, see-through patches: each colour is painted solid on its own layer, then laid over the picture lightly,
// so overlapping spots do not build up into dark blotches. Hooked spots are grey with stripes.
let lzCache = null;
function drawLanding(c) {
  const z = landingZone(c); if (!z) return;
  const key = MAP.key + '|' + S.sel + '|' + S.cands.length + '|' + z.cells.length;
  if (!lzCache || lzCache.key !== key || lzCache.c !== c) {
    const dpr = Math.min(2, window.devicePixelRatio || 1), mk = () => { const cv = document.createElement('canvas'); cv.width = stage.width; cv.height = stage.height; const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [cv, x]; };
    const cols = { 3: 'rgb(60,225,125)', 2: 'rgb(255,190,40)', 1: 'rgb(255,85,85)', 0: 'rgb(150,155,160)' }, layers = {};
    for (const q of [3, 2, 1, 0]) { const [cv, x] = mk(); x.fillStyle = cols[q]; layers[q] = { cv, x }; }
    const r0 = z.step * 1.05;
    for (const k of z.cells) {
      const q = MAP.p(k.x, k.y), q2 = MAP.p(k.x + r0, k.y), q3 = MAP.p(k.x, k.y + r0), rx = Math.max(1.5, Math.hypot(q2[0] - q[0], q2[1] - q[1])), ry = Math.max(1.5, Math.hypot(q3[0] - q[0], q3[1] - q[1]));
      const L = layers[k.q].x; L.beginPath(); L.ellipse(q[0], q[1], rx, ry, 0, 0, 7); L.fill();
    }
    // stripes over the grey (hooked) area
    { const L = layers[0], x = L.x; x.save(); x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'destination-out'; x.lineWidth = 3 * dpr;
      for (let d = -L.cv.height; d < L.cv.width; d += 9 * dpr) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + L.cv.height, L.cv.height); x.stroke(); } x.restore(); }
    lzCache = { key, c, layers: [layers[0].cv, layers[1].cv, layers[2].cv, layers[3].cv] };
  }
  sctx.save(); sctx.setTransform(1, 0, 0, 1, 0, 0);
  sctx.globalAlpha = 0.32; sctx.drawImage(lzCache.layers[0], 0, 0);
  sctx.globalAlpha = 0.22; for (let i = 1; i < 4; i++) sctx.drawImage(lzCache.layers[i], 0, 0);
  sctx.restore();
  // the next ball, with a dashed ring, and a faint line to the pocket(s) it is rated for
  const n = z.next; ring(n.x, n.y, 1.9, 'rgba(255,255,255,.75)', 1.4, null, [4, 4]);
  for (const pk of z.pockets) line([[n.x, n.y], [pk.x, pk.y]], '#ffffff', 1, [3, 6], .35);
}
function drawPlan() {
  const c = S.cands[S.sel]; if (!c || !c.res) return;
  const res = c.res, hit = res.hitAt ? res.hitAt.t : 0, sd = c.mc ? c.mc.sd : null, pk = c.pocket >= 0 ? S.P.pockets[c.pocket] : null;
  if (pk) { const q = MAP.p(pk.x, pk.y), q2 = MAP.p(pk.x + pk.r * 1.4, pk.y), rr = Math.hypot(q2[0] - q[0], q2[1] - q[1]); sctx.save(); sctx.fillStyle = css('--accent'); sctx.globalAlpha = .18; sctx.beginPath(); sctx.arc(q[0], q[1], rr, 0, 7); sctx.fill(); sctx.globalAlpha = .75; sctx.strokeStyle = css('--accent'); sctx.lineWidth = 1.5; sctx.stroke(); sctx.restore(); }
  for (const id in res.paths) {
    if (+id === 0) continue; const p = res.paths[id];
    if (p.some(s => Math.hypot(s[1] - p[0][1], s[2] - p[0][2]) > 0.3)) uncLine(p, sd && sd[id], +id === c.target ? 2.2 : 1.6);
  }
  if (S.zones !== false) drawLanding(c);
  const cp = res.paths[0] || [], pre = cp.filter(s => s[0] <= hit + 0.0001);
  line(pre.map(s => [s[1], s[2]]), '#ffffff', 1.5, [7, 5], .65);
  const post = cp.filter(s => s[0] >= hit);
  if (post.length > 1) {
    line(post.map(s => [s[1], s[2]]), '#ffffff', 2.2, null, .85);
    const e = post[post.length - 1], q = MAP.p(e[1], e[2], S.P.R), z = c.lz;
    // the spot the plan wants the cue ball to stop on, ringed in the zone colour it lands in
    const col = !z ? '#ffffff' : z.endQ === 3 ? 'rgb(60,225,125)' : z.endQ === 2 ? 'rgb(255,190,40)' : z.endQ === 1 ? 'rgb(255,85,85)' : '#ffffff';
    sctx.save(); sctx.fillStyle = '#ffffff'; sctx.strokeStyle = col; sctx.lineWidth = 2.5; sctx.beginPath(); sctx.arc(q[0], q[1], 4, 0, 7); sctx.fill(); sctx.stroke(); sctx.restore();
  }
  const gh = c.ghost || (pre.length ? [pre[pre.length - 1][1], pre[pre.length - 1][2]] : null);
  if (gh) ring(gh[0], gh[1], 1, '#fff', 1.5, 'rgba(255,255,255,.16)');
  if (cp.length) ring(cp[0][1], cp[0][2], 1.3, '#fff', 1.5);
}
function drawDrill() {
  const d = S.drill; if (!d) return;
  const cue = d.balls[0], tb = d.balls[1], pk = S.P.pockets[d.pocket], ref = d.ref;
  const q = MAP.p(pk.x, pk.y), q2 = MAP.p(pk.x + pk.r * 1.4, pk.y), rr = Math.hypot(q2[0] - q[0], q2[1] - q[1]);
  sctx.save(); sctx.fillStyle = css('--amber'); sctx.globalAlpha = .28; sctx.beginPath(); sctx.arc(q[0], q[1], rr, 0, 7); sctx.fill(); sctx.restore();
  line([[cue.x, cue.y], ref.ghost], '#fff', 1.5, [7, 5], .7); line([[tb.x, tb.y], [pk.x, pk.y]], css('--accent'), 2, [], .85);
  ring(ref.ghost[0], ref.ghost[1], 1, '#fff', 1.5, 'rgba(255,255,255,.16)'); ring(cue.x, cue.y, 1.15, '#fff', 2.5, 'rgba(255,255,255,.3)'); ring(tb.x, tb.y, 1.15, css('--accent'), 2.5, 'rgba(120,200,255,.3)');
  ring(d.ring.x, d.ring.y, d.ring.r / S.P.R, css('--target'), 2, 'rgba(255,80,210,.14)', [6, 4]);
  line(ref.res.paths[0].filter(s => s[0] >= ref.res.hitAt.t).map(s => [s[1], s[2]]), css('--target'), 1.8, [3, 5], .8);
}
function drawCalGuide() {
  const cal = S.cal; if (!cal || cal.done || !S.armPos || CAL_STEPS[cal.step].L === 10) return;
  const a = S.armPos, dir = a.x < S.P.L / 2 ? 1 : -1;
  line([[a.x, a.y], [dir > 0 ? S.P.L - S.P.R : S.P.R, a.y]], '#fff', 1.5, [8, 6], .6);
  ring(dir > 0 ? S.P.L - 5 : 5, a.y, 0.9, css('--target'), 2, 'rgba(255,80,210,.2)');
}
function drawMeas() {
  const m = S.meas; if (!m) return;
  line(m.path.map(s => [s[1], s[2]]), css('--accent'), 2.5, [], .9);
  if (m.fit && m.fit.res) line(m.fit.res.paths[0].map(s => [s[1], s[2]]), '#fff', 1.5, [4, 4], .8);
}
function drawHandles() {
  if (!S.quad || !MAP.photo) return; const c = sctx;
  c.save(); c.strokeStyle = css('--accent'); c.lineWidth = 1.5; c.beginPath();
  S.quad.forEach((p, i) => { const [x, y] = MAP.scr(p[0], p[1]); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath(); c.stroke();
  S.quad.forEach((p, i) => { const [x, y] = MAP.scr(p[0], p[1]); c.fillStyle = css('--accent'); c.beginPath(); c.arc(x, y, 11, 0, 7); c.fill(); c.fillStyle = '#071018'; c.font = '700 11px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), x, y + 1); });
  c.restore();
}
function drawDiamonds() {
  const d = S.dia; if (!d || !MAP.photo) return; const c = sctx;
  c.save(); c.strokeStyle = '#59d6e8'; c.fillStyle = 'rgba(89,214,232,.45)'; c.lineWidth = 1.5;
  for (const [nx, ny] of d.pts) { const [x, y] = MAP.scr(nx * S.W, ny * S.H); c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 4, y); c.lineTo(x, y + 6); c.lineTo(x - 4, y); c.closePath(); c.fill(); c.stroke(); }
  c.restore();
}
function placeCard() {
  const c = $('#card'); if (c.hidden || !c.classList.contains('slim') || !MAP) return;
  let top = 1e9, bot = -1e9;
  if (S.quad && MAP.photo) for (const p of S.quad) { const y = MAP.scr(p[0], p[1])[1]; top = Math.min(top, y); bot = Math.max(bot, y); }
  const need = c.offsetHeight + 20, below = MAP.h - bot, above = top - 56;
  c.classList.toggle('atTop', below < need && above > below);
}
function drawLoupe() {
  const m = S.man; if (!m || !m.hold || !MAP.photo || !vid.videoWidth) return;
  const [sx, sy] = m.hold, [ix, iy] = MAP.img(sx, sy), R = 56, z = 4, c = sctx;
  let cx = sx - 90, cy = sy - 90; if (cx < R + 6) cx = sx + 90; if (cy < R + 70) cy = sy + 90;
  c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip(); c.fillStyle = '#000'; c.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  const sc = S.vr.w / S.W, sw = (2 * R / z) / MAP.k * sc;
  const vx = S.vr.x + ix * sc, vy = S.vr.y + iy * (S.vr.h / S.H);
  c.drawImage(vid, vx - sw / 2, vy - sw / 2, sw, sw, cx - R, cy - R, 2 * R, 2 * R); c.restore();
  c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
  c.strokeStyle = css('--accent'); c.lineWidth = 1.5; c.beginPath(); c.moveTo(cx - 14, cy); c.lineTo(cx + 14, cy); c.moveTo(cx, cy - 14); c.lineTo(cx, cy + 14); c.stroke();
}
function syncChrome() {
  { const f = $('#endFab'); if (f) f.hidden = !(S.sess && S.phase === 'run' && !$('#cam').hidden && S.mode !== 'learn'); syncZoomUI(); }
  const pr = (S.mode === 'play9' || S.mode === 'play8') && S.phase === 'run' && !$('#cam').hidden;
  document.body.classList.toggle('playrun', pr); $('#aggr').hidden = !pr || S.watch; updUndo();
}
function render() {
  if ($('#cam').hidden) return;
  syncChrome();
  layoutStage();
  if (MAP.photo) drawVideo(); else drawFelt();
  const ph = S.phase;
  if (ph === 'auto') { sctx.fillStyle = 'rgba(8,12,16,.35)'; sctx.fillRect(0, 0, MAP.w, MAP.h); }
  if ((ph === 'verify' || ph === 'manual') && MAP.photo) { if (S.man && S.man.pts.length) { sctx.fillStyle = css('--accent'); for (const p of S.man.pts) { const [x, y] = MAP.scr(p[0], p[1]); sctx.beginPath(); sctx.arc(x, y, 6, 0, 7); sctx.fill(); } } else if (ph === 'verify') { modelOutline(css('--accent'), .9); drawPocketMarks(); drawDiamonds(); drawHandles(); } }
  if (S.mode === 'learn' && ph === 'run') { drawLearn(); drawLoupe(); return; }
  if (ph === 'run' && (MAP.photo ? !!S.cam : true)) {
    if (MAP.photo) modelOutline('#ffffff', .22);
    if (S.mode === 'train') { drawDrill(); drawBalls(); }
    else if (S.mode === 'calib') { drawCalGuide(); drawBalls(); if (S.meas) drawMeas(); }
    else if (S.geo) { drawGeo(); drawBalls(); }
    else if (S.watch) { if (S.drillMode) drawDrillSpots(); drawTrails(); drawBalls(); } // Watch & Learn: only what the camera thinks each ball is
    else { if (S.mode === 'play9' || S.mode === 'play8') drawPlan(); drawMeas(); drawTrails(); drawBalls(); drawScratch(); }
  }
  drawLoupe(); placeCard();
}

// ---------- ball path dots (V2.3.3): one dot per camera frame where each ball was seen, in its colour ----------
// A ring marks where a ball was counted into a pocket, a "?" where its path was lost. Drawn live during the shot and kept
// until the next one, so a wrong result can be checked against what the camera actually followed.
function trailsDraw(c, list, pt, sc) {
  for (const t of list) {
    const col = ballColor(t.cue ? 0 : t.id), pts = t.path.map(p => pt(p[1], p[2])), r = Math.max(1.6, 2.2 * sc);
    c.globalAlpha = 0.9; c.fillStyle = col; c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = Math.max(0.6, sc);
    for (const q of pts) { c.beginPath(); c.arc(q[0], q[1], r, 0, 7); c.fill(); c.stroke(); }
    const e = pts[pts.length - 1]; if (!e) continue;
    if (t.st === 'pocket') { c.strokeStyle = col; c.lineWidth = Math.max(2, 3 * sc); c.beginPath(); c.arc(e[0], e[1], 9 * sc, 0, 7); c.stroke(); }
    else if (t.st === 'lost' || t.unsure) { c.fillStyle = '#fff'; c.strokeStyle = '#000'; c.lineWidth = 3 * sc; c.font = '700 ' + Math.round(15 * sc) + 'px system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.strokeText('?', e[0] + 9 * sc, e[1] - 9 * sc); c.fillText('?', e[0] + 9 * sc, e[1] - 9 * sc); }
  }
  c.globalAlpha = 1;
}
function drawTrails() {
  if (S.trails === false || !S.cam) return; const list = MT.on ? MT.tr.filter(t => t.moved) : MT.last; if (!list || !list.length) return;
  sctx.save(); trailsDraw(sctx, list, (x, y) => MAP.p(x, y, S.P.R), 1); sctx.restore();
}

// ---------- geometry check (V2.3.3): how far off, in inches, the camera puts a ball whose true spot is known ----------
// Balls frozen against the cushion at diamonds have exactly known spots: 1-4 on the near rail at the 1st, 3rd, 5th and 7th
// diamond counted from the left end of the screen, 5-8 the same on the far rail, the 9 at the middle diamond of the left
// short rail. Measure compares where each is seen with where it really is, along the rail and away from it.
function geoTargets() {
  const P = S.P, R = P.R, L = P.L, W = P.W, a = MAP.p(0, W / 2, R), b = MAP.p(L, W / 2, R), left0 = a[0] <= b[0], low = nearLow();
  const X = i => left0 ? L * i / 8 : L - L * i / 8, nearY = low ? R : W - R, farY = low ? W - R : R, out = [];
  [1, 3, 5, 7].forEach((i, k) => out.push({ n: k + 1, x: X(i), y: nearY, rail: 'near', dia: i }));
  [1, 3, 5, 7].forEach((i, k) => out.push({ n: k + 5, x: X(i), y: farY, rail: 'far', dia: i }));
  out.push({ n: 9, x: left0 ? R : L - R, y: W / 2, rail: 'end', dia: 2 });
  for (const t of out) t.left0 = left0; return out;
}
// errors for one target and the ball seen for it: along the rail (+ = to the right on screen), away from the cushion (+ = into the table)
function geoErr(t, b) {
  const P = S.P, R = P.R;
  if (t.rail === 'end') { const away = t.left0 ? b.x - R : (P.L - R) - b.x, along = b.y - t.y; return { along, away }; }
  const along = t.left0 ? b.x - t.x : t.x - b.x, away = t.y < P.W / 2 ? b.y - t.y : t.y - b.y; return { along, away };
}
function geoMatch(targets, seen) {
  const pairs = []; for (const t of targets) for (const b of seen) { const d = Math.hypot(b.x - t.x, b.y - t.y); if (d < 8) pairs.push([d, t, b]); }
  pairs.sort((p, q) => p[0] - q[0]); const ut = new Set(), ub = new Set(), res = [];
  for (const [d, t, b] of pairs) { if (ut.has(t) || ub.has(b)) continue; ut.add(t); ub.add(b); const e = geoErr(t, b); res.push({ n: t.n, rail: t.rail, at: [r2(b.x), r2(b.y)], along: r2(e.along), away: r2(e.away), d: r2(d), id: b.id == null ? null : b.id }); }
  res.sort((p, q) => p.n - q.n);
  const sum = l => { if (!l.length) return null; const A = l.map(r => Math.abs(r.along)), B = l.map(r => Math.abs(r.away)), D = l.map(r => r.d); return { n: l.length, along: r2(A.reduce((s, v) => s + v, 0) / l.length), away: r2(B.reduce((s, v) => s + v, 0) / l.length), max: r2(Math.max(...D)), biasAlong: r2(l.reduce((s, r) => s + r.along, 0) / l.length), biasAway: r2(l.reduce((s, r) => s + r.away, 0) / l.length) }; };
  return { res, missing: targets.filter(t => !ut.has(t)).map(t => t.n), near: sum(res.filter(r => r.rail === 'near')), far: sum(res.filter(r => r.rail === 'far')), end: sum(res.filter(r => r.rail === 'end')), all: sum(res) };
}
function geoStart() {
  if (!(S.phase === 'run' && S.cam)) { S.geoPending = true; if ($('#cam').hidden) startMode('watch'); else toast('Geometry check starts once the table is found'); return; }
  S.geo = { t: geoTargets(), out: null }; S.armPos = null; dbg('geo', { start: true, targets: S.geo.t.map(t => [t.n, r1(t.x), r1(t.y)]) }); geoCard();
}
function geoCard() {
  const g = S.geo; if (!g) return; const o = g.out, f = v => (v > 0 ? '+' : '') + v.toFixed(2);
  let h = '<h3>Geometry check</h3>';
  if (!o) h += '<p>Freeze each ball against the cushion at the <b>real diamond</b> by its marker: 1–4 near rail, 5–8 far rail (diamonds 1, 3, 5, 7 from the left), the 9 mid left end. Step away, tap Measure.</p>';
  else {
    const row = (nm, s) => s ? '<tr><td>' + nm + '</td><td>' + s.along.toFixed(2) + '</td><td>' + s.away.toFixed(2) + '</td><td>' + s.max.toFixed(2) + '</td></tr>' : '';
    h += '<p style="font:500 12px var(--f-mono)">Average error in inches (max is the worst ball)</p><table style="font:500 13px var(--f-mono);width:100%"><tr><td></td><td>along</td><td>off rail</td><td>max</td></tr>' + row('Near', o.near) + row('Far', o.far) + row('End', o.end) + row('All', o.all) + '</table>';
    h += '<p style="font:500 11px var(--f-mono)">' + o.res.map(r => r.n + ': ' + f(r.along) + ' / ' + f(r.away)).join(' · ') + (o.missing.length ? '<br>Not seen: ' + o.missing.join(', ') : '') + '</p>';
  }
  h += '<div class="row"><button class="btn primary" data-act="geoMeasure">Measure</button><button class="btn" data-act="geoDone">Done</button></div>';
  showCard(h);
}
async function geoMeasure() {
  const g = S.geo; if (!g) return; if (S.occFrac > 0.02) { toast('Step away from the table first'); return; }
  g.t = geoTargets(); const seen = detectNow();
  for (const b of seen) { const o = S.balls.find(q => Math.hypot(q.x - b.x, q.y - b.y) < 1.5); b.id = o && o.id != null ? o.id : null; }
  g.out = geoMatch(g.t, seen); g.seen = seen.map(b => ({ x: b.x, y: b.y }));
  dbg('geo', { ft: S.ft, prof: S.prof, lens: S.lens, near: g.out.near, far: g.out.far, end: g.out.end, all: g.out.all, missing: g.out.missing, balls: g.out.res, extra: seen.length - g.out.res.length });
  geoCard();
  try { // a picture with the true spots (rings) and where each ball was seen (dots), kept for the debug file
    const f = frameGrab(); if (!f) return; const c = f.c.getContext('2d'), sc = Math.max(0.7, f.c.width / 900);
    for (const t of g.t) { const q = f.pt(t.x, t.y, S.P.R); c.strokeStyle = '#fff'; c.lineWidth = 2 * sc; c.beginPath(); c.arc(q[0], q[1], 7 * sc, 0, 7); c.stroke(); c.fillStyle = '#fff'; c.font = '700 ' + Math.round(13 * sc) + 'px system-ui'; c.fillText(String(t.n), q[0] + 9 * sc, q[1] - 9 * sc); }
    for (const b of seen) { const q = f.pt(b.x, b.y, S.P.R); c.fillStyle = '#ff3b30'; c.beginPath(); c.arc(q[0], q[1], 2.5 * sc, 0, 7); c.fill(); }
    const jb = await toJpeg(f.c); if (jb) { const k = 'geo/' + Date.now() + '.jpg'; await idbPut(k, await jb.arrayBuffer()); dbg('geo', { pic: k }); }
  } catch (e) { }
}
function geoDone() { S.geo = null; hideCard(); dbg('geo', { done: true }); }
function drawGeo() {
  const g = S.geo; if (!g || !S.cam) return; const c = sctx; c.save();
  const mid = MAP.p(S.P.L / 2, S.P.W / 2, S.P.R);
  for (const t of g.t) { // the number sits on the table side of its marker (the far rail is under the status bar)
    const q = MAP.p(t.x, t.y, S.P.R), r = MAP.r(t.x, t.y), vx = mid[0] - q[0], vy = mid[1] - q[1], vl = Math.hypot(vx, vy) || 1, o = r + 11;
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.setLineDash([4, 3]); c.lineWidth = 2; c.beginPath(); c.arc(q[0], q[1], r, 0, 7); c.stroke(); c.setLineDash([]);
    c.font = '700 14px Inter, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.fillStyle = '#fff';
    const lx = q[0] + (t.rail === 'end' ? vx / vl : 0) * o, ly = q[1] + (t.rail === 'end' ? 0 : Math.sign(vy) || -1) * o; c.strokeText(String(t.n), lx, ly); c.fillText(String(t.n), lx, ly); }
  if (g.out) for (const r of g.out.res) { const t = g.t.find(x => x.n === r.n); if (!t) continue; const a = MAP.p(t.x, t.y, S.P.R), b = MAP.p(r.at[0], r.at[1], S.P.R); c.strokeStyle = r.d < 0.5 ? '#3ce17d' : r.d < 1 ? '#ffd23c' : '#ff3b30'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.fillStyle = c.strokeStyle; c.beginPath(); c.arc(b[0], b[1], 3.5, 0, 7); c.fill(); }
  for (const b of S.balls) if (b.id == null && !b.miss) { const q = MAP.p(b.x, b.y, S.P.R); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(q[0], q[1], 3, 0, 7); c.fill(); }
  c.restore();
}

// ---------- HUD and cards ----------
function drawTip(cv, a, b, dim) {
  const c = cv.getContext('2d'), s = cv.width, r = s / 2 - 4; c.clearRect(0, 0, s, s);
  c.fillStyle = 'rgba(255,255,255,.10)'; c.beginPath(); c.arc(s / 2, s / 2, r, 0, 7); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s / 2, 8); c.lineTo(s / 2, s - 8); c.moveTo(8, s / 2); c.lineTo(s - 8, s / 2); c.stroke();
  c.beginPath(); c.arc(s / 2, s / 2, r * 0.5, 0, 7); c.stroke();
  const x = s / 2 + (a / 0.5) * r * 0.5, y = s / 2 - (b / 0.5) * r * 0.5;
  c.globalAlpha = dim ? .35 : 1; c.fillStyle = '#59d6e8'; c.beginPath(); c.arc(x, y, 10, 0, 7); c.fill(); c.strokeStyle = 'rgba(4,22,26,.85)'; c.lineWidth = 3; c.stroke(); c.globalAlpha = 1;
}
function updHud() {
  const hud = $('#hud'), c = S.cands[S.sel], play = (S.mode === 'play9' || S.mode === 'play8') && !S.watch;
  if (!play || S.phase !== 'run') { hud.hidden = true; return; }
  hud.hidden = false;
  if (!c) { drawTip($('#tip'), 0, 0, true); $('#lvlNum').textContent = '–'; $('#lvlWord').textContent = ''; $('#candIdx').textContent = ''; return; }
  drawTip($('#tip'), c.shot.a, c.shot.b);
  const L = c.level || Math.round(levelOfSpeed(c.shot.speed));
  $('#lvlNum').textContent = L; $('#lvlWord').textContent = levelWord(L);
  $('#candIdx').textContent = (S.sel + 1) + '/' + S.cands.length;
}
let cardTimer = 0;
function showCard(html, ms, cls) { const c = $('#card'); c.className = 'glass' + (cls ? ' ' + cls : ''); c.innerHTML = html; c.hidden = false; clearTimeout(cardTimer); if (ms) cardTimer = setTimeout(hideCard, ms); }
function hideCard() { $('#card').hidden = true; clearTimeout(cardTimer); }
$('#card').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) cardAct(b.dataset.act); });
function cardAct(a) {
  if (a === 'home') goHome();
  else if (a === 'accept') acceptTable();
  else if (a === 'ft7' || a === 'ft8' || a === 'ft9') { setFt(+a.slice(2)); runDiamonds(false); showVerify(); }
  else if (a === 'retry') beginAuto();
  else if (a === 'quickGo') { hideCard(); resetShotState(); S.drillMode = true; S.dr = quickNew(); S.quickThenWatch = true; S.truthKeep = S.truth; S.truth = null; quickSetSpot(); $('#modeLbl').textContent = MODE_LBL.quick + (S.prof === 'away' ? ' · Away' : ''); setStatus(quickStatus()); dbg('quick', { start: true, fromWatch: true }); }
  else if (a === 'quickWatch') { hideCard(); quickToWatch(); }
  else if (a === 'dismiss') hideCard();
  else if (a === 'manual') beginManual();
  else if (a === 'undo') { if (S.man && S.man.pts.length) { S.man.pts.pop(); S.man.i--; showManual(); } }
  else if (a === 'teach') teachStart();
  else if (a === 'made') { recordDrill(true); setTimeout(() => nextDrill(), 700); }
  else if (a === 'missL') { recordDrill(false, 'missed left'); setTimeout(() => nextDrill(S.drill && S.drill.key), 800); }
  else if (a === 'missR') { recordDrill(false, 'missed right'); setTimeout(() => nextDrill(S.drill && S.drill.key), 800); }
  else if (a === 'missP') { recordDrill(false, 'bad position'); setTimeout(() => nextDrill(S.drill && S.drill.key), 800); }
  else if (a === 'nextDrill') nextDrill();
  else if (a === 'calUndo') calUndo();
  else if (a === 'geoMeasure') geoMeasure();
  else if (a === 'geoDone') geoDone();
  else if (a === 'calSkip') calNext();
  else if (a === 'calFinish') finishCalib();
  else if (a === 'calRedo') { S.cal = { step: 0, shots: [], counts: {} }; showCalCard(); }
  else if (a === 'learnSkip') learnAdvance(1, false);
  else if (a === 'learnBack') learnAdvance(-1, false);
  else if (a === 'learnFinish') learnFinish();
  else if (a === 'learnAgain') learnStart();
}

// ---------- ball picker and teaching ----------
function openPicker(b) {
  S.pickFor = b; const grid = $('#pickGrid'); grid.innerHTML = '';
  for (const id of candIds()) {
    const used = S.balls.some(o => o !== b && o.id === id), btn = document.createElement('button'); btn.className = 'chip ball' + (used ? ' used' : '') + (b.id === id ? ' on' : '');
    btn.innerHTML = '<i style="background:' + ballColor(id) + '"></i>' + (id === 0 ? 'Cue' : id); btn.onclick = () => pickBall(id); grid.appendChild(btn);
  }
  $('#pickTitle').textContent = b.id == null ? 'Which ball is this?' : 'Ball ' + (b.id === 0 ? 'cue' : b.id);
  $('#sheet').hidden = false;
}
function addSample(b, id) {
  if (b.feat && S.cloth) S.samples.push({ id, f: b.feat, cl: S.cloth.v, t: Date.now() });
  const mine = S.samples.filter(s => s.id === id && !s.walk); if (mine.length > 10) S.samples.splice(S.samples.indexOf(mine[0]), 1); save();
}
function pickBall(id) {
  const b = S.pickFor; if (!b) return;
  const other = S.balls.find(o => o !== b && o.id === id); if (other) { other.id = null; other.locked = false; }
  dbg('manual', { id, at: [r1(b.x), r1(b.y)], was: b.id == null ? '?' : b.id, feat: featArr(b.feat) });
  if (S.ev) { delete S.ev[id]; if (b.id != null) delete S.ev[b.id]; }
  b.id = id; b.locked = true; b.pin = true; b.pinShot = S.sess ? S.sess.shots.length : 0; b.pinT = Date.now(); b.conf = 1;
  if (S.watch) addLook(b.feat, id, 'tap'); else addSample(b, id); // a ball the player names by hand is a certain label: learned for this table (Home / Away)
  $('#sheet').hidden = true; S.pickFor = null; S.cands = []; updHud();
  if (S.teach) teachNext();
}
$('#pickHand').onclick = () => {
  const b = S.pickFor; if (!b) return;
  dbg('hand_off', { id: b.id == null ? '?' : b.id, at: [r1(b.x), r1(b.y)] });
  if (b.id != null && b.id >= 1 && !S.gone.includes(b.id)) S.gone.push(b.id);
  if (S.snap) S.snap.balls = S.snap.balls.filter(o => Math.hypot(o.x - b.x, o.y - b.y) > 2); // so it never reads as a make later
  S.balls = S.balls.filter(o => o !== b); if (S.armBalls) S.armBalls = S.armBalls.filter(o => !(o.id === b.id && Math.hypot(o.x - b.x, o.y - b.y) < 2));
  if (S.tableN != null) S.tableN = Math.max(0, S.tableN - 1); if (S.armAll) S.armAll = Math.max(0, S.armAll - 1);
  $('#sheet').hidden = true; S.pickFor = null; S.cands = []; updHud(); toast('Taken off. It will not count as a make.');
};
$('#pickRemove').onclick = () => { S.balls = S.balls.filter(b => b !== S.pickFor); $('#sheet').hidden = true; S.pickFor = null; S.cands = []; if (S.teach) teachNext(); };
$('#pickCancel').onclick = () => { $('#sheet').hidden = true; S.pickFor = null; if (S.teach) teachNext(); };
function showTeachCard() {
  showCard('<h3>Teach the balls</h3><p>Spread the balls out or rack them. Every ball found gets a ring. Tap one to name it, or go through them in order. Each correction teaches the app how that ball looks in these lights.</p><div class="row"><button class="btn primary" data-act="teach">Teach one by one</button></div>');
}
function teachStart() {
  if (!S.balls.length) { setStatus('No balls found yet. Make sure they are on the table and still.'); return; }
  S.teach = { i: -1 }; hideCard(); teachNext();
}
function teachNext() {
  const t = S.teach; if (!t) return; t.i++;
  if (t.i >= S.balls.length) { S.teach = null; setStatus('Taught ' + S.balls.length + ' balls.'); showTeachCard(); return; }
  setStatus('Teaching ' + (t.i + 1) + ' of ' + S.balls.length + '. Name the highlighted ball.'); openPicker(S.balls[t.i]);
}

// ---------- learn the balls: walk up to the table, put each ball in the circle, move around it ----------
const learnOrder = () => S.game === '8ball' ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const learnName = id => id === 0 ? 'Cue ball' : 'The ' + id + ' ball';
function learnStart() {
  S.learn = { order: learnOrder(), i: 0, cnt: 0, need: 18, buf: [], last: 0, hint: '', done: false, got: {}, blob: null, pauseUntil: 0 };
  setStatus(''); $('#planBtn').hidden = true; learnCard(); learnHint('Put the ' + (S.learn.order[0] === 0 ? 'cue ball' : S.learn.order[0] + ' ball') + ' on the cloth inside the circle.');
}
function learnHint(t) { if (S.learn && S.learn.hint !== t) { S.learn.hint = t; setStatus(t); } }
function learnCard() {
  const L = S.learn; if (!L) return; const id = L.order[L.i];
  showCard('<div class="slimtxt"><b>' + learnName(id) + ' · ' + (L.i + 1) + ' of ' + L.order.length + '</b><span>Rest it on the cloth in the circle, then slowly move the phone around it: left, right, closer, higher.</span></div><div class="row"><button class="btn small" data-act="learnBack">Back</button><button class="btn small" data-act="learnSkip">Skip</button><button class="btn small primary" data-act="learnFinish">Finish</button></div>', 0, 'slim');
}
function learnAdvance(d, ok) {
  const L = S.learn; if (!L) return; if (ok) L.got[L.order[L.i]] = true;
  L.i += d; L.cnt = 0; L.buf = []; L.blob = null; L.last = 0; L.hint = '';
  if (L.i < 0) L.i = 0;
  if (L.i >= L.order.length) { learnFinish(); return; }
  learnCard(); learnHint('Now the ' + (L.order[L.i] === 0 ? 'cue ball' : L.order[L.i] + ' ball') + '.');
}
function learnCommit() {
  const L = S.learn, id = L.order[L.i]; S.samples = S.samples.filter(s => !(s.id === id && s.walk)); for (const x of L.buf) S.samples.push(x); save();
}
function learnFinish() {
  const L = S.learn; if (!L) return; L.done = true; L.blob = null;
  const ids = Object.keys(L.got).map(Number), mean = {};
  for (const id of ids) { const a = S.samples.filter(s => s.id === id && s.walk); if (!a.length) continue; const m = { wf: 0, bf: 0, cf: 0, cx: 0, cy: 0, vc: 0 }; for (const s of a) for (const k in m) m[k] += s.f[k] / a.length; mean[id] = m; }
  const pairs = [], ks = Object.keys(mean).map(Number);
  for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) pairs.push([featCost(mean[ks[i]], { f: mean[ks[j]], prior: true }, { v: 1 }) - 0.3, ks[i], ks[j]]);
  pairs.sort((a, b) => a[0] - b[0]);
  const alike = pairs.filter(p => p[0] < 0.45).slice(0, 3).map(p => (p[1] === 0 ? 'cue' : p[1]) + ' and ' + (p[2] === 0 ? 'cue' : p[2])).join(', ');
  setStatus('');
  showCard('<div class="slimtxt"><b>Learned ' + ids.length + ' ball' + (ids.length === 1 ? '' : 's') + '</b><span>' + (alike ? 'Look-alikes in this light: ' + alike + '. If it mixes those up in play, tap the ball to correct it.' : 'None of them look alike in this light.') + '</span></div><div class="row"><button class="btn small" data-act="learnAgain">Do it again</button><button class="btn small primary" data-act="home">Done</button></div>', 0, 'slim');
}
const learnCircle = () => ({ x: MAP.w / 2, y: MAP.h * 0.46, r: Math.min(MAP.w, MAP.h) * 0.2 });
// Shrink a square of the camera picture down to size x size, in halving steps so thin details average out like a far-away ball does.
function shrink(sx, sy, side, size) {
  let src = S.src, x = sx, y = sy, w = side; const cs = [];
  while (w > size * 2) { const nw = Math.max(size, Math.round(w / 2)), c = document.createElement('canvas'); c.width = c.height = nw; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(src, x, y, w, w, 0, 0, nw, nw); src = c; x = 0; y = 0; w = nw; cs.push(c); }
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, x, y, w, w, 0, 0, size, size);
  return g.getImageData(0, 0, size, size);
}
function learnTick() {
  const L = S.learn; if (!L || L.done || !S.live || !MAP || !MAP.photo || !grab()) return;
  const now = performance.now(); if (now < L.pauseUntil) return;
  const cc = learnCircle(), [cx, cy] = MAP.img(cc.x, cc.y), Ri = cc.r / MAP.k, W = S.W, H = S.H, img = imgData(), d = img.data;
  if (cx - Ri * 1.9 < 0 || cy - Ri * 1.9 < 0 || cx + Ri * 1.9 > W || cy + Ri * 1.9 > H) { L.blob = null; learnHint('Point the camera so the circle sits well inside the picture.'); return; }
  // what the cloth around the circle looks like
  const sv = [], vv = []; let hx = 0, hy = 0, nS = 0, nAll = 0;
  for (let a = 0; a < 360; a += 3) for (let rr = 1.35; rr <= 1.85; rr += 0.1) {
    const x = Math.round(cx + Math.cos(a * D2R) * Ri * rr), y = Math.round(cy + Math.sin(a * D2R) * Ri * rr), o = (y * W + x) * 4, [h, s, v] = rgb2hsv(d[o], d[o + 1], d[o + 2]);
    nAll++; sv.push(s); vv.push(v); if (s >= 0.2) { hx += Math.cos(h * D2R) * s; hy += Math.sin(h * D2R) * s; nS++; }
  }
  sv.sort((a, b) => a - b); vv.sort((a, b) => a - b); let hh = Math.atan2(hy, hx) / D2R; if (hh < 0) hh += 360;
  const bg = { h: nS > nAll * 0.4 ? hh : 0, s: nS > nAll * 0.4 ? sv[sv.length >> 1] : Math.min(0.15, sv[sv.length >> 1]), v: vv[vv.length >> 1] };
  // what is not cloth inside the circle, as one blob around the middle
  const n = Math.ceil(Ri) * 2 + 1, x0 = Math.round(cx) - (n >> 1), y0 = Math.round(cy) - (n >> 1), fg = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dx = i - (n >> 1), dy = j - (n >> 1); if (dx * dx + dy * dy > Ri * Ri) continue;
    const o = ((y0 + j) * W + x0 + i) * 4, [h, s, v] = rgb2hsv(d[o], d[o + 1], d[o + 2]); if (!isCloth(h, s, v, bg)) fg[j * n + i] = 1;
  }
  let seed = -1, sd = 1e9; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (fg[j * n + i]) { const dd = (i - (n >> 1)) ** 2 + (j - (n >> 1)) ** 2; if (dd < sd) { sd = dd; seed = j * n + i; } }
  if (seed < 0 || sd > (0.55 * Ri) ** 2) { L.blob = null; learnHint('Put the ball on the cloth inside the circle.'); return; }
  const lab = new Uint8Array(n * n), st = [seed]; lab[seed] = 1; let A = 0, mx = 0, my = 0, bx0 = n, bx1 = 0, by0 = n, by1 = 0, edge = 0;
  while (st.length) {
    const p = st.pop(), i = p % n, j = (p / n) | 0; A++; mx += i; my += j; if (i < bx0) bx0 = i; if (i > bx1) bx1 = i; if (j < by0) by0 = j; if (j > by1) by1 = j;
    if ((i - (n >> 1)) ** 2 + (j - (n >> 1)) ** 2 > (Ri - 2) ** 2) edge++;
    for (const q of [p - 1, p + 1, p - n, p + n]) if (q >= 0 && q < n * n && fg[q] && !lab[q]) { lab[q] = 1; st.push(q); }
  }
  mx = mx / A + x0; my = my / A + y0; const req = Math.sqrt(A / Math.PI), frac = A / (Math.PI * Ri * Ri), fill = A / ((bx1 - bx0 + 1) * (by1 - by0 + 1)), asp = Math.max(bx1 - bx0 + 1, by1 - by0 + 1) / Math.min(bx1 - bx0 + 1, by1 - by0 + 1);
  L.blob = { x: mx, y: my, r: req };
  if (edge > 0.1 * A || frac > 0.97) { learnHint('Back up a little so the whole ball is inside the circle.'); return; }
  if (frac < 0.1) { learnHint('Move closer so the ball fills more of the circle.'); return; }
  if (fill < 0.6 || asp > 1.5) { learnHint('Keep hands, chalk and the cue out of the circle.'); return; }
  if (now - L.last < 250) return;
  const side = req * 2.4, sm = shrink(Math.max(0, mx - side / 2), Math.max(0, my - side / 2), Math.min(side, W - Math.max(0, mx - side / 2), H - Math.max(0, my - side / 2)), 28);
  const f = ballFeat(sm, 14, 14, 28 / 2.4, bg);
  if (!f) { learnHint('Could not read that ball. Move around a little.'); return; }
  L.last = now; L.buf.push({ id: L.order[L.i], f, cl: bg.v, t: Date.now(), walk: 1 }); L.cnt++;
  learnHint(L.cnt < L.need * 0.4 ? 'Good. Keep the ball in the circle and start moving around it.' : L.cnt < L.need * 0.8 ? 'Keep going. Try a lower angle, then from the other side.' : 'Almost there…');
  if (L.cnt >= L.need) { learnCommit(); L.pauseUntil = now + 900; const id = L.order[L.i]; learnHint(learnName(id) + ' learned.'); setTimeout(() => learnAdvance(1, true), 850); }
}
function drawLearn() {
  const L = S.learn, c = sctx; drawVideo(); if (!L) return; const cc = learnCircle();
  c.save(); c.fillStyle = 'rgba(6,10,14,.58)'; c.beginPath(); c.rect(0, 0, MAP.w, MAP.h); c.moveTo(cc.x + cc.r, cc.y); c.arc(cc.x, cc.y, cc.r, 0, Math.PI * 2, true); c.closePath(); c.fill('evenodd'); c.restore();
  c.save(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(cc.x, cc.y, cc.r, 0, 7); c.stroke();
  const p = clamp(L.cnt / L.need, 0, 1); if (p > 0) { c.strokeStyle = css('--accent'); c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.arc(cc.x, cc.y, cc.r + 7, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); c.stroke(); }
  if (L.blob && !L.done) { const q = MAP.scr(L.blob.x, L.blob.y); c.strokeStyle = 'rgba(89,214,232,.8)'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.arc(q[0], q[1], L.blob.r * MAP.k, 0, 7); c.stroke(); c.setLineDash([]); }
  // which ball, big, above the circle; a row of dots for the whole set
  if (!L.done) {
    const id = L.order[L.i], bx = cc.x, by = cc.y - cc.r - 34;
    c.fillStyle = ballColor(id); c.beginPath(); c.arc(bx - 52, by, 17, 0, 7); c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = '#fff'; c.font = '600 26px Inter, system-ui, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText(id === 0 ? 'Cue ball' : 'Ball ' + id, bx - 28, by + 1);
  }
  const n = L.order.length, gap = Math.min(22, (MAP.w - 40) / n), x0 = MAP.w / 2 - gap * (n - 1) / 2, y0 = cc.y + cc.r + 22;
  for (let i = 0; i < n; i++) { c.fillStyle = L.got[L.order[i]] ? css('--accent') : (i === L.i && !L.done ? '#fff' : 'rgba(255,255,255,.28)'); c.beginPath(); c.arc(x0 + i * gap, y0, i === L.i && !L.done ? 5 : 3.5, 0, 7); c.fill(); }
  c.restore();
}

// ---------- session stats ----------
const fmtDur = ms => { const m = Math.round(ms / 60000); return m < 1 ? 'under a minute' : m + ' min'; };
function statsHtml(se, live) {
  // Watch & Learn shots are counted by how many balls really went down (drop), and named by the ball the player was shooting
  const isMade = x => x.drill ? !!x.dmade : x.drop != null ? x.drop > 0 : x.made.length > 0;
  const shots = se.shots.filter(x => !x.doubt && !x.thrown), made = shots.filter(isMade).length, n = shots.length, miss = n - made, pct = n ? Math.round(100 * made / n) : 0;
  const pots = [].concat(...shots.map(x => x.drill ? (x.dmade ? [x.ball] : []) : x.drop != null ? (x.drop ? [x.target != null ? x.target : '?'].concat(Array(Math.max(0, x.drop - 1)).fill('?')) : []) : x.made)).map(i => i === '?' ? '(unread)' : i), rows = shots.map((x, i) => {
    if (x.drill) return '<div class="srow ' + (x.dmade ? 'ok' : 'no') + '"><b>' + (i + 1) + '</b><span>' + (x.dmade ? 'Made the ' + x.ball : 'Missed the ' + x.ball) + '</span><em>' + ['drill', x.blind ? 'ball not seen, taken as made' : '', x.scratch ? 'scratch' : ''].filter(Boolean).join(' · ') + '</em></div>';
    const res = x.drop != null ? (x.drop ? 'Made ' + (x.target != null ? 'the ' + x.target : 'a ball') + (x.drop > 1 ? ' + ' + (x.drop - 1) + ' more' : '') : 'Miss') : x.made.length ? 'Made ' + x.made.map(i => i === '?' ? 'a ball' : i).join(', ') : 'Miss';
    const cam = x.target != null && x.via ? (x.first === x.target ? 'camera agreed' : 'camera said ' + (x.first == null ? '?' : x.first === 0 ? 'cue' : x.first)) : '';
    const note = [x.unseen ? 'not seen, read after' : '', x.scratch ? 'scratch' : '', x.target != null ? 'shooting the ' + x.target : (x.first != null ? 'hit the ' + x.first + ' first' : ''), cam].filter(Boolean).join(' · ');
    return '<div class="srow ' + (isMade(x) ? 'ok' : 'no') + '"><b>' + (i + 1) + '</b><span>' + res + '</span><em>' + note + '</em></div>';
  }).join('');
  return '<h2>' + (live ? 'Session so far' : 'Last session') + '</h2>' +
    '<div class="big"><b>' + made + ' of ' + n + '</b><span>shots made' + (n ? ' · ' + pct + '%' : '') + '</span></div>' +
    '<div class="grid3"><div><b>' + n + '</b><span>shots tracked</span></div><div><b>' + made + '</b><span>makes</span></div><div><b>' + miss + '</b><span>misses</span></div></div>' +
    '<p class="lbl">' + (pots.length ? 'Balls down: ' + pots.join(', ') + '. ' : 'No balls down yet. ') + (se.shots.some(x => x.doubt) ? 'Not counted (the table was misread): ' + se.shots.filter(x => x.doubt).length + '. ' : '') + (se.shots.some(x => x.thrown) ? 'Thrown out: ' + se.shots.filter(x => x.thrown).length + '. ' : '') + (se.hand ? 'Ball in hand: ' + se.hand + '. ' : '') + 'Debug log: ' + DBG.ev.length + ' notes. Shots the camera saw but ignored as nudges: ' + (se.ignored || 0) + '. Session length: ' + fmtDur((se.t1 || Date.now()) - se.t0) + '.</p>' +
    (rows ? '<div class="slist">' + rows + '</div>' : '<p class="lbl">No shots tracked yet.</p>');
}
function showStats(live) {
  const se = live ? S.sess : S.lastSess; if (!se) return;
  $('#statsBody').innerHTML = statsHtml(se, live);
  $('#statsBtns').innerHTML = live ? '<button class="btn primary" data-s="back">Back to the table</button><button class="btn" data-s="dbg">Save debug</button><button class="btn" data-s="reset">Clear and keep playing</button><button class="btn bad" data-s="end">End session</button>' : '<button class="btn primary" data-s="close">Close</button><button class="btn" data-s="dbg">Save debug</button>';
  $('#stats').hidden = false;
}
$('#endFab').onclick = () => showStats(true);
$('#undoBtn').onclick = () => throwOutLast();
$('#flagBtn').onclick = () => flagLast();
$('#zoomBtn').onclick = () => { setZoom(1, 0.5, 0.5); S.ref = null; save(); };
$('#statsBtns').addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if (!b) return; const a = b.dataset.s;
  if (a === 'dbg') { saveDebug(); return; }
  if (a === 'back' || a === 'close') $('#stats').hidden = true;
  else if (a === 'reset') { const w = S.sess.watch; S.sess = { t0: Date.now(), shots: [], ignored: 0, game: S.sess.game, watch: w || undefined, drill: S.sess.drill }; if (w) frameSessionStart(S.sess.t0); LEARNED.clear(); S.gone = []; $('#stats').hidden = true; updUndo(); }
  else if (a === 'end') { const had = S.sess && S.sess.shots.length; $('#stats').hidden = true; goHome(); if (had) setTimeout(() => showStats(false), 50); }
});

// ---------- pointer handling ----------
let ptr = null;
// two fingers = pinch to zoom the picture the app works from (and drag to move around in it)
const fingers = new Map(); let pinch = null;
function pinchStart() {
  const [a, b] = [...fingers.values()], r = stage.getBoundingClientRect(), mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top, v = S.vr;
  pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, z0: v.z, px: v.x + (mx - MAP.ox) / (S.W * MAP.k) * v.w, py: v.y + (my - MAP.oy) / (S.H * MAP.k) * v.h };
}
function pinchMove() {
  const [a, b] = [...fingers.values()], r = stage.getBoundingClientRect(), mx = (a[0] + b[0]) / 2 - r.left, my = (a[1] + b[1]) / 2 - r.top, v = S.vr;
  const z = clamp(pinch.z0 * Math.hypot(a[0] - b[0], a[1] - b[1]) / pinch.d0, 1, 4), w = v.vw / z, h = v.vh / z;
  const u = (mx - MAP.ox) / (S.W * MAP.k), t = (my - MAP.oy) / (S.H * MAP.k), x = pinch.px - u * w, y = pinch.py - t * h;
  setZoom(z, (x + w / 2) / v.vw, (y + h / 2) / v.vh);
}
function pinchEnd() { pinch = null; S.ref = null; S.sizeBad = 0; save(); }
stage.addEventListener('pointerdown', e => {
  const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; try { stage.setPointerCapture(e.pointerId); } catch (err) { }
  fingers.set(e.pointerId, [e.clientX, e.clientY]);
  if (fingers.size === 2 && S.mode !== 'learn' && MAP && MAP.photo && S.vr) { ptr = null; pinchStart(); return; }
  if (fingers.size > 1) return;
  if (S.phase === 'manual' && S.man && MAP.photo) { ptr = { kind: 'man' }; S.man.hold = [x, y]; return; }
  if (S.phase === 'verify' && MAP.photo && S.quad) {
    let bi = -1, bd = 36; S.quad.forEach((p, i) => { const q = MAP.scr(p[0], p[1]), d = Math.hypot(q[0] - x, q[1] - y); if (d < bd) { bd = d; bi = i; } });
    if (bi >= 0) { ptr = { kind: 'corner', i: bi }; return; }
  }
  if (S.phase === 'run' && (S.mode === 'teach' || S.mode === 'play9' || S.mode === 'play8')) {
    let bi = -1, bd = 1e9; S.balls.forEach((b, i) => { const q = MAP.p(b.x, b.y, S.P.R), d = Math.hypot(q[0] - x, q[1] - y); if (d < bd && d < Math.max(24, MAP.r(b.x, b.y) * 2.6)) { bd = d; bi = i; } });
    ptr = { kind: 'ball', i: bi, sx: x, sy: y, moved: false };
  }
});
stage.addEventListener('pointermove', e => {
  if (fingers.has(e.pointerId)) fingers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch) { if (fingers.size >= 2) pinchMove(); return; }
  if (!ptr) return; const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (ptr.kind === 'man') { S.man.hold = [x, y]; return; }
  if (ptr.kind === 'corner') { const [ix, iy] = MAP.img(x, y); S.quad[ptr.i] = [clamp(ix, 0, S.W), clamp(iy, 0, S.H)]; return; }
  if (ptr.kind === 'ball' && ptr.i >= 0) {
    if (!ptr.moved && Math.hypot(x - ptr.sx, y - ptr.sy) < 8) return;
    ptr.moved = true; const b = S.balls[ptr.i], t = MAP.inv(x, y, S.P.R); b.x = clamp(t[0], S.P.R, S.P.L - S.P.R); b.y = clamp(t[1], S.P.R, S.P.W - S.P.R); b.locked = true; b.pin = true; S.cands = []; updHud();
  }
});
const fingerUp = e => { fingers.delete(e.pointerId); if (pinch && fingers.size < 2) pinchEnd(); };
stage.addEventListener('pointercancel', fingerUp);
stage.addEventListener('pointerup', e => {
  const wasPinch = !!pinch; fingerUp(e); if (wasPinch) { ptr = null; return; }
  if (!ptr) return; const p = ptr; ptr = null; const r = stage.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (p.kind === 'man') {
    const [ix, iy] = MAP.img(x, y); S.man.hold = null; S.man.pts.push([clamp(ix, 0, S.W), clamp(iy, 0, S.H)]); S.man.i++;
    if (S.man.i >= 4) { const pts = S.man.pts; S.man = null; S.calRes = { conf: 1, corners: 4, sides: 2, tips: [] }; setQuad(pts); runDiamonds(false); S.phase = 'verify'; showVerify(); } else showManual();
    return;
  }
  if (p.kind === 'corner') { setQuad(S.quad, S.rot); runDiamonds(false); return; }
  if (p.kind === 'ball' && !p.moved) {
    if (p.i >= 0) { openPicker(S.balls[p.i]); return; }
    const t = MAP.inv(x, y, S.P.R);
    if (t[0] > S.P.R && t[0] < S.P.L - S.P.R && t[1] > S.P.R && t[1] < S.P.W - S.P.R) {
      const nb = { id: null, x: t[0], y: t[1], feat: null };
      if (MAP.photo && S.cam && S.cloth) { const q = S.cam.proj(t[0], t[1], S.P.R); nb.feat = ballFeat(imgData(), q[0], q[1], S.cam.rad(t[0], t[1], S.P.R, S.P.R), S.cloth); }
      S.balls.push(nb); openPicker(nb);
    }
  }
});

// ---------- training ----------
const DKEYS = Object.keys(DRILLS);
function drillRate(k) { const s = S.drillStats[k]; return s && s.n ? s.made / s.n : null; }
function pickDrill() {
  const w = DKEYS.map(k => { const s = S.drillStats[k] || { n: 0, made: 0 }, rate = s.n ? s.made / s.n : 0.5, recent = (s.last || []).slice(-4), rr = recent.length ? recent.filter(x => !x).length / recent.length : 0; return 0.15 + (1 - rate) * 1.2 + rr * 0.8; });
  let t = w.reduce((a, b) => a + b, 0) * Math.random(); for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0) return DKEYS[i]; } return DKEYS[0];
}
function nextDrill(force) {
  S.drill = genDrill(force || pickDrill(), S.P); S.drillResult = ''; S.placeMsg = ''; S.onMarks = false; S.drillLogged = false; showDrillCard();
}
function showDrillCard() {
  const d = S.drill; if (!d) { showCard('<h3>No drill</h3><p>Could not build a drill on this table.</p>'); return; }
  const c = d.balls[0], t = d.balls[1], r = drillRate(d.key), s = S.drillStats[d.key];
  showCard('<h3>' + d.title + ' to the ' + S.P.pocketNames[d.pocket] + '</h3><p>Use the cue ball and the 1 ball. Place them on the marks. Leave the cue ball inside the pink ring.</p><p id="placeMsg" style="font:500 12px var(--f-mono)"></p><p style="opacity:.75">' + (s ? 'Your record: ' + s.made + ' of ' + s.n : 'First time at this one') + '</p><div class="row"><button class="btn good" data-act="made">Made it</button><button class="btn bad" data-act="missL">Missed left</button><button class="btn bad" data-act="missR">Missed right</button><button class="btn bad" data-act="missP">Bad position</button><button class="btn" data-act="nextDrill">Skip</button></div>');
  updTrainMsg();
}
function recordDrill(made, how) {
  const d = S.drill; if (!d) return;
  const s = S.drillStats[d.key] || (S.drillStats[d.key] = { n: 0, made: 0, last: [], miss: {} });
  s.n++; if (made) s.made++; s.last = (s.last || []).concat([made ? 1 : 0]).slice(-8);
  if (!made && how) { s.miss = s.miss || {}; s.miss[how] = (s.miss[how] || 0) + 1; }
  S.history.push({ t: Date.now(), kind: 'drill', key: d.key, made, how }); save();
  setStatus(made ? 'Made. Logged.' : 'Logged ' + (how || 'miss') + '. This drill will come up more often.');
}
function trainCheck(found) {
  const d = S.drill, cue = found.find(b => b.id === 0), obj = found.find(b => b.id !== 0);
  if (!cue || !obj) { S.placeMsg = 'Place the cue ball and the 1 ball on the marks.'; S.onMarks = false; updTrainMsg(); return; }
  const out = [];
  for (const [name, f, tgt] of [['Cue ball', cue, d.balls[0]], ['1 ball', obj, d.balls[1]]]) {
    const dd = Math.hypot(f.x - tgt.x, f.y - tgt.y); if (dd < 1.2) continue;
    const dx = tgt.x - f.x, dy = tgt.y - f.y;
    out.push(name + ': move ' + dd.toFixed(1) + ' in. ' + [Math.abs(dx) > 0.5 ? (dx > 0 ? 'toward the right rail' : 'toward the left rail') : '', Math.abs(dy) > 0.5 ? (dy > 0 ? 'toward the top rail' : 'toward the bottom rail') : ''].filter(Boolean).join(' and '));
  }
  S.onMarks = !out.length; S.placeMsg = out.length ? out.join('. ') + '.' : 'Both balls are on their marks. Take the shot.'; updTrainMsg();
}
function updTrainMsg() { const e = $('#placeMsg'); if (e) { e.textContent = S.placeMsg || ''; e.style.color = S.onMarks ? '#6ff0a8' : '#ffc860'; } }

// ---------- sounds: ding when a shot starts, dong when it has been recorded ----------
// iPhone Safari only lets a page make sound after a real tap (a touch that ends, not just starts), and it can pause the
// audio engine again when the camera starts. So: two small WAV clips made in code, played through ordinary audio elements that
// are unlocked by the first tap, with the Web Audio engine as a back-up. Every attempt is written to the debug log.
const AU = { ctx: null, el: {}, unlocked: false, tries: 0 };
function mkWav(parts, dur, vol, decay) {
  const sr = 22050, n = Math.round(sr * dur), buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const t = i / sr, env = Math.min(1, t / 0.006) * Math.exp(-t * decay); let x = 0; for (const [f, a] of parts) x += a * Math.sin(2 * Math.PI * f * t); v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x * env * vol)) * 32767, true); }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
const CLIPS = { ding: [[[1319, 1], [2637, 0.3], [1976, 0.2]], 0.45, 0.5, 9], dong: [[[330, 1], [165, 0.7], [660, 0.25]], 1.1, 0.55, 3.2] };
function audioInit() {
  try {
    // keep playing with the silent switch on; but while the microphone listens the phone decides ('auto' = play and record)
    if (navigator.audioSession && !(typeof MIC !== 'undefined' && (MIC.on || MIC.busy))) navigator.audioSession.type = 'playback';
    if (!AU.el.ding) for (const k in CLIPS) { const a = new Audio(mkWav(...CLIPS[k])); a.preload = 'auto'; a.setAttribute('playsinline', ''); AU.el[k] = a; }
    if (!AU.ctx) { const C = window.AudioContext || window.webkitAudioContext; if (C) AU.ctx = new C(); }
    if (AU.ctx && AU.ctx.state !== 'running') AU.ctx.resume().catch(() => { });
  } catch (e) { dbg('snd', { err: 'init ' + String(e).slice(0, 80) }); }
}
// runs on a finished tap: play each clip silently once so the browser lets us play them later without a tap
function audioUnlock() {
  audioInit(); if (AU.unlocked || !AU.el.ding) return;
  let ok = 0;
  for (const k in AU.el) { const a = AU.el[k]; a.muted = true; const pr = a.play(); if (pr && pr.then) pr.then(() => { a.pause(); a.currentTime = 0; a.muted = false; ok++; if (ok === 2) { AU.unlocked = true; dbg('snd', { unlocked: true, ctx: AU.ctx && AU.ctx.state }); } }).catch(e => { a.muted = false; dbg('snd', { unlockFail: String(e && e.name || e) }); }); }
}
for (const ev of ['touchend', 'click', 'pointerup']) document.addEventListener(ev, audioUnlock, { passive: true });
function chime(name) {
  AU.tries++; if (!S.sound) return; audioInit(); AU.playT = performance.now(); AU.playDur = CLIPS[name][1] * 1000;
  const a = AU.el[name], st = AU.ctx && AU.ctx.state;
  const viaCtx = () => { // back-up: synthesize it live
    const c = AU.ctx; if (!c) { dbg('snd', { n: name, via: 'none' }); return; } if (c.state !== 'running') c.resume().catch(() => { });
    try { const [parts, dur, vol] = CLIPS[name], t = c.currentTime, g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(c.destination); for (const [f, am] of parts) { const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = f; og.gain.value = am; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + 0.05); } dbg('snd', { n: name, via: 'ctx', ctx: c.state }); } catch (e) { dbg('snd', { n: name, err: String(e).slice(0, 80) }); }
  };
  if (!a) { viaCtx(); return; }
  try { a.muted = false; a.currentTime = 0; const pr = a.play(); if (pr && pr.then) pr.then(() => dbg('snd', { n: name, via: 'audio', ctx: st, unlocked: AU.unlocked })).catch(e => { dbg('snd', { n: name, via: 'audio-fail', e: String(e && e.name || e), ctx: st, unlocked: AU.unlocked }); viaCtx(); }); } catch (e) { viaCtx(); }
}
const ding = () => chime('ding');
const dong = () => chime('dong');

// ---------- a wobbly tripod ----------
// Touching the screen shakes a phone on a tall tripod. While a finger is down, and for 2 seconds after, and whenever the
// motion sensor says the phone is swaying, nothing is read and no shot can start. Then the table is checked against the rail
// diamonds and the outline nudged back on if the phone settled a little differently.
const WOB = { on: false, n: 0, max: 0, last: 0 };
function frozen() { const t = performance.now(); return (!!S.touchDown && t - (S.touchT || 0) < 10000) || t < (S.freezeUntil || 0); } // a touch that never ended stops counting after 10 s
function freezeFor(ms) { S.freezeUntil = Math.max(S.freezeUntil || 0, performance.now() + ms); }
function recheckAfterFreeze() {
  S.needRecheck = false; if (!S.quad || S.phase !== 'run') return;
  // (V2.2: no diamond search here any more: it took a full-size frame after every touch and made the picture stutter.
  // The camera-moved check right after this compares with the picture from before the touch and finds the table again.)
  const df = null;
  dbg('recheck', { dia: df ? df.n : 0, moved: df ? r1(df.moved) : null });
  if (df && df.moved > Math.max(3, 0.003 * S.W)) { setQuad(df.q, S.rot); S.quadN = S.quad.map(vnFromSrc); save(); tableMoved(); }
  if (df) { S.ref = null; S.lastCa = null; } // checked against the diamonds: start the camera-moved check afresh; otherwise it compares with before the touch
}
for (const [ev, down] of [['pointerdown', true], ['pointerup', false], ['pointercancel', false]]) document.addEventListener(ev, () => {
  if ($('#cam').hidden) return;
  if (down) { S.touchDown = true; S.touchT = performance.now(); } else { S.touchDown = false; freezeFor(2000); }
}, true);
// the motion sensor (iPhone asks once; it has to be asked from a tap)
function motionStart() { // returns a promise that settles once the question has been answered (so the camera question comes after it)
  if (WOB.on) return null; const go = () => { if (WOB.on) return; WOB.on = true; window.addEventListener('devicemotion', onMotion); dbg('motion', { on: true }); };
  try {
    if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') return DeviceMotionEvent.requestPermission().then(r => { if (r === 'granted') go(); else dbg('motion', { on: false, r }); }).catch(e => dbg('motion', { on: false, err: String(e).slice(0, 60) }));
    if (window.DeviceMotionEvent) go();
  } catch (e) { }
  return null;
}
function onMotion(e) {
  const r = e.rotationRate; if (!r || $('#cam').hidden) return;
  const w = Math.hypot(r.alpha || 0, r.beta || 0, r.gamma || 0); // degrees per second
  if (w > 3) { freezeFor(700); const t = performance.now(); if (t - WOB.last > 1500) WOB.n++; WOB.last = t; WOB.max = Math.max(WOB.max, w); }
}

// ---------- the shot is over when every ball has stopped ----------
// After the cue ball stops, keep looking at the whole cloth. Two things say balls are still rolling: pixels on open cloth
// changing between looks, and balls not where they were a moment ago. Anything inside a person's outline (an arm, someone
// walking along the table) does not count. Over when both have been quiet for about a second (or after 25 seconds).
function settlePts() {
  const H = S.cam.Hit, P = S.P, W = S.W, idx = [];
  let x0 = W, x1 = 0, y0 = S.H, y1 = 0; for (const p of S.quad) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W - 1, Math.ceil(x1)); y1 = Math.min(S.H - 1, Math.ceil(y1));
  for (let y = y0; y <= y1; y += 3) for (let x = x0; x <= x1; x += 3) {
    const w = H[6] * x + H[7] * y + H[8], tx = (H[0] * x + H[1] * y + H[2]) / w, ty = (H[3] * x + H[4] * y + H[5]) / w;
    if (tx > 0.6 && ty > 0.6 && tx < P.L - 0.6 && ty < P.W - 0.6) idx.push(y * W + x);
  }
  return Uint32Array.from(idx);
}
function settleWatch(done) {
  const tok = S.settling = { t0: performance.now(), quietT: null, lum: null, cl: null, occ: null, balls: null, n: 0, mvMax: 0, pts: S.cam ? settlePts() : new Uint32Array(0) };
  setStatus('Waiting for the balls to stop…');
  const tick = () => {
    if (S.settling !== tok) return; if (!S.live || !S.cam || !S.cloth) { S.settling = null; done(); return; }
    if (!grab()) { setTimeout(tick, 180); return; }
    const tl0 = performance.now(), img = imgData(), d = img.data, W = S.W, info = { still: STILL.mask ? stillInfo() : undefined };
    const found = detectBalls(img, S.cam, S.P, S.cloth, info), occ = info.occ;
    const inOcc = (o, i) => { if (!o) return false; const x = i % W, y = (i / W) | 0, gx = (x / o.cs) | 0, gy = (y / o.cs) | 0; return gx < o.gw && gy < o.gh && !!o.g[gy * o.gw + gx]; };
    // a spot counts as moving when it changes between cloth and not-cloth (a ball rolling over it); a shadow passing over the
    // cloth darkens it but leaves it cloth, and anything inside a person's outline is left out
    const pts = tok.pts, lum = new Uint8Array(pts.length), cl = new Uint8Array(pts.length); let mv = 0;
    for (let k = 0; k < pts.length; k++) { const o = pts[k] * 4, r = d[o], g = d[o + 1], b = d[o + 2]; lum[k] = (r * 77 + g * 150 + b * 29) >> 8; const hsv = rgb2hsv(r, g, b); cl[k] = isCloth(hsv[0], hsv[1], hsv[2], S.cloth) ? 1 : 0; }
    if (tok.lum) for (let k = 0; k < pts.length; k++) { if (cl[k] !== tok.cl[k] && Math.abs(lum[k] - tok.lum[k]) > 26 && !inOcc(occ, pts[k]) && !inOcc(tok.occ, pts[k])) mv++; }
    // balls seen in both looks must be where they were (a ball blinking in or out of view is not motion; the pixels catch a blur)
    const vis = found.filter(b => !hiddenAt(b, occ)); let bm = 0;
    if (tok.balls) for (const b of vis) { let m = 1e9; for (const p of tok.balls) m = Math.min(m, Math.hypot(p.x - b.x, p.y - b.y)); if (m > 0.4 && m < 6) bm = Math.max(bm, m); }
    const lim = Math.max(6, pts.length * 0.0015), quiet = tok.n > 0 && mv < lim && bm < 0.4, now = performance.now();
    lagT('settle', tl0); tok.mvMax = Math.max(tok.mvMax, mv); tok.n++; tok.lum = lum; tok.cl = cl; tok.occ = occ; tok.balls = vis.map(b => ({ x: b.x, y: b.y }));
    if (quiet) { if (!tok.quietT) tok.quietT = now; } else tok.quietT = null;
    const timeout = now - tok.t0 > 12000;
    if ((tok.quietT && now - tok.quietT >= 900) || timeout) { S.settling = null; dbg('settled', { s: r1((now - tok.t0) / 1000), looks: tok.n, mvMax: tok.mvMax, timeout: timeout || undefined }); done(timeout); return; }
    setTimeout(tick, 180);
  };
  setTimeout(tick, 60);
}

// ---------- microphone: the tip on the cue ball, and the cue ball on the first ball ----------
// Sharp clicks are picked out of the sound (a sudden jump in the high-pitched part, well above the room's usual level).
// A click alone proves nothing (rails, footsteps, a dropped piece of chalk): it only counts when it lines up with what
// the camera saw, the strike just before the cue ball starts moving, the contact while the cue ball is touching a ball.
// Our own ding and dong are ignored.
const MIC = { on: false, an: null, buf: null, last: 0, floor: 0, ev: [], st: null, refr: 0, n: 0, busy: false };
async function micStart() {
  if (MIC.on || MIC.busy) return; MIC.busy = true;
  try {
    audioInit(); const c = AU.ctx; if (!c) throw new Error('no audio engine');
    if (navigator.audioSession) navigator.audioSession.type = 'auto'; // 'playback' would shut the microphone off
    const want = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false };
    const st = await navigator.mediaDevices.getUserMedia(want);
    if (!S.live || !S.watch || !S.micOn) { st.getTracks().forEach(t => t.stop()); MIC.busy = false; if (navigator.audioSession) navigator.audioSession.type = 'playback'; return; }
    for (const tr of st.getAudioTracks()) { tr.onended = () => { dbg('mic', { ended: true }); MIC.on = false; }; tr.onmute = () => dbg('mic', { muted: true }); tr.onunmute = () => dbg('mic', { muted: false }); }
    // a long buffer (0.7 s): the page can be busy for a while between looks, and only the new part is read each time
    MIC.st = st; const src = c.createMediaStreamSource(st), an = c.createAnalyser(); an.fftSize = 32768; src.connect(an);
    const g = c.createGain(); g.gain.value = 0; an.connect(g); g.connect(c.destination); MIC.nodes = [src, an, g]; // g: keeps Safari pulling the samples
    MIC.an = an; MIC.buf = new Float32Array(an.fftSize); MIC.sr = c.sampleRate; MIC.last = c.currentTime; MIC.on = true; MIC.ev = []; MIC.floor = 0;
    MIC.timer = setInterval(micPoll, 20);
    dbg('mic', { on: true, sr: c.sampleRate, ctx: c.state, session: navigator.audioSession ? navigator.audioSession.type : null, label: ((st.getAudioTracks()[0] || {}).label || '').slice(0, 60) });
  } catch (e) { dbg('mic', { on: false, err: String(e && (e.name || e.message) || e).slice(0, 80) }); if (navigator.audioSession) navigator.audioSession.type = 'playback'; }
  MIC.busy = false;
}
function micStop() {
  clearInterval(MIC.timer); try { if (MIC.st) MIC.st.getTracks().forEach(t => t.stop()); (MIC.nodes || []).forEach(n => n.disconnect()); } catch (e) { }
  const was = MIC.on; MIC.st = null; MIC.on = false; MIC.an = null; MIC.nodes = null; if (was && navigator.audioSession) navigator.audioSession.type = 'playback';
}
function micPoll() {
  const c = AU.ctx, an = MIC.an; if (!an || !c) return;
  if (c.state !== 'running') { c.resume().catch(() => { }); MIC.last = c.currentTime; return; }
  const tNow = c.currentTime, pNow = performance.now(), x = MIC.buf, N = x.length, sr = MIC.sr, B = Math.max(16, Math.round(sr / 1000));
  an.getFloatTimeDomainData(x);
  let fresh = Math.round((tNow - MIC.last) * sr); MIC.last = tNow; if (fresh <= 0) return; fresh = Math.min(N - 1, fresh);
  for (let s0 = N - Math.floor(fresh / B) * B; s0 + B <= N; s0 += B) {
    let e = 0, pk = 0; for (let i = Math.max(1, s0); i < s0 + B; i++) { const dd = x[i] - x[i - 1]; e += dd * dd; const a = Math.abs(x[i]); if (a > pk) pk = a; }
    e /= B; const t = pNow - (N - s0 - B) / sr * 1000;
    if (!MIC.floor) { MIC.floor = e || 1e-9; continue; }
    // strong clicks (10x the room) can be a strike; softer ones (5x) are kept for the cue ball meeting a ball, which is quieter.
    // A click that starts soft and gets louder a millisecond later is one click: its loudest part decides.
    const lastEv = MIC.ev[MIC.ev.length - 1];
    if (lastEv && t <= MIC.refr && t - lastEv.t < 45 && e / MIC.floor > lastEv.r) { const was = lastEv.weak; lastEv.r = Math.round(e / MIC.floor); lastEv.pk = Math.max(lastEv.pk, r2(pk)); if (e > 10 * MIC.floor && e > 2e-6) { delete lastEv.weak; if (was) MIC.n++; } }
    else if (e > 5 * MIC.floor && e > 1e-6 && t > MIC.refr) {
      const self = AU.playT && t > AU.playT - 30 && t < AU.playT + (AU.playDur || 0) + 150, weak = !(e > 10 * MIC.floor && e > 2e-6);
      MIC.ev.push({ t, r: Math.round(e / MIC.floor), pk: r2(pk), self: self || undefined, weak: weak || undefined }); if (!weak) MIC.n++; MIC.refr = t + 45;
      if (MIC.ev.length > 300) MIC.ev.splice(0, 100);
    }
    MIC.floor = e < 4 * MIC.floor ? MIC.floor * 0.99 + e * 0.01 : MIC.floor * 0.9995 + e * 0.0005;
  }
}
const micClicks = (a, b, weakOk) => MIC.ev.filter(c => c.t >= a && c.t <= b && !c.self && (weakOk || !c.weak));

// ---------- which ball the cue ball hit first (from the picture, and from the sound) ----------
function segDist(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay, L2 = vx * vx + vy * vy; let t = L2 ? ((px - ax) * vx + (py - ay) * vy) / L2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(ax + vx * t - px, ay + vy * t - py);
}
function watchShotInfo(rec, track) {
  const R = S.P.R, tk = rec.track, pts = rec.pts || [], balls = rec.before.filter(b => b.id !== 0).concat(rec.un || []);
  // camera: the first ball whose spot the cue ball's path comes within touching distance of, moving toward it
  // Measured on the table in inches, with room for how far off a reading can be at that spot (far from the camera one pixel
  // is a lot of cloth): touching = centres 2 radii apart; a pass within that plus a little counts, a bit wider only if the
  // cue ball's path bends or it slows right there (at speed the frames are an inch or two apart).
  const cam = S.cam, bi = balls.map(b => { const q = cam.proj(b.x, b.y, R), u0 = cam.unproj(q[0], q[1], R), u1 = cam.unproj(q[0], q[1] + 1, R), u2 = cam.unproj(q[0] + 1, q[1], R); return { b, ipp: Math.max(Math.hypot(u1[0] - u0[0], u1[1] - u0[1]), Math.hypot(u2[0] - u0[0], u2[1] - u0[1])) }; });
  const bendAt = i => {
    const a0 = tk[Math.max(0, i - 3)], a1 = tk[Math.max(0, i - 1)], b0 = tk[Math.min(tk.length - 1, i)], b1 = tk[Math.min(tk.length - 1, i + 3)];
    const d1 = Math.atan2(a1[2] - a0[2], a1[1] - a0[1]), d2 = Math.atan2(b1[2] - b0[2], b1[1] - b0[1]); let dd = Math.abs(d2 - d1) / D2R; if (dd > 180) dd = 360 - dd;
    const v1 = Math.hypot(a1[1] - a0[1], a1[2] - a0[2]) / Math.max(1e-3, a1[0] - a0[0]), v2 = Math.hypot(b1[1] - b0[1], b1[2] - b0[2]) / Math.max(1e-3, b1[0] - b0[0]);
    return { deg: Math.round(dd), slow: r2(v1 > 0.5 ? v2 / v1 : 1) };
  };
  // the path starts where the cue ball sat (it is only picked up once it is an inch or two away, so a ball frozen against it
  // would otherwise be missed)
  const path = [[tk[0][0], rec.pos0.x, rec.pos0.y]].concat(tk);
  let tf = null, near = null;
  // frozen: a ball touching the cue ball where it sat is hit at once, and the cue ball goes off sideways (up to about 95
  // degrees from the line to that ball); heading clearly away from it means it was shot away from that ball instead
  { const p0 = rec.pos0, h = [tk[Math.min(2, tk.length - 1)][1] - p0.x, tk[Math.min(2, tk.length - 1)][2] - p0.y], hl = Math.hypot(h[0], h[1]); let best = null, bg = 1e9;
    if (hl > 0.3) for (const o of bi) { const dx = o.b.x - p0.x, dy = o.b.y - p0.y, d = Math.hypot(dx, dy), gap = d - 2 * R; if (gap > 0.3 + o.ipp || gap >= bg) continue; const cos = (dx * h[0] + dy * h[1]) / (d * hl); if (cos > -0.1) { bg = gap; best = { b: o.b, gap, cos }; } }
    if (best) tf = { b: best.b, i: 0, d: best.gap + 2 * R, bend: null, sure: best.cos > 0.2, frozen: true }; }
  for (let i = 1; i < path.length && !tf; i++) {
    const ax = path[i - 1][1], ay = path[i - 1][2], cx = path[i][1], cy = path[i][2]; let best = null, bd = 1e9, sure = false;
    if (Math.hypot(cx - ax, cy - ay) < 0.05) continue;
    for (const o of bi) {
      const d = segDist(o.b.x, o.b.y, ax, ay, cx, cy), gap = d - 2 * R; if (!near || gap < near.gap) near = { at: [r1(o.b.x), r1(o.b.y)], gap: r2(gap), ipp: r2(o.ipp), i };
      if ((o.b.x - ax) * (cx - ax) + (o.b.y - ay) * (cy - ay) <= 0) continue;
      if (gap < 1.0 + 6 * o.ipp && d < bd) { bd = d; best = o.b; sure = gap < 0.4 + 2.5 * o.ipp; }
    }
    if (!best) continue; const bend = bendAt(Math.max(1, i - 1));
    if (sure || bend.deg >= 8 || bend.slow < 0.6 || i >= path.length - 2) tf = { b: best, i: i - 1, d: bd, bend, sure };
  }
  const bend = tf ? tf.bend : null;
  // sound: the strike just before the cue ball was first seen moving; the contact while the cue ball was beside a ball
  const t0 = pts[0], tEnd = pts[pts.length - 1], at = t => { let j = 1; while (j < pts.length && pts[j] < t) j++;
    if (j >= pts.length) { // past the last sighting (the cue ball went behind the player): carry on in a straight line, for half a second at most
      const n = tk.length, k = Math.max(0, n - 4), dtp = (pts[n - 1] - pts[k]) || 1, ex = Math.min(500, t - pts[n - 1]);
      return { x: clamp(tk[n - 1][1] + (tk[n - 1][1] - tk[k][1]) / dtp * ex, 0, S.P.L), y: clamp(tk[n - 1][2] + (tk[n - 1][2] - tk[k][2]) / dtp * ex, 0, S.P.W) };
    } const u = clamp((t - pts[j - 1]) / Math.max(1, pts[j] - pts[j - 1]), 0, 1); return { x: tk[j - 1][1] + (tk[j][1] - tk[j - 1][1]) * u, y: tk[j - 1][2] + (tk[j][2] - tk[j - 1][2]) * u }; };
  let strike = null, contact = null, mf = null; const cl = MIC.on && t0 ? micClicks(t0 - 700, tEnd + 600, true) : [];
  // the camera's times can run late (when a frame is shown rather than taken): the strike says by how much
  // (the cue ball needs a few hundredths of a second after the strike to be seen leaving its spot, hence the 40 ms)
  const cap = !!VF.cap; for (const c of cl) if (!c.weak && c.t >= t0 - (cap ? 250 : 450) && c.t <= t0 + (cap ? 60 : 150) && (!strike || c.r > strike.r)) strike = c;
  const lag = strike ? clamp(t0 - strike.t - 40, 0, cap ? 120 : 250) : cap ? 0 : 60;
  for (const c of cl) {
    if (c.t <= (strike ? strike.t : t0 - lag) + 25 || c.t + lag > tEnd + (rec.lost > 7 ? 500 : 0)) continue;
    const p = at(c.t + lag); let best = null, bd = 1e9; for (const b of balls) { const d = Math.hypot(b.x - p.x, b.y - p.y); if (d < 2 * R + 2 && d < bd) { bd = d; best = b; } }
    if (best) { contact = c; mf = { b: best, d: bd }; break; }
  }
  // no ball where the cue ball turned: the camera never saw the ball it hit. Where the path bends sharply out in the open
  // (not at a cushion), the ball it hit sat one ball-width away, along the direction the cue ball's speed changed.
  let hidden = null;
  if (!tf && !mf) for (let i = 4; i < tk.length - 3 && !hidden; i++) {
    const p = tk[i - 1]; if (Math.min(p[1], S.P.L - p[1], p[2], S.P.W - p[2]) < 3) continue;
    const b = bendAt(i), dtIn = Math.max(1e-3, tk[i - 1][0] - tk[i - 4][0]), dtOut = Math.max(1e-3, tk[i + 2][0] - tk[i][0]);
    const vin = [(tk[i - 1][1] - tk[i - 4][1]) / dtIn, (tk[i - 1][2] - tk[i - 4][2]) / dtIn], vout = [(tk[i + 2][1] - tk[i][1]) / dtOut, (tk[i + 2][2] - tk[i][2]) / dtOut];
    if (Math.hypot(vin[0], vin[1]) < 10 || !(b.deg >= 15 || b.slow < 0.5)) continue;
    const ux = vin[0] - vout[0], uy = vin[1] - vout[1], ul = Math.hypot(ux, uy); if (ul < 1e-6) continue;
    const at2 = [p[1] + 2 * R * ux / ul, p[2] + 2 * R * uy / ul];
    if (at2[0] < R || at2[1] < R || at2[0] > S.P.L - R || at2[1] > S.P.W - R) continue;
    hidden = { at: [r1(at2[0]), r1(at2[1])], deg: b.deg, slow: b.slow, pt: i, see: hiddenSee(rec.frBef, at2) };
  }
  const obj = tf ? tf.b : mf ? mf.b : null;
  return { hidden, obj: obj && { id: obj.id, x: obj.x, y: obj.y, feat: obj.feat, conf: obj.conf }, via: tf ? 'track' : mf ? 'mic' : null, bend,
    agree: tf && mf ? tf.b === mf.b : null, mic: MIC.on ? { clicks: cl.length, strike: strike ? Math.round(strike.t - t0) : null, contact: contact ? Math.round(contact.t - t0) : null, lag: Math.round(lag), cap, ball: mf ? [r1(mf.b.x), r1(mf.b.y)] : null } : null,
    track: tf ? { at: [r1(tf.b.x), r1(tf.b.y)], gap: r2(tf.d - 2 * R), sure: tf.sure, frozen: tf.frozen || undefined, pt: tf.i } : null, near, pts: tk.length };
}

// how much of the spot in the before picture looks unlike the cloth (0 = plain cloth, 1 = something there)
function hiddenSee(f, at) {
  try {
    if (!f || !S.felt || !S.cam || !S.vr) return null;
    const q = S.cam.proj(at[0], at[1], S.P.R), sx = S.vr.w / S.W, sy = S.vr.h / S.H, r = S.cam.ballRad(at[0], at[1], S.P.R, S.P.R) * sx * f.scale * 0.8;
    const cx = (S.vr.x + q[0] * sx - f.crop[0]) * f.scale, cy = (S.vr.y + q[1] * sy - f.crop[1]) * f.scale, x0 = Math.max(0, Math.floor(cx - r)), y0 = Math.max(0, Math.floor(cy - r));
    const w = Math.min(f.c.width - x0, Math.ceil(2 * r) + 1), h = Math.min(f.c.height - y0, Math.ceil(2 * r) + 1); if (w < 2 || h < 2) return null;
    const d = f.c.getContext('2d').getImageData(x0, y0, w, h).data; let n = 0, on = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { if ((x0 + x - cx) ** 2 + (y0 + y - cy) ** 2 > r * r) continue; const o = (y * w + x) * 4; n++; if (Math.abs(d[o] - S.felt[0]) + Math.abs(d[o + 1] - S.felt[1]) + Math.abs(d[o + 2] - S.felt[2]) > 70) on++; }
    return n ? r2(on / n) : null;
  } catch (e) { return null; }
}

// ---------- what really happened, from the way the player plays ----------
// The player always shoots the lowest ball on the table, so the first ball the cue ball hits IS the target, whatever the
// camera calls it. Which number is the target comes from how many object balls are really left, counted only in clean looks
// (table settled, nobody anywhere near it) just before each shot, as the middle value of the last several looks, so a ball
// that blinks out of sight, or a hand read as a ball, does not change it. A shot's drop is the clean count before it minus
// the clean count before the next one: a ball that only went out of sight comes back and is not counted as down.
// New rack: the clean count goes from 3 or fewer (or a finished rack) to 8 or more.
// V2.3.2: the ball to shoot is the lowest number on the table, from the names (balls made are gone for good, until the next
// rack). Unsure when the names and the clean count of balls disagree (a ball without a name, a ghost with one).
function lowestUp(list) { const g = new Set(S.gone || []), up = (list || []).filter(b => b.id != null && b.id >= 1 && b.id <= 9 && !b.miss && !g.has(b.id)).map(b => b.id); return { lo: up.length ? Math.min(...up) : null, n: new Set(up).size }; }
function truthLook(found) {
  const T = S.truth; if (!T || found.some(b => b.hid || b.miss)) return;
  // nobody near the table; if that never happens for 20 s (something the camera keeps calling a person), a nearly clear view will do
  const now = performance.now(); if (S.occN && !(now - (T.cleanT || now) > 20000 && S.occFrac <= 0.005)) return; T.cleanT = now;
  const n = found.filter(b => b.id !== 0).length;
  T.looks.push(n); if (T.looks.length > 9) T.looks.shift();
  if (T.looks.length < 5) return;
  const last = T.looks.slice(T.looks.length >= 7 ? -7 : -5), nArm = Math.round(median(last)); T.nArm = nArm; T.steady = Math.max(...last) - Math.min(...last) <= 1;
  if (!T.seen) { T.seen = true; T.target = nArm >= 8 ? 1 : Math.max(1, 10 - nArm); T.minArm = nArm; T.why = nArm >= 8 ? 'rack' : 'count'; dbg('truth', { start: true, target: T.target, n: nArm }); return; }
  if (T.pend) { // the shot before: how many really went down
    const p = T.pend, d = p.nBefore != null && nArm <= p.nBefore ? p.nBefore - nArm : p.drop; T.pend = null; // more balls than before: re-racked or put back, so the shot's own reading stands
    if (p.target != null) { T.target = d >= 1 ? p.target + 1 : p.target; if (d >= 2) T.uncertain = true; if (T.target > 9) T.target = null; }
    const sh = S.sess && S.sess.shots[p.idx]; if (sh) { sh.drop = d; sh.confirmed = true; }
    dbg('truth_confirm', { shot: p.idx + 1, before: p.nBefore, now: nArm, down: d, target: T.target, unsure: T.uncertain || undefined });
  }
  if (nArm >= 8 && (T.target == null || T.minArm <= 3)) { T.rack++; T.target = 1; T.uncertain = false; T.minArm = nArm; S.gone = []; dbg('truth_rack', { rack: T.rack, n: nArm }); toast('New rack. Watching for the 1.'); return; }
  T.minArm = Math.min(T.minArm, nArm);
  { const u = lowestUp(found); if (u.lo != null && u.n === nArm) { if (u.lo !== T.target) dbg('target', { was: T.target, now: u.lo, named: u.n, count: nArm }); T.target = u.lo; T.uncertain = false; } else if (u.lo != null) T.uncertain = true; else if (nArm === 0) T.target = null; }
}
// a shot is starting: remember what was known just before it, and start counting fresh for after it
function truthShotStart() {
  const T = S.truth; if (!T) return null;
  if (T.pend) { // no clean look since the last shot: fall back on what that shot's own result said
    const p = T.pend; T.pend = null;
    if (p.target != null && p.drop >= 1) { T.target = p.target + 1; if (p.drop >= 2) T.uncertain = true; if (T.target > 9) T.target = null; }
    dbg('truth_confirm', { shot: p.idx + 1, fallback: true, down: p.drop, target: T.target });
  }
  { const u = lowestUp(S.balls); if (T.seen && u.lo != null && u.n === T.nArm) T.target = u.lo; }
  const info = { target: T.seen ? T.target : null, nBefore: T.looks.length >= 5 ? T.nArm : null, uncertain: !!T.uncertain, steady: !!T.steady && T.looks.length >= 5, snap: { target: T.target, uncertain: T.uncertain, rack: T.rack, minArm: T.minArm } };
  T.looks = []; return info;
}
function watchStatus(found, settled) {
  const T = S.truth || {}, n = S.sess ? S.sess.shots.filter(x => !x.thrown).length : 0;
  if (S.pend) return 'Shot recorded. Reading the result as the table comes into view…';
  if (frozen()) return 'Holding still while the phone settles…';
  const next = !T.seen ? ' · counting the balls' : T.pend ? ' · checking the last shot' : T.target ? ' · next: the ' + T.target : ' · rack done, put them back';
  const where = 'Rack ' + (T.rack || 1) + next + (T.uncertain ? ' (unsure)' : '') + ' · ' + n + ' shot' + (n === 1 ? '' : 's');
  return (settled ? 'Watching. ' : 'Waiting for the balls to settle. ') + where;
}
const LEARNED = new Map(); // shot index -> the looks learned from it (so a thrown-out shot can take them back)
function addPlaySample(feat, id) {
  if (!feat || !S.cloth) return null;
  const smp = { id, f: feat, cl: S.cloth.v, t: Date.now(), play: 1 }; S.samples.push(smp);
  const mine = S.samples.filter(x => x.id === id && x.play); if (mine.length > 15) S.samples.splice(S.samples.indexOf(mine[0]), 1);
  setTimeout(save, 0); return smp;
}
function watchResult(p, now, r) {
  const shot = p.shot || {}, t0 = performance.now(), T = S.truth || {};
  // made balls are out of play at once (so nothing takes their numbers meanwhile); never the 9 (a foul brings it back,
  // a legal 9 ends the rack), nothing from a result that looked wrong
  if (!shot.drill && !r.doubt) for (const i of r.gone) if (i >= 1 && i <= 8 && !S.gone.includes(i)) S.gone.push(i);
  if (!shot.drill && r.gone.includes(9) && !r.gone.includes(0) && S.truth) { S.truth.target = null; S.truth.minArm = 0; } // 9 down: rack over
  const tr = shot.truth || truthShotStart() || {}; S.watchWait = true;
  const wait = () => {
    if (!S.live) { S.watchWait = false; return; } if (!shot.meas && !shot.failed && !shot.unseen && performance.now() - t0 < 3500) { setTimeout(wait, 150); return; }
    S.watchWait = false;
    const res = shot.meas && shot.meas.fit && shot.meas.fit.res, w = shot.watch || {};
    // the first ball hit: from the picture, else the sound, else the reconstructed shot
    let obj = w.obj, via = w.via;
    if (!obj && res && res.firstHit != null && res.firstHit !== 0) { const b = p.before.find(o => o.id === res.firstHit); if (b) { obj = { id: b.id, x: b.x, y: b.y, feat: b.feat, conf: b.conf }; via = 'fit'; } }
    if (!obj && w.hidden) { obj = { id: null, x: w.hidden.at[0], y: w.hidden.at[1], inferred: true }; via = 'path'; } // a ball the camera never saw
    const scratch = r.gone.includes(0), objDrop = Math.max(0, r.dropN - (scratch ? 1 : 0)), target = tr.target != null ? tr.target : null;
    if (shot.drill) { drillResult(shot, r, objDrop, scratch, S.sess ? S.sess.shots.length : 0, now); return; }
    const vis = obj ? obj.id : null, agree = target && obj && !obj.inferred ? vis === target : null;
    // learn only when sure: the rack is not in doubt, the count before the shot was steady, and the hit was clearly seen
    const sureHit = (via === 'track' && w.track && (w.track.sure || (w.bend && (w.bend.deg >= 8 || w.bend.slow < 0.6)))) || (via === 'mic' && w.mic && w.mic.strike != null);
    const idx = S.sess ? S.sess.shots.length : 0, learned = [];
    // V2.2: nothing is learned from play (the count-based target drifted when the navy 2 could not be seen and taught wrong
    // looks). Later: only when the order rule and the camera's own top match agree. `sureHit` is still written down.
    if (learned.length) LEARNED.set(idx, learned);
    dbg('truth', { shot: idx + 1, target, via, sure: !!sureHit, vis: vis == null ? '?' : vis, agree, learned: learned.length > 0, steady: !!tr.steady, before: tr.nBefore, obj: obj ? [r1(obj.x), r1(obj.y)] : null, drop: objDrop, scratch, mic: w.mic || null, bend: w.bend || null, track: w.track || null, hidden: w.hidden || null, near: w.near || null, pts: w.pts, fit: res && res.firstHit != null ? res.firstHit : null, doubt: r.doubt || undefined });
    // what went down is settled at the next clean look before the next shot (see truthLook)
    if (S.truth) S.truth.pend = { idx, nBefore: tr.nBefore, target, drop: objDrop };
    const made = r.gone.filter(i => i >= 1); for (let k = 0; k < r.unsure; k++) made.push('?');
    const m = shot.meas;
    if (S.sess) S.sess.shots.push({ t: Date.now(), made, drop: objDrop, scratch, partial: !r.clear || undefined, unseen: shot.unseen || undefined, doubt: r.doubt || undefined, mph: m ? +(m.v0 / MPH).toFixed(1) : null, first: vis, target, via, agree, learned: learned.length > 0 || undefined, truthUnsure: tr.uncertain || undefined, snap: tr.snap, low: null });
    frameSaveShot(idx + 1, { target, via, vis, agree, objAt: obj ? [r1(obj.x), r1(obj.y)] : null, inferred: obj && obj.inferred || undefined, hidden: w.hidden || undefined, drop: objDrop, scratch, mic: w.mic || null, unseen: !!shot.unseen, doubt: !!r.doubt, settleTimeout: !!shot.settleTimeout, truthUnsure: !!tr.uncertain, steady: !!tr.steady }, shot);
    holdStatus('Shot ' + (idx + 1) + ' saved.', 2500); updUndo();
    dong();
  }; wait();
}
// "Throw out last shot": the shot leaves the stats, what it taught is taken back, the next ball goes back to what it was,
// and its pictures stay but are marked not to be trusted
function throwOutLast() {
  const se = S.sess; if (!se || !se.shots.length || S.recording || S.settling || S.awaitAfter || S.pend || S.watchWait) return;
  const idx = se.shots.length - 1, sh = se.shots[idx]; if (sh.thrown) return;
  sh.thrown = true;
  if (S.watch && !sh.drill && sh.made && S.gone) S.gone = S.gone.filter(i => !sh.made.includes(i)); // what it called made is back in play
  const L = LEARNED.get(idx) || []; for (const m of L) { const k = S.samples.indexOf(m); if (k >= 0) S.samples.splice(k, 1); }
  if (L.removed && L.removed.length) { S.samples.push(...L.removed); if (S.dr && S.dr.fresh && L.removed.fresh != null) delete S.dr.fresh[L.removed.fresh]; } // looks the shot had replaced come back
  LEARNED.delete(idx); save();
  if (sh.drill) drillThrowOut(sh);
  const T = S.truth; if (T && sh.snap) { T.target = sh.snap.target; T.uncertain = sh.snap.uncertain; T.rack = sh.snap.rack; T.minArm = sh.snap.minArm; if (T.pend && T.pend.idx === idx) T.pend = null; T.looks = []; }
  const lab = FR.labels.find(x => x.shot === idx + 1); if (lab) { lab.thrown = true; labelsSave().catch(() => { }); }
  dbg('thrown', { shot: idx + 1, unlearned: L.length, target: T ? T.target : null });
  toast('Shot ' + (idx + 1) + ' thrown out.'); updUndo();
}
function updUndo() {
  const b = $('#undoBtn'); if (!b) return; const se = S.sess, last = se && se.shots[se.shots.length - 1];
  b.hidden = !(S.watch && S.phase === 'run' && !$('#cam').hidden && last);
  b.disabled = !last || !!last.thrown || !!(S.recording || S.settling || S.awaitAfter || S.pend || S.watchWait); // not while the next shot is still being read
  const f = $('#flagBtn'); if (f) { f.hidden = b.hidden; f.disabled = !last || !!last.flag || !!(S.recording || S.settling || S.awaitAfter || S.pend || S.watchWait); f.textContent = last && last.flag ? '⚑ Marked' : '⚑ This shot was wrong'; }
}

// ---------- Learn the balls: a guided drill ----------
// Balls 1 to 9, three made shots each. For every shot the app shows where to put the ball (a ring the size of a hand) and
// where to put the cue ball, a few feet behind it, lined up nearly straight at a pocket. Only those two balls are on the
// table, so the number of the ball on the ring is certain: every shot teaches the app how that ball looks there, and its
// pictures are saved with that number. The shots point at pockets on the camera's side, so the player stands on the far
// side or at an end and is never between the phone and the balls. A miss: put them back and shoot it again.
const DRILL = { N: 3, ZO: 3, ZC: 4, ACC: 1.5 }; // shots per ball; ring sizes in inches (object, cue); a ball counts as on its ring within 1.5x
function drillNew() { return { ball: 1, k: 0, slot: 0, spot: null, plan: null, again: false, stats: {}, done: false, objIn: false, cueIn: false, cueInT: 0 }; }
// every easy, nearly straight shot on this table that keeps the shooter out of the camera's view of the balls and the pocket
function drillCands() {
  const P = S.P, L = P.L, W = P.W, cam = S.cam, C = cam && cam.ok !== false && cam.C && isFinite(cam.C[0]) ? [cam.C[0], cam.C[1]] : [L / 2, -70];
  const inT = (p, m) => p[0] > m && p[0] < L - m && p[1] > m && p[1] < W - m;
  const rot = (u, a) => { const c = Math.cos(a * D2R), s = Math.sin(a * D2R); return [u[0] * c - u[1] * s, u[0] * s + u[1] * c]; };
  // is something standing at sp in the camera's line of sight to q (seen from above)? Not if it is behind q.
  const blocks = (sp, q, clr) => { const vx = q[0] - C[0], vy = q[1] - C[1], t = ((sp[0] - C[0]) * vx + (sp[1] - C[1]) * vy) / (vx * vx + vy * vy); if (t >= 1) return false; const tt = Math.max(0, t); return Math.hypot(C[0] + vx * tt - sp[0], C[1] + vy * tt - sp[1]) < clr; };
  const out = [], cl = Math.hypot(C[0] - L / 2, C[1] - W / 2) || 1, nx = (C[0] - L / 2) / cl, ny = (C[1] - W / 2) / cl, ext = Math.abs(nx) * L / 2 + Math.abs(ny) * W / 2;
  P.pockets.forEach((pk, pi) => {
    const b0 = pk.corner ? [pk.x === 0 ? 1 : -1, pk.y === 0 ? 1 : -1].map(v => v / Math.SQRT2) : [0, pk.y === 0 ? 1 : -1];
    const span = pk.corner ? 36 : 18;
    for (let a = -span; a <= span; a += 6) {
      const u = rot(b0, a);
      for (const dO of [9, 12, 15, 19, 24, 30]) {
        const obj = [pk.x + u[0] * dO, pk.y + u[1] * dO]; if (!inT(obj, 4.5)) continue;
        for (const cut of [0, 5, -5]) {
          const v = rot(u, cut);
          for (const dc of [30, 36, 26, 42]) {
            const cue = [obj[0] + v[0] * dc, obj[1] + v[1] * dc]; if (!inT(cue, 5)) continue;
            // the player: shoulders leaning in over the cue ball, body behind it just off the table
            let t = 0; while (t < 200 && inT([cue[0] + v[0] * t, cue[1] + v[1] * t], 0)) t += 2;
            const body = [cue[0] + v[0] * (t + 8), cue[1] + v[1] * (t + 8)], lean = [cue[0] + v[0] * Math.min(t, 20), cue[1] + v[1] * Math.min(t, 20)];
            const see = [obj, cue, [pk.x, pk.y]];
            if (see.some(q => blocks(body, q, 20) || blocks(lean, q, 12))) continue;
            if ((body[0] - L / 2) * nx + (body[1] - W / 2) * ny > 0.5 * ext) continue; // on the camera's side of the table: shoot toward the camera, not away
            const reg = Math.min(2, Math.floor(obj[0] / (L / 3))) + 3 * (obj[1] < W / 2 ? 0 : 1);
            out.push({ pi, obj, cue, dO, cut, reg, ease: Math.abs(dO - 14) * 0.4 + Math.abs(a) * 0.1 + Math.abs(cut) * 0.6 + Math.abs(dc - 32) * 0.1 });
            break; // one cue distance is enough for this line
          }
        }
      }
    }
  });
  return out;
}
// 27 spots: each ball on three different parts of the table (near and far half mixed), the parts taken in turn so all of
// them get every ball
function drillPlan() {
  const cs = drillCands(), all = [...new Set(cs.map(c => c.reg))].sort((a, b) => a - b), plan = [];
  if (!cs.length) return [];
  const nr = all.filter(r => r < 3), fr = all.filter(r => r >= 3), regs = [];
  for (let i = 0; i < Math.max(nr.length, fr.length); i++) { if (i < nr.length) regs.push(nr[i]); if (i < fr.length) regs.push(fr[(i + 1) % fr.length]); }
  let lastPi = -1;
  for (let b = 0; b < 9; b++) for (let k = 0; k < DRILL.N; k++) {
    const reg = regs[(b * DRILL.N + k + (b >> 1)) % regs.length];
    const pool = cs.filter(c => c.reg === reg).sort((x, y) => x.ease - y.ease), top = pool.slice(0, Math.min(pool.length, 6));
    // vary the pocket from shot to shot, and the spot from ball to ball
    let pick = top.filter(c => c.pi !== lastPi); if (!pick.length) pick = top;
    const c = pick[(b + k) % pick.length]; lastPi = c.pi;
    plan.push({ obj: c.obj.map(r1), cue: c.cue.map(r1), pi: c.pi, reg });
  }
  dbg('drill_plan', { n: cs.length, regs, C: S.cam && S.cam.C ? S.cam.C.map(r1) : null });
  return plan;
}
// V2.3.2: no rings. Only the cue ball and the called ball are on the table, put down anywhere; the player shoots it into
// any pocket (the ball's path says which). For different light on the ball, the app asks now and then for the other half.
function drillSetSpot() { const d = S.dr; if (!d) return; d.spot = null; d.objAt = null; d.both = null; d.gone = null; d.want = d.quick ? null : d.k === 1 ? 'far' : d.k === 2 ? 'near' : null; d.objIn = d.cueIn = false; d.cueInT = 0; }
// the half of the table nearer the camera, and the other one
const nearLow = () => !(S.cam && S.cam.C && isFinite(S.cam.C[1])) || S.cam.C[1] < S.P.W / 2;
const inHalf = (b, h) => (h === 'near') === (nearLow() ? b.y < S.P.W / 2 : b.y > S.P.W / 2);
// the pocket as the player sees it on the screen
function pocketWord(pi) {
  const pk = S.P.pockets[pi]; if (!S.cam || !pk) return 'pocket';
  const q = S.cam.proj(pk.x, pk.y, 0), mid = S.cam.proj(S.P.L / 2, S.P.W / 2, 0);
  const lr = q[0] < mid[0] - 2 ? 'left' : q[0] > mid[0] + 2 ? 'right' : '', fn = q[1] < mid[1] ? 'far' : 'near';
  return pk.corner ? fn + ' ' + lr + ' corner' : (lr && Math.abs(q[1] - mid[1]) < Math.abs(q[0] - mid[0]) ? lr : fn) + ' side pocket';
}
// on every look: the whitest ball is the cue ball, the ball that best fits the called number is the drill ball; anything
// else is a hand, the cue or a shadow and gets no number
function drillLabel(found) {
  const d = S.dr; if (!d || d.done) return;
  if (d.quick) { const c = d.candAt; let best = null, bd = 1.5; if (c) for (const f of found) { if (f.hid || f.miss) continue; const e = Math.hypot(f.x - c[0], f.y - c[1]); if (e < bd) { bd = e; best = f; } }
    for (const f of found) { if (f === best) { f.id = d.ball; f.locked = true; f.conf = 1; } else if (f.id === d.ball || f.id != null) { f.id = null; f.locked = false; f.conf = 0; } } return; }
  const vis = found.filter(f => !f.hid && !f.miss && !f.notBall);
  const white = f => Math.max(f.rec ? f.rec[0] : 0, f.feat ? f.feat.wf : 0);
  let cb = null; for (const f of vis) if (white(f) > 0.5 && (!cb || white(f) > white(cb))) cb = f;
  if (!cb) cb = vis.find(f => f.id === 0) || null; // the colour naming's own cue ball
  const fit = f => { const c = idCost(f, [d.ball], allSamples(), S.cloth, recPen())[d.ball]; return (c === undefined ? 3 : c) - ((f.obs || []).length >= 3 ? 0.3 : 0) + (d.objAt && Math.hypot(f.x - d.objAt[0], f.y - d.objAt[1]) < 2 ? -0.5 : 0); };
  let ob = null, bc = 2.6; for (const f of vis) { if (f === cb) continue; const c = fit(f); if (c < bc) { bc = c; ob = f; } }
  { const others = vis.filter(f => f !== cb); if (!ob && others.length === 1) ob = others[0]; } // only one other ball: it is the drill ball, however it looks
  for (const f of found) { if (f.hid || f.miss) continue; if (f === ob) { f.id = d.ball; f.locked = true; f.conf = 1; } else if (f === cb) { f.id = 0; f.locked = true; f.conf = 1; } else if (f.id != null) { f.id = null; f.locked = false; f.conf = 0; } }
  if (ob) d.objAt = [ob.x, ob.y];
}
function drillZones(found) {
  const d = S.dr; if (!d) return; const vis = found.filter(b => !b.miss && !b.hid);
  d.objIn = vis.some(b => b.id === d.ball); const was = d.cueIn; d.cueIn = vis.some(b => b.id === 0);
  if (d.cueIn && !was) d.cueInT = performance.now();
}
function drillHead() { const d = S.dr; return 'The ' + d.ball + ' ball · shot ' + (d.k + 1) + ' of ' + DRILL.N; }
function drillStatus(found, settled) {
  const d = S.dr; if (!d) return '';
  if (d.done) return 'All nine balls done. Tap End for the pictures, or Menu.';
  if (S.pend) return 'Reading the result as the table comes into view…';
  if (frozen()) return 'Holding still while the phone settles…';
  drillZones(found);
  const head = drillHead() + (d.again ? ' · again' : ''), where = d.want ? ' (the ' + d.want + ' half this time)' : '';
  if (d.objIn && d.cueIn) return head + (settled ? ' · shoot the ' + d.ball + ' into any pocket, then step back' : ' · hold still…');
  return head + ' · put the ' + d.ball + ' and the cue ball on the table' + where;
}
// the shot is starting: which ball was the drill ball just before it
function drillShotStart(rec) {
  const d = S.dr; if (!d || d.done) return null;
  const all = (rec.before || []).concat(rec.un || []);
  let ob = all.find(b => b.id === d.ball) || null;
  if (!ob && d.objAt) { let bd = 2; for (const b of all) { if (b.id === 0) continue; const e = Math.hypot(b.x - d.objAt[0], b.y - d.objAt[1]); if (e < bd) { bd = e; ob = b; } } }
  const cb = all.find(b => b.id === 0);
  // the recognizer's own guess for the drill ball, made without being told (a score per ball for the summary)
  const guess = ob && ob.rec ? recogTop(ob.rec) : null;
  return { ball: d.ball, k: d.k, slot: d.slot, spot: null, seen: !!ob, objFeat: ob ? ob.feat : null, objAt: ob ? [r1(ob.x), r1(ob.y)] : null, cueFeat: cb ? cb.feat : null, cueIn: !!cb, guess, half: ob ? (inHalf(ob, 'near') ? 'near' : 'far') : null };
}
// A make the camera did not see as a shot (the shot started before the app was ready, or the cue ball was lost at once):
// the drill ball vanished from the table in clear view (nobody near it), stays gone, and the cue ball has moved. Counted
// as made; Throw out if that was wrong.
function drillUnseen(found) {
  const d = S.dr; if (!d || d.done || d.quick || TR.rec || S.recording || S.awaitAfter || S.pend || S.watchWait) { if (d) d.gone = null; return; }
  const vis = found.filter(b => !b.miss && !b.hid), ob = vis.find(b => b.id === d.ball), cb = vis.find(b => b.id === 0), n = S.sess ? S.sess.shots.length : 0;
  if (ob && cb) { if (S.stable >= 2 && S.occFrac <= 0.02) d.both = { obj: [ob.x, ob.y], cue: [cb.x, cb.y], n }; d.gone = null; return; }
  const bt = d.both; if (!bt || bt.n !== n || ob) { d.gone = null; return; }
  // (the player is usually still at the table right after a shot; a hand picking the ball up is ON its spot when it goes)
  if (!d.gone) { d.gone = { clear: !hiddenAt({ x: bt.obj[0], y: bt.obj[1] }), k: 0 }; return; }
  if (!d.gone.clear || !cb || Math.hypot(cb.x - bt.cue[0], cb.y - bt.cue[1]) < 4 || hiddenAt({ x: bt.obj[0], y: bt.obj[1] }) || found.some(b => !b.miss && Math.hypot(b.x - bt.obj[0], b.y - bt.obj[1]) < 1.5)) return;
  if (++d.gone.k < 3) return;
  d.both = null; d.gone = null; dbg('drill_unseen', { ball: d.ball, at: bt.obj.map(r1), cueFrom: bt.cue.map(r1), cueTo: [r1(cb.x), r1(cb.y)] });
  const shot = { unseen: true, failed: true, drill: { ball: d.ball, k: d.k, slot: d.slot, spot: null, seen: true, objFeat: null, objAt: bt.obj.map(r1), cueFeat: null, cueIn: true, guess: null, unseen: true } };
  drillResult(shot, { gone: [d.ball], clear: true, dropN: 1, unsure: 0 }, 1, false, n, found);
}
// a look the player confirmed by naming a ball by hand; at most 16 learned looks a ball (the oldest go)
function addLook(feat, id, kind) {
  if (!feat || !S.cloth || id == null) return null;
  const smp = { id, f: feat, cl: S.cloth.v, t: Date.now(), walk: 1 }; smp[kind || 'tap'] = 1; S.samples.push(smp);
  const mine = S.samples.filter(x => x.id === id && x.walk && !x.prior); if (mine.length > 16) S.samples.splice(S.samples.indexOf(mine[0]), 1);
  dbg('learn', { id, kind: kind || 'tap', prof: S.prof }); setTimeout(save, 0); return smp;
}
function addDrillSample(feat, id, rm) {
  if (!feat || !S.cloth) return null;
  if (S.dr && !S.dr.fresh) S.dr.fresh = {};
  if (S.dr && !S.dr.fresh[id]) { // the old walk-around looks of this ball give way to the drill's
    S.dr.fresh[id] = 1; const old = S.samples.filter(x => x.id === id && x.walk && !x.drill);
    if (old.length) { S.samples = S.samples.filter(x => !old.includes(x)); rm.push(...old); rm.fresh = id; }
  }
  const smp = { id, f: feat, cl: S.cloth.v, t: Date.now(), walk: 1, drill: 1 }; S.samples.push(smp);
  const mine = S.samples.filter(x => x.id === id && x.drill); if (mine.length > 12) { rm.push(mine[0]); S.samples.splice(S.samples.indexOf(mine[0]), 1); }
  return smp;
}
function drillResult(shot, r, objDrop, scratch, idx, now) {
  const sd = shot.drill, d = S.dr, learned = [], snap = JSON.parse(JSON.stringify({ ball: d.ball, k: d.k, slot: d.slot, again: d.again, stats: d.stats, done: d.done }));
  // Only the cue ball and the called ball are on the table: it is made when that ball is gone (not by counting balls: a
  // sleeve or a hand read as balls inflated the count). A ball the camera could not see on its ring is taken as made
  // (Throw out if it was not).
  const left = (now || []).filter(b => !b.hid && !b.miss && b.id !== 0 && !(b.rec && b.rec[RECOG_NB] > 0.5));
  // still there = seen with its number, or hidden behind the player (a hidden ball is not taken as made)
  const there = (now || []).some(b => b.id === sd.ball && !b.miss);
  // V2.3.2: or its path ended in a pocket (which pocket goes in the message)
  // (a ball not picked out before the shot: made if a ball went down)
  const pk = shot.pathPkAt && shot.pathPkAt[sd.ball], made = sd.seen ? !there && (pk != null || r.gone.includes(sd.ball) || (r.clear && !left.length)) : objDrop >= 1;
  learned.removed = [];
  if (sd.seen && sd.objFeat) { const m = addDrillSample(sd.objFeat, sd.ball, learned.removed); if (m) learned.push(m); }
  if (sd.cueFeat && sd.cueIn && S.samples.filter(x => x.id === 0 && x.drill).length < 12) { const m = addDrillSample(sd.cueFeat, 0, learned.removed); if (m) learned.push(m); }
  if (learned.length || learned.removed.length) { LEARNED.set(idx, learned); setTimeout(save, 0); }
  const st = d.stats[sd.ball] || (d.stats[sd.ball] = { made: 0, miss: 0, seen: 0, blind: 0, gN: 0, gOk: 0 });
  st[sd.seen ? 'seen' : 'blind']++; st[made ? 'made' : 'miss']++; if (sd.guess != null) { st.gN = (st.gN || 0) + 1; if (sd.guess === sd.ball) st.gOk = (st.gOk || 0) + 1; }
  let msg;
  if (made) {
    d.k++; d.again = false; d.slot++;
    if (d.k >= DRILL.N) { d.k = 0; d.ball++; if (d.ball > 9) d.done = true; }
    const inPk = pk != null ? ' (' + pocketWord(pk) + ')' : sd.unseen ? ' (the shot was not seen: Throw out if you missed)' : '';
    msg = d.done ? 'Made it' + inPk + '. All nine balls done!' : d.k === 0 ? 'Made it' + inPk + '. Now the ' + d.ball + ' ball.' : 'Made it' + inPk + '. Set up the next one.';
    if (!d.done) drillSetSpot();
  } else { d.again = true; msg = 'Missed. Set it up again and shoot.'; }
  dbg('drill', { shot: idx + 1, ball: sd.ball, of3: sd.k + 1, made, seen: sd.seen, guess: sd.guess, left: left.length, blind: !sd.seen || undefined, drop: objDrop, scratch, cueIn: sd.cueIn, learned: learned.length, objAt: sd.objAt, pk: pk != null ? pk : undefined, half: sd.half || undefined, unseen: sd.unseen || undefined });
  if (S.sess) S.sess.shots.push({ t: Date.now(), made: made && sd.seen ? [sd.ball] : [], drop: objDrop, scratch, drill: 1, ball: sd.ball, dmade: made, blind: !sd.seen || undefined, first: sd.ball, target: sd.ball, agree: null, learned: learned.length > 0 || undefined, drSnap: snap, low: null });
  frameSaveShot(idx + 1, { drill: 1, ball: sd.ball, target: sd.ball, made, seen: sd.seen, guess: sd.guess, objAt: sd.objAt, pocket: pk != null ? pk : undefined, unseen: sd.unseen || undefined, cueIn: sd.cueIn, drop: objDrop, scratch, settleTimeout: !!shot.settleTimeout }, shot);
  holdStatus(msg, 3500); updUndo(); dong();
  if (d.done) setTimeout(drillSummary, 1200);
}
// ---------- Show me the balls (V2.3; no rings since V2.3.2): a 2-minute setup for a table's ball set, no shooting ----------
// Each ball (cue ball, then 1 to 9) is put down anywhere on the near half, away from the cushions, then moved to the far
// half. Once it has sat still with nobody over the table, its look is learned for this table (Home or Away) and its
// picture saved. Balls left lying where they were shown are ignored (only a ball new to its spot counts).
function quickNew() { const seq = []; for (const id of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]) { seq.push([id, 0]); seq.push([id, 1]); } return { quick: true, seq, qi: 0, holdN: 0, gN: 0, gOk: 0, got: [], done: false, parked: [], objIn: false, many: false, stats: {}, ball: 0, k: 0 }; }
function quickSetSpot() { const d = S.dr; if (!d || !d.quick) return; const st = d.seq[d.qi]; d.spot = null; d.ball = st ? st[0] : 0; d.half = st ? (st[1] ? 'far' : 'near') : null; d.candAt = null; }
const qName = id => id === 0 ? 'cue ball' : 'the ' + id;
function quickStatus() {
  const d = S.dr; if (!d) return ''; if (d.done) return 'All the balls learned for this table.';
  const st = d.seq[d.qi]; if (!st) return ''; if (frozen()) return 'Holding still while the phone settles…';
  const nm = st[0] === 0 ? 'the cue ball' : 'the ' + st[0], step = 'Show me the balls · ' + (d.qi + 1) + ' of ' + d.seq.length + ' · ';
  if (d.many) return step + 'only one new ball on the ' + d.half + ' half, please';
  if (d.objIn && S.occFrac > 0.005) return step + 'step back from the table…';
  if (d.objIn) return step + 'hold still…';
  return step + (st[1] ? 'now move ' + nm + ' to the far half' : 'put ' + nm + ' on the near half, away from the cushions');
}
function quickTick(found) {
  const d = S.dr; if (!d || d.done || !d.half || frozen()) return;
  const st = d.seq[d.qi], P = S.P, vis = found.filter(b => !b.miss && !b.hid && !b.notBall);
  // a ball shown earlier (or already on the table when this started) and still lying there is not new; once its spot has
  // been seen empty twice in clear view (not just covered by an arm for a moment), that spot is free again
  if (!d.seeded) { d.seeded = true; for (const b of vis) d.parked.push([b.x, b.y, 0]); }
  for (const p of d.parked) { if (found.some(b => Math.hypot(b.x - p[0], b.y - p[1]) < 2.5)) p[2] = 0; else if (S.occFrac <= 0.005 && !hiddenAt({ x: p[0], y: p[1] })) p[2]++; }
  d.parked = d.parked.filter(p => p[2] < 2);
  const away = b => b.x > 3 && b.x < P.L - 3 && b.y > 3 && b.y < P.W - 3;
  const cands = vis.filter(b => inHalf(b, d.half) && away(b) && !d.parked.some(p => Math.hypot(b.x - p[0], b.y - p[1]) < 2.5));
  d.objIn = cands.length > 0; d.many = cands.length > 1; d.candAt = cands.length === 1 ? [cands[0].x, cands[0].y] : null;
  if (cands.length !== 1) { d.holdN = 0; return; }
  const b = cands[0];
  if (S.occFrac > 0.005 || (b.obs || []).length < 3 || (b.mvd || 0) > 0.3) { d.holdN = 0; return; }
  if (++d.holdN < 3) return;
  // learned: this ball, this table
  const id = st[0], guess = b.rec ? recogTop(b.rec) : null;
  if (b.feat) addDrillSample(b.feat, id, []);
  if (guess != null) { d.gN++; if (guess === id) d.gOk++; }
  d.got.push({ id, half: d.half, guess, at: [r1(b.x), r1(b.y)] });
  dbg('quick', { id, half: d.half, guess, at: [r1(b.x), r1(b.y)], feat: featArr(b.feat), prof: S.prof });
  frameSaveLook(d.qi + 1, { quick: 1, ball: id, half: d.half, guess, at: [r1(b.x), r1(b.y)], prof: S.prof }, found);
  ding(); d.parked.push([b.x, b.y, 0]); d.holdN = 0; d.qi++;
  if (d.qi >= d.seq.length) { d.done = true; S.quickDone = true; save(); setTimeout(quickSummary, 600); }
  else { quickSetSpot(); d.objIn = false; holdStatus('Got ' + (id === 0 ? 'the cue ball' : 'the ' + id) + '.', 1200); }
}
function quickSummary() {
  const d = S.dr; if (!d || !d.done) return;
  showCard('<h3>Balls learned for this table</h3><p>All 10 balls, 2 looks each' + (d.gN ? '. The app already knew ' + d.gOk + ' of ' + d.gN + ' before you showed it' : '') + '. Now play: Watch &amp; Learn uses these looks at this ' + (S.prof === 'away' ? 'away' : 'home') + ' table.</p><div class="row"><button class="btn primary" data-act="quickWatch">Start Watch &amp; Learn</button><button class="btn" data-act="home">Menu</button></div>');
}
function quickToWatch() {
  resetShotState(); S.drillMode = false; S.dr = null; S.quickThenWatch = false;
  S.truth = S.truthKeep || { rack: 1, target: 1, uncertain: false, why: 'start', looks: [], nArm: null, seen: false, pend: null, minArm: 99 }; S.truthKeep = null;
  if (S.sess) S.sess.drill = undefined; $('#modeLbl').textContent = MODE_LBL.watch + (S.prof === 'away' ? ' · Away' : ''); S.balls.forEach(b => { b.locked = false; }); setStatus('Watching.'); dbg('quick', { toWatch: true });
}
// a picture of one ball shown on its ring, with its certain label
async function frameSaveLook(n, info, found) {
  if (!FR.sess) return;
  try {
    const f = frameGrab(); if (!f) return; f.balls = found.filter(b => !b.miss).map(f.ball);
    const nm = 'look' + String(n).padStart(3, '0') + '.jpg', b = await toJpeg(f.c); if (!b) return;
    await idbPut(FR.sess + '/' + nm, await b.arrayBuffer());
    FR.labels.push(Object.assign({ look: n, t: Date.now(), pic: { file: nm, crop: f.crop, scale: f.scale, w: f.c.width, h: f.c.height, balls: f.balls } }, info));
    await labelsSave();
  } catch (e) { dbg('frames', { err: 'look ' + String(e && e.message || e).slice(0, 80) }); }
}
function drillSummary() {
  const d = S.dr; if (!d || !d.done || S.mode !== 'play9') return;
  const rows = []; for (let b = 1; b <= 9; b++) { const s = d.stats[b] || { made: 0, miss: 0, seen: 0, blind: 0 }; rows.push('<div class="srow ' + (s.blind ? 'no' : 'ok') + '"><b>' + b + '</b><span>' + s.made + ' made' + (s.miss ? ', ' + s.miss + ' missed' : '') + '</span><em>' + (s.blind ? 'not seen ' + s.blind + 'x' : 'seen every shot') + (s.gN ? ' · knew it ' + s.gOk + '/' + s.gN : '') + '</em></div>'); }
  showCard('<h3>Learn the balls: done</h3><div class="dsum"><div class="slist">' + rows.join('') + '</div></div><p>Tap End session, then Save debug to send the pictures.</p><div class="row"><button class="btn primary" data-act="dismiss">OK</button></div>');
}
function drillThrowOut(sh) {
  const d = S.dr, s = sh && sh.drSnap; if (!d || !s) return;
  Object.assign(d, JSON.parse(JSON.stringify(s))); drillSetSpot(); hideCard();
}
// Show me the balls: the half of the table the ball goes on, with its number; Learn the balls: the half asked for, if any
function drawDrillSpots() {
  const d = S.dr; if (!d || d.done || !S.cam) return; const h = d.quick ? d.half : d.want; if (!h) return;
  const P = S.P, lowNear = nearLow(), y0 = (h === 'near') === lowNear ? 3 : P.W / 2 + 1, y1 = (h === 'near') === lowNear ? P.W / 2 - 1 : P.W - 3;
  const on = d.quick && d.objIn, col = on ? 'rgba(60,225,125,1)' : '#ffffff';
  line([[3, y0], [P.L - 3, y0], [P.L - 3, y1], [3, y1], [3, y0]], col, 2, on ? [] : [8, 6], d.quick ? 0.75 : 0.4);
  if (!d.quick) return;
  const id = d.ball, bc = ballColor(id), q = MAP.p(P.L / 2, (y0 + y1) / 2, 0);
  sctx.save(); sctx.fillStyle = bc; sctx.beginPath(); sctx.arc(q[0], q[1], 14, 0, 7); sctx.fill(); sctx.strokeStyle = '#fff'; sctx.lineWidth = 1.5; sctx.stroke();
  sctx.fillStyle = id === 0 || id === 1 || id === 9 ? '#16181b' : '#fff'; sctx.font = '700 16px Inter, system-ui, sans-serif'; sctx.textAlign = 'center'; sctx.textBaseline = 'middle'; sctx.fillText(id === 0 ? 'Q' : String(id), q[0], q[1] + 1); sctx.restore();
}

// ---------- pictures: the table just before each shot and once everything has stopped ----------
// Kept on the phone (IndexedDB) as the session goes, so closing the app does not lose them; Save debug packs them up.
const FR = { bef: null, sess: null, labels: [], lastT: 0, pool: [] };
// a few canvases are reused for the pictures (making a new one every second wears iPhone Safari's canvas memory down);
// one held for a shot (busy) is never handed out until its picture has been saved
function frCanvas(w, h) {
  let c = FR.pool.find(x => !x._busy && x !== (FR.bef && FR.bef.c));
  if (!c && FR.pool.length < 6) { c = document.createElement('canvas'); FR.pool.push(c); }
  if (!c) { c = FR.pool.find(x => x !== (FR.bef && FR.bef.c)) || FR.pool[0]; c._busy = false; }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c;
}
const IDB = {};
function idb() {
  return IDB.p || (IDB.p = new Promise((res, rej) => { try { const q = indexedDB.open('chalkline', 1); q.onupgradeneeded = () => q.result.createObjectStore('files'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); } catch (e) { rej(e); } }));
}
async function idbDo(mode, fn) {
  let db = await idb(); let tx;
  try { tx = db.transaction('files', mode); } catch (e) { IDB.p = null; db = await idb(); tx = db.transaction('files', mode); } // Safari can drop the connection
  return new Promise((res, rej) => { const st = tx.objectStore('files'), q = fn(st); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('aborted')); });
}
const idbPut = (k, v) => idbDo('readwrite', st => st.put(v, k));
const idbGet = k => idbDo('readonly', st => st.get(k));
const idbKeys = () => idbDo('readonly', st => st.getAllKeys());
const idbDel = k => idbDo('readwrite', st => st.delete(k));
function frameSessionStart(t0) {
  FR.sess = 's' + t0; FR.labels = []; FR.bef = null; FR.lastT = 0; for (const c of FR.pool) c._busy = false;
  CLIP.off = false; CLIP.lowN = 0; // (each session gets a fresh chance at shot videos; the checks switch them off again if needed)
  // keep the pictures of the last three sessions only
  idbKeys().then(keys => { const ss = [...new Set(keys.map(k => String(k).split('/')[0]))].filter(k => k !== FR.sess && k !== 'geo').sort(); const drop = ss.slice(0, Math.max(0, ss.length - 2)), dropClips = ss.slice(0, Math.max(0, ss.length - 1)); for (const k of keys) { const s0 = String(k).split('/')[0]; if (drop.includes(s0) || (dropClips.includes(s0) && /\.(mp4|webm)$/.test(String(k)))) idbDel(k); } }).catch(e => dbg('frames', { err: String(e).slice(0, 80) }));
}
// a picture of the table (rails included) from the full-size camera frame
function frameGrab() {
  if (!vid.videoWidth || !S.vr || !S.cam) return null;
  const P = S.P, vr0 = { ...S.vr }, sx = vr0.w / S.W, sy = vr0.h / S.H, vx = q => vr0.x + q[0] * sx, vy = q => vr0.y + q[1] * sy;
  const cs = [[-6, -6], [P.L + 6, -6], [P.L + 6, P.W + 6], [-6, P.W + 6]].map(([x, y]) => S.cam.proj(x, y, 0));
  const x0 = clamp(Math.floor(Math.min(...cs.map(vx))), 0, vid.videoWidth - 2), x1 = clamp(Math.ceil(Math.max(...cs.map(vx))), x0 + 1, vid.videoWidth);
  const y0 = clamp(Math.floor(Math.min(...cs.map(vy))), 0, vid.videoHeight - 2), y1 = clamp(Math.ceil(Math.max(...cs.map(vy))), y0 + 1, vid.videoHeight);
  const w = x1 - x0, h = y1 - y0, k = Math.min(1, 1280 / Math.max(w, h)), c = frCanvas(Math.round(w * k), Math.round(h * k));
  c.getContext('2d').drawImage(vid, x0, y0, w, h, 0, 0, c.width, c.height);
  const ball = b => { const q = S.cam.proj(b.x, b.y, P.R), r = S.cam.ballRad(b.x, b.y, P.R, P.R) * sx; return { id: b.id == null ? null : b.id, x: r1(b.x), y: r1(b.y), px: Math.round((vx(q) - x0) * k), py: Math.round((vy(q) - y0) * k), pr: r1(r * k), conf: r2(b.conf || 0), hid: b.hid || undefined, top: b.feat ? topIds(b, 3) : null, rec: b.rec ? recogTop(b.rec) : undefined, nb: b.rec ? r2(b.rec[RECOG_NB]) : undefined, extra: S.drillMode && b.id == null ? 1 : undefined }; };
  const cam = S.cam, pt = (x, y, z) => { const q = cam.proj(x, y, z || 0); return [(vx(q) - x0) * k, (vy(q) - y0) * k]; }; // (this moment's camera, even if the table is found again later)
  return { c, crop: [x0, y0, w, h], scale: r2(k), t: Date.now(), ball, pt };
}
function frameKeepBefore(found) {
  if (performance.now() - FR.lastT < 1000 || S.occFrac > 0.005 || (S.occN && performance.now() - (FR.cleanT || 0) < 20000)) return; FR.lastT = performance.now(); if (!S.occN) FR.cleanT = FR.lastT; // nobody near the table
  try { const f = frameGrab(); if (f) { f.balls = found.filter(b => !b.miss).map(f.ball).concat((S.nbSeen || []).filter(b => performance.now() - (b.since || 0) < 1500).map(b => Object.assign(f.ball(b), { notBall: 1 }))); FR.bef = f; } } catch (e) { dbgOnce('frerr', 10000, 'frames', { err: String(e).slice(0, 80) }); }
}
const toJpeg = c => new Promise(res => { try { c.toBlob(b => res(b), 'image/jpeg', 0.85); } catch (e) { res(null); } });
// the after picture: taken the moment everything has stopped, and held for the shot until it is saved
function frameAfter() { try { const f = frameGrab(); if (f) { f.balls = detectNow().map(f.ball); f.c._busy = true; } return f; } catch (e) { return null; } }
function detectNow() { try { const f = detectBalls(imgData(), S.cam, S.P, S.cloth, { still: STILL.mask ? stillInfo() : undefined }).map(b => ({ ...b, id: null })); recogFound(f); return f; } catch (e) { return []; } }
const labelsSave = (sess, labels) => idbPut((sess || FR.sess) + '/labels.json', new TextEncoder().encode(JSON.stringify({ app: VERSION, ft: S.ft, prof: S.prof, table: [S.P.L, S.P.W], ballR: S.P.R, shots: labels || FR.labels }, null, 1)).buffer);
async function frameSaveShot(n, info, shot) {
  if (!FR.sess) return; const sess = FR.sess, labels = FR.labels, se = S.sess; // (a new session may start while this one is saved)
  const clipP = CLIP.rec ? (CLIP.rec.shotT != null || (shot && shot.unseen) ? clipStop(n) : clipStop(null)) : null;
  const bef = shot && shot.frBef || (shot && shot.unseen ? FR.bef : null), aft = shot && shot.frAft || frameAfter();
  if (aft && !aft.balls.some(b => b.id != null)) { // numbers as read once the result was in (S.balls), matched by spot
    aft.balls = aft.balls.map(b => { const o = S.balls.find(q => Math.hypot(q.x - b.x, q.y - b.y) < 1.5); return o ? Object.assign(b, { id: o.id == null ? null : o.id, conf: r2(o.conf || 0) }) : b; });
  }
  const nm = 'shot' + String(n).padStart(3, '0'), rec = Object.assign({ shot: n, t: Date.now(), rack: S.truth ? S.truth.rack : null }, info);
  const sh = se && se.shots[n - 1]; // thrown out or flagged before its pictures were saved
  try {
    for (const [tag, f] of [['before', bef], ['after', aft]]) {
      if (!f) continue; const b = await toJpeg(f.c);
      // the after picture once more with the path dots on it (the plain one stays clean for testing)
      const tr = tag === 'after' && shot && shot._tr && shot._tr.length && f.pt ? shot._tr : null;
      if (b && tr) { try { const cx = f.c.getContext('2d'); trailsDraw(cx, tr, (x, y) => f.pt(x, y, S.P.R), Math.max(0.7, f.c.width / 900)); const b2 = await toJpeg(f.c); if (b2) { await idbPut(sess + '/' + nm + '-paths.jpg', await b2.arrayBuffer()); rec.paths = nm + '-paths.jpg'; } } catch (e) { } }
      f.c._busy = false; if (!b) continue;
      await idbPut(sess + '/' + nm + '-' + tag + '.jpg', await b.arrayBuffer());
      rec[tag] = { file: nm + '-' + tag + '.jpg', crop: f.crop, scale: f.scale, w: f.c.width, h: f.c.height, ageS: r1((Date.now() - f.t) / 1000), balls: f.balls };
    }
    if (clipP) rec.clip = await Promise.race([clipP, new Promise(r => setTimeout(() => r(null), 4000))]) || undefined;
    if (sh && sh.thrown) rec.thrown = true;
    if (sh && sh.flag) rec.flag = true; // (read last: the button may be tapped while the pictures are being saved)
    labels.push(rec); await labelsSave(sess, labels);
    dbg('frames', { shot: n, before: !!bef, after: !!aft });
  } catch (e) { dbg('frames', { err: String(e && e.message || e).slice(0, 100) }); for (const f of [bef, aft]) if (f) f.c._busy = false; }
}

// ---------- shot videos (V2.3.3): a short clip of every shot, for testing new versions on real shots ----------
// Recording starts when the table is ready for a shot (the cue ball still), restarts every 15 s while nobody shoots (so a
// clip starts at most ~15 s before the shot), and stops once the shot's result is in; it is kept as shotNNN.mp4 next to
// the pictures. The phone's video encoder does the work. If the camera's frame rate drops while recording, clips are
// switched off for the session (dbg clip_off): following the balls matters more.
const CLIP = { cur: null, old: null, off: false, base: 0, lowN: 0, kept: 0, ovl: false, noOvl: false };
Object.defineProperty(CLIP, 'rec', { get() { return CLIP.cur || CLIP.old; } }); // any recording running
function clipMime() { if (typeof MediaRecorder === 'undefined') return null; for (const m of ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp8', 'video/webm']) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (e) { } } return null; }
function clipNew() {
  const mime = clipMime(); if (!mime) { CLIP.off = true; dbg('clip_off', { why: 'no recorder' }); return null; }
  const tracks = S.stream.getVideoTracks().concat(MIC.st ? MIC.st.getAudioTracks() : []), r = new MediaRecorder(new MediaStream(tracks), { mimeType: mime, videoBitsPerSecond: 1000000, audioBitsPerSecond: 48000 });
  const o = { r, chunks: [], t0: performance.now(), mime, shotT: null }; r.ondataavailable = e => { if (e.data && e.data.size) o.chunks.push(e.data); };
  r.onerror = e => { o.err = true; dbg('clip', { err: 'recorder: ' + String(e && e.error && (e.error.name || e.error.message) || 'error').slice(0, 60), overlap: !!o.ovl }); if (o.ovl) CLIP.noOvl = true; };
  r.start(1000); dbgOnce('clipstart', 60000, 'clip_start', { mime, audio: tracks.length > 1 }); return o;
}
const clipCan = () => !CLIP.off && CLIP.base > 0 && S.clips !== false && S.watch && !(S.drillMode && S.dr && S.dr.quick) && S.stream && FR.sess && S.live && !S.geo;
function clipStart() {
  if (CLIP.cur || !clipCan()) return;
  try { CLIP.cur = clipNew(); } catch (e) { CLIP.off = true; dbg('clip_off', { why: String(e && (e.name || e.message) || e).slice(0, 80) }); }
}
// stop one recording; keep it as shot n (n == null: throw it away). Resolves to what was kept, for the labels.
function clipEnd(o, n) {
  if (!o) return Promise.resolve(null); const sess = FR.sess, tEnd = performance.now();
  return new Promise(done => {
    o.r.onstop = async () => {
      if (n == null || !sess) return done(null);
      try {
        const blob = new Blob(o.chunks, { type: o.mime.split(';')[0] }), ext = o.mime.includes('mp4') ? 'mp4' : 'webm', nm = 'shot' + String(n).padStart(3, '0') + '.' + ext;
        if (blob.size < 2000) { if (o.ovl) CLIP.noOvl = true; dbg('clip', { shot: n, err: 'empty', overlap: !!o.ovl }); return done(null); } // (two recordings at once may not work on every phone: one at a time from then on)
        await idbPut(sess + '/' + nm, await blob.arrayBuffer()); CLIP.kept++; clipBudget(sess, sess + '/' + nm, n, blob.size);
        const secs = r1((tEnd - o.t0) / 1000), at = o.shotT != null ? r2((o.shotT - o.t0) / 1000) : null, kb = Math.round(blob.size / 1024);
        dbg('clip', { shot: n, file: nm, kb, secs, shotAt: at }); done({ file: nm, secs, shotAt: at, kb });
      } catch (e) { dbg('clip', { err: String(e && e.message || e).slice(0, 80) }); done(null); }
    };
    if (o.r.state === 'inactive') { o.r.onstop(); return; } // (already stopped: what it recorded is all there is)
    try { o.r.stop(); } catch (e) { done(null); }
  });
}
// at most 250 MB of shot videos per session (the oldest unflagged ones go first), and none once the phone's storage for
// the app is 85% full: labels and pictures must always fit
function clipBudget(sess, key, n, bytes) {
  if (CLIP.sess !== sess) { CLIP.sess = sess; CLIP.saved = []; } CLIP.saved.push({ key, n, bytes });
  let tot = CLIP.saved.reduce((a, c) => a + c.bytes, 0);
  while (tot > 250 * 1048576 && CLIP.saved.length > 1) {
    const i = CLIP.saved.findIndex(c => !(S.sess && S.sess.shots[c.n - 1] && S.sess.shots[c.n - 1].flag)); if (i < 0 || CLIP.saved[i].key === key) break;
    const c = CLIP.saved.splice(i, 1)[0]; tot -= c.bytes; idbDel(c.key).catch(() => { }); dbg('clip', { removed: c.n, why: 'space' });
  }
  try { if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(e => { if (e && e.quota && e.usage / e.quota > 0.85 && !CLIP.off) { CLIP.off = true; dbg('clip_off', { why: 'storage', mb: Math.round(e.usage / 1048576), quotaMb: Math.round(e.quota / 1048576) }); clipStop(null); } }).catch(() => { }); } catch (e) { }
}
// the shot is over: keep the recording that holds it (the older one if a fresh one had only just started), drop the other
function clipStop(n) {
  let keep = CLIP.cur, drop = CLIP.old;
  if (n != null && CLIP.old && (!CLIP.cur || CLIP.cur.shotT == null || CLIP.cur.shotT - CLIP.cur.t0 < 3000)) { keep = CLIP.old; drop = CLIP.cur; }
  CLIP.cur = null; CLIP.old = null; clipEnd(drop, null); return keep ? clipEnd(keep, n) : null;
}
// the shot starts: every running recording holds it from here on (a later start replaces one that was not a shot)
function clipShot() { for (const o of [CLIP.cur, CLIP.old]) if (o) o.shotT = performance.now(); }
function clipNoShot() { for (const o of [CLIP.cur, CLIP.old]) if (o) o.shotT = null; }
// on every look: start when ready for a shot. While nobody shoots, a fresh recording starts every 12 s and the old one is
// thrown away 3 s later, so whenever the shot comes the clip has at least 3 s before it (and at most ~15 s).
function clipTick() {
  if (!clipCan()) { if (CLIP.rec && !S.recording && !S.awaitAfter && !S.pend) clipStop(null); return; }
  if (!CLIP.cur) { if (S.armPos && !S.recording && !S.awaitAfter) clipStart(); return; }
  const busy = S.recording || S.awaitAfter || S.pend || TR.rec || S.settling || S.watchWait, now = performance.now();
  if (busy) return;
  // a shot start that never became a shot (a ball picked up, a nudge), or something stuck: start over
  if ((CLIP.cur.shotT != null && now - CLIP.cur.shotT > 25000) || now - CLIP.cur.t0 > 120000) { clipStop(null); dbg('clip', { dropped: 'no shot' }); return; }
  if (CLIP.cur.shotT != null) return;
  if (CLIP.old && now - CLIP.cur.t0 > 3000) { // the old one goes only once the new one is really recording
    if (CLIP.cur.chunks.length && CLIP.cur.r.state === 'recording' && !CLIP.cur.err) { clipEnd(CLIP.old, null); CLIP.old = null; }
    else if (now - CLIP.cur.t0 > 6000) { CLIP.noOvl = true; dbg('clip', { overlap: 'failed' }); clipEnd(CLIP.cur, null); CLIP.cur = CLIP.old; CLIP.old = null; }
    return; }
  if (!CLIP.old && now - CLIP.cur.t0 > 12000) {
    if (CLIP.noOvl) { clipEnd(CLIP.cur, null); CLIP.cur = null; if (S.armPos) clipStart(); return; }
    const was = CLIP.cur; CLIP.cur = null;
    try { CLIP.cur = clipNew(); if (CLIP.cur) CLIP.cur.ovl = was.ovl = true; CLIP.old = was; CLIP.ovl = true; } catch (e) { CLIP.noOvl = true; dbg('clip', { overlap: 'no' }); CLIP.cur = was; } // (one recording at a time then)
  }
}
// the heartbeat: the camera's frame rate without and with recording; a clear drop while recording turns clips off
// (windows with two recordings at once are not counted: that is the brief overlap)
function clipFps(camFps) {
  const ovl = CLIP.ovl || !!CLIP.old; CLIP.ovl = false;
  if (!CLIP.rec) { if (camFps > 10) CLIP.base = CLIP.base ? 0.7 * CLIP.base + 0.3 * camFps : camFps; CLIP.lowN = 0; return; }
  if (ovl) return;
  if (CLIP.base && camFps < 0.8 * CLIP.base) { if (++CLIP.lowN >= 2) { CLIP.off = true; dbg('clip_off', { why: 'frame rate', base: Math.round(CLIP.base), now: camFps }); clipStop(null); toast('Shot videos off: they slowed the camera'); } } else CLIP.lowN = 0;
}
// "This shot was wrong": the last shot is marked for a closer look (and becomes a test case)
function flagLast() {
  const se = S.sess; if (!se || !se.shots.length) return; const n = se.shots.length, sh = se.shots[n - 1]; if (sh.flag) return; sh.flag = true;
  dbg('flag', { shot: n, made: sh.made, target: sh.target, first: sh.first });
  const L = FR.labels.find(x => x.shot === n); if (L && FR.sess) { L.flag = true; labelsSave().catch(() => { }); }
  toast('Shot ' + n + ' marked as wrong. Thanks!'); updUndo();
}

// ---------- one zip with the log, the pictures and their labels ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0, true); h.setUint16(8, 0, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true); h.setUint16(28, 0, true);
    parts.push(h.buffer, name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0, true); c.setUint16(10, 0, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true);
    c.setUint16(34, 0, true); c.setUint16(36, 0, true); c.setUint32(38, 0, true); c.setUint32(42, off, true);
    central.push(c.buffer, name); off += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + (b.byteLength || b.length), 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob(parts.concat(central, [e.buffer]), { type: 'application/zip' });
}

// ---------- shot tracking ----------
const TR = { cv: null, cx: null, cam: null, w: 0, h: 0, ct: -1, rec: null, pre: 0, cand: null, key: '' };
function trKey() { return [S.W, S.H, lensZ(), S.rot, S.ft, S.vr && [S.vr.x, S.vr.y, S.vr.w, S.vr.h].join(','), S.quad && S.quad.map(p => p.join(',')).join(';')].join('|'); }
function trackSetup() {
  const r = S.vr, sc = Math.min(1, 640 / Math.max(r.w, r.h)); TR.w = Math.round(r.w * sc); TR.h = Math.round(r.h * sc);
  TR.cv = document.createElement('canvas'); TR.cv.width = TR.w; TR.cv.height = TR.h; TR.cx = TR.cv.getContext('2d', { willReadFrequently: true });
  const q = S.quad.map(p => [p[0] / S.W * TR.w, p[1] / S.H * TR.h]), k = TR.w / S.W, pp = ppPx();
  TR.cam = makeCam(tableCorners(), q, TR.w, TR.h, focalPx() * k, [pp[0] * k, pp[1] * k]); TR.key = trKey();
}
// Every sample is stamped with the camera's own clock for that frame (not the moment we got round to looking at it),
// so a slow pass or a missed frame cannot make a ball look faster than it was.
const VF = { n: 0, t: 0, mt: [], useMedia: null, on: false };
function hookFrames(again) {
  if ((VF.on && !again) || !vid.requestVideoFrameCallback) return; VF.on = true;
  const gen = VF.gen = (VF.gen || 0) + 1; // a fresh chain after the camera restarts; an older chain stops itself
  const cb = (now, md) => {
    if (gen !== VF.gen) return;
    VF.n++; const mt = md && typeof md.mediaTime === 'number' ? md.mediaTime : null;
    if (VF.useMedia === null && mt !== null) { VF.mt.push(mt); if (VF.mt.length >= 6) { const d = VF.mt.slice(1).map((v, i) => v - VF.mt[i]); VF.useMedia = d.every(x => x > 0.004 && x < 0.2); } }
    VF.t = VF.useMedia ? mt : now / 1000; VF.pt = md && md.captureTime > 0 ? md.captureTime : now; VF.cap = !!(md && md.captureTime > 0); VF.last = performance.now(); vid.requestVideoFrameCallback(cb);
    // follow the cue ball right here, on the frame this time stamp belongs to (not whatever frame is showing a moment later)
    try { const t0 = performance.now(); trackFrame(); lagT('track', t0); } catch (e) { dbg('error', { m: 'track: ' + String(e).slice(0, 160) }); }
  };
  vid.requestVideoFrameCallback(cb);
}
// ---------- every ball's path through a shot (V2.3.1) ----------
// From the moment the cue ball leaves until the table has settled, every ball is followed on every camera frame (on the
// small tracking picture). A ball that sits still keeps its spot (and its name); a ball that leaves its spot is followed to
// where it stops, so its name travels with it; a ball that vanishes at a pocket went in. After the shot the names come from
// these paths first, and colour only has to decide what the paths could not (balls that touched or crossed, or were hidden).
const MT = { on: false, tr: [], last: null, key: '', px: null, cell: null, gw: 0, gh: 0, st: 2, m: null, lab: null, n: 0, ms: 0 };
function mtSetup() {
  const P = S.P, cam = TR.cam, st = MT.st, W = TR.w, H = TR.h;
  const cs = [[0, 0], [P.L, 0], [P.L, P.W], [0, P.W]].map(p => cam.proj(p[0], p[1], 0));
  const x0 = Math.max(0, Math.floor(Math.min(...cs.map(p => p[0])))), x1 = Math.min(W - 1, Math.ceil(Math.max(...cs.map(p => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...cs.map(p => p[1])) - 4)), y1 = Math.min(H - 1, Math.ceil(Math.max(...cs.map(p => p[1]))));
  const gw = Math.max(1, Math.floor((x1 - x0) / st) + 1), gh = Math.max(1, Math.floor((y1 - y0) / st) + 1), N = gw * gh;
  MT.x0 = x0; MT.y0 = y0; MT.gw = gw; MT.gh = gh; MT.px = new Int32Array(N); MT.cell = new Int32Array(N); MT.m = new Uint8Array(N); MT.lab = new Int32Array(N);
  const cg = Math.ceil(P.L / STILL.cs) + 1;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = j * gw + i, x = x0 + i * st, y = y0 + j * st, t = cam.unproj(x, y, 0);
    MT.px[k] = (y * W + x) * 4;
    // only the cloth (the same cells as the learned cushion shadows); the pocket holes are left out, so a ball dropping in
    // vanishes there instead of being followed onto the dark hole
    const hole = P.pockets.some(q => Math.hypot(q.x - t[0], q.y - t[1]) < q.r + 1);
    MT.cell[k] = hole || t[0] < -0.5 || t[1] < -0.5 || t[0] > P.L + 0.5 || t[1] > P.W + 0.5 ? -2 : t[0] < 0 || t[1] < 0 || t[0] >= P.L || t[1] >= P.W ? -1 : Math.floor(t[1] / STILL.cs) * cg + Math.floor(t[0] / STILL.cs);
  }
  MT.key = TR.key;
}
// the felt test without making a new array for every pixel (it runs on every frame during a shot)
function mtMask(d) {
  const cl = S.cloth, N = MT.px.length, m = MT.m, sm = STILL.mask, vMin = (cl.v > 0.75 ? 0.52 : 0.42) * cl.v, deep = Math.min(0.95, cl.s + 0.15);
  let on = 0;
  for (let k = 0; k < N; k++) {
    const c = MT.cell[k]; if (c === -2 || (sm && c >= 0 && sm[c])) { m[k] = 0; continue; }
    const o = MT.px[k], r = d[o] / 255, g = d[o + 1] / 255, b = d[o + 2] / 255, mx = r > g ? (r > b ? r : b) : (g > b ? g : b), mn = r < g ? (r < b ? r : b) : (g < b ? g : b), dl = mx - mn;
    let h = 0; if (dl > 1e-6) { h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; h *= 60; if (h < 0) h += 360; }
    const s = mx === 0 ? 0 : dl / mx, v = mx; let cloth = true;
    if (v < vMin) cloth = false;
    else if (cl.s > 0.2 && s > 0.2) { const dh = hueDiff(h, cl.h); if (dh > 24 || (dh > 13 && v < 0.8 * cl.v)) cloth = false; }
    if (cloth && cl.s > 0.2 && v < 0.66 * cl.v && s > deep) cloth = false;
    if (cloth && (Math.abs(s - cl.s) > 0.34 || v > 1.7 * cl.v)) cloth = false;
    m[k] = cloth ? 0 : 1; on += m[k];
  }
  return on;
}
// blobs of not-felt on the bed: where each one is (table inches) and how big it is against one ball at that spot
function mtBlobs() {
  const m = MT.m, lab = MT.lab, gw = MT.gw, gh = MT.gh, st = MT.st, cam = TR.cam, R = S.P.R, out = []; lab.fill(0); const stack = [];
  for (let k = 0; k < m.length; k++) {
    if (!m[k] || lab[k]) continue; const id = out.length + 1; let n = 0, sx = 0, sy = 0; stack.length = 0; stack.push(k); lab[k] = id;
    while (stack.length) { const p = stack.pop(), i = p % gw, j = (p / gw) | 0; n++; sx += i; sy += j;
      if (i > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack.push(p - 1); } if (i < gw - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack.push(p + 1); }
      if (j > 0 && m[p - gw] && !lab[p - gw]) { lab[p - gw] = id; stack.push(p - gw); } if (j < gh - 1 && m[p + gw] && !lab[p + gw]) { lab[p + gw] = id; stack.push(p + gw); } }
    const px = MT.x0 + sx / n * st, py = MT.y0 + sy / n * st, t = cam.unproj(px, py, R), rp = cam.ballRad(t[0], t[1], R, R) / st;
    out.push({ x: t[0], y: t[1], n, ratio: n / Math.max(1, Math.PI * rp * rp), cl: null });
  }
  return out;
}
// is there still something that is not felt right on this ball's spot? (its middle, about two thirds of its radius)
function mtPresent(x, y) {
  const cam = TR.cam, R = S.P.R, c = cam.proj(x, y, R), rp = Math.max(1.6, cam.ballRad(x, y, R, R) * 0.65 / MT.st), ci = (c[0] - MT.x0) / MT.st, cj = (c[1] - MT.y0) / MT.st;
  let n = 0, on = 0, sm = 0;
  for (let j = Math.floor(cj - rp); j <= Math.ceil(cj + rp); j++) for (let i = Math.floor(ci - rp); i <= Math.ceil(ci + rp); i++) {
    if (i < 0 || j < 0 || i >= MT.gw || j >= MT.gh || (i - ci) ** 2 + (j - cj) ** 2 > rp * rp) continue; const k = j * MT.gw + i;
    if (MT.cell[k] < 0 && MT.cell[k] === -2) continue; if (STILL.mask && MT.cell[k] >= 0 && STILL.mask[MT.cell[k]]) { sm++; continue; }
    n++; on += MT.m[k];
  }
  return n < 3 ? null : on / n; // null: cannot tell (too small to see, or a learned cushion shadow covers it)
}
function mtStart(rec, now) {
  const mk = (b, cue) => ({ id: b.id, x: b.x, y: b.y, x0: b.x, y0: b.y, rx: b.x, ry: b.y, vx: 0, vy: 0, st: cue ? 'move' : 'rest', gone: 0, lost: 0, slow: 0, moved: !!cue, path: [[0, r1(b.x), r1(b.y)]], cue: !!cue, t: now });
  const cue = { id: 0, x: rec.last.x, y: rec.last.y };
  MT.tr = rec.before.filter(b => b.id !== 0).map(b => mk(b)).concat((rec.un || []).map(b => mk(b))).concat([mk({ id: 0, x: rec.pos0.x, y: rec.pos0.y }, true)]);
  const c = MT.tr[MT.tr.length - 1]; c.x = cue.x; c.y = cue.y; MT.on = true; MT.last = null; MT.t0 = now; MT.n = 0; MT.ms = 0; MT.sum = 0;
}
function mtStep(im, now) {
  if (!MT.on || !S.cloth) return; const t0 = performance.now();
  if (MT.key !== TR.key || !MT.px) mtSetup();
  mtMask(im.data); const bl = mtBlobs(), R = S.P.R, claim = new Map(); MT.n++;
  const near = (x, y, lim, ok) => { let best = null, bd = lim; for (const b of bl) { if (ok && !ok(b)) continue; const d = Math.hypot(b.x - x, b.y - y); if (d < bd) { bd = d; best = b; } } return best; };
  // the blob a ball's own middle sits in (exact for balls touching in a cluster), else the closest one
  const blobAt = (x, y) => { const c = TR.cam.proj(x, y, R), i = Math.round((c[0] - MT.x0) / MT.st), j = Math.round((c[1] - MT.y0) / MT.st); if (i >= 0 && j >= 0 && i < MT.gw && j < MT.gh) { const l = MT.lab[j * MT.gw + i]; if (l) return bl[l - 1]; } return near(x, y, 1.3 * R); };
  const own = (b, t) => { const l = claim.get(b) || []; if (!l.includes(t)) claim.set(b, l.concat([t])); }, at = t => t.st === 'rest' ? [t.rx, t.ry] : [t.x, t.y];
  const push = (t, x, y) => { const l = t.path[t.path.length - 1]; if (Math.hypot(l[1] - x, l[2] - y) > 0.15) t.path.push([r2(now - MT.t0), r1(x), r1(y)]); };
  // 1) balls at rest hold their spot for as long as something is still there; two looks with only felt there: it left
  for (const t of MT.tr) {
    if (t.st !== 'rest') continue; const pr = mtPresent(t.rx, t.ry);
    if (pr === null || pr >= 0.35) { t.gone = 0; const b = blobAt(t.rx, t.ry); if (b) own(b, t); continue; }
    if (++t.gone >= 2) { t.st = 'move'; t.moved = true; t.lost = 0; t.slow = 0; t.vx = 0; t.vy = 0; t.x = t.rx; t.y = t.ry; t.seenT = t.leftT || now; t.t = now; }
    else t.leftT = now;
  }
  // 2) the cue ball: where its own tracker saw it on this frame, while that runs
  const rec = TR.rec, ct = MT.tr.find(t => t.cue);
  if (ct && rec && rec.track.length && rec.track[rec.track.length - 1][0] === now) { const dt = Math.max(1 / 120, now - ct.t); ct.vx = (rec.last.x - ct.x) / dt; ct.vy = (rec.last.y - ct.y) / dt; ct.x = rec.last.x; ct.y = rec.last.y; ct.t = now; ct.seenT = now; ct.lost = 0; ct.st = 'move'; push(ct, ct.x, ct.y); const b = blobAt(ct.x, ct.y); if (b) own(b, ct); ct.own = true; } else if (ct) ct.own = false;
  // 3) moving balls: the closest pairs of (ball, spot of not-felt near where that ball should be by now) first, over all the
  //    moving balls at once, so a ball just set rolling cannot take a spot another ball is clearly following. A spot already
  //    holding k balls (touching ones) is only taken if it is clearly bigger than k balls, and then this ball is what is left.
  //    A ball picked up again only after a long gap (far from where it could be) is marked unsure: its path names nothing.
  const mv = MT.tr.filter(t => t.st === 'move' && !t.own), Q = new Map();
  for (const t of mv) { const dt = Math.max(1 / 120, now - t.t), sp = Math.hypot(t.vx, t.vy), fresh = t.path.length < 2 || t.lost > 0, base = 2.2 + sp * dt * 1.6;
    Q.set(t, { dt, px: t.x + t.vx * dt, py: t.y + t.vy * dt, base, gate: clamp(base + (fresh ? 70 * Math.min(0.2, now - (t.seenT || t.t)) : 0), 2.2, 24) }); }
  const left = new Set(mv);
  while (left.size) {
    let best = null;
    for (const t of left) { const q = Q.get(t);
      for (const b of bl) {
        const cl = claim.get(b) || [], k = cl.length; if (b.ratio < 0.25 || b.ratio > k + 2.2) continue; let x = b.x, y = b.y;
        if (k) { if (b.ratio < k + 0.55) continue; let sx = 0, sy = 0; for (const o of cl) { const p = at(o); sx += p[0]; sy += p[1]; } x = (k + 1) * b.x - sx; y = (k + 1) * b.y - sy; }
        const d = Math.hypot(x - q.px, y - q.py); if (d < q.gate && (!best || d < best.d)) best = { t, b, x, y, d };
      } }
    if (!best) break;
    const t = best.t, q = Q.get(t); left.delete(t);
    if (best.d > q.base + 2.3) t.unsure = true;
    const nvx = (best.x - t.x) / q.dt, nvy = (best.y - t.y) / q.dt; t.vx = t.lost ? nvx : 0.4 * t.vx + 0.6 * nvx; t.vy = t.lost ? nvy : 0.4 * t.vy + 0.6 * nvy;
    t.x = best.x; t.y = best.y; t.t = now; t.seenT = now; t.lost = 0; t.seen = [t.x, t.y, t.vx, t.vy]; own(best.b, t); push(t, t.x, t.y);
    t.slow = Math.hypot(t.vx, t.vy) < 2 ? t.slow + 1 : 0;
    if (t.slow >= 8 && now - MT.t0 > 0.3) { t.st = 'rest'; t.rx = t.x; t.ry = t.y; t.gone = 0; }
  }
  for (const t of left) {
    const q = Q.get(t), gap = now - (t.seenT || t.t); t.lost++; t.x = q.px; t.y = q.py; t.vx *= 0.85; t.vy *= 0.85; t.t = now;
    // gone at a pocket: only a ball that was seen rolling (at least two spots along its way) and vanished at the pocket
    const pk = S.P.pockets.findIndex(p => Math.hypot(p.x - t.x, p.y - t.y) < p.r + 2.5);
    if (pk >= 0 && t.path.length >= 3 && t.lost >= 2 && gap > 0.05) { t.st = 'pocket'; t.pk = pk; push(t, t.x, t.y); }
    else if (gap > 0.6) {
      // lost for good: if it was last seen rolling straight at a pocket (within reach at that speed), it went in there
      const z = t.seen, sp = z ? Math.hypot(z[2], z[3]) : 0; let pi = -1;
      if (z && sp > 8 && t.path.length >= 3) S.P.pockets.forEach((p, i) => { const dx = p.x - z[0], dy = p.y - z[1], along = (dx * z[2] + dy * z[3]) / sp, off = Math.abs(dx * z[3] - dy * z[2]) / sp; if (along > 0 && along < sp * 0.6 + 6 && off < p.r + 1.5 && pi < 0) pi = i; });
      if (pi >= 0) { t.st = 'pocket'; t.pk = pi; t.via = 'heading'; push(t, S.P.pockets[pi].x, S.P.pockets[pi].y); } else t.st = 'lost';
    }
  }
  const el = performance.now() - t0; MT.ms = Math.max(MT.ms, el); MT.sum = (MT.sum || 0) + el;
}
// stop following; what each ball did, for naming the balls after the shot
function mtFinish(shot) {
  if (!MT.on) return null; MT.on = false;
  MT.last = MT.tr.filter(t => t.moved).map(t => ({ id: t.id, st: t.st, pk: t.pk, unsure: !!t.unsure, cue: t.cue, path: t.path })); // drawn until the next shot
  if (shot) Object.defineProperty(shot, '_tr', { value: MT.last, configurable: true, enumerable: false }); // for the paths picture (never saved with the session)
  const out = MT.tr.map(t => ({ id: t.id, st: t.st, x: t.st === 'rest' ? t.rx : t.x, y: t.st === 'rest' ? t.ry : t.y, moved: t.moved, pk: t.pk, from: [t.x0, t.y0], cue: t.cue, unsure: !!t.unsure }));
  dbg('paths', { shot: shot && shot.id, frames: MT.n, ms: r1(MT.ms), avg: r1((MT.sum || 0) / Math.max(1, MT.n)), balls: MT.tr.filter(t => t.moved).map(t => ({ id: t.id == null ? '?' : t.id, st: t.st, pk: t.pk, unsure: t.unsure || undefined, path: t.path.length > 30 ? t.path.filter((p, i) => i % Math.ceil(t.path.length / 30) === 0 || i === t.path.length - 1) : t.path })), still: MT.tr.filter(t => !t.moved).map(t => t.id == null ? '?' : t.id) });
  return out;
}
function trackFrame() {
  if (!S.live || !S.cam || !vid.videoWidth || S.phase !== 'run') return;
  if (S.drillMode && S.dr && S.dr.quick) { TR.rec = null; TR.pre = 0; return; } // showing the balls: balls are moved by hand, nothing is a shot
  let now;
  if (VF.on) { if (VF.n === TR.ct) return; TR.ct = VF.n; now = VF.t; } else { if (vid.currentTime === TR.ct) return; TR.ct = vid.currentTime; now = vid.currentTime; }
  const pt = VF.on && VF.pt ? VF.pt : performance.now(); // the same moment on the page clock, to line the microphone up with
  if (!TR.rec && !S.armPos && !MT.on) { TR.pre = 0; TR.hereT = null; return; }
  if (!TR.rec && frozen() && !MT.on) { TR.pre = 0; return; } // no shot starts while the phone is being touched or is swaying
  if (!TR.cam || TR.key !== trKey()) trackSetup();
  TR.cx.drawImage(vid, S.vr.x, S.vr.y, S.vr.w, S.vr.h, 0, 0, TR.w, TR.h); const im = TR.cx.getImageData(0, 0, TR.w, TR.h), rec = TR.rec;
  const excl = (S.armBalls || []).filter(b => b.id !== 0);
  if (!rec && MT.on) { if (!frozen() && (MT.alt = !MT.alt)) { const t1 = performance.now(); mtStep(im, now); lagT('paths', t1); } if (!S.armPos || frozen()) return; }
  if (!rec) {
    if (performance.now() < (S.noShotUntil || 0)) { TR.pre = 0; return; }
    const here = findWhite(im, TR.cam, S.P, S.armPos, 1.3, 0); if (here) { TR.pre = 0; TR.hereT = now; return; }
    // something white near the cue ball but off the cloth, or inside a person (a shirt, a hand) is not the cue ball; V2.3.2:
    // it is looked past (the next white thing out may be the cue ball rolling away), not taken as "no cue ball"
    let skipped = null; const offCloth = t => { const o = t.x < -0.5 || t.y < -0.5 || t.x > S.P.L + 0.5 || t.y > S.P.W + 0.5 || hiddenAt(t); if (o && !skipped) skipped = t; return o; };
    let f = findWhite(im, TR.cam, S.P, S.armPos, 22, 1.3, excl, offCloth);
    if (skipped) dbgOnce('notcue', 2000, 'not_cue', { at: [r1(skipped.x), r1(skipped.y)], next: f ? [r1(f.x), r1(f.y)] : null });
    // first sighting has to be about where a ball leaving the cue's spot could be by now (frames can be skipped while the
    // phone is busy); after the cue ball has been out of sight a while (the player's body over it), 14 inches
    const gap = TR.hereT != null ? now - TR.hereT : 1, lim = gap < 0.3 ? Math.max(9, 4 + 450 * gap) : 14;
    if (f && TR.pre === 0 && Math.hypot(f.x - S.armPos.x, f.y - S.armPos.y) > lim) { dbgOnce('farjump', 2000, 'not_cue', { at: [r1(f.x), r1(f.y)], jump: r1(Math.hypot(f.x - S.armPos.x, f.y - S.armPos.y)) }); f = null; }
    if (f) {
      if (TR.pre === 0) { TR.cand = [now, f.x, f.y]; TR.candPt = pt; TR.pre = 1; }
      else if (Math.hypot(f.x - S.armPos.x, f.y - S.armPos.y) > Math.hypot(TR.cand[1] - S.armPos.x, TR.cand[2] - S.armPos.y) + 0.4) {
        TR.rec = { track: [TR.cand, [now, f.x, f.y]], pts: [TR.candPt, pt], guess: { x: f.x, y: f.y }, last: { x: f.x, y: f.y }, still: 0, lost: 0, start: TR.cand[0], pos0: { ...S.armPos }, before: (S.armBalls || []).slice(), un: (S.armUn || []).slice(), allN: S.armAll || (S.armBalls || []).length, trust: !!S.armTrust };
        // "young": appeared after the table had settled since the last shot, and within 3 s of this one (fingers, a sleeve)
        if (!S.drillMode && S.settleT0) { const tn = performance.now(), young = b => b.id !== 0 && b.since && b.since > S.settleT0 + 300 && tn - b.since < 3000, yb = TR.rec.before.filter(young), yu = TR.rec.un.filter(young);
          if (yb.length || yu.length) { TR.rec.before = TR.rec.before.filter(b => !young(b)); TR.rec.un = TR.rec.un.filter(b => !young(b)); TR.rec.allN = Math.max(TR.rec.before.length, TR.rec.allN - yb.concat(yu).filter(b => !TR.rec.trust || b.since <= (S.tableNT || 0)).length); dbg('young', { ids: yb.map(b => b.id), un: yu.length, at: yb.concat(yu).map(b => [r1(b.x), r1(b.y)]) }); } }
        if (S.watch && FR.bef) { TR.rec.frBef = FR.bef; FR.bef.c._busy = true; } // the last clear picture before this shot, kept with it
        if (S.watch || S.mode === 'play9' || S.mode === 'play8') mtStart(TR.rec, now);
        clipShot();
        S.recording = true; TR.pre = 0; dbg('shot_start', { pos0: [r1(S.armPos.x), r1(S.armPos.y)], first: [r1(f.x), r1(f.y)], ctx: AU.ctx && AU.ctx.state, vf: VF.on }); S.holdT = 0; setStatus('Shot detected. Following the cue ball…');
      } else TR.pre = 0;
    } else TR.pre = 0;
    return;
  }
  const tk = rec.track, n = tk.length, sp = n > 2 ? Math.hypot(tk[n - 1][1] - tk[n - 2][1], tk[n - 1][2] - tk[n - 2][2]) : 4;
  const pred = n > 2 ? { x: tk[n - 1][1] + (tk[n - 1][1] - tk[n - 2][1]) * 0.8, y: tk[n - 1][2] + (tk[n - 1][2] - tk[n - 2][2]) * 0.8 } : rec.guess;
  let f = findWhite(im, TR.cam, S.P, { x: clamp(pred.x, 0, S.P.L), y: clamp(pred.y, 0, S.P.W) }, 4 + sp * 0.9, 0);
  if (f) {
    const dt = Math.max(1 / 120, now - tk[n - 1][0]), hop = Math.hypot(f.x - tk[n - 1][1], f.y - tk[n - 1][2]);
    const off = f.x < -1 || f.y < -1 || f.x > S.P.L + 1 || f.y > S.P.W + 1, nearPk = S.P.pockets.some(pk => Math.hypot(pk.x - f.x, pk.y - f.y) < pk.r + 3);
    if ((off && !nearPk) || hop > 520 * dt + 3) { rec.bad = (rec.bad || 0) + 1; f = null; }
  }
  if (f) { rec.lost = 0; const mv = Math.hypot(f.x - rec.last.x, f.y - rec.last.y); tk.push([now, f.x, f.y]); rec.pts.push(pt);
    if (tk.length >= 5 && rec.hand === undefined) rec.hand = handMoveCheck(rec);
    if (!rec.dinged && !rec.hand && tk.length >= 5 && (rec.bad || 0) * 4 < tk.length && Math.hypot(f.x - rec.pos0.x, f.y - rec.pos0.y) > 3) { rec.dinged = true; ding(); } rec.guess = { x: f.x, y: f.y }; rec.last = { x: f.x, y: f.y }; rec.still = mv < 0.22 ? rec.still + 1 : 0; } else rec.lost++;
  if (MT.on) { const t1 = performance.now(); mtStep(im, now); lagT('paths', t1); }
  if (rec.still > 9 || rec.lost > 7 || now - rec.start > 9) endShot();
}
// Ball in hand (Watch & Learn): the cue ball moved with a hand right on it, slowly, and with no strike click (or very slowly
// when the microphone is off). That is the player placing it, not a shot: no ding, nothing recorded, the target stays.
function handMoveCheck(rec) {
  if (!S.watch) return null;
  const tk = rec.track, n = Math.min(4, tk.length - 1), dt = tk[n][0] - tk[0][0]; if (dt <= 0) return null;
  const v0 = Math.hypot(tk[n][1] - tk[0][1], tk[n][2] - tk[0][2]) / dt, R = S.P.R, p = rec.pos0;
  // the hand has to be on the ball itself (the cue and bridge hand are always near it at address), and the move slow
  if (!hiddenAt(p)) return null;
  const micOk = MIC.on && MIC.n > 0, t0 = (rec.pts || [])[0], strike = micOk && t0 ? micClicks(t0 - 450, t0 + 150).length > 0 : null;
  return (micOk && !strike && v0 < 12) || v0 < 6 ? { v0, strike, mic: micOk } : null;
}
function endShot() {
  const rec = TR.rec; TR.rec = null; S.recording = false; S.armPos = null; S.stable = 0; S.settleT0 = null;
  const free = () => { if (rec.frBef) rec.frBef.c._busy = false; };
  const tk = rec.track, far = Math.max(...tk.map(s => Math.hypot(s[1] - rec.pos0.x, s[2] - rec.pos0.y))), calib = S.mode === 'calib';
  if (!calib && rec.hand) { // the cue ball was moved by hand (ball in hand), not shot
    dbg('hand_move', { from: [r1(rec.pos0.x), r1(rec.pos0.y)], to: [r1(rec.last.x), r1(rec.last.y)], v0: r1(rec.hand.v0), strike: rec.hand.strike, mic: rec.hand.mic });
    if (S.sess) S.sess.hand = (S.sess.hand || 0) + 1; setStatus('Ball in hand. Still watching.'); MT.on = false; clipNoShot(); free(); return;
  }
  dbg('shot_end', { bad: rec.bad || 0, pts: tk.length, far: r1(far), dur: r2(tk[tk.length - 1][0] - tk[0][0]), still: rec.still, lost: rec.lost, end: [r1(tk[tk.length - 1][1]), r1(tk[tk.length - 1][2])], kept: tk.length >= (calib ? 3 : 5) && far >= (calib ? 1.5 : 4) });
  // the drill: the cue ball lost at once in the middle of the table, never seen stopping, and no strike heard = picked up
  // by hand to set up the next shot (it was counted as a shot twice in real8)
  if (S.drillMode && !calib && rec.lost > 7 && rec.still === 0) {
    const last = tk[tk.length - 1], dur = last[0] - tk[0][0], nearPk = S.P.pockets.some(pk => Math.hypot(pk.x - last[1], pk.y - last[2]) < pk.r + 4);
    const t0 = (rec.pts || [])[0], strike = MIC.on && MIC.n > 0 && t0 ? micClicks(t0 - 450, t0 + 150).length > 0 : false;
    if (dur < 0.8 && far < 25 && !nearPk && !strike && !(MT.on && MT.tr.some(t => !t.cue && t.moved))) { dbg('hand_lift', { far: r1(far), dur: r2(dur), end: [r1(last[1]), r1(last[2])] }); setStatus('Ball picked up, not a shot. Still watching.'); MT.on = false; clipNoShot(); free(); return; }
  }
  if (!calib && (rec.bad || 0) >= 3 && (rec.bad || 0) * 2 >= tk.length) { if (S.sess) S.sess.ignored++; dbg('not_shot', { bad: rec.bad, pts: tk.length }); setStatus('That was not the cue ball moving. Still watching.'); MT.on = false; clipNoShot(); free(); return; }
  if (tk.length < (calib ? 3 : 5) || far < (calib ? 1.5 : 4)) { if (S.sess) S.sess.ignored++; setStatus(calib ? 'That was too small to read. Hit a little firmer.' : 'That looked like a nudge, not a shot. Still watching.'); MT.on = false; clipNoShot(); free(); return; }
  const track = tk.map(s => [s[0] - tk[0][0], s[1], s[2]]);
  if (calib) { MT.on = false; calibShot(track, rec.pos0); return; }
  if (S.pend) pendCheck(true);
  if (S.fix) applyFix(rec.pos0, rec); // a real shot from where the cue ball stopped: the last one was legal
  S.snap = null; // the next settled table is the new "before"
  const shot = { id: (S.shotSeq = (S.shotSeq || 0) + 1) };
  S.meas = null; S.scratch = null; finishShot(track, rec.pos0, rec.before, shot); S.awaitAfter = true;
  if (S.watch) { shot.watch = watchShotInfo(rec, track); shot.frBef = rec.frBef || null; FR.bef = null; shot.truth = truthShotStart(); if (S.drillMode) shot.drill = drillShotStart(rec); } // the next "before" picture must be taken after this shot
  // the cue ball has stopped, but the shot is not over until every ball on the table has stopped
  settleWatch(timeout => { if (S.watch) { shot.frAft = frameAfter(); shot.settleTimeout = timeout || undefined; } afterShot(rec.before, { x: tk[tk.length - 1][1], y: tk[tk.length - 1][2], settled: rec.still > 9 }, rec.allN, shot, rec.trust, 0); });
}
// before: the numbered balls before the shot; allN: how many balls were on the table in all, numbered or not
function afterShot(before, end, allN, shot, trust, delay) {
  setTimeout(() => {
    S.awaitAfter = false; const paths = mtFinish(shot); if (!S.live) return; grab();
    const info = { still: STILL.mask ? stillInfo() : undefined }, used = new Set(); let found = detectBalls(imgData(), S.cam, S.P, S.cloth, info);
    recogFound(found); found = dropNotBalls(found, before.map(b => ({ ...b, obs: [0, 0, 0, 0] })), true);
    before = before.filter((b, i, a) => b.id == null || a.findIndex(o => o.id === b.id) === i); // one copy of each number
    const ids = before.map(b => b.id).filter(i => i != null);
    S.occ = info.occ; S.occFrac = info.occFrac || 0;
    // Numbers: a ball that did not move keeps its number, the cue ball is wherever the tracker saw it stop,
    // and only what is left is told apart by colour. This keeps the cue ball and the 9 from swapping places.
    // Watch & Learn: the ball where the tracker saw the cue ball stop IS the cue ball, decided first. A soft straight shot
    // leaves the cue ball right where the object ball was, and the "did not move" rule below gave it the object ball's number.
    // Paths (V2.3.1): each ball followed through the shot names the ball where its path ended. Closest pairs first; two
    // paths ending on the same ball (they touched and could not be told apart) are left to the rules below.
    if (paths) {
      const ends = paths.filter(t => t.id != null && t.moved && t.st !== 'pocket' && t.st !== 'lost' && !t.unsure && (!t.cue || (end && end.settled && Math.hypot(t.x - end.x, t.y - end.y) < 1.5))), pairs = [];
      // (a path never overrules a recognizer that is sure the ball is something else)
      const veto = (t, f) => f.rec && f.rec[t.id] < 0.02 && Math.max(...f.rec.slice(0, 10)) > 0.9;
      for (const t of ends) for (const f of found) { if (f.locked || veto(t, f)) continue; const d = Math.hypot(f.x - t.x, f.y - t.y); if (d < 1.6) pairs.push([d, t, f]); }
      pairs.sort((a, b) => a[0] - b[0]); const ut = new Set(), uf = new Set(), named = [];
      const twice = new Set(); for (const t of ends) if (ends.some(o => o !== t && Math.hypot(o.x - t.x, o.y - t.y) < 1.2)) twice.add(t);
      for (const [, t, f] of pairs) { if (ut.has(t) || uf.has(f) || twice.has(t)) continue; ut.add(t); uf.add(f); f.id = t.id; f.locked = true; f.conf = 0.9; f.path = 1; named.push(t.id); const bp = before.find(b => b.id === t.id); if (bp) used.add(bp); }
      // a ball whose path ended in a pocket went in: nothing else may take its number by colour (unless the count says it is still up)
      const pk = paths.filter(t => t.id != null && t.st === 'pocket').map(t => t.id); if (shot) { shot.pathPk = pk; shot.pathPkAt = {}; for (const t of paths) if (t.id != null && t.st === 'pocket') shot.pathPkAt[t.id] = t.pk; }
      const seenN = found.length + before.filter(b => hiddenAt(b) && !found.some(f => Math.hypot(f.x - b.x, f.y - b.y) < 1.6)).length;
      if (pk.length && (allN || before.length) - seenN >= pk.length) for (const id of pk) { const bp = before.find(b => b.id === id); if (bp) used.add(bp); if (shot) shot.pathGone = (shot.pathGone || []).concat([id]); }
      dbg('path_ids', { named, pocket: pk, twice: [...twice].map(t => t.id), ends: ends.map(t => [t.id, t.st, r1(t.x), r1(t.y)]), pairs: pairs.length });
    }
    // the ball right where the cue tracker saw it stop (within 1.5 in) is the cue ball, unless the recognizer is sure it is not
    if (end && end.settled && before.some(b => b.id === 0) && !found.some(f => f.locked && f.id === 0)) {
      let cf = null, cd = 1.5; for (const f of found) { const d = Math.hypot(f.x - end.x, f.y - end.y); if (d < cd) { cd = d; cf = f; } }
      if (cf && !(cf.rec && cf.rec[0] < 0.02 && Math.max(...cf.rec.slice(1, 10)) > 0.9)) { if (cf.locked) dbg('cue_end', { took: cf.id }); cf.id = 0; cf.locked = true; cf.conf = 0.9; used.add(before.find(b => b.id === 0)); }
    }
    for (const f of found) { if (f.locked) continue; let bp = null, bd = 1.2; for (const b of before) { if (used.has(b)) continue; const d = Math.hypot(b.x - f.x, b.y - f.y); if (d < bd) { bd = d; bp = b; } } if (bp) { used.add(bp); f.id = bp.id; f.locked = true; f.conf = 0.9; } }
    // (V2.3.3: the 5-inch rule that was here is gone: on shot 41 of real9 it named the red 3 the cue ball)
    { const skip = new Set((shot && shot.pathGone) || []), cand = (ids.length ? ids : candIds()).filter(i => !skip.has(i) || found.some(f => f.locked && f.id === i));
      assignIds(found, cand, allSamples(), S.cloth, { recPen: recPen() }); cueCheck(found, cand); evForget(found); evShrink(found.filter(f => f.locked && (f.path || f.id === 0)).map(f => f.id)); }
    // balls we cannot see because the player is in the way are not counted as gone; they are kept until they come into view
    for (const b of before) { if (used.has(b) || b.id == null || found.some(f => f.id === b.id)) continue; if (hiddenAt(b)) found.push({ ...b, hid: true, miss: 0 }); }
    const rules = (S.mode === 'play9' || S.mode === 'play8');
    S.balls = dedupeIds(found); S.cands = []; updHud();
    // the cue ball is nowhere, and the place the tracker last saw it is in plain view: it went in. Remember that even if the
    // player takes it out of the pocket and puts it down before the rest of the table can be read.
    const endPt = end ? { x: end.x, y: end.y } : null;
    const cueGone = ids.includes(0) && endPt && !S.balls.some(f => f.id === 0) && !S.balls.some(f => Math.hypot(f.x - endPt.x, f.y - endPt.y) < 4) && !hiddenAt(endPt);
    dbg('after', { before: dbgBalls(before), found: dbgBalls(S.balls), occ: r2(S.occFrac), end: end && [r1(end.x), r1(end.y), !!end.settled], cueGone });
    const pend = { before, ids, end: endPt, allN: Math.max(allN || 0, before.length), trust: trust !== false, shot, cueGone, seen: new Set(), maxSeen: 0, t0: performance.now() };
    pendNote(pend);
    if (!rules) { shotResult(pend, S.balls.filter(b => !b.miss), true); return; }
    // the player is standing in the way: wait until the table comes into view (each scan fills in more of it)
    if ((S.occFrac > 0.02 || S.balls.some(b => b.hid)) && !pendReady(pend)) { S.pend = pend; dbg('pend', { occ: r2(S.occFrac), hidden: S.balls.filter(b => b.hid).map(b => b.id) }); holdStatus('Shot recorded. Reading the result as the table comes into view…', 0); return; }
    shotResult(pend, S.balls.filter(b => !b.miss), true);
  }, delay == null ? 1100 : delay);
}
// While a result waits, every scan adds what it could see: which numbers showed up anywhere, and the most balls seen at once.
function pendNote(p) {
  const vis = S.balls.filter(b => !b.hid && !b.miss);
  for (const b of vis) if (b.id != null) p.seen.add(b.id);
  p.maxSeen = Math.max(p.maxSeen || 0, vis.length);
}
// Can the result be read now? Yes if every ball from before the shot is in sight, or nothing at all blocks the table.
// While a ball is unaccounted for and part of the table is blocked, it may simply be behind the player: wait.
function pendReady(p) {
  if (S.balls.some(b => b.miss)) return null; // a ball just vanished: give it a moment to settle
  const seen = S.balls.filter(b => !b.hid), ids = new Set(seen.filter(b => b.id != null).map(b => b.id));
  // (only when the ball count is known from a clear look at the table; a number alone can be read wrong)
  if (p.trust && p.ids.every(i => ids.has(i)) && seen.length >= (p.allN || 0)) return 'all balls seen';
  if (S.occFrac <= 0.02 && !S.balls.some(b => b.hid) && S.stable >= 2) return 'clear view';
  return null;
}
// Called on every scan while a result waits; also forced when the next shot is played. Without a clear view by then
// (or after 20 seconds), the result is read from what could be seen, and nothing is called down that might just be hidden.
function pendCheck(force) {
  const p = S.pend; if (!p) return;
  pendNote(p);
  const ready = pendReady(p), why = ready || (force ? 'next shot' : performance.now() - p.t0 > 20000 ? 'timeout' : null);
  if (!why) return;
  S.pend = null; dbg('pend_done', { why, occ: r2(S.occFrac) }); shotResult(p, S.balls.filter(b => !b.miss), !!ready);
}
// Work out what dropped. A ball only counts as down if the number of balls on the table really went down: a number we
// cannot find while an unnamed ball sits on the table is that unnamed ball, not a pocketed one.
// clear = the whole table could be read. Otherwise only what is certain is called: a number never seen since the shot,
// whose last known spot is in plain view, and only as many of those as the ball count allows.
function shotResult(p, now, clear) {
  const { before, ids, end } = p, nowIds = new Set(now.filter(b => b.id != null).map(b => b.id));
  S.lastBefore = before.filter(b => b.id != null).map(b => ({ id: b.id, x: b.x, y: b.y }));
  const nowN = clear ? now.length : Math.max(p.maxSeen || 0, now.length);
  let dropN = Math.max(0, (p.allN || before.length) - nowN);
  let missing = [...new Set(ids.filter(i => !nowIds.has(i) && !(p.seen && !clear && p.seen.has(i))))];
  if (!clear) missing = missing.filter(i => { const b = i === 0 && end ? end : before.find(o => o.id === i); return b && !hiddenAt(b); });
  // the cue ball went in and was already put back: still a scratch, and it counts as one ball down
  if (p.cueGone && !missing.includes(0)) { missing.push(0); if (nowIds.has(0)) dropN++; }
  // a ball seen rolling into a pocket (its path ended there) and not on the table now is down, even when the ball count
  // could not show it (part of the table was blocked when the count was taken)
  const pp = ((p.shot && p.shot.pathPk) || []).filter(i => missing.includes(i));
  if (pp.length > dropN && (!clear || !p.trust || (p.allN || 0) < nowN)) { dbg('path_drop', { ids: pp, dropN }); dropN = pp.length; }
  let gone = missing, unsure = 0;
  if (missing.length > dropN) {
    // more numbers missing than balls missing: keep the ones most likely to have dropped (closest to a pocket before the shot)
    const pk = id => { const b = id === 0 && end ? end : before.find(o => o.id === id); return b ? Math.min(...S.P.pockets.map(q => Math.hypot(q.x - b.x, q.y - b.y))) : 99; };
    gone = missing.slice().sort((a, b) => (b === 0 && p.cueGone) - (a === 0 && p.cueGone) || pp.includes(b) - pp.includes(a) || pk(a) - pk(b)).slice(0, dropN);
  } else if (missing.length < dropN && clear) unsure = dropN - missing.length; // a ball dropped but its number was not read
  if (!clear) dropN = gone.length;
  let msg;
  if (dropN <= 0) msg = clear ? 'No ball dropped.' : 'No ball dropped that could be seen (part of the table was blocked).';
  else {
    const objs = gone.filter(i => i !== 0), parts = objs.map(ballName);
    if (unsure) parts.push(unsure + ' ball' + (unsure > 1 ? 's' : '') + ' not read by number');
    msg = (parts.length ? 'Off the table: ' + parts.join(', ') + '.' : '') + (gone.includes(0) ? (parts.length ? ' ' : '') + 'The cue ball went in (scratch).' : '');
  }
  S.lastOutcome = msg;
  if (S.watch) { // Watch & Learn: no rules, no verdicts; write down what happened and what it teaches
    const doubt = dropN >= 3 && (p.allN || 0) < 9;
    if (S.tableN != null && !doubt) S.tableN = Math.max(0, S.tableN - dropN + (p.cueGone && nowIds.has(0) ? 1 : 0));
    dbg('result', { clear, dropN, allN: p.allN, now: nowN, missing, gone, unsure, cueGone: !!p.cueGone, doubt: doubt || undefined });
    watchResult(p, now, { gone, unsure, dropN, clear, doubt }); return;
  }
  // three or more balls down on one shot that is not the break is almost always a misread table: say so, do not score it
  if ((S.mode === 'play9' || S.mode === 'play8') && dropN >= 3 && (p.allN || 0) < (S.mode === 'play9' ? 9 : 15)) {
    dbg('result', { clear, dropN, allN: p.allN, now: nowN, missing, gone, unsure, doubt: true });
    holdStatus('That result did not look right (' + dropN + ' balls at once), so it was not counted.'); S.lastOutcome = '';
    if (S.sess) S.sess.shots.push({ t: Date.now(), made: [], doubt: true, scratch: false, mph: p.shot && p.shot.meas ? +(p.shot.meas.v0 / MPH).toFixed(1) : null, first: null, low: null });
    dong(); return;
  }
  if (S.tableN != null) S.tableN = Math.max(0, S.tableN - dropN + (p.cueGone && nowIds.has(0) ? 1 : 0));
  dbg('result', { clear, dropN, allN: p.allN, now: nowN, missing, gone, unsure, cueGone: !!p.cueGone, msg });
  if (S.mode === 'train' && S.drill && !S.drillLogged) {
    const made = before.length >= 2 && now.length === 1 && dropN >= 1; S.drillLogged = true;
    recordDrill(made, made ? undefined : (now.length === 0 ? 'scratch' : 'missed')); setTimeout(() => { if (S.mode === 'train') nextDrill(); }, 2200);
  }
  const rules = (S.mode === 'play9' || S.mode === 'play8');
  if (!rules) { holdStatus(msg + ' Reset the table for the next shot.'); dong(); return; }
  // cue ball gone: say so, and work out where to put it (ball in hand), unless it is already back on the table
  const scratch = gone.includes(0);
  if (scratch && !nowIds.has(0)) { const place = bestCuePlacement(now.filter(b => b.id != null && b.id >= 1)); S.scratch = { t: Date.now(), place }; }
  // give the shot reading a moment to finish, then judge the shot by the rules of the game
  const shot = p.shot || {}, t0 = performance.now(), wait = () => {
    if (!S.live) return; if (!shot.meas && !shot.failed && performance.now() - t0 < 3500) { setTimeout(wait, 150); return; }
    let res = shot.meas && shot.meas.fit && shot.meas.fit.res; if (res && (res.firstHit === 0 || (res.firstHit != null && !ids.includes(res.firstHit)))) res = { ...res, firstHit: null };
    let j = judgeShot(before, gone, res && res.firstHit != null ? res : null);
    // a ball went down but its number was not read: that is still a ball down (no "nothing dropped", no "no rail" foul)
    if (unsure && j && !gone.some(i => i >= 1)) j = j.replace(/Foul: after contact a ball has to drop or reach a rail\.\s*Ball in hand for the next shot\.\s*/, '').replace(/,? nothing dropped\. Turn passes\./, '.').trim() + ' A ball dropped (its number was not read). You shoot again.';
    if (!clear && j) j += ' (Part of the table was blocked.)';
    dbg('judge', { j, first: res ? res.firstHit : null, rail: res ? res.railAfter : null, mph: shot.meas ? r1(shot.meas.v0 / MPH) : null, waited: r1((performance.now() - t0) / 1000) });
    S.lastOutcome = j || msg; holdStatus(j || msg);
    const made = gone.filter(i => i >= 1), foul = j && /Foul|Scratch/.test(j); for (const i of made) if (!S.gone.includes(i) && !(foul && i === 9 && S.game === '9ball')) S.gone.push(i);
    for (let k = 0; k < unsure; k++) made.push('?');
    if (S.sess) { const m = shot.meas; S.sess.shots.push({ t: Date.now(), made, scratch: scratch, partial: !clear || undefined, unseen: shot.unseen || undefined, mph: m ? +(m.v0 / MPH).toFixed(1) : null, first: res && res.firstHit != null ? res.firstHit : null, low: Math.min(...before.filter(b => b.id >= 1).map(b => b.id)) }); }
    // remember what to check when the next shot starts: if the cue ball is still where it stopped (no ball in hand), the
    // shot was legal, so the ball hit first was really the lowest one
    S.fix = null;
    if (S.game === '9ball' && res && res.firstHit != null && !scratch && S.sess) {
      const low = Math.min(...before.filter(b => b.id >= 1).map(b => b.id)), cueNow = now.find(b => b.id === 0);
      if (isFinite(low) && res.firstHit !== low && cueNow) S.fix = { hit: res.firstHit, low, cue: { x: cueNow.x, y: cueNow.y }, idx: S.sess.shots.length - 1, t: Date.now() };
    }
    dong();
  }; wait();
}
// The next shot has started from pos0. Same spot the cue ball stopped on last time: no ball in hand, so the last shot was a
// legal one, and the ball the app called `hit` was really `low`. Swap those two numbers everywhere, fix the last result,
// and keep both balls' looks as learned samples. Cue ball picked up and placed elsewhere: it was a foul, nothing changes.
function applyFix(pos0, rec) {
  const f = S.fix; S.fix = null; if (!f) return;
  const d = Math.hypot(pos0.x - f.cue.x, pos0.y - f.cue.y);
  if (d > 4) { dbg('fix_skip', { why: 'ball in hand', d: r1(d) }); return; }
  const sw = id => id === f.hit ? f.low : id === f.low ? f.hit : id;
  for (const b of S.balls) { const o = b.id; b.id = sw(b.id); if (o !== b.id && b.feat) addSample(b, b.id); }
  for (const list of [S.armBalls, rec && rec.before]) if (list) for (const b of list) b.id = sw(b.id);
  if (S.gone) S.gone = S.gone.map(sw);
  const sh = S.sess && S.sess.shots[f.idx];
  if (sh) { sh.made = sh.made.map(i => typeof i === 'number' ? sw(i) : i); sh.first = f.low; sh.fixed = true; }
  dbg('fix', { hit: f.hit, low: f.low, d: r1(d) });
  toast('Learned: the ball you hit was the ' + f.low + ', not the ' + f.hit + '. Fixed.');
}
// show a message and keep the regular status lines from replacing it for a few seconds (0 = until the next result)
function holdStatus(t, ms) { setStatus(t); S.holdT = ms === 0 ? Infinity : performance.now() + (ms || 5000); }
// Ball in hand: the spot on the table where the cue ball has the easiest shot at the ball that has to be hit next.
function bestCuePlacement(balls) {
  const P = S.P, R = P.R, targets = legalTargets(balls.map(b => b.id), S.game, S.group); if (!targets.length) return null;
  let best = null;
  for (let x = R + 2; x <= P.L - R - 2; x += 2) for (let y = R + 2; y <= P.W - R - 2; y += 2) {
    if (balls.some(b => Math.hypot(b.x - x, b.y - y) < 2 * R + 0.5)) continue;
    // a ball right on top of the object ball leaves no room to stroke: want at least about nine inches
    if (targets.some(t => { const tb = balls.find(b => b.id === t); return tb && Math.hypot(tb.x - x, tb.y - y) < 9; })) continue;
    const e = bestEase(balls.concat([{ id: 0, x, y }]), targets, P);
    if (!best || e > best.e) best = { x, y, e };
  }
  return best;
}
// What the rules say about the shot that was just played. 9-ball: the first ball the cue ball touches has to be the lowest
// number on the table, and after that a ball must drop or something must reach a rail, or it is a foul. A foul gives the
// next player the cue ball anywhere. Dropping the 9 on a legal shot wins, on a foul it goes back on the foot spot.
function judgeShot(before, gone, res) {
  const ids = before.filter(b => b.id >= 1).map(b => b.id), cfg = cfgNow(), legalArr = legalTargets(ids, cfg.game, cfg.group);
  if (!legalArr.length) return null;
  const ctx = makeCtx(cfg, ids, new Set(legalArr)), known = !!res;
  const out = evalResult({ pocketed: gone.map(id => ({ id })), firstHit: known ? res.firstHit : legalArr[0], railAfter: known ? res.railAfter : true, final: [] }, ctx);
  const nums = gone.filter(i => i >= 1), parts = [];
  if (S.game === '9ball') {
    if (out.foul) {
      if (out.notes.includes('scratch')) parts.push('Scratch.');
      if (out.notes.includes('no contact')) parts.push('Foul: the cue ball hit nothing.');
      if (out.notes.includes('wrong ball first')) parts.push('Foul: the ' + res.firstHit + ' was hit first, the lowest ball was the ' + legalArr[0] + '.');
      if (out.notes.includes('no rail')) parts.push('Foul: after contact a ball has to drop or reach a rail.');
      parts.push('Ball in hand for the next shot.');
      if (nums.includes(9)) parts.push('The 9 went down on a foul, so put it back on the foot spot.');
    } else if (out.win) parts.push('Legal hit on the ' + legalArr[0] + ' and the 9 is down. That wins the game.');
    else if (nums.length) parts.push('Legal. Down: ' + nums.join(', ') + '. You shoot again.' + (legalArr[0] ? '' : ''));
    else parts.push('Legal hit on the ' + legalArr[0] + ', nothing dropped. Turn passes.');
    if (!known) parts.push('(Which ball was hit first could not be read, so that part is assumed legal.)');
  } else {
    if (out.lose) parts.push('The 8 went down too early or on a foul. That loses the game.');
    else if (out.foul) { if (out.notes.includes('scratch')) parts.push('Scratch.'); if (out.notes.includes('wrong ball first')) parts.push('Foul: wrong ball first.'); if (out.notes.includes('no contact')) parts.push('Foul: the cue ball hit nothing.'); if (out.notes.includes('no rail')) parts.push('Foul: no rail after contact.'); parts.push('Ball in hand for the next shot.'); }
    else if (out.win) parts.push('Legal, and the 8 is down. That wins the game.');
    else if (out.pots.length) parts.push('Legal. Down: ' + out.pots.join(', ') + '. You shoot again.');
    else parts.push('Legal, nothing dropped. Turn passes.');
  }
  return parts.join(' ');
}
function finishShot(track, pos0, before, shot) {
  const an = analyzeTrack({ x: pos0.x, y: pos0.y }, track);
  if (!an) { if (shot) shot.failed = true; setStatus('Could not measure that shot. Keep the camera still with the whole table in view.'); return; }
  const balls = before.slice(), planned = S.cands[S.sel], gen = fitGen({ balls }, an, S.P); setStatus('Reading your shot…');
  const tick = () => {
    const end = performance.now() + 14; let r; do { r = gen.next(); } while (!r.done && performance.now() < end);
    if (!r.done) { setTimeout(tick, 0); return; }
    const fit = r.value; fit.res = simulate(balls, fit.shot, S.P, { record: true, only: new Set([0]), sampleDt: 0.03 });
    const m = S.meas = { path: track.map(s => [s[0], s[1], s[2]]), dir: an.dir, v0: an.v0, fit, planned: planned ? { text: candText(planned), angle: planned.shot.angle, level: planned.level } : null };
    if (shot) shot.meas = m;
    S.history.push({ t: Date.now(), kind: 'shot', mph: +(fit.speed / MPH).toFixed(1), a: fit.a, b: fit.b }); save();
    const lv = levelOfSpeed(an.v0); let cmp = '';
    if (m.planned) { let dd = (m.dir - m.planned.angle) / D2R; dd = ((dd + 540) % 360) - 180; cmp = '<p>Aim: ' + (Math.abs(dd) < 0.4 ? 'right on the line.' : Math.abs(dd).toFixed(1) + '° ' + (dd > 0 ? 'left' : 'right') + ' of the plan.') + (m.planned.level ? ' Planned strength ' + m.planned.level + '.' : '') + '</p>'; }
    // the shot read (strength, speed, spin, aim against the plan) is kept, not shown: it belongs with the saved shot
    // video, planned for later (user, Oct 11). For now it goes into the debug log only.
    dbg('shot_read', { level: r1(lv), mph: r1(an.v0 / MPH), spin: spinWords(fit), aim: cmp.replace(/<[^>]+>/g, '') || null });
  };
  setTimeout(tick, 0);
}

// ---------- strength and table calibration ----------
const CAL_STEPS = [
  { L: 1, n: 5, txt: 'Barely moving. A touch, the ball rolls a few inches. Aim straight down the table along the dashed line.' },
  { L: 3, n: 5, txt: 'Soft, a controlled safety speed. Straight down the dashed line.' },
  { L: 5, n: 5, txt: 'Medium. The ball should travel about half the table. Straight down the dashed line.' },
  { L: 7, n: 5, txt: 'Firm, with pace. Straight down the dashed line.' },
  { L: 10, n: 6, txt: 'Your hardest break. Rack the balls and break like you mean it.' },
];
function showCalCard() {
  const cal = S.cal; if (!cal) return;
  if (cal.done) return;
  const st = CAL_STEPS[cal.step], got = cal.counts[st.L] || 0, last = cal.shots[cal.shots.length - 1];
  showCard('<h3>Strength ' + st.L + ' · shot ' + Math.min(got + 1, st.n) + ' of ' + st.n + '</h3><p>' + st.txt + '</p><div class="dots">' + Array.from({ length: st.n }, (_, i) => '<i class="' + (i < got ? 'on' : '') + '"></i>').join('') + '</div><p style="font:500 12px var(--f-mono)">' + (last ? 'Last: strength ' + last.L + ' read as ' + (last.v0 / MPH).toFixed(1) + ' mph' : 'Place the cue ball, wait for the green status, then hit.') + '</p><div class="row"><button class="btn" data-act="calUndo">Undo last</button><button class="btn" data-act="calSkip">Skip level</button><button class="btn primary" data-act="calFinish">Finish now</button></div>');
}
function calibShot(track, pos0) {
  const an = analyzeTrack({ x: pos0.x, y: pos0.y }, track), st = CAL_STEPS[S.cal.step];
  if (!an) { setStatus('Could not read that one. Hit again.'); return; }
  const axis = pos0.x < S.P.L / 2 ? 0 : Math.PI; let aim = null;
  if (st.L >= 3 && st.L <= 7) { aim = ((an.dir - axis) / D2R + 540) % 360 - 180; }
  S.cal.shots.push({ L: st.L, v0: an.v0, dir: an.dir, aim, pos0, track });
  S.cal.counts[st.L] = (S.cal.counts[st.L] || 0) + 1;
  if (S.cal.counts[st.L] >= st.n) calNext(); else showCalCard();
}
function calUndo() { const cal = S.cal; if (!cal || !cal.shots.length) return; const s = cal.shots.pop(); cal.counts[s.L]--; const i = CAL_STEPS.findIndex(x => x.L === s.L); cal.step = i; showCalCard(); }
function calNext() { const cal = S.cal; if (cal.step >= CAL_STEPS.length - 1) { finishCalib(); return; } cal.step++; showCalCard(); }
function finishCalib() {
  const cal = S.cal; if (!cal) return; cal.done = true; S.armPos = null;
  const by = {}; for (const s of cal.shots) (by[s.L] = by[s.L] || []).push(s.v0 / MPH);
  const lines = [], rel = [];
  for (const L of Object.keys(by)) {
    const a = by[L]; if (a.length < 2) continue; const mean = a.reduce((x, y) => x + y, 0) / a.length, sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / a.length);
    S.anchors[L] = mean; rel.push(sd / mean); lines.push('<li>Strength ' + L + ' = ' + mean.toFixed(1) + ' mph (±' + Math.round(100 * sd / mean) + '%)</li>');
  }
  if (rel.length) S.speedSd = clamp(rel.reduce((x, y) => x + y, 0) / rel.length, 0.04, 0.2);
  const aims = cal.shots.filter(s => s.aim !== null).map(s => s.aim);
  if (aims.length >= 4) { const m = aims.reduce((x, y) => x + y, 0) / aims.length, sd = Math.sqrt(aims.reduce((x, y) => x + (y - m) ** 2, 0) / aims.length); S.aimSd = sd; S.skill = clamp(sd * 1.2, 0.15, 0.9); lines.push('<li>Your aim scatter is about ±' + sd.toFixed(2) + '°</li>'); }
  save(); setStatus('Fitting your cloth…');
  const fitShots = cal.shots.filter(s => s.L <= 7 && s.track.length >= 6).map(s => ({ pos0: s.pos0, dir: s.dir, v0: s.v0, track: s.track }));
  const done = extra => { showCard('<h3>Calibration saved</h3><ul>' + lines.join('') + (extra || '') + '</ul><p>Your 1 to 10 scale now means these speeds, and the planner uses your own consistency.</p><div class="row"><button class="btn primary" data-act="home">Done</button><button class="btn" data-act="calRedo">Redo</button></div>'); setStatus(''); };
  if (fitShots.length >= 3) {
    const gen = fitTableGen(fitShots, { ft: S.ft }), tick = () => {
      const end = performance.now() + 14; let r; do { r = gen.next(); } while (!r.done && performance.now() < end);
      if (!r.done) { setTimeout(tick, 0); return; }
      const f = r.value; S.phys = { rollDec: f.rollDec, eRail: f.eRail }; S.P = mkP(); save(); done('<li>Cloth roll-out and cushion bounce measured</li>');
    }; setTimeout(tick, 0);
  } else done();
}

// ---------- menu and wiring ----------
function renderMenu() {
  seg($('#mFt'), [[7, '7 ft'], [8, '8 ft'], [9, '9 ft']], S.ft, v => { setFt(v); });
  seg($('#mGame'), [['9ball', '9-ball'], ['8ball', '8-ball']], S.game, v => { S.game = v; S.mode = v === '9ball' ? 'play9' : 'play8'; $('#modeLbl').textContent = MODE_LBL[S.mode]; S.cands = []; save(); renderMenu(); updHud(); });
  seg($('#mGroup'), [['open', 'Open'], ['solids', 'Solids'], ['stripes', 'Stripes']], S.group, v => { S.group = v; S.cands = []; save(); renderMenu(); updHud(); });
  const play = S.mode === 'play9' || S.mode === 'play8';
  $('#mGameRow').hidden = true; $('#mGroupRow').hidden = true; // 8-ball is gone for now
  $('#mMicRow').hidden = !S.watch;
  seg($('#mMic'), [[true, 'On'], [false, 'Off']], S.micOn, v => { S.micOn = v; save(); renderMenu(); if (v && S.watch && S.live) micStart(); else if (!v) micStop(); });
  $('#skill').value = S.skill; $('#skillVal').textContent = '±' + S.skill.toFixed(2) + '°'; $('#lens').value = S.lens; $('#lensVal').textContent = S.lens.toFixed(2);
  seg($('#mPocket'), [['pro', 'Pro'], ['amateur', 'Amateur'], ['bar', 'Bar box']], S.pocket, v => { S.pocket = v; S.P = mkP(); S.cands = []; save(); renderMenu(); updHud(); });
  seg($('#mTags'), [[false, 'Off'], [true, 'On']], S.tags, v => { S.tags = v; save(); renderMenu(); });
  seg($('#mClips'), [[true, 'On'], [false, 'Off']], S.clips !== false, v => { S.clips = v; if (!v) clipStop(null); else CLIP.off = false; save(); renderMenu(); });
  seg($('#mTrails'), [[true, 'On'], [false, 'Off']], S.trails !== false, v => { S.trails = v; save(); renderMenu(); });
  seg($('#mSound'), [[true, 'On'], [false, 'Off']], S.sound, v => { S.sound = v; save(); renderMenu(); if (v) { audioInit(); ding(); setTimeout(dong, 450); } });
  $('#mView').textContent = S.view === 'photo' ? 'Show table map' : 'Show camera';
}
function goHome() {
  clipStop(null); S.geo = null; S.geoPending = false; S.modeTok = (S.modeTok || 0) + 1; resetShotState(); micStop(); S.touchDown = false;
  if (S.sess) { dbg('end', { shots: S.sess.shots.length }); dbgPersist(); }
  if (S.sess && S.sess.shots.length) { S.lastSess = { ...S.sess, t1: Date.now() }; save(); renderHome(); }
  S.sess = null; S.scratch = null; $('#endFab').hidden = true; $('#stats').hidden = true;
  S.learn = null; document.body.classList.remove('learnmode');
  vdim = ''; stopCamera(); hideCard(); $('#cam').hidden = true; $('#home').hidden = false; $('#menu').hidden = true; $('#sheet').hidden = true; S.phase = 'boot'; S.mode = null; document.body.classList.remove('playrun'); S.teach = null; S.cands = []; TR.rec = null; TR.pre = 0; S.recording = false; S.armPos = null; S.drill = null; S.meas = null; S.watch = false; S.drillMode = false; S.dr = null; FR.sess = null;
  try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen(); } catch (e) { } renderHome();
}
let toastT = 0;
function toast(t) { dbg('toast', { s: t }); const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { e.hidden = true; }, 1800); }
$$('.mode').forEach(b => b.onclick = () => { if (b.dataset.inert) { toast(b.dataset.inert); return; } startMode(b.dataset.mode); });
$$('[data-inert]:not(.mode)').forEach(b => b.addEventListener('click', () => toast(b.dataset.inert)));
$('#aggr').onclick = () => toast('Safe to Bold is not running yet');
$('#homeBtn').onclick = goHome;
$('#rotBack').onclick = goHome;
$('#menuBtn').onclick = () => { renderMenu(); $('#menu').hidden = false; };
$('#mClose').onclick = () => { $('#menu').hidden = true; };
// a pop-up closes when you tap outside it (a tap that starts and ends on the dimmed area around it); taps inside work as usual
for (const [id, close] of [['menu', () => { $('#menu').hidden = true; }], ['sheet', () => $('#pickCancel').click()], ['stats', () => { $('#stats').hidden = true; }]]) {
  const ov = $('#' + id); let downOut = false;
  ov.addEventListener('pointerdown', e => { downOut = e.target === ov; });
  ov.addEventListener('click', e => { if (e.target === ov && downOut) { downOut = false; close(); } });
}
$('#mStop').onclick = goHome;
$('#planBtn').onclick = () => { S.cands = []; S.stable = Math.max(S.stable, 3); updHud(); liveScan(true); if (!S.planning) planNow(); };
$('#prevC').onclick = () => { if (S.cands.length) selectCand((S.sel + S.cands.length - 1) % S.cands.length); };
$('#nextC').onclick = () => { if (S.cands.length) selectCand((S.sel + 1) % S.cands.length); };
$('#skill').oninput = e => { S.skill = +e.target.value; $('#skillVal').textContent = '±' + S.skill.toFixed(2) + '°'; save(); };
$('#lens').oninput = e => { S.lens = +e.target.value; $('#lensVal').textContent = S.lens.toFixed(2); if (S.src && S.quad) rebuildCam(); save(); };
$('#mView').onclick = () => { S.view = S.view === 'photo' ? 'table' : 'photo'; zoneCache = null; renderMenu(); };
$('#mRecal').onclick = () => { $('#menu').hidden = true; S.quad = null; S.quadN = null; S.cam = null; beginAuto(); };
$('#mTeach').onclick = () => { $('#menu').hidden = true; teachStart(); };
$('#mGeo').onclick = () => { $('#menu').hidden = true; geoStart(); };
$('#mForget').onclick = () => { S.samples = []; save(); setStatus('Learned ball appearances cleared.'); };
window.addEventListener('resize', () => { zoneCache = null; });
renderHome();
// test hook
setInterval(() => { if (S.sess) dbgPersist(); }, 30000);
window.__chalk = { CLIP, clipStart, clipStop, clipTick, clipShot, clipFps, flagLast, drawTrails, trailsDraw, cueCheck, geoTargets, geoErr, geoMatch, geoStart, geoMeasure, geoDone, maskRecheck, drillUnseen, inHalf, nearLow, lowestUp, drillLabel: (f) => drillLabel(f), MT, mtStart, mtStep, mtFinish, mtSetup, EV, evAdd, recheckNames, evForget, recogFound, dropNotBalls, quickTick, quickNew, quickSetSpot, quickStatus, quickToWatch, setProfile, profSnap, zoomToFit, edgeNear, setCamZoom, camZoomCaps, finishAuto, assignIds, allSamples, recPen, labelIds, drillPlan, drillCands, drillResult, drillShotStart, drillLabel, drillStatus, drillSetSpot, drillSummary, pocketWord, LAG, unseenCheck, LEARNED, handMoveCheck, frozen, WOB, truthLook, truthShotStart, throwOutLast, watchResult, MIC, micPoll, watchShotInfo, makeZip, FR, settleWatch, DBG, dbgText, saveDebug, AU, ding, dong, audioInit, setZoom, vnFromSrc, srcFromVn, focalPx, ppPx, runDiamonds, bestCuePlacement, afterShot, eliminate, VF, judgeShot, spotHasBall, get MAP() { return MAP; }, stage, pickBall, openPicker, refDiff, mkP, autoSize, beginAuto, quadLooksRight, enterRun, S, planNow, liveScan, render, rebuildCam, TR, vid, startMode, speedOfLevel, levelOfSpeed, levelTable };
