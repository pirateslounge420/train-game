# Progress log (newest on top)

## 2026-11-03 (late night) — Claude Code: §Z.1 step 2, walking and phone controls (§C, §M)
- Walking from reference 0.7 (`src/player/player.js`, `src/config.js`): 4.8 m/s on floors, 4.1 on roofs, ×0.55 while drawing, sprint ×1.45 by double-tapping forward (W or the stick) and holding, not while drawing, +6° view while sprinting; jump 4.6 m/s under 14 m/s² (about 0.76 m, was 1.27); ladders 1.9 m/s; look 0.22°/px for mouse and finger, ±1.35 rad pitch; head bob 11 rad/s, 3.5 cm. Velocity follows the input at once on a floor or ladder (as in the reference), with a little lag in the air so a push off a ladder carries.
- Phone controls (`src/core/input.js`, `index.html`, `style.css`), sizes from the reference: left stick, drag the view to look, hold Draw and drag the same finger to aim (0.8×), Jump, Grab. They show only when there's no fine mouse pointer. On a phone the arrow count moves onto the Draw button and health moves to the top right. A tap on the start screen starts the run without a mouse lock.
- Grab (§C) replaces walking over arrows: right click, E, the Grab button or a tap on the arrow pulls out the stuck arrow you look at within 3.4 m with nothing in the way (none from a ladder). The Grab button lights up when one is in reach. Short hints at the bottom of the screen, as in the reference.
- Shift no longer sprints: §C gives Shift to the surge (§K) and §S to crouch. It does nothing until those steps.
- Checked in the browser: walk 4.80, sprint 6.96, drawing 2.64 m/s; jump 0.78 m; the whole train walks end to end and back without a jump; Grab, look-drag, Draw-drag aim, Jump and the stick all respond in a phone-sized view. No console errors from the game.
- Per-player (§W): each player reads their controls once a frame through `player.controls(input)`, so another player's input can be fed in the same way.
- Not yet: Surge, Crouch and Stats buttons (their own steps), a pause on phones, and the repo isn't on GitHub Pages yet (§Z.2), so Mike can't open it on his phone from a link.

## 2026-11-03 (night) — Claude Code: §Z.1 step 1, archery and hitboxes (§B, §L, §U)
- Ported from reference 0.7 into `src/combat/bow.js`, `src/combat/arrows.js`, `src/config.js`: draw over 1 s on the (t² + 2t) / 3 curve; a draw under 0.1 looses nothing; 45 m/s snap to 80 m/s full; the zeroed sight (the arrow leaves the bow in hand and meets the crosshair at 15–35 m, nose-up by the `fire()` formula); instant re-nock; kick on release; 7° zoom; 72° / 84° (portrait) base view; tiny drag; 40 s arrow life; 5 s in the ground; arrows inherit the train's velocity only; 20 to start, 40 cap; the reference's arrow model and bow rig numbers.
- Trails: the 12-segment additive thread (3 cm to 4 mm) on every arrow, blue-white yours, orange-red theirs (§B, §U).
- Crosshair: the reference's 52 px open cross with the hit X; brass on headshots (§B, §L).
- Hitboxes (§U): every painted box of the repo's current horse and rider is a padded hit box (7 cm bodies, 9 cm limbs), tested in that part's own frame, with the arrow's path shifted by the rider's movement that frame; near-ties within 0.3 m go to the lower priority (head first). The parts still map to the old four zones until the anatomy rig (§O) is ported. Hats are not hittable yet (§H).
- Measured in the browser: the arrow crosses the crosshair line at the zero distance within 3 cm (snap) and 6 cm (full). Perfect-lead full-draw shots at galloping riders: 27 of 37 head, 27 of 37 torso, 25 of 37 leg (reference simulator: about 2/3, 7/10, 5/6).
- Fixed: a new arrow moved one extra frame of train travel on the frame it was loosed, landing it ~20 cm ahead of the aim.
- Removed: right-click to cancel a draw (not in the reference; right-click is Grab in §C).
- Per-player (§W): the bow now belongs to a player (`player.bow`), and the draw button is read through `input.drawHeld()` so touch can feed it.
- Not yet: touch controls (next, §C/§M), so the repo build still can't be played on a phone. Enemy aim and damage to you are unchanged until the riders step (§E).
- Open question for Mike: the branch `grapple-stagger-conductor` on GitHub (commit ff6ad45, crouch, knock-off, hook, conductor, stops) was built on the first prototype by another session and never merged. Keep, port its ideas when §S comes up, or delete?

