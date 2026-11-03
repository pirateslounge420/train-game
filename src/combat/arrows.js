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
const _g = new THREE.Vector3();
const _e = new THREE.Vector3(), _p0s = new THREE.Vector3(), _pv = new THREE.Vector3(), _c2 = new THREE.Vector3(), _sv = new THREE.Vector3(), _sw = new THREE.Vector3();
const HEAD_R = 0.24, BODY_R = 0.46; // your hit balls (reference 0.7)
// Where along a->b (0..1) the segment first comes within r of c, or -1.
function segSphere(a, b, c, r) {
  _sv.subVectors(b, a);
  const L2 = _sv.lengthSq();
  const t = L2 > 0 ? Math.min(1, Math.max(0, _sw.subVectors(c, a).dot(_sv) / L2)) : 0;
  return _sw.copy(a).addScaledVector(_sv, t).distanceToSquared(c) <= r * r ? t : -1;
}
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
      const hit = this.trace(p0, a.pos, a, dt);
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

  }

  // Find the first thing the segment p0->p1 hits.
  trace(p0, p1, a, dt) {
    const { train, player, riders } = this.game;
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

    // Each car, worked out in its own frame (where it was last frame to
    // where it is now), so the moving, turning train is handled right.
    for (const car of train.cars) {
      const r1 = p1.clone().applyMatrix4(car.inv);
      if (Math.abs(r1.x) > 12 || r1.z < car.z0 - 12 || r1.z > car.z1 + 12) continue;
      const r0 = p0.clone().applyMatrix4(car.prevInv);
      for (const c of car.colliders) {
        if (c.ghost) continue; // the invisible walls that keep you aboard
        const h = segmentBox(r0, r1, c.min, c.max);
        if (h) consider({ t: h.t, type: 'train', car, r0, r1 });
      }
    }

    // You: a head ball at your eyes and a body ball below it, as in the
    // reference (the path shifted by how far you moved this frame).
    if (a.owner === 'enemy' && !player.dead) {
      const eye = player.eyeWorld(_e);
      const p0s = _p0s.copy(p0).addScaledVector(player.worldVelocity(_pv), dt);
      const th = segSphere(p0s, p1, eye, HEAD_R);
      const tb = segSphere(p0s, p1, _c2.copy(eye).setY(eye.y - 0.72), BODY_R);
      if (th >= 0) consider({ t: th, type: 'player', head: true });
      if (tb >= 0) consider({ t: tb, type: 'player', head: false });
    }

    if (a.owner === 'player') consider(riders.trace(p0, p1));
    return best;
  }

  resolveHit(a, hit, p0) {
    const { scene, sound, player, riders, hud } = this.game;
    const point = p0.clone().lerp(a.pos, hit.t);
    const dir = a.vel.clone().normalize();

    if (hit.type === 'train') {
      // Stick into that car, in its frame, so it rides along with us.
      const rel = hit.r1.clone().sub(hit.r0).normalize();
      const local = hit.r0.clone().lerp(hit.r1, hit.t).addScaledVector(rel, EMBED);
      a.mesh.position.copy(local);
      a.mesh.quaternion.setFromUnitVectors(Z, rel);
      scene.remove(a.mesh);
      hit.car.inner.add(a.mesh);
      this.stuck.push({ mesh: a.mesh, where: 'train', car: hit.car, age: 0 });
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
      player.hurt(dmg, hit.head ? 'An arrow to the head.' : 'Shot down by riders.');
      player.shake = Math.max(player.shake, 0.5);
      hud.hurt(hit.head);
      sound.hurt();
    } else if (hit.type === 'rider') {
      // Stick into the part it hit, so it flies off with it.
      a.mesh.position.copy(point).addScaledVector(dir, EMBED);
      a.mesh.quaternion.setFromUnitVectors(Z, dir);
      hit.part.g.attach(a.mesh);
      riders.onHit(hit.r, hit.part, a.vel);
    }
  }

  removeStuck(s) {
    s.mesh.parent?.remove(s.mesh);
    this.stuck.splice(this.stuck.indexOf(s), 1);
  }

  // Grab (§C): pull a stuck arrow out of the train and back into the quiver.
  // You can reach arrows within 3.4 m of your eyes that nothing is in the
  // way of, and not while you're on a ladder.
  grabPoint(s, out) {
    // Up the shaft from the buried tip, toward the feathers.
    return s.mesh.localToWorld(out.set(0, 0, -0.6));
  }

  reachable(player, s, eye) {
    if (s.where !== 'train' || player.onLadder || player.dead) return false;
    const p = this.grabPoint(s, _g);
    if (p.distanceTo(eye) > CONFIG.player.grabReach) return false;
    // Nothing solid between your eyes and the arrow (stop just short of it,
    // so the plank it's stuck in doesn't count). Worked out in its car's frame.
    const inv = s.car.inv;
    const a = eye.clone().applyMatrix4(inv);
    const b = p.clone().applyMatrix4(inv).lerp(a, 0.06);
    for (const c of s.car.colliders) if (!c.ghost && segmentBox(a, b, c.min, c.max) !== null) return false;
    return true;
  }

  reachableCount(player) {
    const eye = player.eyeWorld();
    let n = 0;
    for (const s of this.stuck) if (this.reachable(player, s, eye)) n++;
    return n;
  }

  // Grab button / right click / E: the reachable arrow nearest your crosshair.
  grab(player, camera) {
    const hud = this.game.hud;
    if (!this.stuck.some((s) => s.where === 'train')) return hud.hint('No arrows stuck anywhere yet');
    const eye = player.eyeWorld();
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    let best = null;
    let bd = 0.5;
    let any = false;
    for (const s of this.stuck) {
      if (!this.reachable(player, s, eye)) continue;
      any = true;
      const d = this.grabPoint(s, _g).sub(eye).normalize().dot(look);
      if (d > bd) {
        bd = d;
        best = s;
      }
    }
    if (best) this.take(player, best);
    else hud.hint(any ? 'Look at the arrow to grab it' : 'Walk closer to a stuck arrow');
  }

  // Tap on a phone: the reachable arrow within 60 px of your finger.
  tapGrab(player, camera, x, y) {
    const eye = player.eyeWorld();
    let best = null;
    let bd = 60;
    for (const s of this.stuck) {
      if (!this.reachable(player, s, eye)) continue;
      const p = this.grabPoint(s, _g).project(camera);
      if (p.z > 1) continue;
      const d = Math.hypot(((p.x + 1) / 2) * innerWidth - x, ((1 - p.y) / 2) * innerHeight - y);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    if (best) this.take(player, best);
  }

  take(player, s) {
    if (player.arrows >= CONFIG.player.maxArrows) return this.game.hud.hint('Your quiver is full');
    this.removeStuck(s);
    player.arrows++;
    this.game.hud.pickup();
    this.game.sound.pickup();
  }
}
