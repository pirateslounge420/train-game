import * as THREE from 'three';
import { mulberry, smooth, lerp } from './line.js';

// The sky and the day (§J, §R; ported from reference 0.7).
//
// Torchfire's 144-minute day: the sun crosses the sky, dusk goes violet with
// a warm band, night is one blue world with stars and a moon opposite the
// sun. The sky, the light and the fog all blend between three palettes.

export const DAY_LEN = 144 * 60; // seconds in a game day
export const START_TIME = 0.29 * DAY_LEN; // a run starts at about 07:00

const C = (h) => new THREE.Color(h);
const DAY = { top: C(0x0000c4), mid: C(0x1a3ce8), hor: C(0x4f98ef), fog: C(0x4f98ef), hs: C(0x3a62d8), hg: C(0x08186c), hi: 0.75, sun: C(0xfff0d2), si: 1.2, cloud: C(0xa8b4e6) };
const DUSK = { top: C(0x15134b), mid: C(0x3a2a8a), hor: C(0xd8622e), fog: C(0x6a4a7a), hs: C(0x3a2a7a), hg: C(0x0a1040), hi: 0.5, sun: C(0xff9a4a), si: 0.55, cloud: C(0xb08aa0) };
const NIGHT = { top: C(0x050938), mid: C(0x0b1050), hor: C(0x153695), fog: C(0x0c1c52), hs: C(0x1a2a8a), hg: C(0x04082a), hi: 0.38, sun: C(0x8fa8ff), si: 0.28, cloud: C(0x2a3a90) };
const KEYS = ['top', 'mid', 'hor', 'fog', 'hs', 'hg', 'sun', 'cloud'];
// The reference build's light levels were set for three.js r128's older
// lighting; this one needs them times pi for the same brightness.
const LIGHT_SCALE = Math.PI;

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.cur = { night: 0 };
    for (const k of KEYS) this.cur[k] = new THREE.Color();

    this.hemi = new THREE.HemisphereLight(0x3a62d8, 0x08186c, 1);
    this.sun = new THREE.DirectionalLight(0xfff0d2, 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 260 });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.hemi, this.sun, this.sun.target);
    this.sunDir = new THREE.Vector3(0, 1, 0);

    scene.fog = new THREE.Fog(0x4f98ef, 90, 440);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { top: { value: C(0x0000c4) }, mid: { value: C(0x1a3ce8) }, hor: { value: C(0x4f98ef) } },
      vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top,mid,hor; varying vec3 vP;
        void main(){ float h=normalize(vP).y; vec3 c=h<0.14?mix(hor,mid,smoothstep(-0.02,0.14,h)):mix(mid,top,smoothstep(0.14,0.7,h)); gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(760, 32, 18), this.mat);
    this.dome.renderOrder = -2;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    const disc = (r, color) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color, fog: false }));
      m.renderOrder = -1;
      scene.add(m);
      return m;
    };
    this.sunDisc = disc(16, 0xfff8dc);
    this.moon = disc(13, 0xdfe8ff);

    const n = 700, p = new Float32Array(n * 3), R = mulberry(4242);
    for (let i = 0; i < n; i++) {
      const u = R() * 2 - 1, a = R() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      p.set([r * Math.cos(a) * 740, Math.abs(u) * 740 + 20, r * Math.sin(a) * 740], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.renderOrder = -1;
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    // Painted clouds: lumps of squashed icosahedra.
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xa8b4e6, fog: false });
    this.clouds = new THREE.Group();
    const rr = (a, b) => a + Math.random() * (b - a);
    for (let i = 0; i < 16; i++) {
      const c = new THREE.Group();
      for (let j = 0, k = 4 + Math.floor(Math.random() * 5); j < k; j++) {
        const g = new THREE.IcosahedronGeometry(rr(0.5, 1.1), 0).scale(1.6, 0.55, 1.1).translate(rr(-1.6, 1.6), rr(-0.15, 0.35), rr(-0.7, 0.7));
        c.add(new THREE.Mesh(g, this.cloudMat));
      }
      const ang = rr(0, Math.PI * 2), rad = rr(330, 640), s = rr(16, 34);
      c.position.set(Math.cos(ang) * rad, rr(110, 200), Math.sin(ang) * rad);
      c.scale.set(s, s * rr(0.7, 1.1), s);
      c.rotation.y = rr(0, Math.PI * 2);
      c.userData.drift = rr(0.25, 0.7);
      this.clouds.add(c);
    }
    scene.add(this.clouds);
  }

  mix(a, b, t) {
    for (const k of KEYS) this.cur[k].copy(a[k]).lerp(b[k], t);
    this.cur.hi = lerp(a.hi, b.hi, t);
    this.cur.si = lerp(a.si, b.si, t);
  }

  // dayT: seconds into the day (0 = midnight). eye: the camera's position.
  update(dt, dayT, eye) {
    const ang = ((dayT / DAY_LEN) % 1) * Math.PI * 2;
    const el = -Math.cos(ang), az = Math.sin(ang);
    this.sunDir.set(az * 80, el * 90 + 8, 30).normalize();
    if (el > 0) this.mix(DUSK, DAY, smooth(0, 0.3, el));
    else this.mix(DUSK, NIGHT, smooth(0, 0.25, -el));
    const c = this.cur;
    c.night = smooth(0.05, -0.2, el);
    this.mat.uniforms.top.value.copy(c.top);
    this.mat.uniforms.mid.value.copy(c.mid);
    this.mat.uniforms.hor.value.copy(c.hor);
    this.hemi.color.copy(c.hs);
    this.hemi.groundColor.copy(c.hg);
    this.hemi.intensity = c.hi * LIGHT_SCALE;
    this.sun.color.copy(c.sun);
    this.sun.intensity = c.si * LIGHT_SCALE;
    this.cloudMat.color.copy(c.cloud);
    this.stars.material.opacity = c.night * 0.9;
    this.moon.visible = c.night > 0.02;
    this.sunDisc.visible = el > -0.1;

    // Lights and shadows follow the eye; the sky stays centred on it.
    this.sun.target.position.copy(eye);
    this.sun.position.copy(eye).addScaledVector(this.sunDir, 120);
    this.dome.position.copy(eye);
    this.stars.position.copy(eye);
    this.clouds.position.set(eye.x, 0, eye.z);
    this.sunDisc.position.copy(eye).addScaledVector(this.sunDir, 700);
    this.moon.position.copy(eye).add(new THREE.Vector3(-az * 80, -el * 90 + 8, -30).normalize().multiplyScalar(700));
    for (const cl of this.clouds.children) {
      cl.position.x += cl.userData.drift * dt;
      if (cl.position.x > 700) cl.position.x -= 1400;
    }
  }

  // Fog: how far you see depends on the biome; less at night, very little in a tunnel.
  updateFog(biome, inTunnel) {
    const f = this.scene.fog, nf = 1 - 0.35 * this.cur.night;
    const near = inTunnel ? 6 : lerp(biome.a.fogN, biome.b.fogN, biome.t) * nf;
    const far = inTunnel ? 60 : lerp(biome.a.fogF, biome.b.fogF, biome.t) * nf;
    f.near += (near - f.near) * 0.05;
    f.far += (far - f.far) * 0.05;
    if (inTunnel) {
      f.color.set(0x06102a);
      this.mat.uniforms.hor.value.copy(f.color);
    } else f.color.copy(this.cur.fog);
  }
}
