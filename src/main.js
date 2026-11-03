import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Input, TOUCH } from './core/input.js';
import { createSky, SKY } from './world/sky.js';
import { Terrain } from './world/terrain.js';
import { Smoke } from './world/smoke.js';
import { Train } from './train/train.js';
import { Player } from './player/player.js';
import { Bow } from './combat/bow.js';
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
terrain.update(train.position.z, 99); // build the starting area all at once
const smoke = new Smoke(scene);
const player = new Player(train);

document.body.classList.toggle('touch', TOUCH);

const game = { scene, camera, train, player, sound, hud, terrain };
game.arrows = new ArrowSystem(game);
game.bandits = new BanditManager(game);
player.bow = new Bow(game, player); // each player carries their own bow (§W)

// ---- start / pause / death screens -----------------------------------------
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayText = document.getElementById('overlay-text');
const overlayButton = document.getElementById('overlay-button');
let state = 'menu'; // menu | playing | paused | dead

function play() {
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
}

function showDeath() {
  state = 'dead';
  input.active = false;
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

function update(dt) {
  time += dt;
  const [mx, my] = input.takeMouseDelta();
  player.look(mx, my);
  train.update(dt);
  terrain.update(train.position.z);
  // Player physics in two half-steps for steadier collisions.
  player.controls(input);
  player.update(dt / 2);
  player.update(dt / 2);
  player.applyCamera(camera, time);
  camera.updateMatrixWorld();
  player.bow.update(dt, input);
  game.bandits.update(dt);
  game.arrows.update(dt);
  if (input.take('grabReq')) game.arrows.grab(player, camera);
  for (const t of input.takeTaps()) game.arrows.tapGrab(player, camera, t.x, t.y);
  smoke.update(dt, train);
  player.updateHealth(dt);
  trainSounds(dt);
  hud.update(game, dt);
  if (player.dead) showDeath();
}

function render(dt) {
  // Sun and shadows follow the player.
  const eye = player.eyeWorld();
  sun.target.position.copy(eye);
  sun.position.copy(eye).addScaledVector(SKY.sunDir, 120);
  sky.position.copy(camera.position);

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
