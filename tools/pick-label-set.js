// Picks the first set of pictures to label for a ball detector (docs/diagnostics.md, part D). Picks only; labels nothing.
//
//   node tools/pick-label-set.js <sessions folder> <out folder> [--per 12]
//
// Only development footage is used (sessions before Oct 17, 2026). The Oct 17 sessions and the recorder run stay test
// data, so a detector trained on this set can still be scored on them fairly.
// From each debug session: up to --per shot pictures spread evenly over the session, before and after alternating, and
// spread over how many balls the app saw (few, middle, many). From the Oct 16 videos: the last frame of each clip, full
// frame. Each picture carries the app's own ball spots as a prefill to check, never as truth: a reviewer must check the
// whole picture and add every ball the app missed.
const fs = require('node:fs'), path = require('node:path'), { execFileSync } = require('node:child_process');
const argv = process.argv.slice(2), pIx = argv.indexOf('--per'), PER = pIx >= 0 ? +argv.splice(pIx, 2)[1] : 12;
const [SESS, OUT] = argv;
const DEV_BEFORE = '2026-10-17';
fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });

const items = [];
const sessions = fs.readdirSync(SESS).filter(d => /^\d{4}-\d\d-\d\d/.test(d) && d < DEV_BEFORE).sort();
for (const s of sessions) {
  const lf = path.join(SESS, s, 'labels.json'); if (!fs.existsSync(lf)) continue;
  const L = JSON.parse(fs.readFileSync(lf, 'utf8'));
  const pics = [];
  for (const sh of L.shots || []) for (const side of ['before', 'after']) {
    const v = sh[side]; if (!v || !v.file || !fs.existsSync(path.join(SESS, s, v.file))) continue;
    pics.push({ session: s, file: v.file, side, shot: sh.shot, rack: sh.rack, appBalls: (v.balls || []).length,
      prefill: (v.balls || []).map(b => ({ px: b.px, py: b.py, r: b.pr, appNumber: b.id, appConf: b.conf })) });
  }
  if (!pics.length) continue;
  // spread over ball counts first, then evenly over the session, before and after alternating
  const bin = p => p.appBalls <= 3 ? 'few' : p.appBalls <= 6 ? 'middle' : 'many';
  const even = (a, n) => n <= 0 || !a.length ? [] : a.length <= n ? a.slice() : Array.from({ length: n }, (_, i) => a[Math.floor((i + 0.5) * a.length / n)]);
  const take = [];
  for (const b of ['many', 'middle', 'few']) {
    const a = pics.filter(p => bin(p) === b), want = Math.ceil(PER / 3);
    // alternate: even-numbered picks prefer "before", odd ones "after", from the evenly spaced candidates
    for (const [i, c] of even(a, want).entries()) { const alt = a.find(p => p.shot === c.shot && p.side === (i % 2 ? 'after' : 'before')); take.push(alt || c); }
  }
  for (const p of even(pics.filter(p => !take.includes(p)), PER - take.length)) take.push(p);
  take.splice(PER);
  for (const p of take) {
    const name = `${s}__${p.file}`; fs.copyFileSync(path.join(SESS, s, p.file), path.join(OUT, 'images', name));
    items.push({ image: 'images/' + name, kind: 'app picture (table crop)', table: L.ft ? L.ft + ' ft' : null, ...p, bin: bin(p) });
  }
}
// Oct 16 videos: last frame of each clip, full frame (the still table after the shot)
const vid = path.join(SESS, '2026-10-16_evening_V2.3.3');
if (fs.existsSync(vid)) for (const f of fs.readdirSync(vid).filter(f => f.endsWith('.mp4')).sort()) {
  const name = `2026-10-16_evening_V2.3.3__${f.replace('.mp4', '')}-last.jpg`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-sseof', '-0.3', '-i', path.join(vid, f), '-frames:v', '1', '-q:v', '3', path.join(OUT, 'images', name)]);
  items.push({ image: 'images/' + name, kind: 'video frame (full frame, end of clip)', session: '2026-10-16_evening_V2.3.3', file: f, side: 'end', prefill: [] });
}
const manifest = { about: 'First picture set to label for a ball detector. Development footage only (before ' + DEV_BEFORE + '); Oct 17 sessions and the recorder run are kept for testing. prefill = the app\'s own guesses in picture pixels, to check and correct, never truth. For each picture a reviewer marks every ball (centre and radius), its number where readable, and leaves the number blank where it is not.',
  made: new Date().toISOString().slice(0, 10), count: items.length, items };
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
const by = {}; for (const i of items) by[i.session] = (by[i.session] || 0) + 1;
console.log(items.length + ' pictures'); for (const [k, v] of Object.entries(by)) console.log('  ' + k.padEnd(36) + v);
