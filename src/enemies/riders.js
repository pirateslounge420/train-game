import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flat } from '../core/materials.js';
import { rand } from '../core/math.js';
import { groundHeight } from '../world/terrain.js';
import { hash2 } from '../world/line.js';

// Riders (§E, §O, §U; ported from reference 0.7).
//
// Horse and rider are trees of real parts, read from `rigs.json`. Every part
// is drawn as boxes, and those same boxes (padded a little) are its
// hitboxes, tested in the part's own frame. A hit does what `react` says for
// that part: a limb breaks off at its joint and flies with everything below
// it, the head pops, the horse goes down and throws its man. A man thrown
// whole gets up and runs at the train (§U).

const E = CONFIG.enemies;
const G = CONFIG.gravity;
const PI = Math.PI, TAU = PI * 2;
const PRIORITY_WINDOW = 0.3; // metres
const FOOT_SPEED = 7.5, FOOT_HIP = 0.88;

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _F = new THREE.Vector3(), _R = new THREE.Vector3(), _P = new THREE.Vector3(), _ANV = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _pr = new THREE.Vector3();
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

// ---- looks ----------------------------------------------------------------
// The gang's poncho cloth: a 32-pixel painted pattern in its accent colour.
function gangTexture(main, accent, pattern) {
  const s = 32, c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  ctx.fillStyle = main;
  ctx.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++)
      if (hash2(x, y) < 0.08) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x, y, 1, 1);
      }
  ctx.fillStyle = accent;
  if (pattern === 'lightning') {
    for (let b = 0; b < 3; b++) {
      let x = 4 + b * 11, y = 0;
      while (y < s) {
        ctx.fillRect(x, y, 2, 3);
        y += 3;
        x += Math.floor(y / 3) % 2 ? 3 : -3;
      }
    }
  } else if (pattern === 'flames') {
    for (let b = 0; b < 5; b++) {
      const x0 = b * 7 - 1, hgt = 10 + Math.floor(hash2(b, 4) * 10);
      for (let y = 0; y < hgt; y++) {
        const w = Math.max(1, Math.round(6 * (1 - y / hgt)));
        ctx.fillRect(x0 + 3 - Math.floor(w / 2) + (y % 4 === 0 ? 1 : 0), s - 1 - y, w, 1);
      }
    }
  } else if (pattern === 'waves') {
    for (let r = 0; r < 4; r++) for (let x = 0; x < s; x++) ctx.fillRect(x, r * 8 + 3 + Math.round(Math.sin(x * 0.6) * 2), 1, 2);
  } else {
    for (let i = 0; i < 9; i++) {
      const x = Math.floor(hash2(i, 1) * 28) + 2, y = Math.floor(hash2(i, 7) * 28) + 2;
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }
    ctx.fillRect(22, 5, 4, 4);
    ctx.fillStyle = main;
    ctx.fillRect(24, 6, 3, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function mesh(geo, color, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, typeof color === 'object' && color.isMaterial ? color : flat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}
const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// Build a rig's parts under their parents. `parts` maps name -> part.
function buildRig(defs, parts, look) {
  for (const d of defs) {
    const g = new THREE.Group();
    g.position.set(...d.at);
    g.rotation.set(...d.rot);
    for (const b of d.box) {
      const kind = b[6];
      const color =
        kind === 'poncho' ? look.poncho
        : kind === 'bandana' ? look.gang.accent
        : kind === 'void' ? 0x0b0c18
        : kind === 'boot' ? 0x1a1410
        : kind === 'dark' ? 0x2a2a3a
        : kind === 'hoof' ? 0x120e0a
        : d.dark ? 0x1a120c
        : look.hide;
      mesh(boxG(b[0], b[1], b[2]), color, g, b[3], b[4], b[5]);
    }
    parts[d.n] = { def: d, g, hp: d.hp, on: true, name: d.n, rider: look.isRider };
    if (d.p && parts[d.p]) parts[d.p].g.add(g);
  }
}

// ---- the manager -----------------------------------------------------------
export class Riders {
  constructor(game, rigs) {
    this.game = game;
    this.scene = game.scene;
    this.rigs = rigs;
    this.gangs = rigs.gangs.map((g) => ({ ...g, accent: new THREE.Color(g.accent).getHex(), poncho: new THREE.MeshStandardMaterial({ map: gangTexture(g.main, g.accent, g.pattern), flatShading: true, roughness: 0.9 }) }));
    this.riders = [];
    this.footmen = [];
    this.ragdolls = [];
    this.gibs = [];
    this.kills = 0;
    this.headshots = 0;
    this.hatShots = 0;
    this.spawnT = 7;
    this.gibGeo = boxG(0.1, 0.1, 0.1);
    this.gibMat = flat(0x7a0d10);
    this.stringMat = new THREE.MeshBasicMaterial({ color: 0xe8e2cf });
  }

  get downed() {
    return this.kills;
  }

  // The train's frame: where it is, which way is forward and right, how fast.
  anchor() {
    const t = this.game.train;
    t.forward(_F);
    t.right(_R);
    _P.copy(t.position);
    _ANV.copy(t.velocity);
  }

  // ---- building one horse and rider ----
  makeRider(side) {
    const root = new THREE.Group();
    const horse = new THREE.Group();
    horse.position.y = 1.15;
    root.add(horse);
    const gang = pick(this.gangs);
    const parts = {};
    buildRig(this.rigs.horse, parts, { hide: new THREE.Color(pick(this.rigs.horseColors)).getHex(), gang });
    horse.add(parts.barrel.g);
    mesh(boxG(0.06, 0.2, 0.5), 0x1a120c, parts.neck1.g, 0, 0.2, -0.3); // mane
    buildRig(this.rigs.rider, parts, { gang, poncho: gang.poncho, isRider: true });
    // The hat: a wide brim, a tall crown, a band in the gang's colour.
    const hat = parts.hat.g;
    const hcol = new THREE.Color(pick(this.rigs.hatColors)).getHex();
    mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 10), hcol, hat);
    mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 8), hcol, hat, 0, 0.17, 0);
    mesh(boxG(0.42, 0.05, 0.42), gang.accent, hat, 0, 0.05, 0);
    // The poncho's tail, streaming behind in the wind.
    const cape = new THREE.Group();
    cape.position.set(0, 0.58, 0.2);
    parts.torso.g.add(cape);
    mesh(boxG(0.56, 0.02, 0.75), gang.poncho, cape, 0, 0, 0.375);
    // The bow, in the left hand.
    const bowG = new THREE.Group();
    bowG.position.set(0, -0.32, 0);
    parts.lowerArmL.g.add(bowG);
    const bow = mesh(new THREE.TorusGeometry(0.42, 0.02, 4, 10, PI), 0x4a2e1a, bowG);
    bow.rotation.set(PI / 2, 0, 0);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.84, 3), this.stringMat);
    str.rotation.x = PI / 2;
    bowG.add(str);
    this.addKit(parts, gang, cape);
    if (side > 0) root.scale.x = -1; // mirrored, so the bow arm faces the train
    this.scene.add(root);
    return { root, horse, rider: parts.pelvis.g, parts, hat, hatOn: true, cape, gang };
  }

  // Mike's rider sheet (3 Nov): brass goggles, a quiver on the back, a
  // bandolier strap across the poncho, a fringed hem. Looks only: none of it
  // is a hitbox, and it flies off with the part it hangs on.
  addKit(parts, gang, cape) {
    const brass = flat(0xc9a24a, { metalness: 0.6, roughness: 0.35 });
    const leather = 0x6a4024;
    // Goggles over the dark face, between the bandana and the hat brim.
    const head = parts.head.g;
    const GY = 0.13; // sitting on the bandana's top edge
    mesh(boxG(0.25, 0.03, 0.25), 0x2a1c12, head, 0, GY, 0); // the strap round the head
    for (const x of [-0.062, 0.062]) {
      const ring = mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 10).rotateX(PI / 2), brass, head, x, GY, -0.13);
      ring.castShadow = false;
      mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 10).rotateX(PI / 2), flat(0xe8d8a8, { emissive: 0x3a3020, roughness: 0.2 }), head, x, GY, -0.152);
    }
    // The bandolier, shoulder to hip, front and back.
    const torso = parts.torso.g;
    for (const z of [-0.226, 0.226]) {
      const strap = mesh(boxG(0.08, 0.84, 0.02), leather, torso, 0, 0.3, z);
      strap.rotation.z = 0.78;
    }
    // A fringed hem on the poncho, the gang's two colours in turn.
    const fringe = (i) => (i % 2 ? flat(gang.accent) : gang.poncho);
    for (const z of [-0.225, 0.225]) for (let i = 0; i < 9; i++) mesh(boxG(0.035, 0.1, 0.015), fringe(i), torso, -0.26 + i * 0.065, -0.04, z);
    for (let i = 0; i < 8; i++) mesh(boxG(0.035, 0.015, 0.1), fringe(i), cape, -0.245 + i * 0.07, 0, 0.79);
    // The quiver over the right shoulder, fletching showing.
    const quiver = new THREE.Group();
    quiver.position.set(0.17, 0.42, 0.27);
    quiver.rotation.set(0.15, 0, -0.45);
    torso.add(quiver);
    mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.5, 8), 0x4a2e1a, quiver);
    mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 8), leather, quiver, 0, 0.23, 0);
    for (let i = 0; i < 4; i++) {
      const x = -0.03 + (i % 2) * 0.05, z = -0.025 + Math.floor(i / 2) * 0.05;
      mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 3), 0xc9b48a, quiver, x, 0.33, z);
      mesh(boxG(0.006, 0.07, 0.05), 0xc83c2c, quiver, x, 0.4, z);
    }
  }

  // ---- spawning (reference updateSpawner) ----
  spawnRider() {
    const side = Math.random() < 0.5 ? -1 : 1;
    const ri = this.game.train.region;
    const m = this.makeRider(side);
    this.anchor();
    const pos = _P.clone().addScaledVector(_R, side * rand(32, 55)).addScaledVector(_F, rand(45, 95));
    pos.y = groundHeight(pos.x, pos.z);
    const r = Object.assign(m, {
      side, pos, vel: new THREE.Vector3(), dx: 0, dz: 0,
      ox: rand(9, 23), oz: rand(-16, 12), swayT: rand(0, 100), phase: rand(0, TAU),
      state: 'approach', hold: rand(26, 46), shootT: rand(2, 4.5), extra: rand(0, 3),
      sigma: Math.max(1.4, 5.5 - ri * 0.6), // aim tightens by region (§E)
      alive: true, riderOn: true, yaw: 0, scared: false, armed: true, slumpT: 0,
    });
    r.root.position.copy(r.pos);
    this.riders.push(r);
    this.game.hud.message(side < 0 ? 'Rider coming up on the left!' : 'Rider coming up on the right!');
  }

  spawner(dt) {
    const game = this.game;
    if (!game.ridersMaySpawn()) return;
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const ri = game.train.region;
    const maxC = 3 + Math.min(3, Math.floor(ri / 2)) + (game.night() > 0.5 ? 2 : 0); // night: two more (§R)
    const alive = this.riders.filter((r) => r.alive).length;
    if (alive >= maxC) {
      this.spawnT = 2;
      return;
    }
    const n = 1 + Math.min(3, Math.floor(Math.random() + ri * 0.45));
    for (let i = 0; i < n; i++) this.spawnRider();
    this.spawnT = Math.max(5, 14 - ri * 1.2) + rand(0, 4);
  }

  // After a town stop the next riders take a while (reference arriveTown).
  rest() {
    this.spawnT = 9;
  }

  update(dt, time) {
    this.time = time;
    this.spawner(dt);
    this.updateRiders(dt);
    this.updateFootmen(dt);
    this.updateRagdolls(dt);
    this.updateGibs(dt);
  }

  // ---- riding (reference updateRiders) ----
  updateRiders(dt) {
    const game = this.game, train = game.train;
    this.anchor();
    const stay = game.ridersMayStay();
    const eye = game.player.eyeWorld(_b);
    for (let i = this.riders.length - 1; i >= 0; i--) {
      const r = this.riders[i];
      if (r.state === 'dead') {
        this.removeRider(r);
        continue;
      }
      if (r.slumpT > 0) {
        r.slumpT -= dt;
        if (r.slumpT <= 0 && r.riderOn) this.knockOff(r, _v3.set(0, 0, 0), 'FELL');
      }
      let lat, lon, maxS;
      if (r.state === 'approach' || r.state === 'hold') {
        // Flank the train 9–23 m out, weaving a little (§E).
        r.swayT += dt;
        lat = r.side * (r.ox + Math.sin(r.swayT * 0.5 + r.phase) * 3.5);
        lon = -(r.oz + Math.cos(r.swayT * 0.37 + r.phase) * 4.5);
        maxS = train.cruise + 9 + r.extra;
        _v.copy(_P).addScaledVector(_R, lat).addScaledVector(_F, lon);
        if (r.state === 'approach' && Math.abs(r.pos.x - _v.x) < 4 && Math.abs(r.pos.z - _v.z) < 6) r.state = 'hold';
        r.hold -= dt;
        if (r.hold <= 0 || !stay) r.state = 'flee';
      } else if (r.state === 'flee') {
        lat = r.side * 95;
        lon = -40;
        maxS = r.scared ? train.cruise + 16 : Math.max(8, train.cruise - 2);
      } else {
        lat = r.side * 90;
        lon = -60;
        maxS = Math.max(8, train.cruise - 5);
      }
      _v.copy(_P).addScaledVector(_R, lat).addScaledVector(_F, lon);
      let vx = _ANV.x + (_v.x - r.pos.x) * 0.9, vz = _ANV.z + (_v.z - r.pos.z) * 0.9;
      const sp = Math.hypot(vx, vz);
      if (sp > maxS) {
        vx *= maxS / sp;
        vz *= maxS / sp;
      }
      const k = Math.min(1, 2.2 * dt);
      r.vel.x += (vx - r.vel.x) * k;
      r.vel.z += (vz - r.vel.z) * k;
      r.dx = r.vel.x * dt;
      r.dz = r.vel.z * dt;
      r.pos.x += r.dx;
      r.pos.z += r.dz;
      r.pos.y += (groundHeight(r.pos.x, r.pos.z) - r.pos.y) * Math.min(1, 8 * dt);
      const spd = Math.hypot(r.vel.x, r.vel.z);
      if (spd > 0.5) {
        const yaw = Math.atan2(-r.vel.x, -r.vel.z);
        let dy = yaw - r.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        r.yaw += dy * Math.min(1, 4 * dt);
      }
      r.root.position.copy(r.pos);
      r.root.rotation.y = r.yaw;
      // The gallop: four beats, a moment in the air, the body rocking with it (§E).
      r.phase += (dt * spd) / 2.4;
      const ph = r.phase, P = r.parts, GA = this.rigs.gallop;
      for (const L of ['FL', 'FR', 'BL', 'BR']) {
        const o = ph + GA[L] * TAU, front = L[0] === 'F';
        const up = P['upper' + L], lo = P['lower' + L];
        if (up.on) up.g.rotation.x = Math.sin(o) * (front ? 0.75 : 0.85);
        if (lo.on) {
          const fold = Math.max(0, Math.sin(o + 1.0));
          lo.g.rotation.x = front ? -fold * 1.1 : fold * 0.9;
        }
      }
      r.horse.position.y = 1.15 + 0.09 * Math.sin(2 * ph + 0.5) + 0.04;
      r.horse.rotation.x = 0.07 * Math.sin(ph + 1.0);
      if (P.neck1.on) P.neck1.g.rotation.x = 0.55 + 0.08 * Math.sin(ph);
      if (P.tail.on) P.tail.g.rotation.x = -0.5 + 0.25 * Math.sin(ph * 0.5);
      r.cape.rotation.x = 1.35 - Math.min(0.95, spd * 0.045) + 0.12 * Math.sin(this.time * 7 + r.phase) + 0.06 * Math.sin(this.time * 11.3);
      r.root.updateMatrixWorld(true);
      // Shooting: only when holding his place beside the train.
      const dist = r.pos.distanceTo(eye);
      if (r.state === 'hold' && r.riderOn && r.armed && !game.player.dead) {
        r.shootT -= dt;
        if (r.shootT <= 0 && dist < 52) {
          _v.set(r.pos.x - r.side * 0.6, r.pos.y + r.horse.position.y + 0.85, r.pos.z);
          this.shootAtPlayer(_v, r.vel, r.sigma);
          r.shootT = rand(2.6, 4.6) - Math.min(1.3, train.region * 0.18);
        }
      }
      _v2.subVectors(r.pos, _P);
      const behind = -_v2.dot(_F), far = Math.abs(_v2.dot(_R));
      if ((r.state === 'flee' || r.state === 'riderless') && (behind > 130 || far > 150 || (r.state === 'flee' && far > 82))) this.removeRider(r);
      else if (behind > 220 || far > 260) this.removeRider(r);
    }
  }

  // Aim at you with a ballistic lead and his own wobble (reference shootAtPlayer).
  shootAtPlayer(from, svel, sigma) {
    const game = this.game, v0 = E.arrowSpeed;
    const to = game.player.eyeWorld(_v2);
    to.y -= 0.45;
    const rel = _v3.subVectors(to, from);
    let dxz = Math.hypot(rel.x, rel.z);
    const tof = dxz / (v0 * 0.92);
    const tv = game.player.worldVelocity(_a);
    rel.x += (tv.x - svel.x) * tof;
    rel.z += (tv.z - svel.z) * tof;
    dxz = Math.hypot(rel.x, rel.z);
    const v2 = v0 * v0, disc = v2 * v2 - G * (G * dxz * dxz + 2 * rel.y * v2);
    let el = disc < 0 ? PI / 4 : Math.atan((v2 - Math.sqrt(disc)) / (G * dxz));
    const sg = (sigma * PI) / 180;
    const az = Math.atan2(rel.x, rel.z) + gauss() * sg;
    el += gauss() * sg;
    const vel = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(v0).add(svel);
    game.arrows.spawn(from.clone(), vel, 'enemy');
    game.sound.enemyTwang(from, game.player);
  }

  removeRider(r) {
    const i = this.riders.indexOf(r);
    if (i >= 0) this.riders.splice(i, 1);
    this.scene.remove(r.root);
  }

  // ---- hits ----
  partLive(r, part) {
    return part.on && (!part.rider || r.riderOn);
  }
  hitPad(d) {
    return d.n === 'hat' ? 0.03 : d.arm || d.rleg || d.leg ? 0.09 : 0.07;
  }
  // The arrow's path against one part's boxes, in the part's frame.
  segBoxes(part, p0, p1) {
    const g = part.g;
    g.worldToLocal(_a.copy(p0));
    g.worldToLocal(_b.copy(p1));
    const d = part.def, list = d.hit || d.box, pad = this.hitPad(d);
    let best = -1;
    for (const b of list) {
      const t = segAABB(_a, _b, b[3] - b[0] / 2 - pad, b[4] - b[1] / 2 - pad, b[5] - b[2] / 2 - pad, b[3] + b[0] / 2 + pad, b[4] + b[1] / 2 + pad, b[5] + b[2] / 2 + pad);
      if (t >= 0 && (best < 0 || t < best)) best = t;
    }
    return best;
  }

  // The part an arrow hits first, near-ties going to the lower priority.
  // The path is shifted by how far each man moved this frame, so it is seen
  // from his own point of view.
  trace(p0, p1) {
    const hits = [];
    let minT = 2;
    for (const list of [this.riders, this.footmen])
      for (const r of list) {
        if (r.state === 'dead') continue;
        if (Math.abs(r.pos.x - p1.x) > 7 || Math.abs(r.pos.z - p1.z) > 7) continue;
        _pr.copy(p0);
        _pr.x += r.dx || 0;
        _pr.z += r.dz || 0;
        for (const k in r.parts) {
          const part = r.parts[k];
          if (!this.partLive(r, part)) continue;
          const t = this.segBoxes(part, _pr, p1);
          if (t >= 0) {
            hits.push({ t, part, r });
            if (t < minT) minT = t;
          }
        }
      }
    if (!hits.length) return null;
    const segLen = p0.distanceTo(p1);
    let best = null;
    for (const h of hits) if ((h.t - minT) * segLen < PRIORITY_WINDOW && (!best || h.part.def.pri < best.part.def.pri)) best = h;
    return { t: best.t, type: 'rider', r: best.r, part: best.part };
  }

  // An arrow struck `part` of rider (or man on foot) r (reference onRiderHit).
  onHit(r, part, arrowVel) {
    const hud = this.game.hud, sound = this.game.sound;
    const react = this.rigs.react[part.name] || { kind: 'hp', gibs: 4, label: 'HIT' };
    const impulse = arrowVel.clone().normalize().multiplyScalar(2.5);
    this.partWorld(part, _v);
    if (react.kind === 'hat') {
      hud.hitFeedback('headshot', 'HAT SHOT!');
      sound.hitFeedback('headshot');
      this.shootHat(r, impulse);
      return;
    }
    if (r.foot) return this.killFootman(r, part, react, impulse);
    if (react.kind === 'kill') {
      hud.hitFeedback(react.crit ? 'headshot' : 'kill', `${react.label}!`);
      sound.hitFeedback(react.crit ? 'headshot' : 'kill');
      if (react.pop) {
        if (react.pop === 'head') this.headshots++;
        this.detachPart(r, r.parts[react.pop], impulse, react);
      } else this.spawnGibs(_v, react.gibs, 4);
      this.knockOff(r, impulse, null, true);
      return;
    }
    if (react.kind === 'limb') {
      hud.hitFeedback('hit', react.label);
      sound.hitFeedback('hit');
      this.detachPart(r, part, impulse, react);
      if (react.disarm) {
        r.armed = false;
        r.scared = true;
        if (r.state !== 'riderless' && r.state !== 'dead') r.state = 'flee';
      }
      if (react.slump && r.riderOn && r.slumpT <= 0) r.slumpT = 0.9;
      if (react.horse) this.downHorse(r, impulse, new THREE.Vector3(react.horse[0], react.horse[1], react.horse[2] * (r.side > 0 ? -1 : 1)));
      return;
    }
    if (react.kind === 'horse') {
      hud.hitFeedback('hit', react.label);
      sound.hitFeedback('hit');
      this.spawnGibs(_v, react.gibs, 3, impulse);
      this.downHorse(r, impulse, new THREE.Vector3(...react.spin));
      return;
    }
    // Parts that take several hits.
    part.hp--;
    sound.hitFeedback('hit');
    this.spawnGibs(_v, react.gibs, 2, impulse);
    if (part.hp <= 0) {
      if (react.then === 'off') this.knockOff(r, impulse, 'KNOCKED OFF');
      else this.downHorse(r, impulse, null);
    } else hud.hitFeedback('hit', react.label);
  }

  partWorld(part, out) {
    return part.g.localToWorld(out.set(...part.def.c));
  }

  // The hat spins off and the man loses his nerve and bolts (§F). Flying it
  // to the hat car's rack is the hats step (§H).
  shootHat(r, impulse) {
    if (!r.hatOn) return;
    r.hatOn = false;
    r.parts.hat.on = false;
    r.scared = true;
    if (!r.foot) {
      r.state = 'flee';
      r.hold = 0;
    } else r.state = 'flee';
    this.hatShots++;
    const v = _v3.copy(impulse).multiplyScalar(1.5);
    v.y += 3.5;
    this.toRagdoll(r.hat, v, 0.05, new THREE.Vector3(rand(-4, 4), rand(10, 16), rand(-4, 4)));
  }

  // ---- gore: chunky, bouncy, theatrical (§F, §O) ----
  spawnGibs(p, n, spd, dir) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.gibGeo, this.gibMat);
      m.position.copy(p);
      const s = rand(0.5, 1.5);
      m.scale.set(s, s * rand(0.6, 1.4), s);
      m.rotation.set(rand(0, TAU), rand(0, TAU), 0);
      this.scene.add(m);
      const v = new THREE.Vector3(rand(-1, 1), rand(0.4, 1), rand(-1, 1)).normalize().multiplyScalar(rand(1, spd));
      v.y += rand(2, 5);
      if (dir) v.addScaledVector(_v2.copy(dir).normalize(), rand(0.5, 2));
      this.gibs.push({ m, vel: v, ang: new THREE.Vector3(rand(-10, 10), rand(-10, 10), rand(-10, 10)), t: 0, life: rand(1.8, 3.2) });
    }
  }

  updateGibs(dt) {
    for (let i = this.gibs.length - 1; i >= 0; i--) {
      const g = this.gibs[i], o = g.m;
      g.t += dt;
      g.vel.y -= 14 * dt;
      o.position.addScaledVector(g.vel, dt);
      o.rotation.x += g.ang.x * dt;
      o.rotation.z += g.ang.z * dt;
      const gy = groundHeight(o.position.x, o.position.z) + 0.05;
      if (o.position.y < gy) {
        o.position.y = gy;
        if (g.vel.y < -1) {
          g.vel.y *= -0.5; // they bounce (restitution 0.5)
          g.vel.x *= 0.6;
          g.vel.z *= 0.6;
          g.ang.multiplyScalar(0.6);
        } else {
          g.vel.set(0, 0, 0);
          g.ang.set(0, 0, 0);
        }
      }
      if (g.t > g.life - 0.4) o.scale.multiplyScalar(0.9);
      if (g.t >= g.life) {
        this.scene.remove(o);
        this.gibs.splice(i, 1);
      }
    }
  }

  toRagdoll(obj, vel, lie, ang) {
    this.scene.attach(obj);
    const g = { obj, vel: vel.clone(), ang: ang ? ang.clone() : new THREE.Vector3(rand(-4, 4), rand(-2, 2), rand(-4, 4)), t: 0, life: 7, ground: false, lie };
    this.ragdolls.push(g);
    return g;
  }

  // A part breaks at its joint: it and everything below it fly, blood
  // squirts from the stump. Light parts fly further and spin harder (§O).
  detachPart(r, part, impulse, react) {
    if (!part.on) return;
    part.on = false;
    for (const k in r.parts) {
      const q = r.parts[k];
      let d = q.def;
      while (d.p && r.parts[d.p]) {
        if (d.p === part.name) {
          q.on = false;
          break;
        }
        d = r.parts[d.p].def;
      }
    }
    part.g.getWorldPosition(_v);
    const k = Math.min(3, 40 / part.def.mass);
    const v = _v3.copy(impulse).multiplyScalar(0.8 + k * 0.6);
    v.y += react.launch || 3;
    v.x += rand(-1, 1);
    v.z += rand(-1, 1);
    v.add(r.vel);
    const sp = (react.spin || 8) * (0.6 + Math.random() * 0.8);
    this.toRagdoll(part.g, v, Math.max(0.08, part.def.r * 0.6), new THREE.Vector3(rand(-sp, sp), rand(-sp * 0.4, sp * 0.4), rand(-sp, sp)));
    this.spawnGibs(_v, react.gibs || 6, 4, impulse);
  }

  // He can get up from a fall if he still has his head, his hips and both legs (§U).
  canSurvive(r) {
    const P = r.parts;
    return P.head.on && P.neck.on && P.pelvis.on && P.upperLegL.on && P.lowerLegL.on && P.upperLegR.on && P.lowerLegR.on;
  }

  knockOff(r, impulse, label, fatal) {
    if (!r.riderOn) return;
    r.riderOn = false;
    r.alive = false;
    const v = _v3.copy(r.vel).add(impulse);
    v.y += rand(2, 4);
    const rag = this.toRagdoll(r.rider, v, 0.35);
    r.state = 'riderless';
    r.hold = 99;
    if (!fatal && this.canSurvive(r)) {
      rag.recover = { r, t: rand(1.0, 2.0) };
      rag.life = 30;
      if (label) this.game.hud.hitFeedback('hit', label);
      return;
    }
    this.kills++;
    if (label) this.game.hud.hitFeedback('kill', `${label}!`);
  }

  downHorse(r, impulse, spin) {
    if (r.state === 'riderless' || r.state === 'dead') {
      if (r.state === 'riderless') {
        r.state = 'dead';
        const v = _v3.copy(r.vel).multiplyScalar(0.9);
        v.y += 1.5;
        this.toRagdoll(r.horse, v, 0.5, spin);
      }
      return;
    }
    r.state = 'dead';
    r.alive = false;
    const vr = _v3.copy(r.vel);
    vr.y += rand(4, 6);
    vr.addScaledVector(_F, rand(3, 6));
    const rag = this.toRagdoll(r.rider, vr, 0.35, new THREE.Vector3(rand(-6, 6), rand(-3, 3), rand(-6, 6)));
    const vh = _v2.copy(r.vel).multiplyScalar(0.85);
    vh.y += spin ? 2.5 : 1.0;
    this.toRagdoll(r.horse, vh, 0.5, spin);
    r.riderOn = false;
    if (this.canSurvive(r)) {
      rag.recover = { r, t: rand(1.4, 2.6) };
      rag.life = 30;
    } else this.kills++;
    this.game.hud.hitFeedback('hit', 'HORSE DOWN');
  }

  updateRagdolls(dt) {
    for (let i = this.ragdolls.length - 1; i >= 0; i--) {
      const g = this.ragdolls[i], o = g.obj;
      g.t += dt;
      if (!g.ground) {
        g.vel.y -= G * 1.3 * dt;
        o.position.addScaledVector(g.vel, dt);
        o.rotation.x += g.ang.x * dt;
        o.rotation.y += g.ang.y * dt;
        o.rotation.z += g.ang.z * dt;
        const gy = groundHeight(o.position.x, o.position.z) + g.lie;
        if (o.position.y <= gy) {
          o.position.y = gy;
          if (g.vel.y < -1.5) {
            g.vel.y *= -0.45;
            g.vel.x *= 0.72;
            g.vel.z *= 0.72;
            g.ang.multiplyScalar(0.65);
          } else {
            g.ground = true;
            g.vel.set(0, 0, 0);
            o.rotation.x = Math.atan2(Math.sin(o.rotation.x), Math.cos(o.rotation.x));
            o.rotation.z = Math.atan2(Math.sin(o.rotation.z), Math.cos(o.rotation.z));
          }
        }
      } else {
        // Settle onto his back or side.
        o.rotation.x += (0 - o.rotation.x) * Math.min(1, 6 * dt);
        const tz = g.lie < 0.4 ? (o.rotation.z > 0 ? 1.5 : -1.5) : o.rotation.z > 0 ? 1.3 : -1.3;
        o.rotation.z += (tz - o.rotation.z) * Math.min(1, 6 * dt);
        if (g.recover) {
          g.recover.t -= dt;
          if (g.recover.t <= 0) {
            this.standUp(g);
            this.ragdolls.splice(i, 1);
            continue;
          }
        }
      }
      if (g.t > g.life - 0.5) o.scale.setScalar(Math.max(0.001, (g.life - g.t) / 0.5));
      if (g.t >= g.life) {
        this.scene.remove(o);
        this.ragdolls.splice(i, 1);
      }
    }
  }

  // ---- dismounted riders: up, run at the train, a few hail-mary shots (§U) ----
  standUp(g) {
    const r = g.recover.r, o = g.obj;
    o.scale.set(1, 1, 1);
    o.rotation.set(0, 0, 0);
    const P = {};
    for (const d of this.rigs.rider) {
      const p = r.parts[d.n];
      P[d.n] = p;
      if (!p.on) continue;
      if (d.rleg) p.g.rotation.set(0, 0, 0);
      else if (d.arm) p.g.rotation.set(0, 0, d.n.endsWith('L') ? 0.25 : -0.25);
    }
    const f = {
      foot: true, root: o, parts: P, hat: r.hat, hatOn: r.hatOn, gang: r.gang, cape: r.cape, armed: r.armed, side: r.side,
      sigma: r.sigma * 1.7, // his aim is 1.7× worse on foot
      pos: o.position.clone(), vel: new THREE.Vector3(), dx: 0, dz: 0, yaw: 0, phase: 0, state: 'up', t: 0, life: 0,
      shootT: rand(0.9, 1.6), ammo: r.armed ? (Math.random() < 0.5 ? 2 : 3) : 0, riderOn: true, alive: true, scared: false,
    };
    f.pos.y = groundHeight(f.pos.x, f.pos.z) + FOOT_HIP;
    o.position.copy(f.pos);
    r.hatOn = false;
    this.footmen.push(f);
  }

  updateFootmen(dt) {
    this.anchor();
    const eye = this.game.player.eyeWorld(_b);
    for (let i = this.footmen.length - 1; i >= 0; i--) {
      const f = this.footmen[i], o = f.root;
      f.life += dt;
      if (f.state === 'up') {
        f.t += dt;
        if (f.t > 0.45) f.state = 'run';
      }
      _v2.subVectors(eye, f.pos);
      _v2.y = 0;
      const dist = _v2.length();
      if (dist > 1e-3) _v2.multiplyScalar(1 / dist);
      let want = 0, sgn = 1;
      if (f.state === 'run') want = dist > 3 ? FOOT_SPEED : 0;
      else if (f.state === 'flee') {
        want = FOOT_SPEED * 0.9;
        sgn = -1;
      }
      const k = Math.min(1, 3 * dt);
      f.vel.x += (_v2.x * want * sgn - f.vel.x) * k;
      f.vel.z += (_v2.z * want * sgn - f.vel.z) * k;
      f.dx = f.vel.x * dt;
      f.dz = f.vel.z * dt;
      f.pos.x += f.dx;
      f.pos.z += f.dz;
      f.pos.y = groundHeight(f.pos.x, f.pos.z) + FOOT_HIP;
      const spd = Math.hypot(f.vel.x, f.vel.z);
      const fy = spd > 0.5 ? Math.atan2(-f.vel.x, -f.vel.z) : Math.atan2(-_v2.x, -_v2.z);
      let dy = fy - f.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      f.yaw += dy * Math.min(1, 6 * dt);
      o.position.copy(f.pos);
      o.rotation.set(0, f.yaw, 0);
      // The run: legs scissor, arms pump, the poncho streams.
      f.phase += dt * spd * 2.2;
      const ph = f.phase, P = f.parts, a = Math.min(1, spd / 5);
      for (const [u, l, off] of [['upperLegL', 'lowerLegL', 0], ['upperLegR', 'lowerLegR', PI]]) {
        if (P[u].on) P[u].g.rotation.x = -Math.sin(ph + off) * 0.85 * a;
        if (P[l].on) P[l].g.rotation.x = Math.max(0, Math.sin(ph + off - 0.7)) * 1.3 * a;
      }
      if (P.upperArmL.on) P.upperArmL.g.rotation.x = Math.sin(ph + PI) * 0.7 * a - 0.3;
      if (P.upperArmR.on) P.upperArmR.g.rotation.x = Math.sin(ph) * 0.7 * a - 0.3;
      if (P.lowerArmL.on) P.lowerArmL.g.rotation.x = -0.6;
      if (P.lowerArmR.on) P.lowerArmR.g.rotation.x = -0.8;
      if (f.cape) f.cape.rotation.x = 1.35 - Math.min(0.9, spd * 0.12) + 0.1 * Math.sin(this.time * 7 + ph);
      o.updateMatrixWorld(true);
      // Two or three wild shots on the run, then he has nothing left and turns tail.
      if (f.state === 'run' && f.ammo > 0 && f.life > 0.6 && f.armed && !this.game.player.dead) {
        f.shootT -= dt;
        if (f.shootT <= 0 && dist < 85) {
          this.shootAtPlayer(_v.set(f.pos.x, f.pos.y + 0.62, f.pos.z), f.vel, f.sigma);
          f.ammo--;
          f.shootT = rand(1.4, 2.4);
          if (f.ammo <= 0) f.state = 'flee';
        }
      }
      _v2.subVectors(f.pos, _P);
      const behind = -_v2.dot(_F), far = Math.abs(_v2.dot(_R));
      if (behind > 140 || far > 160 || f.life > 30) this.removeFootman(f, true); // he got away
    }
  }

  removeFootman(f, gone) {
    const i = this.footmen.indexOf(f);
    if (i >= 0) this.footmen.splice(i, 1);
    if (gone) this.scene.remove(f.root);
  }

  // Any hit finishes a man on foot (§U).
  killFootman(f, part, react, impulse) {
    const hud = this.game.hud, sound = this.game.sound;
    this.partWorld(part, _v);
    if (react.kind === 'kill' && react.pop && f.parts[react.pop].on) {
      if (react.pop === 'head') this.headshots++;
      this.detachPart(f, f.parts[react.pop], impulse, react);
    } else if (react.kind === 'limb') this.detachPart(f, part, impulse, react);
    else this.spawnGibs(_v, react.gibs || 6, 3, impulse);
    const label = react.label && react.label !== 'HIT' ? react.label : 'FINISHED';
    hud.hitFeedback(react.crit ? 'headshot' : 'kill', `${label}!`);
    sound.hitFeedback(react.crit ? 'headshot' : 'kill');
    this.kills++;
    const v = _v3.copy(impulse).multiplyScalar(1.4);
    v.y += 2.5;
    this.toRagdoll(f.root, v, 0.35);
    this.removeFootman(f, false);
  }
}

// Does the segment a->b cross the box? Returns t (0..1) or -1.
function segAABB(a, b, x0, y0, z0, x1, y1, z1) {
  let t0 = 0, t1 = 1;
  const A = [a.x, a.y, a.z], B = [b.x, b.y, b.z], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    const d = B[i] - A[i];
    if (Math.abs(d) < 1e-9) {
      if (A[i] < lo[i] || A[i] > hi[i]) return -1;
      continue;
    }
    let ta = (lo[i] - A[i]) / d, tb = (hi[i] - A[i]) / d;
    if (ta > tb) [ta, tb] = [tb, ta];
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  return t0;
}

