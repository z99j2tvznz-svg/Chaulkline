// Session review (V3.2, owner Nov 2: "bigger chunks", something to see in play): after a session, and for the last one from
// the home screen, every shot as a top-down drawing of the table with each ball's path, its before and after pictures
// and its clip; the session and each rack in numbers; and every session kept on the phone so progress shows over time.
// The numbers (stats, racks) are plain functions, tested in tests/review.test.js; the screens use the app's globals.
const REVIEW = (() => {
  const HIST = 'chalkline-v3-history';
  // balls in on a shot: object balls (an unknown ball counts; the cue ball is a scratch, not a ball in)
  const objIn = s => s.made.filter(m => m.num !== 0 && !(m.num != null && m.num === s.cue)).length;
  const scored = s => objIn(s) > 0 && !s.scratch;
  // a shot that was not one (V3.7: a ball moved with the cue, or the player said so) stays in the list but counts nowhere
  const real = shots => shots.filter(s => !s.notShot);
  // runs: shots in a row in one rack that put a ball in without a scratch (the break counts when it does)
  function runs(shots) { let best = 0, cur = 0, rack = null; for (const s of shots) { if (s.rack !== rack) { cur = 0; rack = s.rack; } cur = scored(s) ? cur + 1 : 0; best = Math.max(best, cur); } return best; }
  function stats(shots) {
    shots = real(shots); const play = shots.filter(s => !s.break);
    return { shots: shots.length, ballsIn: shots.reduce((a, s) => a + objIn(s), 0), potted: play.filter(s => objIn(s) > 0).length, tries: play.length,
      potRate: play.length ? play.filter(s => objIn(s) > 0).length / play.length : null, scratches: shots.filter(s => s.scratch).length, bestRun: runs(shots),
      misses: play.filter(s => objIn(s) === 0 && !s.scratch).length };
  }
  function racks(shots) {
    const by = new Map(); for (const s of real(shots)) { const r = s.rack || 1; if (!by.has(r)) by.set(r, []); by.get(r).push(s); }
    return [...by.entries()].map(([rack, ss]) => Object.assign({ rack }, stats(ss)));
  }
  const pct = x => x == null ? '–' : Math.round(100 * x) + '%';
  // ---- the table drawing (table inches; y flipped so the near rail is at the bottom, as the camera sees it from the side)
  // (balls drawn a fifth larger than life, so their numbers read on a phone)
  // tries: several shots set up the same way, drawn on one table (each try's cue ball end marked with its number; a ball's
  // path solid when it went in, dashed when it did not)
  function diagram(s, ft, tries) {
    const T = tries || [s];
    const P = makeP(ft || 7), L = P.L, W = P.W, R = P.R * 1.2, Y = y => (W - y).toFixed(2), X = x => x.toFixed(2), col = n => n == null ? '#9aa7ae' : BALLCOL[n % 10] || '#9aa7ae';
    const o = [`<svg viewBox="-5 -5 ${L + 10} ${W + 10}" class="tbl" role="img" aria-label="${tries ? 'Shots ' + T.map(x => x.n).join(', ') : 'Shot ' + s.n} from above">`,
      `<rect x="-5" y="-5" width="${L + 10}" height="${W + 10}" rx="3" fill="#3b2a1d"/><rect x="0" y="0" width="${L}" height="${W}" fill="#1c6fa8"/>`];
    for (let i = 1; i < 8; i++) if (i !== 4) o.push(`<circle cx="${X(L * i / 8)}" cy="-2.5" r=".45" fill="#e9e2d0"/><circle cx="${X(L * i / 8)}" cy="${W + 2.5}" r=".45" fill="#e9e2d0"/>`);
    for (let i = 1; i < 4; i++) o.push(`<circle cx="-2.5" cy="${X(W * i / 4)}" r=".45" fill="#e9e2d0"/><circle cx="${L + 2.5}" cy="${X(W * i / 4)}" r=".45" fill="#e9e2d0"/>`);
    const inPk = new Set([].concat(...T.map(x => x.made)).map(m => m.pocket).filter(p => p != null));
    P.pockets.forEach((p, i) => o.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r}" fill="#05080a" ${inPk.has(i) ? 'stroke="#ffb84d" stroke-width=".6"' : ''}/>`));
    const madeN = new Set(s.made.map(m => m.num)), moved = new Set((s.paths || []).map(p => p.num));
    const ball = (num, x, y, faint) => `<g opacity="${faint ? .35 : 1}"><circle cx="${X(x)}" cy="${Y(y)}" r="${R}" fill="${col(num)}" stroke="${num === 9 ? '#f4f1e8' : '#000'}" stroke-width="${num === 9 ? .4 : .15}"/>` +
      (num ? `<circle cx="${X(x)}" cy="${Y(y)}" r=".8" fill="#f4f1e8"/><text x="${X(x)}" y="${(W - y + .45).toFixed(2)}" font-size="1.25" font-weight="700" text-anchor="middle" fill="#111">${num}</text>` : '') + '</g>';
    // the aim (one shot): from the cue ball to where it has to meet the object ball, and on to the pocket
    const am = !tries && aim(s, ft);
    if (am) o.push(`<line x1="${X(am.C[0])}" y1="${Y(am.C[1])}" x2="${X(am.G[0])}" y2="${Y(am.G[1])}" stroke="#ffffff" stroke-width=".25" stroke-dasharray=".6 .6" opacity=".7"/><circle cx="${X(am.G[0])}" cy="${Y(am.G[1])}" r="${P.R}" fill="none" stroke="#ffffff" stroke-width=".2" stroke-dasharray=".5 .5" opacity=".8"/><line x1="${X(am.O[0])}" y1="${Y(am.O[1])}" x2="${X(am.Pk[0])}" y2="${Y(am.Pk[1])}" stroke="#ffb84d" stroke-width=".25" stroke-dasharray="1 .6" opacity=".8"/>`);
    // the balls that did not move, where they rested
    for (const b of s.before || []) if (!moved.has(b[0]) && !madeN.has(b[0])) o.push(ball(b[0], b[1], b[2]));
    // each moving ball: where it started (faint), its path, where it stopped or the pocket it went to
    T.forEach((sh, k) => { for (const p of sh.paths || []) {
      const pts = p.p.slice(), m = sh.made.find(q => q.num === p.num);
      if (m && m.pocket != null) { const pk = P.pockets[m.pocket]; pts.push([pk.x, pk.y]); }
      if (pts.length < 2 || (tries && p.num == null)) continue; // (on the tries' drawing an unnamed ball's path is only noise)
      if (k === 0) o.push(ball(p.num, pts[0][0], pts[0][1], true));
      const dash = p.num == null || (tries && p.num !== 0 && !m) ? ' stroke-dasharray="1 1"' : '';
      o.push(`<polyline points="${pts.map(q => X(q[0]) + ',' + Y(q[1])).join(' ')}" fill="none" stroke="${p.num === 0 ? '#ffffff' : col(p.num)}" stroke-width="${p.num === 0 ? .55 : .45}" stroke-linejoin="round" stroke-linecap="round" opacity="${tries ? (p.num === 0 ? .6 : .9) : .95}"${dash}/>`);
      const e = pts[pts.length - 1];
      if (!tries) { if (!m) o.push(ball(p.num, e[0], e[1])); }
      else if (p.num === 0 && !m) o.push(`<circle cx="${X(e[0])}" cy="${Y(e[1])}" r="${R * .8}" fill="#f4f1e8" opacity=".85"/><text x="${X(e[0])}" y="${(W - e[1] + .45).toFixed(2)}" font-size="1.25" font-weight="700" text-anchor="middle" fill="#111">${k + 1}</text>`);
    } });
    o.push('</svg>'); return o.join('');
  }
  // ---- what a session keeps for its review (on each shot, from the tracker's shot)
  const r1 = v => Math.round(v * 10) / 10;
  function shotDetail(sh) {
    return { before: (sh.before || []).filter(b => b.state !== 'moving' || b.num === 0).map(b => [b.num, r1(b.rx != null ? b.rx : b.x), r1(b.ry != null ? b.ry : b.y)]),
      paths: (sh.paths || []).map(p => ({ num: p.num, p: thin(p.p.map(q => [r1(q[1]), r1(q[2])])) })) };
  }
  // drop points closer than half an inch to the last kept one (a path stays its shape, a resting ball adds nothing)
  function thin(pts) { const o = []; for (const q of pts) { const e = o[o.length - 1]; if (!e || Math.hypot(q[0] - e[0], q[1] - e[1]) >= 0.5) o.push(q); } const z = pts[pts.length - 1]; if (z && o[o.length - 1] !== z) o.push(z); return o; }
  // ---- every session's numbers, kept on the phone
  // the drill tries whose shot still counts
  const drillTries = sess => { const no = new Set((sess.shots || []).filter(s => s.notShot).map(s => s.n)); return (sess.drillTries || []).filter(t => !no.has(t.n)); };
  function history() { try { return JSON.parse(localStorage.getItem(HIST) || '[]'); } catch (e) { return []; } }
  function remember(sess, mins) {
    if (!sess || !sess.shots || !sess.shots.length) return;
    const h = history().filter(x => x.t0 !== sess.t0), st = stats(sess.shots), bs = byShot(sess.shots, sess.ft);
    h.push({ t0: sess.t0, ft: sess.ft, mode: sess.mode || 'play', mins, racks: racks(sess.shots).length, shots: st.shots, ballsIn: st.ballsIn, potted: st.potted, tries: st.tries, scratches: st.scratches, bestRun: st.bestRun, cuts: bs.cuts, drills: typeof DRILL !== 'undefined' ? DRILL.summary(drillTries(sess)).map(d => ({ id: d.id, name: d.name, tries: d.tries, made: d.made, best: d.best })) : [] });
    try { localStorage.setItem(HIST, JSON.stringify(h.slice(-300))); } catch (e) { }
  }
  // shots set up again: a shot whose cue ball starts within R in of the one before's, with every other ball within R in of
  // one of its balls (and as many): the same shot tried again (Nov 1, 20:06: shots 2 to 4). Names play no part (they can be
  // wrong as the cue strikes); balls rolling as the shot started are left out.
  function repeats(shots, R = 4) {
    const cueOf = s => (s.before || []).find(b => b[0] === 0), objs = s => (s.before || []).filter(b => b[0] !== 0), d = (p, q) => Math.hypot(p[1] - q[1], p[2] - q[2]);
    const same = (a, b) => { const ca = cueOf(a), cb = cueOf(b); if (!ca || !cb || d(ca, cb) > R) return false; const oa = objs(a), ob = objs(b);
      return oa.length > 0 && oa.length === ob.length && oa.every(p => ob.some(q => d(p, q) <= R)) && ob.every(p => oa.some(q => d(p, q) <= R)); };
    const out = []; let cur = null;
    for (const s of real(shots)) { if (cur && same(cur[0], s)) cur.push(s); else { if (cur && cur.length > 1) out.push(cur); cur = [s]; } }
    if (cur && cur.length > 1) out.push(cur); return out;
  }
  // ---- the shot itself (V3.5, owner Nov 2: in practice balls go to one pocket, then another; how the cuts and the pockets
  // go matters more than the same spot again): which ball was played, into which pocket, how thin a cut, how long.
  // From where the balls rested and the paths: the ball hit first (or the one that went in); the pocket it went into, or,
  // missed, the one it was sent toward (its own path, or the line of centres where the cue ball, going the way it set
  // off, meets it); the cut between the aim at the contact point and the line to the pocket. A cut over 75 degrees, or no
  // pocket within 20 degrees of the ball's way, is left unread (a bank, a kick, or the tracking was not good enough).
  const hyp = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), angD = (a, b) => Math.abs(((a - b) * 180 / Math.PI + 540) % 360 - 180);
  function aim(s, ft) {
    const P = makeP(ft || 7), R = P.R, before = s.before || [], paths = s.paths || [], cueP = paths.find(p => p.num === 0), cue = before.find(b => b[0] === 0);
    if (!cue || !cueP) return null;
    const C = [cue[1], cue[2]], c1 = cueP.p.find(q => hyp(q, C) >= 3); if (!c1) return null;
    const d0 = Math.atan2(c1[1] - C[1], c1[0] - C[0]), ux = Math.cos(d0), uy = Math.sin(d0), cand = [];
    const add = num => { if (num != null && num !== 0 && !cand.includes(num) && before.some(b => b[0] === num)) cand.push(num); };
    add(s.first); for (const m of s.made) add(m.num); for (const p of paths) add(p.num);
    for (const num of cand) {
      const b = before.find(x => x[0] === num), O = [b[1], b[2]], path = paths.find(p => p.num === num), m = s.made.find(q => q.num === num);
      // (a cue ball hit hard has turned off the object ball by the first look, so the way it set off is only roughly
      // toward the contact: a pass up to 3 in wider is let through, the contact then taken as the closest point)
      const fx = C[0] - O[0], fy = C[1] - O[1], bq = fx * ux + fy * uy, disc = bq * bq - (fx * fx + fy * fy - 4 * R * R), tc = -bq, miss = Math.sqrt(Math.max(0, fx * fx + fy * fy - bq * bq));
      let Cc = null; if (tc > 0 && disc >= 0) { const t = -bq - Math.sqrt(disc); Cc = [C[0] + t * ux, C[1] + t * uy]; } else if (tc > 0 && miss <= 2 * R + 3) Cc = [C[0] + tc * ux, C[1] + tc * uy];
      const far = path && path.p.find(q => hyp(q, O) >= 3), dir = far ? Math.atan2(far[1] - O[1], far[0] - O[0]) : Cc ? Math.atan2(O[1] - Cc[1], O[0] - Cc[0]) : null;
      // only a ball that went in, and where it went (owner, Nov 2: a miss may have been a thin cut, a bank, anything;
      // the open pocket is not what was being practised: a drill says it)
      const pk = m && m.pocket != null ? m.pocket : null;
      if (pk == null) continue;
      const Pk = [P.pockets[pk].x, P.pockets[pk].y], L = hyp(Pk, O), u = [(Pk[0] - O[0]) / L, (Pk[1] - O[1]) / L], G = [O[0] - 2 * R * u[0], O[1] - 2 * R * u[1]];
      const cut = angD(Math.atan2(u[1], u[0]), Math.atan2(G[1] - C[1], G[0] - C[0])); if (cut >= 90) continue;
      return { obj: num, pocket: pk, made: !!m && !s.scratch, cut: Math.round(cut), toObj: Math.round(hyp(C, O)), toPocket: Math.round(L), C, O, G, Pk };
    }
    return null;
  }
  const CUTS = [[0, 10, 'Straight in (under 10°)'], [10, 25, 'Small cut (10 to 25°)'], [25, 40, 'Medium cut (25 to 40°)'], [40, 60, 'Thin cut (40 to 60°)'], [60, 90, 'Very thin (60° and more)']];
  const LENS = [[0, 24, 'Short (under 2 ft to the pocket)'], [24, 48, 'Middle (2 to 4 ft)'], [48, 999, 'Long (over 4 ft)']];
  // the session's shots read, by pocket, by cut and by length: [label, made, tries] rows
  function byShot(shots, ft) {
    shots = real(shots); const P = makeP(ft || 7), rd = shots.filter(s => !s.break).map(s => aim(s, ft)).filter(a => a), row = (l, xs) => [l, xs.filter(a => a.made).length, xs.length];
    return { read: rd.length, of: shots.filter(s => !s.break).length,
      cuts: CUTS.map(([a, b, l]) => row(l, rd.filter(x => x.cut >= a && x.cut < b))).filter(r => r[2]),
      lens: LENS.map(([a, b, l]) => row(l, rd.filter(x => x.toPocket >= a && x.toPocket < b))).filter(r => r[2]) };
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
    const ss = real(shots).map(s => s.stroke).filter(st => st && st.side), avg = k => { const v = ss.map(x => x[k]).filter(x => x != null); return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null; };
    return { n: ss.length, strokes: avg('strokes'), back: avg('back'), pause: avg('pause'), follow: avg('follow') };
  }
  return { objIn, stats, racks, runs, diagram, shotDetail, thin, history, remember, pct, strokeWords, strokeAvg, repeats, scored, aim, byShot, real, drillTries };
})();

