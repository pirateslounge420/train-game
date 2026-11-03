import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Input, TOUCH } from './core/input.js';
import { Sky, DAY_LEN, START_TIME } from './world/sky.js';
import { SEED, TOWNS, biomeOf, biomeParams, regionStart, tunnelNear } from './world/line.js';
import { Terrain } from './world/terrain.js';
import { Smoke } from './world/smoke.js';
import { Train, SURGES } from './train/train.js';
import { Player } from './player/player.js';
import { Bow } from './combat/bow.js';
import { ArrowSystem } from './combat/arrows.js';
import { Riders } from './enemies/riders.js';
import { Hats } from './train/hats.js';
import { HitView } from './debug/hitview.js';

// The riders' bodies and hit reactions are data (§O, §P).
const RIGS = await (await fetch('src/enemies/rigs.json')).json();
import { Hud } from './ui/hud.js';
import { Sound } from './audio/sound.js';

// ---- renderer, scene, camera ----------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.autoClear = false;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(CONFIG.view.fov, innerWidth / innerHeight, 0.05, 3000);
camera.rotation.order = 'YXZ';
scene.add(camera); // so a hat you wear, hung on the camera, gets drawn
const sky = new Sky(scene);

// ---- game objects -----------------------------------------------------------
const input = new Input(renderer.domElement);
const sound = new Sound();
const hud = new Hud();
const train = new Train(scene);
const terrain = new Terrain(scene);
for (let i = 0; i < 14; i++) terrain.update(train.distance); // build the starting area all at once
const smoke = new Smoke(scene);
const player = new Player(train);

document.body.classList.toggle('touch', TOUCH);

// The day: a run starts at about 07:00 (§R).
let dayT = START_TIME;

// The engine's headlamp, lit at night (§R).
const headlamp = new THREE.SpotLight(0xffe2a0, 0, 140, 0.32, 0.5, 1);
headlamp.position.set(0, 4.75, -7.25 - 29.5);
headlamp.target.position.set(0, 1.5, -90 - 29.5);
train.loco.inner.add(headlamp, headlamp.target);

const game = {
  scene, camera, train, player, sound, hud, terrain,
  night: () => sky.cur.night,
  // Riders keep away from towns and tunnels (§G): none spawn when the train
  // isn't running, near a town or before a tunnel...
  ridersMaySpawn() {
    const s = train.distance;
    if (train.state !== 'run') return false;
    if (regionStart[train.nextTown] - s < 260 || s - regionStart[train.region] < 110) return false;
    return !tunnelNear(s + 300, 0) && !tunnelNear(s, 60);
  },
  // ...and those already out peel off before a tunnel or a stop. A surge
  // doesn't turn them: they ride flat out and the train outruns them (§K).
  ridersMayStay() {
    const s = train.distance;
    return train.state === 'run' && !tunnelNear(s + 140, 0) && !tunnelNear(s, 30);
  },
};

// Towns: rest, arrows back up to 15, then on to the next country (§G, §X).
train.onArrive = (i) => {
  game.riders.rest();
  player.health = CONFIG.player.maxHealth;
  const refill = Math.max(0, CONFIG.player.townArrows - player.arrows);
  player.arrows += refill;
  hud.banner(TOWNS[i % TOWNS.length], `Rested · ${refill ? `+${refill} arrows · ` : ''}next: ${biomeOf(i).name}`);
};
train.onDepart = () => sound.whistle();
// Tap the time on the stats line: jump three hours (for testing, §R).
hud.onTimeTap = () => (dayT += DAY_LEN / 8);
let tunnelBannered = -1;
const HEADLAMP = 300; // candela-ish; three.js lights fall off with distance
game.arrows = new ArrowSystem(game);
game.riders = new Riders(game, RIGS);
game.hats = new Hats(game);
game.hitView = new HitView(game); // H: show hitboxes and arrow paths (§X)
player.bow = new Bow(game, player); // each player carries their own bow (§W)

// ---- start / pause / death screens -----------------------------------------
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayButton = document.getElementById('overlay-button');
let state = 'menu'; // menu | playing | paused | dead

function play() {
  if (state === 'menu') hud.banner(TOWNS[0], 'Departing');
  state = 'playing';
  input.active = true;
  overlay.classList.add('hidden');
}

overlay.addEventListener('click', () => {
  if (state === 'dead') {
    location.reload();
    return;
  }
  sound.init();
  // A phone has no mouse to capture: just start riding.
  if (TOUCH) play();
  else input.lock();
});
input.onLockChange = (locked) => {
  if (locked && state !== 'dead') play();
  else if (!locked && state === 'playing') {
    state = 'paused';
    input.active = false;
    overlayTitle.textContent = 'Paused';
    overlayButton.textContent = 'Click to keep riding';
    overlay.classList.remove('hidden');
  }
};

