// Build the diagnostic viewer for one session: a folder with the page (tools/viewer/index.html), one data file per
// clip (its Shot Record plus every analysed frame's detections, for the video overlay) and small re-encoded videos.
// Everything here is a disposable derivative: the originals are the source zips and the evidence store, and this
// folder can be rebuilt from them at any time.
//
//   node tools/make-viewer.js <data root> <session id> <out folder> [--no-video]
//
// Videos: 960x540, 30 frames per second taken with the same fps filter as the analysis (tools/clip-detect.js), with
// timestamps starting at 0, so video frame n is analysed frame n. Needs ffmpeg and unzip.
'use strict';
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), { execFileSync } = require('node:child_process');
const { runClip } = require('./make-records.js');
const { sha256 } = require('./make-evidence.js');

function build(root, id, out, video = true) {
  const recDir = path.join(root, 'records', id), session = JSON.parse(fs.readFileSync(path.join(recDir, 'session.json'), 'utf8'));
  const man = JSON.parse(fs.readFileSync(path.join(root, 'evidence', id, 'manifest.json'), 'utf8'));
  for (const d of ['data', 'video']) fs.mkdirSync(path.join(out, d), { recursive: true });
  const index = { session: { id, capture: session.capture, table: session.table, versions: session.versions, clock: session.clock, evidence: session.evidence }, clips: [] };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'viewer-'));
  for (const clip of Object.keys(session.clips)) {
    const recBuf = fs.readFileSync(path.join(recDir, clip + '.json')), rec = JSON.parse(recBuf);
    if (sha256(recBuf) !== session.clips[clip]) throw new Error(clip + ': record does not match session.json');
    const raw = JSON.parse(fs.readFileSync(path.join(root, rec.ref.detections.file), 'utf8'));
    // which track took each detection, at every analysed frame (the same tracker run the record came from)
    const run = runClip(raw), owner = raw.frames.map(() => new Map());
    for (const t of run.r.trace.tracks) for (const [tt, det] of t.samples) if (det >= 0) owner[Math.round(tt * raw.fps)].set(det, t.id);
    const frames = raw.frames.map((fr, f) => fr.balls.map((b, d) => [Math.round(b.px), Math.round(b.py), b.rec ?? -1, b.nb == null ? -1 : Math.round(b.nb * 10) / 10, owner[f].get(d) || 0]));
    fs.writeFileSync(path.join(out, 'data', clip + '.json'), JSON.stringify({ record: rec, overlay: { size: [1280, 720], columns: ['px', 'py', 'reader number (-1 none)', 'not-a-ball score', 'track (0 none)'], frames } }));
    let v = null;
    if (video) {
      const src = path.join(tmp, clip + '.mp4'), dst = path.join(out, 'video', clip + '.mp4');
      fs.writeFileSync(src, execFileSync('unzip', ['-p', path.join(root, rec.ref.video.file), rec.ref.video.member], { maxBuffer: 1 << 30 }));
      if (sha256(fs.readFileSync(src)) !== rec.ref.video.sha256) throw new Error(clip + ': source video sha256 changed');
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-an', '-vf', 'fps=30,setpts=PTS-STARTPTS,scale=960:540', '-c:v', 'libx264', '-preset', 'medium',
        '-crf', '28', '-g', '30', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', dst]);
      fs.unlinkSync(src); v = { file: 'video/' + clip + '.mp4', bytes: fs.statSync(dst).size, from: rec.ref.video.sha256 };
    }
    const a = rec.analyses;
    index.clips.push({ clip, step: rec.step, start: rec.clock.start, seconds: +(rec.clock.frames / rec.clock.fps).toFixed(1), shots: rec.observed.shots.length,
      reportedIn: rec.reported && rec.reported.answers.in || [], disagreements: a[0].disagreements.length, coverage: a[1].share, corrections: rec.corrections.length, video: v });
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.writeFileSync(path.join(out, 'data', 'index.json'), JSON.stringify(index));
  fs.copyFileSync(path.join(__dirname, 'viewer', 'index.html'), path.join(out, 'index.html'));
  return index;
}

module.exports = { build };
if (require.main === module) {
  const argv = process.argv.slice(2), noVideo = argv.includes('--no-video'), [root, id, out] = argv.filter(a => !a.startsWith('--'));
  const ix = build(root, id, out, !noVideo);
  const mb = ix.clips.reduce((s, c) => s + (c.video ? c.video.bytes : 0), 0) / 1e6;
  console.log(`${id}: viewer for ${ix.clips.length} clips -> ${out} (videos ${mb.toFixed(1)} MB)`);
}
