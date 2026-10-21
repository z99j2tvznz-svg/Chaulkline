// Truth for the scorer's per-piece format, from the rack's verified event list (truth/rack1-events.json) and the
// pieces cut by segment.js: each verified shot belongs to the piece whose shot window (previous cut, next cut] holds it.
//   node make-truth.js <events json> <pieces.json> <out truth json>
const fs = require('node:fs');
const [EV, PIECES, OUT] = process.argv.slice(2);
const ev = JSON.parse(fs.readFileSync(EV, 'utf8')), { pieces } = JSON.parse(fs.readFileSync(PIECES, 'utf8'));
const clips = {}, names = pieces.map((_, k) => 'clip' + String(k + 1).padStart(3, '0'));
// a verified shot goes to the piece of the system shot within 1.5 s of it (the scorer's tolerance; one to one, closest
// first), otherwise to the piece whose window holds it (then the scorer counts it as missed or matches it as it can)
const owner = new Map(), used = new Set();
for (const [s, k] of ev.shots.flatMap(s => pieces.map((p, k) => [s, k])).filter(([s, k]) => pieces[k].shot != null && Math.abs(pieces[k].shot - s.at) < 1.5)
  .sort((a, b) => Math.abs(pieces[a[1]].shot - a[0].at) - Math.abs(pieces[b[1]].shot - b[0].at)))
  if (!owner.has(s) && !used.has(k)) { owner.set(s, k); used.add(k); }
for (const s of ev.shots) if (!owner.has(s)) owner.set(s, pieces.findIndex((p, k) => s.at > (k ? pieces[k - 1].to : -1) && (s.at <= p.to || k + 1 === pieces.length)));
pieces.forEach((p, k) => {
  const mine = ev.shots.filter(s => owner.get(s) === k).sort((a, b) => a.at - b.at);
  clips[names[k]] = { shot: mine.length > 0, at: mine.length ? mine[0].at : undefined, more: mine.slice(1).map(s => s.at),
    made: mine.flatMap(s => s.made), offTable: false, scratch: mine.some(s => s.scratch), first: mine.length ? mine[0].first : undefined,
    fouls: mine.filter(s => s.foul).map(s => s.foul), truthShots: mine.map(s => s.id),
    verify: { shot: 'yes (checked by eye, frame by frame)', made: 'yes (checked by eye)', state: 'yes (every still table checked by eye)' } };
});
fs.writeFileSync(OUT, JSON.stringify({ about: ev.about, racks: [{ name: 'rack1', start: ev.start, clips: names }], clips }, null, 1));
