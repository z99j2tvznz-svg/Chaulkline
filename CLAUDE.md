# Notes for Claude sessions on Chalkline

- Running work log (Google Doc, owner's Drive, folder "Chalkline test uploads"): "Chalkline Work Log",
  id 1ovBCSvR1TBgGqBpaxbLevIz4LyZMea5VsLk4Gm6h49w. Add an entry for every build, decision and reviewed session, and
  keep its "Current state" section up to date. DESIGN NOTES.md holds the per-build technical notes.
- Product plans, the feature list and future ideas are private: Drive folder "Chalkline plans",
  id 1tw2Vo7jwafisfyxJqHEul1cG-iS51dcY (feature list sheet 1FUEWdZcUKtbCoYRq3EoC5xgVI0dTP6E5yHRdZDKaS6E). This repo is
  public: do not put plans, business ideas or future features in it.
- Debug sessions: the owner attaches the app's debug zip to the chat. Unzip it and commit it to the `sessions` branch
  (not published by Pages), one folder per session, listed in that branch's README. Trimmed fixtures for tests go on
  main under tests/fixtures/v3/.
- After reviewing a session, add its live results to data/v3-gate.json (the app's "Tracking test" card on the home
  screen): sessions from V3.0.6 on, truth from the shot pictures, names checked on the after pictures.
- Nothing big is built until the owner says "build it". Plain English, positions in diamonds. The owner does not use git:
  commit and push to main (Pages publishes it) and send the link https://z99j2tvznz-svg.github.io/Chaulkline/.
