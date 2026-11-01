// ===== V3 APP =====
// Watch: find the table, then every look runs the ball finder on the table strip, maps the balls to table inches and
// hands them to the tracker (src/track.js), which keeps each ball's name and calls the shots. The screen shows what the
// tracker knows; a tap on a ball renames it. Everything is written to the debug log for Save debug.
const VERSION = 'V3.1.3';
const $ = s => document.querySelector(s);
const KEY = 'chalkline.v3', BASE = new URL('./', location.href).href;
const BALLCOL = ['#f4f1e8', '#e8c11d', '#2a52c9', '#d03a2f', '#6a3fa0', '#e8782a', '#1f8a4c', '#8c2433', '#16181b', '#e8c11d'];
// focal length / longer picture side of the main camera at 1x, in video: measured from the owner's tables (Oct 29: the
// outlines of four sideways sessions come out exactly 2 to 1 at 0.71-0.72; the V2 value 0.86 made them 1.7 to 1)
const LENS = 0.72;
const SMALL = 800;          // the table is looked for on a copy of the picture this many pixels across
const BALL_PX_MAX = 23;     // the finder learned balls up to about this radius: the table strip is not enlarged past it
const A = { ft: 7, engine: 'cpu', live: false, stream: null, phase: 'home', W: 0, H: 0, quad: null, rot: 0, cam: null, P: null, tk: null, box: null, kmax: 1.5, shape: null,
  frame: document.createElement('canvas'), small: document.createElement('canvas'), fctx: null, looks: 0, errs: 0, nShots: 0, sess: null, lastSess: null,
  pics: new Map(), taps: [], stillPic: null, stillPicT: 0, pick: null, timing: [], camInfo: null, man: null, cand: null };
const r1 = v => Math.round(v * 10) / 10, r2 = v => Math.round(v * 100) / 100, sleep = ms => new Promise(r => setTimeout(r, ms));
const numName = n => n === 0 ? 'cue ball' : n == null ? 'unknown ball' : n + ' ball';

// ---------- settings and the last session ----------
function save() { try { localStorage.setItem(KEY, JSON.stringify({ ft: A.ft, lastSess: A.lastSess, engine: A.engine })); } catch (e) { } }
try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d) { if ([7, 8, 9].includes(d.ft)) A.ft = d.ft; A.lastSess = d.lastSess || null; if (d.engine === 'gpu') A.engine = 'gpu'; } } catch (e) { }
// ---------- crash notes: a few words in the phone's storage after every step, so if Safari closes the page we know where ----------
// (V3.0 on the owner's iPhone: Safari closed the page seconds after the ball finder started on the graphics chip; the same
// happened on the check page, while the processor ran 188 looks without trouble. So the processor is the default now.)
const CRUMB = KEY + '.crumb';
function crumb(step, extra) {
  try { localStorage.setItem(CRUMB, JSON.stringify(Object.assign({ running: A.live, step, at: new Date().toISOString(), version: VERSION, engine: DET.ep, threads: DET.threads(), shape: A.shape, looks: A.looks,
    phase: A.tk ? A.tk.S.phase : null, balls: A.tk ? A.tk.balls().length : 0, ms: A.timing.slice(-5).map(Math.round), secs: Math.round((Date.now() - DBG.t0) / 1000) }, extra || {}))); } catch (e) { }
}
function endCrumb() { try { const c = JSON.parse(localStorage.getItem(CRUMB) || 'null'); if (c && c.running) { c.running = false; localStorage.setItem(CRUMB, JSON.stringify(c)); } } catch (e) { } }
let CRASH = null; try { const c = JSON.parse(localStorage.getItem(CRUMB) || 'null'); if (c && c.running && c.step !== 'hidden') CRASH = c; } catch (e) { }
if (CRASH && CRASH.engine === 'webgpu') { A.engine = 'cpu'; save(); } // it died on the graphics chip: back to the processor
window.addEventListener('pagehide', endCrumb);

// ---------- debug log: kept for the session, stored every few seconds so a crash does not lose it ----------
const DBG = { t0: Date.now(), ev: [], looks: [], drop: 0 };
function dbg(k, d) { DBG.ev.push(Object.assign({ t: Date.now() - DBG.t0, k }, d)); if (DBG.ev.length > 30000) { DBG.ev.splice(0, 3000); DBG.drop += 3000; } }
function dbgPersist() { try { localStorage.setItem(KEY + '.dbg', JSON.stringify({ t0: DBG.t0, ev: DBG.ev.slice(-2500), looks: DBG.looks.slice(-1500), drop: DBG.drop, hdr: header(), tracker: A.tk ? A.tk.S.events.slice(-1500) : null, shots: A.tk ? A.tk.S.shots.map(shotRow) : null })); } catch (e) { } }
let PREV = null; try { PREV = JSON.parse(localStorage.getItem(KEY + '.dbg') || 'null'); } catch (e) { }
window.addEventListener('error', e => dbg('error', { m: String(e.message || e).slice(0, 200), at: (e.filename || '').split('/').pop() + ':' + e.lineno }));
window.addEventListener('unhandledrejection', e => dbg('error', { m: 'promise: ' + String(e.reason && e.reason.message || e.reason).slice(0, 200) }));
document.addEventListener('visibilitychange', () => { dbg('vis', { s: document.visibilityState }); if (A.live) crumb(document.hidden ? 'hidden' : 'visible'); if (document.hidden) { dbgPersist(); if (A.sess) logStore(); } else if (A.live) wakeLock(); });
setInterval(() => { if (A.live) dbgPersist(); }, 10000);
// the whole log into the phone's storage every 20 s (and when the page is hidden or the session ends)
function logObject() {
  return { header: header(), events: DBG.ev, dropped: DBG.drop, tracker: A.tk ? A.tk.S.events : null, shots: A.tk ? A.tk.S.shots.map(shotRow) : [], looksFormat: ['ms', 'findMs', 'readMs', 'n', 'phase', '[x, y, num, kind, score, pNum, [num2, p2]]'], looks: DBG.looks,
    taps: A.taps.map(({ png, ...r }) => r), previous: PREV && PREV.t0 !== DBG.t0 ? PREV : null, crash: CRASH || (() => { try { return JSON.parse(localStorage.getItem(CRUMB) || 'null'); } catch (e) { return null; } })() };
}
function logStore() { try { return STORE.put(DBG.t0, 'log.json', new TextEncoder().encode(JSON.stringify(logObject()))); } catch (e) { return null; } }
setInterval(() => { if (A.live) logStore(); }, 20000);
// ---------- the session kept on the phone as it goes (V3.1.0; Oct 31: the battery died after 9 racks and only a small
// backup of the log survived, no pictures). Every picture, clip and the log go into the browser's own storage (IndexedDB)
// as soon as they are made, so Save debug gives the whole session even after Safari closed the page. Only the latest two
// sessions are kept. If the storage is not there, the pictures still live in memory as before.
const STORE = (() => {
  let db = null, dead = typeof indexedDB === 'undefined';
  const open = () => db ? Promise.resolve(db) : new Promise((res, rej) => {
    const r = indexedDB.open('chalkline-v3', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('files'); r.result.createObjectStore('sessions', { keyPath: 'sid' }); };
    r.onsuccess = () => { db = r.result; res(db); }; r.onerror = () => rej(r.error);
  });
  // one transaction: fn gets the object stores and returns a request (its result is the answer) or { value }
  const run = (names, mode, fn) => dead ? Promise.resolve(null) : open().then(d => new Promise((res, rej) => {
    const t = d.transaction(names, mode), q = fn(...[].concat(names).map(n => t.objectStore(n)));
    t.oncomplete = () => res(q instanceof IDBRequest ? q.result : q ? q.value : null); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  })).catch(e => { if (!STORE.err) { STORE.err = String(e && (e.message || e.name) || e).slice(0, 120); dbg('error', { m: 'storage ' + STORE.err }); } return null; });
  const range = sid => IDBKeyRange.bound(sid + '/', sid + '/\uffff');
  return {
    err: null,
    // a new session; older ones beyond the latest two are deleted
    begin(sid, meta) {
      return run(['sessions', 'files'], 'readwrite', (ss, fs) => { ss.put(Object.assign({ sid }, meta)); const q = ss.getAllKeys(); q.onsuccess = () => { for (const k of q.result.sort((a, b) => b - a).slice(2)) { ss.delete(k); fs.delete(range(k)); } }; return null; });
    },
    put(sid, name, data) { return run('files', 'readwrite', fs => fs.put(data, sid + '/' + name)); },
    putMany(sid, files) { return run('files', 'readwrite', fs => { for (const f of files) fs.put(f.data, sid + '/' + f.name); return null; }); },
    sessions() { return run('sessions', 'readonly', ss => ss.getAll()).then(r => (r || []).sort((a, b) => b.sid - a.sid)); },
    files(sid) {
      return run('files', 'readonly', fs => { const out = [], q = fs.openCursor(range(sid)); q.onsuccess = () => { const c = q.result; if (c) { out.push({ name: c.key.slice(String(sid).length + 1), data: c.value }); c.continue(); } }; return { value: out }; }).then(r => r || []);
    },
  };
})();
function header() {
  return { app: 'chalkline', build: VERSION, det: DET.VERSION, started: new Date(DBG.t0).toISOString(), ua: navigator.userAgent, screen: [screen.width, screen.height], dpr: window.devicePixelRatio || 1,
    gpu: !!navigator.gpu, engine: DET.ep, engineSetting: A.engine, threads: DET.threads(), isolated: !!window.crossOriginIsolated, cores: navigator.hardwareConcurrency || null, shape: A.shape, kmax: r2(A.kmax), ft: A.ft, picture: A.tableWH || [A.W, A.H], pictureNow: [A.W, A.H], quad: A.quad && A.quad.map(p => [r1(p[0]), r1(p[1])]), rot: A.rot, box: A.box && A.box.map(Math.round),
    camOk: A.cam ? A.cam.ok : null, cam: A.camInfo, lens: LENS };
}
function shotRow(sh) { return { n: sh.n, t0: r2(sh.t0), t1: r2(sh.t1), cue: sh.cueNum, first: sh.firstNum, made: sh.made.map(m => ({ num: m.num, pocket: m.pocket, sure: m.sure })), scratch: sh.scratch, break: sh.break, hidden: sh.hidden, before: sh.before, after: sh.after, paths: sh.paths, test: sh.test }; }

