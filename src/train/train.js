import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flat, PALETTE as P } from '../core/materials.js';
import { placeBetween } from '../core/math.js';
import { RAIL_TOP } from '../world/terrain.js';

// The train: locomotive, tender, boxcar and flatcar.
//
// Everything is built in "train space": the front of the locomotive points
// toward -Z, the track centre is x = 0 and y = 0 is the ground. The whole
// group then slides along the track. The player, stuck arrows and the
// collision boxes all live in this same space, which is how the player
// rides along instead of sliding off.
//
// Layout along Z (front to back):
//   locomotive  -23.9 .. -8.9   (cab floor 2.25, cab roof 4.45)
//   tender       -8.9 .. -2.0   (top of coal 3.2)
//   boxcar       -2.0 .. 11.0   (deck 1.45, roof 4.35)
//   flatcar      11.0 .. 24.0   (deck 1.45)  <- you start here

const DRIVER_R = 0.85; // driving wheel radius
const DRIVER_Y = RAIL_TOP + DRIVER_R; // wheel centre height
const CRANK = 0.32; // crank pin distance from wheel centre
const DRIVER_Z = [-16.6, -14.7, -12.8];
const MAIN_ROD = 2.9;
const CYL_BACK_Z = -19.2;

export class Train {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.position = this.group.position;
    this.speed = CONFIG.train.speed;
    this.velocity = new THREE.Vector3(0, 0, -this.speed);
    this.distance = 0;

    this.colliders = []; // solid boxes { min, max } in train space
    this.ladders = []; // climbable volumes { min, max }
    this.wheels = []; // { mesh, radius, phase }
    this.rodSides = [];

    this.buildLocomotive();
    this.buildTender();
    this.buildBoxcar();
    this.buildFlatcar();

