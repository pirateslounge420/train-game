import * as THREE from 'three';
import { facet, painted, plain, tiledBox, tiledCyl } from '../core/materials.js';
import { texBark, texDetail, texPlanks, texStone } from '../core/textures.js';
import {
  trackAt, trackNear, biomeParams, biomeOf, regionAt, regionStart, ensureRegions, tunnelNear, townNear,
  rngFor, vnoise, fbm, smooth, lerp, cellKey, cellOf, TRK_STEP,
} from './line.js';

// The country along the line (§G; ported from reference 0.7): 120 m squares
// of ground in a corridor around the track, and the track itself in 80 m
// pieces (bed, rails, ties, telegraph poles, towns and tunnels). Pieces are
// built ahead of the train and thrown away behind it.

export const RAIL_TOP = 0.25; // the train's wheels sit on this (as in the reference)
const BED_Y = 0.09;

// Height of the ground anywhere. Flat by the line (that's where riders
// gallop), hills further out, mountains over the tunnels.
const _tn = { d: 0, s: 0 };
export function groundHeight(x, z) {
  const T = trackNear(x, z, _tn);
  const dist = T.d, s = T.s;
  const p = biomeParams(s);
  let h = (fbm(x * 0.011 + 37.1, z * 0.011 + 11.3, 3) - 0.5) * 2 * p.amp * smooth(8, 42, dist);
  const m = fbm(x * 0.004 + 5.2, z * 0.0035 + 2.7, 3);
  h += p.far * Math.pow(smooth(80, 230, dist), 1.4) * Math.pow(m, 1.6) * 1.4;
  h *= smooth(5.5, 16, dist);
  const tun = tunnelNear(s, 80);
  if (tun) {
    const inside = Math.min(s - tun.s0, tun.s1 - s);
    const mtn = 46 * smooth(-6, 14, inside) * smooth(13, 30, dist) * (1 - smooth(120, 240, dist)) * (0.82 + 0.18 * vnoise(x * 0.03, z * 0.03));
    h = Math.max(h, mtn);
    if (inside > 0 && dist < 14) h = lerp(h, -2.5, smooth(0, 8, inside));
  }
  return h;
}

const tmpC = new THREE.Color(), tmpC2 = new THREE.Color();
function biomeColor(b, x, z, out) {
  const n = vnoise(x * 0.07 + 3, z * 0.07 + 9);
  const f = fbm(x * 0.012 + 1.3, z * 0.012 + 4.1, 2);
  out.copy(f > 0.6 ? b.g3 : n > 0.52 ? b.g1 : b.g2);
}
function faceColor(x, z, h, out) {
  const T = trackNear(x, z, _tn);
  const p = biomeParams(T.s);
  const k = vnoise(x * 0.21 + 8, z * 0.21 + 1);
  if (h > 7 && tunnelNear(T.s, 100)) {
    out.copy(p.a.rock).lerp(p.b.rock, p.t).multiplyScalar(0.85 + k * 0.3);
    return;
  }
  biomeColor(p.a, x, z, tmpC);
  biomeColor(p.b, x, z, tmpC2);
  out.copy(tmpC).lerp(tmpC2, p.t).multiplyScalar(0.92 + k * 0.2);
}

