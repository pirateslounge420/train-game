import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, rand } from '../core/math.js';
import { groundHeight } from '../world/terrain.js';

const C = CONFIG.player;
const S = CONFIG.stagger;
const G = CONFIG.grapple;

// The player always lives in "train space" (see train.js): `local` is the
// position of their feet relative to the train and `vel` is their velocity
// relative to the train.
//
// While aboard, the train simply carries them along. Once they're off it
// (thrown off, or walking about on the ground) they keep their real speed
// over the ground instead, so the train pulls away from them. Doing it this
// way means the train's collision boxes, ladders and arrow hits all keep
// working whether the player is on the train or chasing it on foot.
export class Player {
  constructor(game) {
    this.game = game;
    this.train = game.train;
    this.local = new THREE.Vector3(0, 1.46, 17.5); // feet, on the flatcar
    this.vel = new THREE.Vector3(); // relative to the train
    this.refVz = this.train.velocity.z; // train speed `vel` was measured against
    this.yaw = 0; // 0 = looking toward the front of the train
    this.pitch = 0;
    this.onGround = false;
    this.groundKind = 'train'; // what we last stood on: 'train' | 'ground'
    this.onLadder = false;
    this.aboard = true;
    this.crouching = false;
    this.height = C.height;
    this.eye = C.eyeHeight; // smoothed eye height
    this.health = C.maxHealth;
    this.arrows = C.startArrows;
    this.dead = false;
    this.deathReason = '';
    this.sinceHurt = 99;
    this.bob = 0;
    this.stagger = 0; // seconds of reduced control after a hit
    this.tumble = 0; // seconds of being thrown (no control, over the railings)
    this.knockedOff = false;
    this.reel = null; // grapple pull in progress
    // Camera jolt: pitch / yaw / roll offsets and their speeds.
    this.jolt = new THREE.Vector3();
    this.joltV = new THREE.Vector3();
    this.prevFeet = this.feetWorld();
    this._extra = [];
  }

  // World-space position of the feet / eyes / chest.
  feetWorld(out = new THREE.Vector3()) {
    return out.copy(this.local).add(this.train.position);
  }
  eyeWorld(out = new THREE.Vector3()) {
    return this.feetWorld(out).setY(out.y + this.eye);
  }
  chestWorld(out = new THREE.Vector3()) {
    return this.feetWorld(out).setY(out.y + this.height * 0.72);
  }
  // Velocity over the ground = train velocity + our velocity relative to it.
  worldVelocity(out = new THREE.Vector3()) {
    return out.copy(this.vel).add(this.train.velocity);
  }
  get offTrain() {
    return !this.aboard && !this.reel;
  }

  // Hit boxes relative to our feet (for enemy arrows).
  hitBoxes() {
    const h = this.height;
    const head = 0.32;
    return [
      { head: true, min: new THREE.Vector3(-0.14, h - head, -0.14), max: new THREE.Vector3(0.14, h + 0.05, 0.14) },
      { head: false, min: new THREE.Vector3(-0.25, 0.05, -0.2), max: new THREE.Vector3(0.25, h - head, 0.2) },
    ];
  }

