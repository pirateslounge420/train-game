import * as THREE from 'three';
import { CONFIG, MPH } from '../config.js';
import { flat } from '../core/materials.js';
import { rand } from '../core/math.js';
import { stopName, stopZ } from '../world/stops.js';

const T = CONFIG.train;

// The conductor: an NPC who rides in the cab, drives the train and keeps the
// firebox fed. You never touch the throttle or the coal yourself.
//
// Driving: he cruises, opening the throttle a little more every mile (never
// past the top speed). If you get left behind, he does NOT stop on the spot:
// he carries on to the next stop on the line, pulls up there and waits
// until you're back aboard.
const POS = new THREE.Vector3(0.72, 2.25, -11.7); // where he stands (train space)

const LINES = [
  'Keep your head down up top, partner.',
  "She's running sweet today.",
  "I'll keep her fed. You keep 'em off us.",
  'Mind the edges. Long way down at this speed.',
  "Lose your footing, use that hook. I ain't stopping in the middle of nowhere.",
];

export class Conductor {
  constructor(game) {
    this.game = game;
    this.train = game.train;
    this.state = 'cruise'; // cruise | toStop | waiting | departing
    this.stop = 0; // which stop we're heading for / waiting at
    this.waitTimer = 0;
    this.shovelT = rand(1, 4); // countdown to the next shovelful
    this.anim = 0; // 0..1 through a shovel swing, or -1 when idle
    this.flare = 0;
    this.lineIdx = 0;
    this.build();
    // A collision box so you can't walk through him.
    this.train.solid(POS.x - 0.25, POS.y, POS.z - 0.25, POS.x + 0.25, POS.y + 1.7, POS.z + 0.25);
  }

  get position() {
    return POS;
  }

