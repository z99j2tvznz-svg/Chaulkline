// Scores the cue-ball clips without tape readings (the player's request, 2026-10-22 20:15; ../PREREGISTRATION.md "No tape").
//   node score-notape.js <session dir with meta-part*.json> <dir with clipNNN.json cueball.js outputs> [--json]
// Truth used, and nothing else:
//   - the intended diamond crossing of each A placement (player sights the diamonds, est. 1-2 in);
//   - a ball touching a rail is exact on that axis (A2 near, A6 far, A8 right): the high-confidence tier;
//   - the player's B in/out call and C touched call.
// Tape readings typed into the app are stored in the meta files but never read here. The camera is never its own truth.
// Positions are reported in diamonds (8 x 4 grid on the measured 79.06 x 39.03 in cloth) with inches alongside.
'use strict';
const fs = require('fs'), path = require('path');
const [SES, OUT] = process.argv.slice(2).filter(a => !a.startsWith('--')), JSONOUT = process.argv.includes('--json');
const CL = 79.06, CW = 39.03, SYS = [78, 39], R = 1.125, DX = CL / 8, DY = CW / 4, ZONE_R = 4.5, BORDER = 0.5;
const clips = fs.readdirSync(SES).filter(f => /^meta-part\d+\.json$/.test(f)).sort()
  .flatMap(f => JSON.parse(fs.readFileSync(path.join(SES, f), 'utf8')).clips);
const read = n => { const p = path.join(OUT, n + '.json'); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null; };
// system frame (x from the left cushion, y from the near cushion, assumed 78 x 39) scaled to the measured cloth
const sc = p => ({ x: p.x * CL / SYS[0], y: p.y * CW / SYS[1] });
// intended crossing in inches; a coordinate within 0.2 diamond of a rail (the recorder's "touching" spots) = frozen
const spot = at => ({ x: Math.min(Math.max(at[0] * DX, R), CL - R), y: Math.min(Math.max(at[1] * DY, R), CW - R),
  frozenX: at[0] < 0.2 ? 'left' : at[0] > 7.8 ? 'right' : null, frozenY: at[1] < 0.2 ? 'near' : at[1] > 3.8 ? 'far' : null });
