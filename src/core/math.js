import * as THREE from 'three';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const rand = (a, b) => a + Math.random() * (b - a);

// Seeded random number generator (same seed -> same sequence).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Does the line segment p0->p1 pass through the box (min,max)?
// Returns { t, axis, sign } where t is 0..1 along the segment, and
// axis/sign describe the face that was hit; or null for a miss.
export function segmentBox(p0, p1, min, max) {
  let tmin = 0;
  let tmax = 1;
  let axis = -1;
  let sign = 0;
  for (let i = 0; i < 3; i++) {
    const k = i === 0 ? 'x' : i === 1 ? 'y' : 'z';
    const o = p0[k];
    const d = p1[k] - o;
    if (Math.abs(d) < 1e-9) {
      if (o < min[k] || o > max[k]) return null;
      continue;
    }
    let t1 = (min[k] - o) / d;
    let t2 = (max[k] - o) / d;
    let s = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      s = 1;
    }
    if (t1 > tmin) {
      tmin = t1;
      axis = i;
      sign = s;
    }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return { t: tmin, axis, sign };
}

// Stretch a 1-unit-tall mesh (built along +Y) so it spans from a to b.
const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();
export function placeBetween(mesh, a, b) {
  _dir.subVectors(b, a);
  const len = _dir.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  if (len > 1e-6) mesh.quaternion.setFromUnitVectors(_up, _dir.multiplyScalar(1 / len));
  mesh.scale.set(1, len, 1);
}

// Find the launch velocity (relative to the shooter's own motion) that makes
// a projectile of the given speed hit a target `d` away, when the shooter
// moves at velocity `w` relative to the target. Gravity pulls down.
// Returns the velocity vector (THREE.Vector3) or null if out of range.
export function solveBallistic(d, w, speed, g) {
  const q = new THREE.Vector3();
  const f = (t) => {
    q.set(d.x - w.x * t, d.y - w.y * t + 0.5 * g * t * t, d.z - w.z * t);
    return q.length() - speed * t;
  };
  let prevT = 0.001;
  for (let t = 0.02; t < 4; t += 0.02) {
    if (f(t) <= 0) {
      let a = prevT;
      let b = t;
      for (let i = 0; i < 20; i++) {
        const m = (a + b) / 2;
        if (f(m) > 0) a = m;
        else b = m;
      }
      f(b);
      return q.divideScalar(b);
    }
    prevT = t;
  }
  return null;
}