// ---------- home ----------
// A newer version on the site (V3.1.2; Nov 1: the page stayed open in Safari from an earlier test, and Start again and
// Home do not reload it, so a whole test ran on the old version): the home screen asks the site which version it has and
// offers it, at most once a minute.
let UPD_T = 0;
const verNum = v => String(v || '').replace(/^V/, '').split('.').map(Number);
const newer = (a, b) => { const x = verNum(a), y = verNum(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
async function checkUpdate() {
  if (Date.now() - UPD_T < 60000) return; UPD_T = Date.now();
  try { const t = await (await fetch('index.html?u=' + Date.now(), { cache: 'no-store' })).text(), m = t.match(/const VERSION = '([^']+)'/);
    if (m && newer(m[1], VERSION)) { const b = $('#updBtn'); b.textContent = m[1] + ' is out: tap to load it'; b.hidden = false; dbg('update_seen', { v: m[1] }); }
  } catch (e) { }
}
$('#updBtn').onclick = () => location.reload();
function renderHome() {
  checkUpdate();
  $('#verTag').textContent = VERSION;
  const sf = $('#segFt'); sf.innerHTML = '';
  for (const f of [7, 8, 9]) { const b = document.createElement('button'); b.textContent = f + ' ft'; b.className = f === A.ft ? 'on' : ''; b.onclick = () => { A.ft = f; save(); renderHome(); }; sf.appendChild(b); }
  const se = $('#segEng'); if (se) { se.innerHTML = ''; for (const [v, l] of [['cpu', 'Processor'], ['gpu', 'Graphics chip']]) { const b = document.createElement('button'); b.textContent = l; b.className = v === A.engine ? 'on' : ''; b.onclick = () => { A.engine = v; save(); renderHome(); }; se.appendChild(b); } }
  const eh = $('#engHint'); if (eh) eh.textContent = A.engine === 'gpu' ? 'Faster, but on your iPhone Safari has closed the page when the ball finder runs here.' : 'Steady. ' + (window.crossOriginIsolated ? 'Uses several cores.' : 'One core: reload the page once if this stays.');
  if (CRASH) { $('#crashCard').hidden = false; $('#crashText').textContent = 'V' + String(CRASH.version || '').replace(/^V/, '') + ' stopped after ' + (CRASH.secs || 0) + ' s and ' + (CRASH.looks || 0) + ' looks, on the ' + (CRASH.engine === 'webgpu' ? 'graphics chip' : CRASH.engine === 'wasm' ? 'processor (' + (CRASH.threads || 1) + ' core' + ((CRASH.threads || 1) > 1 ? 's' : '') + ')' : 'way in') + ', while ' + ({ look: 'looking at the table', done: 'between looks', start: 'starting', camera: 'starting the camera', finder: 'starting the ball finder', table: 'finding the table' }[CRASH.step] || CRASH.step) + '.' + (CRASH.engine === 'webgpu' ? ' The processor is selected now.' : ''); }
  const L = A.lastSess, card = $('#lastCard');
  card.hidden = !(L && L.shots && L.shots.length);
  if (!card.hidden) $('#lastList').innerHTML = L.shots.slice(-12).map(s => '<div class="srow"><b>' + s.n + '</b><span>' + shotWords(s) + '</span></div>').join('') + (L.shots.length > 12 ? '<div class="lbl">… ' + L.shots.length + ' shots in all</div>' : '');
}
const POCKETS = ['bottom-left', 'bottom side', 'bottom-right', 'top-left', 'top side', 'top-right'];
function shotWords(s) {
  const pk = i => i == null ? '' : ' (' + POCKETS[i] + ')';
  const made = s.made.filter(m => m.num !== s.cue && m.num !== 0);
  const w = [made.length ? made.map(m => (m.num == null ? 'a ball' : 'the ' + m.num) + pk(m.pocket)).join(', ') + ' in' : 'nothing in'];
  if (s.scratch) w.push('scratch'); if (s.break) w.unshift('Break:'); else if (s.first != null) w.push('first hit the ' + (s.first === 0 ? 'cue' : s.first));
  return w.join(' · ');
}
// The tracking test (owner, Oct 28; goals revised with the owner Oct 31): how far the reviewed sessions are toward the
// targets for moving on to V3.1. The numbers come from data/v3-gate.json, which Claude updates after reviewing each
// session's debug file. Measured on one version only (the file's "measuring"), its latest 10 racks; sessions on earlier
// versions are shown as a line, not counted.
async function renderGate() {
  try {
    const g = await (await fetch('data/v3-gate.json?' + Date.now(), { cache: 'no-store' })).json(), T = g.target, ver = g.measuring || VERSION;
    const all = (g.sessions || []).filter(s => s.app === ver), S = []; let rk = 0;
    for (let i = all.length - 1; i >= 0 && rk < T.racks; i--) { S.unshift(all[i]); rk += all[i].racks || 0; }
    const sum = k => S.reduce((a, s) => a + (s[k] || 0), 0), shots = sum('shots'), balls = sum('balls'), racks = sum('racks'), pct = (a, b) => b ? (Math.round(1000 * a / b) / 10) + '%' : '–';
    const nSess = new Set(S.map(s => s.session || s.when)).size, spots = [...new Set(S.map(s => s.spot))];
    const share = (k, n, need) => [pct(sum(k), n) + ' · need ' + Math.round(100 * need) + '%', n ? sum(k) / n / need : 0, n > 0 && sum(k) / n >= need];
    // a count with a limit (at most v per k): the bar is full at none, half at the limit
    const atMost = (n, per, lim, unit) => { const r = per ? n / per : 0; return [n + (per && n ? ' (' + (Math.round(10 * r * lim.k) / 10) + ')' : '') + ' · at most ' + lim.v + ' ' + unit, per ? 1 - Math.min(1, r * lim.k / lim.v / 2) : 0, per > 0 && r * lim.k <= lim.v]; };
    const rows = [
      ['Racks', racks + ' of ' + T.racks, racks / T.racks, racks >= T.racks],
      ['Sessions', nSess + ' of ' + T.sessions, nSess / T.sessions, nSess >= T.sessions],
      ['Camera spots', spots.length + ' of ' + T.spots + (spots.length ? ' (' + spots.join(', ') + ')' : ''), spots.length / T.spots, spots.length >= T.spots],
      ['Shots found', ...share('found', shots, T.found)],
      ['What went in, called right', ...share('madeRight', shots, T.madeRight)],
      ['False "in"', ...atMost(sum('falseIn'), shots, { k: 50, v: T.falseInPer50 }, 'per 50 shots')],
      ['False scratches', ...atMost(sum('falseScratch'), shots, { k: 50, v: T.falseScratchPer50 }, 'per 50 shots')],
      ['Cue ball and lowest ball named right after a shot', ...share('keyRight', shots, T.keyRight)],
      ['Balls named right', ...share('ballsRight', balls, T.ballsRight)],
      ['A wrong number shown', ...atMost(sum('wrongNum'), balls, { k: 200, v: T.wrongPer200 }, 'in 200 balls')],
      ['Counted as shots but not shots', ...atMost(sum('extraShots'), racks, { k: 1, v: T.extraPerRack }, 'per rack')]];
    $('#gateRows').innerHTML = rows.map(([l, v, f, ok]) => '<div class="grow' + (ok ? ' ok' : '') + '"><div class="gl"><span>' + l + '</span><span>' + v + '</span></div><div class="gb"><i style="width:' + Math.round(100 * Math.max(0, Math.min(1, f))) + '%"></i></div></div>').join('');
    const met = rows.filter(r => r[3]).length, old = (g.sessions || []).filter(s => s.app !== ver), oShots = old.reduce((a, s) => a + s.shots, 0);
    $('#gateNote').textContent = (S.length ? met + ' of ' + rows.length + ' met. Counting ' + ver + ' only, its latest ' + T.racks + ' racks: ' + S.map(s => s.when).join('; ') + '.' : 'No sessions on ' + ver + ' yet: it counts ' + ver + ' only, its latest ' + T.racks + ' racks.') +
      (old.length ? ' Earlier versions (not counted): ' + old.reduce((a, s) => a + s.racks, 0) + ' racks, ' + oShots + ' shots, ' + pct(old.reduce((a, s) => a + s.madeRight, 0), oShots) + ' called right.' : '') + ' Updated ' + g.updated + '.';
    $('#gateCard').hidden = false;
  } catch (e) { $('#gateCard').hidden = true; }
}
renderGate();
$('#goBtn').onclick = () => start();
$('#dbgHome').onclick = () => saveDebug($('#dbgHome'));
function homeMsg(t, bad) { const m = $('#homeMsg'); m.textContent = t || ''; m.classList.toggle('bad', !!bad); }

// ---------- camera ----------
const vid = $('#vid'), ov = $('#ov');
let wl = null;
async function wakeLock() { try { if (navigator.wakeLock && A.live) wl = await navigator.wakeLock.request('screen'); } catch (e) { } }
async function openCamera() {
  const st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false });
  A.stream = st; vid.srcObject = st; await vid.play();
  for (let i = 0; i < 60 && !vid.videoWidth; i++) await sleep(50);
  const tr = st.getVideoTracks()[0];
  if (tr) {
    // the main camera at 1x: below 1x the iPhone switches to the ultra-wide lens and the balls come out smeared (V2.3.1)
    try { const c = tr.getCapabilities ? tr.getCapabilities() : null; if (c && c.zoom) await tr.applyConstraints({ advanced: [{ zoom: 1 }] }); } catch (e) { }
    tr.addEventListener('ended', () => { dbg('cam_ended', {}); if (A.live) restartCamera(); });
    try { const s = tr.getSettings ? tr.getSettings() : {}; A.camInfo = { label: tr.label, w: s.width, h: s.height, fps: s.frameRate, zoom: s.zoom }; } catch (e) { }
  }
  dbg('camera', { w: vid.videoWidth, h: vid.videoHeight, info: A.camInfo });
}
async function restartCamera() {
  if (A.camBusy) return; A.camBusy = true;
  try { if (A.stream) A.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } }); await openCamera(); setStatus('Camera back on.'); }
  catch (e) { dbg('error', { m: 'camera restart: ' + String(e && (e.message || e.name) || e).slice(0, 120) }); setStatus('The camera is off. Tap Menu, then Home, and start again.'); }
  finally { A.camBusy = false; }
}
// the whole camera picture, every look (and the small copy the table is found on)
function grab() {
  if (A.frozen) return true; // the corners are being set on a still picture
  const W = vid.videoWidth, H = vid.videoHeight; if (!W || !H) return false;
  if (A.frame.width !== W || A.frame.height !== H) { A.frame.width = W; A.frame.height = H; A.fctx = A.frame.getContext('2d', { willReadFrequently: true }); }
  if (!A.fctx) A.fctx = A.frame.getContext('2d', { willReadFrequently: true });
  A.fctx.drawImage(vid, 0, 0, W, H);
  A.W = W; A.H = H;
  // the phone turned (upright <-> sideways): the outline no longer fits the picture, so the table is found again; the balls'
  // table positions and names stay
  if (A.phase === 'run' && A.tableWH && (A.tableWH[0] !== W || A.tableWH[1] !== H)) { dbg('picture_turned', { from: A.tableWH, to: [W, H] }); refind('The phone turned: finding the table again…'); return false; }
  return true;
}
function smallImg() {
  const k = Math.min(1, SMALL / Math.max(A.W, A.H)), w = Math.round(A.W * k), h = Math.round(A.H * k), c = A.small;
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(A.frame, 0, 0, w, h); return { img: x.getImageData(0, 0, w, h), k };
}

// ---------- start ----------
async function start() {
  homeMsg('');
  if (!window.ort) { homeMsg('The ball finder did not load. Check the connection and reload the page.', true); return; }
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { homeMsg('This browser cannot reach the camera. Open the page in Safari from its https address.', true); return; }
  DBG.t0 = Date.now(); DBG.ev = []; DBG.looks = []; DBG.drop = 0; A.pics.clear(); A.taps = []; A.nShots = 0; A.looks = 0;
  A.P = makeP(A.ft); A.tk = makeTracker(A.P); A.sess = { t0: Date.now(), ft: A.ft, shots: [] }; A.test = null; A.handsN = 0; A.handsT = 0;
  STORE.begin(DBG.t0, { t0: DBG.t0, version: VERSION, ft: A.ft }); WATCH.nClips = 0;
  $('#home').hidden = true; $('#sum').hidden = true; $('#cam').hidden = false; A.phase = 'boot'; A.frozen = false; A.findN = 0; A.live = true; setStatus('Starting the camera…');
  dbg('start', { ft: A.ft, version: VERSION, engine: A.engine, isolated: !!window.crossOriginIsolated }); CRASH = null; $('#crashCard').hidden = true; crumb('start');
  // the weights (10 MB) download while the table is found
  DET.prefetch(BASE, 'models/v3/finder-v1.weights', (g, t) => { A.dl = t ? g / t : 0; }).catch(e => dbg('error', { m: 'weights ' + String(e).slice(0, 100) }));
  try { await openCamera(); } catch (e) {
    A.live = false; $('#cam').hidden = true; $('#home').hidden = false;
    homeMsg(e && e.name === 'NotAllowedError' ? 'Camera access was blocked. In Safari tap aA, then Website Settings, then Camera, then Allow. Reload and try again.' : 'The camera could not start: ' + (e && (e.message || e.name) || e), true); return;
  }
  crumb('table'); wakeLock(); requestAnimationFrame(drawLoop); findTable();
}
function goHome() {
  A.live = false; A.phase = 'home'; dbgPersist(); if (A.sess) logStore(); endSession(); endCrumb();
  if (A.stream) A.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } }); A.stream = null;
  try { if (wl) wl.release(); } catch (e) { } wl = null;
  $('#cam').hidden = true; $('#home').hidden = false; hideCard(); renderHome();
}
function endSession() { if (A.sess && A.sess.shots.length) { A.lastSess = A.sess; save(); } }
// End session (owner, Oct 28): the camera goes off and the session's numbers show, with Save debug, so the debug file is
// saved with the phone put down and the camera no longer watching (turning the phone upright to save used to count as a
// shot and send the app looking for the table again)
function endRun() {
  if (A.tk) { A.tk.finish(); flushShots(); }
  dbg('end_session', { shots: A.tk ? A.tk.S.shots.length : 0 });
  A.live = false; A.phase = 'done'; dbgPersist(); logStore(); endSession(); endCrumb();
  if (A.stream) A.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } }); A.stream = null;
  try { if (wl) wl.release(); } catch (e) { } wl = null;
  hideCard(); $('#cam').hidden = true; $('#sum').hidden = false; renderSummary();
}
function renderSummary() {
  const sh = (A.sess && A.sess.shots) || [], mins = Math.max(1, Math.round((Date.now() - DBG.t0) / 60000));
  const made = sh.reduce((a, s) => a + s.made.filter(m => m.num !== 0 && m.num !== s.cue).length, 0), scr = sh.filter(s => s.scratch).length;
  // racks with at least one shot: a rack done by itself at the end, or New rack pressed twice, is not another
  const racks = 1 + DBG.ev.filter(e => e.k === 'new_rack' && !e.dup && DBG.ev.some(q => q.k === 'shot_end' && q.t > e.t)).length;
  $('#sumSub').textContent = mins + ' min · ' + A.ft + ' ft table · ' + racks + ' rack' + (racks > 1 ? 's' : '') + ' · ' + VERSION;
  $('#sumStats').innerHTML = [[sh.length, 'shots'], [made, 'balls in'], [sh.filter(s => !s.scratch && !s.made.some(m => m.num !== 0)).length, 'nothing in'], [scr, 'scratches']].map(([n, l]) => '<div><b>' + n + '</b><span>' + l + '</span></div>').join('');
  $('#sumList').innerHTML = sh.length ? sh.map(s => '<div class="srow"><b>' + s.n + '</b><span>' + shotWords(s) + '</span></div>').join('') : '<div class="lbl">No shots.</div>';
  $('#sumDbg').textContent = 'Save debug';
}
$('#endBtn').onclick = () => endRun();
$('#sumAgain').onclick = () => { $('#sum').hidden = true; start(); };
$('#sumHome').onclick = () => { $('#sum').hidden = true; $('#home').hidden = false; A.phase = 'home'; renderHome(); renderGate(); };
$('#sumDbg').onclick = () => saveDebug($('#sumDbg'));

