import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flat, PALETTE as P } from '../core/materials.js';
import { groundHeight } from './terrain.js';

// Placeholder stops along the line (stand-ins until real towns exist).
// Stop k sits at world z = -k * spacing. Each one is a low wooden platform
// on the right of the track, a little depot, a water tower and a name
// board. The train normally rolls straight through; if you've been left
// behind, the conductor pulls up at the next one and waits for you.
//
// The train stops with its origin level with the stop, so the whole train
// sits alongside the platform.

const NAMES = ['Dry Gulch', 'Coyote Wells', 'Red Mesa', 'Dustwater', 'Bitter Springs', 'Rattler Flats', 'Lone Pine', 'Buzzard Rock'];
export const PLATFORM_TOP = 0.76;

export function stopName(k) {
  return `${NAMES[(k - 1) % NAMES.length]}${k > NAMES.length ? ` ${Math.ceil(k / NAMES.length)}` : ''}`;
}
export function stopZ(k) {
  return -k * CONFIG.train.stopSpacing;
}

function nameBoard(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#ead9b0';
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = '#2b1d12';
  g.font = 'bold 54px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.toUpperCase(), 256, 52);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
}

export class Stops {
  constructor(scene) {
    this.scene = scene;
    this.built = new Map(); // k -> { group, colliders }
  }

  // Keep the stops between the front of what we can see and the back.
  update(frontZ, backZ) {
    const sp = CONFIG.train.stopSpacing;
    const first = Math.max(1, Math.floor(-(backZ + 300) / sp));
    const last = Math.ceil(-(frontZ - 1100) / sp);
    for (const [k, s] of this.built) {
      if (k < first || k > last) {
        this.scene.remove(s.group);
        this.built.delete(k);
      }
    }
    for (let k = first; k <= last; k++) if (!this.built.has(k)) this.built.set(k, this.build(k));
  }

  // Solid boxes (world space) near a point, for the player on foot.
  collidersNear(x, z, out) {
    for (const s of this.built.values()) {
      if (Math.abs(s.z - z) > 60) continue;
      for (const c of s.colliders) out.push(c);
    }
    return out;
  }

  build(k) {
    const z = stopZ(k);
    const group = new THREE.Group();
    const colliders = [];
    const box = (x0, y0, z0, x1, y1, z1, color, solid = true) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), typeof color === 'number' ? flat(color) : color);
      m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z + (z0 + z1) / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      group.add(m);
      if (solid) colliders.push({ min: new THREE.Vector3(x0, y0, z + z0), max: new THREE.Vector3(x1, y1, z + z1) });
      return m;
    };

    // Platform (right side of the track) with a step at each end.
    box(1.95, 0, -27, 5.6, PLATFORM_TOP, 27, P.wood);
    for (let pz = -26.5; pz < 27; pz += 0.9) box(1.95, PLATFORM_TOP - 0.01, pz, 5.6, PLATFORM_TOP + 0.01, pz + 0.06, P.darkWood, false);
    box(1.95, 0, -28.2, 5.6, PLATFORM_TOP / 2, -27, P.darkWood);
    box(1.95, 0, 27, 5.6, PLATFORM_TOP / 2, 28.2, P.darkWood);

    // Name boards on posts, facing the track.
    const board = nameBoard(stopName(k));
    for (const bz of [-12, 12]) {
      for (const dz of [-1.3, 1.3]) box(4.9, PLATFORM_TOP, bz + dz - 0.06, 5.02, PLATFORM_TOP + 2.6, bz + dz + 0.06, P.darkWood);
      const b = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.55), board);
      b.position.set(4.88, PLATFORM_TOP + 2.25, z + bz);
      b.rotation.y = -Math.PI / 2;
      group.add(b);
    }

    // Depot shack, set back from the bandits' riding lane.
    const gx = 17;
    const gy = groundHeight(gx + 3, z) - 0.1;
    box(gx, gy, -6, gx + 6, gy + 3.2, 4, 0x9a6a3e);
    const roof = box(gx - 0.4, gy + 3.2, -6.5, gx + 6.4, gy + 3.4, 4.5, P.darkWood, false);
    roof.rotation.z = 0.08;
    box(gx - 0.02, gy, -1.6, gx + 0.02, gy + 2.2, -0.2, 0x5e3b22, false); // door
    // A boardwalk from the platform to the shack.
    box(5.6, 0, -1.2, gx, 0.25, 1.2, P.darkWood, false);

    // Water tower on the far side.
    const tx = -18;
    const ty = groundHeight(tx, z + 10);
    for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) box(tx + dx - 0.15, ty, 10 + dz - 0.15, tx + dx + 0.15, ty + 5, 10 + dz + 0.15, P.darkWood);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 3, 10), flat(P.wood));
    tank.position.set(tx, ty + 6.5, z + 10);
    tank.castShadow = true;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 10), flat(P.darkWood));
    cap.position.set(tx, ty + 8.6, z + 10);
    cap.castShadow = true;
    group.add(tank, cap);

    this.scene.add(group);
    return { group, colliders, z };
  }
}
