// ===== V3 APP =====
// Watch: find the table, then every look runs the ball finder on the table strip, maps the balls to table inches and
// hands them to the tracker (src/track.js), which keeps each ball's name and calls the shots. The screen shows what the
// tracker knows; a tap on a ball renames it. Everything is written to the debug log for Save debug.
const VERSION = 'V3.17.0';
const $ = s => document.querySelector(s);
const KEY = 'chalkline.v3', BASE = new URL('./', location.href).href;
const BALLCOL = ['#f4f1e8', '#e8c11d', '#2a52c9', '#d03a2f', '#6a3fa0', '#e8782a', '#1f8a4c', '#8c2433', '#16181b', '#e8c11d', '#2a52c9', '#d03a2f', '#6a3fa0', '#e8782a', '#1f8a4c', '#8c2433'];
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
function save() { try { localStorage.setItem(KEY, JSON.stringify({ ft: A.ft, lastSess: A.lastSess, engine: A.engine, game: A.game })); } catch (e) { } }
try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); if (d) { if ([7, 8, 9].includes(d.ft)) A.ft = d.ft; A.lastSess = d.lastSess || null; if (d.engine === 'gpu') A.engine = 'gpu'; if (d.game === 8) A.game = 8; } } catch (e) { }
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
    // the files of a session whose names start with pre (one shot's pictures, or its clip)
    prefix(sid, pre) {
      return run('files', 'readonly', fs => { const out = [], q = fs.openCursor(IDBKeyRange.bound(sid + '/' + pre, sid + '/' + pre + '\uffff')); q.onsuccess = () => { const c = q.result; if (c) { out.push({ name: c.key.slice(String(sid).length + 1), data: c.value }); c.continue(); } }; return { value: out }; }).then(r => r || []);
    },
    sessions() { return run('sessions', 'readonly', ss => ss.getAll()).then(r => (r || []).sort((a, b) => b.sid - a.sid)); },
    files(sid) {
      return run('files', 'readonly', fs => { const out = [], q = fs.openCursor(range(sid)); q.onsuccess = () => { const c = q.result; if (c) { out.push({ name: c.key.slice(String(sid).length + 1), data: c.value }); c.continue(); } }; return { value: out }; }).then(r => r || []);
    },
  };
})();
function header() {
  return { app: 'chalkline', build: VERSION, mode: A.mode || 'play', game: A.mode === 'play' ? (A.game || 9) : null, det: DET.VERSION, started: new Date(DBG.t0).toISOString(), ua: navigator.userAgent, screen: [screen.width, screen.height], dpr: window.devicePixelRatio || 1,
    gpu: !!navigator.gpu, engine: DET.ep, engineSetting: A.engine, threads: DET.threads(), isolated: !!window.crossOriginIsolated, cores: navigator.hardwareConcurrency || null, shape: A.shape, kmax: r2(A.kmax), ft: A.ft, picture: A.tableWH || [A.W, A.H], pictureNow: [A.W, A.H], quad: A.quad && A.quad.map(p => [r1(p[0]), r1(p[1])]), rot: A.rot, box: A.box && A.box.map(Math.round),
    camOk: A.cam ? A.cam.ok : null, cam: A.camInfo, lens: LENS };
}
function shotRow(sh) { return { n: sh.n, t0: r2(sh.t0), t1: r2(sh.t1), cue: sh.cueNum, first: sh.firstNum, made: sh.made.map(m => Object.assign({ num: m.num, pocket: m.pocket, sure: m.sure }, m.seen === false ? { seen: false } : {})), scratch: sh.scratch, break: sh.break, hidden: sh.hidden, before: sh.before, after: sh.after, paths: sh.paths, test: sh.test }; }

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
  // the game for Play a rack (V3.9.0): 9-ball, or 8-ball (all fifteen balls; the rack is over when the 8 goes in)
  const sfg = $('#segFargo'); if (sfg) { sfg.innerHTML = ''; for (const v of [300, 400, 500, 600, 700]) { const b = document.createElement('button'); b.textContent = String(v); b.className = Math.abs(fargo() - v) < 50 ? 'on' : ''; b.onclick = () => { try { localStorage.setItem(FG_KEY, String(v)); } catch (e) { } renderHome(); }; sfg.appendChild(b); } }
  const sg = $('#segGame'); if (sg) { sg.innerHTML = ''; for (const g of [9, 8]) { const b = document.createElement('button'); b.textContent = g + '-ball'; b.className = g === (A.game || 9) ? 'on' : ''; b.onclick = () => { A.game = g; save(); renderHome(); }; sg.appendChild(b); } }
  const gb = $('#goBtn small'); if (gb) gb.textContent = (A.game === 8 ? '8-ball, all fifteen balls: made balls, scratches, runs; the rack is over when the 8 goes in or only the cue ball is left.' : '9-ball: made balls, scratches, the first ball hit, runs; the rack is done by itself when only the cue ball is left.');
  const se = $('#segEng'); if (se) { se.innerHTML = ''; for (const [v, l] of [['cpu', 'Processor'], ['gpu', 'Graphics chip']]) { const b = document.createElement('button'); b.textContent = l; b.className = v === A.engine ? 'on' : ''; b.onclick = () => { A.engine = v; save(); renderHome(); }; se.appendChild(b); } }
  const eh = $('#engHint'); if (eh) eh.textContent = A.engine === 'gpu' ? 'Faster, but on your iPhone Safari has closed the page when the ball finder runs here.' : 'Steady. ' + (window.crossOriginIsolated ? 'Uses several cores.' : 'One core: reload the page once if this stays.');
  if (CRASH) { $('#crashCard').hidden = false; $('#crashText').textContent = 'V' + String(CRASH.version || '').replace(/^V/, '') + ' stopped after ' + (CRASH.secs || 0) + ' s and ' + (CRASH.looks || 0) + ' looks, on the ' + (CRASH.engine === 'webgpu' ? 'graphics chip' : CRASH.engine === 'wasm' ? 'processor (' + (CRASH.threads || 1) + ' core' + ((CRASH.threads || 1) > 1 ? 's' : '') + ')' : 'way in') + ', while ' + ({ look: 'looking at the table', done: 'between looks', start: 'starting', camera: 'starting the camera', finder: 'starting the ball finder', table: 'finding the table' }[CRASH.step] || CRASH.step) + '.' + (CRASH.engine === 'webgpu' ? ' The processor is selected now.' : ''); }
  const L = A.lastSess, card = $('#lastCard');
  card.hidden = !(L && L.shots && L.shots.length);
  if (typeof renderHistory === 'function') renderHistory(); // (review.js loads after this file; it draws the card itself then)
  if (!card.hidden) $('#lastList').innerHTML = L.shots.slice(-6).map(s => '<div class="srow"><b>' + s.n + '</b><span>' + shotWords(s) + '</span></div>').join('') + (L.shots.length > 6 ? '<div class="lbl">… ' + L.shots.length + ' shots in all</div>' : '');
}
const POCKETS = ['bottom-left', 'bottom side', 'bottom-right', 'top-left', 'top side', 'top-right'];
function shotWords(s) {
  const pk = (i, m) => i == null ? '' : ' (' + POCKETS[i] + (m && m.seen === false ? ', ⊘ not seen' : '') + ')';
  const made = s.made.filter(m => m.num !== s.cue && m.num !== 0);
  if (s.notShot) return 'not counted: ' + (s.notShot === 'move' ? 'the cue ball was pushed with the cue, not struck' : s.notShot === 'setup' ? 'setting up the drill' : 'not a shot');
  const w = [made.length ? made.map(m => (m.num == null ? 'a ball' : 'the ' + m.num) + pk(m.pocket, m)).join(', ') + ' in' : 'nothing in'];
  if (s.scratch) w.push('scratch'); if (s.break) w[0] = 'Break: ' + w[0]; else if (s.first != null) w.push('first hit the ' + (s.first === 0 ? 'cue' : s.first));
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
    // (a share over the sessions that have the count: names are not checked on every session)
    const has = (k, n) => S.filter(s => s[k] != null).reduce((a, s) => a + (s[n] || 0), 0);
    const share = (k, n, need) => { n = has(k, n); return [pct(sum(k), n) + ' · need ' + Math.round(100 * need) + '%', n ? sum(k) / n / need : 0, n > 0 && sum(k) / n >= need]; };
    // a count with a limit (at most v per k): the bar is full at none, half at the limit
    const atMost = (n, per, lim, unit) => { const r = per ? n / per : 0; return [n + (per && n ? ' (' + (Math.round(10 * r * lim.k) / 10) + ')' : '') + ' · at most ' + lim.v + ' ' + unit, per ? 1 - Math.min(1, r * lim.k / lim.v / 2) : 0, per > 0 && r * lim.k <= lim.v]; };
    const rows = [
      ['Racks', racks + ' of ' + T.racks, racks / T.racks, racks >= T.racks],
      ['Sessions', nSess + ' of ' + T.sessions, nSess / T.sessions, nSess >= T.sessions],
      ['Camera spots', spots.length + ' of ' + T.spots + (spots.length ? ' (' + spots.join(', ') + ')' : ''), spots.length / T.spots, spots.length >= T.spots],
      ['Shots found', ...share('found', 'shots', T.found)],
      ['What went in, called right', ...share('madeRight', 'shots', T.madeRight)],
      ['False "in"', ...atMost(sum('falseIn'), shots, { k: 50, v: T.falseInPer50 }, 'per 50 shots')],
      ['False scratches', ...atMost(sum('falseScratch'), shots, { k: 50, v: T.falseScratchPer50 }, 'per 50 shots')],
      ['Cue ball and lowest ball named right after a shot', ...share('keyRight', 'shots', T.keyRight)],
      ['Balls named right', ...share('ballsRight', 'balls', T.ballsRight)],
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
$('#goBtn').onclick = () => start('play');
$('#pracBtn').onclick = () => start('practice');
$('#coachBtn').onclick = () => start('coach');
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
// mode: 'play' (a rack at a time: racks done by themselves, runs) or 'practice' (balls set out and moved at will; owner Nov 2)
// practice reads all fifteen balls (V3.9.0); Play a rack is 9-ball, the cue ball and 1-9
const ALL15 = Array.from({ length: 16 }, (_, i) => i);
// the coaching test (V3.10): small runouts with the 9 always on, balls set out at will (as practice), the cue ball and 1-9
// the pockets of this table where a made ball lies in view (V3.17): learned from the player's "not a ball" taps, kept
const SH_KEY = () => KEY + '.shallow.' + A.ft;
function shallowGet() { try { return JSON.parse(localStorage.getItem(SH_KEY()) || '{}') || {}; } catch (e) { return {}; } }
function shallowSave() { if (!A.tk) return; try { localStorage.setItem(SH_KEY(), JSON.stringify(A.tk.S.shallow)); } catch (e) { } }
const TK_OPTS = mode => mode === 'practice' ? { practice: true, autoRack: false, rackNew: false, ids: ALL15 } : mode === 'coach' ? { practice: true, autoRack: false, rackNew: false } : A.game === 8 ? { ids: ALL15, eightEnds: true } : {};
async function start(mode) {
  homeMsg(''); A.mode = mode === 'practice' || mode === 'coach' ? mode : 'play'; CO.plan = null; CO.sig = ''; CO.atStart = null;
  if (!window.ort) { homeMsg('The ball finder did not load. Check the connection and reload the page.', true); return; }
  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) { homeMsg('This browser cannot reach the camera. Open the page in Safari from its https address.', true); return; }
  // the session before this one, for the debug file (V3.15: read only when the page loaded, so a second session in the same
  // page kept the one from before that: Nov 9 21:33, the power test session went home and its log never came along)
  if (A.sess && DBG.ev.length) dbgPersist(); try { PREV = JSON.parse(localStorage.getItem(KEY + '.dbg') || 'null'); } catch (e) { }
  DBG.t0 = Date.now(); DBG.ev = []; DBG.looks = []; DBG.drop = 0; A.pics.clear(); A.taps = []; A.nShots = 0; A.looks = 0;
  A.P = makeP(A.ft); A.tk = makeTracker(A.P, Object.assign(TK_OPTS(A.mode), { stance: stanceAt, shallow: shallowGet() })); A.sess = { t0: Date.now(), sid: DBG.t0, version: VERSION, ft: A.ft, mode: A.mode, game: A.mode === 'play' ? (A.game || 9) : null, shots: [], rack: 1, rackOpen: false }; $('#rackBtn').hidden = A.mode !== 'play'; $('#rejectBtn').hidden = true; A.strokeCheck = false; A.drill = null; $('#drillTag').hidden = true; A.sess.drillTries = []; A.handsN = 0; A.handsT = 0; A.drillReadyOf = new Map(); A.drillStOf = new Map();
  STORE.begin(DBG.t0, { t0: DBG.t0, version: VERSION, ft: A.ft }); WATCH.nClips = 0;
  $('#home').hidden = true; $('#sum').hidden = true; $('#cam').hidden = false; A.phase = 'boot'; A.frozen = false; A.findN = 0; A.live = true; setStatus('Starting the camera…');
  dbg('start', { mode: A.mode, ft: A.ft, version: VERSION, engine: A.engine, isolated: !!window.crossOriginIsolated }); CRASH = null; $('#crashCard').hidden = true; crumb('start');
  // the weights (10 MB) download while the table is found
  DET.prefetch(BASE, 'models/v3/finder-v1.weights', (g, t) => { A.dl = t ? g / t : 0; }).catch(e => dbg('error', { m: 'weights ' + String(e).slice(0, 100) }));
  try { await openCamera(); } catch (e) {
    A.live = false; $('#cam').hidden = true; $('#home').hidden = false;
    homeMsg(e && e.name === 'NotAllowedError' ? 'Camera access was blocked. In Safari tap aA, then Website Settings, then Camera, then Allow. Reload and try again.' : 'The camera could not start: ' + (e && (e.message || e.name) || e), true); return;
  }
  crumb('table'); wakeLock(); requestAnimationFrame(drawLoop); findTable();
}
function goHome() {
  $('#drillTag').hidden = true; A.live = false; A.phase = 'home'; dbgPersist(); if (A.sess) logStore(); endSession(); endCrumb();
  if (A.stream) A.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } }); A.stream = null;
  try { if (wl) wl.release(); } catch (e) { } wl = null;
  $('#cam').hidden = true; $('#home').hidden = false; hideCard(); renderHome();
}
function endSession() { if (A.sess && A.sess.shots.length) { A.sess.mins = Math.max(1, Math.round((Date.now() - A.sess.t0) / 60000)); A.lastSess = A.sess; save(); REVIEW.remember(A.sess, A.sess.mins); } }
// a new rack: the next shot starts it (New rack pressed twice, or before any shot, is not another)
function rackOpen() { if (A.sess) A.sess.rackOpen = true; }
// End session (owner, Oct 28): the camera goes off and the session's numbers show, with Save debug, so the debug file is
// saved with the phone put down and the camera no longer watching (turning the phone upright to save used to count as a
// shot and send the app looking for the table again)
function endRun() {
  $('#drillTag').hidden = true;
  if (A.tk) { A.tk.finish(); flushShots(); }
  dbg('end_session', { shots: A.tk ? A.tk.S.shots.length : 0 });
  A.live = false; A.phase = 'done'; dbgPersist(); logStore(); endSession(); endCrumb();
  if (A.stream) A.stream.getTracks().forEach(t => { try { t.stop(); } catch (e) { } }); A.stream = null;
  try { if (wl) wl.release(); } catch (e) { } wl = null;
  hideCard(); $('#cam').hidden = true; $('#sum').hidden = false; renderSummary();
}
function renderSummary() { renderReview(A.sess, true); $('#sumDbg').textContent = 'Save debug'; }
$('#endBtn').onclick = () => endRun();
$('#sumAgain').onclick = () => { $('#sum').hidden = true; start(A.mode); };
$('#sumHome').onclick = () => { closeShot(); $('#sum').hidden = true; $('#home').hidden = false; A.phase = 'home'; renderHome(); renderGate(); };
$('#lastOpen').onclick = () => { if (!A.lastSess) return; $('#home').hidden = true; $('#sum').hidden = false; renderReview(A.lastSess, false); };
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
// The rail diamonds (a V2 pillar, owner Nov 3: they sit at set distances and do not depend on the cloth's colour). On the
// still picture the table was found on: every small white mark round the rails, matched to where the diamonds should be,
// and the corners nudged until they land on them (vision.js, as V2 did). On Nov 2 18:04's still pictures 16 to 18 of the
// 18 were found; the outline as found was off them by a median of 4 to 7 px (half size; about an inch at the far rail),
// 1 px after. The marks found are kept for the steady check.
function diamondFit() {
  A.dia = null;
  try {
    if (!A.fctx || !A.W) return; const img = A.fctx.getImageData(0, 0, A.W, A.H), pp = [A.W / 2, A.H / 2];
    const med = d => { const e = d.found.map(f => Math.hypot(f.px - f.ex, f.py - f.ey)).sort((a, b) => a - b); return e.length ? e[e.length >> 1] : null; };
    const d = findDiamonds(img, A.quad, A.rot, A.ft, LENS, pp); let use = d, moved = 0;
    if (d.n >= 8) { const rq = refineWithDiamonds(img, A.quad, A.rot, A.ft, LENS, d, pp);
      if (rq) { const d2 = findDiamonds(img, rq, A.rot, A.ft, LENS, pp); if (d2.n >= d.n - 1 && med(d2) < med(d)) { moved = Math.max(...rq.map((q, i) => Math.hypot(q[0] - A.quad[i][0], q[1] - A.quad[i][1]))); A.quad = rq; use = d2; } } }
    A.dia = use.n >= 8 ? use.found.map(f => [f.px, f.py]) : null;
    dbg('diamonds', { n: d.n, off: d.n ? r1(med(d)) : null, after: r1(med(use) || 0), moved: r1(moved), D: use.D, z: use.z });
  } catch (e) { dbg('error', { m: 'diamonds ' + String(e && e.message || e).slice(0, 100) }); }
}
async function acceptTable() {
  const my = A.acceptN = (A.acceptN || 0) + 1; // (the table found again while the finder starts: only the latest goes on)
  const c = A.cand; A.quad = c.quad; A.rot = c.rot; if (!c.manual) diamondFit(); else A.dia = null;
  const { L, Wd } = tableDims(A.ft), f = LENS * Math.max(A.W, A.H);
  A.cam = makeCam(tableCornersFor(A.rot, L, Wd), A.quad, A.W, A.H, f, [A.W / 2, A.H / 2]);
  if (A.drill) drillSetup(); // (the rings follow the table found again)
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
      DET.loadPose(BASE).then(() => dbg('pose_model', { ok: true })).catch(e => dbg('error', { m: 'pose model ' + String(e && e.message || e).slice(0, 120) }));
      if (A.engine === 'gpu' && DET.ep !== 'webgpu') toast('The graphics chip is not available: using the processor.');
    } catch (e) { if (my !== A.acceptN) return; dbg('error', { m: 'finder load ' + String(e && e.message || e).slice(0, 160) }); setStatus('The ball finder could not start: ' + String(e && e.message || e).slice(0, 80)); return; }
  }
  if (my !== A.acceptN) return;
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
      // the player's pose, between looks while no shot runs (V3.8.11)
      if (!document.hidden && A.tk.S.phase !== 'shot') { try { await poseLook(); } catch (e) { dbg('error', { m: 'pose ' + String(e && e.message || e).slice(0, 120) }); } }
      // during a shot as fast as the phone goes; otherwise about 5 looks a second (battery and heat)
      const gap = A.tk.S.phase === 'shot' ? 0 : 200 - (performance.now() - t0);
      await sleep(Math.max(document.hidden ? 300 : 0, gap));
    }
  } finally { A.looping = false; }
}
// The player's pose (V3.8.11, owner Nov 8: what makes a shot is the player down on it, from any side): about every 0.8 s
// while no shot runs, on the picture of the last look, YOLO11n-pose (DET.pose) and the body-shape model (src/v3/pose.js)
// give how likely the biggest person is down on a shot. The tracker asks (O.stance) when a ball sets off: 'down' (0.6 or
// more in the last look within 1.5 s), 'up' (every look of the last 2 s upright, over the table, face seen: POSE.stance), else null.
const POSEST = { t: -9, hist: [], logT: 0 };
async function poseLook() {
  if (!DET.poseReady || !A.frame.width) return; const now = performance.now() / 1000; if (now - POSEST.t < 0.8) return; POSEST.t = now;
  const r = await DET.pose(A.frame, A.W, A.H); if (!r) return;
  const ps = POSE.decode(r.data, r.N, 0.4).map(p => ({ conf: p.conf, box: [...r.back(p.box[0], p.box[1]), ...r.back(p.box[2], p.box[3])], kp: p.kp.map(q => [...r.back(q[0], q[1]), q[2]]) }));
  const p = POSE.down(ps), big = ps.length ? ps.reduce((a, q) => (q.box[2] - q.box[0]) * (q.box[3] - q.box[1]) > (a.box[2] - a.box[0]) * (a.box[3] - a.box[1]) ? q : a) : null;
  const xs = A.quad.map(q => q[0]), ys = A.quad.map(q => q[1]), over = !!big && big.box[2] > Math.min(...xs) && big.box[0] < Math.max(...xs) && big.box[3] > Math.min(...ys) - 0.1 * A.H && big.box[1] < Math.max(...ys);
  POSEST.hist.push({ t: now, p, over, face: POSE.face(ps), n: ps.length }); while (POSEST.hist.length > 8) POSEST.hist.shift();
  if (now - POSEST.logT > 2) { POSEST.logT = now; dbg('pose', { p: p == null ? null : r2(p), over, n: ps.length }); }
}
function stanceAt(t) {
  const v = POSE.stance(POSEST.hist, t), h = POSEST.hist.filter(q => q.t <= t + 0.05).pop();
  if (v || (h && t - h.t <= 1.5)) dbg('stance', { v, p: h && h.p != null ? r2(h.p) : null, face: h && h.face, ago: h ? r2(t - h.t) : null }); return v;
}
async function look() {
  if (!grab() || A.phase !== 'run') return;
  crumb('look');
  steady();
  const t = performance.now() / 1000, t0 = performance.now(), tk = A.tk, P = A.P, R = P.R;
  preKeep(t);
  const found = await DET.find(A.frame, A.W, A.H, { box: A.box, kmax: A.kmax }), t1 = performance.now();
  const on = [];
  for (const s of found) { const q = A.cam.unproj(s.px, s.py, R); s.x = q[0]; s.y = q[1]; if (s.x > -3 && s.y > -3 && s.x < P.L + 3 && s.y < P.W + 3) on.push(s); }
  // the reader runs every look (about 10 ms against 220 for the finder on the owner's phone). During a shot its numbers
  // are not votes (the tracker votes on resting balls only), but white or not still tells the cue ball from the rest
  const read = true; await DET.read(A.fctx, on, tk.O.ids);
  const t2 = performance.now(), before = tk.S.phase;
  tk.update(t, on, { read, empty: emptyAt });
  if (A.mode === 'coach') coachLook();
  for (const n of tk.S.notes.splice(0)) onLateMade(n);
  pathLook();
  A.looks++;
  DBG.looks.push([Date.now() - DBG.t0, Math.round(t1 - t0), Math.round(t2 - t1), on.length, tk.S.phase === 'shot' ? 'S' : tk.S.phase[0], on.map(s => [r1(s.x), r1(s.y), s.num == null ? null : s.num, s.kind ? s.kind[0] : '-', r2(s.score), s.p ? r2(s.p[s.num]) : null, s.p ? second(s.p, s.num) : null])]);
  if (DBG.looks.length > 40000) DBG.looks.splice(0, 4000); // (it was 4000: Oct 31, a 17-minute session lost its first 98 s)
  A.timing.push(t1 - t0); if (A.timing.length > 30) A.timing.shift();
  if (before !== 'shot' && tk.S.phase === 'shot') onShotStart();
  // hands on the table (not a shot): a clip of that too, at most one every 4 s
  if (before !== 'hands' && tk.S.phase === 'hands' && Date.now() - A.handsT > 4000) { A.handsT = Date.now(); const hn = 'hands-' + String(++A.handsN).padStart(3, '0'); clipStart(hn, 2000, 2000); preSave(hn, t); }
  if (tk.S.shots.length > A.nShots) { for (const sh of tk.S.shots.slice(A.nShots)) onShotEnd(sh); A.nShots = tk.S.shots.length; }
  for (const s of tk.S.say.splice(0)) onSay(s);
  drillReadyLook();
  // in the stroke test the 1 is put back after every pot: no number stays counted in, so it is found and named again
  // (Nov 1: it showed ? every time it came back)
  // a picture of the still table every 1.5 s, kept as the "before" of the next shot
  if (tk.S.phase !== 'shot' && performance.now() - (A.colT || 0) > 1000) { A.colT = performance.now(); ballColours(); }
  if (tk.S.phase === 'still' && performance.now() - A.stillPicT > 1500) { A.stillPicT = performance.now(); jpeg(960).then(b => { A.stillPic = b; }).catch(() => { }); }
  statusRun(); crumb('done');
}
// the reader's second choice and its share (from V3.0.11, so a replay can rebuild how sure the reader was: Oct 30, a replay
// with every read made 90% sure scored 37 of 44 on a session that live got 42)
function second(p, k) { let b = -1; for (let i = 0; i < p.length - 1; i++) if (i !== k && (b < 0 || p[i] > p[b])) b = i; return b < 0 ? null : [b, r2(p[b])]; }
// The tracker's word on racks and hand moves (V3.0.15, owner Oct 31: for testing, said on screen; later done quietly)
function onSay(s) {
  if (s.k === 'rack_done') { flushShots(); PATH.clear(); rackOpen(); dbg('new_rack', { auto: true, eight: !!s.eight }); toast(s.eight ? 'The 8 is in: rack over' : 'Rack complete'); }
  else if (s.k === 'rack_new') { flushShots(); PATH.clear(); rackOpen(); dbg('new_rack', { auto: true, set: true }); toast('New rack: balls set out'); }
  else if (s.k === 'not_shot') { PATH.clear(); dbg('not_shot', { num: s.num }); toast('Not counted: hand move'); }
}
// The whole picture just before each move (V3.8.10, owner Nov 8: what makes a shot is the player down on it, the tip at
// the cue ball with a bridge hand out, from any side; a hand at the ball is not one). Each look keeps a 640 px copy of the
// picture for 2 s; when a move starts, the three looks before it are saved (shotNNN-pre1..3.jpg, or handsNNN-pre for a
// move taken for hands) for the player's pose to be measured on, before anything decides on it.
const PRE = { ring: [], free: [] };
function preKeep(t) {
  try {
    const c = PRE.free.pop() || document.createElement('canvas'); if (c.width !== 640) { c.width = 640; c.height = Math.round(640 * A.H / A.W); }
    c.getContext('2d').drawImage(A.frame, 0, 0, c.width, c.height); PRE.ring.push({ t, c });
    while (PRE.ring.length && (t - PRE.ring[0].t > 2.2 || PRE.ring.length > 9)) PRE.free.push(PRE.ring.shift().c);
  } catch (e) { }
}
function preSave(nm, t0) {
  const fr = PRE.ring.filter(f => f.t < t0 - 1e-3).slice(-3); dbg('pre_frames', { name: nm, n: fr.length, dt: fr.map(f => r2(f.t - t0)) });
  fr.forEach((f, i) => f.c.toBlob(b => { if (b) b.arrayBuffer().then(a => setPic(nm + '-pre' + (i + 1) + '.jpg', new Uint8Array(a))); }, 'image/jpeg', 0.7));
}
function onShotStart() {
  if (A.mode === 'coach') coachShotStart();
  PATH.clear(); A.pathClearAt = null; pathLook(); const sh = A.tk.S.shot; if (!sh) return; const nm = 'shot' + String(sh.n).padStart(3, '0');
  if (A.stillPic) setPic(nm + '-before.jpg', A.stillPic);
  preSave(nm, sh.t0);
  if (A.strokeCheck) sh.test = { check: true };
  if (A.drill) { A.drillReadyOf.set(sh.n, !!A.drill.ready); A.drill.ready = false; A.drill.since = null; }
  clipStart(nm, A.strokeCheck ? 4000 : 2000, 2000, sh.test || null); strokeShot(sh.n);
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
// A made ball whose pocket was not seen (V3.17, owner Nov 10: at 2 or 3 looks a second a fast ball is gone between looks):
// worked out from what was seen. Its way: its own path when it was seen moving, else from the cue ball's start through
// where it sat (the shot's line), else none. The pocket that way (within 40 degrees), else the nearest one. Marked not
// seen ("⊘") wherever it is said.
function guessPockets(sh) {
  const cue = (sh.paths || []).find(p => p.key === sh.cueKey);
  for (const m of sh.made) {
    if (m.pocket != null || m.key === sh.cueKey) continue;
    const mine = b => (m.key != null && b.key === m.key) || (m.key == null && m.num != null && b.num === m.num);
    const b0 = (sh.before || []).find(mine); if (!b0) continue; const o = [b0.rx != null ? b0.rx : b0.x, b0.ry != null ? b0.ry : b0.y];
    const own = (sh.paths || []).find(mine); let d = null;
    if (own && own.p.length > 1) { const q = own.p[own.p.length - 1]; d = [q[1] - own.p[0][1], q[2] - own.p[0][2]]; }
    if ((!d || Math.hypot(d[0], d[1]) < 1.5) && cue && cue.p.length && (sh.first === b0.key || (sh.firstNum != null && sh.firstNum === m.num) || (sh.first == null && sh.made.filter(q => q.key !== sh.cueKey).length === 1))) d = [o[0] - cue.p[0][1], o[1] - cue.p[0][2]];
    let best = null;
    A.P.pockets.forEach((pk, i) => { const v = [pk.x - o[0], pk.y - o[1]], dist = Math.hypot(v[0], v[1]); let ang = 0;
      if (d && Math.hypot(d[0], d[1]) > 0.5) ang = Math.acos(Math.max(-1, Math.min(1, (v[0] * d[0] + v[1] * d[1]) / (dist * Math.hypot(d[0], d[1]))))) * 180 / Math.PI;
      const sc = d ? (ang < 40 ? ang + dist / 20 : 1e3 + dist) : dist; if (!best || sc < best.sc) best = { i, sc }; });
    if (best) { m.pocket = best.i; m.seen = false; dbg('pocket_guess', { n: sh.n, num: m.num, pocket: best.i, way: !!d }); }
  }
}
function onShotEnd(sh) {
  guessPockets(sh);
  A.pathClearAt = performance.now() + 1000; // (the shot ends 1.2 s after the balls rest: the paths go about 2 s after; owner, Nov 3)
  sh.paths = pathsRow(sh); const row = shotRow(sh); if (A.sess.rackOpen) { A.sess.rackOpen = false; if (A.sess.shots.length) A.sess.rack++; }
  A.sess.shots.push(Object.assign({ n: sh.n, rack: A.sess.rack, cue: sh.cueNum, first: sh.firstNum, made: row.made, scratch: sh.scratch, break: sh.break, t: Date.now() }, REVIEW.shotDetail(sh), STK.of.has(sh.n) ? { stroke: STK.of.get(sh.n) } : {}));
  dbg('shot_end', { n: sh.n, made: row.made, scratch: sh.scratch, first: sh.firstNum });
  if (A.drill && A.drill.st) { const st = A.drill.st; A.drillStOf.set(sh.n, st); setTimeout(() => drillScore(sh, st), 2500); }
  jpeg(960).then(b => setPic('shot' + String(sh.n).padStart(3, '0') + '-after.jpg', b)).catch(() => { });
  // (the move check, V3.7, only logs now: on Nov 2 18:04 it threw out 8 real bank shots, a cue seen end on read as a level
  // line; it had found 1 real push in all)
  const row1 = A.sess.shots[A.sess.shots.length - 1];
  // in a drill: moved before "Ready: shoot", or after it the cue ball nudged (under 6 in, nothing else moved, nothing in):
  // setting up, not a shot; not said, not scored
  if (A.drill && A.drillReadyOf.has(sh.n)) {
    const cp = (sh.paths || []).find(p => p.key === sh.cueKey), far = cp ? Math.max(...cp.p.map(q => Math.hypot(q[1] - cp.p[0][1], q[2] - cp.p[0][2]))) : 0;
    const nudge = far < 6 && !(sh.paths || []).some(p => p.key !== sh.cueKey) && !row.made.length && !sh.scratch;
    if (!A.drillReadyOf.get(sh.n) || nudge) { row1.notShot = 'setup'; dbg('drill_setup_move', { n: sh.n, ready: A.drillReadyOf.get(sh.n), far: r1(far) }); }
  }
  const dt = (A.sess.drillTries || []).find(x => x.n === sh.n); if (dt) row1.drill = dt;
  if (A.mode === 'coach' && !A.stest) coachShotEnd(sh, row, row1);
  const inTest = !!A.stest; if (inTest) stShot(sh, row);
  if (row1.notShot !== 'setup' && !dt && !inTest) shotToast(row1); // (a stroke test says its own words) // (a drill shot scored early has said its result already)
  if (A.sess.shots.length % 3 === 0) { A.lastSess = A.sess; save(); }
}
// the shot's line (no tap to correct it: owner, Nov 3, no buttons while playing; what the app gets wrong is found in the
// debug files)
// the shot's words against the plan (V3.14, owner Nov 9: "30% off plan" said nothing): where the cue ball stopped against the
// perfect spot, long or short along the way it was going and to the side, in inches; and the angle off the object ball
function coachWords(c) {
  if (!c) return ''; const w = [], k = c.compare, s = c.stop;
  if (k && Math.abs(k.angle) >= 6) w.push('came off ' + Math.abs(k.angle) + '° off the line');
  if (s) { if (s.off <= 4) w.push('stopped on the spot'); else if (s.along == null) w.push('stopped ' + Math.round(s.off) + ' in off the spot');
    else { const a = Math.round(Math.abs(s.along)), b = Math.round(Math.abs(s.side)), t = []; if (a >= 3) t.push(a + ' in ' + (s.along > 0 ? 'long' : 'short')); if (b >= 3) t.push(b + ' in to the side'); w.push('stopped ' + (t.join(', ') || Math.round(s.off) + ' in off the spot')); } }
  return w.length ? ' · ' + w.join(', ') : '';
}
function shotToast(row) { toast('Shot ' + row.n + ': ' + shotWords(row) + coachWords(row.coach) + (row.coach && row.coach.landed ? ' · cue ball ' + ({ green: 'great position: in the green (90%+)', lightgreen: 'good position: in the light green (80-90%)', yellow: 'in the yellow (60-80%)', red: 'in the red (50-60%)', low: 'where the next shot is under 50%', blocked: 'behind a ball' })[row.coach.landed] : row.coach && row.coach.zone ? ' · cue ball outside the zone' : '')); }
// Each ball's path in the shot: the tracker's positions from just before the shot started, kept after it ends (and for the
// balls that went in) until the next shot starts, so a quick look at the phone after the shot shows the whole of it.
const PATH = new Map(); // ball key -> { num, pts: [{ t, x, y }] }
function pathLook() {
  const tk = A.tk, sh = tk && (tk.S.shot || tk.S.shots[tk.S.shots.length - 1]); if (!sh) return;
  if (tk.S.phase !== 'shot' && !(tk.S.t - sh.t1 < 1)) return; // the last few looks after it ends: the balls settling
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
  if (sh) { guessPockets(sh); const m = sh.made.find(q => q.key === n.key || (n.num != null && q.num === n.num)); if (m && n.pocket == null && m.pocket != null) { n.pocket = m.pocket; n.seen = false; } }
  if (row && sh) { row.made = shotRow(sh).made; row.scratch = sh.scratch; if (row.notShot === 'move' && (row.made.length || row.scratch)) delete row.notShot; } // (something went in: it was a shot)
  dbg('late_made', n); renderDown(); drillLate(n.n);
  toast('Shot ' + n.n + ': ' + (n.num === 0 ? 'the cue ball went in too (scratch)' : 'the ' + (n.num == null ? 'ball' : n.num) + ' went in too') + (n.pocket != null ? ' (' + POCKETS[n.pocket] + (n.seen === false ? ', ⊘ not seen' : '') + ')' : ''));
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
function trimPics() { const keys = [...A.pics.keys()].filter(k => k.startsWith('shot')).sort(); while (keys.length > 700) A.pics.delete(keys.shift()); } // (700: five pictures a shot from V3.8.10)
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
function feat(d, n, lum) { const o = new Float32Array(n); for (let i = 0, j = 0; i < n; i++, j += 4) o[i] = lum ? d[j] + d[j + 1] + d[j + 2] : d[j + 2] - d[j]; return o; } // blue minus red: cloth high, rails and pockets low; or brightness (a diamond: a white mark on the rail)
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
      ref.push(sd > 8 ? { cx, cy, f, m, sd, h } : null); // a flat patch (no edge in it) cannot show a move
    }
    // and each diamond found (V3.8.4): a small patch of brightness round it, at half size
    for (const [px, py] of A.dia || []) {
      const hd = 7, cx = Math.round(px / 2), cy = Math.round(py / 2); if (cx - hd < 0 || cy - hd < 0 || cx + hd > STEADY.cv.width || cy + hd > STEADY.cv.height) continue;
      const f = feat(x.getImageData(cx - hd, cy - hd, 2 * hd, 2 * hd).data, 4 * hd * hd, true); let m = 0; for (const v of f) m += v; m /= f.length; let sd = 0; for (const v of f) sd += (v - m) ** 2; sd = Math.sqrt(sd / f.length);
      if (sd > 20) ref.push({ cx, cy, f, m, sd, h: hd, lum: true });
    }
    STEADY.ref = ref; STEADY.quad0 = A.quad.map(p => p.slice()); STEADY.n = 0; STEADY.last = null;
    dbg('steady_ref', { patches: ref.filter(Boolean).length, diamonds: ref.filter(r => r && r.lum).length });
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
  const x = steadyGrab(), S = STEADY.S, found = [];
  R.forEach((r, i) => {
    if (!r) return; const h = r.h, gw = 2 * (h + S), x0 = r.cx - h - S, y0 = r.cy - h - S;
    if (x0 < 0 || y0 < 0 || x0 + gw > STEADY.cv.width || y0 + gw > STEADY.cv.height) return;
    const g = feat(x.getImageData(x0, y0, gw, gw).data, gw * gw, r.lum);
    let best = -2, bx = 0, by = 0;
    for (let dy = 0; dy <= 2 * S; dy += 2) for (let dx = 0; dx <= 2 * S; dx += 2) { const c = ncc(r.f, r.m, r.sd, g, gw, dx, dy, h); if (c > best) { best = c; bx = dx; by = dy; } }
    for (let dy = Math.max(0, by - 1); dy <= Math.min(2 * S, by + 1); dy++) for (let dx = Math.max(0, bx - 1); dx <= Math.min(2 * S, bx + 1); dx++) { const c = ncc(r.f, r.m, r.sd, g, gw, dx, dy, h); if (c > best) { best = c; bx = dx; by = dy; } }
    if (best >= 0.8) found.push({ i, x: r.cx * 2, y: r.cy * 2, dx: (bx - S) * 2, dy: (by - S) * 2, c: best });
  });
  if (found.length < 3) return;
  // the move most of them agree on (median), then only the ones near it; a plain shift is what a sway on a tripod does
  const med = a => { const b = a.slice().sort((p, q) => p - q); return b[b.length >> 1]; };
  // (Nov 2, 18:04: the outline flipped 3 to 5 px from look to look while the shot pictures show the phone drifting only
  // 4 px in 20 minutes: patches half covered by the player still voted. Now a clear match, and 4 that agree within 2 px.)
  const mx = med(found.map(f => f.dx)), my = med(found.map(f => f.dy)), ok = found.filter(f => Math.hypot(f.dx - mx, f.dy - my) <= 2);
  if (ok.length < Math.min(4, R.filter(Boolean).length)) return;
  const dx = ok.reduce((a, f) => a + f.dx, 0) / ok.length, dy = ok.reduce((a, f) => a + f.dy, 0) / ok.length;
  const cur = A.quad[0], q0 = STEADY.quad0[0], moved = Math.hypot(q0[0] + dx - cur[0], q0[1] + dy - cur[1]);
  if (moved < 3) return; // no real change (the match is in 2 px steps; Nov 2 19:34, with the diamonds: x still flipped between
  // two readings 2.7 px apart, y held)
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
  if (A.strokeCheck || W.fc % 2 === 0) {
    if (A.strokeCheck) fr.cu = closeUp();
    W.ring.push(fr); const keep = A.strokeCheck ? 4100 : 2100; while (W.ring.length && t - W.ring[0].t > keep) W.ring.shift();
  }
  for (const c of W.clips) if (!c.done && t <= c.until && (A.strokeCheck || W.fc % 2 === 0)) c.frames.push(fr);
  for (const c of W.clips) if (!c.done && t > c.until) clipEnd(c);
  W.clips = W.clips.filter(c => !c.done);
  try { strokeFrame(img, t); } catch (e) { if (!STK.err) { STK.err = 1; dbg('error', { m: 'stroke ' + String(e && e.message || e).slice(0, 120) }); } }
  W.n++; W.ms += performance.now() - t0; W.nc += fr.nc; W.ch += fr.ch;
  const now = performance.now();
  if (now - W.t1 >= 1000) { const ms = A.timing.length ? A.timing.reduce((a, x) => a + x, 0) / A.timing.length : 0;
    dbg('watch', { fps: r1(W.n * 1000 / (now - W.t1)), ms: r1(W.ms / Math.max(1, W.n)), nc: r2(W.nc / Math.max(1, W.n)), ch: r2(W.ch / Math.max(1, W.n)), find: Math.round(ms) });
    W.n = W.ms = W.nc = W.ch = 0; W.t1 = now; }
}
// ---------- drills (V3.6, see src/v3/drills.js) ----------
// diamonds as the phone sees the table (from the left end, from the near rail) to table inches
function viewXY(dx, dy) {
  const P = A.P, dia = P.L / 8, nearY = A.cam.proj(P.L / 2, 0, 0)[1] > A.cam.proj(P.L / 2, P.W, 0)[1] ? 0 : P.W, leftX = A.cam.proj(0, P.W / 2, 0)[0] < A.cam.proj(P.L, P.W / 2, 0)[0] ? 0 : P.L;
  return [leftX === 0 ? dx * dia : P.L - dx * dia, nearY === 0 ? dy * dia : P.W - dy * dia];
}
function drillMenu() {
  showCard('<div><b>Drills</b><p>Set each ball where its two faint lines from the rails cross, wait for Ready, and shoot. Three shots at each step, then the next. Practice rules apply: move and pick up balls as you like.</p></div><div class="dlist">' +
    DRILL.LIST.map(d => '<button class="btn" data-drill="' + d.id + '"><b>' + d.name + '</b><small>' + d.about + '</small></button>').join('') + '</div><div class="row">' + (A.drill ? '<button class="btn" data-act="drill_stop">Stop the drill</button>' : '') + '<button class="btn" data-act="close">Close</button></div>');
}
function drillStart(id) {
  if (!A.tk || !A.cam) return; hideCard();
  Object.assign(A.tk.O, { practice: true, autoRack: false, rackNew: false }); A.mode = 'practice'; if (A.sess) A.sess.mode = 'practice'; $('#rackBtn').hidden = true;
  A.drill = { id, level: 0, n: 0, from: A.tk.S.shots.length }; drillSetup(); dbg('drill_start', { id });
  toast(DRILL.byId(id).name + ': set the balls where the lines cross, wait for Ready, and shoot.', 5000);
}
function drillStop() { if (A.drill) dbg('drill_stop', { id: A.drill.id }); A.drill = null; $('#drillTag').hidden = true; hideCard(); }
function drillSetup() {
  const D = A.drill; D.st = DRILL.setup(D.id, D.level, A.P, viewXY); const ts = (A.sess.drillTries || []).filter(t => t.id === D.id);
  D.base = DRILL.byId(D.id).name + ' · ' + D.st.word + ' · shot ' + ((D.n || 0) + 1) + ' of ' + DRILL.PER + ' · step ' + (D.level + 1) + ' of ' + DRILL.byId(D.id).levels.length + (ts.length ? ' · made ' + ts.filter(t => t.made).length + ' of ' + ts.length : '');
  D.ready = false; D.since = null; $('#drillTag').hidden = false; drillTag();
}
// Ready to shoot (owner, Nov 3: moving a ball onto its ring was taken for a shot): both balls on their rings and still for
// 3 s, counted down at the bottom. Anything that moves before "Ready: shoot" is setting up, not a shot.
// (owner, Nov 3: in double time, 3, 2, 1 at half a second each, once both spots are green; and not while a hand is on a
// ball or anything moves)
const READY_S = 1.5;
function drillTag() {
  const D = A.drill; if (!D || !D.base) return; const left = D.since != null ? READY_S - (performance.now() - D.since) / 1000 : null;
  $('#drillTag').innerHTML = '<b>' + (D.ready ? 'Ready: shoot' : left != null ? 'Ready in ' + Math.max(1, Math.ceil(left * 3 / READY_S)) : 'Set the balls on their spots') + '</b><br>' + D.base;
}
// a hand at a ball while counting down: round each spot, 3.5 in out, something that is not cloth and not a ball
function handAtSpots(st) {
  const balls = A.tk.balls().filter(b => b.state !== 'hidden');
  for (const p of [st.O, st.C]) { if (!p) continue; let n = 0;
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, x = p[0] + 3.5 * Math.cos(a), y = p[1] + 3.5 * Math.sin(a);
      const m = A.P.R + 3; // (the check looks at a ball's width round the point: kept off the cushions, which are not cloth)
      if (x < m || y < m || x > A.P.L - m || y > A.P.W - m || balls.some(b => Math.hypot(b.x - x, b.y - y) < 2.5)) continue;
      if (emptyAt(x, y) === false) n++; }
    if (n >= 2) { dbgOnce('drill_hand', 2000, { at: p.map(r1), n }); return true; } }
  return false;
}
function drillReadyLook() {
  const D = A.drill; if (!D || !D.st || A.phase !== 'run' || !A.tk) return;
  if (A.tk.S.phase === 'shot') { drillEarly(); return; } // (a shot running: it was ready or not as it started)
  // Ready holds until the shot (Nov 2, 19:34: a ball flickering at the other end of the table, and the shooter's hand and
  // cue over the balls at the address, dropped it, and real shots counted as setting up); only balls put down by hand
  // (the tracker's "hands") take it back
  if (D.ready) { if (A.tk.S.phase === 'hands') { D.ready = false; D.since = null; dbg('drill_unready', { why: 'hands' }); } drillTag(); return; }
  const st = D.st, near = b => [st.O, st.C].some(p => p && Math.hypot(b.x - p[0], b.y - p[1]) < 10); // (only the drill's balls)
  const on = A.tk.S.phase === 'still' && !A.tk.balls().some(b => near(b) && (b.state === 'moving' || b.state === 'pending')) && drillTaken(st.O, false) && drillTaken(st.C, true) && !(D.since != null && handAtSpots(st));
  if (!on) { D.since = null; D.ready = false; }
  else { if (D.since == null) D.since = performance.now(); if (!D.ready && performance.now() - D.since >= READY_S * 1000) { D.ready = true; dbg('drill_ready', { id: D.id, level: D.level }); } }
  drillTag();
}
// A ball resting on its target pocket's bag line (where a ball lying in that pocket shows up, cloth.js pocketBags) is in
// it (Nov 2 20:27, cut ladder shot 10: the 1 sat in the far right pocket's bowl, in view, scored a miss; the finder's 0.69
// for it was over the tracker's 0.6 for a ball in a pocket, which on all the recorded sessions cannot be raised without
// losing more than it gains. The drill knows the pocket, so it can look there.)
function onBag(pocket, x, y) { const b = (A.tk.O.bags || []).find(q => q.i === pocket); if (!b) return false; const dx = b.bx - b.ax, dy = b.by - b.ay, u = Math.max(0, Math.min(1, ((x - b.ax) * dx + (y - b.ay) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - b.ax - u * dx, y - b.ay - u * dy) <= 1.5; }
// A ball called in late on a drill shot (Nov 8 10:48: twice the object ball was called in just after the drill had set
// the shot aside as never touched, once after it was scored a miss): the shot is scored again
function drillLate(n) {
  const D = A.drill, sh = A.tk && A.tk.S.shots.find(s => s.n === n), st = A.drillStOf && A.drillStOf.get(n); if (!D || !sh || !st) return;
  const row = A.sess.shots.find(x => x.n === n), t = A.sess.drillTries.find(x => x.n === n);
  if (t) { if (t.made || DRILL.byId(st.id).kind === 'stop') return; const r = DRILL.score(st, sh, A.P); if (r.made) { Object.assign(t, { made: true, pocketed: true }); if (row) row.drill = t; dbg('drill_late', { n }); drillTag(); toast('Shot ' + n + ': made after all'); } return; }
  if (row && row.untouched && D.st === st) { delete row.notShot; delete row.untouched; dbg('drill_late', { n, untouched: true }); drillScore(sh, st); }
}
// The drill's object ball in a shot: the ball resting nearest its spot when the shot started (within 8 in)
function drillOb(sh, st) { const at = b => [b.rx != null ? b.rx : b.x, b.ry != null ? b.ry : b.y]; return (sh.before || []).filter(b => b.num !== 0 && b.key !== sh.cueKey).map(b => ({ b, d: Math.hypot(at(b)[0] - st.O[0], at(b)[1] - st.O[1]) })).filter(x => x.d <= 8).sort((a, b) => a.d - b.d).map(x => x.b)[0] || null; }
// Scored as soon as the object ball is known (owner, Nov 3: the drill is about the object ball; he stops the cue ball and
// sets up the next one): called in, made; rolled and resting for 0.7 s away from the pockets, missed. The stop shot waits
// for the cue ball (that is what it tests); a ball never touched waits for the shot's end.
function drillEarly() {
  const D = A.drill, tk = A.tk, sh = tk.S.shot; if (!D || !D.st || !sh || D.id === 'stop' || !A.drillReadyOf.get(sh.n) || D.early === sh.n) return;
  const st = D.st, ob = drillOb(sh, st); if (!ob) return;
  const tr = tk.S.tracks.find(x => x.key === ob.key), still = tr && tr.state === 'rest' && tr.restSince != null && tk.S.t - tr.restSince >= 0.7 && Math.hypot(tr.x - (ob.rx != null ? ob.rx : ob.x), tr.y - (ob.ry != null ? ob.ry : ob.y)) > 2;
  const bag = still && onBag(st.pocket, tr.x, tr.y), inn = sh.made.some(m => m.key === ob.key) || bag;
  const rested = still && !bag && !A.P.pockets.some(q => Math.hypot(q.x - tr.x, q.y - tr.y) < 6);
  if (!inn && !rested) return;
  D.early = sh.n; dbg('drill_early', { n: sh.n, made: inn, bag: bag || undefined });
  drillScore({ n: sh.n, cueKey: sh.cueKey, before: sh.before, made: sh.made.concat(bag ? [{ key: ob.key, num: ob.num, pocket: st.pocket, bag: true }] : []), scratch: false, after: [] }, st, true);
}
function drillScore(sh, st, early) {
  const D = A.drill; if (!D || D.st !== st) return; // (the drill was changed meanwhile)
  if (!early && A.sess.drillTries.some(x => x.n === sh.n)) return; // (scored already, as soon as the object ball was known)
  const r0 = A.sess.shots.find(x => x.n === sh.n); if (r0 && r0.notShot) return; // (not a shot: setting up)
  // the object ball never touched and nothing in: the cue ball moved by hand after Ready, not a try
  if (!early) { const ob = drillOb(sh, st), af = ob && (sh.after || []).find(b => b.key === ob.key);
    if (ob && af && !sh.made.length && Math.hypot(af.x - (ob.rx != null ? ob.rx : ob.x), af.y - (ob.ry != null ? ob.ry : ob.y)) < 1) { dbg('drill_untouched', { n: sh.n }); if (r0) { r0.notShot = 'setup'; r0.untouched = true; } return; }
    // the object ball lost on its way to the pocket and not seen again: in (Nov 8 10:48, 20: the 8 dropped, lost an inch
    // from its spot, never called; the next ball was set on its spot before the cloth there was looked at)
    if (ob && (!af || af.state === 'hidden') && !sh.made.some(m => m.key === ob.key) && DRILL.byId(st.id).kind !== 'stop') { const p0 = [ob.rx != null ? ob.rx : ob.x, ob.ry != null ? ob.ry : ob.y];
      if (af && Math.hypot(af.x - p0[0], af.y - p0[1]) > 0.5) { const a1 = Math.atan2(af.y - p0[1], af.x - p0[0]), a2 = Math.atan2(st.Pk[1] - p0[1], st.Pk[0] - p0[0]);
        if (Math.abs(((a1 - a2) / Math.PI * 180 + 540) % 360 - 180) < 30) { sh = Object.assign({}, sh, { made: sh.made.concat([{ key: ob.key, num: ob.num, pocket: st.pocket, vanished: true }]) }); dbg('drill_vanished', { n: sh.n }); } } } }
  // (at the shot's end too: the object ball resting in its pocket's bowl, in view, is in)
  if (!early) { const ob = drillOb(sh, st), af = ob && (sh.after || []).find(b => b.key === ob.key); if (af && !sh.made.some(m => m.key === ob.key) && onBag(st.pocket, af.x, af.y)) { sh = Object.assign({}, sh, { made: sh.made.concat([{ key: ob.key, num: ob.num, pocket: st.pocket, bag: true }]) }); dbg('drill_bag', { n: sh.n }); } }
  const r = DRILL.score(st, sh, A.P);
  if (!r.scored) { toast('Not a drill shot: the object ball was not on its spot.'); return; }
  const t = { id: D.id, level: D.level, value: st.value, made: r.made, pocketed: r.pocketed, stopped: r.stopped, cut: r.cut, n: sh.n }; A.sess.drillTries.push(t);
  const row = A.sess.shots.find(x => x.n === sh.n); if (row) row.drill = t; // (scored early: the row gets it at the shot's end)
  // three at each step, in order, made or missed (owner, Nov 3: progressive kept him from getting on; it may come back
  // as a choice); after the last step the drill is done
  dbg('drill', t); const res = r.made ? 'Made' : r.pocketed && r.stopped === false ? 'In, but the cue ball did not stop' : 'Missed';
  D.n = (D.n || 0) + 1; if (D.n >= DRILL.PER) { D.n = 0; D.level++; }
  if (D.level >= DRILL.byId(D.id).levels.length) { const ts = A.sess.drillTries.filter(x => x.id === D.id && x.n > (D.from || 0)); toast(res + ' · ' + DRILL.byId(D.id).name + ' done: made ' + ts.filter(x => x.made).length + ' of ' + ts.length + '.', 7000); drillStop(); return; }
  drillSetup(); toast(res + ' · next: ' + D.st.word + ' (' + (D.n + 1) + ' of ' + DRILL.PER + ')', 4000);
}
// the setup on the live view: rings where the balls go (green when a ball is on it), the cue ball's aim to where it
// meets the ball, the ball's line to the pocket (off the near cushion for the bank), the pocket ringed
function drillTaken(p, cue) { return A.tk.balls().some(b => b.state !== 'hidden' && Math.hypot(b.x - p[0], b.y - p[1]) < 4 && (cue ? b.num === 0 || b.num == null : b.num !== 0)); }
function drillLine(c, S2, a, b) { const flat = (x, y) => S2(A.cam.proj(x, y, 0)), p = flat(a[0], a[1]), q = flat(b[0], b[1]); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); }
function drawDrill(c, S2) {
  // (owner, Nov 3: the marks as light as can be seen; where a ball goes shown by two faint lines in from the long rail and
  // the short rail, crossing at its spot; the spots and the ghost ball as dashed ball outlines, green once a ball is on)
  const D = A.drill; if (!D || !D.st || !A.cam) return; const st = D.st, P = A.P, flat = (x, y) => S2(A.cam.proj(x, y, 0));
  const seg = (a, b) => { const p = flat(a[0], a[1]), q = flat(b[0], b[1]); c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); };
  const ring = (p, r, z) => { c.beginPath(); for (let i = 0; i <= 36; i++) { const a = i / 36 * Math.PI * 2, s = S2(A.cam.proj(p[0] + r * Math.cos(a), p[1] + r * Math.sin(a), z || 0)); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); } c.stroke(); };
  c.save(); c.lineWidth = 1;
  // the rail lines: from the nearer long rail and the nearer short rail to each spot
  c.strokeStyle = 'rgba(244,241,232,.38)';
  for (const p of [st.O, st.C]) { if (!p) continue; seg([p[0], p[1] < P.W / 2 ? 0 : P.W], p); seg([p[0] < P.L / 2 ? 0 : P.L, p[1]], p); }
  // the way: the cue ball to where it meets the object ball, and the object ball to the pocket (off the cushion for a bank)
  c.setLineDash([4, 6]); c.strokeStyle = 'rgba(244,241,232,.25)'; if (st.C) drillLine(c, S2, st.C, st.G);
  if (st.aimAt === st.Pk) drillLine(c, S2, st.O, st.Pk);
  else { const yc = st.aimAt[1] < 0 ? P.R : P.W - P.R, t = (yc - st.O[1]) / (st.aimAt[1] - st.O[1]), hit = [st.O[0] + t * (st.aimAt[0] - st.O[0]), yc]; drillLine(c, S2, st.O, hit); drillLine(c, S2, hit, st.Pk); }
  // the spots, the ghost ball and the pocket: dashed outlines
  c.setLineDash([3, 3]); c.lineWidth = 1.3;
  for (const [p, isCue] of [[st.O, false], [st.C, true]]) { if (!p) continue; c.strokeStyle = drillTaken(p, isCue) ? 'rgba(61,220,132,.8)' : 'rgba(244,241,232,.65)'; ring(p, P.R, P.R); }
  c.lineWidth = 1; c.strokeStyle = 'rgba(244,241,232,.3)'; ring(st.G, P.R, P.R);
  // which spot is the cue ball's: a tiny word under it
  if (st.C) { const m = S2(A.cam.proj(st.C[0], st.C[1] - 2.2 * P.R, 0)); c.setLineDash([]); c.font = '500 9px system-ui, -apple-system, sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(244,241,232,.6)'; c.fillText('cue', m[0], m[1] + 8); }
  c.setLineDash([3, 3]); c.strokeStyle = 'rgba(255,184,77,.45)'; ring(st.Pk, P.pockets[st.pocket].r + 1);
  c.restore();
}

