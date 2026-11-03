import * as THREE from 'three';

export const SKY = {
  top: 0x4a7fc0,
  horizon: 0xeac79c,
  ground: 0xc99868,
  sunDir: new THREE.Vector3(0.55, 0.6, 0.45).normalize(),
};

// A big gradient sphere that always stays centred on the camera.
export function createSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color(SKY.top) },
      horizon: { value: new THREE.Color(SKY.horizon) },
      bottom: { value: new THREE.Color(SKY.ground) },
      sunDir: { value: SKY.sunDir },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 c = d.y > 0.0
          ? mix(horizon, top, pow(smoothstep(0.0, 0.55, d.y), 0.75))
          : mix(horizon, bottom, smoothstep(0.0, 0.15, -d.y));
        float s = max(dot(d, normalize(sunDir)), 0.0);
        c += vec3(1.0, 0.9, 0.7) * smoothstep(0.9985, 0.9992, s) * 1.2;
        c += vec3(1.0, 0.75, 0.45) * pow(s, 10.0) * 0.25;
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), mat);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);
  scene.fog = new THREE.Fog(SKY.horizon, 140, 1300);
  return sky;
}
