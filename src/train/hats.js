import * as THREE from 'three';
import { TRAIN_Y } from './train.js';
import { rightAt } from '../world/line.js';

// Hats (§H, §T; ported from reference 0.7). The first hat shot off each gang
// boomerangs up and back through the hat car's side window and lands on the
// rack, arrow and all. Look at a racked hat and Grab to wear it; Grab again
// pulls its arrow out. The rack belongs to the train; each player wears
// their own hat (§W).

const REACH = 2.8; // metres from your eyes to a hat you can take
const LOOK = 0.88; // how squarely you have to look at it
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _r = new THREE.Vector3();

// The pegs, in the order hats fill them (x, y, z in the hat car's own space).
const SLOTS = [];
for (const s of [-1, 1]) {
  for (let z = -4.2; z <= 4.21; z += 0.8) SLOTS.push({ x: s * 1.17, y: 3.45, z, side: s });
  for (const z of [-4.2, -3.4, -2.6, 2.6, 3.4, 4.2]) SLOTS.push({ x: s * 1.17, y: 2.7, z, side: s });
}

export class Hats {
  constructor(game) {
    this.game = game;
    this.car = game.train.cars.find((c) => c.name === 'hatcar');
    this.collected = {}; // gang name -> true
    this.flights = [];
    this.racked = [];
  }

  // A point in the hat car's own space, in the world.
  carPoint(x, y, z, out) {
    return this.game.train.toWorld(this.car, out.set(x, y + TRAIN_Y, z + this.car.zc), out);
  }
  // The middle of the side window, where a hat comes in.
  window(side, out) {
    return this.carPoint(side * 1.75, 2.45, 0, out);
  }

  // A hat has been shot off. True if it's this gang's first, and it's on
  // its way to the rack; false if we already have one and it just tumbles.
  fly(hat, gang) {
    if (this.collected[gang]) return false;
    this.collected[gang] = true;
    hat.getWorldPosition(_a);
    this.game.scene.attach(hat);
    hat.scale.set(1, 1, 1);
    hat.userData.gang = gang;
    rightAt(this.car.th, _r);
    const side = _b.subVectors(_a, this.car.group.position).dot(_r) >= 0 ? 1 : -1;
    this.flights.push({ m: hat, t: 0, phase: 0, p0: _a.clone(), side, spin: 9 + Math.random() * 5, gang });
    return true;
  }

  update(dt) {
    rightAt(this.car.th, _r);
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i], m = f.m;
      f.t += dt;
      if (f.phase === 0) {
        // Up and round in a curve to the window (1.5 s).
        const u = Math.min(1, f.t / 1.5);
        this.window(f.side, _a);
        _b.copy(f.p0).lerp(_a, 0.5);
        _b.y += 7;
        _b.addScaledVector(_r, f.side * 7);
        const p = (1 - u) * (1 - u), q = 2 * (1 - u) * u, s = u * u;
        m.position.set(p * f.p0.x + q * _b.x + s * _a.x, p * f.p0.y + q * _b.y + s * _a.y, p * f.p0.z + q * _b.z + s * _a.z);
        m.rotation.y += f.spin * dt;
        m.rotation.x = Math.sin(u * Math.PI) * 0.8;
        if (u >= 1) {
          f.phase = 1;
          f.t = 0;
          f.slot = SLOTS[this.racked.length + this.flights.length - 1 - i] || SLOTS[this.racked.length];
        }
      } else {
        // In through the window and onto its peg (0.55 s).
        const u = Math.min(1, f.t / 0.55), e = u * u * (3 - 2 * u);
        this.window(f.side, _a);
        this.carPoint(f.slot.x, f.slot.y, f.slot.z, _b);
        m.position.lerpVectors(_a, _b, e);
        m.position.y += Math.sin(u * Math.PI) * 0.6;
        m.rotation.y += f.spin * 0.5 * dt;
        if (u >= 1) {
          this.hang(m, f.slot);
          this.racked.push(m);
          // The arrow that took it stays in it (§T).
          m.traverse((o) => {
            if (o.userData.arrow) this.game.arrows.stuck.push({ mesh: o, where: 'train', car: this.car, hat: m, age: 0 });
          });
          this.game.sound.pickup();
          this.game.hud.message(`${f.gang} hat racked`);
          this.flights.splice(i, 1);
        }
      }
    }
  }

  hang(m, slot) {
    this.car.inner.add(m);
    m.userData.slot = slot;
    m.position.set(slot.x, slot.y + TRAIN_Y, slot.z + this.car.zc);
    m.rotation.set(0, 0, slot.side * (Math.PI / 2));
  }

  // The racked hat this player is looking at, if any (inside the hat car).
  looked(player, camera) {
    if (player.car !== this.car || player.local.y > 3) return null;
    const eye = player.eyeWorld(_a);
    const look = _b.set(0, 0, -1).applyQuaternion(camera.quaternion);
    let best = null, bd = LOOK;
    for (const h of this.racked) {
      if (h === player.hat || h.parent !== this.car.inner) continue;
      h.getWorldPosition(_c);
      if (_c.distanceTo(eye) > REACH) continue;
      const d = _c.sub(eye).normalize().dot(look);
      if (d > bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  // Wear it: a brim at the top of your view. Wearing another swaps them back
  // to their pegs (§T).
  wear(player, h, camera) {
    if (player.hat) {
      const old = player.hat;
      this.hang(old, old.userData.slot);
      this.arrowsIn(old, (s) => {
        s.where = 'train';
        s.wearer = null;
      });
    }
    player.hat = h;
    camera.add(h);
    h.position.set(0, 0.17, 0.03);
    h.rotation.set(0.22, 0, 0);
    this.arrowsIn(h, (s) => {
      s.where = 'worn';
      s.wearer = player;
    });
    this.game.sound.pickup();
    this.game.hud.message(`Wearing the ${h.userData.gang} hat`);
  }

  arrowsIn(h, fn) {
    for (const s of this.game.arrows.stuck) if (s.hat === h) fn(s);
  }
}
