import * as THREE from 'three';
import { facet, painted, plain, tiledBox, tiledCyl } from '../core/materials.js';
import { texDetail, texIron, texPlanks } from '../core/textures.js';
import { RAIL_TOP } from '../world/terrain.js';
import { TOWNS, trackAt, forwardAt, rightAt, regionAt, regionSpeed, regionStart, ensureRegions, nextHaltAfter } from '../world/line.js';

const _up = new THREE.Vector3(0, 1, 0);
const _tp = { x: 0, z: 0, th: 0 };
const _pos = new THREE.Vector3();
const _vel = new THREE.Vector3();

// The train (§D, §N; ported from reference 0.7), rear to front: the caboose
// (your home car), the hat car, the tender and the locomotive.
//
// Everything is built in "train space": the front of the locomotive points
// toward -Z, the track centre is x = 0 and y = 0 is the ground. The caboose's
// middle is z = 0; the hat car's is 10.6 m ahead, the tender's 20 m, the
// locomotive's 29.5 m. Each car then rides its own point of the curving line
// (see `place`), so the train bends. The player, stuck arrows and the
// collision boxes live in their car's frame, which is how the player rides
// along instead of sliding off.
//
// Heights (train space): floors 1.39, roofs 4.37, the tender's deck 3.75.

export const TRAIN_Y = RAIL_TOP; // the cars' own heights start at the rail tops
const ROOF_Y = 4.12, FLOOR_Y = 1.14, PARAPET = 0.55; // in a car's own heights
const WALL = 1.4; // invisible walls stand this high above a floor or roof
export const ROOF = ROOF_Y + TRAIN_Y;
export const FLOOR = FLOOR_Y + TRAIN_Y;

const CARS = [
  { name: 'locomotive', zc: -29.5, z1: -23.7 },
  { name: 'tender', zc: -20.0, z1: -16.2 },
  { name: 'hatcar', zc: -10.6, z1: -5.3 },
  { name: 'caboose', zc: 0, z1: Infinity },
];
const BRAKE = 2.4; // m/s² when pulling into a town
const HARD_BRAKE = 4.5; // m/s² when he's stopping to wait for someone (§S)
const HALT_STOP = 1.5; // seconds at a water stop, once everyone's aboard
const TOWN_STOP = 6; // seconds at each town (§G)
const MAX_SPEED = 200 * 0.44704; // never faster than 200 mph (§K)
// The surge (§K, §Y): two a stretch, each +26 m/s on top of the last, reached
// at 6 m/s², bleeding off at 1.5 m/s each second.
export const SURGES = 2;
const SURGE_BOOST = 26, SURGE_ACCEL = 6, SURGE_BLEED = 1.5;
const DRIVER_R = 1.22, PIN_R = 0.55; // eight-foot drivers (§N)

const _near = new THREE.Vector3();
const C = {
  red: 0x7a2418, iron: 0x24201d, iron2: 0x36322e, brass: 0xc9a24a, wood2: 0x4a6a3a, roof: 0x2a2622,
  cab: 0x8a3a26, cabDark: 0x4e2216, rail: 0x2e2a28, deck: 0x5a4632,
};

// What each paint job is painted on (§J; reference 0.7): riveted plate, boards
// or coal. Anything not listed stays a plain colour.
const SKIN = new Map([
  [C.iron, [texIron, 1]], [C.iron2, [texIron, 1]], [C.red, [texIron, 1]],
  [C.wood2, [texPlanks, 2]], [C.cab, [texPlanks, 2]], [C.cabDark, [texPlanks, 2]], [C.roof, [texPlanks, 2]], [C.deck, [texPlanks, 2]],
  [0x5e4a36, [texPlanks, 1]], [0x6e3a24, [texPlanks, 1]], [0x9a7a52, [texPlanks, 1]], [0x0a0a0c, [texDetail, 0.5]],
]);
function skin(color) {
  if (typeof color !== 'number') return color;
  const s = SKIN.get(color);
  return s ? painted(color, s[0], s[1]) : plain(color);
}

