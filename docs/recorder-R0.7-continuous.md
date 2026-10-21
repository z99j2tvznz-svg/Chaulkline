# Recorder R0.7: continuous rack session (dev branch only, 2026-10-21)

R0.7 is R0.6 with one more session type, **Continuous rack**. The other session types (evening check, full, short) are
unchanged byte for byte in behaviour, and their tests still pass. It lives on the dev branch
`claude/project-thread-vl1o4a` only. The live recorder (main, GitHub Pages, R0.6) is not touched.

## What it does
- One recording per rack. The player taps **Start recording** once before the break and **Stop** after the last ball has
  stopped (with a confirmation, so an accidental tap does nothing). Nothing is asked between shots, there is no ball
  naming, and nothing is trimmed: the file starts at the tap and ends at the tap.
- The camera settings are identical to R0.6: the 1x "Back Camera", 1280x720, 60 fps requested, 2 Mbps, and 64 kbps sound
  with processing off. The footage therefore fits the existing offline pipeline, including both 30 fps picks.
- The video is written to IndexedDB (database `chalkRack`, separate from R0.6's `chalkRec`) as MediaRecorder hands it
  over (timeslice 1 s). Memory therefore does not grow with the length of the rack, and a crash or closed page keeps
  everything that reached storage.
- Logged per segment:
  - chunk index, ms since start, wall-clock epoch ms and bytes for every chunk;
  - frames shown per second (requestVideoFrameCallback on the preview), i.e. the real camera frame rate while
    recording;
  - events: hidden / visible, track muted / unmuted / ended, recorder errors, storage estimates every 30 s, and the stop
    reason;
  - camera track settings, microphone state at start and end;
  - the motion sensor (raw, about 60 Hz), flushed to storage every 5 s.
- Interruptions: if Safari stops the camera (screen lock, call, app switch) or the camera track ends, the segment is
  closed with its reason. The player can then **Carry on recording** as segment 2 of the same rack, or mark the rack
  finished. If the page comes back and the recorder is still running, recording simply continues and the hidden period
  is logged.
- Low space: it stops on its own below 300 MB free, keeping what was recorded.

## Saving
- **For the project chat:** numbered zip files under 25 MB, named
  `chalkline-R0.7-<session>-rack<n>-partKK-of-NN.zip`. Each file holds:
  - `meta.json`: everything above, plus the full file plan;
  - one byte range of one segment's video (`rack1.mp4.001`, `.002`, …);
  - the segment's last file also holds `rack1-motion.json`.

  Joined in order, the pieces are exactly the original file: `cat rack1.mp4.0* > rack1.mp4`. Packing and sharing take
  two taps per file, because iPhone only allows sharing straight from a tap. Saved files are ticked off, and a rack can
  only be deleted without a warning once every file is saved.
- **As one video:** shares the whole video file(s) plus a meta json, to save to Files or Photos. It is for keeping a
  copy, not for upload (one file is bigger than the chat limit).

Size: about 15.5 MB per minute at R0.6's settings, so a 10-minute rack is about 155 MB, or 7 files.

## How to open it on the iPhone
The dev branch is not on GitHub Pages (Pages serves main). It is served from the branch commit by raw.githack.com (a free
service that serves GitHub files as web pages over https). The workflow `.github/workflows/recorder-host-check.yml`
checks on every recorder push that the address returns this exact file as `text/html`, and it runs the recorder browser
tests on GitHub's machines. Address (pinned to the tested commit; checked 2026-10-21 by run https://github.com/z99j2tvznz-svg/Chaulkline/actions/runs/39547811692):
https://raw.githack.com/z99j2tvznz-svg/Chaulkline/1d95fa7c5a44862b02f52bfa2d1b33664f7f099d/recorder/index.html
(choose "Continuous rack" under Session). It is a different web address from the live recorder,
so its storage and permissions are separate from R0.6's.

## Tested here (headless Chromium, fake camera; `tests/recorder-rack.test.js`, plus every existing test)
- One rack with a forced cut-off:
  - camera track ended → segment 1 kept with its reason → carry on as segment 2 → Stop / Keep recording → Stop.
  - Every file was saved and unzipped. The pieces joined back are byte-identical in length to the recorded segments, and
    ffprobe decodes both joined videos.
  - Each file stays under the limit; there is a motion file per segment; chunk times are in order; the frame log is
    filled; deleting works.
- Page closed mid-recording without Stop → reopened → the rack is listed as "not saved yet", its chunks are kept, and it
  can be saved.
- The full test suite passes (41/41).
- Desktop Chromium writes mp4 in fragments of a few seconds rather than every second. That is why the tests wait longer.
  Safari's behaviour is one of the iPhone checks below.

## Not tested: needs the iPhone
1. Safari MediaRecorder with timeslice: does it hand over data every second (memory stays flat), and do the joined
   pieces play? (Expected: fragmented MP4 that plays in QuickTime and ffmpeg; unverified.)
2. Real frame rate over a long recording (the frame log shows it): does it hold about 60 fps for 10+ minutes, or
   throttle when the phone warms up?
3. Duration and size limits: a full rack (5-15 min). Is the storage quota prompt or eviction an issue? Does Safari stop
   the recording on its own?
4. Screen lock / auto-lock: the wake lock should keep the screen on (iOS 16.4+). What happens if the screen locks
   anyway?
5. Export: sharing each 25 MB zip to Files, then uploading to the chat; "Save as one video" with a large file.
6. Battery and heat over 3 racks.

The short test recording answers 1, 5 and part of 2. The three racks answer the rest.

## iPhone test 1 (2026-10-21 05:26 UTC): one complete 9-ball rack
Setup: iPhone 16 Pro Max, iOS 18.7, Safari 26.6.1, low side spot, home 7 ft table. Files: 3 zips, plus the meta file
from "Save as one video". Stored in project files as `chalkline-data/sessions/rack-20261021-0526/`.

Confirmed:
- Safari honours the 1 s timeslice: 200 chunks of about 260 KB, one every 1.05 s, so memory stays flat.
- 3 min 31 s, 51.9 MB (14.8 MB/min), saved as 3 files of 17.3 MB.
- All three zips are intact. The joined video is exactly 51,891,686 bytes, matching the recorded size, and decodes from
  start to end: H.264 1280x720 + AAC, 210.99 s.
- Frame rate: 12,651 video frames over 210.9 s = 59.98 fps. The longest gap between frames is 41.7 ms (2 of 12,650 gaps
  above one frame). The on-screen frame log shows 58-61 every second. There was no slowdown over the recording.
- Motion sensor: 12,661 rows (about 60 Hz) for the whole recording. Microphone ok at start and end. No hidden /
  interrupted events. Storage quota reported as 39 GB.
- The video starts on the racked table before the break and ends on a still table after the last ball.

Not yet tested: racks longer than about 4 minutes, a screen lock or call during recording, heat and battery over 3
racks, "Save as one video" for the video itself.

Note: the project-files store rewrites mp4 metadata on upload (the md5 changes, the frame count does not), so the copy
there is not byte-identical to the phone's file.