// ---------- the table ----------
async function findTable() {
  A.phase = 'find'; hideCard(); setStatus('Looking for the table…'); let best = null;
  for (let i = 0; i < 8 && A.live && A.phase === 'find'; i++) {
    if (!grab()) { await sleep(200); i--; continue; }
    const { img, k } = smallImg(), r = autoCalibrate(img, A.ft);
    if (r.quad && (!best || r.conf > best.conf)) best = Object.assign(r, { k });
    if (best && best.conf >= 0.85) break;
    await sleep(250);
  }
  if (!A.live || A.phase !== 'find') return;
  // the picture the table was looked for on, and the outline found, go into the debug file (Oct 28: upright, the outline
  // kept landing on the outer edge of the rails, and there was no picture to see why)
  const fn = 'find-' + String(++A.findN).padStart(2, '0') + '.jpg'; if (A.findN <= 20) jpeg(960).then(b => setPic(fn, b)).catch(() => { });
  dbg('table_find', best ? { conf: r2(best.conf), corners: best.corners, sides: best.sides, tips: best.tips, quad: best.quad.map(p => [r1(p[0] / best.k), r1(p[1] / best.k)]), pic: fn, wh: [A.W, A.H] } : { conf: 0, pic: fn, wh: [A.W, A.H] });
  if (best && best.quad) { const q = best.quad.map(p => [p[0] / best.k, p[1] / best.k]); A.cand = { quad: q, rot: tableRot(q, best.rot), conf: best.conf, tips: best.tips }; }
  else A.cand = null;
  showVerify();
}
function showVerify() {
  A.phase = 'verify'; const c = A.cand, good = c && c.conf >= 0.7;
  const sizes = '<div class="row"><span class="lbl">Table</span>' + [7, 8, 9].map(f => '<button class="btn" data-ft="' + f + '"' + (f === A.ft ? ' style="border-color:var(--accent)"' : '') + '>' + f + ' ft</button>').join('') + '</div>';
  // an outline that is not twice as long as it is wide (seen through the lens) is off: often on the outer edge of the rails
  const ratio = A.shapeRatio ? Math.max(A.shapeRatio, 1 / A.shapeRatio) : 2, odd = c && (ratio < 1.6 || ratio > 2.5);
  const tip = c ? (odd ? 'This outline is not the shape of a table (' + ratio.toFixed(1) + ' to 1, a table is 2 to 1): it may be on the outer edge of the rails. Tap the corners to set it on the cloth.' : good ? 'The teal outline should sit on the cushions, with a dot in each corner pocket.' : (c.tips && c.tips[0]) || 'Not sure about this one.') : 'The table was not found. Make sure the whole table is in view and the lights are on.';
  showCard('<div><b>' + (good ? 'Table found' : c ? 'Not sure about this table' : 'Table not found') + '</b><p>' + tip + '</p></div>' + sizes +
    '<div class="row">' + (c ? '<button class="btn primary" data-act="accept">Looks right</button>' : '') + '<button class="btn" data-act="retry">Try again</button><button class="btn" data-act="manual">Tap the corners</button></div>');
  setStatus(good ? 'Check the outline' : 'Table');
}
// Setting the corners by hand is done on a still picture (owner, Oct 28: a finger is not exact enough, and pressing the
// screen moved the phone): the picture is frozen, each corner can be dragged with a magnifier above the finger, and once
// the outline is accepted the steady check (see steady) measures how far the phone moved since that picture and moves the
// outline with it. A corner goes on the corner of the cloth, where the two cushion noses would meet.
function beginManual() {
  if (!A.frozen) { grab(); A.frozen = true; } A.phase = 'manual'; A.man = []; A.drag = null; ov.style.touchAction = 'none';
  const n = 'manual-' + String(++A.findN).padStart(2, '0') + '.jpg'; jpeg(960).then(b => setPic(n, b)).catch(() => { }); A.manPic = n;
  manualCard();
}
function manualCard() {
  // the buttons only, small, in the bottom corner (a card in the middle covered the near pockets); what to do goes on top
  const n = A.man.length;
  showCard('<div class="row">' + (n === 4 ? '<button class="btn primary" data-act="useman">Use these corners</button>' : '') + '<button class="btn" data-act="undo">Undo</button><button class="btn" data-act="retry">Automatic</button></div>', true);
  setStatus(n < 4 ? 'Corner pocket ' + (n + 1) + ' of 4: touch and slide, the magnifier shows the spot' : 'Drag any corner to adjust, then Use these corners',
    'The picture is still, so the phone can move. Aim for the corner of the cloth, where the cushion edges would meet.');
}
function useManual() {
  if (!A.man || A.man.length < 4) return;
  const quad = orderQuad(A.man), { img, k } = smallImg(), rot = tableRot(quad, pickRot(img, quad.map(p => [p[0] * k, p[1] * k])));
  A.cand = { quad, rot, conf: 1, manual: true }; dbg('table_manual', { quad: quad.map(p => p.map(r1)), rot, pic: A.manPic }); A.man = null; A.drag = null; ov.style.touchAction = ''; showVerify();
}
const picAt = e => { const F = fit(), rc = ov.getBoundingClientRect(); return { x: (e.clientX - rc.left - F.x) / F.k, y: (e.clientY - rc.top - F.y) / F.k, F }; };
ov.addEventListener('pointerdown', e => {
  if (A.phase !== 'manual' || !A.man) return; e.preventDefault(); const q = picAt(e);
  let i = -1, bd = 40 / q.F.k; A.man.forEach((p, j) => { const d = Math.hypot(p[0] - q.x, p[1] - q.y); if (d < bd) { bd = d; i = j; } });
  if (i < 0) { if (A.man.length >= 4) return; A.man.push([q.x, q.y]); i = A.man.length - 1; }
  A.drag = { i, id: e.pointerId, fx: e.clientX, fy: e.clientY }; try { ov.setPointerCapture(e.pointerId); } catch (err) { }
});
ov.addEventListener('pointermove', e => { if (!A.drag || e.pointerId !== A.drag.id) return; const q = picAt(e); A.man[A.drag.i] = [q.x, q.y]; A.drag.fx = e.clientX; A.drag.fy = e.clientY; });
const dragEnd = e => { if (!A.drag || e.pointerId !== A.drag.id) return; A.drag = null; if (A.phase === 'manual') manualCard(); };
ov.addEventListener('pointerup', dragEnd); ov.addEventListener('pointercancel', dragEnd);
// (V3.1.3, owner Nov 1: a second, smaller magnifier came up over the app's: Safari's own press-and-hold one. A touch held
// on the picture does nothing of Safari's while the corners are set)
ov.addEventListener('touchstart', e => { if (A.phase === 'manual') e.preventDefault(); }, { passive: false });
ov.addEventListener('contextmenu', e => e.preventDefault());
async function acceptTable() {
  const c = A.cand; A.quad = c.quad; A.rot = c.rot;
  const { L, Wd } = tableDims(A.ft), f = LENS * Math.max(A.W, A.H);
  A.cam = makeCam(tableCornersFor(A.rot, L, Wd), A.quad, A.W, A.H, f, [A.W / 2, A.H / 2]);
  A.tableWH = [A.W, A.H];
  // the part of the picture the finder looks at: the table, its rails and the ball tops, with a little room
  const pts = [], m = 4, R = A.P.R;
  for (const [x, y] of [[-m, -m], [L / 2, -m], [L + m, -m], [L + m, Wd / 2], [L + m, Wd + m], [L / 2, Wd + m], [-m, Wd + m], [-m, Wd / 2]]) for (const z of [0, 2 * R]) pts.push(A.cam.proj(x, y, z));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = 12;
  const x0 = Math.max(0, Math.min(...xs) - pad), y0 = Math.max(0, Math.min(...ys) - pad), x1 = Math.min(A.W, Math.max(...xs) + pad), y1 = Math.min(A.H, Math.max(...ys) + pad);
  A.box = [x0, y0, Math.max(32, x1 - x0), Math.max(32, y1 - y0)]; A.box0 = A.box.slice();
  let rmax = 0; for (const [x, y] of [[R, R], [L - R, R], [L - R, Wd - R], [R, Wd - R], [L / 2, R], [L / 2, Wd - R]]) rmax = Math.max(rmax, A.cam.ballRad(x, y, R, R));
  A.kmax = Math.max(0.5, Math.min(2, BALL_PX_MAX / Math.max(4, rmax)));
  dbg('table', { quad: A.quad.map(p => p.map(Math.round)), rot: A.rot, camOk: A.cam.ok, box: A.box.map(Math.round), rmax: r1(rmax), kmax: r2(A.kmax), manual: !!c.manual });
  hideCard();
  const sh = DET.pickShape(A.box[2], A.box[3]), need = !A.shape || A.shape[0] !== sh.w || A.shape[1] !== sh.h;
  if (need) {
    A.phase = 'load'; setStatus('Starting the ball finder…'); crumb('finder');
    try {
      await DET.load({ base: BASE, ep: A.engine === 'gpu' ? 'webgpu' : 'wasm', finder: sh, onProgress: t => setStatus(t) });
      A.shape = [sh.w, sh.h]; dbg('finder', { ep: DET.ep, shape: A.shape, threads: DET.threads(), isolated: !!window.crossOriginIsolated });
      if (A.engine === 'gpu' && DET.ep !== 'webgpu') toast('The graphics chip is not available: using the processor.');
    } catch (e) { dbg('error', { m: 'finder load ' + String(e && e.message || e).slice(0, 160) }); setStatus('The ball finder could not start: ' + String(e && e.message || e).slice(0, 80)); return; }
  }
  // (corners set on a still picture: the steady check's reference comes from that picture, so the outline follows the phone
  // if it moved since)
  steadyRef(); A.frozen = false; clothRef(); A.tk.setBags(pocketBags(A.cam, A.P)); A.phase = 'run'; setStatus('Watching'); runLoop(); watchStart();
}
// the cloth's colour, once the table is accepted: a hidden ball's spot that shows only this colour is bare (see bareCloth)
function clothRef() {
  try { grab(); A.cloth = sampleCloth(A.fctx.getImageData(0, 0, A.W, A.H), A.quad); dbg('cloth', A.cloth ? { h: Math.round(A.cloth.h), s: r2(A.cloth.s), v: r2(A.cloth.v) } : { none: true }); }
  catch (e) { A.cloth = null; dbg('error', { m: 'cloth ' + String(e && e.message || e).slice(0, 120) }); }
}
function emptyAt(x, y) {
  if (!A.cloth || !A.fctx || !A.cam) return null;
  const p = A.cam.proj(x, y, A.P.R), r = A.cam.ballRad(x, y, A.P.R, A.P.R), s = Math.ceil(r) + 2, x0 = Math.round(p[0]) - s, y0 = Math.round(p[1]) - s;
  if (x0 < 0 || y0 < 0 || x0 + 2 * s > A.W || y0 + 2 * s > A.H) return null;
  return bareCloth(A.fctx.getImageData(x0, y0, 2 * s, 2 * s), p[0] - x0, p[1] - y0, r, A.cloth);
}
// Which way the table runs: from the outline's shape through the lens (a table is twice as long as it is wide), else the
// side-pocket look. Oct 29: from the end of the table the side-pocket look took the short rails for the long ones, and
// every ball came out about 1.5 diamonds off.
function tableRot(quad, guess) {
  const r = rotByShape(quad, A.W, A.H, LENS * Math.max(A.W, A.H)); A.shapeRatio = r.ratio;
  if (r.rot != null && r.rot !== guess) dbg('rot_by_shape', { was: guess, rot: r.rot, ratio: r2(r.ratio) });
  return r.rot != null ? r.rot : guess;
}
function refind(msg) { A.frozen = false; ov.style.touchAction = ''; A.phase = 'find'; setStatus(msg || 'Looking for the table…'); findTable(); }

