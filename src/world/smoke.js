import * as THREE from 'three';
import { rand } from '../core/math.js';

// Smoke from the stack (§N; reference 0.7's smoke). Grey puffs that start
// small, swell and fade over two to three seconds. They are let go into the
// air, so the train runs out from under them; while a surge is on they come
// thick and pale.
const COUNT = 90;

export class Smoke {
  constructor(scene) {
    this.geo = new THREE.IcosahedronGeometry(1, 1);
    this.puffs = [];
    for (let i = 0; i < COUNT; i++) {
      const m = new THREE.Mesh(this.geo, new THREE.MeshLambertMaterial({ color: 0x6a7080, transparent: true, opacity: 0.7, depthWrite: false }));
      m.visible = false;
      scene.add(m);
      this.puffs.push({ m, t: 0, life: 0, vel: new THREE.Vector3() });
    }
    this.next = 0;
    this.timer = 0;
  }

  update(dt, train) {
    const big = train.boost > 5;
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = train.speed > 0.5 ? (big ? 0.03 : 0.075) : 0.4;
      const p = this.puffs[this.next];
      this.next = (this.next + 1) % COUNT;
      train.toWorld(train.loco, train.stackTop, p.m.position);
      p.m.position.x += rand(-0.2, 0.2);
      p.m.position.z += rand(-0.2, 0.2);
      p.m.material.color.set(big ? 0xdfe6f4 : 0x6a7080);
      p.m.scale.setScalar(big ? 0.9 : 0.55);
      p.m.rotation.set(rand(0, 6.3), rand(0, 6.3), 0);
      p.vel.set(rand(-0.6, 0.6), rand(2.5, 4.5), rand(-0.6, 0.6)).addScaledVector(train.forward(), -(0.8 + train.speed * 0.12));
      p.t = 0;
      p.life = rand(2.2, 3.4);
      p.m.visible = true;
    }
    for (const p of this.puffs) {
      if (!p.m.visible) continue;
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) {
        p.m.visible = false;
        continue;
      }
      p.m.position.addScaledVector(p.vel, dt);
      p.vel.y *= 0.98;
      p.m.scale.setScalar(p.m.scale.x + dt * 1.3);
      p.m.material.opacity = 0.7 * (1 - k);
    }
  }
}
