import * as THREE from 'three';
import { rand } from './math.js';
import { hash2 } from '../world/line.js';

// Painted textures (§J, §Q; reference 0.7): small canvases of grey detail that
// multiply the colour of whatever wears them, so one set serves every paint
// job. About 16 texels a metre, filtered with mipmaps and anisotropy.

export function canvasTex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeTex(size, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  paint(c.getContext('2d'), size);
  return canvasTex(c);
}

function px(ctx, x, y, l, w = 1, h = 1) {
  const v = Math.round(Math.min(1, Math.max(0, l)) * 255);
  ctx.fillStyle = `rgb(${v},${v},${v})`;
  ctx.fillRect(x, y, w, h);
}

// Speckle, a few cracks and bright flecks: ground, scenery, hide, coal.
export const texDetail = makeTex(64, (ctx, s) => {
  for (let y = 0; y < s; y += 2)
    for (let x = 0; x < s; x += 2) px(ctx, x, y, 0.74 + (hash2(x * 0.5 + 3, y * 0.5 + 7) - 0.5) * 0.34, 2, 2);
  for (let i = 0; i < 7; i++) {
    let x = Math.floor(rand(0, s)), y = Math.floor(rand(0, s));
    for (let k = 0; k < 22; k++) {
      px(ctx, x & (s - 1), y & (s - 1), 0.4);
      if (Math.random() < 0.5) x += Math.random() < 0.5 ? 1 : -1;
      else y += Math.random() < 0.5 ? 1 : -1;
    }
  }
  for (let i = 0; i < 46; i++) px(ctx, Math.floor(rand(0, s)), Math.floor(rand(0, s)), 0.98);
});

// Eight boards with grain, dark seams and nail heads.
export const texPlanks = makeTex(64, (ctx, s) => {
  for (let p = 0; p < 8; p++) {
    const base = 0.62 + hash2(p * 3.1, 1.7) * 0.22;
    for (let y = 0; y < s; y++)
      for (let x = 0; x < 8; x++) {
        const g = Math.sin(y * 0.55 + p * 2.1 + Math.sin(x * 1.7)) * 0.5 + 0.5;
        px(ctx, p * 8 + x, y, base + (g - 0.5) * 0.16 + (hash2(x + p * 8, y) - 0.5) * 0.1);
      }
    for (let y = 0; y < s; y++) px(ctx, p * 8, y, 0.26);
    const ny = Math.floor(hash2(p, 9) * s);
    px(ctx, p * 8 + 4, ny, 0.95);
    px(ctx, p * 8 + 4, (ny + 32) & (s - 1), 0.95);
  }
});

// Riveted plate.
export const texIron = makeTex(32, (ctx, s) => {
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) px(ctx, x, y, 0.7 + (hash2(x, y) - 0.5) * 0.16);
  for (let i = 0; i < s; i++) {
    px(ctx, i, 0, 0.3);
    px(ctx, 0, i, 0.3);
    px(ctx, i, 16, 0.38);
  }
  for (const [x, y] of [[3, 3], [12, 3], [21, 3], [29, 3], [3, 19], [12, 19], [21, 19], [29, 19]]) {
    px(ctx, x, y, 0.98, 2, 2);
    px(ctx, x + 1, y + 1, 0.5);
  }
});

export const texBark = makeTex(32, (ctx, s) => {
  for (let x = 0; x < s; x++) {
    const col = 0.6 + Math.sin(x * 1.9) * 0.18 + (hash2(x, 2) - 0.5) * 0.2;
    for (let y = 0; y < s; y++) px(ctx, x, y, col + (hash2(x, y) - 0.5) * 0.16 + (y % 11 === 0 ? -0.25 : 0));
  }
});

// Fitted blocks, dark mortar.
export const texStone = makeTex(64, (ctx, s) => {
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const row = Math.floor(y / 16), off = (row & 1) * 12;
      const edge = (x + off) % 24 < 2 || y % 16 < 2;
      px(ctx, x, y, edge ? 0.28 : 0.66 + (hash2(Math.floor((x + off) / 24) + row * 7, 3) - 0.5) * 0.2 + (hash2(x, y) - 0.5) * 0.12);
    }
});

export const texCloth = makeTex(32, (ctx, s) => {
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) px(ctx, x, y, 0.78 + (((x + y) & 3) === 0 ? 0.14 : 0) + (hash2(x, y) - 0.5) * 0.1);
});
