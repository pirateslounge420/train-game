import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flat } from '../core/materials.js';
import { segmentBox } from '../core/math.js';

const G = CONFIG.grapple;

// The grappling hook. Click to fire it where you're looking. If it bites
// into the train within range, it hauls you back aboard. If it misses, it
// comes back and you can try again (if the train's still in range).
//
// The hook's flight is worked out in train space, so it flies to a spot on
// the train even while the train is racing away from you.
export class Grapple {
  constructor(game, scene) {
    this.game = game;
    this.name = 'Hook';
    this.state = 'ready'; // ready | flying | attached | missed
    this.t = 0;
    this.cooldown = 0;
    this.aimHit = null; // where the hook would bite right now (train space), or null
    this.buildModel(scene);
    this.buildWorldParts(game.scene);
  }

  get busy() {
    return this.state !== 'ready';
  }

  cancel() {}

  get zoom() {
    return 0;
  }

  buildModel(scene) {
    // A stubby wooden-stocked launcher with the hook sitting in the muzzle.
    this.root = new THREE.Group();
    this.root.scale.setScalar(0.75);
    scene.add(this.root);
    const wood = flat(0x6b3f20);
    const iron = flat(0x3a3a3a, { metalness: 0.6, roughness: 0.4 });
    const brass = flat(0xc99a3c, { metalness: 0.7, roughness: 0.35 });
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      this.root.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(0.06, 0.08, 0.32), wood, 0, -0.02, -0.38); // stock
    add(new THREE.BoxGeometry(0.045, 0.12, 0.06), wood, 0, -0.1, -0.33).rotation.x = 0.3; // grip
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8).rotateX(Math.PI / 2), iron, 0, 0.035, -0.6); // barrel
    add(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 8).rotateX(Math.PI / 2), brass, 0, 0.035, -0.76);
    add(new THREE.TorusGeometry(0.05, 0.016, 5, 10).rotateY(Math.PI / 2), flat(0xcbb48a), 0.06, -0.01, -0.45); // rope coil
    this.loaded = new THREE.Group();
    this.loaded.position.set(0, 0.035, -0.8);
    this.root.add(this.loaded);
    this.loaded.add(makeHook(0.6));
  }

  buildWorldParts(scene) {
    this.hook = makeHook(1);
    this.hook.visible = false;
    scene.add(this.hook);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.rope = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xd8c49a }));
    this.rope.frustumCulled = false;
    this.rope.visible = false;
    scene.add(this.rope);
  }

  // Where would a hook fired along the view land? (train space, or null)
  raycast(camera) {
    const { train } = this.game;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const o = camera.position.clone().sub(train.position);
    const e = o.clone().addScaledVector(dir, G.range);
    let best = null;
    for (const c of train.colliders) {
      const h = segmentBox(o, e, c.min, c.max);
      if (h && h.t > 0 && (!best || h.t < best.t)) best = h;
    }
    if (!best) return null;
    return { point: o.clone().lerp(e, best.t), from: o, dir };
  }

  // `active`: in hand and ready. `selected`: chosen (maybe still being raised).
  update(dt, input, active, selected) {
    const { player, camera, sound } = this.game;
    this.cooldown = Math.max(0, this.cooldown - dt);
    // A click while the hook is still coming up is remembered for a moment,
    // so a frantic scroll-and-click still fires.
    this.queued = Math.max(0, (this.queued || 0) - dt);
    if (selected && input.took('Mouse0')) this.queued = 0.35;
    this.aimHit = active && this.state === 'ready' && !player.dead ? this.raycast(camera) : null;

    if (this.state === 'flying') {
      this.t += (dt * G.hookSpeed) / this.flight.dist;
      if (this.t >= 1) {
        this.state = 'attached';
        sound.latch();
        player.startReel(this.flight.to);
      }
    } else if (this.state === 'attached') {
      if (!player.reel) {
        this.state = 'ready';
        this.cooldown = 0.2;
      }
    } else if (this.state === 'missed') {
      this.t += dt / this.missTime;
      if (this.t >= 1) {
        this.state = 'ready';
        this.cooldown = G.cooldown;
      }
    }

    if (active && this.queued > 0 && this.state === 'ready' && this.cooldown <= 0 && !player.dead && !player.reel) {
      this.queued = 0;
      this.fire(camera);
    }
  }

  fire(camera) {
    const { sound } = this.game;
    sound.hookFire();
    const hit = this.aimHit || this.raycast(camera);
    if (hit) {
      const dist = Math.max(0.5, hit.point.distanceTo(hit.from));
      this.flight = { from: hit.from.clone(), to: hit.point.clone(), dist };
      this.state = 'flying';
      this.t = 0;
    } else {
      // A miss: the hook sails out to the end of the rope and drops back.
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const from = camera.position.clone();
      this.miss = { from, to: from.clone().addScaledVector(dir, G.range) };
      this.missTime = (2 * G.range) / G.hookSpeed + 0.25;
      this.state = 'missed';
      this.t = 0;
    }
  }

  // Hand position in the world, for the rope.
  handWorld(camera) {
    return new THREE.Vector3(0.18, -0.2, -0.5).applyQuaternion(camera.quaternion).add(camera.position);
  }

  animate(dt, lower, camera) {
    const { train } = this.game;
    this.root.visible = lower < 0.99;
    const sway = Math.sin(performance.now() * 0.0021) * 0.004;
    this.root.position.set(0.2, -0.2 + sway - lower * 0.45, 0);
    this.root.rotation.set(0.05 - lower * 0.6, 0.06, -0.05);
    this.loaded.visible = this.state === 'ready';

    // The hook and rope out in the world.
    let hookPos = null;
    if (this.state === 'flying') {
      hookPos = this.flight.from.clone().lerp(this.flight.to, this.t).add(train.position);
    } else if (this.state === 'attached') {
      hookPos = this.flight.to.clone().add(train.position);
    } else if (this.state === 'missed') {
      const out = (G.range / G.hookSpeed) / this.missTime;
      const k = this.t < out ? this.t / out : 1 - (this.t - out) / (1 - out);
      hookPos = this.miss.from.clone().lerp(this.miss.to, k);
      hookPos.y -= Math.sin(k * Math.PI) * 0.6 + (this.t > out ? (this.t - out) * 3 : 0);
    }
    this.hook.visible = this.rope.visible = !!hookPos;
    if (!hookPos) return;
    const hand = this.handWorld(camera);
    this.hook.position.copy(hookPos);
    this.hook.lookAt(hand);
    const arr = this.rope.geometry.attributes.position.array;
    arr.set([hand.x, hand.y, hand.z, hookPos.x, hookPos.y, hookPos.z]);
    this.rope.geometry.attributes.position.needsUpdate = true;
  }
}

// Three iron prongs on a shank, pointing along -Z.
function makeHook(scale) {
  const g = new THREE.Group();
  const iron = flat(0x3a3a3a, { metalness: 0.6, roughness: 0.4 });
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.3, 6).rotateX(Math.PI / 2), iron);
  shank.position.z = -0.15;
  g.add(shank);
  for (let i = 0; i < 3; i++) {
    const prong = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.16), iron);
    const a = (i / 3) * Math.PI * 2;
    prong.position.set(Math.cos(a) * 0.07, Math.sin(a) * 0.07, -0.26);
    prong.rotation.set(-Math.sin(a) * 0.7, Math.cos(a) * 0.7, 0);
    g.add(prong);
  }
  g.scale.setScalar(scale);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}
