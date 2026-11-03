import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flat } from '../core/materials.js';
import { segmentBox } from '../core/math.js';
import { groundHeight } from '../world/terrain.js';

// Every arrow in flight, and every arrow stuck in something.
//
// Flight is plain physics (§B): the arrow keeps its velocity, gravity pulls
// it down and a tiny bit of air drag slows it. Each frame we trace the
// short line segment it travelled and check what it hit first.

const Z = new THREE.Vector3(0, 0, 1);
const LENGTH = 0.9; // tip to nock, as in reference 0.7
const EMBED = 0.2; // how far the tip sinks into what it hits
const MAX_STUCK_IN_TRAIN = 70;
const TRAIL_N = 12; // a thread, not a comet (§U)

// The arrow points along +Z with its tip at the origin.
const geo = {
  shaft: new THREE.CylinderGeometry(0.013, 0.013, 0.8, 5).rotateX(Math.PI / 2).translate(0, 0, -0.5),
  head: new THREE.ConeGeometry(0.035, 0.12, 4).rotateX(Math.PI / 2).translate(0, 0, -0.06),
  fletchA: new THREE.BoxGeometry(0.004, 0.07, 0.11).translate(0, 0.035, -0.83),
  fletchB: new THREE.BoxGeometry(0.07, 0.004, 0.11).translate(0.035, 0, -0.83),
};
const mats = {
  shaft: flat(0xc9b48a),
  head: flat(0x3a3a3a),
  playerFletch: flat(0xf1efe6),
  enemyFletch: flat(0xc83c2c),
};

