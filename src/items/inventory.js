import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { lerp } from '../core/math.js';
import { Bow } from '../combat/bow.js';
import { Grapple } from './grapple.js';

const SWITCH_TIME = 0.18; // seconds to lower one item and raise the next

// What you're carrying: the bow and the grappling hook. Scroll the mouse
// wheel (or press 1 / 2) to swap. The item in your hands is drawn in its own
// little scene on top of the world so it never pokes through walls.
export class Inventory {
  constructor(game) {
    this.game = game;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.view.fov, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6b4a30, 1.6));
    const sun = new THREE.DirectionalLight(0xffe2b8, 1.6);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);

    this.bow = new Bow(game, this.scene);
    this.grapple = new Grapple(game, this.scene);
    this.items = [this.bow, this.grapple];
    this.index = 0;
    this.shownIndex = 0; // the item currently raised (lags during a swap)
    this.lower = 0; // 0 = raised, 1 = out of view
    this.reelFov = 0;
  }

  get current() {
    return this.items[this.index];
  }
  get ready() {
    return this.shownIndex === this.index && this.lower < 0.05;
  }

  select(i) {
    i = ((i % this.items.length) + this.items.length) % this.items.length;
    if (i === this.index) return;
    this.current.cancel();
    this.index = i;
    this.game.sound.swap();
  }

  update(dt, input) {
    const wheel = input.takeWheel();
    if (wheel) this.select(this.index + Math.sign(wheel));
    if (input.took('Digit1')) this.select(0);
    if (input.took('Digit2')) this.select(1);

    // Lower the old item, swap, raise the new one.
    const rate = dt / (SWITCH_TIME / 2);
    if (this.shownIndex !== this.index) {
      this.lower = Math.min(1, this.lower + rate);
      if (this.lower >= 1) this.shownIndex = this.index;
    } else this.lower = Math.max(0, this.lower - rate);

    for (let i = 0; i < this.items.length; i++) this.items[i].update(dt, input, i === this.index && this.ready, i === this.index);
  }

  render(renderer, mainCamera, dt) {
    const player = this.game.player;
    // Zoom in a little while drawing the bow; widen while being reeled in.
    this.reelFov += ((player.reel ? 1 : 0) - this.reelFov) * Math.min(1, dt * 8);
    mainCamera.fov = lerp(CONFIG.view.fov, CONFIG.view.drawFov, this.bow.zoom) + this.reelFov * 10;
    mainCamera.updateProjectionMatrix();
    this.camera.fov = mainCamera.fov;
    this.camera.aspect = mainCamera.aspect;
    this.camera.updateProjectionMatrix();

    const hidden = player.dead;
    this.bow.animate(dt, hidden || this.shownIndex !== 0 ? 1 : this.lower);
    this.grapple.animate(dt, hidden || this.shownIndex !== 1 ? 1 : this.lower, mainCamera);

    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
