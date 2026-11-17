// Billiard University Exam I (Fundamentals), laid out and scored by its own rules (V3.22, owner Nov 16: "add in all the
// BU exam 1s and score them as if they should be scored"). From the official Exam I document (BilliardUniversity.org,
// BU_Exam-I_Fundamentals.pdf): eight drills, 100 points.
//  F1-F4 progressive: the cue ball starts at position 4 of 7; a success moves it one back (harder), a miss one forward;
//    a success at 7 stays there and earns a bonus point; 10 shots (stop early once 10 points are certain); score = the
//    position after the last shot plus the bonus, 10 at most. F5 the same with the target moving instead (10 shots).
//  F6 ten set shots, F7 ten rail target balls two tries each, F8 five targets four tries each: a point each.
// Positions are in diamonds as in the diagrams (x 0-8 from the left end, y 0-4 from the near rail, as the player sees the
// table: view() turns them into table inches), with the few lengths the document gives in inches (the one-ball gaps, the
// 8.5x11 in paper targets) kept in inches, so the drills scale to a 7 ft table the way the document allows.
const BU = (() => {
  const DRILLS = [
    { id: 'F1', name: 'Cut shot', kind: 'prog', shots: 10, early: true, about: 'Cut the ball a ball off the end rail into the near right corner; the cue ball moves back a diamond with each make. Scratches are allowed.' },
    { id: 'F2', name: 'Stop shot', kind: 'prog', shots: 10, early: true, about: 'Straight down the far rail into the far right corner; the cue ball must stop overlapping the ghost ball. Each ball goes on the faint line through its X, anywhere from the rail out to a diamond: line it up straight.' },
    { id: 'F3', name: 'Follow shot', kind: 'prog', shots: 10, early: true, about: 'Cue ball and object ball a diamond apart down the far rail; follow into the target by the far right corner, no scratch. Each ball anywhere on the faint line through its X.' },
    { id: 'F4', name: 'Draw shot', kind: 'prog', shots: 10, early: true, about: 'Down the far rail into the far right corner; draw the cue ball back into the 2-by-1-diamond box beside the far side pocket. Each ball anywhere on the faint line through its X.' },
    { id: 'F5', name: 'Stun shot', kind: 'prog', shots: 10, early: false, about: 'Cue ball in hand; the ball a ball short of the table\'s middle into the near side pocket; stun the cue ball into the target, which moves along the middle (positions 5 to 7 off the end rail).' },
    { id: 'F6', name: 'Ball pocketing', kind: 'list', n: 10, about: 'Ten set shots, five from each of two cue ball spots, one try each, no scratch.' },
    { id: 'F7', name: 'Wagon wheel', kind: 'list', n: 20, about: 'Cue ball in hand; pot the ball into the far side pocket and send the cue ball into each of ten rail balls in turn, two tries each.' },
    { id: 'F8', name: 'Grid target', kind: 'list', n: 20, about: 'Pot the ball into the far left corner and land the cue ball in each of five paper targets, four tries each, any route.' }
  ];
  const byId = id => DRILLS.find(d => d.id === id);
  const MAX = 100, PAPER = [11, 8.5]; // (the paper target: 8.5 x 11 in with the middle cut out)
  // a progressive drill's results (true/false in order) -> where it stands: the position for the next shot, the bonus so
  // far, done, and the score
  function prog(results, d) {
    let pos = 4, bonus = 0, k = 0;
    for (const r of results) { if (r) { if (pos === 7) bonus++; else pos++; } else pos = Math.max(1, pos - 1); k++; }
    const left = d.shots - k, done = left <= 0 || (d.early && Math.max(1, pos - left) + bonus >= 10);
    return { pos, bonus, shot: k, left, done, score: Math.min(10, pos + bonus) };
  }
  function state(id, results) {
    const d = byId(id); results = results || [];
    if (d.kind === 'prog') return Object.assign({ id, kind: 'prog' }, prog(results, d));
    const k = results.length, made = results.filter(Boolean).length;
    return { id, kind: 'list', shot: k, left: d.n - k, done: k >= d.n, score: made, made };
  }
  // the exam's total and the Exam II level it places into (BU: 0-49 Bachelors, 50-69 Masters, 70-100 Doctorate)
  function total(scores) { const t = DRILLS.reduce((a, d) => a + (scores[d.id] || 0), 0); return { total: t, place: t >= 70 ? 'Doctorate' : t >= 50 ? 'Masters' : 'Bachelors' }; }
  // where everything goes for the next shot of a drill: O (object ball), C (cue ball, null in hand), G (ghost ball), the
  // pocket, the aim (where the object ball is sent), targets (rectangles the cue ball must reach), the rail rule (F5), the
  // target ball (F7) and the other rail balls, and a few words
  function layout(id, st, P, view) {
    const R = P.R, D = 2 * R, dia = P.L / 8, o = view(0, 0), sx = Math.sign(view(1, 0)[0] - o[0]) || 1, sy = Math.sign(view(0, 1)[1] - o[1]) || 1;
    const pt = (dx, dy, ix, iy) => { const p = view(dx, dy); return [p[0] + sx * (ix || 0), p[1] + sy * (iy || 0)]; };
    const pocketAt = (dx, dy) => { const q = view(dx, dy); let b = 0; P.pockets.forEach((k, i) => { if (Math.hypot(k.x - q[0], k.y - q[1]) < Math.hypot(P.pockets[b].x - q[0], P.pockets[b].y - q[1])) b = i; }); return b; };
    // a rectangle from its middle (diamonds plus inches) and its size along the table and across it (inches)
    const rect = (dx, dy, ix, iy, w, h) => { const c = pt(dx, dy, ix, iy); return { x0: c[0] - w / 2, x1: c[0] + w / 2, y0: c[1] - h / 2, y1: c[1] + h / 2 }; };
    const ghostOf = (O, aim) => { const u = [aim[0] - O[0], aim[1] - O[1]], l = Math.hypot(u[0], u[1]) || 1; return [O[0] - D * u[0] / l, O[1] - D * u[1] / l]; };
    const pos = st.pos, k = st.shot, out = { id, R, inHand: false, targets: [], rail: null, others: [] };
    if (id === 'F1') {
      out.C = pt(8 - pos, 3); out.O = pt(8, 1, -3 * R, 0); out.pocket = pocketAt(8, 0); out.aim = [P.pockets[out.pocket].x, P.pockets[out.pocket].y];
      out.word = 'position ' + pos;
    } else if (id === 'F2' || id === 'F3' || id === 'F4') {
      // Down the far rail into the far right corner, on a line that really goes in (V3.23, owner Nov 17: with both balls a
      // ball's gap off the rail and parallel to it, as V3.22 had them, the ball meets the end rail's jaw on a 7 ft table,
      // where the half-diamond spot is under 5 in from the corner, so a slight cut was needed and the stop shot could not
      // stop): the line enters the pocket 1.5 in off the side cushion, through the object ball 2 in off it at the half
      // diamond, so the cue ball sits a little further off the rail the further back it is (8.5 in at position 7). As the
      // document allows, the balls may sit anywhere from the rail out to a diamond off it (free): only the place along the
      // rail is held, so the player can line the shot up straight by eye.
      out.pocket = pocketAt(8, 4); const E = pt(8, 4, 0, -1.5), O2 = pt(7.5, 4, 0, -2), onLine = dx => { const x = view(dx, 4)[0], s = (x - E[0]) / (O2[0] - E[0]); return [x, E[1] + s * (O2[1] - E[1])]; };
      out.aim = E; out.C = onLine(8 - pos);
      if (id === 'F3') { const ox = Math.min(9 - pos, 8 - (R + 0.6) / dia); out.O = onLine(ox); out.targets.push(rect(8, 4, -PAPER[1] / 2, -1 - PAPER[0] / 2, PAPER[1], PAPER[0])); }
      else out.O = O2;
      if (id === 'F4') { const a = pt(4, 3), b = pt(6, 4); out.zone = { x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) }; }
      out.free = { railY: view(0, 4)[1], max: dia };
      out.word = 'position ' + pos;
    } else if (id === 'F5') {
      // the target: positions 1-3 along the middle at the 5th, 6th and 7th diamonds, 4 against the end rail, 5-7 back at 3,
      // 2, 1 (off the end rail first)
      out.inHand = true; out.O = pt(4, 2, 0, -D); out.pocket = pocketAt(4, 0); out.aim = [P.pockets[out.pocket].x, P.pockets[out.pocket].y];
      const loc = [1, 2, 3, 4, 3, 2, 1][pos - 1];
      out.targets.push(loc === 4 ? rect(8, 2, -PAPER[1] / 2, 0, PAPER[1], PAPER[0]) : rect(4 + loc, 2, 0, 0, PAPER[0], PAPER[1]));
      out.rail = pos <= 3 ? 'none' : pos >= 5 ? 'end' : null; out.endX = view(8, 0)[0];
      out.word = 'target ' + pos + (pos >= 5 ? ' (off the end rail)' : pos <= 3 ? ' (straight to it)' : '');
    } else if (id === 'F6') {
      const C1 = [2, 3], C2 = [2, 1], A = [3, 3], B = [4, 2], Cc = [6, 2], Dd = [3, 1], TS = [4, 4], TR = [8, 4], BS = [4, 0], BR = [8, 0];
      const shots = [[C1, A, TS], [C1, A, TR], [C1, Cc, BR], [C1, B, BS], [C1, B, BR], [C2, Dd, BS], [C2, Dd, BR], [C2, Cc, TR], [C2, B, TS], [C2, B, TR]];
      const s = shots[Math.min(k, 9)]; out.C = pt(s[0][0], s[0][1]); out.O = pt(s[1][0], s[1][1]); out.pocket = pocketAt(s[2][0], s[2][1]); out.aim = [P.pockets[out.pocket].x, P.pockets[out.pocket].y];
      out.word = 'shot ' + (Math.min(k, 9) + 1) + ' of 10';
    } else if (id === 'F7') {
      out.inHand = true; out.O = pt(4, 3); out.pocket = pocketAt(4, 4); out.aim = [P.pockets[out.pocket].x, P.pockets[out.pocket].y];
      const balls = [pt(5, 4, 0, -R), pt(6, 4, 0, -R), pt(7, 4, 0, -R), pt(8, 4, -1.5 * R, -2 * R), pt(8, 3, -R, 0), pt(8, 2, -R, 0), pt(8, 1, -R, 0), pt(8, 0, -1.5 * R, 2 * R), pt(7, 0, 0, R), pt(6, 0, 0, R)];
      const ti = Math.min(9, Math.floor(k / 2)); out.tball = balls[ti]; out.tnum = ti + 1; out.others = balls.slice(ti + 1);
      out.word = 'rail ball ' + (ti + 1) + ' of 10, try ' + (k % 2 + 1) + ' of 2';
    } else if (id === 'F8') {
      out.O = pt(1, 3); out.C = pt(1.5, 2); out.pocket = pocketAt(0, 4); out.aim = [P.pockets[out.pocket].x, P.pockets[out.pocket].y];
      const T = [rect(2, 4, 0, -PAPER[1] / 2, PAPER[0], PAPER[1]), rect(6, 4, 0, -PAPER[1] / 2, PAPER[0], PAPER[1]), rect(6, 0, 0, PAPER[1] / 2, PAPER[0], PAPER[1]), rect(4, 2, 0, 0, PAPER[0], PAPER[1]), rect(2, 0, 0, PAPER[1] / 2, PAPER[0], PAPER[1])];
      const ti = Math.min(4, Math.floor(k / 4)); out.targets.push(T[ti]); out.tnum = ti + 1;
      out.word = 'target ' + (ti + 1) + ' of 5, try ' + (k % 4 + 1) + ' of 4';
    }
    out.G = ghostOf(out.O, out.aim);
    return out;
  }
  const inRect = (p, r, m) => !!p && p[0] >= r.x0 - m && p[0] <= r.x1 + m && p[1] >= r.y0 - m && p[1] <= r.y1 + m;
  // the ghost ball as the balls were set: the object ball's spot less two radii back along the line from the cue ball
  function ghostAt(lay, f) {
    if (!f.obAt || !f.cueAt) return lay.G; const u = [f.obAt[0] - f.cueAt[0], f.obAt[1] - f.cueAt[1]], l = Math.hypot(u[0], u[1]);
    return l > 4 * lay.R ? [f.obAt[0] - 2 * lay.R * u[0] / l, f.obAt[1] - 2 * lay.R * u[1] / l] : lay.G;
  }
  // a ball on its mark: within tol of the X; with free (F2-F4) only along the rail, and anywhere from the cushion to a
  // diamond off it (V3.23, owner Nov 17: more leeway; the document allows the balls anywhere within a diamond of the rail)
  function onMark(lay, mark, p, tol) {
    if (!lay.free) return Math.hypot(p[0] - mark[0], p[1] - mark[1]) <= tol;
    return Math.abs(p[0] - mark[0]) <= tol && Math.abs(p[1] - lay.free.railY) <= lay.free.max;
  }
  // one shot: made or not by the drill's rule. f: { obIn, obPocket (null when not known), scratch, cueEnd [x,y],
  // cuePath [[x,y]...], targetMoved }. Returns { ok, why }
  function judge(lay, f) {
    const pocketOk = f.obIn && (f.obPocket == null || f.obPocket === lay.pocket);
    if (!pocketOk) return { ok: false, why: f.obIn ? 'wrong pocket' : 'missed' };
    if (lay.id === 'F1') return { ok: true, why: 'made' };
    if (f.scratch) return { ok: false, why: 'scratch' };
    if (lay.id === 'F6') return { ok: true, why: 'made' };
    if (lay.id === 'F7') return f.targetMoved ? { ok: true, why: 'made and hit rail ball ' + lay.tnum } : { ok: false, why: 'missed rail ball ' + lay.tnum };
    if (!f.cueEnd) return { ok: false, why: 'cue ball not seen' };
    // (the ghost ball where the balls really were: the cue ball meets the object ball on the line the player set up, V3.23)
    if (lay.id === 'F2') { const G = ghostAt(lay, f); return Math.hypot(f.cueEnd[0] - G[0], f.cueEnd[1] - G[1]) <= 2 * lay.R + 0.3 ? { ok: true, why: 'stopped on the ghost ball' } : { ok: false, why: 'the cue ball did not stop on the ghost ball' }; }
    if (lay.id === 'F4') return inRect(f.cueEnd, lay.zone, 0) ? { ok: true, why: 'in the box' } : { ok: false, why: 'the cue ball not in the box' };
    const inT = lay.targets.some(r => inRect(f.cueEnd, r, lay.R)); // (overlapping the paper counts)
    if (!inT) return { ok: false, why: 'the cue ball not on the target' };
    if (lay.id === 'F5' && lay.rail) {
      const touched = (f.cuePath || []).some(p => Math.abs(p[0] - lay.endX) <= lay.R + 1.5);
      if (lay.rail === 'end' && !touched) return { ok: false, why: 'not off the end rail' };
      if (lay.rail === 'none' && touched) return { ok: false, why: 'off the rail (this target is straight to it)' };
    }
    return { ok: true, why: 'on the target' };
  }
  return { DRILLS, byId, MAX, state, total, layout, judge, prog, onMark, ghostAt };
})();
if (typeof module !== 'undefined') module.exports = BU;