function makeArrowMesh(owner) {
  const g = new THREE.Group();
  const fm = owner === 'player' ? mats.playerFletch : mats.enemyFletch;
  g.add(
    new THREE.Mesh(geo.shaft, mats.shaft),
    new THREE.Mesh(geo.head, mats.head),
    new THREE.Mesh(geo.fletchA, fm),
    new THREE.Mesh(geo.fletchB, fm),
  );
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

// The trail: a thin glowing ribbon through the arrow's last few positions,
// 3 cm wide at the arrow fading to 4 mm. Pale blue-white for yours,
// orange-red for theirs.
const trailMat = new THREE.MeshBasicMaterial({
  vertexColors: true,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide,
  fog: false,
});

function makeTrail(owner, pos) {
  const n = TRAIL_N;
  const col = new Float32Array(n * 2 * 3);
  const br = owner === 'player' ? [0.7, 0.8, 0.85] : [0.9, 0.38, 0.2];
  for (let i = 0; i < n; i++) {
    const f = Math.pow(1 - i / (n - 1), 1.6);
    for (let j = 0; j < 2; j++) col.set([br[0] * f, br[1] * f, br[2] * f], (i * 2 + j) * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const idx = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, trailMat);
  mesh.frustumCulled = false;
  const pts = [];
  for (let i = 0; i < n; i++) pts.push(pos.clone());
  return { mesh, pts, count: 1 };
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function updateTrail(tr, p, eye) {
  const n = TRAIL_N;
  for (let i = Math.min(tr.count, n - 1); i > 0; i--) tr.pts[i].copy(tr.pts[i - 1]);
  tr.pts[0].copy(p);
  if (tr.count < n) tr.count++;
  const arr = tr.mesh.geometry.attributes.position.array;
  for (let i = 0; i < n; i++) {
    const q = tr.pts[Math.min(i, tr.count - 1)];
    const a = tr.pts[Math.max(0, Math.min(i - 1, tr.count - 1))];
    const b = tr.pts[Math.min(i + 1, tr.count - 1)];
    // Spread the ribbon sideways, square on to the camera.
    _a.subVectors(a, b);
    if (_a.lengthSq() < 1e-8) _a.set(0, 1, 0);
    _b.subVectors(q, eye);
    _c.crossVectors(_a, _b);
    if (_c.lengthSq() < 1e-8) _c.set(1, 0, 0);
    _c.normalize();
    const w = 0.004 + 0.026 * (1 - i / (n - 1));
    arr.set([q.x + _c.x * w, q.y + _c.y * w, q.z + _c.z * w, q.x - _c.x * w, q.y - _c.y * w, q.z - _c.z * w], i * 6);
  }
  tr.mesh.geometry.attributes.position.needsUpdate = true;
}

export class ArrowSystem {
  constructor(game) {
    this.game = game;
    this.flying = [];
    this.stuck = []; // { mesh, where: 'train'|'ground', age }
  }

  // pos: where the tip starts (world). vel: world velocity.
  spawn(pos, vel, owner) {
    const mesh = makeArrowMesh(owner);
    mesh.position.copy(pos);
    this.game.scene.add(mesh);
    // `fresh`: it was spawned from where things are *after* this frame's
    // move, so it skips one step instead of moving twice.
    const a = { mesh, pos: pos.clone(), vel: vel.clone(), owner, age: 0, fresh: true, trail: makeTrail(owner, pos) };
    this.game.scene.add(a.trail.mesh);
    this.orient(a);
    this.flying.push(a);
  }

  orient(a) {
    a.mesh.position.copy(a.pos);
    a.mesh.quaternion.setFromUnitVectors(Z, a.vel.clone().normalize());
  }

  removeFlying(i) {
    const a = this.flying[i];
    this.game.scene.remove(a.trail.mesh);
    a.trail.mesh.geometry.dispose();
    this.flying.splice(i, 1);
  }

  update(dt) {
    const g = CONFIG.gravity;
    const { train, player } = this.game;
    const trainPrev = train.position.clone().addScaledVector(train.velocity, -dt);

    for (let i = this.flying.length - 1; i >= 0; i--) {
      const a = this.flying[i];
      if (a.fresh) {
        a.fresh = false;
        continue;
      }
      const p0 = a.pos.clone();
      a.vel.y -= g * dt;
      const sp = a.vel.length();
      if (sp > 0) a.vel.multiplyScalar(Math.max(0, 1 - CONFIG.bow.drag * sp * dt));
      a.pos.addScaledVector(a.vel, dt);
      a.age += dt;
      const hit = this.trace(p0, a.pos, trainPrev, a, dt);
      if (hit) {
        this.resolveHit(a, hit, p0);
        this.removeFlying(i);
        continue;
      }
      this.orient(a);
      updateTrail(a.trail, a.pos, this.game.camera.position);
      if (a.age > CONFIG.bow.life) {
        this.game.scene.remove(a.mesh);
        this.removeFlying(i);
      }
    }

    // Tidy up arrows stuck in the ground far behind us.
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const s = this.stuck[i];
      s.age += dt;
      if (s.where === 'ground' && s.age > CONFIG.bow.groundTime) {
        this.game.scene.remove(s.mesh);
        this.stuck.splice(i, 1);
      }
    }

    this.collect(player);
  }

  // Find the first thing the segment p0->p1 hits.
  trace(p0, p1, trainPrev, a, dt) {
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
      for (const b of player.hitBoxes()) {
        const h = segmentBox(r0, r1, b.min, b.max);
        if (h) consider({ t: h.t, type: 'player', head: b.head });
      }
    }

    if (a.owner === 'player') consider(bandits.trace(p0, p1, dt));
    return best;
  }

  resolveHit(a, hit, p0) {
    const { train, scene, sound, player, bandits, hud } = this.game;
    const point = p0.clone().lerp(a.pos, hit.t);
    const dir = a.vel.clone().normalize();

    if (hit.type === 'train') {
      // Stick into the train, in train space, so it rides along with us.
      const rel = hit.r1.clone().sub(hit.r0).normalize();
      const local = hit.r0.clone().lerp(hit.r1, hit.t).addScaledVector(rel, EMBED);
      a.mesh.position.copy(local);
      a.mesh.quaternion.setFromUnitVectors(Z, rel);
      scene.remove(a.mesh);
      train.group.add(a.mesh);
      this.stuck.push({ mesh: a.mesh, where: 'train', age: 0 });
      const inTrain = this.stuck.filter((s) => s.where === 'train');
      if (inTrain.length > MAX_STUCK_IN_TRAIN) this.removeStuck(inTrain[0]);
      sound.thunk(point, player);
    } else if (hit.type === 'ground') {
      a.mesh.position.copy(point).addScaledVector(dir, EMBED);
      a.mesh.quaternion.setFromUnitVectors(Z, dir);
      this.stuck.push({ mesh: a.mesh, where: 'ground', age: 0 });
    } else if (hit.type === 'player') {
      scene.remove(a.mesh);
      const dmg = hit.head ? CONFIG.damage.playerHead : CONFIG.damage.playerBody;
      player.hurt(dmg, hit.head ? 'An arrow to the head.' : 'Shot down by bandits.');
      hud.hurt(hit.head);
      sound.hurt();
    } else if (hit.type === 'bandit') {
      // Stick into the horse or rider so it travels with them.
      const part = hit.part;
      part.updateMatrixWorld(true);
      const local = part.worldToLocal(point.clone().addScaledVector(dir, EMBED));
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

  // Walk up to arrows stuck in the train to pick them up.
  collect(player) {
    if (player.dead || player.arrows >= CONFIG.player.maxArrows) return;
    const centre = player.local.clone();
    centre.y += 0.9;
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      const s = this.stuck[i];
      if (s.where !== 'train') continue;
      // The middle of the arrow's shaft (the tip is buried).
      const mid = new THREE.Vector3(0, 0, -LENGTH / 2).applyQuaternion(s.mesh.quaternion).add(s.mesh.position);
      if (mid.distanceTo(centre) < CONFIG.player.pickupRadius) {
        this.removeStuck(s);
        player.arrows++;
        this.game.hud.pickup();
        this.game.sound.pickup();
        if (player.arrows >= CONFIG.player.maxArrows) return;
      }
    }
  }
}
