// Manual-state runout demo: plan a hand-entered 9-ball layout, then replan after the layout changes. Writes one HTML page.
//   node tools/runout-demo.js [layout.json] [out.html]
// layout.json: { "ft": 9, "balls": [[id, x, y], ...], "change": { "afterStep": 2, "move": [[id, x, y], ...] } }  (table inches)
'use strict';
const fs = require('fs'), path = require('path');
const ST = require('../src/state.js'), RO = require('../src/runout.js');
const lp = process.argv[2] || path.join(__dirname, '../data/layouts/9ball-demo.json'), out = process.argv[3] || 'runout-demo.html';
const L = JSON.parse(fs.readFileSync(lp, 'utf8'));

const COL = { 0: '#f4f1e8', 1: '#f2c230', 2: '#1f4fbf', 3: '#d83a2e', 4: '#6a3aa0', 5: '#ef7d22', 6: '#1e8a4a', 7: '#7a2a24', 8: '#111', 9: '#f2c230' };
const ZC = { 3: '#2e9e4f', 2: '#e0a020', 1: '#d0453a', '-1': '#777' };
const PN = ['bottom-left corner', 'bottom side', 'bottom-right corner', 'top-left corner', 'top side', 'top-right corner'];
const lvl = l => Math.min(10, Math.max(1, Math.round(l)));
const tip = (a, b) => { const v = b > 0.12 ? 'follow' : b < -0.12 ? 'draw' : 'center'; const h = a > 0.1 ? ', right english' : a < -0.1 ? ', left english' : ''; return v + h; };

function svg(st, step) {
  const s = st.state, T = s.table, k = 7, pad = 18, W = T.L * k + 2 * pad, H = T.W * k + 2 * pad;
  const X = x => pad + x * k, Y = y => pad + (T.W - y) * k, o = [];
  o.push(`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${W}" height="${H}" rx="10" fill="#4a2c17"/><rect x="${pad}" y="${pad}" width="${T.L * k}" height="${T.W * k}" fill="#1f6f8b"/>`);
  const nx = st.plan[1] && st.plan[1].zone;   // the zone the cue ball should stop in for the next ball
  if (nx) for (let j = 0; j < nx.ny; j++) for (let i = 0; i < nx.nx; i++) { const q = nx.q[j * nx.nx + i]; if (ZC[q]) o.push(`<rect x="${X(i * nx.step)}" y="${Y((j + 1) * nx.step)}" width="${nx.step * k}" height="${nx.step * k}" fill="${ZC[q]}" opacity="${q === -1 ? 0.35 : 0.42}"/>`); }
  for (const p of T.pockets) o.push(`<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${p.r * k}" fill="#111"/>`);
  const pr = st.proposal, pd = st.prediction;
  if (pr) {
    const pk = T.pockets[pr.pocket], tb = s.balls.find(b => b.id === pr.target);
    o.push(`<line x1="${X(tb.x)}" y1="${Y(tb.y)}" x2="${X(pk.x)}" y2="${Y(pk.y)}" stroke="#fff" stroke-width="2" stroke-dasharray="6 4"/>`);
    o.push(`<circle cx="${X(pr.ghost[0])}" cy="${Y(pr.ghost[1])}" r="${T.R * k}" fill="none" stroke="#fff" stroke-dasharray="3 3"/>`);
    for (const [id, c] of [[0, '#fff'], [pr.target, '#ffe08a']]) { const p = pd.paths[id]; if (p) o.push(`<polyline fill="none" stroke="${c}" stroke-width="2" points="${p.map(q => X(q[1]).toFixed(1) + ',' + Y(q[2]).toFixed(1)).join(' ')}"/>`); }
    const e = pd.final.find(b => b.id === 0); if (e) o.push(`<circle cx="${X(e.x)}" cy="${Y(e.y)}" r="${T.R * k}" fill="none" stroke="#fff" stroke-width="2"/>`);
  }
  for (const b of s.balls) if (b.status === 'on') {
    const r = T.R * k, c = COL[b.id] || '#ccc';
    o.push(`<circle cx="${X(b.x)}" cy="${Y(b.y)}" r="${r}" fill="${b.id === 9 ? '#fff' : c}" stroke="#000" stroke-width="0.8"/>`);
    if (b.id === 9) o.push(`<rect x="${X(b.x) - r}" y="${Y(b.y) - r * 0.45}" width="${2 * r}" height="${r * 0.9}" fill="${c}"/>`);
    if (b.id) o.push(`<text x="${X(b.x)}" y="${Y(b.y) + 3.5}" font-size="10" text-anchor="middle" fill="${b.id === 8 || b.id === 2 || b.id === 4 ? '#fff' : '#000'}" font-family="sans-serif" font-weight="700">${b.id}</text>`);
  }
  o.push('</svg>'); return o.join('');
}

