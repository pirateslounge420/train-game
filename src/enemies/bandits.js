import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flat } from '../core/materials.js';
import { clamp, rand, segmentBox, solveBallistic } from '../core/math.js';
import { groundHeight } from '../world/terrain.js';

const E = CONFIG.enemies;
const D = CONFIG.damage;

// Hit zones (§U): every painted box of the horse and rider is its own hit
// box, tested in that part's own frame and padded a little: 7 cm on
// bodies and heads, 9 cm on arms, legs and tails. When an arrow clips
// several parts within 0.3 m of each other, the lowest priority wins
// (the head beats the body behind it).
const ZONES = {
  riderHead: { pri: 1 },
  horseHead: { pri: 4 },
  riderBody: { pri: 10 },
  horseBody: { pri: 12 },
};
const PAD_BODY = 0.07;
const PAD_LIMB = 0.09;
const PRIORITY_WINDOW = 0.3; // metres

const HORSE_COATS = [0x6b3e22, 0x3a2618, 0xb98a52, 0x8a5a34, 0x2a2420, 0xd8cfc0];
const COATS = [0x5a4632, 0x3d3a36, 0x6e4a2c, 0x2e2a28, 0x7a6248];
const BANDANAS = [0xa8261e, 0x2a4a7a, 0x1f1f1f, 0x8a6a20];

function box(w, h, d, color, x, y, z, parent, zone = null, pad = PAD_BODY) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  if (zone) {
    m.userData.hit = {
      zone,
      min: new THREE.Vector3(-w / 2 - pad, -h / 2 - pad, -d / 2 - pad),
      max: new THREE.Vector3(w / 2 + pad, h / 2 + pad, d / 2 + pad),
    };
  }
  return m;
}

// Every mesh under `root` that carries a hit box.
function hitParts(root) {
  const list = [];
  root.traverse((o) => o.userData.hit && list.push(o));
  return list;
}

function buildHorse() {
  const g = new THREE.Group();
  const coat = HORSE_COATS[Math.floor(Math.random() * HORSE_COATS.length)];
  const dark = 0x1c1612;
  box(0.62, 0.7, 1.7, coat, 0, 1.3, 0, g, 'horseBody'); // body
  const neck = box(0.3, 0.8, 0.38, coat, 0, 1.78, -0.88, g, 'horseHead');
  neck.rotation.x = -0.65;
  const head = box(0.26, 0.28, 0.62, coat, 0, 2.02, -1.3, g, 'horseHead');
  head.rotation.x = 0.45;
  box(0.08, 0.5, 0.3, dark, 0, 1.95, -0.8, g).rotation.x = -0.65; // mane
  for (const s of [-1, 1]) box(0.06, 0.14, 0.06, coat, s * 0.08, 2.22, -1.12, g); // ears
  const tail = box(0.1, 0.7, 0.12, dark, 0, 1.25, 0.95, g, 'horseBody', PAD_LIMB);
  tail.rotation.x = 0.4;
  box(0.66, 0.06, 0.6, 0x7a2a1e, 0, 1.66, 0.0, g, 'horseBody'); // saddle blanket
  box(0.42, 0.12, 0.5, 0x4a2c18, 0, 1.72, 0.02, g); // saddle
  const legs = [];
  for (const [x, z] of [[-0.2, -0.65], [0.2, -0.65], [-0.2, 0.65], [0.2, 0.65]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.1, z);
    box(0.14, 0.95, 0.16, coat, 0, -0.47, 0, pivot, 'horseBody', PAD_LIMB);
    box(0.15, 0.12, 0.18, dark, 0, -1.02, 0, pivot, 'horseBody', PAD_LIMB);
    g.add(pivot);
    legs.push(pivot);
  }
  return { group: g, legs };
}