export class Train {
  constructor(scene) {
    this.scene = scene;
    this.d = 0; // where the caboose's middle is on the line (metres from the first town)
    this.speed = 0;
    this.cruise = regionSpeed(0);
    this.boost = 0;
    this.surges = SURGES;
    this.waitFor = false; // pulling up to wait for someone left behind (§S)
    this.held = false; // someone's off the train, so no pulling out
    this.stopAt = 0;
    this.stopKind = 'town'; // the next stop: town | halt
    this.stopHere = 'town'; // the stop we're at
    this.state = 'stop'; // run | brake | stop
    this.stopT = 2.5;
    this.nextTown = 0; // the town we're heading for (0: we start in it)
    this.region = 0;
    this.onArrive = null; // (town index) when the train stops in a town
    this.onDepart = null;

    this.wheels = []; // { mesh, radius }
    this.rods = [];
    let z0 = -Infinity;
    this.cars = CARS.map((c, i) => {
      const group = new THREE.Group();
      const inner = new THREE.Group();
      inner.position.z = -c.zc;
      group.add(inner);
      scene.add(group);
      const car = { ...c, i, z0, group, inner, colliders: [], ladders: [], vel: new THREE.Vector3(), th: 0, inv: new THREE.Matrix4(), prevInv: new THREE.Matrix4() };
      z0 = c.z1;
      return car;
    });
    const build = (car, fn) => {
      this.car = car;
      fn.call(this);
    };
    build(this.cars[3], this.buildCaboose);
    build(this.cars[2], this.buildHatCar);
    build(this.cars[1], this.buildTender);
    build(this.cars[0], this.buildLocomotive);
    delete this.car;

    // Where the smoke comes out (locomotive frame).
    this.stackTop = new THREE.Vector3(0, 6.3 + TRAIN_Y, -5.4 - 29.5);
    this.place();
    this.place(); // twice, so "last frame" is set too
  }

  get distance() {
    return this.d;
  }
  get loco() {
    return this.cars[0];
  }

  // Which car a frame position belongs to (by its z): the joints between
  // cars are halfway across each gap.
  carAt(z) {
    for (const c of this.cars) if (z < c.z1) return c;
    return this.cars[this.cars.length - 1];
  }

  // Frame <-> world for one car.
  toWorld(car, p, out = new THREE.Vector3()) {
    return out.copy(p).applyMatrix4(car.inner.matrixWorld);
  }
  toLocal(car, p, out = new THREE.Vector3()) {
    return out.copy(p).applyMatrix4(car.inv);
  }
  // A direction from a car's frame into the world, and back.
  dirToWorld(car, v, out = new THREE.Vector3()) {
    return out.copy(v).applyAxisAngle(_up, -car.th);
  }
  dirToLocal(car, v, out = new THREE.Vector3()) {
    return out.copy(v).applyAxisAngle(_up, car.th);
  }
  // The line's forward and right at the caboose.
  forward(out = new THREE.Vector3()) {
    return forwardAt(trackAt(this.d, _tp).th, out);
  }
  right(out = new THREE.Vector3()) {
    return rightAt(trackAt(this.d, _tp).th, out);
  }
  // The caboose's middle in the world (frame origin, on the line).
  get position() {
    const t = trackAt(this.d, _tp);
    return _pos.set(t.x, 0, t.z);
  }
  get velocity() {
    return this.forward(_vel).multiplyScalar(this.speed);
  }

  place() {
    for (const c of this.cars) {
      c.prevInv.copy(c.inv);
      const t = trackAt(this.d - c.zc, _tp);
      c.th = t.th;
      c.group.position.set(t.x, 0, t.z);
      c.group.rotation.y = -t.th;
      c.group.updateMatrixWorld(true);
      c.inv.copy(c.inner.matrixWorld).invert();
      forwardAt(t.th, c.vel).multiplyScalar(this.speed);
    }
  }

  // Someone's been left behind: carry on to the first stop he can pull up at,
  // town or water stop, and wait there (§S; reference planWait).
  planWait() {
    this.waitFor = true;
    const s = this.d + (this.speed * this.speed) / (2 * HARD_BRAKE) + 8;
    const town = regionStart[this.nextTown], halt = nextHaltAfter(s);
    if (this.state !== 'run' || (town >= this.d && town <= halt)) {
      this.stopAt = town;
      this.stopKind = 'town';
    } else {
      this.stopAt = halt;
      this.stopKind = 'halt';
    }
  }

