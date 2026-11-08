# The Train Game — design

Locked decisions only. Each section has a letter so prompts, commits and progress entries can point at it. Newest at the bottom. Where a section says "as in the reference build", the numbers live in `reference/train-game-prototype-<version>.html` (Claude chat's playable build); port them, don't guess. Where two sections disagree, the later one wins.

Status key: **built (ref)** = in the reference build; **built (repo)** = in `src/`; **not built**.

## §A. What the game is
- Rail shooter, first person, 3D: an alternate post-apocalyptic timeline where the Wild West meets future tech (§V). Frontier engineers run ~1000 psi boilers; the engine is a six-cylinder piston engine with visible rods plus a steam turbine (with the turbine engaged it can reach ~300 mph, but takes a while to get there).
- Arcade "how far can you get": ride the line through changing country; towns between regions; cruise speed steps up each region; infinite, no ending. Landscapes keep changing, never loop.
- Everybody uses bows and arrows. Threats later: bandits, folklore beasts per region, a boss creature in the deepest wilderness between towns, environmental hazards. Day-night cycle (144-minute day), night more dangerous. Possibly a recruit per town (AI companion you don't control). None of the "later" items are built.

## §B. Archery (built ref 0.5)
- Hold to draw, release to loose. Full draw in 0.7 s. Draw again immediately after a shot (Minecraft feel), no nocking delay.
- Precision is the game: no aim assist, no arc preview. Headshots and other precise hits are rewarded.
- Arrow physics are real: gravity, air drag tiny, arrows inherit the train's velocity. The arc is visible.
- **Speed (0.5):** snap shot 45 m/s (100 mph), full draw 80 m/s (180 mph).
- **Zeroed sight (0.5):** the arrow leaves slightly nose-up so it lands on the crosshair at 15 m (snap) to 35 m (full draw); beyond that it drops. Formula and numbers in the reference build's `fire()`.
- Every arrow draws a comet-tail trail: pale blue-white for yours, orange-red for theirs.
- Arrows are limited (start 20, cap 40). Arrows that stick in your cars (yours or theirs) can be pulled out and reused. Towns give +12.
- Crosshair: a thin cross with an open centre; a brief X flashes through it on any hit, brighter (brass) for headshots, neck shots and hat shots.

## §C. The player on the train (built ref)
- First person. Health bar with very slow regen; the bar only shows when you're hit, or in the stats panel.
- You walk the train: caboose roof (low rail all round, gate at the front), rear platform (waist-high rail), cabin (three open windows a side, doors front and rear), ladder on the rear wall; forward across the hat car roof to the tender.
- Ladders: face them and push forward to climb, pull back to come down.
- Walk speed as in the reference build; Jump (Space / button).
- Phone controls: left stick walks, drag the view to look, hold Draw and drag the same finger to aim, Jump, Surge, Grab, tap a stuck arrow. Desktop: WASD, mouse look with pointer lock, left click draws, right click / E grabs, Space jumps, Shift surges, Tab holds the stats.

## §D. The train (built ref)
- Rear to front: **caboose** (player's home car), **hat car** (§H), **tender** (coal deck, side boards), **locomotive** (boiler, brass bands, stack, headlamp, cab, six cylinders implied, rods on the drivers).
- Each car rides its own point on the track (§F), so the train bends through curves.
- Steam surge: a stored-steam burst (+22 m/s for 4.5 s) that leaves riders behind. **It does not refill on its own.** Shovel coal on the tender: three scoops fill it. Towns stoke it free. Mouse wheel / 1 / 2 swaps bow and shovel. The game is never engine management: the shovel is a run along the roofs while riders shoot at you, nothing more.

## §E. Riders (built ref 0.4)
- Little western dudes: hat drawn down, bandana up, the face a dark void. Exaggerated hats. Ponchos stream behind in the wind.
- Four gangs by poncho colour and pattern: green + yellow lightning, red + orange flames, blue + violet waves, indigo + magenta stars. The accent colour carries the pattern and the bandana; hats stay dark across all four.
- Horses run a four-beat rotary gallop: hind pair drives, front pair reaches, the body rocks and bobs with the stride. Two-segment legs.
- They flank the train, hold off at 9–23 m, shoot back (accuracy tightens by region), flee at tunnels and towns, and ride off when hit hard.

## §F. Hit zones and gore (built ref 0.4)
Priority order when an arrow clips more than one zone within 0.3 m:
1. **Hat** — the hardest shot in the game (a thin zone above the head). The hat spins off; the rider loses his nerve and bolts.
2. **Neck** — the head flies clean, high, spinning. Kill.
3. **Head** — the head pops with a burst of chunky gibs. Kill.
4. **Horse head** — horse down, rider thrown.
5. **Horse legs (four)** — the leg blows off; the horse cartwheels toward that leg; rider thrown.
6. **Rider body** — two hits knock him off.
7. **Horse body** — three hits bring it down.
Gore is theatrical and chunky, American McGee's Alice by way of Super Monkey Ball: pieces bounce and spin before they settle, then fade.

## §G. The line and the country (built ref 0.3)
- The track curves: radius 170–460 m, at most ~50° per curve, straight through towns and tunnels, heading kept roughly true so it never loops on itself. Sampled every 2 m; terrain and decorations are placed by distance to the line.
- Six regions cycle, each longer and faster than the last (cruise 15 m/s + 5 per region, cap 62): Prairie, Red Desert, High Pass, Pine Country, Salt Flats, Badlands. Towns at every region boundary (stop 6 s: rest, +12 arrows, boiler stoked).
- High Pass and Badlands have a tunnel: cliff portal, dark stone bore with lanterns, a mountain over the top. Riders peel off before it; none spawn in it.

## §H. Hats and the hat car (built ref 0.4)
- The first hat shot off each gang boomerangs up, back through the hat car's side hatch and lands on the rack inside. A gang you already have: the hat just tumbles off.
- The hat car is the second car. Inside: racks along both walls, open side hatches to shoot from, a roof hatch with a ladder at the back-left. You reach it through the caboose's front door or down that ladder.
- Stats count hats racked (out of the number of gangs) and hat shots.

## §I. HUD (built ref 0.4)
- Clean by default: crosshair, the buttons, and the speed. Speed is always on: big mph, small km/h, tap to swap (remembered).
- Hold Tab (desktop) or the Stats button (touch) for everything else: distance, country, arrows, riders down, headshots, hats, hat shots, best run.

## §J. The look (built ref 0.3)
From the Torchfire reference frames (Mike's twenty favourites; `docs/design/LOOK_REFERENCE.md` in the Torchfire repo):
- Dark but saturated. Cobalt sky (#0000C4 overhead to #2350F0 near the horizon) fading to a lighter blue haze (#4F98EF) in the distance: distance gets lighter and bluer, never darker.
- Shade goes navy, never grey: hemisphere light with a navy ground colour; the sun is the only light.
- Chunky textures, ~16 texels a metre, nearest-filtered, detail painted into the albedo; no normal maps, no specular. Clean low-poly silhouettes.
- Painted off-white clouds. A 480-line internal frame scaled up with no smoothing.
- One warm accent in the wild (lanterns, the headlamp, the firebox). Blood is the exception.

## §W. Co-op (direction, not built)
Couch split-screen, up to four on one train, after single-player is tight. From now on no system assumes one player: player state is per-player, the train and the world are shared.


## §K. Steam is your call (3 Nov, afternoon; supersedes §D's surge and refill) — built ref 0.6
- No shovel. Three surges a stretch, fired from the tender (Surge button / Q / F); the conductor never surges on his own. Towns restock the three.
- Each surge adds 26 m/s of boost on top of the last (6 m/s² to get there); the boost bleeds off at 1.5 m/s each second back to cruise. Cap 200 mph. Riders fall back once the boost passes 12 m/s. A two-tone horn sounds on each surge.
- Stretches between towns are 25 % longer (region length = cruise × 131 s).

## §L. Aim and bow (3 Nov; supersedes parts of §B) — built ref 0.6
- Draw: one second to full on the Torchfire / Minecraft curve, power = (t² + 2t) / 3; a draw under 0.1 looses nothing.
- The arrow leaves the bow in your hand (lower right, carried further right than before) and is aimed to meet the crosshair line at the zero distance, 15 m (snap) to 35 m (full draw), nose-up by the zero formula in `fire()`. The view zooms 16° at full draw; the bow rises toward the middle as it charges.
- Reticle smaller (52 px); hit X unchanged.
- Hit test runs in the rider's own frame (the arrow's path is shifted by the rider's movement that frame), hit spheres 1.2×. Arrows live 40 s so a high lob comes all the way down.

## §M. Movement — built ref 0.6
- Sprint: double-tap forward and hold (W, or the stick), ×1.45, +6° FOV. Not while drawing or crouched.
- Crossing between cars is continuous: you walk over the gap and change frames at its midpoint; no snap. Step heights (tender) ease over a few frames.

## §N. The locomotive — built ref 0.6
- Eight-foot drivers (radius 1.22 m), three of them, with a 1.1 m stroke and a longer main rod; the engine grew around them (boiler centre 3.6 m up, 8.2 m long; the cab floor at 2.5 m). Exhaust beats four to the driver turn at every speed, thinning to a roar past 16 a second.

## §O. Anatomy and gore (3 Nov; supersedes §F) — built ref 0.6
Horse and rider are trees of real parts with named joints. Every part is a hit sphere; a hit breaks that joint and the part flies with everything downstream, blood squirting from the stump, spin and launch scaled by the part's mass. Gibs bounce (restitution 0.5) and fade. The data lives in the reference build as `HORSE_RIG`, `RIDER_RIG` and `REACT`; Claude Code ports it as data (JSON), not as code. Priority: lower wins when an arrow clips several parts within 0.3 m.

| Part | Joint (parent) | Mass kg | Hit radius m | Priority | Hits | Reaction | Gibs |
|---|---|---|---|---|---|---|---|
| barrel | (root) | 160 | 0.5 | 13 | 3 | counts hits; then horse down | 6 |
| croup | barrel | 70 | 0.42 | 12 | 2 | counts hits; then horse down | 6 |
| tail | croup | 3 | 0.14 | 14 | 1 | limb flies off (no reaction) | 2 |
| neck1 | barrel | 26 | 0.24 | 5 | 1 | horse down, rider thrown | 9 |
| neck2 | neck1 | 18 | 0.22 | 4 | 1 | horse down, rider thrown | 9 |
| skull | neck2 | 12 | 0.28 | 3 | 1 | horse down, rider thrown | 10 |
| upperFL | barrel | 18 | 0.17 | 9 | 1 | limb flies off: horse cartwheels toward that leg, rider thrown | 8 |
| lowerFL | upperFL | 8 | 0.15 | 8 | 1 | limb flies off: horse cartwheels toward that leg, rider thrown | 6 |
| upperFR | barrel | 18 | 0.17 | 9 | 1 | limb flies off: horse cartwheels toward that leg, rider thrown | 8 |
| lowerFR | upperFR | 8 | 0.15 | 8 | 1 | limb flies off: horse cartwheels toward that leg, rider thrown | 6 |
| upperBL | croup | 20 | 0.17 | 9 | 1 | limb flies off: horse cartwheels toward that leg, rider thrown | 8 |
| lowerBL | upperBL | 8 | 0.15 | 8 | 1 | limb flies off: horse cartwheels toward that leg, rider thrown | 6 |
| upperBR | croup | 20 | 0.17 | 9 | 1 | limb flies off: horse cartwheels toward that leg, rider thrown | 8 |
| lowerBR | upperBR | 8 | 0.15 | 8 | 1 | limb flies off: horse cartwheels toward that leg, rider thrown | 6 |
| pelvis | barrel | 14 | 0.2 | 10 | 1 | kill: rider thrown off; GUT SHOT | 8 |
| torso | pelvis | 30 | 0.4 | 11 | 2 | counts hits; then rider off | 5 |
| neck | torso | 2 | 0.12 | 2 | 1 | kill: head flies clean, high; NECK SHOT | 14 |
| head | neck | 5 | 0.16 | 1 | 1 | kill: head pops; HEADSHOT | 18 |
| hat | head | 0.5 | 0.14 | 0 | 1 | hat shot: hat spins off (first of a gang boomerangs to the rack); rider bolts | - |
| upperArmL | torso | 4 | 0.12 | 6 | 1 | limb flies off: rider drops the bow, bolts | 6 |
| lowerArmL | upperArmL | 3 | 0.11 | 6 | 1 | limb flies off: rider drops the bow, bolts | 5 |
| upperArmR | torso | 4 | 0.12 | 6 | 1 | limb flies off: rider drops the bow, bolts | 6 |
| lowerArmR | upperArmR | 3 | 0.11 | 6 | 1 | limb flies off: rider drops the bow, bolts | 5 |
| upperLegL | pelvis | 10 | 0.14 | 7 | 1 | limb flies off: rider slumps, falls off in 0.9 s | 7 |
| lowerLegL | upperLegL | 5 | 0.12 | 7 | 1 | limb flies off: rider slumps, falls off in 0.9 s | 5 |
| upperLegR | pelvis | 10 | 0.14 | 7 | 1 | limb flies off: rider slumps, falls off in 0.9 s | 7 |
| lowerLegR | upperLegR | 5 | 0.12 | 7 | 1 | limb flies off: rider slumps, falls off in 0.9 s | 5 |

## §P. Asset standard (3 Nov)
- Name the technique, not the vibe: "a tree of rigid parts joined by hinges; a hit breaks the joint" beats "Fallout gore".
- Reference clips go in `references/` (never shipped); "match the timing and exaggeration of this clip" beats description.
- Data, not code: every rig, reaction and tunable in a table Mike can edit.
- Models are code-built (boxes, cylinders, painted textures) while the look wants that. When a thing needs more (a sculpted face, cloth), Claude Code writes a Blender script that builds, rigs and exports it as glTF.

## §Q. The look, amended (3 Nov, after seeing §J in play) — built ref 0.6
- Less low-poly: round things smooth-shaded with more sides (boiler 24, wheels 28, trees 10), terrain at 6 m cells, textures filtered with mipmaps and anisotropy, a 720-line frame with antialiasing. The palette, the navy shade and the cobalt sky stay.

## §R. Day and night, seed and climate (3 Nov; from Torchfire) — built ref 0.6
- Torchfire's 144-minute day. The sun crosses the sky; dusk goes violet with a warm band; night is one blue world (sky #050938, mist #153695), stars out, a moon opposite the sun, the headlamp lit ahead of the engine. Night is more dangerous: two more riders. A new run starts at 07:00. The stats panel shows the time; tapping it jumps three hours (for testing).
- Everything derives from a seed (shown in the stats; `?seed=N` in the address replays it): the line's curves, each chunk's decorations, each town. Biomes are no longer a fixed cycle: a temperature and a moisture drift along the line and each region takes the biome nearest its climate (Whittaker-style), never the same as the last.

## §S. From the parallel session's 0.6 (built ref 0.6; Mike to confirm each)
A second chat built these into the same artifact on 3 Nov and they are kept in the merge: a conductor in the cab who drives and feeds the fire (talk to him from the front of the tender); crouch (Shift / button) behind plank parapets on the roofs; hits shove you and a hard hit up top throws you off the train; on foot you can fire a grappling hook (item 2) to reel back aboard, or walk to the water stop or town where the conductor waits; a camera jolt on hits. None of these are locked by Mike in this doc yet.

## §T. Hats you can wear (3 Nov) — built ref 0.6
- A racked hat keeps the arrow that took it. In the hat car, look at a hat and press Grab (or tap it) to wear it: a brim at the top of your view. Grab again pulls the arrow out of it. Wearing another swaps them back to their pegs.

## §U. The bow, snappier; hitboxes that are the man; dismounted riders (3 Nov, evening; amends §L, §E, §O) — built ref 0.7
- **Bow.** The draw curve and timing stay (§L). What changes is everything that made it feel heavy: the zoom at full draw is 7°, not 16°; the look no longer slows while drawing; the bow kicks on release (a short forward jump that settles over a few frames) and the next draw starts the moment the button is pressed again. Minecraft is the reference: fast, light, re-nock at once.
- **Hitboxes are the painted parts.** An arrow now tests against each part's own boxes (the ones you see), in the part's frame, padded 7 cm on bodies, 9 cm on arms and legs, 3 cm on the hat crown. No more spheres with gaps between them. The hat's hit zone is the crown only, not the brim, so a hat shot stays the hard shot. Test numbers in the simulator (full-draw arrows at galloping riders with perfect lead): about 7 in 10 land on the torso, 2 in 3 on the head, 5 in 6 on a leg; the misses are riders changing speed in the third of a second the arrow is in the air. Aim assist is not in; it is a question for Mike.
- **The tail is a thread.** Trail width 3 cm at the arrow, fading to 4 mm, 12 segments, dimmer. The arrow should look as thin as its hitbox.
- **Dismounted riders get up.** A man knocked out of the saddle who still has his head, his hips and both legs is not dead: he lies where he lands for one to two seconds, gets up, and runs at the train (7.5 m/s), firing two or three wild hail-mary shots on the run (his aim 1.7× worse than mounted), then turns and runs for it when his quiver is empty. Any hit finishes him (FINISHED, or the part's own label; a popped head still counts as a headshot). He counts as a kill only when finished; a man who runs out of range got away. Survivable: a torso knock-off (two torso hits), being thrown when the horse goes down. Fatal: head, neck, gut, or a fall after losing a leg.
- **Two 0.6 bugs fixed, found by the simulator:** hat shots never registered in 0.6 (the flag that says a rider is wearing a hat was never set), and a hat shot would have thrown an error every frame had it registered. Both fixed; hats fly to the rack again. Also: riders who fled kept pace with the train 95 m out and blocked new riders from spawning; a rider who has fled 80 m out is now gone.

## §V. Steampunk cyborg frontier (3 Nov; Mike, locked; replaces §A's old setting; amends §E, §J, §Q) — not built
**Setting.** An alternate post-apocalyptic timeline where the Wild West meets future tech. A high-tech civilisation collapsed long ago. Frontier life rebuilt itself on top of the ruins, using scavenged old-world tech alongside steam.

**The look, for the whole game: steampunk cyborg frontier.**
- Brass and bronze mechanical parts, rivets, gears, exposed pistons, goggles.
- Clockwork / cyborg horses and riders with scavenged prosthetics bolted onto Western gear: cowboy hats, ponchos, bandanas, leather straps, quivers.
- The cyborg horses are what explain the riders' unnatural speed (Mike, 3 Nov).
- A signature glowing green energy (salvaged old-world power) pulses through cracks, veins and seams in machines, cyborg parts and weapons. It is the accent colour against warm desert tones.
- Bows stay the weapon for everyone, now with mechanical limbs, brass fittings and glowing accents.
- The train is half salvage, half frontier engineering: the six-cylinder rods and turbine stay, now with brass plating, glowing seams and patched old-world tech.
- Ruins of the old world appear across regions: half-buried towers, rusted machinery, broken highways, overgrown tech.

**Keep.** The Torchfire palette and lighting approach, the higher-poly textured look, first person 3D. Pixel art stays for the wanted-poster portraits only.

**Everything else stays.** All existing regions, enemies and systems stay, re-skinned to fit the new setting (skeletal cyborg riders in the ghost town, a post-apocalyptic jungle tribe, and so on). This direction changes no gameplay system.

**Reference image.** A brass clockwork horse with green glowing cracks; a rider in goggles, green bandana, green lightning-pattern poncho, brown cowboy hat and brass gauntlets, with a matching mechanical bow.

**What this overrides.** §E: goggles replace the dark void face, and the reference rider's hat is brown, where §E keeps hats dark. §J: green energy joins the warm accents, where §J allowed one warm accent in the wild. §A and §J's "low-poly" gives way to the higher-poly textured look (§Q).

**Open (for Mike and Claude chat).**
- The ghost town, the jungle tribe and the wanted posters are named above but are not designed anywhere in this doc yet.
- The visible six cylinders and the turbine are not on the current engine: reference 0.7, ported to `src/` under §N, has neither.
- This is not yet in the §Z queue.

## §X. The cyborg player: cam bow, magnet hands, fists, Derringer, losing parts (3 Nov, late afternoon voice session; Mike, locked; amends §B, §C, §D, §K, §S, §U) — not built
**Design rule for everything.** Nothing goes on the game just because it looks cool. Every part of every design has a job, and if it has no job it comes off (Mike).

**Arrows that pass through riders (top priority).** Mike still sees arrows go through riders that should have hit. Likely cause: tunnelling (an arrow moves 1–2 m a frame and skips past a thin box between frames). Rule: an arrow hits anything its path crossed during the frame, whatever the frame rate. Faster arrows below make this worse, so it is fixed first.

**The cam bow.** Both bows are compound bows: an off-centre wheel (cam) at each limb tip with cables crossing behind the string. Cams only: no spring, no wind-up drum, no gears for show. What the cams do, and why they're there:
- The draw is heavy early, then "lets off" near the end, so holding at full draw is easy and steady (a sniper's hold). A hard stop at full draw ("the wall") makes every full draw the same length.
- They store more energy than a plain bow at the same pull, so the arrow leaves much faster.
- **Speeds.** Short cam bow (the one you start with): about 250 mph (112 m/s) at full draw. Longbow (a long cam bow, a shop upgrade later): 400+ mph (179 m/s). Claude's proposal for the snap shot: keep today's snap-to-full ratio (45 : 80), so the short bow snaps at about 63 m/s. Mike to confirm.
- Why it matters on a moving train: an arrow keeps the train's speed (§B). At 100 mph the old 135 mph bow sent a shot out the back at only ~35 mph over the ground, floating and dropping. At 250 mph it still leaves at 150; forward shots fly almost flat.
- Open: the zero distances (15–35 m, §L) were set for the old speeds; re-tune once the new speeds are in. The draw stays about a second (§L); whether the cam "hump then let-off" shows in the draw curve or the animation is open.

**The body.** The player is a cyborg.
- **Hands float.** Your hands are mechanical and held by magnet/electric tech, not attached to your arms; that's why they hover. Three fingers and a thumb (the classic archer's three-finger draw; fewer joints to break; reads as a machine). You see them in first person. Idle: fingers flex, a slight hover bob.
- **Legs and feet are attached** (mechanical, not floating): legs carry your weight every step, so magnets there would make no sense.
- **Parts can be blown off:** a hand, a foot, the head, the torso.
  - Lose a hand: you can't use two-handed items (the bow); the Derringer still works.
  - Lose a foot: you limp. Two-handed items only while standing still; one-handed items while limping.
  - Lose the head or torso: dead.
  - A lost hand or foot is fixed by a mechanic in the next town.
- **Crits come from where the hit lands, not dice.** It is much easier for you to crit an enemy than for an enemy to crit you: enemy aim lands on the body and limbs far more often than the head.
- Open: how many hits each part takes before it goes, and how parts relate to the health bar (§C).

**The magnet hand replaces the grappling hook (§S's hook is dropped).**
- Right click (or Grab) fires your hand out on a crackling electric tether and it comes back. **Tap** = a quick short grab. **Hold** = charge it to fly further.
- It picks things up (arrows stuck in the side of the train, out of reach from the windows today), snatches a rider's hat, catches a bomb (§Y).
- Feel: a big elastic spring. At full stretch it hangs for a moment, then snaps back. That hang is a timing window: throw early and let things drift into the open hand.
- Knocked off the train: fire the hand at the train, it clamps on and you're dragged behind; reel yourself back in. Drag physics to be worked out. Miss, and you're left behind on foot; the train waits at the next town.

**Fists.** An item on the mouse wheel. Left click punches. Tap = a close jab; hold = the fist launches further (rocket punch on the same spring as above). Punches do less damage than an arrow. Punching is how you knock a bomb back (§Y), and the bomb goes where you aim.

**The Derringer.** A one-handed sidearm with one or two shots. Pretty overpowered: a huge bullet that goes through a rider and hits whoever's behind him. It is your lifeline when you've lost a hand or a foot. Open: reload and ammo.

**Controls (desktop).** Mouse wheel cycles bow, fists, Derringer (the shovel is gone). Left click: hold to charge the item in hand, release to fire. Right click: tap to grab, hold to charge the hand. Each button cancels the other's charge: tap right click to cancel a draw; click left to cancel a hand charge. WASD, Space jumps, Shift crouches. Phone layout to match.

**Ammo.** Not infinite. Towns refill you to 15 arrows; picking arrows back up off enemies and the train is made much easier (the hand).

**Co-op (§W).** If you lose your head, a friend can carry it; at the next town your brain goes into a new body. Until then you watch your friend in third person.

## §Y. The train under fire: surges, brakes, the rival train, bombs, gangs that pile up (3 Nov, late afternoon; Mike, locked; amends §D, §E, §K) — not built
**Surges.** Two a stretch, not three (§K): fire both together for a double boost, or save one. Towns restock them.

**Speed you can feel.** On a curve at high speed, above all mid-surge, the train banks into the curve with sparks flying off the wheels. Coming into a town too fast, the conductor slams on the brakes and the train screeches to a halt (sound, sparks, the view pitching forward).

**Car health.** Each car has its own health bar. Only bombs damage the train; arrows don't. Every town repairs damaged cars, but a destroyed car is gone for the rest of the run (lose the hat car and its trophies go with it; lose the caboose and its platform). Destroyed engine = run over. Later: cars that derail.

**The rival train.** From the second or third town, an enemy train runs on a second line roughly parallel to yours and tries to hold your speed. Its cars take bomb damage the same way; you can knock bombs into it.

**Bombs (later in a run).** Enemies lob bombs at the train.
- Catch it with the hand (right click) and throw it back: the safe, slower return. Or punch it (fists): faster, aimed where you look.
- Enemies can return it too. Each return makes it faster and charges it (Mario Strikers Charged): it glows brighter and crackles more, so you can read the danger at a glance.
- No fuse. It goes off when someone misses it, harder the longer the rally.

**Boarding and the horse ferry.** A rider jumps aboard your train; his horse rides off to a camp and comes back with another rider. Killing the horse stops the ferry. Open: whether the camps are visible from the line (so you can pick off the waiting men early).

**The gangs pile up.** Like Black Ops Zombies: riders you don't kill in a stretch follow you into the next, so the stretches get harder until you can't hold out.

**Stretches between towns are 100 % longer than the original** (Mike, 3 Nov; supersedes §K's 25 %): region length = cruise × 210 s (was × 131 s; the original was × 105 s).

## §AA. Ponchos are cloth; the magnet hand, playable (3 Nov, evening; Mike: ponchos locked; the hand's numbers are Claude's, Mike to confirm in play; amends §E, §X, §S) — built ref 0.8
**Ponchos are cloth (Mike: "we can use that recipe").** The recipe is Torchfire's cloaked figure (its cloak sim, `player_body.gd`), cut down for a rider:
- A 6 × 7 grid of points hanging from the shoulders down his back (0.54 m wide at the top, 0.70 at the hem, 0.82 m long). The top row is pinned to the torso.
- The rest move by Verlet steps (sub-steps of about 12 ms) under:
  - gravity;
  - the rider's own acceleration, felt backwards, so it swings as he starts, stops and turns;
  - drag against the air rushing past (his speed against a slow wind), so it streams out behind at a gallop;
  - a flutter that grows with that air speed;
  - a soft pull back to its drape, so it settles when he stands.
- Links across, down and diagonally: stretch is hard, squash is soft, so it can bunch. It collides with his back and the horse's back: standing, it lies over the horse's rump.
- It is simulated in the torso's own space, so it rides with him, falls with him when he's knocked off, streams behind a dismounted rider running, and keeps flapping on a body that's been shot off.
- Same gang pattern as before, drawn on both sides. It replaces the old single tilting board.
- Job (§X rule): it shows speed and motion at a glance, and which way a rider is turning before his horse does.
- Starting numbers in `PON` in the reference.

**The magnet hand, as built in reference 0.8 (§X).** The rules are §X's. What the build adds, all first guesses:
- **Reach.** A tap grabs out to 7 m. Hold to charge: after 0.18 s it charges over 0.75 s to 26 m (the old hook's reach). The grab targets whatever is nearest the crosshair line, with a cone that widens with distance.
- **The spring.**
  - Out at about 58 m/s, slowing as it stretches.
  - A miss hangs 0.24 s at full stretch, with an overshoot and the fingers open; anything within 0.75 m is caught.
  - Then it snaps back, speeding up, at about 75 m/s.
  - 0.25 s before the next launch.
- **What it takes:**
  - Arrows stuck in the cars, inside or **outside**: arrows in the outside walls are now kept and can be fetched, which fixes "impossible to retrieve".
  - Arrows lying on the ground.
  - Riders' hats. A snatched hat spooks the rider into fleeing. A new gang's hat goes up to the rack; one you already have goes on your head.
- **Walls.** The hand can't pass through a car. If the straight line is blocked, it tries an arc up and over (the roof's edge board, a window sill) and flies that arc. So from the roof's edge you can lean over and pick arrows off the outside wall; from the middle of the roof you can't.
- **Thrown off.** Fire the hand at any car. It clamps on and you're dragged along behind on the tether, bouncing in the dirt, reeling in at 9 m/s and hauled up for the last few metres, then put aboard. The old §S hook is gone from the build.
- **The look.** Three fingers and a thumb, iron and brass, a glowing magnet core on the back of the wrist. The left hand holds the bow at the riser; the right hooks the string, and it's the one that flies. Item 2 puts the bow away and shows both hands floating. Idle, the fingers flex and the hands bob. The tether is a jagged electric arc, and the flying hand has a glow so you can follow it 20 m out.
- **Controls.** Right click / Grab / E: tap or hold. Tapping Grab mid-draw cancels the draw; clicking Draw mid-charge cancels the charge (§X). Close up, a tap still wears a racked hat, talks to the conductor and climbs a stopped train. On a phone, a quick tap on something in view sends the hand to it. Item 2's left click says fists come next.
- **Open for Mike:** the reach, the spring's timing, whether a snatched hat you already own should go on your head or just drop, and whether the hand should ever hit a rider (it doesn't).

## §AB. No tunnels for now; the fists are on chains (7 Nov; Mike, locked; amends §F, §X, §AA) — built ref 0.9
- **Tunnels are off for now** (Mike). The code stays behind one switch (`TUNNELS=false` in the reference); tunnel biomes play as open country. Back when Mike says.
- **Chained fists, not magnet hands.** Your hands are grappling fists on chains: the chain runs from a cuff on the wrist back into the forearm, and the first links always show. No magnet core, no electric arc, no glow. The fist flies out on its chain and the chain pays out behind it (a link every 4 cm, sagging with its length, rattling as it runs); it clamps, carries and reels exactly as §AA's hand did, so the grab mechanics, the reach, the spring and the thrown-off tether are unchanged. §X's "hands float on magnets" is replaced: they hang on their chains.
- Still the right fist only. Item 2 ("Fists") shows both; the left fist firing, and whether a fist can hit a rider, are next and Mike's call.

## §AC. The fist is lobbed, and it's heavy (8 Nov; Mike, locked; amends §AA, §AB) — built ref 0.10
- **Why.** Hats were far too easy to take: the fist homed onto whatever was nearest the crosshair. Now it is thrown.
- **The lob.** On the train the fist leaves at 13 m/s (tap) to 28 m/s (full charge) along your aim, keeps the train's speed the way an arrow does, and falls under 1.4× gravity (it is iron). It takes only what it passes within 0.42 m of: a hat, an arrow, a racked arrow in a wall. Lead the rider, judge the arc. It stops at a car wall, on the ground, or at the end of its chain (7–26 m), hangs a beat, then is hauled back.
- **Heavy.** A kick and a camera jolt on the throw that grow with the charge; a thud where it lands; hauled home at a steady 14 m/s on the chain (not the old elastic snap), sagging more; half a second before the next throw. The old spring reach rules (§AA) no longer apply on the train.
- **Off the train** the fist still flies straight to a car and latches (§AA): that's a rescue, not a trick shot.
- Open: the catch radius (0.42 m), the gravity (1.4×), whether a fist that passes a rider's head should knock him.

## §Z. The queue (order of work for Claude Code)
0. **Next, before the rest of item 1 (3 Nov, late afternoon):** fix arrows passing through riders (§X), then the cam bow's speeds (§X), two surges a stretch (§Y), stretches 100 % longer (§Y), and towns refilling to 15 arrows (§X). Small, and it's the core feel.
1. Port the reference build's feel into `src/`, feature by feature, keeping the repo's module layout: §B/§L/§U archery and hitboxes, §C/§M walking and phone controls, §G/§R the seeded line, climate biomes and the day, §D/§K/§N the four cars, the engine and the surge, §E/§O/§U riders, dismounted riders and gore (as data), §H/§T hats, §I HUD, §J/§Q look, §S the conductor, crouch, knock-off and hook. Stop and explain after each.
2. Deploy to GitHub Pages on every push to `main`, so Mike plays from a link on his phone.
3. The first town stop: get off, walk one street, a store that restocks arrows.
4. Trophies persist: the hat rack keeps its hats across runs.
5. Co-op (§W).
6. The cyborg player (§X, §AA): floating hands in view, the magnet-hand grab and launch (port from reference 0.8), fists, the Derringer, the cam bow model, losing parts. Replaces §S's hook.
6a. Poncho cloth on every rider (§AA): port `makePoncho`/`stepPoncho` from reference 0.8. Small and independent of 6; can go any time.
7. The train under fire (§Y): car health, banking and sparks on curves, the conductor's hard brake, boarding and the horse ferry, gangs that pile up, the rival train, bombs and the rally.

(3 Nov, Mike: "No shovel, cut §Z.3." The cab-and-firebox coal run is gone with the shovel, per §K; the old items 4–6 moved up.)
