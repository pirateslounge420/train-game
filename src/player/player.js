import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp } from '../core/math.js';

const C = CONFIG.player;

// The player lives in "train space" (see train.js). Their position is
// relative to the train, so walking around is ordinary physics and the
// train's motion simply carries them along.
export class Player {
  constructor(train) {
    this.train = train;
    this.local = new THREE.Vector3(0, 1.46, 17.5); // feet, on the flatcar
    this.vel = new THREE.Vector3(); // relative to the train
    this.yaw = 0; // 0 = looking toward the front of the train
    this.pitch = 0;
    this.onGround = false;
    this.onLadder = false;
    this.health = C.maxHealth;
    this.arrows = C.startArrows;
    this.dead = false;
    this.deathReason = '';
    this.sinceHurt = 99;
    this.bob = 0;
    this.shake = 0; // camera shake, e.g. from loosing an arrow
  }

  // World-space position of the feet / eyes / chest.
  feetWorld(out = new THREE.Vector3()) {
    return out.copy(this.local).add(this.train.position);
  }
  eyeWorld(out = new THREE.Vector3()) {
    return this.feetWorld(out).setY(out.y + C.eyeHeight);
  }
  chestWorld(out = new THREE.Vector3()) {
    return this.feetWorld(out).setY(out.y + 1.25);
  }
  // Velocity over the ground = train velocity + our walking velocity.
  worldVelocity(out = new THREE.Vector3()) {
    return out.copy(this.vel).add(this.train.velocity);
  }

  // Hit boxes in train space (for enemy arrows).
  hitBoxes() {
    const p = this.local;
    return [
      { head: true, min: new THREE.Vector3(p.x - 0.14, p.y + 1.48, p.z - 0.14), max: new THREE.Vector3(p.x + 0.14, p.y + 1.8, p.z + 0.14) },
      { head: false, min: new THREE.Vector3(p.x - 0.25, p.y + 0.05, p.z - 0.2), max: new THREE.Vector3(p.x + 0.25, p.y + 1.48, p.z + 0.2) },
    ];
  }

  look(dx, dy) {
    const s = (CONFIG.view.lookSensitivity * Math.PI) / 180;
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch - dy * s, -C.maxPitch, C.maxPitch);
  }

  // Read this frame's controls once (the physics then runs in half-steps).
  // Another player's controls can be fed in the same way later (§W).
  controls(input) {
    const m = input.move();
    this.ctl = { x: m.x, y: m.y, sprint: input.sprint, jump: input.take('jumpReq') };
  }

  update(dt) {
    if (this.dead) return;
    const ctl = this.ctl || { x: 0, y: 0 };
    const fwd = ctl.y;
    const strafe = ctl.x;
    const jump = ctl.jump;
    ctl.jump = false;
    const drawing = !!this.bow?.drawing;
    // Sprint: double-tap forward and hold; not while drawing (§M).
    this.sprinting = !!ctl.sprint && !drawing && fwd > 0.3;

    // Walking velocity, relative to where we look. Reference 0.7's speeds:
    // 4.8 m/s on a floor, 4.1 up on a roof, a little over half while drawing.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    const wx = -sin * fwd + cos * strafe;
    const wz = -cos * fwd - sin * strafe;
    const onRoof = this.local.y > C.roofHeight;
    const speed = (onRoof ? C.roofSpeed : C.walkSpeed) * (drawing ? C.drawSlow : 1) * (this.sprinting ? C.sprintBoost : 1);
    // Feet on something: you go where you push at once. In the air you
    // still steer, just not instantly (so a push off a ladder carries).
    const accel = this.onGround || this.onLadder ? 1e3 : 30;
    this.vel.x += clamp(wx * speed - this.vel.x, -accel * dt, accel * dt);
    this.vel.z += clamp(wz * speed - this.vel.z, -accel * dt, accel * dt);

    // Only climb when facing the ladder.
    const ladder = this.ladderAt();
    this.onLadder = !!ladder && -cos * -ladder.faceSign > 0.2;
    if (this.onLadder) {
      this.vel.y = fwd * C.climbSpeed;
      if (jump && fwd <= 0) {
        // push off the ladder
        this.vel.y = C.jumpSpeed * 0.5;
        this.vel.x = sin * 3;
        this.vel.z = cos * 3;
      }
    } else {
      this.vel.y -= C.gravity * dt;
      if (jump && this.onGround) this.vel.y = C.jumpSpeed;
    }

    this.onGround = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveAxis('y', this.vel.y * dt);

    // Head bob while walking (reference 0.7: 11 rad/s, 3.5 cm).
    const moving = Math.hypot(fwd, strafe) > 0.05;
    this.bob = moving && this.onGround && !this.onLadder ? this.bob + dt * 11 : 0;

    // Fell off the train?
    if (this.local.y < 0.7) this.die('You fell off the train.');
  }

  overlaps(c, x, y, z) {
    const r = C.radius;
    return x + r > c.min.x && x - r < c.max.x && y + C.height > c.min.y && y < c.max.y && z + r > c.min.z && z - r < c.max.z;
  }

  freeAt(x, y, z) {
    for (const c of this.train.colliders) if (this.overlaps(c, x, y, z)) return false;
    return true;
  }

  // Move along one axis and push back out of anything we walked into.
  moveAxis(axis, delta) {
    if (delta === 0) return;
    const p = this.local;
    p[axis] += delta;
    for (const c of this.train.colliders) {
      if (!this.overlaps(c, p.x, p.y, p.z)) continue;
      if (axis === 'y') {
        if (delta < 0) {
          p.y = c.max.y;
          this.onGround = true;
        } else {
          p.y = c.min.y - C.height - 1e-4;
        }
        this.vel.y = 0;
      } else {
        // Small ledge? Step up onto it instead of stopping.
        const step = c.max.y - p.y;
        if (step > 0 && step <= C.stepHeight && this.vel.y <= 0.5 && this.freeAt(p.x, c.max.y + 1e-3, p.z)) {
          p.y = c.max.y + 1e-3;
          continue;
        }
        const r = C.radius + 1e-4;
        p[axis] = delta > 0 ? c.min[axis] - r : c.max[axis] + r;
        this.vel[axis] = 0;
      }
    }
  }

  ladderAt() {
    for (const l of this.train.ladders) if (this.overlaps(l, this.local.x, this.local.y, this.local.z)) return l;
    return null;
  }

  updateHealth(dt) {
    if (this.dead) return;
    this.sinceHurt += dt;
    this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.sinceHurt > C.regenDelay) this.health = Math.min(C.maxHealth, this.health + C.regenPerSecond * dt);
  }

  hurt(amount, reason) {
    if (this.dead) return;
    this.health -= amount;
    this.sinceHurt = 0;
    if (this.health <= 0) {
      this.health = 0;
      this.die(reason);
    }
  }

  die(reason) {
    if (this.dead) return;
    this.dead = true;
    this.deathReason = reason;
  }

  // Put the camera at our eyes.
  applyCamera(camera, time) {
    this.eyeWorld(camera.position);
    camera.position.y += Math.sin(this.bob) * 0.035;
    // Tiny rail vibration.
    camera.position.y += Math.sin(time * 37) * 0.004 + Math.sin(time * 23.3) * 0.003;
    if (this.shake > 0) {
      camera.position.x += (Math.random() - 0.5) * this.shake * 0.08;
      camera.position.y += (Math.random() - 0.5) * this.shake * 0.08;
    }
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