// ---- scenery models: one merged, vertex-coloured mesh each -----------------
function mergeColored(parts) {
  const pos = [], nor = [], col = [], uvs = [];
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
    g.computeVertexNormals();
    const pa = g.attributes.position.array, na = g.attributes.normal.array, ua = g.attributes.uv.array, us = p.uv || 1;
    for (let i = 0; i < pa.length; i++) {
      pos.push(pa[i]);
      nor.push(na[i]);
    }
    for (let i = 0; i < pa.length / 3; i++) {
      col.push(p.color.r, p.color.g, p.color.b);
      uvs.push(ua[i * 2] * us, ua[i * 2 + 1] * us);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return out;
}
const C = (h) => new THREE.Color(h);
const DECO = (() => {
  const D = {};
  const canopy = new THREE.ConeGeometry(1.7, 4.4, 10).translate(0, 3.3, 0);
  const trunk = new THREE.CylinderGeometry(0.2, 0.28, 1.5, 5).translate(0, 0.7, 0);
  D.tree = mergeColored([{ geo: trunk, color: C(0x4a2e1a), uv: 1 }, { geo: canopy, color: C(0x3f8a2a), uv: 3 }]);
  const p1 = new THREE.ConeGeometry(1.3, 3.4, 10).translate(0, 2.6, 0);
  const p2 = new THREE.ConeGeometry(1.0, 3.0, 10).translate(0, 4.6, 0);
  const pt = new THREE.CylinderGeometry(0.18, 0.25, 1.3, 5).translate(0, 0.6, 0);
  D.pine = mergeColored([{ geo: pt, color: C(0x3a2416), uv: 1 }, { geo: p1, color: C(0x1c5a2a), uv: 3 }, { geo: p2, color: C(0x246a30), uv: 3 }]);
  const cac = [
    new THREE.CylinderGeometry(0.3, 0.36, 3.4, 10).translate(0, 1.7, 0),
    new THREE.BoxGeometry(0.9, 0.28, 0.28).translate(0.45, 1.7, 0),
    new THREE.CylinderGeometry(0.16, 0.16, 1.3, 5).translate(0.78, 2.3, 0),
    new THREE.BoxGeometry(0.8, 0.26, 0.26).translate(-0.4, 1.2, 0),
    new THREE.CylinderGeometry(0.15, 0.15, 1.0, 5).translate(-0.68, 1.7, 0),
  ];
  D.cactus = mergeColored(cac.map((geo) => ({ geo, color: C(0x3f8a34), uv: 2 })));
  D.rock = mergeColored([{ geo: new THREE.DodecahedronGeometry(1.2, 0).scale(1, 0.65, 1).translate(0, 0.4, 0), color: C(0xffffff), uv: 2 }]);
  D.bush = mergeColored([{ geo: new THREE.IcosahedronGeometry(0.9, 0).scale(1, 0.7, 1).translate(0, 0.5, 0), color: C(0x4a8a2e), uv: 2 }]);
  const ms1 = new THREE.CylinderGeometry(1, 1.15, 0.6, 12).translate(0, 0.7, 0);
  const ms2 = new THREE.CylinderGeometry(1.15, 1.4, 0.4, 12).translate(0, 0.2, 0);
  D.mesa = mergeColored([{ geo: ms1, color: C(0xc06a3a), uv: 6 }, { geo: ms2, color: C(0x9a4e2a), uv: 6 }]);
  return D;
})();
const groundMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: texDetail });
const decoMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: texDetail });
const dummy = new THREE.Object3D();

