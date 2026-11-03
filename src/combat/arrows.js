import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flat } from '../core/materials.js';
import { segmentBox } from '../core/math.js';
import { groundHeight } from '../world/terrain.js';

// Every arrow in flight, and every arrow stuck in something.
//
// Flight is plain physics: the arrow keeps its velocity and gravity pulls
// it down (no drag, no speed-ups). Each frame we trace the little line
// segment it travelled through and check what it hit first.

const Z = new THREE.Vector3(0, 0, 1);
const LENGTH = 0.78;
const MAX_STUCK_IN_TRAIN = 70;
const TRAIL_POINTS = 10;

const geo = {
  shaft: new THREE.CylinderGeometry(0.011, 0.011, LENGTH, 5).rotateX(Math.PI / 2).translate(0, 0, -LENGTH / 2),
  head: new THREE.ConeGeometry(0.025, 0.09, 4).rotateX(Math.PI / 2).translate(0, 0, -0.03),
  fletch: new THREE.BoxGeometry(0.004, 0.05, 0.14).translate(0, 0.03, -LENGTH + 0.1),
};
const mats = {
  shaft: flat(0xb08850),
  head: flat(0x3a3a3a, { metalness: 0.6, roughness: 0.4 }),
  playerFletch: flat(0xf2efe6),
  enemyFletch: flat(0xb02a22),
};

function makeArrowMesh(owner) {
  // The arrow points along +Z with its tip at the origin.
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo.shaft, mats.shaft), new THREE.Mesh(geo.head, mats.head));
  const fm = owner === 'player' ? mats.playerFletch : mats.enemyFletch;
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(geo.fletch, fm);
    f.rotation.z = (i / 3) * Math.PI * 2;
    g.add(f);
  }
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

export class ArrowSystem {
  constructor(game) {
    this.game = game;
    this.flying = [];
    this.stuck = []; // { mesh, where: 'train'|'ground'|'body', age }
    this.trailMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
  }

  // pos: where the tip starts (world). vel: world velocity.
  spawn(pos, vel, owner) {
    const mesh = makeArrowMesh(owner);
    mesh.position.copy(pos);
    this.game.scene.add(mesh);
    const a = { mesh, pos: pos.clone(), vel: vel.clone(), owner, age: 0, trail: null };
    if (owner === 'player') {
      const tg = new THREE.BufferGeometry();
      const arr = new Float32Array(TRAIL_POINTS * 3);
      for (let i = 0; i < TRAIL_POINTS; i++) arr.set([pos.x, pos.y, pos.z], i * 3);
      tg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      a.trail = new THREE.Line(tg, this.trailMat);
      a.trail.frustumCulled = false;
      this.game.scene.add(a.trail);
    }
    this.orient(a);
    this.flying.push(a);
  }

  orient(a) {
    a.mesh.position.copy(a.pos);
    a.mesh.quaternion.setFromUnitVectors(Z, a.vel.clone().normalize());
  }

  removeFlying(i) {
    const a = this.flying[i];
    if (a.trail) {
      this.game.scene.remove(a.trail);
      a.trail.geometry.dispose();
    }
    this.flying.splice(i, 1);
  }

