// Drills (V3.6, owner Nov 2): in free practice the app cannot know what a shot was for (a thin cut, a bank, the open
// pocket), so its rates were guesses. A drill says it: where the object ball and the cue ball go and the pocket, so a
// make, a miss and the cut are known. Each drill is progressive (as Bob Jewett's): made, the next level is harder;
// missed, it steps back; the level reached is the score. Placing the balls roughly is enough: the scoring uses where
// they really are. Pure functions: positions in table inches; view(dx, dy) turns diamonds as the phone sees the table
// (dx from the left end, dy from the near rail) into table inches. The app draws and feeds the shots; tests use it too.
const DRILL = (() => {
  const D2 = Math.PI / 180, rot = (u, a) => [u[0] * Math.cos(a) - u[1] * Math.sin(a), u[0] * Math.sin(a) + u[1] * Math.cos(a)];
  const hyp = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]), unit = (a, b) => { const d = hyp(a, b) || 1; return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; };
  // each drill: its levels, and for a level where the balls go (in diamonds as seen: x from the left end, y from the
  // near rail; a diamond is an eighth of the table's length) and the pocket (as seen: the far right corner, ...)
  // (owner, Nov 3: the phone stands behind the near rail at the middle; no drill may have the player shooting from there.
  // Cuts go the long way of the table, from the left end; the bank is shot from the far side.)
  const LIST = [
    { id: 'cut', name: 'Cut ladder', about: 'The cue ball 3 diamonds from the left end, in the middle; the object ball a diamond and a half from the far right corner. Straight in first; each make moves the object ball round toward the short rail, 10° thinner.',
      levels: [0, 10, 20, 30, 40, 50], word: c => c ? c + '° cut' : 'straight in', kind: 'turn', cue: [3, 2], pocket: [8, 4], obDist: 1.5 },
    { id: 'thin', name: 'Thin cuts', about: 'The object ball almost against the right end rail, a diamond and a quarter from the near right corner; the cue ball moves out for each cut, from 50° to 77°, shot from the far side.',
      levels: [50, 57, 63, 68, 73, 77], word: c => c + '° cut', kind: 'cut', ob: 'rail', obFrom: 1.25, pocket: [8, 0], cueDist: 2.5 },
    { id: 'bank', name: 'Cross-side bank', about: 'The object ball a diamond and a half off the near rail, a little right of the side pockets, banked off the near rail into the far side pocket, shot from the far side. Each make moves it a quarter diamond further right.',
      levels: [0.25, 0.5, 0.75, 1, 1.25, 1.5], word: o => o + ' diamond' + (o > 1 ? 's' : '') + ' right', kind: 'bank', ob: [4, 1.5], pocket: [4, 4], cueDist: 1.2 },
    { id: 'stop', name: 'Stop shot', about: 'Straight into the far right corner; the cue ball has to stop within a ball and a half of where it hit. Each make puts the cue ball a step further back.',
      levels: [1.2, 2, 2.8, 3.6, 4.4], word: d => d + ' diamonds back', kind: 'stop', ob: [6.6, 3.3], pocket: [8, 4], cueDist: null },
  ];
  const byId = id => LIST.find(d => d.id === id);
  // where the balls go for a drill's level: { O, C, G (where the cue ball meets it), pocketAt, pocket (index), aimAt }
  function setup(id, level, P, view) {
    const d = byId(id), v = d.levels[Math.max(0, Math.min(d.levels.length - 1, level))], dia = P.L / 8, R = P.R, T = p => view(p[0], p[1]);
    const pkAt = T(d.pocket), pocket = P.pockets.reduce((b, q, i) => Math.hypot(q.x - pkAt[0], q.y - pkAt[1]) < Math.hypot(P.pockets[b].x - pkAt[0], P.pockets[b].y - pkAt[1]) ? i : b, 0);
    const Pk = [P.pockets[pocket].x, P.pockets[pocket].y];
    let O = d.ob === 'rail' ? null : d.ob ? T(d.ob) : null, aimAt = Pk;
    // the object ball almost against the end rail by the pocket (a hair off the cushion), obFrom diamonds along it
    if (d.ob === 'rail') { const e = T([d.pocket[0] ? 8 : 0, d.pocket[1] ? 4 - d.obFrom : d.obFrom]); O = [e[0] < P.L / 2 ? R + 0.3 : P.L - R - 0.3, e[1]]; }
    // the cue ball where it is set (cue); the object ball obDist diamonds from the pocket, turned round it until the cut is
    // right, on the side toward the end rail (the cut gets thinner as it comes round)
    if (d.kind === 'turn') {
      const C0 = T(d.cue), r = d.obDist * dia, m = R + 1; let best = null;
      for (let t = 0; t < 360; t += 0.25) {
        const o = [Pk[0] + r * Math.cos(t * D2), Pk[1] + r * Math.sin(t * D2)]; if (!(o[0] > m && o[1] > m && o[0] < P.L - m && o[1] < P.W - m)) continue;
        const u = unit(o, Pk), g = [o[0] - 2 * R * u[0], o[1] - 2 * R * u[1]], a = Math.atan2(u[1], u[0]) - Math.atan2(g[1] - C0[1], g[0] - C0[0]), cut = Math.abs(((a / D2) + 540) % 360 - 180);
        if (Math.abs(cut - v) > 0.4) continue; const side = Math.abs(o[0] - Pk[0]);
        if (!best || side < best.side) best = { o, side };
      }
      O = best.o; const u = unit(O, Pk), G = [O[0] - 2 * R * u[0], O[1] - 2 * R * u[1]];
      return { id, level, value: v, word: d.word(v), O, C: C0, G, pocket, aimAt: Pk, Pk };
    }
    if (d.kind === 'bank') { O = T([d.ob[0] + v, d.ob[1]]); const near = T([d.ob[0], 0]); aimAt = [Pk[0], 2 * near[1] + (near[1] < P.W / 2 ? R : -R) * 2 - Pk[1]]; } // the pocket's mirror in the near cushion
    if (d.kind === 'stop') { const u0 = unit(Pk, T([4, 2])); O = [Pk[0] + u0[0] * 1.4 * dia, Pk[1] + u0[1] * 1.4 * dia]; }
    const u = unit(O, aimAt), G = [O[0] - 2 * R * u[0], O[1] - 2 * R * u[1]];
    const inside = p => p[0] > 3 && p[1] > 3 && p[0] < P.L - 3 && p[1] < P.W - 3;
    let C = null;
    // (the cue ball as far back as the table allows, down to under a diamond for a thin cut near the rail; the side of
    // the line nearer the middle of the table)
    if (d.kind === 'cut') { let best = null; for (const s of [1, -1]) { const w = rot(u, s * v * D2); for (let k = d.cueDist; k >= 0.8; k -= 0.1) { const c = [G[0] - w[0] * k * dia, G[1] - w[1] * k * dia];
      if (inside(c)) { if (!best || k > best.k + 1e-6 || (Math.abs(k - best.k) < 1e-6 && Math.abs(c[1] - P.W / 2) < Math.abs(best.c[1] - P.W / 2))) best = { c, k }; break; } } } C = best && best.c; }
    else { const dist = d.kind === 'stop' ? v * dia : d.cueDist * dia; C = [G[0] - u[0] * dist, G[1] - u[1] * dist]; }
    return { id, level, value: v, word: d.word(v), O, C, G, pocket, aimAt, Pk };
  }
  // a shot taken on a setup: { scored, made, stopped, cut } (scored false: the balls were not set out for it). shot: the
  // tracker's shot (before / after with key, num, x, y, rx, ry; made with key, num, pocket; scratch)
  function score(st, shot, P) {
    const R = P.R, at = b => [b.rx != null ? b.rx : b.x, b.ry != null ? b.ry : b.y];
    const obs = (shot.before || []).filter(b => b.num !== 0).map(b => ({ b, d: hyp(at(b), st.O) })).filter(x => x.d <= 8).sort((a, b) => a.d - b.d);
    if (!obs.length) return { scored: false };
    const ob = obs[0].b, O = at(ob), cue = (shot.before || []).find(b => b.num === 0), C = cue ? at(cue) : null;
    const m = (shot.made || []).find(q => (q.key != null && q.key === ob.key) || (ob.num != null && q.num === ob.num));
    // in the pocket it was for (a call without a pocket counts: the ball was set up for that one)
    const made = !!m && !shot.scratch && (m.pocket == null || m.pocket === st.pocket);
    // the cut as really set out: from the cue ball to where it had to meet the ball, against the line the ball had to take
    let cut = null; if (C) { const u = unit(O, st.aimAt), G = [O[0] - 2 * R * u[0], O[1] - 2 * R * u[1]], a = Math.atan2(u[1], u[0]) - Math.atan2(G[1] - C[1], G[0] - C[0]); cut = Math.round(Math.abs(((a / D2) + 540) % 360 - 180)); }
    let stopped = null;
    if (byId(st.id).kind === 'stop') { const c2 = (shot.after || []).find(b => b.num === 0), u = unit(O, st.aimAt), G = [O[0] - 2 * R * u[0], O[1] - 2 * R * u[1]]; stopped = !!c2 && hyp([c2.x, c2.y], G) <= 1.5 * 2 * R; }
    return { scored: true, made: made && (stopped == null || stopped), pocketed: made, stopped, cut };
  }
  // the level after a shot: up on a make, down on a miss (Jewett's progressive practice)
  const next = (id, level, made) => Math.max(0, Math.min(byId(id).levels.length - 1, level + (made ? 1 : -1)));
  // a session's drill tries: [{ id, level, made }] -> per drill { id, name, tries, made, best (level index), levels: [made, tries] }
  function summary(tries) {
    const out = [];
    for (const d of LIST) { const ts = tries.filter(t => t.id === d.id); if (!ts.length) continue;
      out.push({ id: d.id, name: d.name, tries: ts.length, made: ts.filter(t => t.made).length, best: Math.max(...ts.map(t => t.made ? t.level : -1)),
        levels: d.levels.map((v, i) => [d.word(v), ts.filter(t => t.level === i && t.made).length, ts.filter(t => t.level === i).length]).filter(r => r[2]) }); }
    return out;
  }
  return { LIST, byId, setup, score, next, summary };
})();
if (typeof module !== 'undefined') module.exports = DRILL;