    // Where the smoke comes out (train space).
    this.stackTop = new THREE.Vector3(0, 5.95, -21.2);
  }

  update(dt) {
    const d = this.speed * dt;
    this.position.z -= d;
    this.distance += d;
    this.velocity.set(0, 0, -this.speed);

    for (const w of this.wheels) w.mesh.rotation.x = -(this.distance / w.radius + w.phase);

    for (const side of this.rodSides) {
      const phi = this.distance / DRIVER_R + side.phase;
      const dy = CRANK * Math.cos(phi);
      const dz = -CRANK * Math.sin(phi);
      // Coupling rod: ties the three driving wheels together.
      side.coupling.position.set(side.x, DRIVER_Y + dy, (DRIVER_Z[0] + DRIVER_Z[2]) / 2 + dz);
      // Main rod: crosshead (sliding in the guides) to the middle wheel's pin.
      const pinY = DRIVER_Y + dy;
      const pinZ = DRIVER_Z[1] + dz;
      const crossZ = pinZ - Math.sqrt(MAIN_ROD * MAIN_ROD - dy * dy);
      side.crosshead.position.set(side.x + side.s * 0.1, DRIVER_Y, crossZ);
      side.main.position.set(side.x + side.s * 0.1, (pinY + DRIVER_Y) / 2, (pinZ + crossZ) / 2);
      side.main.rotation.x = Math.atan2(-dy, pinZ - crossZ);
      // Piston rod: from the cylinder to the crosshead.
      const len = crossZ - CYL_BACK_Z;
      side.piston.position.set(side.x + side.s * 0.1, DRIVER_Y, CYL_BACK_Z + len / 2);
      side.piston.scale.z = len;
    }
  }

  // ---- building helpers ----------------------------------------------------

  // A visible box, given by its min/max corners. solid=true also makes it a
  // collision box you can stand on / bump into / stick arrows in.
  block(x0, y0, z0, x1, y1, z1, color, solid = true, parent = this.group) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), typeof color === 'number' ? flat(color) : color);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    if (solid) this.solid(x0, y0, z0, x1, y1, z1);
    return m;
  }

  // An invisible collision box.
  solid(x0, y0, z0, x1, y1, z1) {
    this.colliders.push({ min: new THREE.Vector3(x0, y0, z0), max: new THREE.Vector3(x1, y1, z1) });
  }

  // A cylinder lying along the Z axis.
  cylZ(r0, r1, len, x, y, z, color, seg = 12) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, seg), typeof color === 'number' ? flat(color) : color);
    m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  cylY(r0, r1, h, x, y, z, color, seg = 12) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), typeof color === 'number' ? flat(color) : color);
    m.position.set(x, y + h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    return m;
  }

  ladder(x0, x1, y0, y1, z0, z1, faceZ, faceSign) {
    this.ladders.push({ min: new THREE.Vector3(x0, y0, z0), max: new THREE.Vector3(x1, y1 + 1.0, z1), faceSign });
    const mat = flat(P.iron, { metalness: 0.5, roughness: 0.5 });
    const z = faceZ + faceSign * 0.06;
    for (const x of [x0 + 0.08, x1 - 0.08]) this.block(x - 0.03, y0, z - 0.03, x + 0.03, y1 + 0.4, z + 0.03, mat, false);
    for (let y = y0 + 0.3; y < y1 + 0.3; y += 0.32) this.block(x0 + 0.08, y - 0.02, z - 0.02, x1 - 0.08, y + 0.02, z + 0.02, mat, false);
  }

  // A plain wheel (trucks, pony wheels) – spoked so you can see it turn.
  wheel(radius, x, z, spokes = 6, color = P.iron, phase = 0) {
    const g = new THREE.Group();
    g.position.set(x, RAIL_TOP + radius, z);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.9, radius * 0.11, 5, 16), flat(P.iron, { metalness: 0.5 }));
    tire.rotation.y = Math.PI / 2;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, 0.16, 8), flat(color));
    hub.rotation.z = Math.PI / 2;
    g.add(tire, hub);
    const spokeGeo = new THREE.BoxGeometry(0.06, radius * 1.7, 0.07);
    for (let i = 0; i < spokes; i++) {
      const s = new THREE.Mesh(spokeGeo, flat(color));
      s.rotation.x = (i / spokes) * Math.PI;
      g.add(s);
    }
    g.traverse((o) => o.isMesh && (o.castShadow = true));
    this.group.add(g);
    this.wheels.push({ mesh: g, radius, phase });
    return g;
  }

  // A two-axle freight truck (bogie).
  truck(z) {
    for (const s of [-1, 1]) {
      this.block(s * 0.86 - 0.06, 0.62, z - 1.1, s * 0.86 + 0.06, 1.05, z + 1.1, P.iron, false);
      for (const dz of [-0.75, 0.75]) this.wheel(0.42, s * 0.72, z + dz, 6);
    }
    this.block(-0.9, 0.95, z - 0.25, 0.9, 1.2, z + 0.25, P.iron, false);
  }

  rivets(points) {
    const geo = new THREE.BoxGeometry(0.05, 0.05, 0.05);
    const im = new THREE.InstancedMesh(geo, flat(0x6e5a3a, { metalness: 0.6, roughness: 0.4 }), points.length);
    const m4 = new THREE.Matrix4();
    points.forEach((p, i) => im.setMatrixAt(i, m4.makeTranslation(p[0], p[1], p[2])));
    this.group.add(im);
  }

  // ---- the locomotive ------------------------------------------------------

  buildLocomotive() {
    const brass = flat(P.brass, { metalness: 0.7, roughness: 0.35 });
    const iron = flat(P.iron, { metalness: 0.4, roughness: 0.6 });

    // Running boards / main deck (walkable), frame below it.
    this.block(-1.45, 1.95, -22.6, 1.45, 2.25, -8.9, P.iron);
    this.block(-0.55, 0.85, -22.2, 0.55, 1.95, -9.4, iron);
    // Pilot beam and deck edge trim in red.
    this.block(-1.5, 1.55, -22.75, 1.5, 2.25, -22.6, P.cabRed);
    this.block(-1.47, 2.2, -22.6, -1.43, 2.3, -8.9, brass, false);
    this.block(1.43, 2.2, -22.6, 1.47, 2.3, -8.9, brass, false);

    // Cowcatcher: angled slats forming a V.
    const slat = new THREE.BoxGeometry(0.07, 1, 0.07);
    const red = flat(P.cabRed);
    for (let i = -5; i <= 5; i++) {
      const x = i * 0.27;
      const top = new THREE.Vector3(x, 1.6, -22.75);
      const bottom = new THREE.Vector3(x * 0.92, RAIL_TOP + 0.12, -24.0 + Math.abs(x) * 0.75);
      const m = new THREE.Mesh(slat, red);
      placeBetween(m, top, bottom);
      m.castShadow = true;
      this.group.add(m);
    }
    this.block(-1.4, RAIL_TOP + 0.08, -23.9, 1.4, RAIL_TOP + 0.2, -23.0, red, false);
    this.solid(-1.4, RAIL_TOP, -24.0, 1.4, 1.6, -22.75);

    // Smokebox + boiler.
    this.cylZ(0.97, 0.97, 2.0, 0, 3.2, -21.2, P.iron, 14);
    const door = this.cylZ(0.75, 0.75, 0.08, 0, 3.2, -22.22, iron, 14);
    door.rotation.y = 0;
    this.cylZ(0.12, 0.12, 0.12, 0, 3.2, -22.3, brass, 8);
    this.cylZ(0.9, 0.9, 7.6, 0, 3.2, -16.4, P.boiler, 14);
    for (const z of [-20.1, -18.0, -16.0, -14.0, -12.75]) this.cylZ(0.93, 0.93, 0.1, 0, 3.2, z, brass, 14);
    // (collision a little slimmer than the boiler so you fit on the running boards)
    this.solid(-0.85, 2.25, -22.2, 0.85, 4.17, -12.6);

    // Smokestack (balloon stack), domes, bell, whistle.
    this.cylY(0.3, 0.34, 0.85, 0, 4.0, -21.2, P.iron, 10);
    this.cylY(0.72, 0.3, 0.95, 0, 4.85, -21.2, P.iron, 10);
    this.cylY(0.76, 0.76, 0.12, 0, 5.78, -21.2, brass, 10);
    this.cylY(0.42, 0.5, 0.65, 0, 3.95, -17.0, brass, 12);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), brass);
    cap.position.set(0, 4.6, -17.0);
    this.group.add(cap);
    this.cylY(0.36, 0.44, 0.5, 0, 3.95, -15.0, P.boiler, 12);
    this.cylY(0.38, 0.38, 0.06, 0, 4.45, -15.0, brass, 12);
    this.cylY(0.04, 0.04, 0.35, 0, 4.0, -19.0, iron, 6);
    this.cylY(0.2, 0.08, 0.28, 0, 4.25, -19.0, brass, 10);
    this.cylY(0.06, 0.06, 0.45, 0.25, 4.0, -13.3, brass, 6);

    // Headlamp – the big box lamp on the smokebox.
    this.block(-0.32, 4.15, -22.25, 0.32, 4.8, -21.7, brass, false);
    this.cylY(0.07, 0.1, 0.25, 0, 4.8, -21.95, P.iron, 6);
    const lens = new THREE.Mesh(
      new THREE.CircleGeometry(0.24, 12),
      flat(P.lamp, { emissive: P.lamp, emissiveIntensity: 1.2 }),
    );
    lens.position.set(0, 4.47, -22.26);
    lens.rotation.y = Math.PI;
    this.group.add(lens);

    // Steam turbine casing (takes over at high speed) along the left
    // shoulder of the boiler, with its exhaust pipe into the smokebox.
    this.cylZ(0.3, 0.3, 3.6, -0.72, 3.95, -16.0, flat(0x7d7f80, { metalness: 0.7, roughness: 0.35 }), 10);
    for (const z of [-17.6, -16.0, -14.4]) this.cylZ(0.33, 0.33, 0.08, -0.72, 3.95, z, brass, 10);
    this.cylZ(0.12, 0.12, 2.6, -0.62, 3.85, -19.2, iron, 6);

    // Handrails along the boiler.
    for (const s of [-1, 1]) this.block(s * 1.0 - 0.025, 3.75, -21.0, s * 1.0 + 0.025, 3.8, -12.8, brass, false);

    // Six cylinders: three stacked on each side, with brass end caps.
    for (const s of [-1, 1]) {
      for (const y of [DRIVER_Y - 0.42, DRIVER_Y, DRIVER_Y + 0.42]) {
        this.cylZ(0.2, 0.2, 1.6, s * 1.12, y, -20.0, P.iron, 10);
        this.cylZ(0.22, 0.22, 0.08, s * 1.12, y, -20.82, brass, 10);
        this.cylZ(0.22, 0.22, 0.08, s * 1.12, y, -19.18, brass, 10);
      }
      // Guide bars the crosshead slides in.
      for (const dy of [-0.11, 0.11]) this.block(s * 1.09 - 0.03, DRIVER_Y + dy - 0.02, -19.2, s * 1.09 + 0.03, DRIVER_Y + dy + 0.02, -17.0, brass, false);
    }
    this.solid(-1.35, RAIL_TOP + 0.2, -20.85, 1.35, 1.95, -19.1);

    // Pony truck and trailing wheels.
    for (const s of [-1, 1]) {
      this.wheel(0.45, s * 0.75, -21.75, 6);
      this.wheel(0.45, s * 0.75, -20.55 + 0.0, 6);
      this.wheel(0.55, s * 0.75, -10.5, 8);
    }

    // Driving wheels: big, red, spoked, with counterweights and crank pins.
    for (const s of [-1, 1]) {
      const phase = s === 1 ? 0 : Math.PI / 2; // left/right sides 90° apart
      for (const z of DRIVER_Z) {
        const w = this.wheel(DRIVER_R, s * 0.82, z, 12, P.wheelRed, phase);
        const cw = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.32, 0.62), flat(P.wheelRed));
        cw.position.set(s * 0.02, -0.5, 0);
        const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.3, 8), flat(P.brass, { metalness: 0.7 }));
        pin.rotation.z = Math.PI / 2;
        pin.position.set(s * 0.12, CRANK, 0);
        w.add(cw, pin);
      }
      const rodMat = flat(0x9a9ea3, { metalness: 0.8, roughness: 0.3 });
      const coupling = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, DRIVER_Z[2] - DRIVER_Z[0] + 0.35), rodMat);
      const main = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, MAIN_ROD + 0.2), rodMat);
      const piston = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1), rodMat);
      const crosshead = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.32), flat(P.brass, { metalness: 0.7 }));
      for (const m of [coupling, main, piston, crosshead]) {
        m.castShadow = true;
        this.group.add(m);
      }
      this.rodSides.push({ x: s * 0.99, s, phase, coupling, main, piston, crosshead });
    }
    // Splashers (wheel covers) over the drivers.
    for (const s of [-1, 1]) this.block(s * 1.45 - 0.02, 1.85, -17.6, s * 1.45 + 0.02, 1.95, -11.8, brass, false);

    // ---- the cab ----
    const cab = P.cabRed;
    // side walls (lower half solid, then window posts)
    for (const s of [-1, 1]) {
      this.block(s * 1.45 - 0.05, 2.25, -12.6, s * 1.45 + 0.05, 3.2, -9.3, cab);
      for (const z of [-12.6, -10.95, -9.4]) this.block(s * 1.45 - 0.05, 3.2, z, s * 1.45 + 0.05, 4.3, z + 0.12, cab);
      this.block(s * 1.45 - 0.06, 3.17, -12.6, s * 1.45 + 0.06, 3.23, -9.3, brass, false);
    }
    // front wall (the boiler backhead) with a glowing firebox door
    this.block(-0.97, 2.25, -12.62, 0.97, 4.3, -12.55, cab, false);
    this.solid(-0.85, 2.25, -12.62, 0.85, 4.3, -12.55);
    this.block(-0.3, 2.6, -12.55, 0.3, 3.05, -12.5, flat(0xff7a2a, { emissive: 0xff5a10, emissiveIntensity: 1.5 }), false);
    for (const s of [-1, 1]) this.block(s * 0.6 - 0.22, 3.55, -12.64, s * 0.6 + 0.22, 3.95, -12.62, flat(0x223040, { metalness: 0.6, roughness: 0.2 }), false);
    // gauges
    for (const x of [-0.45, 0, 0.45]) this.cylZ(0.09, 0.09, 0.05, x, 3.35, -12.53, brass, 10);
    // roof (walkable) – stops short at the back for the ladder
    this.block(-1.62, 4.3, -12.85, 1.62, 4.45, -9.65, P.iron);
    // ladders: up to the cab roof, and up onto the tender from the cab
    this.ladder(0.55, 1.25, 2.25, 4.45, -9.65, -8.95, -9.65, 1);
    this.ladder(-1.25, -0.55, 2.25, 3.2, -9.6, -8.9, -8.9, -1);

    const rv = [];
    for (const s of [-1, 1]) for (let z = -12.5; z < -9.3; z += 0.25) rv.push([s * 1.51, 2.35, z], [s * 1.51, 3.1, z]);
    this.rivets(rv);
  }

  buildTender() {
    const z0 = -8.9;
    const z1 = -2.0;
    const brass = flat(P.brass, { metalness: 0.7, roughness: 0.35 });
    this.block(-1.5, 1.1, z0, 1.5, 1.45, z1, P.iron, false);
    this.block(-1.45, 1.45, z0, 1.45, 3.2, z1, P.boiler);
    this.block(-1.47, 3.0, z0, 1.47, 3.08, z1, brass, false);
    this.block(-1.47, 1.6, z0, 1.47, 1.66, z1, brass, false);
    // coal heap
    const coal = flat(P.coal, { roughness: 1 });
    const geo = new THREE.DodecahedronGeometry(1, 0);
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(geo, coal);
      m.scale.set(0.7 + (i % 3) * 0.15, 0.25, 0.8);
      m.position.set(((i % 3) - 1) * 0.75, 3.12, z0 + 1.2 + Math.floor(i / 3) * 1.4);
      m.rotation.y = i * 1.3;
      m.receiveShadow = true;
      this.group.add(m);
    }
    this.truck(-7.6);
    this.truck(-3.3);
    this.ladder(-1.1, -0.4, 1.45, 3.2, -2.05, -1.5, -2.0, 1);
    const rv = [];
    for (const s of [-1, 1]) for (let z = z0 + 0.15; z < z1; z += 0.3) rv.push([s * 1.46, 1.8, z], [s * 1.46, 2.9, z]);
    for (let z = z0 + 0.15; z < z1; z += 1.15) for (let y = 1.85; y < 2.9; y += 0.18) for (const s of [-1, 1]) rv.push([s * 1.46, y, z]);
    this.rivets(rv);
  }

  buildBoxcar() {
    const z0 = -2.0;
    const z1 = 11.0;
    this.block(-1.5, 1.1, z0, 1.5, 1.45, z1, P.darkWood); // deck / underframe
    this.block(-1.45, 1.45, -1.0, 1.45, 4.25, 10.0, P.boxcar); // body
    this.block(-1.55, 4.25, -1.05, 1.55, 4.3, 10.05, P.darkWood, false); // roof
    this.block(-0.45, 4.3, -1.0, 0.45, 4.35, 10.0, P.wood); // roof walk
    // planks / bracing for that wooden look
    for (const s of [-1, 1]) {
      for (let z = -0.6; z < 10; z += 1.2) this.block(s * 1.46 - 0.02, 1.5, z, s * 1.46 + 0.02, 4.2, z + 0.08, P.darkWood, false);
      this.block(s * 1.47 - 0.02, 1.9, 3.3, s * 1.47 + 0.02, 3.9, 5.7, 0x6e2c1c, false); // door
    }
    this.truck(0.8);
    this.truck(8.2);
    this.ladder(0.4, 1.1, 1.45, 4.35, -1.5, -0.95, -1.0, -1);
    this.ladder(-1.1, -0.4, 1.45, 4.35, 9.95, 10.5, 10.0, 1);
  }

  buildFlatcar() {
    const z0 = 11.0;
    const z1 = 24.0;
    const brass = flat(P.brass, { metalness: 0.7, roughness: 0.35 });
    this.block(-1.5, 1.1, z0, 1.5, 1.45, z1, P.wood);
    for (let z = z0 + 0.3; z < z1; z += 0.5) this.block(-1.49, 1.44, z, 1.49, 1.46, z + 0.05, P.darkWood, false);
    // railings
    for (const s of [-1, 1]) {
      this.block(s * 1.45 - 0.04, 2.3, z0 + 1, s * 1.45 + 0.04, 2.38, z1, brass, false);
      this.solid(s * 1.45 - 0.05, 1.45, z0 + 1, s * 1.45 + 0.05, 2.38, z1);
      for (let z = z0 + 1; z <= z1; z += 1.3) this.block(s * 1.45 - 0.035, 1.45, z - 0.035, s * 1.45 + 0.035, 2.35, z + 0.035, P.iron, false);
    }
    this.block(-1.45, 2.3, z1 - 0.08, 1.45, 2.38, z1, brass, false);
    this.solid(-1.45, 1.45, z1 - 0.1, 1.45, 2.38, z1);
    // crates and barrels for cover
    this.block(-1.35, 1.45, 14.0, -0.35, 2.45, 15.0, P.wood);
    this.block(-1.3, 2.45, 14.1, -0.5, 3.15, 14.9, P.darkWood);
    this.block(0.45, 1.45, 19.5, 1.35, 2.35, 20.4, P.wood);
    for (const [x, z] of [[1.0, 13.3], [-0.95, 21.6]]) {
      this.cylY(0.33, 0.33, 0.95, x, 1.45, z, P.darkWood, 10);
      this.solid(x - 0.33, 1.45, z - 0.33, x + 0.33, 2.4, z + 0.33);
    }
    this.truck(13.0);
    this.truck(22.0);
  }
}
