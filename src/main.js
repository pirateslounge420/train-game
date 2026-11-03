import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Input } from './core/input.js';
import { createSky, SKY } from './world/sky.js';
import { Terrain } from './world/terrain.js';
import { Smoke } from './world/smoke.js';
import { Stops } from './world/stops.js';
import { Conductor } from './train/conductor.js';
import { Train } from './train/train.js';
import { Player } from './player/player.js';
import { Inventory } from './items/inventory.js';
import { ArrowSystem } from './combat/arrows.js';
import { BanditManager } from './enemies/bandits.js';
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
const sky = createSky(scene);

scene.add(new THREE.HemisphereLight(0xcfe0ff, 0xb07a4a, 1.1));
const sun = new THREE.DirectionalLight(0xffe0b0, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

// ---- game objects -----------------------------------------------------------
const input = new Input(renderer.domElement);
const sound = new Sound();
const hud = new Hud();
const train = new Train(scene);
const terrain = new Terrain(scene);
terrain.update(train.position.z, train.position.z, 99); // build the starting area all at once
const smoke = new Smoke(scene);
const stops = new Stops(scene);
stops.update(train.position.z, train.position.z);

const game = { scene, camera, train, sound, hud, terrain, stops, input };
const player = new Player(game);
game.player = player;
game.conductor = new Conductor(game);
game.arrows = new ArrowSystem(game);
game.bandits = new BanditManager(game);
game.inventory = new Inventory(game);

// ---- start / pause / death screens -----------------------------------------
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayButton = document.getElementById('overlay-button');
let state = 'menu'; // menu | playing | paused | dead

overlay.addEventListener('click', () => {
  if (state === 'dead') {
    location.reload();
    return;
  }
  sound.init();
  input.lock();
});
input.onLockChange = (locked) => {
  if (locked && state !== 'dead') {
    state = 'playing';
    overlay.classList.add('hidden');
  } else if (!locked && state === 'playing') {
    state = 'paused';
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
  window.startGame = () => {
    state = 'playing';
    overlay.classList.add('hidden');
  };
}

function showDeath() {
  state = 'dead';
  document.exitPointerLock();
  overlayTitle.textContent = 'You died';
  overlayText.innerHTML = `${player.deathReason}<br>You rode ${(train.distance / 1609.34).toFixed(2)} miles and downed ${game.bandits.downed} bandits.`;
  overlayButton.textContent = 'Click to ride again';
  overlay.classList.remove('hidden');
}

// ---- train sounds -----------------------------------------------------------
let chuffAcc = 0;
let clackAcc = 0;
function trainSounds(dt) {
  // Two chuffs per turn of the big driving wheels, a clack at each rail joint.
  chuffAcc += (train.speed * dt) / (2 * Math.PI * 0.85);
  if (chuffAcc >= 0.5) {
    chuffAcc -= 0.5;
    sound.chuff();
  }
  clackAcc += train.speed * dt;
  if (clackAcc >= 12) {
    clackAcc -= 12;
    sound.clack();
    setTimeout(() => sound.clack(), 100);
  }
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

// ---- right click: interact ----------------------------------------------------
// Works out what right click would do right now (for the on-screen prompt),
// and does it if `act` is set.
function interact(act) {
  if (player.dead || player.reel) return '';
  if (game.inventory.bow.state === 'drawing') return '';
  // Pull arrows out of the train (or the dirt).
  const near = game.arrows.reachable(player);
  if (near.length && player.arrows < CONFIG.player.maxArrows) {
    if (act) game.arrows.pull(player);
    return `Right click — pull arrow${near.length > 1 ? `s (${near.length})` : ''}`;
  }
  // Talk to the conductor.
  if (player.aboard) {
    const c = game.conductor.position;
    const d = Math.hypot(player.local.x - c.x, player.local.z - c.z);
    if (d < CONFIG.player.reach + 0.4 && Math.abs(player.local.y - c.y) < 1) {
      if (act) hud.message(game.conductor.talk());
      return 'Right click — talk to the conductor';
    }
  }
  // Climb back aboard a stopped (or crawling) train.
  if (player.offTrain && train.speed < 4 && player.distanceToTrain() < CONFIG.player.reach) {
    if (act) player.climbAboard();
    return 'Right click — climb aboard';
  }
  return '';
}

function update(dt) {
  time += dt;
  const [mx, my] = input.takeMouseDelta();
  player.look(mx, my);
  game.conductor.update(dt);
  train.update(dt);
  // Keep the land (and stops) built around both the train and the player.
  const pz = player.feetWorld().z;
  const front = Math.min(train.position.z, pz);
  const back = Math.max(train.position.z, pz);
  terrain.update(front, back);
  stops.update(front, back);
  // Player physics in two half-steps for steadier collisions.
  player.beginFrame();
  player.update(dt / 2, input);
  player.update(dt / 2, input);
  player.applyCamera(camera, time, dt);
  camera.updateMatrixWorld();
  const interactText = interact(input.took('Mouse2'));
  game.inventory.update(dt, input);
  game.bandits.update(dt);
  game.arrows.update(dt);
  smoke.update(dt, train);
  player.updateHealth(dt);
  trainSounds(dt);
  hud.update(game, interactText);
  input.endFrame();
  if (player.dead) showDeath();
}

function render(dt) {
  // Sun and shadows follow the player.
  const eye = player.eyeWorld();
  sun.target.position.copy(eye);
  sun.position.copy(eye).addScaledVector(SKY.sunDir, 120);
  sky.position.copy(camera.position);

  renderer.clear();
  renderer.render(scene, camera);
  game.inventory.render(renderer, camera, dt);
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

frame();
