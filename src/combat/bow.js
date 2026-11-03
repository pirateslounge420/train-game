import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flat } from '../core/materials.js';
import { clamp, placeBetween } from '../core/math.js';

const B = CONFIG.bow;

// The bow in one player's hands (§B, §L, §U; numbers from reference 0.7).
//
// Hold the draw button: the draw builds over one second on the Torchfire /
// Minecraft curve. Let go to loose. The next draw can start straight away.
// The arrow leaves the bow in your hand and is aimed to cross the
// crosshair line at the "zero" distance (15 m snap shot, 35 m full draw),
// tipped nose-up just enough that gravity drops it onto the crosshair
// there. Closer than that it lands a touch high, further away it drops.
//
// The bow is drawn in its own little scene on top of the world so it
// never pokes through walls.
export class Bow {
  constructor(game, player) {
    this.game = game;
    this.player = player;
    this.drawing = false;
    this.drawT = 0; // seconds held, capped at full draw
    this.kick = 0; // jumps on release, settles over a few frames
    this.baseFov = CONFIG.view.fov;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(CONFIG.view.fov, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x283c8a, 1.6));
    const sun = new THREE.DirectionalLight(0xffe2b8, 1.6);
    sun.position.set(0.5, 1, 0.3);
    this.scene.add(sun);
    this.buildModel();
  }

  // Power 0..1 from how long the draw has been held.
  power() {
    const t = this.drawT / B.fullDrawTime;
    return Math.min(1, (t * t + 2 * t) / 3);
  }

  buildModel() {
    // Positions in camera space, as in the reference build's bow rig.
    this.rig = new THREE.Group();
    this.scene.add(this.rig);
    const arc = new THREE.TorusGeometry(0.42, 0.02, 4, 14, Math.PI).toNonIndexed();
    arc.computeVertexNormals();
    const bow = new THREE.Mesh(arc, flat(0x4a2e1a));
    bow.rotation.set(0, -Math.PI / 2, Math.PI / 2);
    this.rig.add(bow);
    this.rig.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), flat(0x2a1c10)));
    const stringMat = new THREE.MeshBasicMaterial({ color: 0xe8e2cf });
    this.strings = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 3), stringMat);
      this.rig.add(m);
      return m;
    });
    this.tips = [new THREE.Vector3(0, 0.42, 0), new THREE.Vector3(0, -0.42, 0)];
    this.nock = new THREE.Vector3();

    // The nocked arrow: points along -Z, its tip at the origin.
    this.arrow = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.8, 5).rotateX(Math.PI / 2), flat(0xc9b48a));
    shaft.position.z = 0.5;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 4).rotateX(-Math.PI / 2), flat(0x3a3a3a));
    head.position.z = 0.06;
    const fl1 = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.07, 0.11), flat(0xf1efe6));
    fl1.position.set(0, 0.035, 0.83);
    const fl2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.004, 0.11), flat(0xf1efe6));
    fl2.position.set(0.035, 0, 0.83);
    this.arrow.add(shaft, head, fl1, fl2);
    this.rig.add(this.arrow);
    this.hand = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.09), flat(0xb8865e));
    this.rig.add(this.hand);
  }

  update(dt, input) {
    const p = this.player;
    if (p.dead) {
      this.drawing = false;
      this.drawT = 0;
      return;
    }
    if (input.take('cancelReq')) {
      // the draw finger slid off, or the page was hidden: no shot
      this.drawing = false;
      this.drawT = 0;
    }
    const held = input.drawHeld();
    if (!this.drawing && held && !this.wasHeld) this.startDraw();
    this.wasHeld = held;
    if (this.drawing) {
      this.drawT = Math.min(B.fullDrawTime, this.drawT + dt);
      if (!held) this.release();
    }
  }

  startDraw() {
    const p = this.player;
    if (p.onLadder) return this.game.hud.hint('Hands on the ladder');
    if (p.arrows <= 0) return this.game.hud.hint('No arrows nocked. Grab the ones stuck in the cars.');
    this.drawing = true;
    this.drawT = 0;
    this.game.sound.creak();
  }

  release() {
    const e = this.power();
    this.drawing = false;
    this.drawT = 0;
    if (e < B.minPower) return;
    this.fire(e);
  }

  fire(e) {
    const { camera, arrows, train, sound } = this.game;
    const p = this.player;
    p.arrows--;
    const v0 = B.snapSpeed + (B.fullSpeed - B.snapSpeed) * e;
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const from = this.nockWorld(new THREE.Vector3());
    // Aim from the bow at the point on the crosshair line `zero` metres out.
    const zero = B.zeroSnap + (B.zeroFull - B.zeroSnap) * e;
    const dir = camera.position.clone().addScaledVector(look, zero).sub(from).normalize();
    // Nose up so the drop lands it on the crosshair at that distance.
    const alpha = Math.asin(clamp((CONFIG.gravity * zero) / (v0 * v0), 0, 1)) * 0.5;
    const axis = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
    dir.applyAxisAngle(axis, -alpha);
    // The arrow keeps the train's speed.
    const vel = dir.multiplyScalar(v0).add(train.velocity);
    arrows.spawn(from, vel, 'player');
    sound.twang(e);
    this.kick = 0.6 + 0.6 * e;
    p.shake = Math.max(p.shake, 0.12 * e);
  }

  // Where the arrow's tip sits right now, in the world.
  nockWorld(out) {
    this.rig.updateMatrixWorld(true);
    out.set(0, 0, 0.1);
    this.arrow.localToWorld(out); // camera space (the overlay scene's origin is the eye)
    return this.game.camera.localToWorld(out);
  }

  // The view zooms a little as the bow charges, and widens as you sprint.
  fov(camera) {
    this.baseFov = camera.aspect < 1 ? CONFIG.view.portraitFov : CONFIG.view.fov;
    const sprint = this.player.sprinting ? CONFIG.player.sprintFov : 0;
    return this.baseFov - CONFIG.view.drawZoom * this.power() + sprint;
  }

  // Animate the bow model (reference 0.7's updateBowRig) and draw it.
  render(renderer, mainCamera, dt) {
    const draw = this.drawing ? this.power() : 0;
    this.kick *= Math.pow(0.78, dt * 60);
    const k = this.kick;
    const d = draw * 0.5 + k * 0.12;
    this.nock.set(0, -0.01, draw * 0.5);
    placeBetween(this.strings[0], this.tips[0], this.nock);
    placeBetween(this.strings[1], this.tips[1], this.nock);
    const p = this.player;
    this.arrow.visible = p.arrows > 0 && !p.dead;
    this.arrow.position.set(0, -0.01, d - 0.9);
    this.hand.position.set(0, -0.03, d);
    this.rig.position.set(0.46 - draw * 0.16, -0.3 + draw * 0.08 + k * 0.03, -0.74 + draw * 0.04 + k * 0.07);
    this.rig.rotation.set(0.05 - draw * 0.04 + k * 0.16, 0.1 - draw * 0.14, -0.2 + draw * 0.08);

    this.camera.fov = mainCamera.fov;
    this.camera.aspect = mainCamera.aspect;
    this.camera.updateProjectionMatrix();
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
