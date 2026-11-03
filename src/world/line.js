import * as THREE from 'three';

// The line and the country it runs through (§G, §R; ported from reference 0.7).
//
// Everything comes from one seed: the curves, each region's biome, each
// chunk's scenery, each town. `?seed=N` in the address replays a run.
//
// Distances along the line are "s", in metres from the first town.
// Heading "th" is 0 when the line runs toward -Z; forward is
// (sin th, 0, -cos th) and right is (cos th, 0, sin th).

export const SEED = (() => {
  const q = new URLSearchParams(location.search).get('seed');
  if (q) return parseInt(q, 10) >>> 0 || 1;
  return Math.floor(Math.random() * 4294967295) >>> 0 || 1;
})();

// ---- seeded randomness and the reference build's noise -----------------
export function mulberry(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// A random stream for one thing (a chunk, a segment, a town), from the seed.
export function rngFor(a, b, c) {
  const h = (SEED ^ Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b | 0) + 0x27d4eb2f, 0xc2b2ae35) ^ Math.imul((c | 0) + 0x165667b1, 0x9e3779b1)) >>> 0;
  return mulberry(h);
}
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
export function hash2(x, z) {
  const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
// Value noise, 0..1.
export function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  return lerp(lerp(hash2(xi, zi), hash2(xi + 1, zi), u), lerp(hash2(xi, zi + 1), hash2(xi + 1, zi + 1), u), v);
}
export function fbm(x, z, o) {
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < o; i++) {
    s += a * vnoise(x * f, z * f);
    n += a;
    a *= 0.5;
    f *= 2.07;
  }
  return s / n;
}

// ---- regions, biomes, towns, tunnels ----------------------------------------
export const TOWNS = ['Dry Creek', 'Cinder Flats', 'Ambrose Junction', 'Hollow Pine', 'Salt Lick', 'Red Gulch', 'Fort Weller', 'Copperhead', 'Mercy Springs', 'Blackwater', 'Lantern Hill', 'Ninefold', 'Gallows Bend', 'Tallow'];
const C = (h) => new THREE.Color(h);
// g1/g2/g3: ground colours. amp: hills near the line; far: how high the
// country rises further out. fogN/fogF: how far you see. deco: scenery per chunk.
export const BIOMES = [
  { name: 'Prairie', g1: C(0x3a7a22), g2: C(0x245a18), g3: C(0xc8782c), amp: 2.5, far: 35, fogN: 90, fogF: 440, rock: C(0x6a7488), deco: { tree: 5, pine: 0, cactus: 0, rock: 7, bush: 14, mesa: 0 } },
  { name: 'Red Desert', g1: C(0xb84a1c), g2: C(0x8e3614), g3: C(0xd06a2a), amp: 3.5, far: 28, fogN: 120, fogF: 520, rock: C(0x9a4a2a), deco: { tree: 0, pine: 0, cactus: 24, rock: 16, bush: 3, mesa: 2 } },
  { name: 'High Pass', g1: C(0x56705a), g2: C(0x3c5444), g3: C(0x6e7a80), amp: 9, far: 150, fogN: 70, fogF: 380, rock: C(0x5a6a80), deco: { tree: 0, pine: 14, cactus: 0, rock: 30, bush: 4, mesa: 0 }, tunnel: true },
  { name: 'Pine Country', g1: C(0x2a6a22), g2: C(0x1c4a18), g3: C(0x4a6a2a), amp: 5, far: 70, fogN: 60, fogF: 360, rock: C(0x56646a), deco: { tree: 0, pine: 48, cactus: 0, rock: 8, bush: 10, mesa: 0 } },
  { name: 'Salt Flats', g1: C(0xb0c4e8), g2: C(0x94aad8), g3: C(0xd2dcf0), amp: 0.5, far: 18, fogN: 140, fogF: 560, rock: C(0x8a9ab8), deco: { tree: 0, pine: 0, cactus: 2, rock: 6, bush: 0, mesa: 0 } },
  { name: 'Badlands', g1: C(0x9a4a22), g2: C(0x6e3014), g3: C(0xb86a2e), amp: 7, far: 60, fogN: 90, fogF: 420, rock: C(0x8a4a2e), deco: { tree: 1, pine: 0, cactus: 6, rock: 24, bush: 4, mesa: 4 }, tunnel: true },
];
// Each biome's place on a temperature / moisture chart (Whittaker-style).
const CLIMATE = { Prairie: [0.55, 0.6], 'Red Desert': [0.9, 0.15], 'High Pass': [0.25, 0.45], 'Pine Country': [0.35, 0.8], 'Salt Flats': [0.7, 0.1], Badlands: [0.75, 0.35] };

