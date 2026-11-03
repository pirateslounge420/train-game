import * as THREE from 'three';
import { rand } from '../core/math.js';

// Puffs of smoke from the stack. They live in the world (not on the
// train), so they naturally trail out behind as the train moves on.
const COUNT = 70;
const LIFE = 3.2;

export class Smoke {
  constructor(scene) {
    this.geo = new THREE.IcosahedronGeometry(1, 0);
    this.mat = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, flatShading: true, roughness: 1, transparent: true, opacity: 0.75 });
    this.puffs = [];
    for (let i = 0; i < COUNT; i++) {
      const m = new THREE.Mesh(this.geo, this.mat);
      m.visible = false;
      scene.add(m);
      this.puffs.push({ m, age: LIFE, vel: new THREE.Vector3() });
    }
    this.next = 0;
    this.timer = 0;
  }

  update(dt, train) {
    this.timer -= dt;
    while (this.timer <= 0) {
      this.timer += 0.06;
      const p = this.puffs[this.next];
      this.next = (this.next + 1) % COUNT;
      p.age = 0;
      p.m.visible = true;
      train.toWorld(train.loco, train.stackTop, p.m.position);
      // Starts with the engine's speed but air drag slows it quickly.
      p.vel.set(rand(-0.6, 0.6), rand(3.5, 5), 0).addScaledVector(train.loco.vel, 0.9);
      p.m.rotation.set(rand(0, 3), rand(0, 3), rand(0, 3));
      p.spin = rand(-1, 1);
    }
    for (const p of this.puffs) {
      if (p.age >= LIFE) continue;
      p.age += dt;
      if (p.age >= LIFE) {
        p.m.visible = false;
        continue;
      }
      p.vel.multiplyScalar(Math.exp(-dt * 2.2));
      p.vel.x += 0.4 * dt; // light breeze
      p.m.position.addScaledVector(p.vel, dt);
      p.m.rotation.y += p.spin * dt;
      const t = p.age / LIFE;
      const s = (0.45 + t * 3.2) * (t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1);
      p.m.scale.setScalar(Math.max(0.01, s));
    }
  }
}