const dia = (dx, dy) => +Math.hypot(dx / DX, dy / DY).toFixed(2);
const r1 = v => v == null ? null : +v.toFixed(1), r2 = v => v == null ? null : +v.toFixed(2);
const med = a => { const s = a.slice().sort((u, v) => u - v), n = s.length; return n ? (n % 2 ? s[n >> 1] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
const res = { cloth: [CL, CW], diamond: [r2(DX), r2(DY)], A: [], B: [], C: [], D: [], shots: { events: 0, found: 0, missed: 0, extra: 0 } };

for (const c of clips) {
  const o = read(c.name), ev = c.step, kind = ev[0];
  if (kind === 'A') {
    const t = spot(c.layout.balls[0].at);
    // the clip's position: its longest steady still period
    const st = o ? o.stills.filter(s => s.steady).sort((a, b) => (b.to - b.from) - (a.to - a.from))[0] : null;
    const row = { event: ev, intended: c.layout.balls[0].at, found: !!st, extraShots: o ? o.shots.length : null };
    if (st) {
      const p = sc(st), dx = p.x - t.x, dy = p.y - t.y;
      Object.assign(row, { system: [r2(p.x / DX), r2(p.y / DY)], offIn: [r1(dx), r1(dy)], offDiamonds: dia(dx, dy), offIn2d: r1(Math.hypot(dx, dy)) });
      // frozen axis: exact truth on that axis only
      if (t.frozenX) row.frozenAxis = { rail: t.frozenX, errorIn: r1(Math.abs(dx)), errorDiamonds: r2(Math.abs(dx) / DX) };
      if (t.frozenY) row.frozenAxis = { rail: t.frozenY, errorIn: r1(Math.abs(dy)), errorDiamonds: r2(Math.abs(dy) / DY) };
    }
    res.A.push(row);
    continue;
  }
  // B-D: one shot per clip
  res.shots.events++;
  const shots = o ? o.shots : [], s = shots[0] || null;
  if (s) res.shots.found++; else res.shots.missed++;
  res.shots.extra += Math.max(0, shots.length - 1);
  const row = { event: ev, shotsFound: shots.length, complete: s ? s.complete : null, gaps: s ? s.gaps.length : null,
    gapSec: s ? r2(s.gaps.reduce((a, g) => a + g[1], 0)) : null, v0: s ? s.v0 : null, duration: s ? s.duration : null,
    pathDiamonds: s ? r2(s.pathLength * CL / SYS[0] / DX) : null };
  const rest = s && s.rest ? sc(s.rest) : null;
  if (rest) row.rest = [r2(rest.x / DX), r2(rest.y / DY)];
  if (kind === 'B') {
    const b = c.layout.box, cx = b.c[0] * DX, cy = b.c[1] * DY;
    row.player = c.answers.inBox || null;
    if (rest) {
      const ex = Math.abs(rest.x - cx) - ZONE_R, ey = Math.abs(rest.y - cy) - ZONE_R, edge = Math.max(ex, ey);
      row.system = edge <= 0 ? 'in' : 'out';
      row.fromBoxEdgeIn = r1(edge);                       // negative = inside
      row.borderline = Math.abs(edge) <= BORDER;
      row.agree = row.player ? row.player === row.system : null;
      row.pastBoxCentreDiamonds = r2((rest.x - cx) / DX);  // + = long (past the box centre), - = short
    }
  }
  if (kind === 'C') {
    row.player = c.answers.touched || null;
    if (s) {
      const g = s.closest.right * CL / SYS[0];
      row.closestRightIn = r1(g);
      row.system = g <= 0.5 ? 'yes' : 'no';                // pre-registered: within half a ball + 0.5 in of the cushion line
      row.agree = row.player && row.player !== 'unsure' ? row.player === row.system : null;
      if (rest) row.restFromRightDiamonds = r2((CL - R - rest.x) / DX);
    }
  }
  res[kind].push(row);
}
const a = res.A.filter(r => r.found), fz = a.filter(r => r.frozenAxis);
res.summary = {
  A: { placements: res.A.length, found: a.length, medianOffDiamonds: r2(med(a.map(r => r.offDiamonds))), worstOffDiamonds: a.length ? Math.max(...a.map(r => r.offDiamonds)) : null,
    withinQuarterDiamond: a.filter(r => r.offDiamonds <= 0.25).length,
    frozenAxis: fz.map(r => ({ event: r.event, rail: r.frozenAxis.rail, errorIn: r.frozenAxis.errorIn, errorDiamonds: r.frozenAxis.errorDiamonds })) },
  B: { shots: res.B.length, agree: res.B.filter(r => r.agree === true).length, disagree: res.B.filter(r => r.agree === false).length, borderline: res.B.filter(r => r.borderline).length },
  C: { shots: res.C.length, agree: res.C.filter(r => r.agree === true).length, disagree: res.C.filter(r => r.agree === false).length },
  shots: res.shots };
if (JSONOUT) { console.log(JSON.stringify(res, null, 1)); return; }
console.log('A placements (system vs intended diamond crossing; placement itself +/- ~1-2 in):');
for (const r of res.A) console.log(' ', r.event, 'intended', JSON.stringify(r.intended), r.found ? `system ${JSON.stringify(r.system)}  off ${r.offDiamonds} dia (${r.offIn2d} in; dx ${r.offIn[0]}, dy ${r.offIn[1]})` + (r.frozenAxis ? `  frozen ${r.frozenAxis.rail}: ${r.frozenAxis.errorIn} in` : '') : 'NOT FOUND');
for (const k of ['B', 'C', 'D']) for (const r of res[k]) console.log(' ', JSON.stringify(r));
console.log(JSON.stringify(res.summary, null, 1));