// ---------- the stroke (V3.2) ----------
// Every watcher frame while the cue ball rests: where the cue points and how far its tip is (src/stroke.js). The frames
// before a shot give its practice strokes, backswing, pause and strike; the second after it the follow-through. Measured
// from the side only (the cue within 25 degrees of level in the picture); toward or away from the phone the cue is too
// short to measure in the small picture (owner, Nov 2: "see it from the side for a bit").
const STK = { obs: [], rest0: null, rest: null, ball: null, ang: null, key: null, shotT: null, test: null, opt: null, of: new Map(), err: 0 };
function strokeFrame(img, t) {
  const tk = A.tk, W = WATCH; if (!tk || !A.cam || !A.cloth) return;
  if (!STK.test) STK.test = STROKE.clothTest(A.cloth, rgb2hsv);
  const inShot = STK.shotT != null && t - STK.shotT < 1500;
  if (tk.S.phase === 'shot' && !inShot) return;
  const k = W.w / W.box[2];
  if (!inShot) {
    const cue = tk.balls().find(b => b.num === 0 && b.sure && b.state === 'rest');
    if (cue) { const p = A.cam.proj(cue.x, cue.y, A.P.R), px = [(p[0] - W.box[0]) * k, (p[1] - W.box[1]) * k];
      if (!STK.rest0 || STK.key !== cue.key || Math.hypot(px[0] - STK.rest0[0], px[1] - STK.rest0[1]) > 3) {
        const rb = Math.max(2, A.cam.ballRad(cue.x, cue.y, A.P.R, A.P.R) * k);
        Object.assign(STK, { key: cue.key, rest0: px, rest: null, ball: px, ang: null, fb: null, fv: null, obs: [], shotT: null,
          opt: { rBall: Math.ceil(rb), reach: Math.max(4, rb * 1.6), inside: (x, y) => !!W.mask[(y * W.w + x) >> 1] } }); } }
    else if (!STK.rest0) return;
  }
  if (!STK.ball) return; // (no cue ball being followed: off the table, Nov 8 20:24)
  const o = STROKE.observe(img, W.w, W.h, { ball: STK.ball, ang: STK.ang, rest: STK.rest, fb: STK.fb, fv: STK.fv }, STK.test, STK.opt); STK.fb = o.fb; STK.fv = o.fv;
  if (o.ball && !o.lost) { STK.ball = o.ball; if (!STK.rest) STK.rest = o.ball; }
  if (o.ang != null) STK.ang = o.ang;
  STK.obs.push(Object.assign({ t }, o)); while (STK.obs.length && t - STK.obs[0].t > 6000) STK.obs.shift();
}
// a shot started: a second and a half later its stroke is summed up and kept with the shot
function strokeShot(n) {
  const t = Date.now() - DBG.t0, W = WATCH; STK.shotT = t;
  setTimeout(() => {
    const obs = STK.obs.filter(q => q.t >= t - 6000), k = W.w / W.box[2], toTable = (px, py) => A.cam.unproj(W.box[0] + px / k, W.box[1] + py / k, A.P.R);
    let r = null; try { r = obs.length > 10 ? STROKE.summarize(obs, toTable) : null; } catch (e) { dbg('error', { m: 'stroke sum ' + String(e && e.message || e).slice(0, 100) }); }
    const pre = obs.filter(q => r && r.strike != null && q.t < r.strike), angs = pre.map(q => q.ang).filter(a => a != null).sort((a, b) => a - b), med = angs.length ? angs[angs.length >> 1] : null;
    const level = med != null && Math.min(Math.abs(((med + 180) % 180)), 180 - ((med + 180) % 180)) <= 25, seen = pre.length ? angs.length / pre.length : 0;
    const st = r && r.strike != null ? { early: r2((t - r.strike) / 1000), side: level && seen >= 0.6, strokes: r.strokes, back: r.backLen, pause: r.pause, follow: r.follow, seen: r2(seen), ang: med } : { none: true };
    dbg('stroke', Object.assign({ n }, st, r && r.curve ? { curve: r.curve.map(c => [c[0] - t, c[1]]) } : {}));
    // pushed with the cue rather than struck (see STROKE.moveCheck): logged only, for measuring (it decides nothing since V3.8.3)
    let mv = null; try { mv = obs.length > 10 ? STROKE.moveCheck(obs, t, toTable) : null; } catch (e) { dbg('error', { m: 'move ' + String(e && e.message || e).slice(0, 100) }); }
    if (mv) { st.move = mv.move; dbg('move_check', Object.assign({ n }, mv)); }
    STK.of.set(n, st); const row = A.sess && A.sess.shots.find(x => x.n === n); if (row) row.stroke = st;
    STK.shotT = null; STK.rest0 = null; STK.obs = [];
  }, 1600);
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

// ---------- drawing ----------
function fit() { const w = ov.clientWidth, h = ov.clientHeight, k = Math.min(w / (A.W || 1), h / (A.H || 1)); return { k, x: (w - A.W * k) / 2, y: (h - A.H * k) / 2, w, h }; }
function drawLoop() {
  if (!A.live) return; requestAnimationFrame(drawLoop);
  const dpr = window.devicePixelRatio || 1, F = fit(); if (!A.W) return;
  if (ov.width !== Math.round(F.w * dpr) || ov.height !== Math.round(F.h * dpr)) { ov.width = Math.round(F.w * dpr); ov.height = Math.round(F.h * dpr); }
  const c = ov.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, F.w, F.h);
  const S2 = p => [F.x + p[0] * F.k, F.y + p[1] * F.k];
  if (A.frozen && A.frame.width) c.drawImage(A.frame, F.x, F.y, A.W * F.k, A.H * F.k); // the still picture over the live one
  // the table (owner, Nov 3: the outline at cloth level looked off; it is the line on the cloth under the cushion noses,
  // which the near cushion hangs over). While checking it: the outline at the height of the cushion noses (1.4 in), which
  // runs along the edges one sees, with the corners. While watching: only a small dot at the mouth of each pocket.
  const q = A.phase === 'verify' && A.cand ? A.cand.quad : A.phase === 'run' || A.phase === 'load' ? A.quad : null;
  if (q) {
    const { L, Wd } = tableDims(A.ft), cm = A.phase === 'verify' ? (A.candCam && A.candCam.q === q ? A.candCam.cam : (A.candCam = { q, cam: makeCam(tableCornersFor(A.cand.rot, L, Wd), q, A.W, A.H, LENS * Math.max(A.W, A.H), [A.W / 2, A.H / 2]) }).cam) : A.cam;
    if (cm && cm.ok !== false) {
      const NOSE = 1.4, at = (x, y) => S2(cm.proj(x, y, NOSE));
      if (A.phase === 'verify') {
        c.strokeStyle = 'rgba(89,214,232,.95)'; c.lineWidth = 2.5; c.beginPath(); let k = 0;
        for (const [a0, b0] of [[[0, 0], [L, 0]], [[L, 0], [L, Wd]], [[L, Wd], [0, Wd]], [[0, Wd], [0, 0]]]) for (let i = 0; i <= 12; i++) { const t = i / 12, p = at(a0[0] + (b0[0] - a0[0]) * t, a0[1] + (b0[1] - a0[1]) * t); k++ ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }
        c.closePath(); c.stroke();
        for (const [x, y] of [[0, 0], [L, 0], [L, Wd], [0, Wd]]) { const p = at(x, y); c.fillStyle = '#59d6e8'; c.beginPath(); c.arc(p[0], p[1], 6, 0, Math.PI * 2); c.fill(); }
      } else for (const pk of A.P.pockets) { const p = at(pk.x, pk.y); c.fillStyle = 'rgba(89,214,232,.55)'; c.beginPath(); c.arc(p[0], p[1], 2.5, 0, Math.PI * 2); c.fill(); }
    }
  }
  if (A.phase === 'manual' && A.man) drawManual(c, S2, F);
  // a drill's rings as soon as the table is accepted, while the ball finder starts (Nov 2, 16:55: it never started, and
  // the rings never showed)
  if ((A.phase === 'run' || A.phase === 'load') && A.cam) drawDrill(c, S2);
  if (A.pathClearAt && performance.now() > A.pathClearAt) { PATH.clear(); A.pathClearAt = null; }
  if (A.phase !== 'run' || !A.tk || !A.cam) return;
  if (A.mode === 'coach') drawCoach(c, S2, F);
  drawBalls(c, S2, F);
}

