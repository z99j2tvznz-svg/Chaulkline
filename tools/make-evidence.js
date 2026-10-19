// Raw evidence store for one recorded session: the analysed-frame detections, kept byte for byte, plus a manifest
// that ties every file to its sha256, the source videos (zip part, member name, sha256), the detector and the code
// that made the detections. The store is never rewritten: shot records (tools/make-records.js) are built from it.
//
//   node tools/make-evidence.js <data root> <session id> <detections folder> --code <commit> --detector <weights>
//   node tools/make-evidence.js <data root> <session id> --verify
//
// <data root> is the chalkline-data folder. Sources are read from <data root>/sessions/<session id>/partNN.zip (the
// recorder's own exports); the store goes to <data root>/evidence/<session id>/. Every path in the manifest is
// relative to <data root>. Needs `unzip`.
'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), { execFileSync, spawn } = require('node:child_process');

const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const fileSha = f => sha256(fs.readFileSync(f));
// a zip member's bytes, streamed through unzip so large videos never sit in memory twice
function memberSha(zip, member) {
  return new Promise((ok, fail) => {
    const h = crypto.createHash('sha256'); let n = 0;
    const p = spawn('unzip', ['-p', zip, member]);
    p.stdout.on('data', d => { h.update(d); n += d.length; });
    p.on('close', code => code === 0 ? ok({ sha256: h.digest('hex'), bytes: n }) : fail(new Error(`unzip ${zip} ${member}: ${code}`)));
  });
}
const members = zip => execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean);
const readMember = (zip, member) => execFileSync('unzip', ['-p', zip, member], { maxBuffer: 1 << 30 });

async function build(root, id, detDir, code, detector) {
  const src = path.join(root, 'sessions', id), out = path.join(root, 'evidence', id), rel = f => path.relative(root, f);
  if (fs.existsSync(path.join(out, 'manifest.json'))) throw new Error(`${out} already holds a store; it is never rewritten`);
  const zips = fs.readdirSync(src).filter(f => /^part\d+\.zip$/.test(f)).sort().map(f => path.join(src, f));
  const manifest = {
    format: 'chalkline.evidence/1', session: id,
    detections: {
      tool: 'tools/clip-detect.js --detector', code, analysedFps: null, coordinates: 'table inches (x along 0..L, y across 0..W) and camera pixels (px, py) in the 1280x720 frame',
      detector: { file: rel(detector), sha256: fileSha(detector) },
      perSpot: { x: 'table in', y: 'table in', px: 'frame px', py: 'frame px', c: 'detector confidence', rec: "reader's number (0 = cue ball)", p: "reader's score for rec", nb: '"not a ball" score' },
    },
    sources: [], clips: {},
  };
  for (const z of zips) {
    const meta = JSON.parse(readMember(z, 'meta.json'));
    manifest.sources.push({ file: rel(z), sha256: fileSha(z), bytes: fs.statSync(z).size, part: meta.part, recorder: meta.version, setup: meta.setup,
      meta: { member: 'meta.json', sha256: sha256(readMember(z, 'meta.json')) } });
    for (const m of members(z).filter(m => /^clip\d+\.mp4$/.test(m))) {
      const clip = m.replace('.mp4', ''), c = meta.clips.find(x => x.name === clip) || {};
      const v = await memberSha(z, m);
      manifest.clips[clip] = { step: c.step || null, redone: !!(c.answers && c.answers.redo), answers: c.answers || null, video: { file: rel(z), member: m, ...v, size: c.camera ? c.camera.video : null, fps: c.camera ? c.camera.settings.frameRate : null } };
    }
  }
  fs.mkdirSync(path.join(out, 'detections'), { recursive: true });
  for (const f of fs.readdirSync(detDir).filter(f => /^clip\d+\.json$/.test(f)).sort()) {
    const clip = f.replace('.json', ''), buf = fs.readFileSync(path.join(detDir, f)), d = JSON.parse(buf);
    if (!manifest.clips[clip]) throw new Error(`${f}: no source video for it`);
    fs.writeFileSync(path.join(out, 'detections', f), buf);
    manifest.detections.analysedFps = manifest.detections.analysedFps ?? d.fps;
    if (d.fps !== manifest.detections.analysedFps) throw new Error(`${f}: fps ${d.fps} differs`);
    manifest.clips[clip].detections = { file: rel(path.join(out, 'detections', f)), sha256: sha256(buf), bytes: buf.length, frames: d.frames.length,
      spots: d.frames.reduce((a, fr) => a + fr.balls.length, 0), table: d.table, outline: d.quadN, finder: d.finder, det: d.det };
  }
  for (const [clip, c] of Object.entries(manifest.clips)) if (!c.detections) c.notAnalysed = c.redone ? 'marked "redo" by the player (left out of the truth)' : 'not in the analysed set';
  fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
  return manifest;
}

// every file the manifest names exists and still has its sha256; returns a list of problems (empty = good)
async function verify(root, id) {
  const man = JSON.parse(fs.readFileSync(path.join(root, 'evidence', id, 'manifest.json'), 'utf8')), bad = [];
  const check = (f, want, what) => { const p = path.join(root, f); if (!fs.existsSync(p)) bad.push(`${what}: ${f} missing`); else if (fileSha(p) !== want) bad.push(`${what}: ${f} sha256 changed`); };
  check(man.detections.detector.file, man.detections.detector.sha256, 'detector');
  for (const s of man.sources) check(s.file, s.sha256, 'source zip');
  for (const [clip, c] of Object.entries(man.clips)) {
    if (c.detections) check(c.detections.file, c.detections.sha256, clip + ' detections');
    const z = path.join(root, c.video.file);
    if (fs.existsSync(z)) { const v = await memberSha(z, c.video.member); if (v.sha256 !== c.video.sha256) bad.push(`${clip} video: sha256 changed`); }
  }
  return { manifest: man, problems: bad };
}

module.exports = { verify, sha256, fileSha };

if (require.main === module) (async () => {
  const argv = process.argv.slice(2), arg = k => { const i = argv.indexOf('--' + k); return i >= 0 ? argv.splice(i, 2)[1] : null; };
  const isVerify = argv.includes('--verify'), code = arg('code'), detector = arg('detector'), [root, id, detDir] = argv.filter(a => !a.startsWith('--'));
  if (isVerify) {
    const { manifest, problems } = await verify(root, id);
    const n = Object.values(manifest.clips), a = n.filter(c => c.detections).length;
    console.log(`${id}: ${manifest.sources.length} source zips, ${n.length} videos, ${a} analysed clips: ${problems.length ? problems.length + ' PROBLEMS' : 'all sha256 match'}`);
    for (const p of problems) console.log('  ' + p);
    process.exit(problems.length ? 1 : 0);
  }
  if (!code || !detector || !detDir) throw new Error('usage: see the top of this file');
  const m = await build(root, id, detDir, code, detector);
  console.log(`${id}: ${Object.values(m.clips).filter(c => c.detections).length} detection files, ${Object.keys(m.clips).length} videos, manifest written`);
})().catch(e => { console.error(e.message); process.exit(1); });