function buildRider() {
  const g = new THREE.Group(); // origin on the ground under the saddle
  const coat = COATS[Math.floor(Math.random() * COATS.length)];
  const skin = 0xc08a62;
  for (const s of [-1, 1]) {
    const leg = box(0.16, 0.62, 0.2, 0x3a3028, s * 0.36, 1.48, -0.05, g, 'riderBody', PAD_LIMB);
    leg.rotation.z = s * 0.2;
    box(0.17, 0.16, 0.26, 0x1c1612, s * 0.42, 1.14, -0.1, g, 'riderBody', PAD_LIMB); // boots
  }
  // Upper body turns to aim at the player.
  const upper = new THREE.Group();
  upper.position.set(0, 1.7, 0);
  g.add(upper);
  box(0.44, 0.62, 0.28, coat, 0, 0.3, 0, upper, 'riderBody'); // torso
  box(0.46, 0.22, 0.3, coat, 0, 0.0, 0, upper, 'riderBody'); // coat tails
  const head = new THREE.Group();
  head.position.set(0, 0.76, 0);
  upper.add(head);
  box(0.22, 0.25, 0.22, skin, 0, 0, 0, head, 'riderHead');
  box(0.235, 0.12, 0.235, BANDANAS[Math.floor(Math.random() * BANDANAS.length)], 0, -0.06, 0, head, 'riderHead');
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 10), flat(0x4a3424));
  brim.position.y = 0.14;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.17, 8), flat(0x4a3424));
  crown.position.y = 0.23;
  head.add(brim, crown);
  // Arms: left holds the bow out toward the target, right draws.
  const bowArm = new THREE.Group();
  bowArm.position.set(-0.26, 0.55, 0);
  upper.add(bowArm);
  box(0.12, 0.12, 0.6, coat, 0, 0, -0.3, bowArm, 'riderBody', PAD_LIMB);
  const bow = new THREE.Group();
  bow.position.set(0, 0, -0.62);
  bowArm.add(bow);
  for (const s of [-1, 1]) {
    const limb = box(0.03, 0.5, 0.04, 0x5a3418, 0, s * 0.24, 0.05, bow);
    limb.rotation.x = s * 0.25;
  }
  box(0.01, 0.92, 0.01, 0xe8e0cc, 0, 0, 0.14, bow);
  const drawArm = new THREE.Group();
  drawArm.position.set(0.26, 0.55, 0);
  upper.add(drawArm);
  box(0.12, 0.12, 0.45, coat, 0, 0, -0.18, drawArm, 'riderBody', PAD_LIMB);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return { group: g, upper, bowArm, drawArm, head };
}

class Bandit {
  constructor(mgr, side, slotZ) {
    this.mgr = mgr;
    this.side = side;
    this.slotX = side * rand(7.5, 14);
    this.slotZ = slotZ;
    this.slotTimer = rand(6, 12);

    this.root = new THREE.Group();
    const h = buildHorse();
    this.horse = h.group;
    this.legs = h.legs;
    this.root.add(this.horse);
    const r = buildRider();
    this.rider = r.group;
    this.riderParts = r;
    this.root.add(this.rider);
    mgr.scene.add(this.root);
    this.horseHits = hitParts(this.horse);
    this.riderHits = hitParts(this.rider);
    this.moved = new THREE.Vector3(); // how far we moved this frame

    const t = mgr.game.train;
    this.pos = new THREE.Vector3(side * (Math.abs(this.slotX) + 6), 0, t.position.z + rand(55, 85));
    this.vel = t.velocity.clone();
    this.yaw = 0;
    this.phase = Math.random() * 6;

    this.riderHp = E.riderHealth;
    this.horseHp = E.horseHealth;
    this.mounted = true;
    this.horseAlive = true;
    this.horseRoll = 0;
    this.shootTimer = rand(1.5, 3.5);
    this.aim = 0;
  }

  get active() {
    return this.mounted && this.horseAlive;
  }

