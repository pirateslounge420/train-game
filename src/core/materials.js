import * as THREE from 'three';

// Shared flat-shaded materials, cached by colour so we don't create
// hundreds of duplicates.
const cache = new Map();

export function flat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!cache.has(key)) {
    cache.set(
      key,
      new THREE.MeshStandardMaterial({
        color,
        flatShading: true,
        roughness: opts.roughness ?? 0.85,
        metalness: opts.metalness ?? 0,
        emissive: opts.emissive ?? 0x000000,
        emissiveIntensity: opts.emissiveIntensity ?? 1,
      }),
    );
  }
  return cache.get(key);
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
