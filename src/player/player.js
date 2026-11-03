import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp } from '../core/math.js';
import { ROOF } from '../train/train.js';

const C = CONFIG.player;
const _m = new THREE.Matrix4();
const _c = new THREE.Vector3();

// The player lives in "train space" (see train.js), in the frame of the car
// they stand on. Their position is relative to that car, so walking around
// is ordinary physics and the train's motion simply carries them along.
// Crossing the gap to the next car changes frames at its midpoint (§M).
export class Player {
  constructor(train) {
    this.train = train;
    this.local = new THREE.Vector3(0.25, ROOF + 0.01, 1.2); // feet, on the caboose roof (§C)
    this.car = train.carAt(this.local.z);
    this.colliders = []; // this car's boxes plus the neighbours', in this car's frame
    this.ladders = [];
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
    return this.train.toWorld(this.car, this.local, out);
  }
  eyeWorld(out = new THREE.Vector3()) {
    return this.feetWorld(out).setY(out.y + C.eyeHeight);
  }
  chestWorld(out = new THREE.Vector3()) {
    return this.feetWorld(out).setY(out.y + 1.25);
  }
  // Velocity over the ground = train velocity + our walking velocity.
  worldVelocity(out = new THREE.Vector3()) {
    return this.train.dirToWorld(this.car, this.vel, out).add(this.car.vel);
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
    this.gatherColliders();
  }

  // This car's boxes as they are, and the cars either side of it brought
  // into this car's frame (on a curve they're turned a few degrees).
  gatherColliders() {
    const t = this.train, car = this.car;
    this.colliders = car.colliders.slice();
    this.ladders = car.ladders.slice();
    for (const n of [t.cars[car.i - 1], t.cars[car.i + 1]]) {
      if (!n) continue;
      _m.multiplyMatrices(car.inv, n.inner.matrixWorld);
      const bring = (b) => {
        const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        for (let k = 0; k < 4; k++) {
          _c.set(k & 1 ? b.max.x : b.min.x, 0, k & 2 ? b.max.z : b.min.z).applyMatrix4(_m);
          min.min(_c);
          max.max(_c);
        }
        min.y = b.min.y;
        max.y = b.max.y;
        return b.at ? { ...b, min, max, at: b.at.clone().applyMatrix4(_m) } : { ...b, min, max };
      };
      for (const b of n.colliders) this.colliders.push(bring(b));
      for (const b of n.ladders) this.ladders.push(bring(b));
    }
  }

  // Walked past the middle of the gap? Carry on in the next car's frame,
  // keeping where we are in the world and the way we face.
  changeCar() {
    const t = this.train, car = this.car;
    const next = t.carAt(this.local.z);
    if (next === car) return;
    t.toWorld(car, this.local, _c);
    t.toLocal(next, _c, this.local);
    t.dirToWorld(car, this.vel, _c);
    t.dirToLocal(next, _c, this.vel);
    this.yaw += next.th - car.th;
    this.car = next;
    this.gatherColliders();
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
    const base = this.car.name === 'tender' ? C.tenderSpeed : this.local.y > C.roofHeight ? C.roofSpeed : C.walkSpeed;
    const speed = base * (drawing ? C.drawSlow : 1) * (this.sprinting ? C.sprintBoost : 1);
    // Feet on something: you go where you push at once. In the air you
    // still steer, just not instantly (so a push off a ladder carries).
    const accel = this.onGround || this.onLadder ? 1e3 : 30;
    this.vel.x += clamp(wx * speed - this.vel.x, -accel * dt, accel * dt);
    this.vel.z += clamp(wz * speed - this.vel.z, -accel * dt, accel * dt);

    // Only climb when facing the ladder.
    const ladder = this.ladderAt();
    this.onLadder = !!ladder && -sin * ladder.face.x - cos * ladder.face.z > 0.2;
    if (this.onLadder) {
      if (this.local.y < ladder.top - 0.3) this.climbing = true;
      this.vel.y = fwd * C.climbSpeed;
      // Off the ground, the ladder holds you: no drifting off it forward or
      // back (you can still sidestep). Standing at its foot or top you walk.
      if (!this.onGround) {
        this.vel.x = cos * strafe * speed;
        this.vel.z = -sin * strafe * speed;
      }
      if (fwd > 0 && this.local.y >= ladder.top) {
        // At the top. If you climbed up, pushing on steps you off onto the roof.
        this.vel.y = 0;
        this.local.y = Math.max(this.local.y, ladder.top + 0.01);
        if (this.climbing) {
          // a short step clear of the hole, whichever way you're facing
          this.stepOff = { t: 0.35, x: ladder.out.x * 2.5, z: ladder.out.z * 2.5 };
          this.climbing = false;
        }
      } else if (fwd !== 0) {
        // Climbing draws you onto the ladder's line, so you come up square
        // through a hatch.
        const k = Math.min(1, 6 * dt);
        this.local.x += (ladder.at.x - this.local.x) * k;
        this.local.z += (ladder.at.z - this.local.z) * k;
      }
      if (jump && fwd <= 0) {
        // push off the ladder
        this.vel.y = C.jumpSpeed * 0.5;
        this.vel.x = sin * 3;
        this.vel.z = cos * 3;
      }
    } else {
      this.climbing = false;
      this.vel.y -= C.gravity * dt;
      if (jump && this.onGround) this.vel.y = C.jumpSpeed;
    }

    if (this.stepOff) {
      this.vel.x = this.stepOff.x;
      this.vel.z = this.stepOff.z;
      if ((this.stepOff.t -= dt) <= 0) this.stepOff = null;
    }

    this.onGround = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveAxis('y', this.vel.y * dt);

    // Head bob while walking (reference 0.7: 11 rad/s, 3.5 cm).
    const moving = Math.hypot(fwd, strafe) > 0.05;
    this.bob = moving && this.onGround && !this.onLadder ? this.bob + dt * 11 : 0;

    this.changeCar();

    // Fell off the train?
    if (this.local.y < 0.7) this.die('You fell off the train.');
  }

  overlaps(c, x, y, z) {
    const r = C.radius;
    return x + r > c.min.x && x - r < c.max.x && y + C.height > c.min.y && y < c.max.y && z + r > c.min.z && z - r < c.max.z;
  }

  freeAt(x, y, z) {
    for (const c of this.colliders) if (this.overlaps(c, x, y, z)) return false;
    return true;
  }

  // Move along one axis and push back out of anything we walked into.
  moveAxis(axis, delta) {
    if (delta === 0) return;
    const p = this.local;
    p[axis] += delta;
    for (const c of this.colliders) {
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
    for (const l of this.ladders) if (this.overlaps(l, this.local.x, this.local.y, this.local.z)) return l;
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
    // Our yaw is relative to our car; the car turns with the line.
    camera.rotation.set(this.pitch, this.yaw - this.car.th, 0, 'YXZ');
  }
}