// ---------- watching ----------
async function runLoop() {
  if (A.looping) return; A.looping = true;
  try {
    while (A.live && A.phase === 'run') {
      const t0 = performance.now();
      if (!document.hidden) { try { await look(); A.errs = 0; } catch (e) { A.errs++; dbg('error', { m: 'look ' + String(e && e.message || e).slice(0, 160) }); if (A.errs > 5) setStatus('Something is wrong with the ball finder: ' + String(e && e.message || e).slice(0, 60)); await sleep(500); } }
      // during a shot as fast as the phone goes; otherwise about 5 looks a second (battery and heat)
      const gap = A.tk.S.phase === 'shot' ? 0 : 200 - (performance.now() - t0);
      await sleep(Math.max(document.hidden ? 300 : 0, gap));
    }
  } finally { A.looping = false; }
}
async function look() {
  if (!grab() || A.phase !== 'run') return;
  crumb('look');
  steady();
  const t = performance.now() / 1000, t0 = performance.now(), tk = A.tk, P = A.P, R = P.R;
  const found = await DET.find(A.frame, A.W, A.H, { box: A.box, kmax: A.kmax }), t1 = performance.now();
  const on = [];
  for (const s of found) { const q = A.cam.unproj(s.px, s.py, R); s.x = q[0]; s.y = q[1]; if (s.x > -3 && s.y > -3 && s.x < P.L + 3 && s.y < P.W + 3) on.push(s); }
  // the reader runs every look (about 10 ms against 220 for the finder on the owner's phone). During a shot its numbers
  // are not votes (the tracker votes on resting balls only), but white or not still tells the cue ball from the rest
  const read = true; await DET.read(A.fctx, on);
  const t2 = performance.now(), before = tk.S.phase;
  tk.update(t, on, { read, empty: emptyAt });
  for (const n of tk.S.notes.splice(0)) onLateMade(n);
  pathLook();
  A.looks++;
  DBG.looks.push([Date.now() - DBG.t0, Math.round(t1 - t0), Math.round(t2 - t1), on.length, tk.S.phase === 'shot' ? 'S' : tk.S.phase[0], on.map(s => [r1(s.x), r1(s.y), s.num == null ? null : s.num, s.kind ? s.kind[0] : '-', r2(s.score), s.p ? r2(s.p[s.num]) : null, s.p ? second(s.p, s.num) : null])]);
  if (DBG.looks.length > 40000) DBG.looks.splice(0, 4000); // (it was 4000: Oct 31, a 17-minute session lost its first 98 s)
  A.timing.push(t1 - t0); if (A.timing.length > 30) A.timing.shift();
  if (before !== 'shot' && tk.S.phase === 'shot') onShotStart();
  // hands on the table (not a shot): a clip of that too, at most one every 4 s
  if (before !== 'hands' && tk.S.phase === 'hands' && Date.now() - A.handsT > 4000) { A.handsT = Date.now(); clipStart('hands-' + String(++A.handsN).padStart(3, '0'), 2000, 2000); }
  if (tk.S.shots.length > A.nShots) { for (const sh of tk.S.shots.slice(A.nShots)) onShotEnd(sh); A.nShots = tk.S.shots.length; }
  for (const s of tk.S.say.splice(0)) onSay(s);
  // in the stroke test the 1 is put back after every pot: no number stays counted in, so it is found and named again
  // (Nov 1: it showed ? every time it came back)
  if (A.test) tk.S.gone.length = 0;
  // a picture of the still table every 1.5 s, kept as the "before" of the next shot
  if (tk.S.phase !== 'shot' && performance.now() - (A.colT || 0) > 1000) { A.colT = performance.now(); ballColours(); }
  if (tk.S.phase === 'still' && performance.now() - A.stillPicT > 1500) { A.stillPicT = performance.now(); jpeg(960).then(b => { A.stillPic = b; }).catch(() => { }); }
  statusRun(); crumb('done');
}
// the reader's second choice and its share (from V3.0.11, so a replay can rebuild how sure the reader was: Oct 30, a replay
// with every read made 90% sure scored 37 of 44 on a session that live got 42)
function second(p, k) { let b = -1; for (let i = 0; i < 10; i++) if (i !== k && (b < 0 || p[i] > p[b])) b = i; return b < 0 ? null : [b, r2(p[b])]; }
// The tracker's word on racks and hand moves (V3.0.15, owner Oct 31: for testing, said on screen; later done quietly)
function onSay(s) {
  if (s.k === 'rack_done') { flushShots(); PATH.clear(); dbg('new_rack', { auto: true }); toast('Rack complete'); }
  else if (s.k === 'rack_new') { flushShots(); PATH.clear(); dbg('new_rack', { auto: true, set: true }); toast('New rack: balls set out'); }
  else if (s.k === 'not_shot') { PATH.clear(); dbg('not_shot', { num: s.num }); toast('Not counted: hand move'); }
}
function onShotStart() {
  PATH.clear(); pathLook(); const sh = A.tk.S.shot; if (!sh) return; const nm = 'shot' + String(sh.n).padStart(3, '0');
  if (A.stillPic) setPic(nm + '-before.jpg', A.stillPic);
  if (A.test && A.test.st < 4) sh.test = { station: A.test.st + 1, try: A.test.tries[A.test.st] + 1 }; else if (A.test) sh.test = { station: 5, move: A.test.move };
  clipStart(nm, A.test ? 4000 : 2000, 2000, sh.test || null);
  dbg('shot_start', Object.assign({ n: sh.n, test: sh.test }, aroundCue(sh)));
}
// What is round the cue ball as a shot starts, for a rule on hands to come (owner, Oct 31: the cue ball rolled or pushed
// by hand counts as a shot; a cue lies behind the ball on a real shot too, so the rule waits for this from real sessions):
// 12 spots 3.5 in from where it rested, the first straight ahead of its roll, then round; 1 = not cloth (a hand, the cue,
// a ball), 0 = cloth, - = not known. And how fast it set off. Logged only.
function aroundCue(sh) {
  const cue = A.tk.S.tracks.find(x => x.key === sh.cueKey), st = (sh.before || []).find(q => q.key === sh.cueKey); if (!cue || !st || st.rx == null) return {};
  const a0 = Math.atan2(cue.vy, cue.vx); let s = '';
  for (let i = 0; i < 12; i++) { const a = a0 + i * Math.PI / 6, x = st.rx + 3.5 * Math.cos(a), y = st.ry + 3.5 * Math.sin(a), e = x < 0 || y < 0 || x > A.P.L || y > A.P.W ? null : emptyAt(x, y); s += e === true ? '0' : e === false ? '1' : '-'; }
  return { around: s, v0: r1(Math.hypot(cue.vx, cue.vy)) };
}
// New rack and End session settle the last shot's calls first (see finish in src/track.js): its line, and what went in late
function flushShots() {
  const tk = A.tk; if (!tk || !A.sess) return;
  if (tk.S.shots.length > A.nShots) { for (const sh of tk.S.shots.slice(A.nShots)) onShotEnd(sh); A.nShots = tk.S.shots.length; }
  for (const n of tk.S.notes.splice(0)) onLateMade(n);
}
function onShotEnd(sh) {
  sh.paths = pathsRow(sh); const row = shotRow(sh); A.sess.shots.push({ n: sh.n, cue: sh.cueNum, first: sh.firstNum, made: row.made, scratch: sh.scratch, break: sh.break, t: Date.now() });
  dbg('shot_end', { n: sh.n, made: row.made, scratch: sh.scratch, first: sh.firstNum });
  jpeg(960).then(b => setPic('shot' + String(sh.n).padStart(3, '0') + '-after.jpg', b)).catch(() => { });
  toast('Shot ' + sh.n + ': ' + shotWords(A.sess.shots[A.sess.shots.length - 1]));
  if (A.sess.shots.length % 3 === 0) { A.lastSess = A.sess; save(); }
  if (A.test) testShotEnd(sh);
}
// Each ball's path in the shot: the tracker's positions from just before the shot started, kept after it ends (and for the
// balls that went in) until the next shot starts, so a quick look at the phone after the shot shows the whole of it.
const PATH = new Map(); // ball key -> { num, pts: [{ t, x, y }] }
function pathLook() {
  const tk = A.tk, sh = tk && (tk.S.shot || tk.S.shots[tk.S.shots.length - 1]); if (!sh) return;
  if (tk.S.phase !== 'shot' && !(tk.S.t - sh.t1 < 2)) return; // the last few looks after it ends: the balls settling
  for (const b of tk.balls()) {
    // a path starts where the ball rested when the shot started, even if its first moments were not seen (owner, Oct 28)
    let e = PATH.get(b.key);
    if (!e) { const st = (sh.before || []).find(q => q.key === b.key); e = { num: b.num, pts: st && st.rx != null ? [{ t: sh.t0 - 1e-3, x: st.rx, y: st.ry }] : [] }; }
    const lastT = e.pts.length ? e.pts[e.pts.length - 1].t : sh.t0 - 1e-3;
    for (const q of b.hist || []) if (q.t > lastT + 1e-3) e.pts.push({ t: q.t, x: q.x, y: q.y });
    if (e.pts.length > 400) e.pts.splice(0, e.pts.length - 400);
    e.num = b.num; if (e.pts.length) PATH.set(b.key, e);
  }
}
const moved = pts => { let m = 0; for (const q of pts) m = Math.max(m, Math.hypot(q.x - pts[0].x, q.y - pts[0].y)); return m; };
// for the debug file: each ball that moved, its path in table inches, 0.1 in and 0.01 s from the shot's start
function pathsRow(sh) { const o = []; for (const [key, e] of PATH) if (moved(e.pts) > 1) o.push({ key, num: e.num, p: e.pts.map(q => [r2(q.t - sh.t0), r1(q.x), r1(q.y)]) }); return o; }
// a ball found to have gone in after its shot ended (its spot is bare cloth now): the shot's line is corrected and said
function onLateMade(n) {
  const row = A.sess.shots.find(s => s.n === n.n), sh = A.tk.S.shots.find(s => s.n === n.n);
  if (row && sh) { row.made = shotRow(sh).made; row.scratch = sh.scratch; }
  dbg('late_made', n); renderDown();
  toast('Shot ' + n.n + ': ' + (n.num === 0 ? 'the cue ball went in too (scratch)' : 'the ' + (n.num == null ? 'ball' : n.num) + ' went in too') + (n.pocket != null ? ' (' + POCKETS[n.pocket] + ')' : ''));
}
// Each ball's own colour, read from the picture while it rests (sets differ: a pink 4, a teal 2, a black 9 with a yellow
// band), for its trail: the median of its coloured pixels, and whether it is mostly white, black or banded (white and a
// colour). Kept per ball and blended over time, so one bad look does not change it.
const BCOL = new Map();
function ballColours() {
  if (!A.fctx || !A.cloth) return;
  for (const b of A.tk.balls()) {
    if (b.state !== 'rest' || !b.sp || b.sp.px == null) continue;
    const r = Math.max(4, b.sp.r || 10), s = Math.ceil(r), x0 = Math.round(b.sp.px) - s, y0 = Math.round(b.sp.py) - s;
    if (x0 < 0 || y0 < 0 || x0 + 2 * s > A.W || y0 + 2 * s > A.H) continue;
    const d = A.fctx.getImageData(x0, y0, 2 * s, 2 * s).data, rs = [], gs = [], bs = []; let n = 0, wh = 0, bk = 0;
    for (let y = 0; y < 2 * s; y++) for (let x = 0; x < 2 * s; x++) {
      const dx = x - s, dy = y - s; if (dx * dx + dy * dy > 0.64 * r * r) continue;
      const o = (y * 2 * s + x) * 4, R = d[o], G = d[o + 1], B = d[o + 2], [h, sat, v] = rgb2hsv(R, G, B); n++;
      if (isCloth(h, sat, v, A.cloth)) continue;
      if (v < 0.22) { bk++; continue; } if (sat < 0.22 && v > 0.62) { wh++; continue; }
      rs.push(R); gs.push(G); bs.push(B);
    }
    if (n < 12) continue;
    const med = a => { a.sort((p, q) => p - q); return a[a.length >> 1]; }, cs = rs.length / n;
    const now = { white: wh / n > 0.45 && cs < 0.15, black: bk / n > 0.35 && cs < 0.25, band: wh / n > 0.2 && cs > 0.15, rgb: cs > 0.08 ? [med(rs), med(gs), med(bs)] : null };
    const old = BCOL.get(b.key);
    if (old && old.rgb && now.rgb) now.rgb = old.rgb.map((v, i) => Math.round(0.7 * v + 0.3 * now.rgb[i])); else if (old && !now.rgb) now.rgb = old.rgb;
    BCOL.set(b.key, now);
  }
}
// Every picture goes into the phone's storage (all of them, from V3.1.0: Save debug splits the file when it is big); the
// copy in memory keeps the latest 400 shot pictures, for a phone where that storage is not there (the table-finding ones
// are always kept: Oct 29, the upright session's were thrown away first)
function setPic(name, data) { A.pics.set(name, data); trimPics(); STORE.put(DBG.t0, name, data); }
function trimPics() { const keys = [...A.pics.keys()].filter(k => k.startsWith('shot')).sort(); while (keys.length > 400) A.pics.delete(keys.shift()); }
function jpeg(w) {
  const k = Math.min(1, w / Math.max(A.W, A.H)), c = document.createElement('canvas'); c.width = Math.round(A.W * k); c.height = Math.round(A.H * k);
  c.getContext('2d').drawImage(A.frame, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => b ? b.arrayBuffer().then(a => res(new Uint8Array(a))) : rej(new Error('jpeg')), 'image/jpeg', 0.7));
}

