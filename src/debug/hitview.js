import * as THREE from 'three';

// Debug view for arrow hits (§X): press H (or open the page with ?hitboxes)
// to draw every rider's hit boxes as wireframes, exactly as the arrow test
// sees them (padding included), and each of your arrows' paths frame by
// frame: one short line per frame step, green where it hit something, white
// where it flew on. The paths stay up for a few seconds so you can look back
// at a shot that seemed to go through a man.
const KEEP = 4; // seconds a path stays drawn
const MAX_SEGS = 4000;
const unitEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
const boxMat = new THREE.LineBasicMaterial({ color: 0xffd24a, depthTest: false, transparent: true, opacity: 0.85 });

export class HitView {
  constructor(game) {
    this.game = game;
    this.on = location.search.includes('hitboxes');
    this.segs = []; // { a, b, hit, age }
    this.built = new Set(); // every part's wireframe group (parts that flew off included)
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_SEGS * 6), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_SEGS * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true }));
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 999;
    game.scene.add(this.lines);
    addEventListener('keydown', (e) => {
      if (e.code === 'KeyH' && !e.repeat) this.toggle();
    });
  }

  toggle() {
    this.on = !this.on;
    this.game.hud.hint(this.on ? 'Hitboxes on (H to hide)' : 'Hitboxes off');
  }

  // Called by the arrow system for each step it traces.
  path(a, b, hit) {
    if (!this.on) return;
    this.segs.push({ a: a.clone(), b: b.clone(), hit, age: 0 });
    if (this.segs.length > MAX_SEGS) this.segs.shift();
  }

  update(dt) {
    this.lines.visible = this.on;
    const riders = this.game.riders;
    for (const g of this.built) g.visible = false;
    for (const list of [riders.riders, riders.footmen])
      for (const r of list)
        for (const k in r.parts) {
          const part = r.parts[k];
          if (this.on && !part.dbg) this.build(part, riders);
          if (part.dbg) part.dbg.visible = this.on && riders.partLive(r, part);
        }
    if (!this.on) return;
    for (let i = this.segs.length - 1; i >= 0; i--) if ((this.segs[i].age += dt) > KEEP) this.segs.splice(i, 1);
    const pos = this.lines.geometry.attributes.position.array;
    const col = this.lines.geometry.attributes.color.array;
    this.segs.forEach((s, i) => {
      pos.set([s.a.x, s.a.y, s.a.z, s.b.x, s.b.y, s.b.z], i * 6);
      const c = s.hit ? [0.2, 1, 0.3] : [1, 1, 1];
      col.set([...c, ...c], i * 6);
    });
    this.lines.geometry.setDrawRange(0, this.segs.length * 2);
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
  }

  // Wireframes of one part's boxes, hung on the part so they move with it.
  build(part, riders) {
    const d = part.def, pad = riders.hitPad(d);
    const g = new THREE.Group();
    for (const b of d.hit || d.box) {
      const m = new THREE.LineSegments(unitEdges, boxMat);
      m.position.set(b[3], b[4], b[5]);
      m.scale.set(b[0] + 2 * pad, b[1] + 2 * pad, b[2] + 2 * pad);
      m.renderOrder = 999;
      g.add(m);
    }
    part.g.add(g);
    part.dbg = g;
    this.built.add(g);
  }
}
