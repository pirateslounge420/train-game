// All the tunable numbers for the game live here, so balance tweaks
// never require digging through the rest of the code.
// Units: metres, seconds, metres-per-second.

export const CONFIG = {
  gravity: 9.81,

  train: {
    speed: 15, // m/s (~34 mph) – a horse at full gallop can just outrun it
  },

  view: {
    fov: 72, // landscape screens (as in the reference build)
    portraitFov: 84, // phones held upright see a little wider
    drawZoom: 7, // degrees the view narrows at full draw (§U)
    mouseSensitivity: 0.0022,
  },

  player: {
    walkSpeed: 3.2,
    sprintSpeed: 5.6,
    jumpSpeed: 5.0, // ~1.27 m jump height
    climbSpeed: 2.4,
    radius: 0.25,
    height: 1.75,
    eyeHeight: 1.62,
    stepHeight: 0.4,
    maxHealth: 100,
    regenPerSecond: 0.35, // very slow
    regenDelay: 4, // seconds after being hit before regen resumes
    startArrows: 20,
    maxArrows: 40,
    pickupRadius: 1.4,
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

  enemies: {
    startCount: 2,
    maxCount: 4,
    arrowSpeed: 50, // m/s
    aimErrorDegrees: 3.5, // their natural inaccuracy
    shootIntervalMin: 5,
    shootIntervalMax: 8,
    shootRange: 45,
    maxExtraSpeed: 7, // how much faster than the train a horse can gallop
    riderHealth: 100,
    horseHealth: 100,
  },

  damage: {
    // player arrows -> bandits
    riderBody: 55,
    horseBody: 50,
    knockOffChance: 0.35, // a body hit that doesn't kill may still unseat him
    buckOffChance: 0.35, // a horse hit that doesn't kill may throw the rider
    // bandit arrows -> player
    playerBody: 10,
    playerHead: 40,
  },
};