// ---------- steady: the outline follows the table when the phone sways ----------
// When the table is accepted, a small picture of each corner and side pocket is kept (the cloth's blue against the rails,
// at half size). A few times a second each one is looked for again within about 30 px; if they agree on a move, the
// outline (and with it every ball's table position) is moved to match. Always measured against the accepted outline, so
// small errors do not add up. A ball or a hand over a pocket only removes that one picture from the vote.
const STEADY = { ref: null, h: 20, S: 15, cv: document.createElement('canvas'), n: 0, last: null };
function feat(d, n) { const o = new Float32Array(n); for (let i = 0, j = 0; i < n; i++, j += 4) o[i] = d[j + 2] - d[j]; return o; } // blue minus red: cloth high, rails and pockets low
function steadyGrab() {
  const w = Math.round(A.W / 2), h = Math.round(A.H / 2), c = STEADY.cv; if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(A.frame, 0, 0, w, h); return x;
}
function steadyPts() { const { L, Wd } = tableDims(A.ft); return [[0, 0], [L / 2, 0], [L, 0], [L, Wd], [L / 2, Wd], [0, Wd]].map(([x, y]) => A.cam.proj(x, y, 0)); }
function steadyRef() {
  try {
    const x = steadyGrab(), h = STEADY.h, ref = [];
    for (const [px, py] of steadyPts()) {
      const cx = Math.round(px / 2), cy = Math.round(py / 2); if (cx - h < 0 || cy - h < 0 || cx + h > STEADY.cv.width || cy + h > STEADY.cv.height) { ref.push(null); continue; }
      const f = feat(x.getImageData(cx - h, cy - h, 2 * h, 2 * h).data, 4 * h * h); let m = 0; for (const v of f) m += v; m /= f.length; let sd = 0; for (const v of f) sd += (v - m) ** 2; sd = Math.sqrt(sd / f.length);
      ref.push(sd > 8 ? { cx, cy, f, m, sd } : null); // a flat patch (no edge in it) cannot show a move
    }
    STEADY.ref = ref; STEADY.quad0 = A.quad.map(p => p.slice()); STEADY.n = 0; STEADY.last = null;
    dbg('steady_ref', { patches: ref.filter(Boolean).length });
  } catch (e) { STEADY.ref = null; dbg('error', { m: 'steady ref ' + String(e).slice(0, 80) }); }
}
function ncc(f, m, sd, g, gw, ox, oy, h) {
  let s = 0, s2 = 0, sx = 0; const n = 4 * h * h;
  for (let y = 0; y < 2 * h; y++) { const row = (oy + y) * gw + ox; for (let x = 0; x < 2 * h; x++) { const v = g[row + x]; s += v; s2 += v * v; sx += v * f[y * 2 * h + x]; } }
  const gm = s / n, gsd = Math.sqrt(Math.max(1e-6, s2 / n - gm * gm)); return (sx / n - gm * m) / (gsd * sd);
}
function steady() {
  const R = STEADY.ref; if (!R || !A.cam) return;
  STEADY.n++; // every look, on the same picture the finder is about to see, so the balls and the outline move together
  const x = steadyGrab(), h = STEADY.h, S = STEADY.S, found = [];
  R.forEach((r, i) => {
    if (!r) return; const gw = 2 * (h + S), x0 = r.cx - h - S, y0 = r.cy - h - S;
    if (x0 < 0 || y0 < 0 || x0 + gw > STEADY.cv.width || y0 + gw > STEADY.cv.height) return;
    const g = feat(x.getImageData(x0, y0, gw, gw).data, gw * gw);
    let best = -2, bx = 0, by = 0;
    for (let dy = 0; dy <= 2 * S; dy += 2) for (let dx = 0; dx <= 2 * S; dx += 2) { const c = ncc(r.f, r.m, r.sd, g, gw, dx, dy, h); if (c > best) { best = c; bx = dx; by = dy; } }
    for (let dy = Math.max(0, by - 1); dy <= Math.min(2 * S, by + 1); dy++) for (let dx = Math.max(0, bx - 1); dx <= Math.min(2 * S, bx + 1); dx++) { const c = ncc(r.f, r.m, r.sd, g, gw, dx, dy, h); if (c > best) { best = c; bx = dx; by = dy; } }
    if (best >= 0.7) found.push({ i, x: r.cx * 2, y: r.cy * 2, dx: (bx - S) * 2, dy: (by - S) * 2, c: best });
  });
  if (found.length < 3) return;
  // the move most of them agree on (median), then only the ones near it; a plain shift is what a sway on a tripod does
  const med = a => { const b = a.slice().sort((p, q) => p - q); return b[b.length >> 1]; };
  const mx = med(found.map(f => f.dx)), my = med(found.map(f => f.dy)), ok = found.filter(f => Math.hypot(f.dx - mx, f.dy - my) <= 3);
  if (ok.length < 3) return;
  const dx = ok.reduce((a, f) => a + f.dx, 0) / ok.length, dy = ok.reduce((a, f) => a + f.dy, 0) / ok.length;
  const cur = A.quad[0], q0 = STEADY.quad0[0], moved = Math.hypot(q0[0] + dx - cur[0], q0[1] + dy - cur[1]);
  if (moved < 1.5) return; // no real change
  A.quad = STEADY.quad0.map(p => [p[0] + dx, p[1] + dy]);
  const { L, Wd } = tableDims(A.ft); A.cam = makeCam(tableCornersFor(A.rot, L, Wd), A.quad, A.W, A.H, LENS * Math.max(A.W, A.H), [A.W / 2, A.H / 2]);
  if (A.tk) A.tk.setBags(pocketBags(A.cam, A.P));
  A.box = [Math.max(0, A.box0[0] + dx), Math.max(0, A.box0[1] + dy), A.box0[2], A.box0[3]];
  STEADY.last = [r1(dx), r1(dy)]; dbgOnce('steady', 1000, { shift: STEADY.last, n: ok.length });
}
const dbgOnceT = {}; function dbgOnce(k, ms, d) { const t = Date.now(); if (dbgOnceT[k] && t - dbgOnceT[k] < ms) return; dbgOnceT[k] = t; dbg(k, d); }

// ---------- status ----------
function setStatus(t, sub) { const s = $('#status'); s.innerHTML = '<span>' + t + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '<div id="down"></div>'; renderDown(); }
function renderDown() { const d = $('#down'); if (!d || !A.tk) return; d.innerHTML = A.tk.S.gone.length ? A.tk.S.gone.map(n => '<span>' + (n === 0 ? 'cue' : n) + ' in</span>').join('') : ''; }
function statusRun() {
  const tk = A.tk, b = tk.balls(), sure = b.filter(x => x.num != null && x.sure).length, uns = b.filter(x => x.num != null && !x.sure).length, none = b.filter(x => x.num == null).length, hid = b.filter(x => x.state === 'hidden').length;
  const ms = A.timing.length ? Math.round(A.timing.reduce((a, x) => a + x, 0) / A.timing.length) : 0;
  const head = tk.S.phase === 'shot' ? 'Shot ' + tk.S.shot.n + ' · rolling…' : tk.S.phase === 'hands' ? 'Hands on the table…' : b.length ? 'Ready · ' + b.length + ' ball' + (b.length === 1 ? '' : 's') : 'Put the balls on the table';
  const sub = [sure ? sure + ' named' : '', uns ? uns + ' unsure' : '', none ? none + ' not named yet' : '', hid ? hid + ' hidden' : '', ms ? ms + ' ms a look' + (DET.ep === 'webgpu' ? ' (graphics chip)' : ' (' + DET.threads() + ' core' + (DET.threads() > 1 ? 's' : '') + ')') : ''].filter(Boolean).join(' · ');
  setStatus(head, sub + (none && tk.S.phase !== 'shot' ? ' · tap a ball to name it' : ''));
}

// ---------- the watcher (V3.1.0): every camera frame, a small copy of the table and the space above it ----------
// The ball finder looks about 4 times a second; a stroke, or a ball dropping in a pocket, happens between looks. The
// watcher takes every frame the camera gives (about 30 a second) at 320 px across. For now it only measures, to see if
// the phone keeps up while the finder runs: how much of the table is not cloth (a hand, the cue, a ball) and how much
// changed since the frame before, logged once a second. It keeps the last 2 s of frames, so a short clip goes into the
// debug file around each shot (2 s before the shot was seen to start, 2 s after) and each hand move: the owner's real
// strokes, to build stroke detection from.
const WATCH = { on: false, cv: document.createElement('canvas'), ec: document.createElement('canvas'), w: 320, h: 0, box: null, mask: null, ring: [], prev: null,
  n: 0, ms: 0, nc: 0, ch: 0, t1: 0, clips: [], nClips: 0, enc: Promise.resolve() };
function watchStart() {
  if (WATCH.on || !A.quad || !A.cam) return;
  const W = WATCH, xs = A.quad.map(p => p[0]), ys = A.quad.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys), bw = x1 - x0, bh = y1 - y0;
  // the table and what is beside and above it in the picture: the player and the cue
  const bx0 = Math.max(0, x0 - 0.08 * bw), bx1 = Math.min(A.W, x1 + 0.08 * bw), by0 = Math.max(0, y0 - 0.6 * bh), by1 = Math.min(A.H, y1 + 0.2 * bh);
  W.box = [Math.round(bx0), Math.round(by0), Math.max(16, Math.round(bx1 - bx0)), Math.max(16, Math.round(by1 - by0))];
  W.h = Math.max(16, Math.round(W.w * W.box[3] / W.box[2])); W.cv.width = W.ec.width = W.w; W.cv.height = W.ec.height = W.h;
  W.ctx = W.cv.getContext('2d', { willReadFrequently: true });
  // which of the sampled pixels (every other one) lie on the table, to count what is not cloth there
  const k = W.box[2] / W.w, q = A.quad, inQ = (x, y) => { let s0 = 0; for (let i = 0; i < 4; i++) { const a = q[i], b = q[(i + 1) % 4], c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c !== 0) { if (s0 && Math.sign(c) !== s0) return false; s0 = Math.sign(c); } } return true; };
  W.mask = new Uint8Array((W.w * W.h) >> 1); W.nMask = 0;
  for (let i = 0, j = 0; i < W.w * W.h - 1; i += 2, j++) { const x = W.box[0] + ((i % W.w) + 0.5) * k, y = W.box[1] + (Math.floor(i / W.w) + 0.5) * k; if (inQ(x, y)) { W.mask[j] = 1; W.nMask++; } }
  W.prev = null; W.ring = []; W.n = W.ms = W.nc = W.ch = 0; W.t1 = performance.now(); W.on = true;
  dbg('watch_start', { box: W.box, size: [W.w, W.h], rvfc: !!vid.requestVideoFrameCallback });
  const next = () => { if (!W.on) return; if (vid.requestVideoFrameCallback) vid.requestVideoFrameCallback(frame); else requestAnimationFrame(frame); };
  const frame = () => { if (!A.live || A.phase !== 'run') { W.on = false; dbg('watch_stop', {}); return; } try { watchFrame(); } catch (e) { dbg('error', { m: 'watch ' + String(e && e.message || e).slice(0, 120) }); } next(); };
  next();
}
const clothOf = (r, g, b) => { if (!A.cloth) return true; const [h, s] = rgb2hsv(r, g, b), d = Math.abs(((h - A.cloth.h) % 360 + 540) % 360 - 180); return s > 0.2 && d < 28; };
function watchFrame() {
  const W = WATCH, t0 = performance.now(); if (document.hidden || !vid.videoWidth) return;
  W.ctx.drawImage(vid, W.box[0], W.box[1], W.box[2], W.box[3], 0, 0, W.w, W.h);
  const img = W.ctx.getImageData(0, 0, W.w, W.h), d = img.data, n = W.w * W.h, cur = new Uint8Array(n >> 1), prev = W.prev;
  let nc = 0, ch = 0;
  for (let i = 0, j = 0; i < n - 1; i += 2, j++) {
    const o = i * 4, r = d[o], g = d[o + 1], b = d[o + 2], y = (r * 77 + g * 150 + b * 29) >> 8; cur[j] = y;
    if (prev && Math.abs(y - prev[j]) > 24) ch++;
    if (W.mask[j] && !clothOf(r, g, b)) nc++;
  }
  W.prev = cur;
  const t = Date.now() - DBG.t0, fr = { t, img, nc: W.nMask ? nc / W.nMask : 0, ch: ch / (n >> 1) };
  // in the stroke test every frame, 4 s back, and a close-up of the cue ball at the camera's full size (the end-on cue
  // toward the phone was a pixel or two wide in the table view); in play every other frame (15 a second), 2 s back, so a
  // session's debug file stays a size that uploads (about 0.5 MB a shot)
  W.fc = (W.fc || 0) + 1;
  if (A.test || W.fc % 2 === 0) {
    if (A.test) fr.cu = closeUp();
    W.ring.push(fr); const keep = A.test ? 4100 : 2100; while (W.ring.length && t - W.ring[0].t > keep) W.ring.shift();
  }
  for (const c of W.clips) if (!c.done && t <= c.until && (A.test || W.fc % 2 === 0)) c.frames.push(fr);
  for (const c of W.clips) if (!c.done && t > c.until) clipEnd(c);
  W.clips = W.clips.filter(c => !c.done);
  W.n++; W.ms += performance.now() - t0; W.nc += fr.nc; W.ch += fr.ch;
  const now = performance.now();
  if (now - W.t1 >= 1000) { const ms = A.timing.length ? A.timing.reduce((a, x) => a + x, 0) / A.timing.length : 0;
    dbg('watch', { fps: r1(W.n * 1000 / (now - W.t1)), ms: r1(W.ms / Math.max(1, W.n)), nc: r2(W.nc / Math.max(1, W.n)), ch: r2(W.ch / Math.max(1, W.n)), find: Math.round(ms) });
    W.n = W.ms = W.nc = W.ch = 0; W.t1 = now; }
}
// the cue ball's surroundings at full size: 200 x 200 picture pixels on its spot (it rests there before the stroke)
const CU = 200;
function closeUp() {
  const W = WATCH, cb = A.tk && A.tk.balls().find(b => b.num === 0 && b.state !== 'hidden'); if (!cb || !A.cam) return null;
  const p = A.cam.proj(cb.x, cb.y, A.P.R), x0 = Math.max(0, Math.min(A.W - CU, Math.round(p[0] - CU / 2))), y0 = Math.max(0, Math.min(A.H - CU, Math.round(p[1] - CU / 2)));
  const c = W.cu || (W.cu = document.createElement('canvas')); if (c.width !== CU) { c.width = c.height = CU; W.cux = c.getContext('2d', { willReadFrequently: true }); }
  W.cux.drawImage(vid, x0, y0, CU, CU, 0, 0, CU, CU); return { img: W.cux.getImageData(0, 0, CU, CU), x0, y0 };
}
// a clip: the frames from pre ms ago to post ms on, written as small pictures with an index once it is over
function clipStart(name, pre, post, label) {
  const W = WATCH; if (!W.on || W.nClips >= 400) return; W.nClips++;
  const t = Date.now() - DBG.t0; W.clips.push({ name, label: label || null, t, until: t + post, frames: W.ring.filter(f => t - f.t <= pre) });
}
function clipEnd(c) {
  c.done = true; const W = WATCH, sid = DBG.t0, frames = c.frames; c.frames = null;
  W.enc = W.enc.then(async () => {
    const files = [], idx = [], cus = [], x = W.ec.getContext('2d');
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]; if (f.img.width !== W.ec.width || f.img.height !== W.ec.height) continue; x.putImageData(f.img, 0, 0);
      // (toDataURL, not toBlob: Chromium makes toBlob wait for idle time, which a busy finder never leaves)
      const u = W.ec.toDataURL('image/jpeg', 0.6), bin = atob(u.slice(u.indexOf(',') + 1)), data = new Uint8Array(bin.length); for (let j = 0; j < bin.length; j++) data[j] = bin.charCodeAt(j);
      const nm = String(i).padStart(3, '0') + '.jpg'; files.push({ name: 'clips/' + c.name + '/' + nm, data }); idx.push([nm, f.t, r2(f.nc), r2(f.ch)]);
      if (f.cu) { const e2 = W.ecu || (W.ecu = document.createElement('canvas')); e2.width = e2.height = CU; e2.getContext('2d').putImageData(f.cu.img, 0, 0);
        const u2 = e2.toDataURL('image/jpeg', 0.7), b2 = atob(u2.slice(u2.indexOf(',') + 1)), d2 = new Uint8Array(b2.length); for (let j = 0; j < b2.length; j++) d2[j] = b2.charCodeAt(j);
        files.push({ name: 'clips/' + c.name + '/c' + nm, data: d2 }); cus.push(['c' + nm, f.t, f.cu.x0, f.cu.y0]); }
      if (i % 8 === 7) await sleep(0); // a breath for the looks between batches
    }
    files.push({ name: 'clips/' + c.name + '/index.json', data: new TextEncoder().encode(JSON.stringify({ name: c.name, label: c.label, at: c.t, box: WATCH.box, size: [W.w, W.h], frames: ['file', 'ms', 'notCloth', 'changed'], list: idx, closeUp: cus.length ? { size: [CU, CU], frames: ['file', 'ms', 'x0', 'y0'], list: cus } : null })) });
    await STORE.putMany(sid, files);
    dbg('clip', { name: c.name, frames: idx.length, kb: Math.round(files.reduce((a, f) => a + f.data.length, 0) / 1024), label: c.label });
  }).catch(e => dbg('error', { m: 'clip ' + String(e && e.message || e).slice(0, 100) }));
}

