# Progress log (newest on top)

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