  update(dt) {
    const { train, player } = this.mgr.game;
    const g = CONFIG.gravity;

    if (this.horseAlive) {
      let wantVx, wantVz;
      if (this.mounted) {
        // Ride toward our slot beside the train.
        this.slotTimer -= dt;
        if (this.slotTimer <= 0) {
          this.slotTimer = rand(6, 12);
          this.slotZ = rand(-24, 22);
          this.slotX = this.side * rand(7.5, 14);
        }
        const tz = train.position.z + this.slotZ;
        wantVz = train.velocity.z + clamp((tz - this.pos.z) * 0.6, -E.maxExtraSpeed, E.maxExtraSpeed);
        wantVx = clamp((this.slotX - this.pos.x) * 0.8, -4, 4);
      } else {
        // Riderless: veer away from the tracks and slow down.
        wantVz = this.vel.z * 0.98;
        wantVx = this.side * 5;
      }
      const a = 5 * dt;
      this.vel.z += clamp(wantVz - this.vel.z, -a, a);
      this.vel.x += clamp(wantVx - this.vel.x, -a, a);
    } else {
      // Dead horse: tumble over and skid to a stop.
      this.horseRoll = Math.min(Math.PI / 2, this.horseRoll + dt * 3.2);
      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0) {
        const ns = Math.max(0, sp - 9 * dt);
        this.vel.x *= ns / sp;
        this.vel.z *= ns / sp;
      }
    }
    this.moved.copy(this.vel).multiplyScalar(dt);
    this.pos.addScaledVector(this.vel, dt);
    this.pos.y = groundHeight(this.pos.x, this.pos.z);

    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > 1) this.yaw = Math.atan2(-this.vel.x, -this.vel.z);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;

    // Gallop animation.
    if (this.horseAlive) {
      this.phase += dt * speed * 0.75;
      const p = this.phase;
      const amp = clamp(speed / 12, 0, 1) * 0.7;
      this.legs[0].rotation.x = Math.sin(p) * amp;
      this.legs[1].rotation.x = Math.sin(p + 0.5) * amp;
      this.legs[2].rotation.x = Math.sin(p + Math.PI) * amp;
      this.legs[3].rotation.x = Math.sin(p + Math.PI + 0.5) * amp;
      const bob = Math.abs(Math.sin(p)) * 0.12 * amp;
      this.horse.position.y = bob;
      this.horse.rotation.x = Math.sin(p) * 0.04 * amp;
      this.rider.position.y = bob * 0.8;
    } else {
      this.horse.rotation.z = this.horseRoll * this.side;
      this.horse.position.y = -(1 - Math.cos(this.horseRoll)) * 0.85;
      for (const l of this.legs) l.rotation.x *= 0.9;
    }

    if (this.active) this.updateShooting(dt, player, train, g);
    this.root.updateMatrixWorld(true);
  }

  updateShooting(dt, player, train, g) {
    const rp = this.riderParts;
    const target = player.chestWorld();
    // Turn the upper body toward the player.
    const local = this.root.worldToLocal(target.clone());
    const yaw = Math.atan2(-local.x, -local.z);
    rp.upper.rotation.y += (yaw - rp.upper.rotation.y) * Math.min(1, dt * 6);
    const dist = target.distanceTo(this.pos);

    const inRange = dist < E.shootRange && !player.dead;
    if (inRange) this.shootTimer -= dt;
    // Raise the bow just before shooting so you can see it coming.
    const aiming = inRange && this.shootTimer < 0.9;
    this.aim += ((aiming ? 1 : 0) - this.aim) * Math.min(1, dt * 6);
    rp.bowArm.rotation.x = -0.9 + this.aim * 0.9;
    rp.drawArm.rotation.x = -0.6 + this.aim * 0.6;
    rp.drawArm.position.z = this.aim * 0.12;

    if (inRange && this.shootTimer <= 0) {
      this.shootTimer = rand(E.shootIntervalMin, E.shootIntervalMax);
      this.shoot(player, train, g, target);
    }
  }

  shoot(player, train, g, target) {
    const origin = this.riderParts.bowArm.localToWorld(new THREE.Vector3(0, 0, -0.75));
    const d = target.clone().sub(origin);
    const w = this.vel.clone().sub(train.velocity); // our motion relative to the player
    const u = solveBallistic(d, w, E.arrowSpeed, g);
    if (!u) return;
    // Natural inaccuracy: nudge the shot by a random small angle.
    const err = THREE.MathUtils.degToRad(E.aimErrorDegrees) * rand(0.4, 1.4);
    const perp = new THREE.Vector3().randomDirection().cross(u).normalize();
    u.applyAxisAngle(perp, err * Math.random() * 1.2);
    const vel = u.add(this.vel); // the arrow keeps the horse's speed too
    this.mgr.game.arrows.spawn(origin, vel, 'enemy');
    this.mgr.game.sound.enemyTwang(origin, player);
  }

  // Test an arrow's path against every painted part (§U). The path is
  // shifted by how far we galloped this frame, so it is seen from the
  // rider's own point of view and fast riders don't slip between frames.
  // Adds candidate hits to `out`.
  trace(p0, p1, out) {
    const start = p0.clone().add(this.moved);
    const test = (parts) => {
      for (const m of parts) {
        const inv = new THREE.Matrix4().copy(m.matrixWorld).invert();
        const a = start.clone().applyMatrix4(inv);
        const b = p1.clone().applyMatrix4(inv);
        const h = segmentBox(a, b, m.userData.hit.min, m.userData.hit.max);
        if (h) out.push({ t: h.t, type: 'bandit', zone: m.userData.hit.zone, part: m, bandit: this });
      }
    };
    if (this.horseAlive) test(this.horseHits);
    if (this.mounted) test(this.riderHits);
  }

  onHit(zone, arrowVel) {
    const m = this.mgr;
    const push = arrowVel.clone().sub(this.vel).normalize();
    if (zone === 'riderHead') {
      this.riderHp = 0;
      this.dismount(push.multiplyScalar(3), true);
      m.report('headshot', 'HEADSHOT!');
    } else if (zone === 'riderBody') {
      this.riderHp -= D.riderBody;
      if (this.riderHp <= 0) {
        this.dismount(push.multiplyScalar(2.5), true);
        m.report('kill', 'Bandit down');
      } else if (Math.random() < D.knockOffChance) {
        this.dismount(push.multiplyScalar(3.5), false);
        m.report('kill', 'Knocked him off his horse!');
      } else m.report('hit', 'Hit');
    } else if (zone === 'horseHead') {
      this.killHorse();
      m.report('headshot', 'HORSE HEADSHOT — rider thrown!');
    } else if (zone === 'horseBody') {
      this.horseHp -= D.horseBody;
      if (this.horseHp <= 0) {
        this.killHorse();
        m.report('kill', 'Horse down — rider thrown!');
      } else if (this.mounted && Math.random() < D.buckOffChance) {
        this.dismount(new THREE.Vector3(0, 2, 0), false, true);
        m.report('kill', 'The horse bucked him off!');
      } else m.report('hit', 'Horse hit');
    }
  }

  killHorse() {
    this.horseAlive = false;
    this.horseHp = 0;
    if (this.mounted) {
      // Launched forward over the horse's head.
      const fwd = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      this.dismount(fwd.multiplyScalar(5).add(new THREE.Vector3(0, 4.5, 0)), false, true);
    }
  }

  // The rider leaves the horse and becomes a tumbling body.
  dismount(impulse, dead, launched = false) {
    if (!this.mounted) return;
    this.mounted = false;
    this.mgr.downed++;
    const r = this.rider;
    r.updateMatrixWorld(true);
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    r.matrixWorld.decompose(pos, quat, new THREE.Vector3());
    this.root.remove(r);
    // Re-parent onto a pivot at his middle so he tumbles about his centre.
    const pivot = new THREE.Group();
    pivot.position.copy(pos).add(new THREE.Vector3(0, 1.9, 0).applyQuaternion(quat));
    pivot.quaternion.copy(quat);
    r.position.set(0, -1.9, 0);
    r.quaternion.identity();
    pivot.add(r);
    this.mgr.scene.add(pivot);
    const vel = this.vel.clone().add(impulse);
    vel.y += launched ? 1 : 2;
    const spin = new THREE.Vector3(rand(-3, 3), rand(-2, 2), rand(-3, 3)).multiplyScalar(launched ? 2 : 1);
    this.mgr.bodies.push({ mesh: pivot, vel, spin, grounded: false });
  }

  dispose() {
    this.mgr.scene.remove(this.root);
  }
}

