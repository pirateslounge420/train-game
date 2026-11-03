// All the tunable numbers for the game live here, so balance tweaks
// never require digging through the rest of the code.
// Units: metres, seconds, metres-per-second.

export const CONFIG = {
  gravity: 9.81,

  // The train's speed comes from the region it's in (15 m/s, +5 a region,
  // up to 62), set in src/world/line.js with the rest of the line (§G).

  view: {
    fov: 72, // landscape screens (as in the reference build)
    portraitFov: 84, // phones held upright see a little wider
    drawZoom: 7, // degrees the view narrows at full draw (§U)
    lookSensitivity: 0.22, // degrees per pixel, mouse and finger alike
  },

  player: {
    // Walking, as in reference 0.7 (§C, §M).
    walkSpeed: 4.8, // m/s on a floor or deck
    roofSpeed: 4.1, // m/s up on a roof
    tenderSpeed: 3.2, // m/s on the tender's coal
    roofHeight: 4.0, // feet above this (train space) count as "on a roof"
    drawSlow: 0.55, // walking speed while the bow is drawn
    sprintBoost: 1.45, // double-tap forward and hold
    sprintFov: 6, // degrees the view widens while sprinting
    jumpSpeed: 4.6, // ~0.76 m jump height
    gravity: 14, // the player falls faster than an arrow, as in the reference
    climbSpeed: 1.9,
    maxPitch: 1.35, // radians you can look up or down
    radius: 0.25,
    height: 1.75,
    eyeHeight: 1.62,
    stepHeight: 0.65, // steps up this high on their own (tender to hat car roof, §M)
    maxHealth: 100,
    regenPerSecond: 0.35, // very slow
    regenDelay: 4, // seconds after being hit before regen resumes
    startArrows: 20,
    maxArrows: 40,
    grabReach: 3.4, // metres from your eyes to a stuck arrow you can grab
  },

  // Archery, ported from reference build 0.7 (§B, §L, §U).
  bow: {
    fullDrawTime: 1.0, // seconds to full draw; power follows (t² + 2t) / 3
    minPower: 0.1, // a draw weaker than this looses nothing
    snapSpeed: 45, // m/s (100 mph) for a snap shot...
    fullSpeed: 80, // ...up to 80 m/s (180 mph) at full draw
    zeroSnap: 15, // the arrow meets the crosshair at 15 m for a snap shot...
    zeroFull: 35, // ...and at 35 m at full draw; beyond that it drops
    drag: 0.0005, // tiny air drag
    life: 40, // seconds an arrow can stay in the air (high lobs come down)
    groundTime: 5, // seconds an arrow stays stuck in the ground
  },

  // Riders (§E, §O, §U). Their bodies, hit reactions and gangs are data in
  // src/enemies/rigs.json; how many come and how they ride is in riders.js,
  // as in reference 0.7.
  enemies: {
    arrowSpeed: 50, // m/s
  },

  damage: {
    // rider arrows -> you (reference 0.7)
    playerBody: 20,
    playerHead: 34,
  },
};