  // They're back aboard: a moment to settle, then away.
  allAboard() {
    if (this.state === 'stop') this.stopT = Math.min(this.stopT, 1.6);
    this.waitFor = false;
  }

  stopName() {
    return this.stopKind === 'town' ? TOWNS[this.nextTown % TOWNS.length] : 'the water stop';
  }

  // The car nearest a point in the world, and how far off it is.
  nearestCar(p) {
    let best = null;
    for (const car of this.cars) {
      this.toLocal(car, p, _near);
      if (car.reach === undefined) {
        car.reach = 0;
        for (const c of car.colliders) if (!c.ghost) car.reach = Math.max(car.reach, Math.abs(c.min.z - car.zc), Math.abs(c.max.z - car.zc));
      }
      const d = Math.hypot(Math.max(0, Math.abs(_near.x) - 1.5), Math.max(0, Math.abs(_near.z - car.zc) - car.reach));
      if (!best || d < best.d) best = { car, d };
    }
    return best;
  }

  // Open her up (§K). Returns why not, or '' when it fired.
  surge() {
    if (this.state !== 'run') return "Wait till she's rolling";
    if (this.surges <= 0) return 'No steam left this stretch. The next town stokes her.';
    this.surges--;
    this.boost = Math.min(MAX_SPEED - this.cruise, this.boost + SURGE_BOOST);
    return '';
  }

  // Speed along the line: cruise for the region plus any surge, brake into
  // each town, stop there, and pull out again (§G, §K; reference 0.7's
  // updateTrain).
  run(dt) {
    this.region = regionAt(this.d);
    ensureRegions(this.region + 2);
    this.cruise = regionSpeed(this.region);
    if (!this.waitFor) {
      this.stopAt = regionStart[this.nextTown];
      this.stopKind = 'town';
    }
    const stopD = this.stopAt, brake = this.waitFor ? HARD_BRAKE : BRAKE;
    this.boost = Math.max(0, this.boost - SURGE_BLEED * dt);
    if (this.state === 'run') {
      const target = Math.min(MAX_SPEED, this.cruise + this.boost);
      const acc = this.boost > 0 ? SURGE_ACCEL : 1.5;
      if (this.speed < target) this.speed = Math.min(target, this.speed + acc * dt);
      else this.speed = Math.max(target, this.speed - 2.5 * dt);
      const rem = stopD - this.d;
      if (rem < (this.speed * this.speed) / (2 * brake) + 6) {
        this.state = 'brake';
        this.boost = 0;
      }
    }
    if (this.state === 'brake') {
      const rem = stopD - this.d;
      this.speed = Math.max(0, Math.min(this.speed, Math.sqrt(Math.max(0, 2 * brake * rem))));
      if (rem <= 0.25 || (this.speed < 0.2 && rem < 4)) {
        this.speed = 0;
        this.d = stopD;
        this.state = 'stop';
        this.stopHere = this.stopKind;
        if (this.stopKind === 'town') {
          this.stopT = TOWN_STOP;
          this.surges = SURGES; // towns restock them (§Y)
          this.onArrive?.(this.nextTown);
        } else this.stopT = HALT_STOP;
      }
    }
    if (this.state === 'stop') {
      // Nobody gets left: the clock only runs with everyone aboard (§S).
      if (!this.held) this.stopT -= dt;
      if (this.stopT <= 0) {
        this.state = 'run';
        if (this.stopHere === 'town') this.nextTown++;
        this.stopHere = 'town';
        this.onDepart?.();
      }
    }
    this.speed = Math.min(this.speed, MAX_SPEED);
    this.d += this.speed * dt;
  }