// ---- ground chunks -----------------------------------------------------------
const CH = 120, SEG = 20; // 6 m cells (§Q)
function makeChunk(cx, cz) {
  const g = new THREE.Group();
  const x0 = cx * CH, z0 = cz * CH;
  const geo = new THREE.PlaneGeometry(CH, CH, SEG, SEG).rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(x0 + p.getX(i), z0 + p.getZ(i)));
  // One copy of the texture every 4 m, carried across the squares unbroken.
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * CH) / 4 + (cx * CH) / 4, (uv.getY(i) * CH) / 4 + (cz * CH) / 4);
  const ng = geo.toNonIndexed();
  ng.computeVertexNormals();
  geo.dispose();
  const pa = ng.attributes.position, col = new Float32Array(pa.count * 3);
  for (let i = 0; i < pa.count; i += 3) {
    const x = (pa.getX(i) + pa.getX(i + 1) + pa.getX(i + 2)) / 3;
    const z = (pa.getZ(i) + pa.getZ(i + 1) + pa.getZ(i + 2)) / 3;
    const h = (pa.getY(i) + pa.getY(i + 1) + pa.getY(i + 2)) / 3;
    faceColor(x0 + x, z0 + z, h, tmpC);
    for (let j = 0; j < 3; j++) col.set([tmpC.r, tmpC.g, tmpC.b], (i + j) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const ground = new THREE.Mesh(ng, groundMat);
  ground.receiveShadow = true;
  g.add(ground);

  // Scenery, by the biome at the chunk's centre.
  const bio = biomeOf(regionAt(trackNear(x0, z0, _tn).s));
  const R = rngFor(cx, cz, 2), rand = (a, b) => a + R() * (b - a);
  for (const key of Object.keys(bio.deco)) {
    const want = bio.deco[key];
    if (!want) continue;
    const mats = [], cols = [];
    for (let i = 0; i < want * 2 && mats.length < want; i++) {
      const lx = rand(-CH / 2, CH / 2), lz = rand(-CH / 2, CH / 2);
      const wx = x0 + lx, wz = z0 + lz;
      const T = trackNear(wx, wz, _tn);
      const minD = key === 'mesa' ? 70 : key === 'tree' || key === 'pine' ? 11 : 8;
      if (T.d < minD || townNear(T.s, 70)) continue;
      const y = groundHeight(wx, wz);
      if (y > 6 && tunnelNear(T.s, 100)) continue;
      dummy.position.set(lx, y, lz);
      dummy.rotation.set(0, rand(0, Math.PI * 2), 0);
      if (key === 'mesa') {
        const r = rand(12, 30);
        dummy.scale.set(r, rand(10, 24), r * rand(0.7, 1.2));
      } else {
        const s = rand(0.7, 1.4);
        dummy.scale.set(s, s * rand(0.85, 1.3), s);
      }
      dummy.updateMatrix();
      mats.push(dummy.matrix.clone());
      if (key === 'rock') cols.push(bio.rock.clone());
      else if (key === 'tree' || key === 'bush') cols.push(new THREE.Color().setHSL(0.27 + R() * 0.06, 0.6, 0.3 + R() * 0.12));
      else cols.push(new THREE.Color(0xffffff));
    }
    if (!mats.length) continue;
    const im = new THREE.InstancedMesh(DECO[key], decoMat, mats.length);
    mats.forEach((m, i) => {
      im.setMatrixAt(i, m);
      im.setColorAt(i, cols[i]);
    });
    im.castShadow = true;
    g.add(im);
  }
  g.position.set(x0, 0, z0);
  return { group: g, own: [ng] };
}

// ---- track pieces ------------------------------------------------------------
const TP_LEN = 80;
function stripGeo(rows, cols, getP, getUV = (r, c) => [c, r]) {
  const pos = [], uv = [], idx = [], p = new THREE.Vector3();
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      getP(r, c, p);
      pos.push(p.x, p.y, p.z);
      uv.push(...getUV(r, c));
    }
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  const ng = g.toNonIndexed();
  ng.computeVertexNormals();
  g.dispose();
  return ng;
}
const mats = {
  bed: painted(0x6e6258, texDetail),
  rail: plain(0x2e2a28),
  tie: painted(0x4a3220, texPlanks),
  pole: painted(0x3a2a1c, texBark, 1),
  tube: painted(0x2a2e3a, texStone, 2, { side: THREE.DoubleSide }),
  stone: painted(0x4a5468, texStone),
  dark: plain(0x06102a),
  lamp: new THREE.MeshBasicMaterial({ color: 0xffb347 }),
  roof: plain(0x2a2430),
  roof2: plain(0x2e2834),
  planks: painted(0x7a6a58, texPlanks),
  window: plain(0x1a3ce8),
};
const tieGeo = tiledBox(2.5, 0.14, 0.26, 2);
const poleGeo = tiledCyl(0.1, 0.13, 7, 5, 1);
const barGeo = new THREE.BoxGeometry(1.4, 0.12, 0.12);