  update(dt) {
    const g = CONFIG.gravity;
    const { train, player } = this.game;
    const trainPrev = train.position.clone().addScaledVector(train.velocity, -dt);

    for (let i = this.flying.length - 1; i >= 0; i--) {
      const a = this.flying[i];
      const p0 = a.pos.clone();
      a.vel.y -= g * dt;
      a.pos.addScaledVector(a.vel, dt);
      a.age += dt;
      const hit = this.trace(p0, a.pos, trainPrev, a);
      if (hit) {
        this.resolveHit(a, hit, p0);
        this.removeFlying(i);
        continue;
      }
      this.orient(a);
      if (a.trail) {
        const arr = a.trail.geometry.attributes.position.array;
        arr.copyWithin(3, 0, (TRAIL_POINTS - 1) * 3);
        arr[0] = a.pos.x;
        arr[1] = a.pos.y;
        arr[2] = a.pos.z;
        a.trail.geometry.attributes.position.needsUpdate = true;
      }
      if (a.age > 12) {
        this.game.scene.remove(a.mesh);
        this.removeFlying(i);
      }
    }

    // Tidy up arrows stuck in the ground far behind us (and the player).
    const backZ = Math.max(train.position.z, player.feetWorld().z);
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const s = this.stuck[i];
      s.age += dt;
      if (s.where === 'ground' && (s.mesh.position.z > backZ + 300 || s.age > 90)) {
        this.game.scene.remove(s.mesh);
        this.stuck.splice(i, 1);
      }
    }
  }

  // Find the first thing the segment p0->p1 hits.
  trace(p0, p1, trainPrev, a) {
    const { train, player, bandits } = this.game;
    let best = null;
    const consider = (h) => {
      if (h && (!best || h.t < best.t)) best = h;
    };

    // Ground
    const g1 = p1.y - groundHeight(p1.x, p1.z);
    if (g1 < 0) {
      const g0 = p0.y - groundHeight(p0.x, p0.z);
      consider({ t: g0 <= 0 ? 0 : g0 / (g0 - g1), type: 'ground' });
    }

    // Train (worked out in train space so the moving train is handled right)
    const r0 = p0.clone().sub(trainPrev);
    const r1 = p1.clone().sub(train.position);
    for (const c of train.colliders) {
      const h = segmentBox(r0, r1, c.min, c.max);
      if (h) consider({ t: h.t, type: 'train', r0, r1 });
    }

    if (a.owner === 'enemy' && !player.dead) {
      // Worked out relative to the player's feet, wherever they are.
      const q0 = p0.clone().sub(player.prevFeet);
      const q1 = p1.clone().sub(player.feetWorld());
      for (const b of player.hitBoxes()) {
        const h = segmentBox(q0, q1, b.min, b.max);
        if (h) consider({ t: h.t, type: 'player', head: b.head });
      }
    }

    if (a.owner === 'player') consider(bandits.trace(p0, p1));
    return best;
  }

  resolveHit(a, hit, p0) {
    const { train, scene, sound, player, bandits, hud } = this.game;
    const point = p0.clone().lerp(a.pos, hit.t);
    const dir = a.vel.clone().normalize();

    if (hit.type === 'train') {
      // Stick into the train, in train space, so it rides along with us.
      const rel = hit.r1.clone().sub(hit.r0).normalize();
      const local = hit.r0.clone().lerp(hit.r1, hit.t).addScaledVector(rel, 0.1);
      a.mesh.position.copy(local);
      a.mesh.quaternion.setFromUnitVectors(Z, rel);
      scene.remove(a.mesh);
      train.group.add(a.mesh);
      this.stuck.push({ mesh: a.mesh, where: 'train', age: 0 });
      const inTrain = this.stuck.filter((s) => s.where === 'train');
      if (inTrain.length > MAX_STUCK_IN_TRAIN) this.removeStuck(inTrain[0]);
      sound.thunk(point, player);
    } else if (hit.type === 'ground') {
      a.mesh.position.copy(point).addScaledVector(dir, 0.15);
      a.mesh.quaternion.setFromUnitVectors(Z, dir);
      this.stuck.push({ mesh: a.mesh, where: 'ground', age: 0 });
    } else if (hit.type === 'player') {
      scene.remove(a.mesh);
      player.hitByArrow(a.vel, hit.head);
      hud.hurt(hit.head);
      sound.hurt();
    } else if (hit.type === 'bandit') {
      // Stick into the horse or rider so it travels with them.
      const part = hit.part;
      part.updateMatrixWorld(true);
      const local = part.worldToLocal(point.clone().addScaledVector(dir, 0.12));
      const q = part.getWorldQuaternion(new THREE.Quaternion()).invert();
      a.mesh.position.copy(local);
      a.mesh.quaternion.setFromUnitVectors(Z, dir).premultiply(q);
      scene.remove(a.mesh);
      part.add(a.mesh);
      bandits.onArrowHit(hit, a.vel);
    }
  }

  removeStuck(s) {
    s.mesh.parent?.remove(s.mesh);
    this.stuck.splice(this.stuck.indexOf(s), 1);
  }

  // Arrows close enough to pull out (stuck in the train, or in the dirt).
  reachable(player) {
    const out = [];
    if (player.dead) return out;
    const centre = player.local.clone();
    centre.y += player.height * 0.55;
    const world = player.feetWorld().setY(player.feetWorld().y + player.height * 0.55);
    const reach = CONFIG.player.reach;
    for (const s of this.stuck) {
      if (s.where === 'body') continue;
      // The middle of the arrow's shaft (the tip is buried).
      const mid = new THREE.Vector3(0, 0, -LENGTH / 2).applyQuaternion(s.mesh.quaternion).add(s.mesh.position);
      const d = s.where === 'train' ? mid.distanceTo(centre) : mid.distanceTo(world);
      if (d < reach) out.push(s);
    }
    return out;
  }

  // Right click: pull every arrow within reach into the quiver.
  pull(player) {
    let n = 0;
    for (const s of this.reachable(player)) {
      if (player.arrows >= CONFIG.player.maxArrows) break;
      this.removeStuck(s);
      player.arrows++;
      n++;
    }
    if (n) {
      this.game.hud.pickup(n);
      this.game.sound.pickup();
    }
    return n;
  }
}
