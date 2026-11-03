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
    const s = CONFIG.view.mouseSensitivity;
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch - dy * s, -1.5, 1.5);
  }

  update(dt, input) {
    if (this.dead) return;
    const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
    const strafe = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const jump = input.down('Space');

    // Desired horizontal velocity from keys, relative to where we look.
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wx = -sin * fwd + cos * strafe;
    let wz = -cos * fwd - sin * strafe;
    const wl = Math.hypot(wx, wz);
    if (wl > 1) {
      wx /= wl;
      wz /= wl;
    }
    const speed = sprint ? C.sprintSpeed : C.walkSpeed;
    const accel = this.onGround || this.onLadder ? 40 : 6;
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
      this.vel.y -= CONFIG.gravity * dt;
      if (jump && this.onGround) this.vel.y = C.jumpSpeed;
    }

    this.onGround = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveAxis('y', this.vel.y * dt);

    // Head bob while walking.
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hs > 0.5) this.bob += dt * hs * 2.4;

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
    camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
