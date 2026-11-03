# train-game — the brief (read at the start of every session)

**The Train Game**: a low-poly, first-person Wild West rail shooter. You ride an advanced-steam train through changing country and fend off mounted gangs with a bow. Mike Flow is the designer. He doesn't code: explain every change in plain English (what it reads, what it writes, what changes on screen), one step at a time, and ask before anything you'd call a design decision.

Two agents work here, the same way as in Mike's Torchfire repo:
- **Claude Code** (you, in the engine): owns `src/`, `index.html`, `style.css`, the README's build and run facts, and `docs/PROGRESS.md` build entries.
- **Claude (chat)**: owns `docs/DESIGN.md` and the reference build in `reference/`. Claude in chat talks the design through with Mike by voice and text, updates the design doc when something is locked, and republishes the reference build when a change is about *feel*.

## Sources of truth, in order
1. `docs/DESIGN.md` — every locked decision, dated and lettered (§A, §B, …). Newest sections at the bottom. It wins over everything below.
2. `reference/train-game-prototype-<version>.html` — Claude (chat)'s single-file playable build (three.js r128, runs on a phone). **It is the spec for feel**: arrow speed and drop, draw time, walking, the hit zones, the gore, the look. When DESIGN.md says "as in the reference build", open the file and port the numbers, don't guess. Never delete it; a new version is added beside the old one.
3. `docs/PROGRESS.md` — the log, newest on top. Both agents write entries. Read the top entry before starting.
4. `README.md`, code comments — describe the built game, nothing more.

If two of these disagree, tell Mike. Don't quietly pick one.

## The order of work
`docs/DESIGN.md` §Z (the queue) is the order. One item at a time: finish, explain in plain English, wait for Mike. Don't start the next item unprompted.

## Rules
- Pull with rebase before every push, never force. Claude (chat) pushes docs and the reference build to the same branch.
- Every design section has a letter. Cite it in commit messages and PROGRESS entries.
- The game must keep running on a phone (touch) as well as a desktop. Mike playtests on his phone.
- Every system is written so that one to four players on one train works later (§W): player state is per-player, the train and the world are shared. No global "the player".
- At the end of a session, prepend a PROGRESS entry.