// ---------- coaching test (V3.10, owner Nov 9) ----------
// Small runouts with the 9 always on; the player shoots the lowest ball first whatever the plan says (the plan is being
// tested). While the balls rest: the planner (src/v3/coach.js, in a background worker) on the balls named for sure, and on
// the screen, lightly: a ring round the pocket for the ball to shoot, for the next and for the one after, each in that
// ball's colour; the zone for the next ball (green: the right side, red: the wrong side, grey: a ball in the way, yellow:
// harder); the cue ball's way from this shot into the green. After the shot: where the cue ball stopped against that zone,
// in the shot's row, the log (coach_plan, coach_shot) and the shot's words. No buttons.
const CO = { sig: '', plan: null, balls: null, busy: false, worker: null, id: 0, atStart: null, poly: null };
$('#rejectBtn').onclick = () => coachReject();
function coachWorker() {
  if (CO.worker !== null) return CO.worker;
  try {
    // the planner with the physics simulation (core.js) in the worker (V3.11)
    const src = 'const clamp=' + clamp.toString() + ';' + stepBall.toString() + cushion.toString() + simulate.toString() + 'const COACH=(' + coachFactory.toString() + ')(simulate);onmessage=e=>{let r=null;try{r=COACH.plan(e.data.balls,e.data.P,e.data.opts);}catch(x){r={error:String(x)};}postMessage({id:e.data.id,r});};';
    CO.worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    CO.worker.onmessage = e => coachDone(e.data.id, e.data.r);
    CO.worker.onerror = e => { dbg('error', { m: 'coach worker ' + String(e && e.message || '').slice(0, 100) }); CO.worker = false; CO.busy = false; };
  } catch (e) { CO.worker = false; dbg('error', { m: 'coach worker ' + String(e).slice(0, 100) }); }
  return CO.worker;
}
function coachLayout() {
  // the balls on the table: named for sure (the cue ball and 1-9) at rest; unnamed ones still count as balls in the way
  const bs = A.tk.balls().filter(b => b.state === 'rest' || b.state === 'hidden');
  const cue = bs.find(b => b.num === 0 && b.sure);
  // no cue ball on the table after a scratch: ball in hand (V3.11), planned with the cue ball placed
  if (!cue && !(CO.scratchT && A.tk.S.t - CO.scratchT < 120)) return null;
  const out = []; for (const b of bs) if (b.num !== 0) out.push({ n: b.num != null && b.sure ? b.num : 100 + b.key, x: +b.x.toFixed(1), y: +b.y.toFixed(1) }); else if (b === cue) out.push({ n: 0, x: +b.x.toFixed(1), y: +b.y.toFixed(1) });
  if (!out.some(b => b.n > 0 && b.n < 100)) return null;
  const nums = out.filter(b => b.n < 100).map(b => b.n); if (new Set(nums).size !== nums.length) return null; // a number twice: wait
  return out;
}
function coachLook() {
  const tk = A.tk; if (tk.S.phase !== 'still' || tk.balls().some(b => b.state === 'moving' || b.state === 'pending')) return;
  const bs = coachLayout(); if (!bs) return;
  // plan again only when the set of balls changed or one moved more than 1.2 in from where the plan had it (Nov 9, 19:32:
  // 145 plans in 25 shots, the positions' jitter crossing a rounding line)
  const sig = bs.map(b => b.n).sort((a, b) => a - b).join(',');
  if (CO.busy) return;
  if (sig === CO.sig && CO.pending && bs.every(b => CO.pending.some(q => q.n === b.n && Math.hypot(q.x - b.x, q.y - b.y) < 1.2))) return;
  CO.sig = sig; CO.busy = true; CO.pending = bs; const id = ++CO.id;
  const P = JSON.parse(JSON.stringify(A.P)); // the whole table: size, pockets, cloth and cushions (the physics needs them)
  const w = coachWorker();
  const opts = Object.assign({ inHand: !bs.some(b => b.n === 0) }, coachOpts());
  if (w) w.postMessage({ id, balls: bs, P, opts });
  else setTimeout(() => { let r = null; try { r = COACH.plan(bs, P, Object.assign({ step: 2 }, opts)); } catch (e) { r = { error: String(e) }; } coachDone(id, r); }, 0);
}
function coachDone(id, r) {
  CO.busy = false; if (id !== CO.id) return;
  if (!r || r.error) { if (r && r.error) dbg('error', { m: 'coach ' + r.error.slice(0, 120) }); CO.plan = null; return; }
  CO.plan = r; CO.balls = CO.pending; CO.poly = null; $('#rejectBtn').hidden = A.mode !== 'coach';
  const cnt = { green: 0, red: 0, blocked: 0 }; if (r.cells) for (const v of r.cells) { if (v === 1) cnt.green++; else if (v === 3) cnt.red++; else if (v === 4) cnt.blocked++; }
  dbg('coach_plan', { order: r.order, A: r.A, B: r.B, C: r.C, inHand: !!r.inHand, noShot: r.noShot || null, spot: r.spot && r.spot.map(r1), path: r.path ? { shot: r.path.shot, kind: r.path.kind, cut: r.path.cut, stroke: r.path.stroke || null, make: r.path.make, next: r.path.next, legal: r.path.legal, opp: r.path.opp, alt: r.path.alt || null, alts: r.path.alts || null, n: (r.path.pts || []).length, end: r.path.p && r.path.p.map(r1) } : null, route: r.route ? { kind: r.route.kind, s: r.route.s } : null, fan: r.zoneFan ? { lo: r.zoneFan.lo, hi: r.zoneFan.hi, r0: r.zoneFan.r0, r1: r.zoneFan.r1, q0: r.zoneFan.q0 } : null, tight: r.path && r.path.tight || null, thin: r.path ? r.path.fanThin : null, cells: cnt, ms: r.ms, balls: CO.balls });
}
// the player rejects the plan on the screen (owner, Nov 9: "this isn't realistic"): everything the plan was made from and a
// picture of the table, for the review (was a ball or the table read wrong, or was the plan wrong); the next shot's row says so
function coachReject() {
  const p = CO.plan; if (!p) return; CO.rejected = (CO.rejected || 0) + 1; const nm = 'reject-' + String(CO.rejected).padStart(3, '0') + '.jpg';
  jpeg(960).then(b => setPic(nm, b)).catch(() => { });
  dbg('coach_reject', { pic: nm, order: p.order, A: p.A, B: p.B, C: p.C, inHand: !!p.inHand, noShot: p.noShot || null, spot: p.spot && p.spot.map(r1), path: p.path ? { shot: p.path.shot, stroke: p.path.stroke, make: p.path.make, next: p.path.next, legal: p.path.legal, opp: p.path.opp, ghost: p.path.ghost && p.path.ghost.map(r1), end: p.path.p && p.path.p.map(r1), alts: p.path.alts || null } : null, balls: CO.balls });
  CO.rejectedPlan = p; toast('Plan rejected: saved with a picture for the review');
}
function coachShotStart() { CO.atStart = CO.plan && CO.sig ? { plan: CO.plan, balls: CO.balls } : null; }
function coachShotEnd(sh, row, row1) {
  const st = CO.atStart; CO.atStart = null; if (!st) return;
  const p = st.plan, cueAfter = (sh.after || []).find(b => b.key === sh.cueKey) || (sh.after || []).find(b => b.num === 0);
  const madeA = row.made.find(m => m.num === p.A.n), at = cueAfter ? [cueAfter.rx != null ? cueAfter.rx : cueAfter.x, cueAfter.ry != null ? cueAfter.ry : cueAfter.y] : null;
  const c = { order: p.order, plan: { A: p.A.pocket, B: p.B && p.B.pocket, C: p.C && p.C.pocket }, lowestFirst: sh.firstNum == null ? null : sh.firstNum === p.A.n, madeA: !!madeA, pocketA: madeA ? madeA.pocket : null,
    cueAt: at && at.map(r1), zone: !!p.cells, landed: at && p.cells && madeA ? COACH.gradeAt(p, at[0], at[1]) : null, spot: p.spot && p.spot.map(r1), scratch: !!sh.scratch,
    stroke: p.path && p.path.stroke || null, shot: p.path && p.path.shot || null, make: p.path && p.path.make, next: p.path && p.path.next, rejected: CO.rejectedPlan === p };
  // the planned shot's geometry (for the player's own percentages later: cut, cue ball to object ball, object ball to pocket)
  { const a0 = st.balls && st.balls.find(b => b.n === p.A.n), cb = st.balls && st.balls.find(b => b.n === 0), pk = p.A.pocket != null ? A.P.pockets[p.A.pocket] : null, g = p.path && p.path.ghost;
    if (a0 && cb && pk && g) { const u = [pk.x - a0.x, pk.y - a0.y], v = [g[0] - cb.x, g[1] - cb.y], lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1]);
      c.geo = { cut: Math.round(Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (lu * lv || 1)))) * 180 / Math.PI), d1: Math.round(lv), d2: Math.round(lu), pocket: p.A.pocket }; } }
  // the cue ball's real path against the planned one (owner, Nov 9): the angle it came off the object ball, how far it went,
  // where it stopped. Off by much with the ball made: the cut, the contact, the pocket cheated, the spin or the speed differed
  // from the plan (the table read wrong, or the stroke); in the log for the review and short in the shot's words
  const real = (sh.paths || []).find(q => q.key === sh.cueKey), plan = p.path && p.path.pts && p.path.pts.length > 3 ? p.path.pts : null;
  if (real && plan && real.p.length > 3) {
    const rp = real.p.map(q => [q[1], q[2]]), g = p.path.ghost, near = rp.reduce((bi, q, i) => Math.hypot(q[0] - g[0], q[1] - g[1]) < Math.hypot(rp[bi][0] - g[0], rp[bi][1] - g[1]) ? i : bi, 0);
    const along = (pts, i0, d) => { let s0 = 0; for (let i = i0 + 1; i < pts.length; i++) { s0 += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (s0 >= d) return pts[i]; } return pts[pts.length - 1]; };
    const plen = pts => { let s0 = 0; for (let i = 1; i < pts.length; i++) s0 += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s0; };
    if (Math.hypot(rp[near][0] - g[0], rp[near][1] - g[1]) < 5) {
      const a1 = along(rp, near, 8), a0 = along(plan, 0, 8), ra = Math.atan2(a1[1] - rp[near][1], a1[0] - rp[near][0]), pa = Math.atan2(a0[1] - plan[0][1], a0[0] - plan[0][0]);
      let da = (ra - pa) * 180 / Math.PI; while (da > 180) da -= 360; while (da < -180) da += 360;
      const ratio = plen(rp.slice(near)) / Math.max(1, plen(plan)), end = p.path.p;
      c.compare = { angle: Math.round(da), travel: r2(ratio), stopOff: end && at ? r1(Math.hypot(at[0] - end[0], at[1] - end[1])) : null, powerSeen: p.path.stroke ? r1(p.path.stroke.power * Math.sqrt(ratio)) : null };
      dbg('coach_compare', Object.assign({ n: sh.n, made: !!madeA }, c.compare));
    }
  }
  // where it stopped against the perfect spot: long or short along the way the plan had the cue ball going there, and to the side
  if (at && p.spot && !sh.scratch && p.path && p.path.shot !== 'safety') {
    const way = (p.path.pts || []).concat([p.spot]); let u = null;
    for (let i = way.length - 2; i >= 0 && !u; i--) { const d = [p.spot[0] - way[i][0], p.spot[1] - way[i][1]], l = Math.hypot(d[0], d[1]); if (l > 3) u = [d[0] / l, d[1] / l]; }
    const d = [at[0] - p.spot[0], at[1] - p.spot[1]];
    c.stop = { off: r1(Math.hypot(d[0], d[1])), along: u ? r1(d[0] * u[0] + d[1] * u[1]) : null, side: u ? r1(d[1] * u[0] - d[0] * u[1]) : null };
  }
  if (sh.scratch) CO.scratchT = A.tk.S.t; // ball in hand next
  row1.coach = c; dbg('coach_shot', Object.assign({ n: sh.n }, c));
}
// the pockets for this ball, the next and the one after (V3.14.1, owner Nov 10: the rings were big and piled on the rest):
// a dot on the pocket and a short line out away from the table to the ball's number on its colour. Several balls on one
// pocket each get their own line, spread out and in shot order from left to right on the screen.
function coachPockets(c, S2, F, pk, bs) {
  const L = A.P.L, W = A.P.W, ox = pk.x < L * 0.25 ? -1 : pk.x > L * 0.75 ? 1 : 0, oy = pk.y < W / 2 ? -1 : 1;
  const o = S2(A.cam.proj(pk.x, pk.y, 0)), q = S2(A.cam.proj(pk.x + ox * 6, pk.y + oy * 6, 0));
  let ux = q[0] - o[0], uy = q[1] - o[1]; const l = Math.hypot(ux, uy) || 1; ux /= l; uy /= l;
  const n = bs.length, spread = 34 * Math.PI / 180, len = 34, ends = [];
  for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * spread, ca = Math.cos(a), sa = Math.sin(a); ends.push([o[0] + (ux * ca - uy * sa) * len, o[1] + (ux * sa + uy * ca) * len]); }
  ends.sort((a, b) => a[0] - b[0]);
  if (F) for (const e of ends) { e[0] = Math.max(F.x + 10, Math.min(F.x + F.w - 10, e[0])); e[1] = Math.max(F.y + 10, Math.min(F.y + F.h - 10, e[1])); }
  bs.forEach((b, k) => {
    const e = ends[k], col = BALLCOL[b.n] || '#eaf1f4';
    c.beginPath(); c.moveTo(o[0], o[1]); c.lineTo(e[0], e[1]); c.lineWidth = 3.4; c.strokeStyle = 'rgba(11,16,20,.55)'; c.stroke(); c.lineWidth = 1.8; c.strokeStyle = col; c.stroke();
    c.beginPath(); c.arc(e[0], e[1], 8, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(11,16,20,.7)'; c.stroke();
    const h = parseInt(col.slice(1), 16), lum = 0.299 * (h >> 16) + 0.587 * (h >> 8 & 255) + 0.114 * (h & 255);
    c.font = '700 10px system-ui, -apple-system, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = lum > 140 ? '#16181b' : '#f4f1e8'; c.fillText(String(b.n), e[0], e[1] + 0.5);
  });
  c.beginPath(); c.arc(o[0], o[1], 3.2, 0, Math.PI * 2); c.fillStyle = n === 1 ? (BALLCOL[bs[0].n] || '#eaf1f4') : '#f4f1e8'; c.fill(); c.lineWidth = 1.2; c.strokeStyle = 'rgba(11,16,20,.7)'; c.stroke();
}
function drawCoach(c, S2, F) {
  // each part on its own: one bad number must not take the rest of the plan off the screen (Nov 8 20:24: the cone's radius was
  // not a number, the canvas threw every frame and the lines, the band and the stroke box never showed)
  try { drawCoach1(c, S2, F); } catch (e) { c.restore(); if (!CO.drawErr) { CO.drawErr = 1; dbg('error', { m: 'coach draw ' + String(e && e.message || e).slice(0, 120) }); } }
}
function drawCoach1(c, S2, F) {
  const p = CO.plan; if (!p || A.stest) return; // (a stroke test: nothing planned on the screen)
  // the plan stays on the screen through the shot and until the next one is made, faint (owner, Nov 9: to see the cue ball's
  // real path against the planned one and the zone): full while the balls are still where the plan had them
  const now = A.tk.balls(), same = CO.balls && !CO.balls.some(b => b.n < 100 && !now.some(t => t.num === b.n && Math.hypot(t.x - b.x, t.y - b.y) < 1.5));
  const faint = A.tk.S.phase === 'shot' || !same; c.save(); c.globalAlpha = faint ? 0.42 : 1;
  const poly = (q, z = 0) => { c.beginPath(); q.forEach((v, i) => { const a = S2(A.cam.proj(v[0], v[1], z)); i ? c.lineTo(a[0], a[1]) : c.moveTo(a[0], a[1]); }); c.closePath(); };
  const sh = p.shapes, safety = p.path && p.path.shot === 'safety';
  if (sh && !safety) { // (no zone for a safety: the next shot is the other player's)
    // the zone (V3.14, owner Nov 9): a fan seen from the next ball round the perfect spot, wider on the side where the next
    // shot stays good, 30 degrees at most; green strongest at the spot and fading out, the outer seventh each side yellow, the
    // ideal line through the spot; no outlines. (The 50-60% band and the shadows of balls in the way are gone: they made the
    // zone look like anywhere.)
    const fz = p.zoneFan, fin = q => q && q.length > 2 && q.every(v => isFinite(v[0]) && isFinite(v[1]));
    if (fz && fin(fz.core) && isFinite(fz.spot[0])) {
      const o = S2(A.cam.proj(fz.spot[0], fz.spot[1], 0)); let rad = 1;
      for (const q of [fz.core, ...fz.sides]) if (fin(q)) for (const v of q) { const a = S2(A.cam.proj(v[0], v[1], 0)); rad = Math.max(rad, Math.hypot(a[0] - o[0], a[1] - o[1])); }
      if (!isFinite(rad) || !isFinite(o[0]) || !isFinite(o[1])) rad = 1;
      const grad = (rgb, a0, a1, a2) => { const g = c.createRadialGradient(o[0], o[1], 0, o[0], o[1], rad); g.addColorStop(0, 'rgba(' + rgb + ',' + a0 + ')'); g.addColorStop(0.5, 'rgba(' + rgb + ',' + a1 + ')'); g.addColorStop(1, 'rgba(' + rgb + ',' + a2 + ')'); return g; };
      poly(fz.core); c.fillStyle = grad('46,204,113', .85, .66, .38); c.fill();
      for (const q of fz.sides) if (fin(q)) { poly(q); c.fillStyle = grad('241,196,15', .7, .55, .32); c.fill(); }
      const l0 = S2(A.cam.proj(fz.line[0][0], fz.line[0][1], 0)), l1 = S2(A.cam.proj(fz.line[1][0], fz.line[1][1], 0));
      c.lineWidth = 0.9; c.strokeStyle = 'rgba(244,241,232,.6)'; c.beginPath(); c.moveTo(l0[0], l0[1]); c.lineTo(l1[0], l1[1]); c.stroke();
    }
  }
  // the band the cue ball's path can take for the same stroke aimed to the inside and to the outside of the pocket (the ball
  // still in): it widens the further the cue ball goes (owner, Nov 9)
  if (p.path && p.path.fan) {
    // the band the cue ball's path can take for the stroke asked: hitting the object ball thinner (to one side of the pocket)
    // and thicker (to the other): two clear lines, see-through white between, widening as the cue ball goes (owner, Nov 9)
    const [f0, f1] = p.path.fan, pts = f0.concat(f1.slice().reverse()), sc = q => S2(A.cam.proj(q[0], q[1], A.P.R));
    if (pts.length > 3) {
      c.beginPath(); pts.forEach((q, i) => { const a = sc(q); i ? c.lineTo(a[0], a[1]) : c.moveTo(a[0], a[1]); }); c.closePath(); c.fillStyle = 'rgba(244,241,232,.22)'; c.fill();
      [f0, f1].forEach((f, k) => {
        const fo = k ? f0 : f1;
        c.lineWidth = 3.2; c.strokeStyle = 'rgba(11,16,20,.45)'; c.beginPath(); f.forEach((q, i) => { const a = sc(q); i ? c.lineTo(a[0], a[1]) : c.moveTo(a[0], a[1]); }); c.stroke();
        c.lineWidth = 1.7; c.strokeStyle = 'rgba(244,241,232,.92)'; c.stroke();
        // each line's word on its own outer side (V3.14: the two ends close together put the words on top of each other)
        if (p.path.fanThin != null && f.length > 2 && fo.length > 2) {
          const e = sc(f[f.length - 1]), o = sc(fo[fo.length - 1]), b = sc(f[Math.max(0, f.length - 3)]), t = k === p.path.fanThin ? 'OC' : 'UC';
          let dx = e[0] - o[0], dy = e[1] - o[1], l = Math.hypot(dx, dy);
          if (l < 4) { dx = -(e[1] - b[1]); dy = e[0] - b[0]; l = Math.hypot(dx, dy) || 1; if (k) { dx = -dx; dy = -dy; } }
          dx /= l; dy /= l; c.font = '600 10px system-ui, -apple-system, sans-serif'; const tw = c.measureText(t).width;
          const X0 = e[0] + dx * (8 + tw / 2 * Math.abs(dx)), Y0 = e[1] + dy * 11;
          c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = 'rgba(11,16,20,.7)'; c.strokeText(t, X0, Y0); c.fillStyle = '#f4f1e8'; c.fillText(t, X0, Y0);
        }
      });
    }
  }
  // ball in hand (after a scratch): where to put the cue ball, and its line to the ghost ball
  if (p.inHand && p.spot) {
    const a = S2(A.cam.proj(p.spot[0], p.spot[1], A.P.R));
    if (p.path && p.path.ghost) { const gh = S2(A.cam.proj(p.path.ghost[0], p.path.ghost[1], A.P.R)); c.setLineDash([4, 4]); c.lineWidth = 1.2; c.strokeStyle = 'rgba(244,241,232,.6)'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(gh[0], gh[1]); c.stroke(); c.setLineDash([]); }
    c.font = '600 12px system-ui, -apple-system, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.lineWidth = 3; c.strokeStyle = 'rgba(11,16,20,.7)'; const t = 'Ball in hand: cue ball here' + (p.path && p.path.make != null ? ' (' + Math.round(p.path.make * 100) + '% to make, ' + Math.round(p.path.next * 100) + '% next)' : ''); c.strokeText(t, a[0], a[1] - 12); c.fillStyle = '#f4f1e8'; c.fillText(t, a[0], a[1] - 12);
  }
  // the object ball's way to the pocket, off the cushions for a bank (V3.14, owner Nov 9): in its colour, every pot
  if (p.path && p.path.ob && p.path.ob.length > 1 && !safety) {
    c.beginPath(); p.path.ob.forEach((q, i) => { const a = S2(A.cam.proj(q[0], q[1], A.P.R)); i ? c.lineTo(a[0], a[1]) : c.moveTo(a[0], a[1]); });
    c.lineWidth = 2.4; c.strokeStyle = 'rgba(11,16,20,.4)'; c.stroke(); c.lineWidth = 1.1; c.strokeStyle = BALLCOL[p.A.n] || '#eaf1f4'; c.stroke();
  }
  // the cue ball's way: dashed to the ghost ball, solid on from there to the spot (drawn from where the cue ball was)
  const cueNow = now.find(t => t.num === 0), cue0 = CO.balls && CO.balls.find(b => b.n === 0), cue = same && cueNow ? cueNow : cue0;
  if (p.path && cue && !p.inHand) {
    const gh = S2(A.cam.proj(p.path.ghost[0], p.path.ghost[1], A.P.R)), cp = S2(A.cam.proj(cue.x, cue.y, A.P.R));
    c.setLineDash([4, 4]); c.lineWidth = 1.2; c.strokeStyle = 'rgba(244,241,232,.6)'; c.beginPath();
    if (p.path.pre && p.path.pre.length > 1) p.path.pre.forEach((q, i) => { const a = S2(A.cam.proj(q[0], q[1], A.P.R)); i ? c.lineTo(a[0], a[1]) : c.moveTo(a[0], a[1]); }); // a kick: off the cushions
    else { c.moveTo(cp[0], cp[1]); c.lineTo(gh[0], gh[1]); }
    c.stroke(); c.setLineDash([]);
    c.lineWidth = 1; c.strokeStyle = 'rgba(244,241,232,.9)'; c.beginPath(); p.path.pts.concat(p.spot ? [p.spot] : []).forEach((q, i) => { const a = S2(A.cam.proj(q[0], q[1], A.P.R)); i ? c.lineTo(a[0], a[1]) : c.moveTo(a[0], a[1]); }); c.stroke();
  }
  // the perfect spot: a ball-sized ring with a dot
  if (p.spot) { const a = S2(A.cam.proj(p.spot[0], p.spot[1], A.P.R)), e = S2(A.cam.proj(p.spot[0] + A.P.R, p.spot[1], A.P.R)), r = Math.max(3, Math.abs(e[0] - a[0]));
    c.lineWidth = 3.5; c.strokeStyle = 'rgba(11,16,20,.45)'; c.beginPath(); c.arc(a[0], a[1], r, 0, Math.PI * 2); c.stroke(); c.lineWidth = 2; c.strokeStyle = 'rgba(244,241,232,.95)'; c.stroke();
    c.fillStyle = 'rgba(244,241,232,.95)'; c.beginPath(); c.arc(a[0], a[1], 2.2, 0, Math.PI * 2); c.fill(); }
  // the pockets: this ball, the next, the one after
  // (none for a pot that is not there)
  const byPk = new Map(); for (const b of [p.noShot ? null : p.A, p.B, p.C]) { if (!b || b.pocket == null) continue; if (!byPk.has(b.pocket)) byPk.set(b.pocket, []); byPk.get(b.pocket).push(b); }
  for (const [pi, bs] of byPk) coachPockets(c, S2, F, A.P.pockets[pi], bs);
  // the stroke: a cue ball with the tip where it should meet it, and the power (bottom left of the picture)
  if (p.path && p.path.stroke && F) coachStroke(c, F, p.path.stroke, p.A.n, p.path);
  else if (p.noShot && F) coachNoShot(c, F, p.noShot);
  c.restore();
}
function coachNoShot(c, F, ns) {
  const x = F.x + 20, y = F.y + F.h - 30 - 70; c.fillStyle = 'rgba(11,16,20,.6)'; c.beginPath(); c.roundRect ? c.roundRect(x, y, 300, 58, 12) : c.rect(x, y, 300, 58); c.fill();
  c.font = '600 13px system-ui, -apple-system, sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(255,184,77,.95)'; c.fillText('No clean pot on the ' + ns.n, x + 14, y + 19);
  c.font = '500 11px system-ui, -apple-system, sans-serif'; c.fillStyle = 'rgba(244,241,232,.85)'; c.fillText((ns.why === 'blocked' ? 'Every pocket is blocked' : 'Blocked or too thin') + ': a bank or a safety (not planned yet)', x + 14, y + 40);
}
function coachStroke(c, F, st, n, pa) {
  const R = 24, x = F.x + 20 + R, y = F.y + F.h - 30 - R - 40, w = 2 * R + 24 + 200, h = 2 * R + 80;
  c.fillStyle = 'rgba(11,16,20,.6)'; c.beginPath(); c.roundRect ? c.roundRect(x - R - 12, y - R - 12, w, h, 12) : c.rect(x - R - 12, y - R - 12, w, h); c.fill();
  c.fillStyle = 'rgba(244,241,232,.95)'; c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(11,16,20,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x - R, y); c.lineTo(x + R, y); c.moveTo(x, y - R); c.lineTo(x, y + R); c.stroke();
  const tx = x + (st.side || 0) * R, ty = y - st.tip * R; c.fillStyle = '#d03a2f'; c.beginPath(); c.arc(tx, ty, 4.5, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(11,16,20,.6)'; c.lineWidth = 1; c.stroke();
  const shot = pa && pa.shot || 'pot', what = { pot: 'Pot the ' + n, bank: 'Bank the ' + n, kick: 'Kick at the ' + n + ' (1 rail)', kick2: 'Kick at the ' + n + ' (2 rails)', safety: 'Safety on the ' + n }[shot] || 'The ' + n;
  const tk = st.tips != null ? st.tips : st.side > 0.05 ? 1 : st.side < -0.05 ? -1 : 0, tip = ({ follow: 'follow', stun: 'stun', draw: 'draw', center: 'center ball' }[st.kind] || st.kind) + (tk ? ', ' + Math.abs(tk) + ' tip' + (Math.abs(tk) > 1 ? 's' : '') + ' ' + (tk > 0 ? 'right' : 'left') : '');
  const pw = powerWord(st), pow = pw + (ptScale() ? ' (yours)' : '');
  const X = x + R + 10; c.textAlign = 'left'; c.textBaseline = 'middle';
  c.font = '600 13px system-ui, -apple-system, sans-serif'; c.fillStyle = 'rgba(244,241,232,.97)'; c.fillText(what, X, y - 16);
  c.font = '500 11px system-ui, -apple-system, sans-serif'; c.fillStyle = 'rgba(244,241,232,.85)'; c.fillText(tip + ' · ' + pow, X, y + 1);
  const pct = v => Math.round((v || 0) * 100) + '%';
  const odds = shot === 'safety' ? 'Hit it right ' + pct(pa.legal) + ' · leaves them ' + pct(pa.opp) : 'Make ' + pct(pa && pa.make) + (pa && pa.noShape ? '' : ' · next shot ' + pct(pa && pa.next));
  const good = shot === 'safety' ? (pa.legal || 0) * (1 - (pa.opp || 0)) : (pa && pa.make || 0) * (pa && pa.noShape ? 1 : pa && pa.next || 0);
  c.fillStyle = good >= 0.8 ? '#7ee2a0' : good >= 0.6 ? '#f1c40f' : good >= 0.5 ? '#ff8a7a' : 'rgba(244,241,232,.75)'; c.font = '600 12px system-ui, -apple-system, sans-serif'; c.fillText(odds, X, y + 18);
  if (st.jacked) { c.font = '500 11px system-ui, -apple-system, sans-serif'; c.fillStyle = 'rgba(255,184,77,.95)'; c.fillText('Cue raised: a ball behind', X, y + 34); }
  else if (pa && pa.tight && pa.tight.length) { c.font = '500 11px system-ui, -apple-system, sans-serif'; c.fillStyle = 'rgba(255,184,77,.95)'; c.fillText('Tight past the ' + pa.tight.join(' and the '), X, y + 34); }
  else if (pa && shot !== 'safety' && !pa.noShape && (pa.next || 0) < 0.6) { c.font = '500 11px system-ui, -apple-system, sans-serif'; c.fillStyle = 'rgba(255,184,77,.95)'; c.fillText('No stroke reaches the zone from here', X, y + 34); }
  else if (pa && pa.alt) { c.font = '500 11px system-ui, -apple-system, sans-serif'; c.fillStyle = 'rgba(244,241,232,.65)'; c.fillText('Also: ' + ({ pot: 'pot', bank: 'bank', kick: 'kick', kick2: '2-rail kick', safety: 'safety' }[pa.alt.kind] || pa.alt.kind) + (pa.alt.kind === 'safety' ? '' : ' ' + pct(pa.alt.make)), X, y + 34); }
  const lv = st.speed ? st.power : [1, 3, 5][PT_LEVELS.indexOf(pw)] || 3; for (let i = 0; i < 6; i++) { c.fillStyle = i < lv ? 'rgba(89,214,232,.95)' : 'rgba(244,241,232,.18)'; c.fillRect(x - R + i * 8.4, y + R + 8, 6.6, 6); }
  // the zone's colours, for reading it (owner's bands)
  const ly = y + R + 30; let lx = x - R; c.font = '500 10px system-ui, -apple-system, sans-serif';
  for (const [col, t] of [['rgba(46,204,113,.95)', '90%+'], ['rgba(140,230,170,.95)', '80'], ['rgba(241,196,15,.95)', '60'], ['rgba(231,76,60,.95)', '50']]) { c.fillStyle = col; c.fillRect(lx, ly - 4, 9, 9); c.fillStyle = 'rgba(244,241,232,.8)'; c.fillText(t, lx + 12, ly + 1); lx += 12 + c.measureText(t).width + 10; }
}
// ---------- the stroke tests (V3.11 power; V3.14 soft, medium, hard; V3.15 spin and draw/follow) ----------
// From the Menu in the Coaching test, the cue ball (and for the draw test one object ball) on the player's own table:
//  - power: the cue ball alone rolled up the table at the player's soft, medium and hard, three each; each roll's speed from
//    where it started, its first direction and how far it went, in the simulation (cushions included). Each word keeps the
//    middle of its three, so one odd roll does not move it.
//  - spin (owner, Nov 9 21:33): the cue ball from the foot spot (either end) straight at the middle diamond of the short
//    cushion with 1, 2 and 3 tips of left at soft, medium and hard; how far it turns off the cushion against no spin gives
//    the side spin the player's tips put on, in the simulation's terms (and how far it swerved on the way in).
//  - draw/follow: a straight shot at one object ball about 2 diamonds away, soft, medium and hard draw, then follow; where the
//    cue ball stopped gives the tip the player really gets (the hardest draw and follow bound the plan's tips).
// The plan then plans with the player's speeds, spin and draw (planner opts speeds, spinTip, tipRange) and says soft,
// medium or hard, and the side in tips. A move into place is not a roll: one that ends where the rolls start (the foot
// spot, or the first roll's start), one under 2 ft in the power test, one standing (the tracker's hand rule).
const PT_KEY = KEY + '.power2', ST_KEY = KEY + '.stroke', PT_LEVELS = ['soft', 'medium', 'hard'];
function ptScale() { try { const d = JSON.parse(localStorage.getItem(PT_KEY) || 'null'); return d && PT_LEVELS.every(L => d[L] > 0.2 && d[L] < 15) && d.soft < d.medium && d.medium < d.hard ? d : null; } catch (e) { return null; } }
function stStore() { try { return JSON.parse(localStorage.getItem(ST_KEY) || 'null') || {}; } catch (e) { return {}; } }
function stSave(k, v) { const d = stStore(); d[k] = v; try { localStorage.setItem(ST_KEY, JSON.stringify(d)); } catch (e) { } }
// the planner's options from the tests done so far
function coachOpts() {
  const o = {}, ps = ptScale(), st = stStore(); if (ps) o.speeds = [ps.soft, ps.medium, ps.hard];
  // (V3.16: the cushion's grip and the tip from all the spin test's rolls together; a test kept before V3.16 is fitted once)
  if (st.spin && st.spin.res && st.spin.railMu == null) { const f = spinFit(st.spin.res); if (f) { Object.assign(st.spin, f); stSave('spin', st.spin); dbg('stroke_test', { kind: 'spin', refit: f }); } }
  if (st.spin && st.spin.tip > 0.05 && st.spin.tip < 0.4) o.spinTip = st.spin.tip;
  if (st.spin && st.spin.railMu > 0.05 && st.spin.railMu < 0.8) o.railMu = st.spin.railMu;
  // (V3.17, owner Nov 10: the coaching is billiard theory one level up, not the player's own game: the draw test no longer
  // bounds the plan's draw and follow, it is kept for the review; the plan is made for the player's Fargo plus 100)
  o.level = Math.min(800, fargo() + 100);
  return o;
}
const FG_KEY = KEY + '.fargo';
function fargo() { try { const v = +localStorage.getItem(FG_KEY); return v >= 200 && v <= 800 ? v : 500; } catch (e) { return 500; } }
const levelMph = L => { const ps = ptScale(); return ps ? ps[L] : { soft: 1.6, medium: 3.2, hard: 6 }[L]; };
// a draw is hit harder than a roll at the same word (owner, Nov 10: a soft draw is a little more than a stop shot, a medium
// one a much harder hit that comes back several diamonds, a hard one nearly break speed, to the short cushion and on): the
// draw test's speeds are the player's medium roll, hard roll and half again; follow is the rolls' own
const drawMph = (d, L) => d === 'draw' ? { soft: levelMph('medium'), medium: levelMph('hard'), hard: 1.5 * levelMph('hard') }[L] : levelMph(L);
const spinFit = res => { const f = COACH.fitSpinAll((res || []).filter(q => q.turn != null).map(q => ({ k: q.k, mph: levelMph(q.L), turn: q.turn })), A.P || makeP(A.ft)); return f && f.tip > 0.05 && f.tip < 0.4 ? f : null; };
// the plan's speed in words (before V3.15 plans gave power 1-10: nearest of the player's three)
function powerWord(st) {
  if (st.speed) return st.speed;
  const mph = st.mph || COACH.POWER_MPH[Math.max(0, Math.min(9, Math.round(st.power) - 1))], d = ptScale() || { soft: 1.6, medium: 3.2, hard: 6 };
  return PT_LEVELS.reduce((b, L) => Math.abs(Math.log(mph / d[L])) < Math.abs(Math.log(mph / d[b])) ? L : b, 'soft');
}
const TESTS = {
  power: { name: 'Power test', steps: [].concat(...PT_LEVELS.map(L => [L, L, L])).map(L => ({ L })), say: s => 'roll the cue ball alone up the table, your ' + s.L.toUpperCase() },
  spin: { name: 'Spin test', steps: [].concat(...[1, 2, 3].map(k => PT_LEVELS.map(L => ({ k, L })))), say: s => 'cue ball on the foot spot, aim at the middle diamond of the short cushion: ' + s.k + ' tip' + (s.k > 1 ? 's' : '') + ' LEFT, your ' + s.L.toUpperCase() },
  draw: { name: 'Draw test', steps: [].concat(...['draw', 'follow'].map(d => PT_LEVELS.map(L => ({ d, L })))), say: s => 'a ball about 2 diamonds straight ahead, hit it full: your ' + s.L.toUpperCase() + ' ' + s.d.toUpperCase() }
};
function stArm() { if (A.tk) A.tk.S.setup = false; } // every lone roll is a shot in the test, not the cue ball put in place
function stStart(kind) { A.stest = { kind, i: 0, res: [], start: null }; stArm(); stTag(); dbg('stroke_test', { kind, start: true }); }
function stStop() { const t = A.stest; A.stest = null; $('#drillTag').hidden = true; if (t) dbg('stroke_test', { kind: t.kind, stop: true }); }
function stTag() { const t = A.stest, el = $('#drillTag'); if (!t) return; stArm(); const T = TESTS[t.kind]; el.hidden = false; el.textContent = T.name + ': ' + T.say(T.steps[t.i]) + ' · ' + (t.i + 1) + ' of ' + T.steps.length; }
const footSpots = () => [[A.P.L / 4, A.P.W / 2], [A.P.L * 3 / 4, A.P.W / 2]];
function stShot(sh, row) {
  const t = A.stest; if (!t) return; const T = TESTS[t.kind], step = T.steps[t.i], nm = T.name;
  const real = (sh.paths || []).find(q => q.key === sh.cueKey), moved = (sh.paths || []).filter(q => q.key !== sh.cueKey && Math.hypot(q.p[q.p.length - 1][1] - q.p[0][1], q.p[q.p.length - 1][2] - q.p[0][2]) > 1.5);
  const again = m => { toast(nm + ': ' + m + '. Again, please'); dbg('stroke_test', { kind: t.kind, i: t.i, skip: m }); stTag(); };
  const pts = real ? real.p.map(q => [q[1], q[2]]) : [], len = (() => { let s0 = 0; for (let i = 1; i < pts.length; i++) s0 += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return s0; })();
  // the cue ball hardly moved (an object ball put back by hand): setting up
  if (pts.length < 3 || len < 3) { dbg('stroke_test', { kind: t.kind, i: t.i, setup: true, len: r1(len) }); stTag(); return; }
  const p0 = pts[0], pe = pts[pts.length - 1], near = (a, b, d) => Math.hypot(a[0] - b[0], a[1] - b[1]) < d;
  // a move into place: it ends where the rolls start (and did not start there)
  const home = t.kind === 'spin' ? footSpots() : t.start ? [t.start] : [];
  if (home.some(h => near(pe, h, 8) && !near(p0, h, 8))) { toast(nm + ': set up, not counted'); dbg('stroke_test', { kind: t.kind, i: t.i, setup: true }); stTag(); return; }
  if (sh.scratch) return again('it went in a pocket, so it could not be measured');
  let res = null;
  if (t.kind === 'power' || t.kind === 'spin') {
    if (moved.length || row.made.length) return again('only the cue ball, please');
    if (t.kind === 'power' && len < 24) return again('too short to be a roll (under 2 ft)');
    if (t.kind === 'power') {
      let j = 1; while (j < pts.length - 1 && Math.hypot(pts[j][0] - p0[0], pts[j][1] - p0[1]) < 4) j++;
      const v = COACH.speedFor(p0, [pts[j][0] - p0[0], pts[j][1] - p0[1]], len, A.P); if (!v) return again('could not measure that one');
      res = { L: step.L, mph: r1(v / 17.6), len: Math.round(len) }; toast(nm + ': your ' + step.L + ' ' + res.mph + ' mph (' + Math.round(len / 12) + ' ft rolled)');
    } else {
      if (!footSpots().some(h => near(p0, h, 8))) return again('start from the foot spot');
      const f = COACH.fitSpin(pts, levelMph(step.L), A.P); if (!f) return again('it did not come straight back off the short cushion');
      // the swerve on the way in: how far the cue ball's way in is off straight at the middle diamond
      res = Object.assign({ k: step.k, L: step.L }, f); toast(nm + ': ' + step.k + ' tip' + (step.k > 1 ? 's' : '') + ' left, ' + step.L + ': came off ' + Math.abs(Math.round(f.turn)) + '° to the ' + ((f.rail === 'right') === (f.turn > 0) ? 'left' : 'right') + ' (' + Math.abs(Math.round(f.ain)) + '° in)');
    }
  } else {
    // the object ball: the one that moved; at a hard draw it is in the pocket before the next look and never seen moving
    // (Nov 9 22:20: both hard draws thrown out), so the ball that sat on the cue ball's line before the shot, taken as gone
    let ob = moved.length === 1 ? moved[0] : null, o0 = null, oEnd = null, oLen = 0, oIn = row.made.length > 0;
    if (moved.length > 1) return again('hit one object ball, straight');
    if (ob) { const oq = ob.p.map(q => [q[1], q[2]]); for (let i = 1; i < oq.length; i++) oLen += Math.hypot(oq[i][0] - oq[i - 1][0], oq[i][1] - oq[i - 1][1]); o0 = oq[0]; oEnd = oq[oq.length - 1]; }
    else {
      let j = 1; while (j < pts.length - 1 && Math.hypot(pts[j][0] - p0[0], pts[j][1] - p0[1]) < 2) j++;
      const d = [pts[j][0] - p0[0], pts[j][1] - p0[1]], dl = Math.hypot(d[0], d[1]) || 1, u = [d[0] / dl, d[1] / dl];
      // (the cue ball's first seen move can already be on its way back from the hit, so either way along that line: the
      // ball nearest the line, within 7 in of it)
      const cands = (sh.before || []).filter(b => b.key !== sh.cueKey).map(b => { const v = [b.x - p0[0], b.y - p0[1]], t = v[0] * u[0] + v[1] * u[1]; return { b, t: Math.abs(t), off: Math.abs(v[0] * u[1] - v[1] * u[0]) }; }).filter(q => q.t > 2 * A.P.R && q.off < 7).sort((a, b) => a.off - b.off);
      if (!cands.length) return again('hit one object ball, straight');
      o0 = [cands[0].b.x, cands[0].b.y]; oIn = true;
    }
    const f = COACH.fitDraw(p0, pe, o0, oEnd, oLen, oIn, drawMph(step.d, step.L), A.P, step.d); if (!f) return again('could not measure that one');
    res = Object.assign({ d: step.d, L: step.L }, f); toast(nm + ': your ' + step.L + ' ' + step.d + ': the cue ball ' + (f.along < 0 ? 'came back ' + Math.round(-f.along) : 'went on ' + Math.round(f.along)) + ' in');
  }
  if (!t.start) t.start = p0;
  t.res.push(res); dbg('stroke_test', Object.assign({ kind: t.kind, i: t.i }, res));
  if (++t.i < T.steps.length) return stTag();
  // done: what is kept
  const mid = xs => { const m = xs.slice().sort((a, b) => a - b); return m.length ? m[Math.floor(m.length / 2)] : null; };
  let words = '', kept = null;
  if (t.kind === 'power') {
    const d = { t: Date.now(), res: t.res }; for (const L of PT_LEVELS) d[L] = mid(t.res.filter(q => q.L === L).map(q => q.mph));
    const ok = d.soft < d.medium && d.medium < d.hard; if (ok) try { localStorage.setItem(PT_KEY, JSON.stringify(d)); } catch (e) { }
    kept = d; words = ok ? 'Your soft rolls ' + d.soft + ' mph, medium ' + d.medium + ', hard ' + d.hard + '. The plan now plans with your speeds.' : 'Your soft, medium and hard came out ' + d.soft + ', ' + d.medium + ' and ' + d.hard + ' mph: not in order, so not kept. Try it again from the Menu.';
  } else if (t.kind === 'spin') {
    // one tip in the simulation's side spin: the middle of each roll's spin over its tips (rolls that turned under 3 degrees
    // say little: left out)
    // (V3.16: the cushion's grip and one tip fitted to all the rolls together)
    const f = spinFit(t.res), tip = f ? f.tip : null;
    kept = Object.assign({ t: Date.now(), tip, res: t.res }, f || {}); if (f) stSave('spin', kept);
    words = t.res.map(q => q.k + ' tip' + (q.k > 1 ? 's' : '') + ' ' + q.L + ': ' + Math.abs(Math.round(q.turn)) + '°').join(', ') + '. ' + (f ? 'The plan now counts your tips and your cushions.' : 'Too little turn to measure your tips: not kept.');
  } else {
    // the most draw and the most follow measured (V3.16: any level, not only the hard one)
    const dr = t.res.filter(q => q.d === 'draw' && q.err < 8), fo = t.res.filter(q => q.d === 'follow' && q.err < 8);
    const draw = dr.length ? Math.min(-0.15, ...dr.map(q => q.b)) : null, follow = fo.length ? Math.max(0.15, ...fo.map(q => q.b)) : null;
    kept = { t: Date.now(), draw, follow, res: t.res }; stSave('draw', kept);
    words = t.res.map(q => q.L + ' ' + q.d + ': ' + (q.along < 0 ? Math.round(-q.along) + ' in back' : Math.round(q.along) + ' in on')).join(', ') + '. The plan now keeps to the draw and follow you have.';
  }
  dbg('stroke_test', { kind: t.kind, done: true, kept });
  A.stest = null; $('#drillTag').hidden = true;
  showCard('<div><b>' + nm + ' done</b><p>' + words + '</p></div><div class="row"><button class="btn" data-act="close">Close</button></div>');
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
  // (owner, Nov 3: no circle round the balls; the number small, on the ball itself, to the side only where balls are
  // bunched; in a drill only its two balls. A ball out of sight or about to be called in keeps a faint dashed outline.)
  if (A.drill && A.drill.st) { const st = A.drill.st, near = it => [st.O, st.C].some(p => p && Math.hypot(it.tx - p[0], it.ty - p[1]) < 8); for (let i = items.length - 1; i >= 0; i--) if (!near(items[i])) items.splice(i, 1); }
  c.lineWidth = 1; c.setLineDash([3, 3]); c.globalAlpha = 0.4;
  for (const it of items) if (it.b.state === 'hidden' || it.b.state === 'pending') { c.strokeStyle = it.col; c.beginPath(); c.arc(it.s[0], it.s[1], it.r, 0, Math.PI * 2); c.stroke(); }
  c.setLineDash([]); c.globalAlpha = 1;
  c.font = '600 10px system-ui, -apple-system, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
  const bunched = it => items.some(o => o !== it && Math.hypot(o.s[0] - it.s[0], o.s[1] - it.s[1]) < 2.6 * it.r);
  for (const it of items) if (!bunched(it)) { c.lineWidth = 2.5; c.strokeStyle = 'rgba(11,16,20,.55)'; c.strokeText(it.t, it.s[0], it.s[1] + 0.5); c.fillStyle = it.col; c.fillText(it.t, it.s[0], it.s[1] + 0.5); }
  const H = 14, placed = [], hit = (a, q) => a.x < q.x + q.w && q.x < a.x + a.w && a.y < q.y + q.h && q.y < a.y + a.h;
  const free = box => box.x >= 0 && box.y >= 0 && box.x + box.w <= F.w && box.y + box.h <= F.h && !placed.some(q => hit(box, q)) &&
    !items.some(o => { const cx = Math.max(box.x, Math.min(o.s[0], box.x + box.w)), cy = Math.max(box.y, Math.min(o.s[1], box.y + box.h)); return Math.hypot(cx - o.s[0], cy - o.s[1]) < o.r; });
  // sides: above, upper right, upper left, right, left, below; then the same further out (with a leader line)
  const DIRS = [[0, -1], [0.75, -0.75], [-0.75, -0.75], [1, 0], [-1, 0], [0, 1]];
  const at = (it, k) => { const far = k >= DIRS.length, [dx, dy] = DIRS[k % DIRS.length], w = c.measureText(it.t).width + 8, g = it.r + (far ? 2.6 * H : 2);
    const cx = it.s[0] + dx * (g + w / 2 * Math.abs(dx)), cy = it.s[1] + dy * (g + H / 2 * Math.abs(dy)); return { x: cx - w / 2, y: cy - H / 2, w, h: H, cx, cy, far }; };
  // bunched balls first, so they get first choice of the free sides
  const crowd = it => items.filter(o => o !== it && Math.hypot(o.s[0] - it.s[0], o.s[1] - it.s[1]) < 4 * it.r).length;
  for (const it of items.filter(bunched).sort((a, b) => crowd(b) - crowd(a))) {
    const last = LAB.get(it.b.key), order = [...Array(DIRS.length * 2).keys()]; if (last != null) { order.splice(order.indexOf(last), 1); order.unshift(last); }
    let box = null, k0 = 0; for (const k of order) { const q = at(it, k); if (free(q)) { box = q; k0 = k; break; } }
    if (!box) { box = at(it, 0); k0 = 0; } // nowhere free: above, as before
    LAB.set(it.b.key, k0); placed.push(box);
    if (box.far) { c.strokeStyle = it.col; c.lineWidth = 1; c.beginPath(); const a = Math.atan2(box.cy - it.s[1], box.cx - it.s[0]); c.moveTo(it.s[0] + Math.cos(a) * it.r, it.s[1] + Math.sin(a) * it.r); c.lineTo(box.cx - Math.cos(a) * Math.min(box.w / 2, H / 2), box.cy - Math.sin(a) * H / 2); c.stroke(); }
    c.fillStyle = 'rgba(11,16,20,.55)'; c.fillRect(box.x, box.y, box.w, box.h);
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
$('#pickNot').onclick = () => { const k = A.pick, b = A.tk.S.tracks.find(t => t.key === k); closePick(); if (b) { saveTap(b, 'not', b.num); const was = JSON.stringify(A.tk.S.shallow); A.tk.notBall(k); const learnt = JSON.stringify(A.tk.S.shallow) !== was; if (learnt) shallowSave(); dbg('tap_not', { key: k, shallow: learnt ? A.tk.S.shallow : undefined }); toast(learnt ? 'Removed: a ball lying in the pocket. Remembered for this pocket' : 'Removed: not a ball'); } };
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
  if (b.dataset.drill) { drillStart(b.dataset.drill); return; }
  if (b.dataset.ft) { A.ft = +b.dataset.ft; save(); A.P = makeP(A.ft); A.tk = makeTracker(A.P, Object.assign(TK_OPTS(A.mode), { stance: stanceAt, shallow: shallowGet() })); A.nShots = 0; dbg('ft', { ft: A.ft }); refind('Table size ' + A.ft + ' ft: looking again…'); return; }
  const a = b.dataset.act;
  if (a === 'accept') acceptTable(); else if (a === 'retry') refind(); else if (a === 'manual') beginManual();
  else if (a === 'undo') { if (A.man && A.man.length) A.man.pop(); if (A.man) manualCard(); }
  else if (a === 'home') goHome(); else if (a === 'close') hideCard(); else if (a === 'refind') { hideCard(); refind(); }
  else if (a === 'dbg') saveDebug(b); else if (a === 'useman') useManual();
  else if (a === 'drills') drillMenu(); else if (a === 'drill_stop') drillStop();
  else if (a && a.startsWith('st_')) { hideCard(); const k = a.slice(3); if (A.stest) stStop(); else stStart(k); }
  // (Check my stroke taken out, V3.8.9, owner Nov 8: the stroke is read on every shot anyway, shown in the review; the
  // full-rate close-up clips it added were for checking the measure, done on Nov 2, and its message after each shot asked
  // the player to look at the phone. A.strokeCheck stays false.)
});
$('#menuBtn').onclick = () => showCard('<div><b>Menu</b><p>' + (A.tk ? A.tk.S.shots.length + ' shots so far.' : '') + '</p></div><div class="row">' + (A.mode === 'coach' ? (A.stest ? '<button class="btn" data-act="st_stop">Stop the ' + TESTS[A.stest.kind].name.toLowerCase() + '</button>' : ['power', 'spin', 'draw'].map(k => '<button class="btn" data-act="st_' + k + '">' + TESTS[k].name + '</button>').join('')) : '') + '<button class="btn" data-act="drills">' + (A.drill ? 'Drill: ' + DRILL.byId(A.drill.id).name : 'Drills') + '</button><button class="btn" data-act="refind">Find the table again</button><button class="btn" data-act="dbg">Save debug</button><button class="btn" data-act="home">Home</button><button class="btn" data-act="close">Close</button></div>');
// (pressed again after the rack was done by itself, or twice: no shot since, so it is not another rack)
$('#rackBtn').onclick = () => { if (!A.tk) return; const dup = A.tk.S.setup && A.tk.S.shots.length === A.tk.S.rackAt; A.tk.newRack(); flushShots(); PATH.clear(); rackOpen(); dbg('new_rack', dup ? { dup: true } : {}); toast('New rack. Names come once the break spreads the balls.'); };
let toastT = 0;
function toast(t, ms) { dbg('toast', { s: t }); const e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { e.hidden = true; }, ms || 3500); }

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
window.__v3 = { A, DBG, DET, start, acceptTable, look, packDebug, goHome, WATCH, STORE, STK }; // for the browser tests
