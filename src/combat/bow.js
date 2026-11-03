import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flat } from '../core/materials.js';
import { lerp, placeBetween } from '../core/math.js';

const B = CONFIG.bow;

// The bow you hold. Hold the left mouse button to draw (power builds up to
// full draw in ~0.55 s), let go to loose the arrow. Right-click while drawing
// lets the string down without wasting the arrow.
//
// The model lives in the inventory's viewmodel scene (drawn on top of the
// world so it never pokes through walls).
export class Bow {
  constructor(game, scene) {
    this.game = game;
    this.name = 'Bow';
    this.state = 'ready'; // ready | drawing | reloading
    this.draw = 0; // 0..1
    this.shown = 0; // smoothed draw for animation
    this.reload = 0;
    this.scene = scene;
    this.buildModel();
  }

  get busy() {
    return this.state === 'drawing';
  }

  cancel() {
    if (this.state === 'drawing') this.state = 'ready';
    this.draw = 0;
  }

  // How far the view zooms in (0..1).
  get zoom() {
    const d = this.shown;
    return d * d * (3 - 2 * d);
  }

  buildModel() {
    const wood = flat(0x6b3f20);
    const grip = flat(0x3b2616);
    const stringMat = flat(0xe8e0cc);
    this.root = new THREE.Group();
    this.root.scale.setScalar(0.75);
    this.scene.add(this.root);

    const rod = (r, mat) => new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 5), mat);
    // Riser (handle) + limbs (2 segments each so they can bend).
    this.riser = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.26, 0.05), wood);
    this.root.add(this.riser);
    this.gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.06), grip);
    this.root.add(this.gripMesh);
    this.limbs = [rod(0.012, wood), rod(0.01, wood), rod(0.012, wood), rod(0.01, wood)];
    this.strings = [rod(0.0025, stringMat), rod(0.0025, stringMat)];
    for (const m of [...this.limbs, ...this.strings]) this.root.add(m);

    // The nocked arrow.
    this.arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.78, 5).rotateX(Math.PI / 2).translate(0, 0, -0.39), flat(0xb08850));
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.05, 4).rotateX(-Math.PI / 2).translate(0, 0, -0.8), flat(0x3a3a3a, { metalness: 0.6 }));
    const fl = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.014, 0.07).translate(0, 0.008, -0.07), flat(0xf2efe6));
    const fl2 = fl.clone();
    fl2.rotation.z = 2.1;
    const fl3 = fl.clone();
    fl3.rotation.z = -2.1;
    this.arrow.add(shaft, head, fl, fl2, fl3);
    this.root.add(this.arrow);
  }

  update(dt, input, active) {
    const { player, arrows, train, camera, sound } = this.game;
    if (this.state === 'reloading') {
      this.reload -= dt;
      if (this.reload <= 0) this.state = 'ready';
    }
    if (!active) return;
    if (player.dead) {
      this.state = 'ready';
      this.draw = 0;
      return;
    }
    if (this.state === 'ready' && input.mouse[0] && player.arrows > 0) {
      this.state = 'drawing';
      this.draw = 0;
      sound.creak();
    }
    if (this.state === 'drawing') {
      this.draw = Math.min(1, this.draw + dt / B.fullDrawTime);
      if (input.mouse[2]) {
        this.state = 'ready';
        this.draw = 0;
      } else if (!input.mouse[0]) {
        this.fire(camera, player, train, arrows, sound);
      }
    }
  }

  fire(camera, player, train, arrows, sound) {
    const power = this.draw;
    this.draw = 0;
    if (power < 0.08) {
      this.state = 'ready';
      return;
    }
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const origin = camera.position.clone().addScaledVector(dir, 0.35);
    origin.y -= 0.04;
    const speed = lerp(B.minSpeed, B.maxSpeed, power);
    // The arrow keeps the motion of the train (and of you walking).
    const vel = dir.multiplyScalar(speed).add(player.worldVelocity());
    arrows.spawn(origin, vel, 'player');
    player.arrows--;
    sound.twang(power);
    this.state = 'reloading';
    this.reload = B.reloadTime;
  }

  // Animate the bow model. `lower` (0..1) drops it out of view when switching.
  animate(dt, lower) {
    this.root.visible = lower < 0.99;
    const target = this.state === 'drawing' ? this.draw : 0;
    this.shown += (target - this.shown) * Math.min(1, dt * (target > this.shown ? 30 : 12));
    const d = this.shown;
    const e = this.zoom;

    // Bow position: low and to the side at rest, centred when drawn.
    const sway = Math.sin(performance.now() * 0.002) * 0.004 * (1 - d);
    this.root.position.set(lerp(0.24, 0.02, e), lerp(-0.25, -0.035, e) + sway - lower * 0.45, lerp(0.02, 0, e));
    this.root.rotation.set(lerp(0.15, 0, e) - lower * 0.6, lerp(0.3, 0, e), lerp(-0.45, -0.15, e));

    // Grip is at z = -0.6; tips come back a bit as the limbs bend.
    const gz = -0.6;
    const tipY = 0.56 - 0.07 * d;
    const tipZ = gz + 0.1 + 0.12 * d;
    const midY = 0.33 - 0.02 * d;
    const midZ = gz - 0.02 + 0.05 * d;
    this.riser.position.set(0, 0, gz);
    this.gripMesh.position.set(0, 0, gz + 0.005);
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const s of [1, -1]) {
      const i = s === 1 ? 0 : 2;
      placeBetween(this.limbs[i], v(0, 0.12 * s, gz), v(0, midY * s, midZ));
      placeBetween(this.limbs[i + 1], v(0, midY * s, midZ), v(0, tipY * s, tipZ));
    }
    const nockZ = tipZ + 0.02 + d * 0.14;
    const nock = v(0, 0, nockZ);
    placeBetween(this.strings[0], v(0, tipY, tipZ), nock);
    placeBetween(this.strings[1], v(0, -tipY, tipZ), nock);

    // Arrow sits on the string; slides up into place while reloading.
    const p = this.game.player;
    const hasArrow = p.arrows > 0 && !p.dead;
    this.arrow.visible = hasArrow;
    const rise = this.state === 'reloading' ? Math.min(1, this.reload / B.reloadTime) : 0;
    this.arrow.position.set(0.012, -rise * 0.25, nockZ);
  }
}
