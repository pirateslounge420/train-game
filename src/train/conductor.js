import * as THREE from 'three';
import { painted, plain, tiledBox } from '../core/materials.js';
import { texBark, texCloth, texIron } from '../core/textures.js';
import { rand } from '../core/math.js';
import { TRAIN_Y } from './train.js';

// The conductor (§S; reference 0.7): stands in the cab, drives and feeds the
// fire, and has a word for you from the front of the tender. The surge is
// always your call, never his (§K).
const LINES = [
  'Keep your head down up top, partner.',
  "I'll keep her fed. You keep 'em off us.",
  'Mind the edges. Long way down at this speed.',
  "Get thrown off, follow the tracks. I'll wait at the next stop.",
  "She'll do two hundred if you ask her right. Two surges a stretch, no more.",
];

function box(w, h, d, color, x, y, z, parent, tex, tile) {
  const mat = tex ? painted(color, tex, tile) : plain(color);
  const m = new THREE.Mesh(tiledBox(w, h, d, tile), mat);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

export class Conductor {
  constructor(train) {
    this.train = train;
    const loco = train.cars.find((c) => c.name === 'locomotive');
    const g = new THREE.Group();
    g.position.set(0.45, 2.58 + TRAIN_Y, 4.95 + loco.zc);
    loco.inner.add(g);
    const OV = 0x34465e, SH = 0x8a7a5e;
    for (const x of [-0.11, 0.11]) {
      box(0.15, 0.8, 0.18, OV, x, 0.4, 0, g, texCloth, 0.5);
      box(0.16, 0.12, 0.26, 0x1c1612, x, 0.06, -0.04, g);
    }
    this.body = new THREE.Group();
    this.body.position.y = 0.8;
    g.add(this.body);
    box(0.42, 0.6, 0.26, OV, 0, 0.3, 0, this.body, texCloth, 0.5);
    box(0.44, 0.22, 0.27, SH, 0, 0.5, 0, this.body, texCloth, 0.5);
    const head = new THREE.Group();
    head.position.y = 0.78;
    this.body.add(head);
    box(0.22, 0.24, 0.22, 0xc08a62, 0, 0, 0, head);
    box(0.235, 0.1, 0.2, 0xd8d0c0, 0, -0.08, -0.03, head); // beard
    box(0.24, 0.05, 0.05, 0xa8261e, 0, -0.15, 0, head); // neckerchief
    box(0.25, 0.12, 0.25, 0x5a6e8a, 0, 0.16, 0, head); // cap
    box(0.25, 0.02, 0.1, 0x2e3a4a, 0, 0.11, -0.16, head);
    for (const y of [0.13, 0.18]) box(0.255, 0.012, 0.255, 0xe8e0d0, 0, y, 0, head);
    this.arms = new THREE.Group();
    this.arms.position.y = 0.5;
    this.body.add(this.arms);
    for (const x of [-0.24, 0.24]) box(0.11, 0.11, 0.5, SH, x, -0.08, -0.22, this.arms, texCloth, 0.5).rotation.x = 0.5;
    const shovel = new THREE.Group();
    shovel.position.set(0, -0.3, -0.45);
    this.arms.add(shovel);
    box(0.04, 0.04, 0.9, 0x6a4a2a, 0, 0, -0.1, shovel, texBark, 0.5);
    box(0.24, 0.03, 0.28, 0x4a4a50, 0, -0.02, -0.66, shovel, texIron, 0.5);
    this.coal = box(0.16, 0.06, 0.16, 0x0a0a0c, 0, 0.02, -0.66, shovel);
    this.coal.visible = false;
    this.anim = -1; // -1 resting, 0..1 through a shovelful
    this.wait = 2;
    this.flare = 0;
    this.line = 0;
  }

  // Turn to the coal, scoop, turn back, swing it into the fire, which flares.
  update(dt, time) {
    const busy = this.train.speed > 0.5;
    if (this.anim < 0) {
      this.wait -= dt * (busy ? 1 : 0.3);
      if (this.wait <= 0) this.anim = 0;
    }
    let turn = 0, swing = 0;
    if (this.anim >= 0) {
      const a = (this.anim += dt / 2.2);
      if (a < 0.3) turn = Math.sin((a / 0.3) * Math.PI * 0.5);
      else if (a < 0.45) {
        turn = 1;
        swing = Math.sin(((a - 0.3) / 0.15) * Math.PI) * 0.5;
        this.coal.visible = true;
      } else if (a < 0.75) turn = Math.cos(((a - 0.45) / 0.3) * Math.PI * 0.5);
      else {
        swing = -Math.sin(((a - 0.75) / 0.25) * Math.PI) * 0.7;
        if (a > 0.85 && this.coal.visible) {
          this.coal.visible = false;
          this.flare = 1;
        }
      }
      if (a >= 1) {
        this.anim = -1;
        this.wait = rand(3.5, 7);
      }
    }
    this.body.rotation.y = turn * Math.PI;
    this.arms.rotation.x = swing;
    this.flare = Math.max(0, this.flare - dt * 0.8);
    this.train.firebox.emissiveIntensity = 0.9 + this.flare * 1.6 + Math.sin(time * 13) * 0.12;
  }

  say() {
    return LINES[this.line++ % LINES.length];
  }
}
