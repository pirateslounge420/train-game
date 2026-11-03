// All the tunable numbers for the game live here, so balance tweaks
// never require digging through the rest of the code.
// Units: metres, seconds, metres-per-second.

export const CONFIG = {
  gravity: 9.81,

  train: {
    speed: 15, // m/s (~34 mph) – a horse at full gallop can just outrun it
  },

  view: {
    fov: 75,
    drawFov: 64, // camera zooms in slightly at full draw
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
    startArrows: 15,
    maxArrows: 30,
    pickupRadius: 1.4,
  },

  bow: {
    fullDrawTime: 0.55, // seconds to reach full draw
    minSpeed: 18, // m/s – a barely-drawn bow
    maxSpeed: 64, // m/s (~210 ft/s) – a real hunting recurve at full draw
    reloadTime: 0.45, // nocking the next arrow
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
