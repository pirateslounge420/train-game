# Train Game — first prototype

> **Design and sync:** `docs/DESIGN.md` holds every locked decision, `docs/PROGRESS.md` the log, and `reference/` Claude chat's playable reference build (the spec for feel). `CLAUDE.md` says how the two Claudes share this repo.

A low-poly, first-person Wild West rail shooter that runs in the browser.
You ride a steam train along an endless, curving line through changing
country and fight off bandits on horseback with a bow and arrow.

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

The game works on a computer and on a phone. A phone (or any touch screen
without a mouse) gets on-screen controls automatically.

**Computer**

| Input | Action |
| --- | --- |
| Click the screen | Start / resume (captures the mouse) |
| Mouse | Look around |
| W A S D | Walk. Tap **W** twice quickly and hold it to sprint |
| Space | Jump |
| W while facing a ladder | Climb up (S to climb down, Space to let go) |
| Hold left mouse | Draw the bow: the longer you hold, the stronger the shot (full draw in one second) |
| Release left mouse | Shoot. You can start the next draw straight away. A very short tap shoots nothing. |
| Right mouse or E | Grab: pull out the stuck arrow you're looking at |
| Esc | Pause |

**Phone**

| Input | Action |
| --- | --- |
| Tap the screen | Start |
| Left stick | Walk. Tap it twice quickly and hold forward to sprint |
| Drag anywhere on the view | Look around |
| Hold **Draw** | Draw the bow; drag the same finger to aim; let go to shoot. It shows how many arrows you have |
| **Jump** | Jump |
| **Grab**, or tap a stuck arrow | Pull it out. Grab lights up when an arrow is in reach |

Walking speeds are the reference build's (design §C, §M): 4.8 m/s on a
floor, 4.1 m/s on a roof, a little over half that while the bow is drawn,
and ×1.45 when sprinting (the view widens a touch). You can't sprint while
drawing.

## What's in this prototype

- **The line and the country** (design §G, §R, ported from reference
  build 0.7). The track curves (bends of 170–460 m radius) and runs
  straight through towns and tunnels. It passes through six kinds of
  country: Prairie, Red Desert, High Pass, Pine Country, Salt Flats and
  Badlands. Each has its own ground colours, hills and scenery (trees,
  pines, cacti, rocks, bushes, mesas) and its own fog. Which country comes
  next follows a slow drift of temperature and moisture, never the same
  twice in a row. Each stretch is longer and faster than the last: 15 m/s
  (34 mph) to start, 5 m/s more each stretch, up to 62 m/s.
- **Towns.** Every stretch starts at a town (station, water tower,
  houses). The train brakes in, stops for 6 seconds and pulls out with a
  whistle. Stopping there heals you fully and gives you 12 arrows (up to
  40). Its name shows on screen.
- **Tunnels.** High Pass and Badlands each have one: a cliff portal, a dark
  stone bore with lanterns, and a mountain over the top. Riders peel off
  before a tunnel or a town, and none come while you're in one.
- **The day.** A day lasts 144 minutes, and a run starts at about 07:00.
  The sun crosses the sky. Dusk goes violet, and night is deep blue, with
  stars, a moon and the engine's headlamp lit. Night brings two extra
  riders.
- **The seed.** Every run's line, country and towns come from one number,
  shown on the stats line. Add `?seed=1234` to the address to ride the
  same line again.
- **The train** (design §D, §N, ported from reference build 0.7). From the
  back: the **caboose** (your home car), the **hat car**, the **tender** and
  the **locomotive**. The locomotive has eight-foot driving wheels, three a
  side, with side rods and main rods that follow them, a boiler with brass
  bands, a headlamp, and a cab open at the back with the firebox glowing.
  Its exhaust beats four times a turn of the drivers, thinning to a roar at
  speed, and its grey smoke streams back and fades.
- **Riding on it.** You start on the caboose roof. Each car follows the
  track on its own, so the train bends through curves. The caboose roof has
  a low plank edge and a rail all round, with a gate at the front onto the
  hat car's roof and a ladder at the back right down to the rear platform.
  From the platform a door leads into the caboose (three open windows a
  side), and its front door leads into the hat car. A ladder inside the hat
  car, at the back left, goes up through a hatch to its roof. Forward from
  the hat car's roof you step down onto the tender's coal, which is as far
  forward as you can go. Rails and edges keep you aboard. You move with the
  train.
