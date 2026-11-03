import * as THREE from 'three';
import { fbm, noise2, hash } from './noise.js';
import { flat } from '../core/materials.js';
import { mulberry32, smoothstep } from '../core/math.js';

// The world is built from 100 m long "chunks" laid along the track.
// The train runs toward -Z. New chunks are made ahead and old ones
// behind are thrown away, so the land never ends.
export const CHUNK = 100;
const AHEAD = 10; // chunks kept in front of the train
const BEHIND = 3; // chunks kept behind it
const HALF_WIDTH = 440;

export const RAIL_TOP = 0.5;
export const GAUGE = 1.435;

// Height of the ground at any point. The strip near the track is nearly
// flat (that's where bandits ride); hills and mesas rise further out.
export function groundHeight(x, z) {
  const ax = Math.abs(x);
  const far = smoothstep(25, 150, ax);
  const bed = smoothstep(3.5, 9, ax);
  let h = fbm(x * 0.0032 + 17.3, z * 0.0032, 4) * 24 * far + far * 9;
  h += fbm(x * 0.024 + 3.1, z * 0.024, 3) * (0.45 + far * 3);
  return h * bed;
}

// Column positions across the track: fine near the rails, coarse far away.
const XS = (() => {
  const xs = [];
  let x = -HALF_WIDTH;
  while (x < HALF_WIDTH) {
    xs.push(x);
    const ax = Math.abs(x);
    x += ax < 45 ? 4 : ax < 130 ? 10 : 24;
  }
  xs.push(HALF_WIDTH);
  return xs;
})();
const Z_STEP = 5;

const SAND = [0xdcae74, 0xd5a36a, 0xe3b981, 0xd9a970];
const ROCK = [0xb2593a, 0x9e4b30, 0xa85438];
const _c = new THREE.Color();

function faceColor(x, z, h, ny) {
  const j = hash(Math.floor(x * 7.1), Math.floor(z * 3.3));
  if (ny < 0.8) return ROCK[Math.floor(j * ROCK.length)];
  if (h > 20) return j < 0.5 ? 0xc47a4c : 0xbb6e43;
  if (Math.abs(x) < 3.2) return 0x9c7f5a; // dirt under the track
  if (noise2(x * 0.05 + 40, z * 0.05) > 0.45) return j < 0.5 ? 0xa59c5c : 0x9a9355; // scrub
  return SAND[Math.floor(j * SAND.length)];
}

function buildGround(z0) {
  const pos = [];
  const col = [];
  const rows = CHUNK / Z_STEP;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const n = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  const pushTri = (p, q, r) => {
    e1.subVectors(q, p);
    e2.subVectors(r, p);
    n.crossVectors(e1, e2).normalize();
    const cx = (p.x + q.x + r.x) / 3;
    const cz = (p.z + q.z + r.z) / 3 + z0;
    const ch = (p.y + q.y + r.y) / 3;
    _c.setHex(faceColor(cx, cz, ch, n.y));
    const shade = 0.94 + hash(Math.floor(cx * 13), Math.floor(cz * 11)) * 0.1;
    for (const v of [p, q, r]) {
      pos.push(v.x, v.y, v.z);
      col.push(_c.r * shade, _c.g * shade, _c.b * shade);
    }
  };
  const h = (x, lz) => groundHeight(x, lz + z0);
  for (let j = 0; j < rows; j++) {
    const za = j * Z_STEP;
    const zb = za + Z_STEP;
    for (let i = 0; i < XS.length - 1; i++) {
      const xa = XS[i];
      const xb = XS[i + 1];
      const A = new THREE.Vector3(xa, h(xa, za), za);
      const B = new THREE.Vector3(xb, h(xb, za), za);
      const C = new THREE.Vector3(xb, h(xb, zb), zb);
      const D = new THREE.Vector3(xa, h(xa, zb), zb);
      pushTri(A, D, B);
      pushTri(B, D, C);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  return geo;
}

// ---- shared geometry for props -------------------------------------------
const G = {
  tie: new THREE.BoxGeometry(2.6, 0.14, 0.24),
  rail: new THREE.BoxGeometry(0.08, 0.14, CHUNK),
  ballast: new THREE.BoxGeometry(3.6, 0.3, CHUNK),
  cactusTrunk: new THREE.CylinderGeometry(0.28, 0.34, 1, 6),
  cactusArm: new THREE.CylinderGeometry(0.18, 0.2, 1, 6),
  rock: new THREE.DodecahedronGeometry(1, 0),
  bush: new THREE.IcosahedronGeometry(0.6, 0),
  pole: new THREE.CylinderGeometry(0.1, 0.13, 7.5, 5),
  crossbar: new THREE.BoxGeometry(1.6, 0.1, 0.1),
  wire: new THREE.BoxGeometry(0.025, 0.025, CHUNK),
  mesa: new THREE.CylinderGeometry(1, 1.15, 1, 7),
  mesaCap: new THREE.CylinderGeometry(1.03, 1, 0.08, 7),
};
const groundMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 });
const M = {
  tie: flat(0x5a4030),
  rail: flat(0x6d6a66, { metalness: 0.6, roughness: 0.4 }),
  ballast: flat(0x8d7e6d),
  cactus: flat(0x5c7a3a),
  rock: flat(0xa0583a),
  rock2: flat(0x8a6a4e),
  bush: flat(0x8a8a4a),
  pole: flat(0x6b4b30),
  wire: flat(0x2a2a2a),
  mesa: flat(0xb8643c),
  mesaTop: flat(0xc98a56),
};