// ---------- stroke test (V3.1.0, set out with the owner Oct 31) ----------
// Four stations, the cue ball and the 1 re-spotted each time, 6 shots each, so the clips show the stroke from across the
// picture (both ways), toward the phone and away from it; then the moves that are not shots. Spots are in diamonds: along
// the table from the left end as the phone sees it, and out from the long rail nearest the phone. Each is drawn as a ring
// lying on the cloth (an oval from the phone, owner Oct 31: a ring drawn flat on the screen did not show where the ball
// really had to be) that turns green when the app sees a ball sitting on that spot.
const STATIONS = [
  { name: 'Shooting right', cue: [4, 2], obj: [6, 3], pocket: 'far right corner', stand: 'at the corner nearest the phone, on the left' },
  { name: 'Shooting left', cue: [4, 2], obj: [2, 3], pocket: 'far left corner', stand: 'at the corner nearest the phone, on the right' },
  { name: 'Toward the phone', cue: [4, 3], obj: [4, 1.5], pocket: 'side pocket by the phone', stand: 'at the far rail, facing the phone' },
  { name: 'Away from the phone', cue: [5, 1], obj: [4.5, 2.5], pocket: 'far side pocket', stand: 'at the near rail, just right of the phone' }];
const MOVES = ['Get down, take practice strokes, then stand up without shooting', 'Get down, take practice strokes, then stand up without shooting', 'Get down, take practice strokes, then stand up without shooting',
  'Roll the cue ball into place by hand', 'Roll the cue ball into place by hand', 'Push the cue ball a few inches with the cue shaft', 'Push the cue ball a few inches with the cue shaft'];
const TEST_SHOTS = 6;
const SHORT = ['Practice strokes, stand up', 'Practice strokes, stand up', 'Practice strokes, stand up', 'Roll the cue ball into place', 'Roll the cue ball into place', 'Push the cue ball with the shaft', 'Push the cue ball with the shaft'];
function testXY([dx, dy]) { // diamonds as the phone sees the table -> table inches
  const P = A.P, dia = P.L / 8, nearY = A.cam.proj(P.L / 2, 0, 0)[1] > A.cam.proj(P.L / 2, P.W, 0)[1] ? 0 : P.W, leftX = A.cam.proj(0, P.W / 2, 0)[0] < A.cam.proj(P.L, P.W / 2, 0)[0] ? 0 : P.L;
  return [leftX === 0 ? dx * dia : P.L - dx * dia, nearY === 0 ? dy * dia : P.W - dy * dia];
}
function testStart() { audioOn(); A.test = { st: 0, tries: [0, 0, 0, 0], move: 0, last: null, cd: null, chimed: false }; A.tk.O.autoRack = false; dbg('test', { st: 1 }); testCard(); }
// (V3.1.1, owner after the first run: the test goes on by itself.) A shot at a station is an attempt when the cue ball
// reached another ball or something went in: the cue ball put back on its spot by hand is not one. After the sixth the
// next station comes up, with a beep.
function testShotEnd(sh) {
  const T = A.test; if (!T || !sh.test || sh.test.station > 4 || sh.test.station !== T.st + 1) return;
  // (V3.1.2: or anything besides the cue ball changed: the 1 moved, went out of sight or in, its call maybe still to come;
  // Nov 1, only 6 of 18 shots counted when the first ball hit had to be known)
  T.chimed = false;
  const ok = sh.first != null || sh.made.length > 0 || A.tk.changed(sh); dbg('test_attempt', { n: sh.n, station: sh.test.station, try: sh.test.try, ok });
  if (!ok) { sh.test.notAttempt = true; return; }
  T.tries[T.st]++; T.last = sh;
  if (T.tries[T.st] >= TEST_SHOTS) { T.st++; dbg('test', { st: T.st + 1, auto: true }); beep(2); toast(T.st < 4 ? 'Station ' + (T.st + 1) + ': ' + STATIONS[T.st].name : 'Station 5: moves that are not shots'); }
  testCard();
}
// Retry: the last attempt is thrown out (its shot and clip are marked so), and it is shot again
function testRetry() {
  const T = A.test, sh = T && T.last; if (!sh) return; const st = sh.test.station - 1;
  sh.test.discarded = true; T.tries[st] = Math.max(0, T.tries[st] - 1); T.st = st; T.last = null; dbg('test_retry', { n: sh.n, station: st + 1, try: sh.test.try }); toast('Thrown out: shot it again'); testCard();
}
// a short beep from the speaker (not the microphone): n beeps, or one long one. Safari plays sound only once a tap has
// started it, so the Stroke test tap starts it (audioOn)
let AUD = null;
function audioOn() { try { AUD = AUD || new (window.AudioContext || window.webkitAudioContext)(); if (AUD.state === 'suspended') AUD.resume(); } catch (e) { } }
function chime() { try { audioOn(); [784, 1175].forEach((f, i) => { const o = AUD.createOscillator(), g = AUD.createGain(), t = AUD.currentTime + i * 0.14; o.frequency.value = f; g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3); o.connect(g).connect(AUD.destination); o.start(t); o.stop(t + 0.32); }); } catch (e) { } }
function beep(n, long) {
  try { AUD = AUD || new (window.AudioContext || window.webkitAudioContext)(); if (AUD.state === 'suspended') AUD.resume();
    for (let i = 0; i < (n || 1); i++) { const o = AUD.createOscillator(), g = AUD.createGain(), t = AUD.currentTime + i * 0.18; o.frequency.value = long ? 660 : 880; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + (long ? 0.6 : 0.12)); o.connect(g).connect(AUD.destination); o.start(t); o.stop(t + (long ? 0.65 : 0.14)); }
  } catch (e) { }
}
function testStop() { dbg('test_end', { tries: A.test && A.test.tries, moves: A.test && A.test.move }); if (A.test) A.test.cd = null; A.test = null; if (A.tk) A.tk.O.autoRack = true; hideCard(); }
function testCard() {
  const T = A.test; if (!T) return;
  const nav = (T.last ? '<button class="btn" data-act="test_retry">Retry</button>' : '') + (T.st > 0 ? '<button class="btn" data-act="test_back">Back</button>' : '') + (T.st < 4 ? '<button class="btn" data-act="test_next">Next</button>' : '') + '<button class="btn" data-act="test_close">' + (T.st < 4 ? 'Close' : 'Finish') + '</button>';
  // (V3.1.2, owner: the rings and the line say where everything goes; the card only needs the pace)
  if (T.st < 4) {
    const k = T.tries[T.st];
    showCard('<div class="pace">' + (k >= TEST_SHOTS ? 'Done' : k < 2 ? 'Soft' : k < 4 ? 'Medium' : 'Firm') + '</div><div class="lbl">Station ' + (T.st + 1) + ' of 5 · shot ' + Math.min(k + 1, TEST_SHOTS) + ' of ' + TEST_SHOTS + '</div><div class="row">' + nav + '</div>', true, 'tst');
  } else {
    const m = T.move;
    const busy = T.cd && T.cd.phase !== 'done';
    showCard('<div class="pace">' + (m < MOVES.length || busy ? SHORT[busy ? T.cd.move : m] : 'Done') + '</div><div class="lbl">Station 5 of 5 · ' + (busy ? (T.cd.phase === 'wait' ? 'get set' : 'recording') : m < MOVES.length ? 'move ' + (m + 1) + ' of ' + MOVES.length + ': tap Record' : 'tap Finish, then End session and Save debug') + '</div><div class="row">' +
      (!busy && m < MOVES.length ? '<button class="btn primary" data-act="test_rec">Record</button>' : '') + (busy ? '' : nav) + '</div>', true, 'tst');
  }
}
// Record (V3.1.1, owner: time to walk over and get set): a 10 s countdown on screen, a beep, 8 s recorded (and the second
// before the beep), a long beep at the end
const CD_WAIT = 10000, CD_REC = 8000;
function testRec() {
  const T = A.test; if (!T || T.st !== 4 || T.move >= MOVES.length || (T.cd && T.cd.phase !== 'done')) return;
  const mv = T.move, label = { station: 5, move: mv + 1, what: MOVES[mv] }; beep(1); // (the first sound comes from the tap: Safari allows sound after one)
  T.cd = { phase: 'wait', move: mv, go: performance.now() + CD_WAIT }; testCard();
  setTimeout(() => { if (A.test !== T) return; T.cd.phase = 'rec'; T.cd.end = performance.now() + CD_REC; beep(1); clipStart('move-' + String(mv + 1).padStart(2, '0'), 1000, CD_REC, label); dbg('test_move', label); testCard(); }, CD_WAIT);
  setTimeout(() => { if (A.test !== T) return; T.cd.phase = 'done'; T.move = mv + 1; beep(1, true); testCard(); }, CD_WAIT + CD_REC);
}
// the countdown, large in the middle of the screen
function drawCountdown(c, F) {
  const T = A.test, cd = T && T.cd; if (!cd || cd.phase === 'done') return;
  const left = Math.max(0, Math.ceil(((cd.phase === 'wait' ? cd.go : cd.end) - performance.now()) / 1000));
  c.save(); c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 ' + Math.round(Math.min(F.w, F.h) * 0.28) + 'px ' + getComputedStyle(document.body).fontFamily;
  c.fillStyle = cd.phase === 'wait' ? 'rgba(255,184,77,.92)' : 'rgba(255,77,77,.92)'; c.fillText(cd.phase === 'wait' ? String(left) : '● ' + left, F.w / 2, F.h * 0.45);
  c.font = '600 ' + Math.round(Math.min(F.w, F.h) * 0.06) + 'px ' + getComputedStyle(document.body).fontFamily; c.fillText(cd.phase === 'wait' ? 'get set' : 'recording', F.w / 2, F.h * 0.45 + Math.min(F.w, F.h) * 0.2); c.restore();
}
// a spot is taken when a ball sits within its ring (V3.1.2, owner: 1.6 in was far too fussy to set up to while looking back
// at the screen; now 4 in each way): the cue ball's ring takes the cue ball or a ball not yet named
const RING = 4;
function testTaken(x, y, cue) { return A.tk.balls().some(b => b.state !== 'hidden' && Math.hypot(b.x - x, b.y - y) < RING && (cue ? b.num === 0 || b.num == null : b.num !== 0)); }
function drawTest(c, S2) {
  const T = A.test; if (!T) return;
  const S = T.st < 4 ? STATIONS[T.st] : { cue: [4, 2] }, cue = testXY(S.cue), obj = S.obj ? testXY(S.obj) : null;
  const flat = (x, y) => S2(A.cam.proj(x, y, 0));
  if (obj) { const pk = [2 * obj[0] - cue[0], 2 * obj[1] - cue[1]], a = flat(cue[0], cue[1]), b = flat(pk[0], pk[1]); c.save(); c.setLineDash([6, 6]); c.strokeStyle = 'rgba(234,241,244,.45)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.restore(); }
  let all = !!obj;
  for (const [p, col, lab, isCue] of [[cue, '#f4f1e8', 'cue', true], [obj, '#e8c11d', '1', false]]) {
    if (!p) continue; const ok = testTaken(p[0], p[1], isCue), colr = ok ? '#3ddc84' : col; if (!ok) all = false;
    c.strokeStyle = colr; c.lineWidth = 2.5; c.beginPath();
    for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2, s = flat(p[0] + RING * Math.cos(a), p[1] + RING * Math.sin(a)); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }
    c.stroke(); const m = flat(p[0], p[1]); c.fillStyle = colr; c.beginPath(); c.arc(m[0], m[1], 2.5, 0, Math.PI * 2); c.fill();
    const top = flat(p[0], p[1] + (A.cam.proj(p[0], p[1] + 2, 0)[1] < A.cam.proj(p[0], p[1], 0)[1] ? RING + 0.6 : -RING - 0.6)); c.font = '600 12px ' + getComputedStyle(document.body).fontFamily; c.textAlign = 'center'; c.fillText(lab, top[0], top[1] - 4);
  }
  // both balls on their spots: a chime, once for each shot, so the owner can set up looking at the table
  if (all && !T.chimed && T.st < 4 && A.tk.S.phase !== 'shot') { T.chimed = true; chime(); }
}