// ---------- the review screens ----------
const RV = { sess: null, i: 0, urls: [], play: null, live: false };
function dateWords(t) { const d = new Date(t); return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }); }
function renderReview(sess, live) {
  RV.sess = sess; RV.live = live; const sh = sess.shots || [], st = REVIEW.stats(sh), rk = REVIEW.racks(sh);
  const prac = sess.mode === 'practice'; RV.reps = REVIEW.repeats(sh);
  $('#sumTitle').textContent = prac ? (live ? 'Practice over' : 'Last practice') : live ? 'Session over' : 'Last session';
  $('#sumSub').textContent = (live ? '' : dateWords(sess.t0) + ' · ') + (sess.mins ? sess.mins + ' min · ' : '') + (sess.ft || 7) + ' ft table' + (prac ? ' · practice' : ' · ' + rk.length + ' rack' + (rk.length !== 1 ? 's' : '')) + (sess.version ? ' · ' + sess.version : '');
  // (in practice a run means little: the tries of a shot set up again instead)
  $('#sumStats').innerHTML = [[st.shots, 'shots'], [st.ballsIn, 'balls in'], [REVIEW.pct(st.potRate), 'shots that made a ball'], prac ? [RV.reps.reduce((a, g) => a + g.length, 0), 'tries of a shot set up again'] : [st.bestRun, 'best run'], [st.misses, 'misses'], [st.scratches, 'scratches']]
    .map(([n, l]) => '<div><b>' + n + '</b><span>' + l + '</span></div>').join('');
  $('#sumRacks').innerHTML = rk.map(r => '<div class="rrow"><b>Rack ' + r.rack + '</b><span>' + r.shots + ' shot' + (r.shots !== 1 ? 's' : '') + ' · ' + r.ballsIn + ' in · ' + r.misses + ' missed' + (r.scratches ? ' · ' + r.scratches + ' scratch' + (r.scratches > 1 ? 'es' : '') : '') + (r.bestRun > 1 ? ' · run of ' + r.bestRun : '') + '</span></div>').join('');
  $('#sumRackCard').hidden = prac || rk.length < 2;
  const sa = REVIEW.strokeAvg(sh), f1 = v => v == null ? '–' : (Math.round(v * 10) / 10).toString();
  $('#sumStrokeCard').hidden = !sa.n;
  if (sa.n) $('#sumStroke').innerHTML = '<div class="stats">' + [[f1(sa.strokes), 'practice strokes'], [sa.back == null ? '–' : Math.round(sa.back) + '″', 'backswing'], [sa.pause == null ? '–' : sa.pause.toFixed(1) + ' s', 'pause'], [sa.follow == null ? '–' : Math.round(sa.follow) + '″', 'follow-through']].map(([n, l]) => '<div><b>' + n + '</b><span>' + l + '</span></div>').join('') + '</div><div class="lbl" style="margin-top:6px">Average of ' + sa.n + ' shot' + (sa.n !== 1 ? 's' : '') + ' where the cue was seen from the side.</div>';
  // the balls made, by cut and length (what went in, and where: a miss says nothing of what was meant)
  const bs = REVIEW.byShot(sh, sess.ft), mx = Math.max(1, ...bs.cuts.concat(bs.lens).map(r => r[1]));
  const rows = rr => rr.map(([l, mk]) => '<div class="brow"><span>' + l + '</span><b>' + mk + '</b><i><u style="width:' + Math.round(100 * mk / mx) + '%"></u></i></div>').join('');
  $('#sumShotsCard').hidden = bs.read < 3;
  if (bs.read >= 3) $('#sumShots').innerHTML = '<h3>By cut</h3>' + rows(bs.cuts) + '<h3>By length to the pocket</h3>' + rows(bs.lens) + '<div class="lbl" style="margin-top:6px">' + bs.read + ' balls made, read from where the balls were. For your make rate on a kind of shot, use a drill (Menu → Drills): it knows what each shot is for.</div>';
  // the drills: tries and makes at each level, and the level reached
  const ds = typeof DRILL !== 'undefined' ? DRILL.summary(REVIEW.drillTries(sess)) : [];
  $('#sumDrillCard').hidden = !ds.length;
  if (ds.length) $('#sumDrills').innerHTML = ds.map(d => '<h3>' + d.name + ' · made ' + d.made + ' of ' + d.tries + (d.best >= 0 ? ' · reached ' + DRILL.byId(d.id).word(DRILL.byId(d.id).levels[d.best]) : '') + '</h3>' +
    d.levels.map(([l, mk, n]) => '<div class="brow"><span>' + l + '</span><b>' + mk + ' of ' + n + '</b><i><u style="width:' + Math.round(100 * mk / n) + '%"></u></i></div>').join('')).join('');
  // the same shot set up again: one line per set of tries, opening them on one drawing
  $('#sumRepeatCard').hidden = !RV.reps.length;
  $('#sumRepeats').innerHTML = RV.reps.map((g, i) => { const mk = g.filter(REVIEW.scored).length; return '<button class="srow sbtn" data-g="' + i + '"><b>' + g[0].n + '–' + g[g.length - 1].n + '</b><span>' + g.length + ' tries · ' + (mk ? 'made ' + mk + ' (' + g.map((x, k) => REVIEW.scored(x) ? k + 1 : null).filter(x => x).map(k => k + (k === 1 ? 'st' : k === 2 ? 'nd' : k === 3 ? 'rd' : 'th')).join(', ') + ')' : 'not made') + '</span><i>›</i></button>'; }).join('');
  for (const b of $('#sumRepeats').querySelectorAll('.sbtn')) b.onclick = () => openGroup(+b.dataset.g);
  $('#sumList').innerHTML = sh.length ? sh.map((s, i) => '<button class="srow sbtn' + (s.notShot ? ' nots' : '') + '" data-i="' + i + '"><b>' + s.n + '</b><span>' + shotWords(s) + '</span><i>›</i></button>').join('') : '<div class="lbl">No shots.</div>';
  for (const b of $('#sumList').querySelectorAll('.sbtn')) b.onclick = () => openShot(+b.dataset.i);
  $('#sumDbg').hidden = !live; $('#sumAgain').hidden = !live;
}
// a shot marked as not one, or counted again: kept with the session, and the session's line in the history redone
function setNotShot(sess, s, why) {
  if (why) s.notShot = why; else delete s.notShot;
  if (typeof dbg === 'function') dbg('not_shot_mark', { n: s.n, why: why || null });
  if (sess.mins) REVIEW.remember(sess, sess.mins);
  if (typeof A !== 'undefined' && A.lastSess === sess) save();
  renderHistory();
}
function picUrl(data) { const u = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: 'image/jpeg' })); RV.urls.push(u); return u; }
function dropUrls() { clearTimeout(RV.play); RV.play = null; for (const u of RV.urls) URL.revokeObjectURL(u); RV.urls = []; }
async function openShot(i) {
  const sh = RV.sess.shots; if (i < 0 || i >= sh.length) return; RV.i = i; dropUrls(); const s = sh[i];
  $('#shotView').hidden = false;
  $('#svTitle').textContent = 'Shot ' + s.n + (s.rack ? ' · rack ' + s.rack : '');
  const am = REVIEW.aim(s, RV.sess.ft), ftIn = v => v < 12 ? v + ' in' : (Math.round(v / 6) / 2) + ' ft';
  const dw = s.drill && typeof DRILL !== 'undefined' ? ' · drill: ' + DRILL.byId(s.drill.id).name + ', ' + DRILL.byId(s.drill.id).word(s.drill.value) + (s.drill.made ? ', made' : ', missed') : '';
  $('#svWords').textContent = shotWords(s) + dw + (!s.drill && am ? ' · ' + (am.cut < 3 ? 'straight in' : 'a ' + am.cut + '° cut') + ' to the ' + makeP(RV.sess.ft || 7).pocketNames[am.pocket] + ', ' + ftIn(am.toPocket) + ' from the pocket' : ''); const sw = REVIEW.strokeWords(s.stroke); $('#svStroke').textContent = sw || ''; $('#svStroke').hidden = !sw;
  // not a shot / count it: the player has the last word (V3.7)
  const nb = $('#svNot'); nb.hidden = false; nb.textContent = s.notShot ? 'Count it as a shot' : 'Not a shot';
  nb.onclick = () => { setNotShot(RV.sess, s, s.notShot ? null : 'you'); renderReview(RV.sess, RV.live); openShot(i); };
  $('#svTable').innerHTML = s.paths || s.before ? REVIEW.diagram(s, RV.sess.ft) : '<div class="lbl">No drawing for this shot (sessions before V3.2 kept none).</div>';
  $('#svPrev').disabled = i === 0; $('#svNext').disabled = i === sh.length - 1; $('#svPrev').onclick = () => openShot(RV.i - 1); $('#svNext').onclick = () => openShot(RV.i + 1);
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
// a set of tries of the same shot: all on one drawing, then each try in a line (tap one to see it on its own)
function openGroup(gi) {
  const g = RV.reps[gi]; if (!g) return; dropUrls(); RV.i = -1; $('#shotView').hidden = false;
  const mk = g.filter(REVIEW.scored).length;
  $('#svTitle').textContent = 'The same shot, ' + g.length + ' tries';
  $('#svWords').textContent = 'Shots ' + g.map(x => x.n).join(', ') + ' · ' + (mk ? 'made ' + mk + ' of ' + g.length : 'not made yet') + '. Each try\'s cue ball ends at its number; a ball\'s path is solid where it went in, dashed where it did not.';
  $('#svStroke').hidden = true; $('#svNot').hidden = true; $('#svSeg').innerHTML = '';
  $('#svTable').innerHTML = REVIEW.diagram(g[0], RV.sess.ft, g);
  $('#svMedia').innerHTML = g.map((x, k) => { const sw = REVIEW.strokeWords(x.stroke); return '<button class="srow sbtn" data-i="' + RV.sess.shots.indexOf(x) + '"><b>' + (k + 1) + '</b><span>' + (REVIEW.scored(x) ? 'Made · ' : 'Missed · ') + shotWords(x) + (sw && x.stroke.side ? '<br><span class="lbl">' + sw.replace(/^Stroke: /, '') + '</span>' : '') + '</span><i>›</i></button>'; }).join('');
  for (const b of $('#svMedia').querySelectorAll('.sbtn')) b.onclick = () => openShot(+b.dataset.i);
  $('#svPrev').disabled = gi === 0; $('#svNext').disabled = gi === RV.reps.length - 1;
  $('#svPrev').onclick = () => openGroup(gi - 1); $('#svNext').onclick = () => openGroup(gi + 1);
}
function closeShot() { dropUrls(); $('#shotView').hidden = true; }
$('#svPrev').onclick = () => openShot(RV.i - 1); $('#svNext').onclick = () => openShot(RV.i + 1); $('#svClose').onclick = () => closeShot();
// home: every session's numbers, newest first, with the share of shots that made a ball as bars
function renderHistory() {
  const h = REVIEW.history().slice().reverse(), card = $('#histCard'); card.hidden = !h.length; if (!h.length) return;
  const last = h.slice(0, 12).reverse(), bw = 100 / Math.max(6, last.length);
  $('#histChart').innerHTML = '<svg viewBox="0 0 100 34" preserveAspectRatio="none" class="hbars" aria-hidden="true">' + last.map((x, i) => { const r = x.tries ? x.potted / x.tries : 0, hh = Math.max(1, 30 * r); return '<rect x="' + (i * bw + bw * .15).toFixed(2) + '" y="' + (32 - hh).toFixed(2) + '" width="' + (bw * .7).toFixed(2) + '" height="' + hh.toFixed(2) + '" rx="1" fill="var(--accent)" opacity="' + (i === last.length - 1 ? 1 : .55) + '"/>'; }).join('') + '</svg>';
  // every session's cuts added up: which cuts go in, over time
  // every session's drills added up: tries, makes, the best level reached
  const tot = {}; for (const x of h) for (const d of x.drills || []) { const o = tot[d.id] = tot[d.id] || { name: d.name, tries: 0, made: 0, best: -1 }; o.tries += d.tries; o.made += d.made; o.best = Math.max(o.best, d.best); }
  const tl = Object.keys(tot); $('#histCuts').hidden = !tl.length;
  if (tl.length) $('#histCuts').innerHTML = '<h3>Your drills, all sessions</h3>' + tl.map(k => { const o = tot[k], D = typeof DRILL !== 'undefined' && DRILL.byId(k); return '<div class="brow"><span>' + o.name + (D && o.best >= 0 ? ' · best ' + D.word(D.levels[o.best]) : '') + '</span><b>' + o.made + ' of ' + o.tries + '</b><i><u style="width:' + Math.round(100 * o.made / o.tries) + '%"></u></i></div>'; }).join('');
  $('#histList').innerHTML = h.slice(0, 8).map(x => '<div class="rrow"><b>' + dateWords(x.t0) + (x.mode === 'practice' ? ' · practice' : '') + '</b><span>' + x.shots + ' shots · ' + x.ballsIn + ' in · ' + REVIEW.pct(x.tries ? x.potted / x.tries : null) + ' made a ball · best run ' + x.bestRun + '</span></div>').join('');
}
renderHistory();
