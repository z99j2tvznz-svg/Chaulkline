# Notes for Claude sessions on Chalkline

- Running work log (Google Doc, owner's Drive, folder "Chalkline test uploads"): "Chalkline Work Log",
  id 1ovBCSvR1TBgGqBpaxbLevIz4LyZMea5VsLk4Gm6h49w. Update it once per build, in one edit: the build, the session
  reviewed for it and the discussion and decisions that led to it, plus the "Current state" lines. Do not write to it for
  discussion-only messages (owner, Nov 10): that talk goes into the next build's entry. DESIGN NOTES.md holds the
  per-build technical notes.
- Before that edit (and any write to a Drive document: the log, the plans, the feature list), first copy the live file in
  Drive (copy_file into the same folder, titled "<name> (backup before last edit)") and check the copy has the content.
  Then move the previous backup into the folder "Chalkline log backups" (id 1Ln779GIovH9TjU7-DoB6RAfCi4tUjght, in
  Chalkline test uploads) with update_file parentId, renamed "<name> backup <date time UTC>". Only then edit the live file.
  Never trash or delete anything: the owner does not want delete prompts (owner, Nov 10). Put all the build's log changes
  in a single update, so this happens once per build. The owner may also ask for an entry outside a build; write it then. In the log, edit Current state lines
  by their exact text only: never a pattern that can match older entries (Nov 10: a "Next:" pattern overwrote ten old
  lines).
- Product plans, the feature list and future ideas are private: Drive folder "Chalkline plans",
  id 1tw2Vo7jwafisfyxJqHEul1cG-iS51dcY (feature list sheet 1FUEWdZcUKtbCoYRq3EoC5xgVI0dTP6E5yHRdZDKaS6E). This repo is
  public: do not put plans, business ideas or future features in it.
- Debug sessions: the owner attaches the app's debug zip to the chat. Unzip it and commit it to the `sessions` branch
  (not published by Pages), one folder per session, listed in that branch's README. Trimmed fixtures for tests go on
  main under tests/fixtures/v3/. A file over 30 MB comes in parts ("part 1 of 5"), sent one at a time: wait for the rest
  without asking; remind the owner only if one is still missing once the work on the others is done.
- After reviewing a session, add its live results to data/v3-gate.json (the app's "Tracking test" card on the home
  screen): sessions from V3.0.6 on, truth from the shot pictures, names checked on the after pictures.
- Claude leads the project; the owner tests and suggests (owner, Nov 1). Push back on a suggestion when the logic says
  to, not otherwise. Owner, Nov 2: work in big chunks. Each version adds something the owner can see in play; Claude
  decides and builds it without waiting for "build it". No dedicated test sessions or test modes for the owner: normal
  play is the test, and no buttons to press during play (owner, Nov 3): the player says what they are doing in the menu
  first (the app does not guess that), checks the table once, then never has to touch the phone; looking at it is fine.
  The app gets it right by itself; what it gets wrong is found in the debug files. If a button during play seems truly
  needed, push back and ask the owner first, and fixes found in reviews ride along with the next big build, not their own versions. Plain
  English, positions in diamonds. The owner does not use git:
  commit and push to main (Pages publishes it) and send the link https://z99j2tvznz-svg.github.io/Chaulkline/.