// ---------- drawing ----------
function fit() { const w = ov.clientWidth, h = ov.clientHeight, k = Math.min(w / (A.W || 1), h / (A.H || 1)); return { k, x: (w - A.W * k) / 2, y: (h - A.H * k) / 2, w, h }; }
function drawLoop() {
  if (!A.live) return; requestAnimationFrame(drawLoop);
  const dpr = window.devicePixelRatio || 1, F = fit(); if (!A.W) return;
  if (ov.width !== Math.round(F.w * dpr) || ov.height !== Math.round(F.h * dpr)) { ov.width = Math.round(F.w * dpr); ov.height = Math.round(F.h * dpr); }
  const c = ov.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, F.w, F.h);
  const S2 = p => [F.x + p[0] * F.k, F.y + p[1] * F.k];
  if (A.frozen && A.frame.width) c.drawImage(A.frame, F.x, F.y, A.W * F.k, A.H * F.k); // the still picture over the live one
  // the table outline: the candidate while checking it, the accepted one (faint) while watching
  const q = A.phase === 'verify' && A.cand ? A.cand.quad : A.phase === 'run' || A.phase === 'load' ? A.quad : null;
  if (q) {
    c.strokeStyle = A.phase === 'verify' ? 'rgba(89,214,232,.95)' : 'rgba(89,214,232,.28)'; c.lineWidth = A.phase === 'verify' ? 2.5 : 1.2; c.beginPath();
    q.forEach((p, i) => { const s = S2(p); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.closePath(); c.stroke();
    if (A.phase === 'verify') for (const p of q) { const s = S2(p); c.fillStyle = '#59d6e8'; c.beginPath(); c.arc(s[0], s[1], 6, 0, Math.PI * 2); c.fill(); }
  }
  if (A.phase === 'manual' && A.man) drawManual(c, S2, F);
  if (A.phase !== 'run' || !A.tk || !A.cam) return;
  drawTest(c, S2); drawBalls(c, S2, F); drawCountdown(c, F);
}

function drawManual(c, S2, F) {
  const m = A.man; if (m.length === 4) { const q = orderQuad(m); c.strokeStyle = 'rgba(255,184,77,.9)'; c.lineWidth = 1.2; c.beginPath(); q.forEach((p, i) => { const s = S2(p); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.closePath(); c.stroke(); }
  for (const p of m) { const s = S2(p); c.strokeStyle = '#ffb84d'; c.lineWidth = 1.5; c.beginPath(); c.arc(s[0], s[1], 9, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(s[0] - 13, s[1]); c.lineTo(s[0] + 13, s[1]); c.moveTo(s[0], s[1] - 13); c.lineTo(s[0], s[1] + 13); c.stroke(); }
  // the magnifier: 4x the picture around the corner being placed, above the finger so the finger does not hide it
  const d = A.drag; if (!d || !m[d.i]) return;
  const rc = ov.getBoundingClientRect(), p = m[d.i], R = 58, Z = 4, cx = d.fx - rc.left, cy = Math.max(R + 8, d.fy - rc.top - R - 46);
  c.save(); c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
  const sw = 2 * R / (Z * F.k); c.drawImage(A.frame, p[0] - sw / 2, p[1] - sw / 2, sw, sw, cx - R, cy - R, 2 * R, 2 * R);
  c.strokeStyle = '#ffb84d'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.moveTo(cx, cy - R); c.lineTo(cx, cy + R); c.stroke(); c.restore();
  c.strokeStyle = 'rgba(234,241,244,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
}

// Each ball: a thin ring just outside it (dashed while hidden) and a small label above. A rolling ball is drawn where it
// should be by now (its last spot plus its speed times the time since that look, at most 0.3 s on and not past a
// cushion), so the ring moves with the ball between looks instead of jumping after it. Labels that would cover another
// label or ball try the other sides; in a tight bunch they go further out on a thin leader line. A label keeps the side it
// had while that side stays free, so labels do not jump from look to look.
const LAB = new Map(); // ball key -> side index it used last
const TAILV = new Map(); // ball key -> the speed its tail is drawn for
function drawBalls(c, S2, F) {
  const tk = A.tk, P = A.P, now = performance.now() / 1000, items = [];
  for (const b of tk.balls()) {
    let x = b.x, y = b.y;
    if (b.state === 'moving') { const dt = Math.min(0.3, Math.max(0, now - tk.S.t)); x = Math.min(P.L - P.R, Math.max(P.R, x + b.vx * dt)); y = Math.min(P.W - P.R, Math.max(P.R, y + b.vy * dt)); }
    const s = S2(A.cam.proj(x, y, P.R)), r = Math.max(5, A.cam.ballRad(x, y, P.R, P.R) * F.k) + 1;
    const col = b.num == null ? 'rgba(234,241,244,.75)' : b.sure ? '#59d6e8' : '#ffb84d';
    const t = b.num == null ? '?' : (b.num === 0 ? 'Q' : String(b.num)) + (b.sure ? '' : '?');
    items.push({ b, s, r, col, t, tx: x, ty: y });
  }
  // Trails, in each ball's own colour (a banded ball's alternates white and its colour), from the tracker's own positions,
  // so a jagged one means a tracking problem: a thin line for the whole of the ball's path in the shot, kept until the
  // next shot starts, and over it a tail behind a rolling ball, solid at the ball and fading and narrowing behind it,
  // longer the faster the ball goes and shrinking away as it stops.
  const pathCol = (key, num) => { const cl = BCOL.get(key), base = cl && cl.rgb ? 'rgb(' + cl.rgb.join(',') + ')' : num != null ? BALLCOL[num] : '#eaf1f4';
    return { col: cl && cl.white || num === 0 ? '#f4f1e8' : cl && cl.black || num === 8 ? '#0c0d0f' : base, band: cl ? cl.band : num === 9 }; };
  const line = (pts, w, a, pc) => { if (pts.length < 2) return; c.globalAlpha = a; c.lineWidth = w; c.beginPath(); pts.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]));
    c.setLineDash([]); c.strokeStyle = pc.band ? '#f4f1e8' : pc.col; c.stroke(); if (pc.band) { c.setLineDash([5, 5]); c.strokeStyle = pc.col; c.stroke(); c.setLineDash([]); } };
  c.lineCap = 'round'; c.lineJoin = 'round';
  const dtv = Math.min(0.1, Math.max(0, now - (A.tailT || now))); A.tailT = now;
  for (const [key, e] of PATH) {
    if (e.pts.length < 2 || moved(e.pts) < 1) continue;
    const it = items.find(i => i.b.key === key), pc = pathCol(key, it ? it.b.num : e.num), proj = q => S2(A.cam.proj(q.x, q.y, P.R));
    const pts = e.pts.map(q => ({ x: q.x, y: q.y })); if (it && it.b.state !== 'hidden') pts.push({ x: it.tx, y: it.ty });
    line(pts.map(proj), 1.3, 0.6, pc);
    // a dot where the ball started, about half an inch across (a ball is 2 1/4 in)
    const s0 = proj(pts[0]), rd = Math.max(2, A.cam.ballRad(pts[0].x, pts[0].y, P.R, 0.25) * F.k);
    c.globalAlpha = 0.9; c.fillStyle = pc.col; c.strokeStyle = pc.col === '#0c0d0f' ? 'rgba(244,241,232,.8)' : 'rgba(11,16,20,.7)'; c.lineWidth = 1;
    c.beginPath(); c.arc(s0[0], s0[1], rd, 0, Math.PI * 2); c.fill(); c.stroke();
    // the tail: its length in inches follows the ball's speed (smoothed, so it grows and shrinks rather than jumps)
    const v = it && it.b.state === 'moving' ? Math.hypot(it.b.vx, it.b.vy) : 0, tv = TAILV.get(key) || 0, sv = tv + (v - tv) * Math.min(1, dtv * 5); TAILV.set(key, sv);
    let len = Math.min(40, sv * 0.45); if (len < 0.5 || !it) continue;
    const tail = [pts[pts.length - 1]];
    for (let i = pts.length - 2; i >= 0 && len > 0; i--) { const a = tail[tail.length - 1], b = pts[i], d = Math.hypot(b.x - a.x, b.y - a.y); if (d <= len) { tail.push(b); len -= d; } else { tail.push({ x: a.x + (b.x - a.x) * len / d, y: a.y + (b.y - a.y) * len / d }); len = 0; } }
    const sp = tail.map(proj), wMax = Math.max(2, it.r * 0.45), n = sp.length - 1;
    for (let i = 1; i <= n; i++) { const u = (i - 0.5) / n; line([sp[i - 1], sp[i]], wMax * (1 - u) + 1.3 * u, 0.95 * (1 - u) + 0.25 * u, pc); }
  }
  for (const k of [...TAILV.keys()]) if (!PATH.has(k)) TAILV.delete(k);
  c.globalAlpha = 1; c.setLineDash([]); c.lineCap = 'butt'; c.lineJoin = 'miter';
  c.lineWidth = 1.3;
  for (const it of items) { c.strokeStyle = it.col; c.setLineDash(it.b.state === 'hidden' || it.b.state === 'pending' ? [3, 3] : []); c.beginPath(); c.arc(it.s[0], it.s[1], it.r, 0, Math.PI * 2); c.stroke(); }
  c.setLineDash([]);
  c.font = '600 11px system-ui, -apple-system, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const H = 14, placed = [], hit = (a, q) => a.x < q.x + q.w && q.x < a.x + a.w && a.y < q.y + q.h && q.y < a.y + a.h;
  const free = box => box.x >= 0 && box.y >= 0 && box.x + box.w <= F.w && box.y + box.h <= F.h && !placed.some(q => hit(box, q)) &&
    !items.some(o => { const cx = Math.max(box.x, Math.min(o.s[0], box.x + box.w)), cy = Math.max(box.y, Math.min(o.s[1], box.y + box.h)); return Math.hypot(cx - o.s[0], cy - o.s[1]) < o.r; });
  // sides: above, upper right, upper left, right, left, below; then the same further out (with a leader line)
  const DIRS = [[0, -1], [0.75, -0.75], [-0.75, -0.75], [1, 0], [-1, 0], [0, 1]];
  const at = (it, k) => { const far = k >= DIRS.length, [dx, dy] = DIRS[k % DIRS.length], w = c.measureText(it.t).width + 8, g = it.r + (far ? 2.6 * H : 2);
    const cx = it.s[0] + dx * (g + w / 2 * Math.abs(dx)), cy = it.s[1] + dy * (g + H / 2 * Math.abs(dy)); return { x: cx - w / 2, y: cy - H / 2, w, h: H, cx, cy, far }; };
  // bunched balls first, so they get first choice of the free sides
  const crowd = it => items.filter(o => o !== it && Math.hypot(o.s[0] - it.s[0], o.s[1] - it.s[1]) < 4 * it.r).length;
  for (const it of items.slice().sort((a, b) => crowd(b) - crowd(a))) {
    const last = LAB.get(it.b.key), order = [...Array(DIRS.length * 2).keys()]; if (last != null) { order.splice(order.indexOf(last), 1); order.unshift(last); }
    let box = null, k0 = 0; for (const k of order) { const q = at(it, k); if (free(q)) { box = q; k0 = k; break; } }
    if (!box) { box = at(it, 0); k0 = 0; } // nowhere free: above, as before
    LAB.set(it.b.key, k0); placed.push(box);
    if (box.far) { c.strokeStyle = it.col; c.lineWidth = 1; c.beginPath(); const a = Math.atan2(box.cy - it.s[1], box.cx - it.s[0]); c.moveTo(it.s[0] + Math.cos(a) * it.r, it.s[1] + Math.sin(a) * it.r); c.lineTo(box.cx - Math.cos(a) * Math.min(box.w / 2, H / 2), box.cy - Math.sin(a) * H / 2); c.stroke(); }
    c.fillStyle = 'rgba(11,16,20,.8)'; c.fillRect(box.x, box.y, box.w, box.h);
    c.fillStyle = it.col; c.fillText(it.t, box.cx, box.cy + 0.5);
  }
  for (const k of [...LAB.keys()]) if (!items.some(it => it.b.key === k)) LAB.delete(k);
}

// ---------- taps: name a ball ----------
// a finger on the screen shakes the phone a little: the tracker does not start a shot for a moment after one
ov.addEventListener('pointerdown', () => { if (A.tk) A.tk.touched(); });
ov.addEventListener('click', e => {
  const F = fit(), rc = ov.getBoundingClientRect(), x = (e.clientX - rc.left - F.x) / F.k, y = (e.clientY - rc.top - F.y) / F.k;
  if (A.phase !== 'run' || !A.tk) return;
  let best = null, bd = 1e9;
  for (const b of A.tk.balls()) { const p = A.cam.proj(b.x, b.y, A.P.R), d = Math.hypot(p[0] - x, p[1] - y), r = A.cam.ballRad(b.x, b.y, A.P.R, A.P.R); if (d < Math.max(30 / F.k, 2.6 * r) && d < bd) { bd = d; best = b; } }
  if (best) openPick(best);
});
function openPick(b) {
  A.pick = b.key; $('#pickTitle').textContent = b.num == null ? 'Which ball is this?' : 'This is the ' + (b.num === 0 ? 'cue ball' : b.num) + (b.sure ? '' : '?') + ' · which ball is it?';
  const g = $('#pickGrid'); g.innerHTML = '';
  for (const n of A.tk.O.ids) {
    const btn = document.createElement('button'); btn.className = 'chip' + (n === b.num ? ' on' : '');
    btn.innerHTML = '<i style="background:' + BALLCOL[n] + (n === 9 ? ';box-shadow:inset 0 0 0 3px #f4f1e8' : n === 0 ? ';background-image:radial-gradient(circle at 35% 35%, #d03a2f 0 2px, transparent 2.5px),radial-gradient(circle at 70% 65%, #d03a2f 0 2px, transparent 2.5px)' : '') + '"></i>' + (n === 0 ? 'Cue' : n);
    btn.onclick = () => pickBall(n); g.appendChild(btn);
  }
  $('#sheet').hidden = false;
}
function closePick() { $('#sheet').hidden = true; A.pick = null; }
function pickBall(n) {
  const b = A.tk.S.tracks.find(t => t.key === A.pick); closePick(); if (!b) return;
  const was = b.num; saveTap(b, n, was); A.tk.pin(b.key, n); dbg('tap', { key: b.key, num: n, was, at: [r1(b.x), r1(b.y)] });
  toast(n === was ? 'Kept: the ' + (n === 0 ? 'cue ball' : n) : 'Renamed: the ' + (n === 0 ? 'cue ball' : n) + (was != null ? ' (was ' + (was === 0 ? 'cue' : was) + ')' : ''));
}
$('#pickNot').onclick = () => { const k = A.pick, b = A.tk.S.tracks.find(t => t.key === k); closePick(); if (b) { saveTap(b, 'not', b.num); A.tk.notBall(k); dbg('tap_not', { key: k }); toast('Removed: not a ball'); } };
$('#pickPocket').onclick = () => { const k = A.pick; closePick(); A.tk.inPocket(k); dbg('tap_pocketed', { key: k }); toast('Marked as in a pocket'); };
$('#pickCancel').onclick = closePick;
$('#sheet').addEventListener('click', e => { if (e.target.id === 'sheet') closePick(); });
// every tap is a labelled picture of one of the owner's balls: kept for retraining the reader
function saveTap(b, label, was) {
  const sp = b.sp; if (!sp || !A.fctx) return;
  try {
    const s = Math.ceil(3.2 * Math.max(3, sp.r)), x0 = Math.floor(sp.px - s / 2), y0 = Math.floor(sp.py - s / 2), c = document.createElement('canvas'); c.width = c.height = s;
    c.getContext('2d').drawImage(A.frame, x0, y0, s, s, 0, 0, s, s);
    c.toBlob(bl => bl && bl.arrayBuffer().then(a => { const t = { n: A.taps.length + 1, t: Date.now() - DBG.t0, label, was, px: r1(sp.px), py: r1(sp.py), r: r1(sp.r), p: sp.p ? sp.p.map(v => r2(v)) : null, png: new Uint8Array(a) }; A.taps.push(t); STORE.put(DBG.t0, tapName(t), t.png); if (A.taps.length > 400) A.taps.shift(); }), 'image/png');
  } catch (e) { }
}

// ---------- cards, menu, toast ----------
function showCard(html, mini, cls) { const c = $('#card'); c.innerHTML = html; c.hidden = false; c.classList.toggle('mini', !!mini); c.classList.toggle('tst', cls === 'tst'); $('#cam').classList.toggle('manual', !!mini); }
function hideCard() { $('#card').hidden = true; $('#cam').classList.remove('manual'); }
$('#card').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.ft) { A.ft = +b.dataset.ft; save(); A.P = makeP(A.ft); A.tk = makeTracker(A.P); A.nShots = 0; dbg('ft', { ft: A.ft }); refind('Table size ' + A.ft + ' ft: looking again…'); return; }
  const a = b.dataset.act;
  if (a === 'accept') acceptTable(); else if (a === 'retry') refind(); else if (a === 'manual') beginManual();
  else if (a === 'undo') { if (A.man && A.man.length) A.man.pop(); if (A.man) manualCard(); }
  else if (a === 'home') goHome(); else if (a === 'close') hideCard(); else if (a === 'refind') { hideCard(); refind(); }
  else if (a === 'dbg') saveDebug(b); else if (a === 'useman') useManual();
  else if (a === 'test') { if (A.test) testCard(); else testStart(); } else if (a === 'test_close') testStop(); else if (a === 'test_rec') testRec();
  else if (a === 'test_retry') testRetry();
  else if (a === 'test_next' && A.test) { A.test.st = Math.min(4, A.test.st + 1); dbg('test', { st: A.test.st + 1 }); testCard(); }
  else if (a === 'test_back' && A.test) { A.test.st = Math.max(0, A.test.st - 1); dbg('test', { st: A.test.st + 1 }); testCard(); }
});
$('#menuBtn').onclick = () => showCard('<div><b>Menu</b><p>' + (A.tk ? A.tk.S.shots.length + ' shots so far.' : '') + '</p></div><div class="row"><button class="btn" data-act="test">Stroke test</button><button class="btn" data-act="refind">Find the table again</button><button class="btn" data-act="dbg">Save debug</button><button class="btn" data-act="home">Home</button><button class="btn" data-act="close">Close</button></div>');
// (pressed again after the rack was done by itself, or twice: no shot since, so it is not another rack)
$('#rackBtn').onclick = () => { if (!A.tk) return; const dup = A.tk.S.setup && A.tk.S.shots.length === A.tk.S.rackAt; A.tk.newRack(); flushShots(); PATH.clear(); dbg('new_rack', dup ? { dup: true } : {}); toast('New rack. Names come once the break spreads the balls.'); };
let toastT = 0;
function toast(t) { dbg('toast', { s: t }); const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { e.hidden = true; }, 3500); }