// Each region is longer and faster than the last: cruise 15 m/s + 5 a region,
// capped at 62; a region lasts 131 s at its cruise (§G, §K).
export function regionSpeed(i) {
  return Math.min(62, 15 + i * 5);
}
export function regionLength(i) {
  return Math.round(regionSpeed(i) * 131);
}
// regionStart[i]: where region i begins, which is where town i stands.
export const regionStart = [0];
export function ensureRegions(n) {
  while (regionStart.length <= n + 1) {
    const i = regionStart.length - 1;
    regionStart.push(regionStart[i] + regionLength(i));
  }
}
export function regionAt(s) {
  if (s < 0) return 0;
  for (let i = 0; ; i++) {
    ensureRegions(i + 1);
    if (s < regionStart[i + 1]) return i;
  }
}

// A temperature and a moisture drift along the line; each region takes the
// biome nearest its climate, never the same as the one before (§R).
const biomeCache = [];
export function biomeOf(i) {
  if (biomeCache[i]) return biomeCache[i];
  if (i === 0) return (biomeCache[0] = BIOMES[0]);
  const so = (SEED % 1000) * 0.37;
  const temp = fbm(i * 0.41 + so, 2.7, 2);
  const moist = fbm(i * 0.33 + 11.1, so * 0.5 + 5.9, 2);
  const prev = biomeOf(i - 1);
  let best = null, bd = 9, second = null, sd = 9;
  for (const b of BIOMES) {
    const c = CLIMATE[b.name];
    const d = Math.hypot(c[0] - temp, c[1] - moist);
    if (d < bd) {
      second = best;
      sd = bd;
      best = b;
      bd = d;
    } else if (d < sd) {
      second = b;
      sd = d;
    }
  }
  return (biomeCache[i] = best === prev ? second : best);
}

// The biome at s, blending into the next over 320 m either side of a town.
const bp = { amp: 0, far: 0, t: 0, a: null, b: null };
export function biomeParams(s) {
  const i = regionAt(s);
  const a = biomeOf(i), b = biomeOf(i + 1);
  const t = smooth(regionStart[i + 1] - 320, regionStart[i + 1] + 320, s);
  bp.a = a;
  bp.b = b;
  bp.t = t;
  bp.amp = lerp(a.amp, b.amp, t);
  bp.far = lerp(a.far, b.far, t);
  return bp;
}

// One tunnel in the middle of each High Pass and Badlands region.
const tunnelCache = {};
export function tunnelOf(i) {
  if (i in tunnelCache) return tunnelCache[i];
  ensureRegions(i + 1);
  let t = null;
  if (biomeOf(i).tunnel) {
    const L = regionStart[i + 1] - regionStart[i];
    const s0 = Math.round(regionStart[i] + L * 0.44);
    t = { s0, s1: s0 + Math.round(Math.min(320, L * 0.1)) };
  }
  return (tunnelCache[i] = t);
}
export function tunnelNear(s, margin) {
  const i = regionAt(s);
  for (const j of [i - 1, i, i + 1]) {
    if (j < 0) continue;
    const t = tunnelOf(j);
    if (t && s > t.s0 - margin && s < t.s1 + margin) return t;
  }
  return null;
}
export function townNear(s, margin) {
  ensureRegions(regionAt(s) + 1);
  for (const d of regionStart) if (Math.abs(d - s) < margin) return true;
  return false;
}

// ---- the track: a curve through the world, sampled every 2 m ---------------
// Radius 170–460 m, at most ~50° a curve, straight through towns and tunnels,
// heading kept roughly true so it never loops back on itself (§G).
export const TRK_STEP = 2;
const BACK = 200; // samples of straight track behind the first town
const segs = [];
const trkX = [], trkZ = [], trkTh = [];
for (let i = 0; i <= BACK; i++) {
  trkX.push(0);
  trkZ.push((BACK - i) * TRK_STEP);
  trkTh.push(0);
}
const cellFine = new Map(), cellCoarse = new Map();
const CELL_F = 24, CELL_C = 120;
const KOFF = 50000, KMUL = 100003;
export function cellKey(cx, cz) {
  return (cx + KOFF) * KMUL + (cz + KOFF);
}
export function cellOf(key) {
  return [Math.floor(key / KMUL) - KOFF, (key % KMUL) - KOFF];
}