  update(dt) {
    this.run(dt);
    this.place();
    // Wheels turn; the side rods and main rods follow the drivers' crank pins.
    for (const w of this.wheels) w.mesh.rotation.x = -this.d / w.radius;
    const a = -this.d / DRIVER_R;
    const py = -PIN_R * Math.sin(a) + TRAIN_Y, pz = PIN_R * Math.cos(a);
    const zc = -29.5;
    for (const r of this.rods) {
      r.sr.position.set(r.side * 1.56, DRIVER_R + py, -1.2 + pz + zc);
      const cz = -4.6 + pz;
      r.ch.position.set(r.side * 1.56, DRIVER_R + TRAIN_Y, cz + zc);
      const dy = py - TRAIN_Y, dz = -1.2 + pz - cz;
      r.mr.position.set(r.side * 1.66, DRIVER_R + TRAIN_Y + dy / 2, cz + dz / 2 + zc);
      r.mr.scale.z = Math.hypot(dy, dz);
      r.mr.rotation.x = -Math.atan2(dy, dz);
    }
  }

  // ---- building helpers ----------------------------------------------------
  // All of these take a car's own coordinates (as in the reference build):
  // x across, y up from the rail tops, z along the car from its middle.

  // A box of size w × h × d centred at (x, y, z). solid: arrows stick in it
  // and the player stands on it / bumps into it.
  box(w, h, d, color, x, y, z, solid = true) {
    const mat = skin(color);
    const m = new THREE.Mesh(tiledBox(w, h, d, mat.userData.tile), mat);
    m.position.set(x, y + TRAIN_Y, z + this.car.zc);
    m.castShadow = true;
    m.receiveShadow = true;
    this.car.inner.add(m);
    if (solid) this.solid(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2);
    return m;
  }

  // A collision box with nothing to see.
  solid(x0, y0, z0, x1, y1, z1, ghost = false) {
    const zc = this.car.zc;
    this.car.colliders.push({ min: new THREE.Vector3(x0, y0 + TRAIN_Y, z0 + zc), max: new THREE.Vector3(x1, y1 + TRAIN_Y, z1 + zc), ghost });
  }

  // An invisible wall that keeps the player aboard (arrows pass through it):
  // the railings, and the edges of the roofs and the tender.
  wall(x0, z0, x1, z1, floorY) {
    this.solid(x0, floorY, z0, x1, floorY + WALL, z1, true);
  }

  cyl(rt, rb, h, seg, color, x, y, z) {
    const mat = skin(color);
    const m = new THREE.Mesh(tiledCyl(rt, rb, h, seg, mat.userData.tile), mat);
    m.position.set(x, y + TRAIN_Y, z + this.car.zc);
    m.castShadow = true;
    this.car.inner.add(m);
    return m;
  }