  build() {
    const g = new THREE.Group();
    g.position.copy(POS);
    const box = (w, h, d, color, x, y, z, parent = g) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flat(color));
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const overalls = 0x34465e;
    const shirt = 0x8a7a5e;
    const skin = 0xc08a62;
    for (const s of [-1, 1]) {
      box(0.15, 0.8, 0.18, overalls, s * 0.11, 0.4, 0);
      box(0.16, 0.12, 0.26, 0x1c1612, s * 0.11, 0.06, -0.04); // boots
    }
    this.body = new THREE.Group();
    this.body.position.set(0, 0.8, 0);
    g.add(this.body);
    box(0.42, 0.6, 0.26, overalls, 0, 0.3, 0, this.body);
    box(0.44, 0.22, 0.27, shirt, 0, 0.5, 0, this.body);
    const head = new THREE.Group();
    head.position.set(0, 0.78, 0);
    this.body.add(head);
    box(0.22, 0.24, 0.22, skin, 0, 0, 0, head);
    box(0.235, 0.1, 0.2, 0xd8d0c0, 0, -0.08, -0.03, head); // grey beard
    box(0.24, 0.05, 0.05, 0xa8261e, 0, -0.15, 0, head); // neckerchief
    // Striped engineer's cap with a short peak.
    box(0.25, 0.12, 0.25, 0x5a6e8a, 0, 0.16, 0, head);
    box(0.25, 0.02, 0.1, 0x2e3a4a, 0, 0.11, -0.16, head);
    for (const y of [0.13, 0.18]) box(0.255, 0.012, 0.255, 0xe8e0d0, 0, y, 0, head);
    // Arms hold the shovel; the whole lot swings from the shoulders.
    this.arms = new THREE.Group();
    this.arms.position.set(0, 0.5, 0);
    this.body.add(this.arms);
    for (const s of [-1, 1]) box(0.11, 0.11, 0.5, shirt, s * 0.24, -0.08, -0.22, this.arms).rotation.x = 0.5;
    const shovel = new THREE.Group();
    shovel.position.set(0, -0.3, -0.45);
    this.arms.add(shovel);
    box(0.04, 0.04, 0.9, 0x6b4b30, 0, 0, -0.1, shovel); // handle
    box(0.24, 0.03, 0.28, 0x55595e, 0, -0.02, -0.66, shovel); // blade
    this.coal = box(0.16, 0.06, 0.16, 0x1b1b1d, 0, 0.02, -0.66, shovel);
    this.coal.visible = false;
    this.group = g;
    this.train.group.add(g);
  }

  // Cruising speed for how far we've come.
  cruiseSpeed() {
    const miles = this.train.distance / 1609.34;
    return Math.min(T.maxSpeedMph, T.startSpeedMph + T.speedUpMphPerMile * miles) * MPH;
  }

  update(dt) {
    const { train, player, hud, sound } = this.game;
    const v = train.speed;

    switch (this.state) {
      case 'cruise':
      case 'departing': {
        train.speed = Math.min(this.cruiseSpeed(), v + T.accel * dt);
        if (this.state === 'departing' && train.speed >= this.cruiseSpeed() - 0.1) this.state = 'cruise';
        // Left behind (grapple missed or never fired)? Head for the next stop.
        // (Once you're out of hook range there's no getting back on by yourself.)
        const hookOut = this.game.inventory?.grapple.state === 'flying';
        if (player.offTrain && !hookOut && player.distanceToTrain() > CONFIG.grapple.range + 2) {
          this.planStop();
          hud.message(`Conductor: "Hold tight, I'll wait for you at ${stopName(this.stop)}!"`);
        }
        break;
      }
      case 'toStop': {
        const remaining = train.position.z - stopZ(this.stop);
        // Brake so we come to rest right beside the platform.
        const vMax = Math.sqrt(Math.max(0, 2 * T.brake * remaining));
        train.speed = Math.min(v + T.accel * dt, vMax, this.cruiseSpeed());
        if (remaining < 0.15 || train.speed < 0.05) {
          train.position.z = stopZ(this.stop);
          train.speed = 0;
          this.state = 'waiting';
          this.waitTimer = 0;
          sound.whistle();
        }
        // Made it back aboard before we got there? Never mind.
        if (player.aboard && player.groundKind === 'train' && !player.knockedOff) {
          this.state = 'cruise';
          hud.message('Conductor: "Glad you made it back, partner."');
        }
        break;
      }
      case 'waiting': {
        train.speed = 0;
        if (player.aboard && player.onGround && player.groundKind === 'train') {
          this.waitTimer += dt;
          if (this.waitTimer >= T.departDelay) {
            this.state = 'departing';
            sound.whistle();
            hud.message('Conductor: "All aboard! Off we go."');
          }
        } else this.waitTimer = 0;
        break;
      }
    }

    this.animate(dt, sound, player);
  }

  // Pick the first stop we can still pull up at.
  planStop() {
    const t = this.train;
    const brakeDist = (t.speed * t.speed) / (2 * T.brake) + 5;
    let k = Math.max(1, Math.ceil(-t.position.z / T.stopSpacing));
    while (t.position.z - stopZ(k) < brakeDist) k++;
    this.stop = k;
    this.state = 'toStop';
  }

  // Where the train is (or will be) waiting, in world z; null if it isn't.
  get waitingZ() {
    return this.state === 'toStop' || this.state === 'waiting' ? stopZ(this.stop) : null;
  }

  // Swing coal from the tender into the firebox every few seconds.
  animate(dt, sound, player) {
    const busy = this.train.speed > 0.5 || this.state === 'departing';
    if (this.anim < 0 || this.anim === undefined) this.anim = -1;
    if (this.anim < 0) {
      this.shovelT -= dt * (busy ? 1 : 0.3);
      if (this.shovelT <= 0) this.anim = 0;
    }
    let turn = 0;
    let swing = 0;
    if (this.anim >= 0) {
      this.anim += dt / 2.2;
      const a = this.anim;
      // turn to the tender, scoop, turn back, throw
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
          if (player.eyeWorld().distanceTo(this.train.position.clone().add(POS)) < 25) sound.shovel();
        }
      }
      if (a >= 1) {
        this.anim = -1;
        this.shovelT = rand(4, 8);
      }
    }
    this.body.rotation.y = turn * Math.PI;
    this.arms.rotation.x = swing;
    this.flare = Math.max(0, this.flare - dt * 0.8);
    const fb = this.train.firebox?.material;
    if (fb) fb.emissiveIntensity = 1.5 + this.flare * 2.5 + Math.sin(performance.now() * 0.013) * 0.15;
  }

  talk() {
    const t = this.train;
    const mph = Math.round(t.speed / MPH);
    const next = Math.max(1, Math.ceil(-t.position.z / T.stopSpacing + 0.01));
    const dist = Math.round(t.position.z - stopZ(next));
    const line = LINES[this.lineIdx++ % LINES.length];
    return `Conductor: "${line}" (${mph} mph · ${stopName(next)} in ${dist} m)`;
  }
}
