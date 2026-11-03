import * as THREE from 'three';

// Shared matte materials, cached so we don't create hundreds of duplicates.
// No shine anywhere (§J): Lambert only. Round things shade smooth (§Q); a shape
// that should show its faces goes through `facet`.
const cache = new Map();

// One colour. opts: emissive and emissiveIntensity, for things that glow.
export function plain(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!cache.has(key)) cache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return cache.get(key);
}

// A colour with a painted texture on it. tile: metres one copy of the texture
// covers, kept on the material so the shape can size its UVs to match.
export function painted(color, tex, tile = 2, opts = {}) {
  const key = `${color}|${tex.uuid}|${tile}|${JSON.stringify(opts)}`;
  if (!cache.has(key)) {
    const m = new THREE.MeshLambertMaterial({ color, map: tex, ...opts });
    m.userData.tile = tile;
    cache.set(key, m);
  }
  return cache.get(key);
}

export function facet(geo) {
  const g = geo.toNonIndexed();
  g.computeVertexNormals();
  return g;
}

// A box whose texture repeats every `tile` metres on every face.
export function tiledBox(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (tile) {
    const uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++)
      for (let i = 0; i < 4; i++) {
        const k = f * 4 + i;
        uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
      }
  }
  return g;
}

// The same for a cylinder.
export function tiledCyl(rt, rb, h, seg, tile) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (tile) {
    const uv = g.attributes.uv, cu = (Math.PI * 2 * Math.max(rt, rb)) / tile, cv = h / tile;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * cu, uv.getY(i) * cv);
  }
  return g;
}

// Palette – warm Wild West colours.
export const PALETTE = {
  iron: 0x23262a,
  boiler: 0x2c3b33,
  brass: 0xc99a3c,
  cabRed: 0x7c2b1f,
  wheelRed: 0xa3352a,
  wood: 0x8a5a36,
  darkWood: 0x5e3b22,
  boxcar: 0x8e3b26,
  coal: 0x1b1b1d,
  lamp: 0xffe2a0,
};