function shadowed(m, cast = true) {
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

function makeCactus(rng) {
  const g = new THREE.Group();
  const h = 2.5 + rng() * 3;
  const trunk = shadowed(new THREE.Mesh(G.cactusTrunk, M.cactus));
  trunk.scale.set(1, h, 1);
  trunk.position.y = h / 2;
  g.add(trunk);
  const arms = Math.floor(rng() * 3);
  for (let i = 0; i < arms; i++) {
    const side = i === 0 ? 1 : -1;
    const ay = h * (0.35 + rng() * 0.3);
    const out = shadowed(new THREE.Mesh(G.cactusArm, M.cactus));
    out.scale.set(1, 0.7, 1);
    out.rotation.z = (Math.PI / 2) * side;
    out.position.set(-side * 0.5, ay, 0);
    const up = shadowed(new THREE.Mesh(G.cactusArm, M.cactus));
    const uh = 0.8 + rng() * 1.2;
    up.scale.set(1, uh, 1);
    up.position.set(-side * 0.82, ay + uh / 2 - 0.08, 0);
    g.add(out, up);
  }
  g.rotation.y = rng() * Math.PI * 2;
  return g;
}

function buildChunk(index) {
  const z0 = index * CHUNK;
  const group = new THREE.Group();
  group.position.z = z0;
  const rng = mulberry32(index * 9973 + 12345);

  const ground = new THREE.Mesh(buildGround(z0), groundMat);
  ground.receiveShadow = true;
  group.add(ground);

  // Track: ballast, sleepers (ties) and two rails.
  const ballast = shadowed(new THREE.Mesh(G.ballast, M.ballast), false);
  ballast.position.set(0, 0.15, CHUNK / 2);
  group.add(ballast);

  const tieCount = Math.floor(CHUNK / 0.65);
  const ties = new THREE.InstancedMesh(G.tie, M.tie, tieCount);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < tieCount; i++) {
    m4.makeTranslation(0, 0.37, i * 0.65 + 0.3);
    ties.setMatrixAt(i, m4);
  }
  ties.receiveShadow = true;
  group.add(ties);
  for (const s of [-1, 1]) {
    const rail = shadowed(new THREE.Mesh(G.rail, M.rail), false);
    rail.position.set((s * (GAUGE + 0.07)) / 2, RAIL_TOP - 0.07, CHUNK / 2);
    group.add(rail);
  }

  // Telegraph poles and wires on the left side of the line.
  for (const pz of [0, 50]) {
    const pole = shadowed(new THREE.Mesh(G.pole, M.pole));
    pole.position.set(-5.5, groundHeight(-5.5, z0 + pz) + 3.6, pz);
    const bar = shadowed(new THREE.Mesh(G.crossbar, M.pole));
    bar.position.set(-5.5, pole.position.y + 3.2, pz);
    group.add(pole, bar);
  }
  for (const wx of [-6.1, -4.9]) {
    const wire = new THREE.Mesh(G.wire, M.wire);
    wire.position.set(wx, groundHeight(-5.5, z0) + 6.85, CHUNK / 2);
    group.add(wire);
  }

  // Scattered cacti, rocks and scrub – kept out of the bandits' riding lane.
  const scatter = (count, minX, maxX, make) => {
    for (let i = 0; i < count; i++) {
      const side = rng() < 0.5 ? -1 : 1;
      const x = side * (minX + rng() * (maxX - minX));
      const lz = rng() * CHUNK;
      const obj = make();
      obj.position.set(x, groundHeight(x, z0 + lz) - 0.05, lz);
      group.add(obj);
    }
  };
  scatter(7, 24, 220, () => makeCactus(rng));
  scatter(6, 22, 260, () => {
    const r = shadowed(new THREE.Mesh(G.rock, rng() < 0.5 ? M.rock : M.rock2));
    const s = 0.6 + rng() * 2.4;
    r.scale.set(s * (0.8 + rng() * 0.6), s * (0.5 + rng() * 0.5), s);
    r.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    return r;
  });
  scatter(10, 20, 120, () => {
    const b = shadowed(new THREE.Mesh(G.bush, M.bush));
    const s = 0.5 + rng() * 0.9;
    b.scale.set(s * 1.3, s * 0.7, s * 1.2);
    return b;
  });
  // The odd small rock right in the riding lane, for a sense of speed.
  scatter(3, 6, 20, () => {
    const r = shadowed(new THREE.Mesh(G.rock, M.rock2));
    r.scale.setScalar(0.2 + rng() * 0.25);
    r.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    return r;
  });

  // Distant mesas and buttes.
  if (rng() < 0.55) {
    const side = rng() < 0.5 ? -1 : 1;
    const x = side * (230 + rng() * 170);
    const lz = rng() * CHUNK;
    const height = 25 + rng() * 55;
    const radius = 20 + rng() * 55;
    const base = groundHeight(x, z0 + lz) - 3;
    const mesa = shadowed(new THREE.Mesh(G.mesa, M.mesa), false);
    mesa.scale.set(radius, height, radius * (0.6 + rng() * 0.6));
    mesa.position.set(x, base + height / 2, lz);
    mesa.rotation.y = rng() * 3;
    const cap = shadowed(new THREE.Mesh(G.mesaCap, M.mesaTop), false);
    cap.scale.copy(mesa.scale);
    cap.scale.y = height;
    cap.position.set(x, base + height + 0.02 * height, lz);
    cap.rotation.y = mesa.rotation.y;
    group.add(mesa, cap);
  }

  return group;
}

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
  }

  // Keep chunks around the train. `maxBuild` limits how many new chunks we
  // make per frame so the game never stutters.
  update(trainZ, maxBuild = 1) {
    const center = Math.floor(trainZ / CHUNK);
    const first = center - AHEAD;
    const last = center + BEHIND;
    for (const [idx, g] of this.chunks) {
      if (idx < first || idx > last) {
        this.scene.remove(g);
        g.traverse((o) => {
          if (o.isMesh && o.geometry.attributes.color) o.geometry.dispose();
          if (o.isInstancedMesh) o.dispose();
        });
        this.chunks.delete(idx);
      }
    }
    let built = 0;
    // Build nearest first.
    for (let idx = center + 1; idx >= first && built < maxBuild; idx--) {
      if (!this.chunks.has(idx)) {
        const g = buildChunk(idx);
        this.scene.add(g);
        this.chunks.set(idx, g);
        built++;
      }
    }
    for (let idx = center + 2; idx <= last && built < maxBuild; idx++) {
      if (!this.chunks.has(idx)) {
        const g = buildChunk(idx);
        this.scene.add(g);
        this.chunks.set(idx, g);
        built++;
      }
    }
  }
}