  // A smooth, plain wheel (28 sides, §Q) standing on the rail.
  wheel(r, x, z) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.28, 28).rotateZ(Math.PI / 2), plain(0x14120f));
    m.position.set(x, r + TRAIN_Y, z + this.car.zc);
    m.castShadow = true;
    this.car.inner.add(m);
    this.wheels.push({ mesh: m, radius: r });
    return m;
  }

  // A climbable volume (car coordinates, floor to a metre above the roof). face: the way you look to climb it (x, z in the car's
  // frame). top: the roof it leads to; at the top, pushing on steps you
  // off in the direction `out`.
  // at: where you hang on it (x, z), so climbing lines you up with the hole.
  ladder(x0, x1, z0, z1, face, out, at) {
    const zc = this.car.zc;
    this.car.ladders.push({
      at: new THREE.Vector3(at[0], 0, at[1] + zc),
      min: new THREE.Vector3(x0, FLOOR_Y + TRAIN_Y, z0 + zc),
      max: new THREE.Vector3(x1, ROOF_Y + TRAIN_Y + 1.0, z1 + zc),
      face: new THREE.Vector3(face[0], 0, face[1]),
      out: new THREE.Vector3(out[0], 0, out[1]),
      top: ROOF_Y + TRAIN_Y,
    });
  }

  // Roof rails, the plank parapet along the edges (cover, §S), and the
  // invisible walls that go with them.
  roofRails(color) {
    for (const s of [-1, 1]) {
      this.box(0.04, 0.04, 10.1, C.rail, s * 1.38, ROOF_Y + 0.56, 0, false);
      for (const z of [-5, -2.5, 0, 2.5, 5]) this.box(0.04, 0.58, 0.04, C.rail, s * 1.38, ROOF_Y + 0.29, z, false);
      this.box(0.06, PARAPET, 10.1, color, s * 1.38, ROOF_Y + PARAPET / 2, 0);
      this.wall(s * 1.38 - 0.03, -5.05, s * 1.38 + 0.03, 5.05, ROOF_Y);
    }
  }
  // The end rails on a roof, with a gate in the middle |x| < 0.6.
  endRails(e) {
    for (const s of [-1, 1]) {
      this.box(0.78, 0.04, 0.04, C.rail, s * 0.99, ROOF_Y + 0.56, e, false);
      this.box(0.04, 0.58, 0.04, C.rail, s * 0.6, ROOF_Y + 0.29, e, false);
      this.wall(Math.min(s * 0.6, s * 1.38), e - 0.02, Math.max(s * 0.6, s * 1.38), e + 0.02, ROOF_Y);
    }
  }

  // ---- the caboose: roof with a rail all round, rear platform, the cabin ----
  buildCaboose() {
    const CB = C.cab;
    this.box(2.0, 0.5, 10.2, C.iron, 0, 0.8, 0);
    for (const dz of [-4, 4]) for (const x of [-1.05, 1.05]) this.wheel(0.45, x, dz);
    this.box(2.9, 0.12, 10.1, C.deck, 0, FLOOR_Y - 0.06, 0);
    const WH = ROOF_Y - FLOOR_Y;
    // Sides: three open windows a side (sill at 2.3, head at 3.3).
    for (const s of [-1, 1]) {
      this.box(0.1, 2.3 - FLOOR_Y, 10, CB, s * 1.4, (2.3 + FLOOR_Y) / 2, 0);
      this.box(0.1, ROOF_Y - 3.3, 10, CB, s * 1.4, (ROOF_Y + 3.3) / 2, 0);
      for (const [zc, w] of [[-4.475, 1.05], [-1.5, 1.1], [1.5, 1.1], [4.475, 1.05]]) this.box(0.1, 1.0, w, CB, s * 1.4, 2.8, zc);
      for (const zc of [-3, 0, 3]) this.box(0.18, 0.06, 1.9, C.cabDark, s * 1.4, 2.3, zc, false);
      this.box(0.06, 0.3, 10, C.cabDark, s * 1.44, FLOOR_Y + 0.15, 0, false);
    }
    // Front and rear walls, each with a door.
    for (const e of [-5.0, 5.0]) {
      for (const s of [-1, 1]) this.box(0.95, WH, 0.1, CB, s * 0.975, (ROOF_Y + FLOOR_Y) / 2, e);
      this.box(1.0, ROOF_Y - 3.2, 0.1, CB, 0, (ROOF_Y + 3.2) / 2, e);
    }
    this.box(1.0, 0.06, 0.8, C.iron, 0, FLOOR_Y - 0.02, -5.35); // the plate across to the hat car
    this.wall(-0.55, -5.75, -0.5, -5.0, FLOOR_Y);
    this.wall(0.5, -5.75, 0.55, -5.0, FLOOR_Y);
    // Roof, rails, the gate at the front and the gap for the ladder at the back.
    this.box(2.9, 0.12, 10.1, C.roof, 0, ROOF_Y - 0.06, 0);
    this.roofRails(0x6e3a24);
    this.endRails(-5.05);
    this.box(1.96, 0.04, 0.04, C.rail, -0.4, ROOF_Y + 0.56, 5.05, false);
    this.box(0.04, 0.58, 0.04, C.rail, 0.58, ROOF_Y + 0.29, 5.05, false);
    this.wall(-1.38, 5.03, 0.58, 5.07, ROOF_Y);
    // A plank across the gap to the hat car's roof, walled at the sides.
    this.box(1.1, 0.06, 0.6, C.deck, 0, ROOF_Y - 0.03, -5.35);
    for (const s of [-1, 1]) this.wall(s * 0.6 - 0.02, -5.7, s * 0.6 + 0.02, -5.0, ROOF_Y);
    // The rear platform, rail waist-high all round.
    this.box(2.8, 0.1, 1.6, C.deck, 0, FLOOR_Y - 0.05, 5.8);
    for (const s of [-1, 1]) {
      this.box(0.05, 1.0, 0.05, C.rail, s * 1.38, FLOOR_Y + 0.5, 6.58, false);
      for (const y of [FLOOR_Y + 1.0, FLOOR_Y + 0.55]) this.box(0.05, 0.05, 1.6, C.rail, s * 1.38, y, 5.8, false);
      this.solid(s * 1.38 - 0.03, FLOOR_Y, 5.0, s * 1.38 + 0.03, ROOF_Y + WALL, 6.6, true);
    }
    for (const y of [FLOOR_Y + 1.0, FLOOR_Y + 0.55]) this.box(2.8, 0.05, 0.05, C.rail, 0, y, 6.58, false);
    // (these go up to the roof, so stepping off the roof's back can't take you over them)
    this.solid(-1.4, FLOOR_Y, 6.56, 1.4, ROOF_Y + WALL, 6.62, true);
    this.box(2.6, 0.3, 0.3, C.iron, 0, 0.75, 6.7);
    // The ladder up the back wall, on the right.
    for (const x of [0.78, 1.22]) this.box(0.04, ROOF_Y + 0.36 - FLOOR_Y, 0.04, C.rail, x, (ROOF_Y + 0.36 + FLOOR_Y) / 2, 5.12, false);
    for (let y = FLOOR_Y + 0.3; y < ROOF_Y + 0.3; y += 0.33) this.box(0.48, 0.03, 0.03, C.rail, 1.0, y, 5.12, false);
    this.ladder(0.72, 1.28, 5.05, 5.5, [0, -1], [0, -1], [1.0, 5.32]);
    // Inside: a bench at the front and the stove.
    // (in two halves, so the front door stays clear; the reference's one
    // long bench is walked through there)
    for (const s of [-1, 1]) {
      this.box(0.7, 0.08, 0.5, 0x9a7a52, s * 0.9, FLOOR_Y + 0.42, -4.65, false);
      this.box(0.08, 0.4, 0.4, 0x5e4a36, s * 1.0, FLOOR_Y + 0.2, -4.65, false);
      this.solid(Math.min(s * 0.55, s * 1.25), FLOOR_Y, -4.9, Math.max(s * 0.55, s * 1.25), FLOOR_Y + 0.46, -4.4);
    }
    this.cyl(0.24, 0.26, 0.9, 8, C.iron, -1.0, FLOOR_Y + 0.45, -3.6);
    this.cyl(0.08, 0.08, 3.6, 6, C.iron, -1.0, FLOOR_Y + 2.7, -3.6);
    this.solid(-1.26, FLOOR_Y, -3.86, -0.74, FLOOR_Y + 0.9, -3.34);
  }

  // ---- the hat car: a boxcar with a window a side, the rack inside, a hatch
  // in the roof at the back-left with a ladder up to it (§H) ----
  buildHatCar() {
    this.box(2.0, 0.5, 10.2, C.iron, 0, 0.8, 0);
    for (const dz of [-4, 4]) for (const x of [-1.05, 1.05]) this.wheel(0.45, x, dz);
    this.box(0.5, 0.3, 0.9, C.iron, 0, 1.2, -5.2);
    this.box(2.9, 0.12, 10.1, C.deck, 0, FLOOR_Y - 0.06, 0);
    const HW = ROOF_Y - FLOOR_Y;
    for (const s of [-1, 1]) {
      this.box(0.1, 1.9 - FLOOR_Y, 10, C.wood2, s * 1.4, (1.9 + FLOOR_Y) / 2, 0);
      this.box(0.1, ROOF_Y - 3.0, 10, C.wood2, s * 1.4, (ROOF_Y + 3.0) / 2, 0);
      for (const zc of [-3.3, 3.3]) this.box(0.1, 1.1, 3.4, C.wood2, s * 1.4, 2.45, zc);
      this.box(0.18, 0.06, 3.2, 0x2e2218, s * 1.4, 1.9, 0, false);
      // the hat rack's pegs
      for (let z = -4.2; z <= 4.21; z += 0.8) this.box(0.12, 0.05, 0.05, C.rail, s * 1.3, 3.45, z, false);
      for (const z of [-4.2, -3.4, -2.6, 2.6, 3.4, 4.2]) this.box(0.12, 0.05, 0.05, C.rail, s * 1.3, 2.7, z, false);
    }
    this.box(2.9, HW, 0.1, C.wood2, 0, (ROOF_Y + FLOOR_Y) / 2, -5.0); // front wall: no door
    for (const s of [-1, 1]) this.box(0.95, HW, 0.1, C.wood2, s * 0.975, (ROOF_Y + FLOOR_Y) / 2, 5.0);
    this.box(1.0, ROOF_Y - 3.2, 0.1, C.wood2, 0, (ROOF_Y + 3.2) / 2, 5.0);
    // Roof, with the hatch (x -1.3..-0.7, z 3.9..4.5) open.
    this.box(2.9, 0.12, 8.95, C.roof, 0, ROOF_Y - 0.06, -0.575);
    this.box(2.15, 0.12, 0.6, C.roof, 0.375, ROOF_Y - 0.06, 4.2);
    this.box(0.15, 0.12, 0.6, C.roof, -1.375, ROOF_Y - 0.06, 4.2, false);
    this.box(2.9, 0.12, 0.55, C.roof, 0, ROOF_Y - 0.06, 4.775);
    for (let i = 0; i < 3; i++) this.box(2.9, 0.08, 0.08, C.iron2, 0, 4.12, -4 + i * 4, false);
    this.roofRails(0x5e4a36);
    this.endRails(-5.05);
    this.endRails(5.05);
    // The ladder inside, up the left wall to the hatch.
    for (let y = FLOOR_Y + 0.3; y < ROOF_Y; y += 0.33) this.box(0.03, 0.03, 0.5, C.rail, -1.28, y, 4.2, false);
    for (const z of [3.95, 4.45]) this.box(0.04, ROOF_Y - FLOOR_Y, 0.04, C.rail, -1.28, (ROOF_Y + FLOOR_Y) / 2, z, false);
    this.ladder(-1.36, -0.6, 3.95, 4.45, [-1, 0], [1, 0], [-1.04, 4.2]);
  }

  // ---- the tender: coal deck with side boards; you reach it from the hat
  // car's roof and can't go further forward than its front board ----
  buildTender() {
    this.box(2.6, 2.2, 6.6, C.red, 0, 2.4, 0);
    this.box(2.0, 0.5, 6.8, C.iron, 0, 0.95, 0);
    const R = (() => {
      let a = 9;
      return () => ((a = (a * 16807) % 2147483647) / 2147483647);
    })();
    for (let i = 0; i < 10; i++) {
      const m = this.box(0.4 + R() * 0.4, 0.2 + R() * 0.2, 0.4 + R() * 0.4, 0x0a0a0c, -0.8 + R() * 1.6, 3.55, -2.6 + R() * 5.2, false);
      m.castShadow = false;
    }
    for (const s of [-1, 1]) {
      this.box(0.1, 0.5, 6.6, C.red, s * 1.25, 3.75, 0);
      this.wall(s * 1.25 - 0.05, -3.3, s * 1.25 + 0.05, 3.3, 3.5);
      // the open back, either side of the walkway
      this.wall(Math.min(s * 0.75, s * 1.3), 3.28, Math.max(s * 0.75, s * 1.3), 3.32, 3.5);
    }
    this.box(2.6, 0.5, 0.1, C.red, 0, 3.75, -3.25);
    this.wall(-1.3, -3.3, 1.3, -3.2, 3.5);
    for (const dz of [-2.4, 2.4]) for (const x of [-1.05, 1.05]) this.wheel(0.45, x, dz);
    // A plank back across the gap to the hat car's roof (you step up 0.6 m).
    this.box(1.5, 0.06, 1.15, C.deck, 0, 3.47, 3.85);
    for (const s of [-1, 1]) this.wall(s * 0.75 - 0.02, 3.3, s * 0.75 + 0.02, 4.45, 3.5);
  }

  // ---- the locomotive (§N): eight-foot drivers, the boiler 3.6 m up, the cab
  // open at the back with the firebox glowing ----
  buildLocomotive() {
    const DR = DRIVER_R;
    this.box(2.2, 0.4, 13, C.iron, 0, 2.1, -1.0);
    const boiler = this.cyl(1.15, 1.15, 8.2, 24, C.iron2, 0, 3.6, -2.4);
    boiler.rotation.x = Math.PI / 2;
    this.solid(-1.1, 2.45, -6.5, 1.1, 4.75, 1.7);
    for (const z of [0.6, -1.6, -3.8]) this.cyl(1.19, 1.19, 0.2, 24, plain(C.brass), 0, 3.6, z).rotation.x = Math.PI / 2;
    this.cyl(1.22, 1.22, 1.1, 24, C.iron, 0, 3.6, -6.1).rotation.x = Math.PI / 2;
    this.box(0.6, 0.6, 0.5, C.brass, 0, 4.5, -6.9);
    this.box(0.34, 0.34, 0.1, plain(0xfff2b0, { emissive: 0xfff2b0, emissiveIntensity: 1 }), 0, 4.5, -7.18, false);
    this.cyl(0.5, 0.36, 1.7, 16, C.iron, 0, 5.4, -5.4);
    this.cyl(0.6, 0.66, 1.0, 16, C.brass, 0, 4.95, -2.2);
    this.cyl(0.44, 0.5, 0.7, 16, C.iron2, 0, 4.9, 0.2);
    // The cab.
    for (const x of [-1.4, 1.4]) this.box(0.1, 2.8, 3.2, C.red, x, 3.95, 3.8);
    this.box(2.9, 2.8, 0.1, C.red, 0, 3.95, 2.2);
    this.box(3.3, 0.18, 3.6, C.roof, 0, 5.48, 3.8);
    for (const x of [-1.46, 1.46]) this.box(0.04, 1.2, 1.6, 0x1a3ce8, x, 4.4, 3.6, false);
    this.box(2.6, 0.08, 3.6, C.deck, 0, 2.54, 3.9);
    this.firebox = plain(0xff7a2a, { emissive: 0xff4a10, emissiveIntensity: 1 });
    this.box(0.62, 0.42, 0.04, this.firebox, 0, 3.2, 2.27, false);
    for (const x of [-0.5, 0, 0.5]) this.cyl(0.08, 0.08, 0.04, 12, C.brass, x, 4.2, 2.27).rotation.x = Math.PI / 2;
    // Steam chests, the pilot and its cowcatcher.
    for (const x of [-1.38, 1.38]) this.box(0.95, 0.95, 2.3, C.iron2, x, 1.5, -5.2);
    const cc = new THREE.Mesh(facet(new THREE.ConeGeometry(1.4, 1.8, 4)), plain(C.iron));
    cc.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    cc.position.set(0, 0.95 + TRAIN_Y, -7.5 + this.car.zc);
    cc.scale.set(1, 1, 0.6);
    this.car.inner.add(cc);
    this.box(2.2, 0.6, 1.2, C.iron, 0, 1.9, -7.0);
    // Three drivers a side, the pony wheel, and the rods.
    for (const side of [-1, 1]) {
      for (const z of [1.4, -1.2, -3.8]) {
        this.wheel(DR, side * 1.3, z);
        this.cyl(0.2, 0.2, 0.3, 12, C.brass, side * 1.45, DR, z).rotation.z = Math.PI / 2;
      }
      this.wheel(0.5, side * 1.1, -6.4);
      const sr = this.box(0.12, 0.22, 5.8, C.iron2, side * 1.56, DR, -1.2, false);
      const mr = this.box(0.12, 0.18, 1, C.iron2, side * 1.66, DR, -3.0, false);
      const ch = this.box(0.36, 0.36, 0.6, C.iron2, side * 1.56, DR, -4.2, false);
      this.rods.push({ side, sr, mr, ch });
    }
  }
}
