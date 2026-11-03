// All the tunable numbers for the game live here, so balance tweaks
// never require digging through the rest of the code.
// Units: metres, seconds, metres-per-second (unless a name says mph).

export const MPH = 0.44704; // 1 mph in m/s

export const CONFIG = {
  gravity: 9.81,

  train: {
    // The conductor drives. He cruises at this speed and slowly opens the
    // throttle as the run goes on, but never past the top speed.
    startSpeedMph: 34, // ~15 m/s – a horse at full gallop can just outrun it
    speedUpMphPerMile: 3, // how much faster the cruise gets per mile ridden
    maxSpeedMph: 200, // hard cap on the train's speed
    accel: 1.2, // m/s² when the conductor opens the throttle
    brake: 2.5, // m/s² when stopping at a station
    stopSpacing: 450, // metres between (placeholder) stops along the line
    departDelay: 1.5, // seconds the train waits after you climb back on
  },

  view: {
    fov: 75,
    drawFov: 64, // camera zooms in slightly at full draw
    mouseSensitivity: 0.0022,
  },

  player: {
    walkSpeed: 3.8,
    crouchSpeedFactor: 0.5,
    jumpSpeed: 4.2, // ~0.9 m hop
    climbSpeed: 2.4,
    radius: 0.25,
    height: 1.75,
    eyeHeight: 1.62,
    crouchHeight: 1.0,
    crouchEyeHeight: 0.85, // low enough to hide behind the railings and cab walls
    stepHeight: 0.4,
    maxHealth: 100,
    regenPerSecond: 0.35, // very slow
    regenDelay: 4, // seconds after being hit before regen resumes
    startArrows: 15,
    maxArrows: 30,
    reach: 1.8, // how close you need to be to pull an arrow / talk / climb
    hardLandingSpeed: 7, // hitting the dirt faster than this hurts
    hardLandingDamage: 8,
  },

  stagger: {
    push: 3.0, // m/s shove from a full-strength hit
    bodyStrength: 0.7, // relative hit strength of a body hit (head = 1)
    crouchFactor: 0.45, // crouching scales the strength by this
    knockOffThreshold: 0.8, // strength needed to knock you off the train
    knockOffSpeed: 6, // sideways m/s you're thrown with
  },

  grapple: {
    range: 26, // metres – miss the train by more than this and you're walking
    hookSpeed: 90, // m/s the hook flies
    reelSpeed: 22, // m/s you're hauled in
    cooldown: 0.45, // seconds before you can fire again after a miss
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