  look(dx, dy) {
    const s = CONFIG.view.mouseSensitivity;
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch - dy * s, -1.5, 1.5);
  }

  // Remember where we were at the start of the frame (arrow hit tests).
  beginFrame() {
    this.feetWorld(this.prevFeet);
  }

  update(dt, input) {
    if (this.dead) return;
    this.updateJolt(dt);
    const train = this.train;
    // Keep `vel` relative to the train's current speed while we're off it,
    // so our real ground speed doesn't change when the train brakes.
    if (!this.aboard && !this.reel) this.vel.z += this.refVz - train.velocity.z;
    this.refVz = train.velocity.z;
    if (this.reel) return this.updateReel(dt);

    this.aboard = train.inFootprint(this.local);
    this.tumble = Math.max(0, this.tumble - dt);
    this.stagger = Math.max(0, this.stagger - dt);
    const control = this.tumble > 0 ? 0 : 1;

    const fwd = ((input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0)) * control;
    const strafe = ((input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0)) * control;
    const jump = input.down('Space') && control > 0;
    this.updateCrouch(control > 0 && (input.down('ShiftLeft') || input.down('ShiftRight')));

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
    const speed = C.walkSpeed * (this.crouching ? C.crouchSpeedFactor : 1);
    const staggerFactor = 1 - Math.min(1, this.stagger * 2.5) * 0.8;

    if (this.aboard) {
      const accel = (this.onGround || this.onLadder ? 40 : 6) * staggerFactor;
      this.vel.x += clamp(wx * speed - this.vel.x, -accel * dt, accel * dt);
      this.vel.z += clamp(wz * speed - this.vel.z, -accel * dt, accel * dt);
    } else {
      // Off the train: work with our real velocity over the ground.
      const tvz = train.velocity.z;
      let gx = this.vel.x;
      let gz = this.vel.z + tvz;
      const sp = Math.hypot(gx, gz);
      if (this.onGround && sp > speed + 1.5) {
        // Skidding in the dirt after being thrown off.
        const ns = Math.max(0, sp - 14 * dt);
        gx *= ns / sp;
        gz *= ns / sp;
      } else {
        const accel = (this.onGround ? 40 : 2 * control) * staggerFactor;
        gx += clamp(wx * speed - gx, -accel * dt, accel * dt);
        gz += clamp(wz * speed - gz, -accel * dt, accel * dt);
      }
      this.vel.x = gx;
      this.vel.z = gz - tvz;
    }

    // Only climb when facing the ladder.
    const ladder = this.aboard ? this.ladderAt() : null;
    this.onLadder = !!ladder && -cos * -ladder.faceSign > 0.2 && control > 0;
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
      if (jump && this.onGround && !this.crouching) this.vel.y = C.jumpSpeed;
    }

    const wasOnGround = this.onGround;
    const landingSpeed = Math.hypot(this.vel.x, this.vel.z + train.velocity.z);
    this.gatherColliders();
    this.onGround = false;
    this.moveAxis('x', this.vel.x * dt);
    this.moveAxis('z', this.vel.z * dt);
    this.moveAxis('y', this.vel.y * dt);
    this.groundClamp(wasOnGround && this.groundKind === 'ground');

    if (this.onGround && !wasOnGround && this.groundKind === 'ground') this.onLand(landingSpeed);
    if (this.onGround && this.groundKind === 'train' && this.aboard) this.knockedOff = false;

    // Head bob while walking.
    const hs = this.aboard ? Math.hypot(this.vel.x, this.vel.z) : Math.hypot(this.vel.x, this.vel.z + train.velocity.z);
    if (this.onGround && hs > 0.5 && hs < 8) this.bob += dt * hs * 2.4;
  }

  updateCrouch(want) {
    if (want && !this.crouching) {
      this.crouching = true;
      this.height = C.crouchHeight;
    } else if (!want && this.crouching) {
      // Only stand up if there's head room.
      if (this.freeAt(this.local.x, this.local.y, this.local.z, C.height)) {
        this.crouching = false;
        this.height = C.height;
      }
    }
  }

  // Train boxes plus anything solid at a stop (shifted into train space).
  gatherColliders() {
    const extra = this._extra;
    extra.length = 0;
    const stops = this.game.stops;
    if (!stops || this.aboard) return;
    const tp = this.train.position;
    const f = this.feetWorld();
    for (const c of stops.collidersNear(f.x, f.z, [])) extra.push({ min: c.min.clone().sub(tp), max: c.max.clone().sub(tp) });
  }

  *colliders() {
    yield* this.train.colliders;
    yield* this._extra;
  }

  overlaps(c, x, y, z, h = this.height) {
    const r = C.radius;
    return x + r > c.min.x && x - r < c.max.x && y + h > c.min.y && y < c.max.y && z + r > c.min.z && z - r < c.max.z;
  }

  freeAt(x, y, z, h = this.height) {
    for (const c of this.colliders()) if (this.overlaps(c, x, y, z, h)) return false;
    return true;
  }

  // Move along one axis and push back out of anything we walked into.
  moveAxis(axis, delta) {
    if (delta === 0) return;
    const p = this.local;
    p[axis] += delta;
    for (const c of this.colliders()) {
      if (c.low && this.tumble > 0) continue; // thrown over the railing
      if (!this.overlaps(c, p.x, p.y, p.z)) continue;
      if (axis === 'y') {
        if (delta < 0) {
          p.y = c.max.y;
          this.onGround = true;
          this.groundKind = this.train.colliders.includes(c) ? 'train' : 'ground';
        } else {
          p.y = c.min.y - this.height - 1e-4;
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

  // Stand on the desert floor (the train sits at y = 0, so local y = world y).
  // `stick` keeps us glued to the ground when walking downhill.
  groundClamp(stick) {
    const tp = this.train.position;
    const gh = groundHeight(this.local.x + tp.x, this.local.z + tp.z);
    const snap = stick && !this.onGround && this.vel.y <= 0 ? 0.25 : 1e-3;
    if (this.local.y <= gh + snap) {
      this.local.y = gh;
      if (this.vel.y < 0) this.vel.y = 0;
      this.onGround = true;
      this.groundKind = 'ground';
    }
  }

  onLand(speed) {
    const { hud, sound } = this.game;
    sound.thud(Math.min(1, speed / 15));
    this.kickJolt(0.6 + Math.min(1.5, speed / 10), 0, (Math.random() - 0.5) * 2);
    if (speed > C.hardLandingSpeed) {
      this.hurt(C.hardLandingDamage, 'Thrown from the train.');
      hud.hurt(false);
      this.stagger = 0.6;
    }
  }

  ladderAt() {
    for (const l of this.train.ladders) if (this.overlaps(l, this.local.x, this.local.y, this.local.z)) return l;
    return null;
  }

  // ---- getting hit -----------------------------------------------------------

  // An arrow hit us. `arrowVel` is the arrow's world velocity.
  hitByArrow(arrowVel, head) {
    const dmg = head ? CONFIG.damage.playerHead : CONFIG.damage.playerBody;
    this.hurt(dmg, head ? 'An arrow to the head.' : 'Shot down by bandits.');
    if (this.dead) return;

    // Which way the arrow was travelling, relative to the frame we stand in.
    const dir = arrowVel.clone();
    if (this.aboard) dir.sub(this.train.velocity);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
    dir.normalize();

    let strength = (head ? 1 : S.bodyStrength) * rand(0.75, 1.25);
    if (this.crouching) strength *= S.crouchFactor;

    // The shove, a moment of shaky footing, and a camera jolt.
    if (!this.reel) {
      this.vel.x += dir.x * S.push * strength;
      this.vel.z += dir.z * S.push * strength;
      this.vel.y += 0.6 * strength;
    }
    this.stagger = Math.max(this.stagger, 0.35 * strength);
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const side = dir.dot(right);
    this.kickJolt(2.2 * strength, -side * 3 * strength, side * 4 * strength);

    if (this.aboard && !this.reel && strength >= S.knockOffThreshold) this.tryKnockOff(dir);
  }

  tryKnockOff(dir) {
    const p = this.local;
    const inCab = p.z > -12.6 && p.z < -9.3 && p.y < 3;
    if (inCab) return;
    const onRoof = p.y > 3.0;
    const edgeSide = Math.abs(p.x) > 0.9 ? Math.sign(p.x) : 0;
    const side = Math.abs(dir.x) > 0.25 ? Math.sign(dir.x) : edgeSide || Math.sign(p.x) || 1;
    if (!onRoof && !(edgeSide && side === edgeSide)) return;
    // Over you go.
    this.vel.x = side * S.knockOffSpeed;
    this.vel.y = 3.2;
    this.vel.z += dir.z * 2;
    this.tumble = 0.7;
    this.knockedOff = true;
    this.crouching = false;
    this.height = C.height;
    this.kickJolt(3, side * 2, -side * 7);
    this.game.hud.knockedOff();
    this.game.sound.whoosh();
  }

  kickJolt(pitch, yaw, roll) {
    this.joltV.x += pitch;
    this.joltV.y += yaw;
    this.joltV.z += roll;
  }

  updateJolt(dt) {
    // A stiff spring pulls the view back to where you were aiming.
    const j = this.jolt;
    const v = this.joltV;
    v.addScaledVector(j, -140 * dt).multiplyScalar(Math.max(0, 1 - 13 * dt));
    j.addScaledVector(v, dt);
  }

  // ---- grapple -----------------------------------------------------------------

  // The hook bit into the train at `anchor` (train space): haul us in.
  startReel(anchor) {
    const landing = this.train.landingSpot(anchor);
    this.reel = { anchor: anchor.clone().setY(anchor.y - 1.0), landing, phase: 0 };
    this.tumble = 0;
    this.crouching = false;
    this.height = C.height;
    this.onGround = false;
    this.onLadder = false;
  }

  updateReel(dt) {
    const r = this.reel;
    const target = r.phase === 0 ? r.anchor : r.landing;
    const d = target.clone().sub(this.local);
    const len = d.length();
    const speed = G.reelSpeed * (r.phase === 0 ? 1 : 0.55);
    const step = speed * dt;
    if (len <= step || (r.phase === 0 && len < 1.2)) {
      if (r.phase === 0) {
        r.phase = 1;
        return;
      }
      this.local.copy(r.landing);
      this.vel.set(0, 0, 0);
      this.reel = null;
      this.aboard = true;
      this.knockedOff = false;
      this.onGround = true;
      this.groundKind = 'train';
      this.kickJolt(1.2, 0, 0);
      this.game.sound.thud(0.6);
      return;
    }
    d.multiplyScalar(1 / len);
    this.local.addScaledVector(d, step);
    this.vel.copy(d).multiplyScalar(speed);
    this.aboard = this.train.inFootprint(this.local);
  }

  // Put us down on the train (climbing aboard at a stop).
  climbAboard() {
    const spot = this.train.landingSpot(this.local.clone().setY(this.local.y + 1));
    this.local.copy(spot);
    this.vel.set(0, 0, 0);
    this.aboard = true;
    this.knockedOff = false;
    this.onGround = true;
    this.groundKind = 'train';
  }

  // How far (horizontally) our feet are from the train's footprint.
  distanceToTrain() {
    const p = this.local;
    const dx = Math.max(0, Math.abs(p.x) - 1.6);
    const dz = Math.max(0, -24 - p.z, p.z - 24);
    return Math.hypot(dx, dz);
  }

  // ---- health ------------------------------------------------------------------

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
  applyCamera(camera, time, dt = 0) {
    const target = this.crouching ? C.crouchEyeHeight : C.eyeHeight;
    this.eye += (target - this.eye) * Math.min(1, dt * 14);
    this.eyeWorld(camera.position);
    camera.position.y += Math.sin(this.bob) * 0.035;
    // Tiny rail vibration (only while riding a moving train).
    if (this.aboard && this.train.speed > 0.5) camera.position.y += Math.sin(time * 37) * 0.004 + Math.sin(time * 23.3) * 0.003;
    const j = this.jolt;
    camera.rotation.set(clamp(this.pitch + j.x * 0.35, -1.55, 1.55), this.yaw + j.y * 0.35, j.z * 0.35, 'YXZ');
  }
}