export class BanditManager {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.bandits = [];
    this.bodies = []; // fallen riders
    this.downed = 0;
    this.spawnTimer = 4;
  }

  update(dt) {
    const train = this.game.train;
    const active = this.bandits.filter((b) => b.active);
    const wanted = Math.min(E.maxCount, E.startCount + Math.floor(this.downed / 4));
    if (active.length < wanted) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawn(active);
        this.spawnTimer = rand(3, 6);
      }
    }

    for (let i = this.bandits.length - 1; i >= 0; i--) {
      const b = this.bandits[i];
      b.update(dt);
      if (!b.active && (b.pos.z > train.position.z + 220 || Math.abs(b.pos.x) > 120)) {
        b.dispose();
        this.bandits.splice(i, 1);
      }
    }

    // Fallen riders: fly, hit the dirt, tumble and skid to a stop.
    const g = CONFIG.gravity;
    for (let i = this.bodies.length - 1; i >= 0; i--) {
      const b = this.bodies[i];
      const m = b.mesh;
      if (!b.grounded) {
        b.vel.y -= g * dt;
        m.position.addScaledVector(b.vel, dt);
        m.rotation.x += b.spin.x * dt;
        m.rotation.y += b.spin.y * dt;
        m.rotation.z += b.spin.z * dt;
        if (m.position.y < groundHeight(m.position.x, m.position.z) + 0.3) {
          b.grounded = true;
          m.rotation.set(-Math.PI / 2, m.rotation.y, 0); // flat on his back
          m.position.y = groundHeight(m.position.x, m.position.z) + 0.2;
          b.vel.y = 0;
        }
      } else {
        const sp = Math.hypot(b.vel.x, b.vel.z);
        if (sp > 0) {
          const ns = Math.max(0, sp - 14 * dt);
          b.vel.multiplyScalar(ns / sp);
          m.position.addScaledVector(b.vel, dt);
          m.position.y = groundHeight(m.position.x, m.position.z) + 0.2;
        }
      }
      if (m.position.z > train.position.z + 220) {
        this.scene.remove(m);
        this.bodies.splice(i, 1);
      }
    }
  }

  spawn(active) {
    // Balance the sides and avoid stacking riders in the same spot.
    const left = active.filter((b) => b.side < 0).length;
    const right = active.length - left;
    const side = left === right ? (Math.random() < 0.5 ? -1 : 1) : left < right ? -1 : 1;
    let slotZ = rand(-24, 22);
    for (let tries = 0; tries < 8; tries++) {
      if (!active.some((b) => b.side === side && Math.abs(b.slotZ - slotZ) < 7)) break;
      slotZ = rand(-24, 22);
    }
    this.bandits.push(new Bandit(this, side, slotZ));
    this.game.hud.message(side < 0 ? 'Rider coming up on the left!' : 'Rider coming up on the right!');
  }

  // The part an arrow hits first, settling near-ties by priority (§F, §U).
  trace(p0, p1) {
    const hits = [];
    for (const b of this.bandits) {
      if (!b.horseAlive && !b.mounted) continue;
      if (b.pos.distanceToSquared(p1) > 100) continue;
      b.trace(p0, p1, hits);
    }
    if (!hits.length) return null;
    const segLen = p0.distanceTo(p1);
    const first = Math.min(...hits.map((h) => h.t));
    let best = null;
    for (const h of hits) {
      if ((h.t - first) * segLen > PRIORITY_WINDOW) continue;
      if (!best || ZONES[h.zone].pri < ZONES[best.zone].pri) best = h;
    }
    return best;
  }

  onArrowHit(hit, arrowVel) {
    hit.bandit.onHit(hit.zone, arrowVel);
  }

  report(kind, text) {
    this.game.hud.hitFeedback(kind, text);
    this.game.sound.hitFeedback(kind);
  }
}