function stepHtml(st, i) {
  const pr = st.proposal, pd = st.prediction, order = st.plan.map(q => `${q.id}&rarr;${q.pocket >= 0 ? PN[q.pocket] : 'no pocket'}`).join(', ');
  let txt = `<p class="plan"><b>Backward pocket plan:</b> ${order}</p>`;
  if (pr) {
    const same = pr.pocket === pr.plannedPocket ? 'as planned' : `plan said ${PN[pr.plannedPocket]}, but no shot there leaves good position`;
    const z = st.plan[1] ? ['no spot', 'a red spot', 'an amber spot', 'a green spot'][pr.nextZone] + ` for the ${st.plan[1].id}` : 'last ball';
    txt += `<p><b>Shot ${i + 1}:</b> the ${pr.target} in the ${PN[pr.pocket]} (${same}). Cut ${pr.cut.toFixed(0)}&deg;, strength ${lvl(pr.level)} of 10, tip ${tip(pr.shot.a, pr.shot.b)}. ` +
           `Predicted: cue ball stops in ${z}; balls in: ${pd.pocketed.map(p => p.id === 0 ? 'cue (scratch)' : p.id).join(', ') || 'none'}. Make chance under small errors (model): ${Math.round(pr.makeChance * 100)}%.</p>`;
  }
  return `<section><h3>Step ${i + 1}${st.state.hypothetical ? ' (predicted layout)' : ' (confirmed layout)'}</h3>${svg(st, i)}${txt}</section>`;
}

function runHtml(title, r) { return `<h2>${title}</h2>` + r.steps.map(stepHtml).join('') + `<p class="stop"><b>Stopped:</b> ${r.stop}.</p>`; }

const t0 = Date.now(), s0 = ST.manualState(L.balls, { ft: L.ft || 9 }), A = RO.runout(s0);
let B = null, s1 = null;
if (L.change) {   // the player's real shot did not end where predicted: confirm the new layout and replan from it
  const k = Math.min(L.change.afterStep, A.steps.length) - 1, pred = A.steps[k].prediction, mv = new Map(L.change.move.map(m => [m[0], m]));
  const gone = new Set(pred.pocketed.map(p => p.id));
  const balls = pred.final.filter(b => !gone.has(b.id)).map(b => mv.has(b.id) ? [b.id, mv.get(b.id)[1], mv.get(b.id)[2]] : [b.id, b.x, b.y]);
  s1 = ST.manualState(balls, { ft: L.ft || 9 }); B = RO.runout(s1);
}
const css = `body{font:15px/1.45 -apple-system,system-ui,sans-serif;margin:0 auto;max-width:860px;padding:12px 16px;background:#fafaf7;color:#222}svg{width:100%;height:auto}section{margin:18px 0;border-top:1px solid #ddd;padding-top:6px}.plan{color:#555;font-size:13px}.note{background:#fff6d8;padding:8px 12px;border-radius:6px}@media(prefers-color-scheme:dark){body{background:#16171a;color:#e8e8e8}.plan{color:#aaa}.note{background:#3a3320}section{border-color:#333}}`;
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Runout demo</title><style>${css}</style></head><body>
<h1>Chalkline runout demo (experimental)</h1>
<p class="note">Hand-entered 9-ball layout (${L.name || path.basename(lp)}). Suggestions only. Physics and make chances are the V1.8.1 model, <b>not yet checked against real shots</b>. Coloured squares: where the cue ball should stop for the next ball (green easy with natural shape to the ball after, amber, red, grey hooked). White dashed: object ball to pocket; white line: predicted cue-ball path; yellow line: object-ball path; ring: predicted cue-ball stop.</p>
${runHtml('Plan from the confirmed layout', A)}
${B ? runHtml(`Replan after step ${L.change.afterStep}: the layout changed (${L.change.why || 'balls moved'})`, B) : ''}
<p class="plan">Generated by tools/runout-demo.js in ${((Date.now() - t0) / 1000).toFixed(1)} s.</p></body></html>`;
fs.writeFileSync(out, html);
const sum = r => r.steps.map(st => st.proposal ? `${st.proposal.target}>${st.proposal.pocket}` : 'none').join(' ') + ' | ' + r.stop;
console.log('plan  : ' + sum(A)); if (B) console.log('replan: ' + sum(B)); console.log('wrote ' + out);