- **The steam surge** (§K). Standing on the tender, press **Q** or **F**
  (or the **Surge** button on a phone). Each surge adds 26 m/s (58 mph) on
  top of the last, up to 200 mph, then bleeds back to cruising speed. Once
  you're going 12 m/s faster than cruise, the riders fall back. You get
  three a stretch, shown as dots on the stats line or the button, and each
  town restocks them.
- **Bow and arrow** (design §B, §L, §U, ported from reference build 0.7).
  A snap shot leaves at 45 m/s (100 mph) and a full draw at 80 m/s
  (180 mph). Real gravity and a tiny bit of air drag, so you can see the arc.
  Arrows keep the train's speed. The sight is "zeroed": the arrow leaves
  the bow in your hand and lands on the crosshair at 15 m (snap shot) to
  35 m (full draw); further than that it drops below. The view zooms in a
  little as you draw and the bow kicks when you let go. Every arrow leaves
  a thin trail: pale blue-white for yours, orange-red for theirs. No aim
  assist and no aiming line. You start with 20 arrows (up to 40), shown at
  the bottom right.
- **Riders** (design §E, §O, §U, ported from reference build 0.7). Four
  gangs, told apart by poncho: green with yellow lightning, red with orange
  flames, blue with violet waves, indigo with magenta stars. They flank the
  train 9 to 23 m out and shoot back, and their aim tightens each stretch.
  More come in later stretches and at night. Horse and rider are built from
  real parts, and the boxes you see are the hitboxes:
  - **Head or neck:** kill. The head flies off in a burst of chunks.
  - **Gut:** kill.
  - **Torso:** two hits knock him off.
  - **Arm:** it flies off; he drops his bow and bolts.
  - **Leg:** it flies off; he slumps and falls about a second later.
  - **Hat:** the hardest shot. It spins off and he bolts.
  - **Horse's head or neck:** the horse goes down and throws him.
  - **Horse's leg:** it flies off and the horse cartwheels.
  - **Horse's body:** three hits to the barrel or two to the rump bring it down.
- **Riders on foot.** A man thrown whole gets up after a second or two, runs
  at the train, fires two or three wild shots, then runs for it. Any hit
  finishes him. He only counts as downed if you finish him.
- **Health.** You have a health bar at the bottom left. It refills very
  slowly once you haven't been hit for a few seconds. Head hits hurt a lot
  more than body hits. Bandits aim where you're standing, so keep moving and
  use the walls and roof edges for cover.
- **Collecting arrows.** Bandit arrows (red feathers) and your own (white)
  that hit the train stay stuck in it. Get within reach (3.4 m, nothing in
  the way), look at one and Grab it to add it to your quiver (up to 40).

## Tweaking the game

Almost every number (arrow speed, draw time, damage, health regen and so on) is in [`src/config.js`](src/config.js),
with notes. Change a number, save, and refresh the browser.

## How the code is organised

```
index.html            page + on-screen display
style.css             look of the on-screen display
start.command         double-click launcher (Mac)
src/
  main.js             starts everything and runs the game loop
  config.js           all the tunable numbers
  core/               input (keys, mouse, touch), maths helpers, materials
  world/line.js       the seed, the curving line, regions, biomes, towns, tunnels
  world/              also: the sky and the day, the country along the line, smoke
  train/train.js      the train model, its moving parts and walkable surfaces
  player/player.js    walking, jumping, ladders, health
  combat/bow.js       drawing and shooting, and the bow you see in your hands
  combat/arrows.js    arrow flight, hits, sticking, and grabbing them back
  enemies/rigs.json   riders as data: body parts, hit reactions, gangs (edit freely)
  enemies/riders.js   riding, shooting, hits, gore, riders on foot
  ui/hud.js           health, arrows, hit markers, messages
  audio/sound.js      all sounds (generated in code, no audio files)
```

For testing, open the game with `?debug` on the end of the address
(`http://localhost:8123/?debug`). That gives the browser console access to
the game (`game`, `startGame()`, `step(frames)`, `setTime(hour)`).

## Not in this prototype (planned for later)

Getting off in towns, hats on the hat car's rack (§H), the conductor and
crouching (§S), folklore monsters and bosses, AI companions.