## 2026-11-03 (evening) — Claude (chat): reference build 0.7, design §U
- `reference/train-game-prototype-0.7.html`. Mike's playtest of 0.6: bow should be snappier like Minecraft; arrows still pass through riders; the comet tail is too fat for how precise the shot is; a dismounted rider should recover, run at you and get a couple of hail-mary shots off.
- Bow: zoom 7° not 16°, no look slowdown while drawing, a kick on release, instant re-nock (§U). Hitboxes: the parts' own painted boxes, padded 3–9 cm, tested in the part's frame; hat crown only (§U). Trail: a thread, 3 cm to 4 mm, 12 segments (§U). Dismounted riders: footmen who get up, run, fire 2–3 wild shots, flee; any hit finishes them (§U).
- Bugs found by a transform-aware simulator (the old one ignored rotations): hat shots never registered in 0.6 (`hatOn` was never set), `worldOf` was undefined in `shootHat`, fled riders never despawned and blocked spawns. All fixed.
- Next for Claude Code: still §Z item 1, now from the 0.7 reference.

## 2026-11-03 (afternoon) — Claude (chat): reference build 0.6, design §K–§T
- `reference/train-game-prototype-0.6.html`. Merged with a parallel chat session's 0.6 (conductor, crouch, parapets, knock-off, hook, water stops: §S, unconfirmed) rather than overwrite it.
- Mike's 0.6 list, all in: steam is the player's call, three stacking surges from the tender to 200 mph, no shovel (§K); stretches 25 % longer; aim fix with the Torchfire draw curve, the arrow from the bow in hand, smaller reticle, bow carried right (§L); sprint by double-tap, smooth car crossings (§M); 8 ft drivers and the exhaust beat and horn (§N); the full anatomy rig with the gore table (§O); the asset standard (§P); less low-poly (§Q); Torchfire's 144-minute day and seeded, climate-picked generation (§R); wearable hats (§T).
- Hitboxes: tested in the rider's frame, 1.2× spheres; arrows live 40 s.
- Next for Claude Code: §Z item 1 from the 0.6 reference.

## 2026-11-03 — Claude (chat): reference build 0.5, design doc, brief
- Added `reference/train-game-prototype-0.5.html`: Claude chat's single-file playable build (three.js r128, phone and desktop). Open it over any local server, same as the repo game. It is the spec for feel (§B–§J).
- Added `docs/DESIGN.md` with every decision locked with Mike on 3 Nov: archery and the zeroed sight (§B), walking the train (§C), the four cars and the shovel-fed surge (§D), gangs and the gallop (§E), hit zones and gore (§F), the curving line, regions and tunnels (§G), hats and the hat car (§H), the clean HUD (§I), the look from the Torchfire frames (§J), co-op direction (§W), and the queue (§Z).
- Added `CLAUDE.md` (the brief: who owns what, sources of truth, rules). Not touched: anything in `src/`.
- Reference build history: 0.1 first playable (roof, bow, riders, towns); 0.2 walkable caboose; 0.3 Torchfire look, curving line, tunnels, trails, jump, items; 0.4 draw-to-aim, hats and the hat car, gore, shovel surge, gallop, gangs, clean HUD; 0.5 aim fix (faster floor, zeroed sight, cross crosshair with hit X).
- Next for Claude Code: §Z item 1, starting with §B.

## 2026-11-03 — Claude Code: first playable prototype
- Commit d4b630d: train ride on a straight desert track, walkable train with ladders, bow combat with real arrow physics, mounted bandits with four hit zones, health, arrow pickup. Modular `src/` layout; three.js 0.160 by import map; runs from a local server (`start.command`).