function addSeg() {
  const prev = segs[segs.length - 1];
  const s0 = prev ? prev.s0 + prev.L : 0;
  ensureRegions(regionAt(s0 + 800) + 1);
  const R = rngFor(segs.length, 1, 1), rr = (a, b) => a + R() * (b - a);
  let L = rr(150, 420);
  let k = 0;
  const head = trkTh[trkTh.length - 1];
  if (s0 > 60) {
    const r = R();
    const turn = () => {
      const rad = rr(170, 460);
      let sgn = R() < 0.5 ? -1 : 1;
      if (head > 0.8) sgn = -1;
      else if (head < -0.8) sgn = 1;
      k = sgn / rad;
      L = Math.min(L, rad * rr(0.45, 0.9));
    };
    if (prev && prev.k !== 0) {
      if (r < 0.5) turn();
    } else if (r < 0.6) turn();
  }
  if (townNear(s0, 180) || townNear(s0 + L, 180) || tunnelNear(s0, 120) || tunnelNear(s0 + L, 120)) k = 0;
  for (const d of regionStart) if (d > s0 - 120 && d < s0 + L + 120) k = 0;
  segs.push({ s0, L, k });
}
// Curvature at s, easing between segments over 60 m.
function kappa(s) {
  while (!segs.length || segs[segs.length - 1].s0 + segs[segs.length - 1].L <= s) addSeg();
  let i = segs.length - 1;
  while (segs[i].s0 > s) i--;
  const sg = segs[i], pk = i > 0 ? segs[i - 1].k : 0;
  return lerp(pk, sg.k, smooth(0, 60, s - sg.s0));
}
function register(i) {
  const x = trkX[i], z = trkZ[i];
  const kf = cellKey(Math.floor(x / CELL_F), Math.floor(z / CELL_F));
  if (!cellFine.has(kf)) cellFine.set(kf, []);
  cellFine.get(kf).push(i);
  if (i % 6 === 0) {
    const kc = cellKey(Math.floor(x / CELL_C), Math.floor(z / CELL_C));
    if (!cellCoarse.has(kc)) cellCoarse.set(kc, []);
    cellCoarse.get(kc).push(i);
  }
}
for (let i = 0; i <= BACK; i++) register(i);
function ensureTrack(s) {
  while ((trkX.length - 1 - BACK) * TRK_STEP < s + 400) {
    const i = trkX.length;
    const k = kappa((i - BACK - 0.5) * TRK_STEP);
    const th = trkTh[i - 1] + k * TRK_STEP;
    const thm = trkTh[i - 1] + k * TRK_STEP * 0.5;
    trkX.push(trkX[i - 1] + Math.sin(thm) * TRK_STEP);
    trkZ.push(trkZ[i - 1] - Math.cos(thm) * TRK_STEP);
    trkTh.push(th);
    register(i);
  }
}

// Where the line is at s: { x, z, th }.
export function trackAt(s, out = { x: 0, z: 0, th: 0 }) {
  s = Math.max(s, -BACK * TRK_STEP);
  ensureTrack(s);
  const f = s / TRK_STEP + BACK, i = Math.floor(f), t = f - i;
  out.x = lerp(trkX[i], trkX[i + 1], t);
  out.z = lerp(trkZ[i], trkZ[i + 1], t);
  out.th = lerp(trkTh[i], trkTh[i + 1], t);
  return out;
}

// The nearest bit of line to a point: { d: distance, s }.
export function trackNear(x, z, out = { d: 0, s: 0 }) {
  let bd = 1e18, bi = -1;
  const cx = Math.floor(x / CELL_F), cz = Math.floor(z / CELL_F);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      const a = cellFine.get(cellKey(cx + dx, cz + dz));
      if (!a) continue;
      for (const i of a) {
        const ex = trkX[i] - x, ez = trkZ[i] - z, d2 = ex * ex + ez * ez;
        if (d2 < bd) {
          bd = d2;
          bi = i;
        }
      }
    }
  if (bi < 0 || bd > CELL_F * CELL_F) {
    const ccx = Math.floor(x / CELL_C), ccz = Math.floor(z / CELL_C);
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++) {
        const a = cellCoarse.get(cellKey(ccx + dx, ccz + dz));
        if (!a) continue;
        for (const i of a) {
          const ex = trkX[i] - x, ez = trkZ[i] - z, d2 = ex * ex + ez * ez;
          if (d2 < bd) {
            bd = d2;
            bi = i;
          }
        }
      }
  }
  if (bi < 0) {
    out.d = 1e4;
    out.s = 0;
    return out;
  }
  out.d = Math.sqrt(bd);
  out.s = (bi - BACK) * TRK_STEP;
  return out;
}

export function forwardAt(th, out) {
  return out.set(Math.sin(th), 0, -Math.cos(th));
}
export function rightAt(th, out) {
  return out.set(Math.cos(th), 0, Math.sin(th));
}
