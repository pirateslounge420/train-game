# Progress log (newest on top)

## 2026-11-03 — Claude (chat): reference build 0.5, design doc, brief
- Added `reference/train-game-prototype-0.5.html`: Claude chat's single-file playable build (three.js r128, phone and desktop). Open it over any local server, same as the repo game. It is the spec for feel (§B–§J).
- Added `docs/DESIGN.md` with every decision locked with Mike on 3 Nov: archery and the zeroed sight (§B), walking the train (§C), the four cars and the shovel-fed surge (§D), gangs and the gallop (§E), hit zones and gore (§F), the curving line, regions and tunnels (§G), hats and the hat car (§H), the clean HUD (§I), the look from the Torchfire frames (§J), co-op direction (§W), and the queue (§Z).
- Added `CLAUDE.md` (the brief: who owns what, sources of truth, rules). Not touched: anything in `src/`.
- Reference build history: 0.1 first playable (roof, bow, riders, towns); 0.2 walkable caboose; 0.3 Torchfire look, curving line, tunnels, trails, jump, items; 0.4 draw-to-aim, hats and the hat car, gore, shovel surge, gallop, gangs, clean HUD; 0.5 aim fix (faster floor, zeroed sight, cross crosshair with hit X).
- Next for Claude Code: §Z item 1, starting with §B.

## 2026-11-03 — Claude Code: first playable prototype
- Commit d4b630d: train ride on a straight desert track, walkable train with ladders, bow combat with real arrow physics, mounted bandits with four hit zones, health, arrow pickup. Modular `src/` layout; three.js 0.160 by import map; runs from a local server (`start.command`).