// ---------- Save debug: one zip (log, shot pictures, tapped balls). Two taps: iPhone only shares right after a tap. ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF, dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.data, crc = crc32(data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(h.buffer, name, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    central.push(c.buffer, name); off += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((a, b) => a + (b.byteLength || b.length), 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob(parts.concat(central, [e.buffer]), { type: 'application/zip' });
}
const tapName = t => 'taps/' + String(t.n).padStart(3, '0') + '-' + (t.label === 0 ? 'cue' : t.label) + '.png';
// Save debug (V3.1.0, owner Oct 31): the whole session from the phone's storage, in zip files small enough to upload (with
// the clips a session can be 60 MB or more): part 1 has the log and the first pictures, each part says which part of how
// many it is (part.json). All the parts go in one share (V3.1.3, owner Nov 1: one part at a time, the button did not
// offer the next), so Save to Files takes them together. With no session on this page (Home, after Safari closed it), it
// is the last session kept on the phone.
// (28 MB as Files counts, a million bytes: V3.1.2 counted 29 x 1,048,576, which Files showed as 30.4 MB, over the limit)
const PART_MAX = 28e6;
async function packDebug() {
  const enc = new TextEncoder(), here = !!A.sess && DBG.ev.length > 0;
  let sid = DBG.t0, files = [], logData = null;
  if (here) { dbgPersist(); logData = enc.encode(JSON.stringify(logObject())); await STORE.put(sid, 'log.json', logData); files = await STORE.files(sid); }
  else { const ss = await STORE.sessions(); if (ss.length) { sid = ss[0].sid; files = await STORE.files(sid); } }
  const lf = files.find(f => f.name === 'log.json'); files = files.filter(f => f.name !== 'log.json');
  if (!logData) logData = lf ? lf.data : enc.encode(JSON.stringify(logObject())); // nothing kept: this page's log (with the backup of the last one)
  if (!files.length) files = [...A.pics.entries()].map(([k, v]) => ({ name: k, data: v })).concat(A.taps.map(t => ({ name: tapName(t), data: t.png })));
  files.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  const groups = []; let cur = [{ name: 'log.json', data: logData }], size = logData.length;
  for (const f of files) { const n = f.data.length + f.name.length + 80; if (size + n > PART_MAX) { groups.push(cur); cur = []; size = 0; } cur.push(f); size += n; }
  groups.push(cur);
  const d = new Date(sid), pad = n => String(n).padStart(2, '0'), stem = 'chalkline-v3-debug-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes());
  const parts = groups.map((g, i) => {
    if (groups.length > 1) g = g.concat([{ name: 'part.json', data: enc.encode(JSON.stringify({ session: d.toISOString(), part: i + 1, of: groups.length, files: g.length })) }]);
    const blob = makeZip(g), name = stem + (groups.length > 1 ? '-part' + (i + 1) + 'of' + groups.length : '') + '.zip';
    let file = null; try { file = new File([blob], name, { type: 'application/zip' }); } catch (e) { }
    return { blob, file, name, mb: blob.size / 1e6 };
  });
  dbg('export', { parts: parts.length, files: files.length + 1, mb: parts.map(p => r1(p.mb)), stored: !STORE.err, here });
  return parts;
}
let DBGZIP = null; // { parts, all, i, t }: parts packed; all: they can go in one share; else the next one to share
const mbText = mb => (mb < 0.1 ? '<0.1' : mb.toFixed(1)) + ' MB';
function shareLabel(z) {
  if (z.all) return 'Share debug file' + (z.parts.length > 1 ? 's (' + z.parts.length + ' parts, ' : ' (') + mbText(z.parts.reduce((a, p) => a + p.mb, 0)) + ')';
  const p = z.parts[z.i]; return z.parts.length > 1 ? 'Share part ' + (z.i + 1) + ' of ' + z.parts.length + ' (' + mbText(p.mb) + ')' : 'Share debug file (' + mbText(p.mb) + ')';
}
const canShare = files => !!(navigator.canShare && files.every(f => f) && navigator.canShare({ files }));
async function saveDebug(btn) {
  const z = DBGZIP;
  if (z && Date.now() - z.t < 10 * 60000) { // a tap: share at once, nothing awaited before it (Safari shares only straight after a tap)
    if (z.all) {
      DBGZIP = null; btn.textContent = 'Save debug';
      try { await navigator.share({ files: z.parts.map(p => p.file) }); return; }
      catch (e) { if (e && e.name === 'AbortError') { DBGZIP = z; btn.textContent = shareLabel(z); return; } z.all = false; z.i = 0; DBGZIP = z; btn.textContent = shareLabel(z); toast('They would not go together: tap to share them one at a time.'); return; }
    }
    if (z.i < z.parts.length) {
      const p = z.parts[z.i++]; if (z.i >= z.parts.length) { DBGZIP = null; btn.textContent = 'Save debug'; } else btn.textContent = shareLabel(z);
      if (canShare([p.file])) { try { await navigator.share({ files: [p.file] }); return; } catch (e) { if (e && e.name === 'AbortError') { z.i--; DBGZIP = z; btn.textContent = shareLabel(z); return; } } }
      download(p); return;
    }
  }
  DBGZIP = null; const label = btn.textContent; btn.textContent = 'Packing…';
  let parts; try { parts = await packDebug(); } catch (e) { btn.textContent = label; toast('Could not pack the debug file: ' + String(e && e.message || e).slice(0, 60)); return; }
  if (!canShare([parts[0].file])) { btn.textContent = 'Save debug'; for (const p of parts) download(p); return; }
  DBGZIP = { parts, all: canShare(parts.map(p => p.file)), i: 0, t: Date.now() }; btn.textContent = shareLabel(DBGZIP); dbg('export_share', { all: DBGZIP.all, parts: parts.length });
  toast('Ready: tap "Share", then Save to Files → Google Drive → Chalkline test uploads' + (parts.length > 1 && DBGZIP.all ? ' (all ' + parts.length + ' parts go together).' : '.'));
}
function download(z) { try { const a = document.createElement('a'); a.href = URL.createObjectURL(z.blob); a.download = z.name; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 500); toast('Debug file saved'); } catch (e) { toast('Could not save the debug file on this phone.'); } }

renderHome();
window.__v3 = { A, DBG, start, acceptTable, look, packDebug, goHome, WATCH, STORE, testXY, STATIONS }; // for the browser tests