// Developer hook: open the page with ?debug to poke at the game from the
// browser console (window.game, window.startGame()).
if (location.search.includes('debug')) {
  window.game = game;
  window.input = input;
  // Advance the game by n frames even when the browser isn't drawing.
  window.step = (n = 1, dt = 1 / 60) => {
    for (let i = 0; i < n; i++) update(dt);
    render(dt);
  };
  window.startGame = play;
  window.setTime = (h) => (dayT = (h / 24) * DAY_LEN);
}

// Grab: the racked hat you're looking at comes first, then a stuck arrow (§T).
function grab(tap) {
  const hat = game.hats.looked(player, camera);
  if (hat) game.hats.wear(player, hat, camera);
  else if (tap) game.arrows.tapGrab(player, camera, tap.x, tap.y);
  else game.arrows.grab(player, camera);
}

// The steam surge (§K): fired from the tender, two a stretch (§Y).
function surge() {
  if (player.dead) return;
  if (player.car.name !== 'tender') return hud.hint('Surge from the tender: forward along the roofs, two cars up');
  const why = train.surge();
  if (why) return hud.hint(why);
  sound.horn();
  hud.message(`STEAM SURGE ${SURGES - train.surges}/${SURGES}`);
  player.shake = Math.max(player.shake, 0.35);
}

function showDeath() {
  state = 'dead';
  input.active = false;
  document.exitPointerLock();
  overlayTitle.textContent = 'You died';
  overlayText.innerHTML = `${player.deathReason}<br>You rode ${(train.distance / 1609.34).toFixed(2)} miles and downed ${game.riders.kills} riders.`;
  overlayButton.textContent = 'Click to ride again';
  overlay.classList.remove('hidden');
}

// ---- train sounds -----------------------------------------------------------
let chuffAcc = 0;
let clackAcc = 0;
function trainSounds(dt) {
  // The exhaust beat: four chuffs a turn of the drivers, thinning to a roar
  // past 16 a second (§N). A clack at each rail joint.
  const rate = (train.speed / (2 * Math.PI * 1.22)) * 4;
  chuffAcc += rate * dt;
  if (chuffAcc >= 1) {
    chuffAcc -= Math.floor(chuffAcc);
    if (rate < 16 || Math.random() < 16 / rate) sound.chuff(Math.min(1, Math.max(0.5, 0.5 + train.speed / 40)));
  }
  clackAcc += train.speed * dt;
  if (clackAcc >= 12) {
    clackAcc -= 12;
    sound.clack();
    setTimeout(() => sound.clack(), 100);
  }
  // The firebox flickers.
  train.firebox.emissiveIntensity = 0.9 + Math.sin(time * 13) * 0.12;
}

// ---- main loop ----------------------------------------------------------------
const clock = new THREE.Clock();
let time = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 1 / 20);
  if (state === 'playing') update(dt);
  else player.applyCamera(camera, time);
  render(dt);
}

function update(dt) {
  time += dt;
  const [mx, my] = input.takeMouseDelta();
  player.look(mx, my);
  dayT += dt;
  train.update(dt);
  terrain.update(train.distance);
  const tun = tunnelNear(train.distance + 60, 0);
  if (tun && tunnelBannered !== tun.s0) {
    tunnelBannered = tun.s0;
    hud.banner('Tunnel ahead', 'Mind your head');
    sound.whistle();
  }
  // Player physics in two half-steps for steadier collisions.
  player.controls(input);
  player.update(dt / 2);
  player.update(dt / 2);
  player.applyCamera(camera, time);
  camera.updateMatrixWorld();
  player.bow.update(dt, input);
  game.riders.update(dt, time);
  game.arrows.update(dt);
  game.hats.update(dt);
  game.hitView.update(dt);
  if (input.take('grabReq')) grab();
  if (input.take('surgeReq')) surge();
  for (const t of input.takeTaps()) grab(t);
  smoke.update(dt, train);
  player.updateHealth(dt);
  trainSounds(dt);
  hud.update(game, dt, { dayT, dayLen: DAY_LEN, seed: SEED });
  if (player.dead) showDeath();
}

function render(dt) {
  // The sky, the light and the fog for this time of day and this country.
  sky.update(dt, dayT, camera.position);
  sky.updateFog(biomeParams(train.distance), !!tunnelNear(train.distance, 0));
  headlamp.intensity = HEADLAMP * sky.cur.night;

  // Ease the zoom toward what the bow wants (narrower as it draws).
  const fov = player.bow.fov(camera);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov += (fov - camera.fov) * 0.25;
    camera.updateProjectionMatrix();
  }

  renderer.clear();
  renderer.render(scene, camera);
  player.bow.render(renderer, camera, dt);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

frame();
