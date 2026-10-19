// for each made ball with no pocket event: what happened to its track (v0.4 detections, tracker with an option)
const fs = require('fs'); const { makeTracker } = require('../tracker.js');
const SC = process.env.SC || '.';   // folder holding v04/ detections and pocket/made-v04.json
const rows = JSON.parse(fs.readFileSync(SC + '/pocket/made-v04.json')); const opts = JSON.parse(process.argv[2] || '{}');
const PK = [[0, 0], [39, -0.6], [78, 0], [0, 39], [39, 39.6], [78, 39]];
const dpk = (x, y) => Math.min(...PK.map(p => Math.hypot(x - p[0], y - p[1])));
const C = {};
for (const r of rows) {
  if (r.event !== 'none' || r.status === 'confirmed' || /not settled/.test(r.status) || r.status.startsWith('wrong')) continue;
  const d = JSON.parse(fs.readFileSync(`${SC}/v04/v04-${r.sess}/${r.clip}.json`));
  const tr = makeTracker(d.table, opts); for (const f of d.frames) tr.step(f); const res = tr.finish();
  const all = tr.tracks;
  if (!all) { console.log('no track access'); process.exit(); }
  const mine = all.filter(t => { let b = -1, bv = 0; t.votes.forEach((v, i) => { if (v > bv) { bv = v; b = i; } }); return bv >= 2 && b === r.ball; });
  let k;
  if (!mine.length) k = 'no track ever named this ball';
  else {
    const t = mine.sort((a, b) => b.t - a.t)[0], last = t.path[t.path.length - 1], wasMoving = t.lastMoving != null && t.t - t.lastMoving < 0.3;
    k = `named track ends ${t.state}; ${wasMoving ? 'moving' : 'resting'} when lost; ${dpk(last[1], last[2]) < 8 ? 'near' : 'far from'} pocket; coasted ${t.coasted || 0}`;
  }
  C[k] = (C[k] || 0) + 1;
}
console.log(JSON.stringify(opts)); for (const [k, n] of Object.entries(C).sort((a, b) => b[1] - a[1])) console.log(String(n).padStart(3), k);
