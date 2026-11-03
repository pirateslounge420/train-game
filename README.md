# Train Game — first prototype

A low-poly, first-person Wild West rail shooter that runs in the browser.
You ride a steam train through an endless desert and fight off bandits on
horseback with a bow and arrow.

This is the **first tiny prototype**. It only covers the core feel: riding
the train, moving around on it, and bow combat.

## How to run it

You need an internet connection the first time (the 3D library, Three.js,
loads from the web).

**Easiest (Mac):** double-click **`start.command`** in this folder. A
Terminal window opens and your browser opens the game at
`http://localhost:8123`. Leave that Terminal window open while you play and
close it when you're done.

> If macOS says it can't open the file, right-click `start.command` → **Open**
> → **Open**. You only need to do this once.

**Or from Terminal:**

```bash
cd ~/Documents/GitHub/train-game
python3 -m http.server 8123
```

Then open <http://localhost:8123> in Chrome, Safari or Firefox.

(Opening `index.html` directly by double-clicking it won't work: browsers
block that kind of game from loading its files, so it needs the little local
server above.)

## Controls

| Input | Action |
| --- | --- |
| Click the screen | Start / resume (captures the mouse) |
| Mouse | Look around |
| W A S D | Move |
| Space | Jump (a small hop) |
| Shift | Crouch: lowers your view so you can duck behind the railings and cab walls, and you get shoved around less when hit |
| W while facing a ladder | Climb up (S to climb down, Space to let go) |
| Left mouse | Use the item in your hands. **Bow:** hold to draw (full draw in about half a second), release to shoot. **Hook:** click to fire |
| Right mouse | Interact: pull out arrows within reach, talk to the conductor, climb back aboard at a stop. While drawing the bow it lets the string down instead |
| Mouse wheel (or 1 / 2) | Switch between the bow and the grappling hook |
| Esc | Pause |

## What's in this prototype

- **Endless train ride.** Desert ground, cacti, rocks, mesas and telegraph
  poles are built ahead of you and cleared away behind, so the land never
  runs out.
- **The conductor drives.** An old engineer rides in the cab. He drives the
  train and shovels coal into the firebox (watch it flare up). You never
  touch the throttle or the fuel. He starts at ~34 mph and opens her up a
  little more every mile, but the train can never go faster than
  **200 mph**. Walk up to him and right-click to chat (he'll tell you the
  speed and the next stop).
- **The train.** A steam locomotive with a cowcatcher, big box headlamp, brass
  bands and domes, a balloon smokestack with smoke, a riveted cab, six
  cylinders and a steam-turbine casing. Connecting rods visibly drive the big
  red driving wheels. Behind it are a coal tender, a boxcar (now with a roof
  railing to hide behind) and a flatcar.
- **Riding on it.** You start on the flatcar at the back. You can walk the
  whole train, climb the ladders onto the boxcar roof, drop onto the coal
  tender, get into the cab, and walk the running boards beside the boiler up
  to the front.
- **Bow and arrow.** Arrows fly at real-life speed (up to about 64 m/s) with
  real gravity, and keep the train's speed. No aim assist. Right-click arrows
  stuck in the train (or in the dirt) to pull them back into your quiver (up
  to 30).
- **Getting hit.** An arrow does damage *and* staggers you: a shove plus a
  jolt to your view. Crouching cuts the stagger roughly in half. A strong
  enough hit while you're on a roof (boxcar, cab, tender) or standing near
  the edge can **knock you clean off the train**, over the railings.
- **Grappling hook: the clutch save.** If you're knocked off, scroll to the
  hook straight away and fire it at the train. The crosshair turns into a
  ring that lights up gold when the hook would bite. If it connects, it reels
  you back aboard. You've got a few seconds while you're in the air and
  skidding through the dirt before the train is out of range (26 m). A miss
  comes back and you can fire again if the train's still close. (You can
  also use the hook to haul yourself around the train.)
- **Left behind.** If you miss, the train does **not** stop. The conductor
  carries on to the next stop on the line and waits there for you. Walk up
  the tracks (bandits will come for you on foot) and right-click next to the
  train to climb aboard. Once you're on, he blows the whistle and pulls out.
- **Stops.** Real towns aren't built yet, so there are placeholder stops
  every 450 m: a wooden platform, a depot shack, a water tower and a name
  board. The train rolls straight through them unless it's waiting for you.
- **Bandits.** Riders gallop up beside the train (or beside you, if you're on
  foot) and shoot arrows at you. More of them show up as you knock them down.
  Each has four hit zones:
  - **Rider's head:** instant kill, a big gold "HEADSHOT!" and a ding.
  - **Rider's body:** two hits kill him, and any hit may knock him off his horse.
  - **Horse's head:** kills the horse and throws the rider.
  - **Horse's body:** two hits bring the horse down; a hit may make it buck the rider off.
- **Health.** You have a health bar at the bottom left. It refills very
  slowly once you haven't been hit for a few seconds. Head hits hurt a lot
  more than body hits, and hitting the dirt after being thrown off hurts a
  little. **The run only ends when your health reaches zero.** Falling off
  the train no longer kills you.

## Tweaking the game

Almost every number (train speed and top speed, stop spacing, walk speed,
stagger and knock-off strength, grapple range, arrow speed, draw time,
damage, bandit accuracy, health regen and so on) is in [`src/config.js`](src/config.js),
with notes. Change a number, save, and refresh the browser.

## How the code is organised

```
index.html            page + on-screen display
style.css             look of the on-screen display
start.command         double-click launcher (Mac)
src/
  main.js             starts everything and runs the game loop
  config.js           all the tunable numbers
  core/               input, maths helpers, shared materials
  world/              sky, endless terrain, smoke, placeholder stops
  train/train.js      the train model, its moving parts and walkable surfaces
  train/conductor.js  the conductor: drives, stokes the fire, stops for you
  player/player.js    walking, crouching, jumping, ladders, stagger,
                      being knocked off, being reeled in, health
  items/inventory.js  switching items, and the item you see in your hands
  items/grapple.js    the grappling hook
  combat/bow.js       drawing and shooting, and the bow model
  combat/arrows.js    arrow flight, hits, sticking, and picking them up
  enemies/bandits.js  horse riders: riding, shooting, hit zones, falling off
  ui/hud.js           health, arrows, hit markers, messages
  audio/sound.js      all sounds (generated in code, no audio files)
```

For testing, open the game with `?debug` on the end of the address
(`http://localhost:8123/?debug`). That gives the browser console access to
the game (`game`, `startGame()`, `step(frames)`).

## Not in this prototype (planned for later)

Real towns and regions (the stops are placeholders), folklore monsters and
bosses, the day-night cycle and dangerous nights, AI companions, steam
boost, curves in the track.