function box(w, h, d, mat, x, y, z, parent) {
  if (typeof mat === 'number') mat = plain(mat);
  const m = new THREE.Mesh(tiledBox(w, h, d, mat.userData.tile), mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
function cylinder(rt, rb, h, seg, mat, x, y, z, parent) {
  if (typeof mat === 'number') mat = plain(mat);
  const m = new THREE.Mesh(tiledCyl(rt, rb, h, seg, mat.userData.tile), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function makePiece(k) {
  const g = new THREE.Group();
  const own = [];
  const sA = k * TP_LEN, sB = sA + TP_LEN, n = TP_LEN / TRK_STEP;
  const P = [];
  for (let i = 0; i <= n; i++) P.push(trackAt(sA + i * TRK_STEP, { x: 0, z: 0, th: 0 }));
  const across = (t, w, y, o) => o.set(t.x + Math.cos(t.th) * w, y, t.z + Math.sin(t.th) * w);
  const bed = stripGeo(n + 1, 2, (r, c, o) => across(P[r], c ? 2.7 : -2.7, BED_Y, o), (r, c) => [c * 1.35, r * 0.5]);
  own.push(bed);
  const bm = new THREE.Mesh(bed, mats.bed);
  bm.receiveShadow = true;
  g.add(bm);
  for (const off of [-0.72, 0.72]) {
    const rail = stripGeo(n + 1, 4, (r, c, o) => {
      const w = off + (c === 0 || c === 1 ? -0.05 : 0.05);
      across(P[r], w, c === 0 || c === 3 ? BED_Y + 0.07 : RAIL_TOP, o);
    });
    own.push(rail);
    g.add(new THREE.Mesh(rail, mats.rail));
  }
  const nt = Math.floor(TP_LEN / 0.7);
  const ties = new THREE.InstancedMesh(tieGeo, mats.tie, nt);
  for (let i = 0; i < nt; i++) {
    const t = trackAt(sA + i * 0.7 + 0.35);
    dummy.position.set(t.x, BED_Y + 0.07, t.z);
    dummy.rotation.set(0, -t.th, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    ties.setMatrixAt(i, dummy.matrix);
  }
  ties.receiveShadow = true;
  g.add(ties);

  const tun = tunnelNear(sA, 0) || tunnelNear(sB, 0);
  // Telegraph poles on the left, 40 m apart (none inside a tunnel).
  for (let i = 0; i < 2; i++) {
    const s = sA + 20 + i * 40;
    if (tun && s > tun.s0 && s < tun.s1) continue;
    const t = trackAt(s);
    const px = t.x - Math.cos(t.th) * 7.5, pz = t.z - Math.sin(t.th) * 7.5;
    const pole = new THREE.Mesh(poleGeo, mats.pole);
    pole.position.set(px, 3.5, pz);
    pole.castShadow = true;
    const bar = new THREE.Mesh(barGeo, mats.pole);
    bar.position.set(px, 6.6, pz);
    bar.rotation.y = -t.th;
    g.add(pole, bar);
  }

  // The tunnel: a stone bore with lanterns, and a cliff portal at each end.
  if (tun) {
    const i0 = Math.max(0, Math.ceil((tun.s0 - sA) / TRK_STEP)), i1 = Math.min(n, Math.floor((tun.s1 - sA) / TRK_STEP));
    if (i1 > i0) {
      const arch = [];
      for (let a = 0; a <= 8; a++) {
        const ang = Math.PI - (a * Math.PI) / 8;
        arch.push([Math.cos(ang) * 3.7, 1.3 + Math.sin(ang) * 3.7]);
      }
      const ring = [[-3.7, -0.5], [-3.7, 1.3]].concat(arch.slice(1, 8)).concat([[3.7, 1.3], [3.7, -0.5], [0, -0.45], [-3.7, -0.5]]);
      const tube = stripGeo(i1 - i0 + 1, ring.length, (r, c, o) => across(P[i0 + r], ring[c][0], ring[c][1], o), (r, c) => [c * 2.2, r * 0.8]);
      own.push(tube);
      g.add(new THREE.Mesh(tube, mats.tube));
      for (let i = i0; i <= i1; i += 12)
        for (const side of [-1, 1]) {
          const l = box(0.18, 0.28, 0.18, mats.lamp, 0, 0, 0, g);
          across(P[i], 3.45 * side, 2.6, l.position);
        }
    }
    for (const sp of [tun.s0, tun.s1]) {
      if (sp < sA || sp >= sB) continue;
      const t = trackAt(sp);
      const f = new THREE.Group();
      f.position.set(t.x, 0, t.z);
      f.rotation.y = -t.th;
      for (const side of [-1, 1]) box(2.4, 8.5, 3.2, mats.stone, side * 4.9, 4.0, 0, f);
      box(12.2, 4.4, 3.2, mats.stone, 0, 7.2, 0, f);
      box(13.5, 1.0, 3.6, mats.stone, 0, 9.9, 0, f);
      box(0.6, 0.6, 0.3, mats.dark, 0, 6.2, -1.7, f);
      g.add(f);
    }
  }
  // A town at the start of every region.
  ensureRegions(regionAt(sB) + 1);
  regionStart.forEach((D, i) => {
    if (D < sA || D >= sB) return;
    const t = trackAt(D);
    const town = makeTown(i);
    town.position.set(t.x, 0, t.z);
    town.rotation.y = -t.th;
    g.add(town);
  });
  return { group: g, own };
}

const boards = (color) => painted(color, texPlanks);

// A town: platform, station with its roof, water tower, a few houses (§G).
function makeTown(i) {
  const t = new THREE.Group();
  const R = rngFor(i, 3, 3), rand = (a, b) => a + R() * (b - a), pick = (a) => a[Math.floor(R() * a.length)];
  box(4, 0.9, 26, mats.planks, 3.9, 0.45, 0, t);
  box(7, 4.5, 12, boards(pick([0x9a4a2e, 0x7a5a3e, 0x8a6a48])), 8.6, 2.25, 0, t);
  const roof = new THREE.Mesh(facet(new THREE.ConeGeometry(1, 1, 4)), mats.roof);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(5.6, 2.4, 9.6);
  roof.position.set(8.6, 5.7, 0);
  t.add(roof);
  box(2.2, 2.6, 0.2, mats.dark, 5.0, 1.3, -2.5, t);
  box(1.2, 1.4, 0.2, mats.window, 5.0, 2.6, 2.6, t);
  const wt = new THREE.Group();
  wt.position.set(-6.5, 0, 9);
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) box(0.22, 5, 0.22, painted(0x4a3626, texBark, 1), x, 2.5, z, wt);
  cylinder(1.7, 1.7, 2.6, 8, boards(0x6a4a2e), 0, 6.2, 0, wt);
  cylinder(0.1, 2.0, 1.1, 8, mats.roof, 0, 8.0, 0, wt);
  t.add(wt);
  for (let h = 0; h < 5; h++) {
    const side = h % 2 ? 1 : -1;
    const x = side * rand(13, 30), z = rand(-30, 30);
    const w = rand(4, 7), d = rand(5, 9), hh = rand(3, 4.2);
    box(w, hh, d, boards(pick([0x7a5a3e, 0x8e6a46, 0x5e4a36, 0x9a7a52])), x, hh / 2, z, t);
    const r = new THREE.Mesh(facet(new THREE.ConeGeometry(1, 1, 4)), mats.roof2);
    r.rotation.y = Math.PI / 4;
    r.scale.set(w * 0.8, rand(1.6, 2.4), d * 0.8);
    r.position.set(x, hh + r.scale.y / 2, z);
    t.add(r);
    box(0.1, 1.8, 0.9, mats.dark, x - (side * w) / 2, 0.9, z, t);
  }
  return t;
}

function dispose(c) {
  c.group.parent?.remove(c.group);
  for (const g of c.own) g.dispose();
  c.group.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
    else if (o.isMesh && o.geometry !== tieGeo && o.geometry !== poleGeo && o.geometry !== barGeo && !c.own.includes(o.geometry) && !Object.values(DECO).includes(o.geometry)) o.geometry.dispose();
  });
}

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.pieces = new Map();
  }

  // Keep the country built from 160 m behind the train to 480 m ahead.
  // `maxBuild` limits new ground squares per frame so the game never stutters.
  update(s, maxBuild = 3) {
    const want = new Set(), wantP = new Set();
    for (let d = s - 160; d <= s + 480; d += 40) {
      const t = trackAt(d);
      const cx = Math.floor(t.x / CH), cz = Math.floor(t.z / CH);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) want.add(cellKey(cx + dx, cz + dz));
    }
    for (let k = Math.floor((s - 160) / TP_LEN); k <= Math.floor((s + 480) / TP_LEN); k++) wantP.add(k);
    let made = 0;
    for (const key of want) {
      if (this.chunks.has(key)) continue;
      const c = makeChunk(...cellOf(key));
      this.scene.add(c.group);
      this.chunks.set(key, c);
      if (++made >= maxBuild) break;
    }
    for (const [key, c] of this.chunks) if (!want.has(key)) (dispose(c), this.chunks.delete(key));
    for (const k of wantP) {
      if (this.pieces.has(k)) continue;
      const c = makePiece(k);
      this.scene.add(c.group);
      this.pieces.set(k, c);
    }
    for (const [k, c] of this.pieces) if (!wantP.has(k)) (dispose(c), this.pieces.delete(k));
  }
}
