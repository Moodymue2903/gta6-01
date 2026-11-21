// VERMILION KEYS — lighting: golden-hour sun, sky dome, haze, shadows.
// One shadow-casting directional light; the shadow frustum follows the
// player so the lit area stays tight and the shadows stay crisp.

import * as THREE from 'three';
import { PALETTE } from '../util.js';

const SKY_VERT = `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w;
}`;

const SKY_FRAG = `
varying vec3 vDir;
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 horizonColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
void main() {
  float h = clamp(vDir.y, -0.05, 1.0);
  vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.25, h));
  col = mix(col, topColor, smoothstep(0.2, 0.75, h));
  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 220.0) * 1.4 + pow(s, 10.0) * 0.30);
  gl_FragColor = vec4(col, 1.0);
}`;

export function buildLighting(scene) {
  // Sky dome: gradient peach horizon -> violet zenith, with a sun glow.
  const sunDir = new THREE.Vector3(-0.75, 0.30, -0.35).normalize();
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      topColor: { value: new THREE.Color(PALETTE.skyTop) },
      midColor: { value: new THREE.Color(PALETTE.skyMid) },
      horizonColor: { value: new THREE.Color(PALETTE.skyHorizon) },
      sunDir: { value: sunDir },
      sunColor: { value: new THREE.Color(PALETTE.sun) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 24, 16), skyMat);
  scene.add(sky);

  // Warm haze so the far skyline melts into the light.
  scene.fog = new THREE.Fog(PALETTE.fog, 220, 1100);

  // Golden-hour sun, low from the west.
  const sun = new THREE.DirectionalLight(0xffc27a, 2.6);
  sun.position.copy(sunDir).multiplyScalar(300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 700;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  // Soft sky fill so shadowed faces stay readable and violet.
  const hemi = new THREE.HemisphereLight(0xffb98a, 0x6a4a5a, 0.85);
  scene.add(hemi);

  // A few slow-drifting haze clouds: flat additive sprites.
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffd9b0, transparent: true, opacity: 0.28, fog: false,
    depthWrite: false,
  });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), cloudMat);
    c.position.set(-600 + i * 160 + (i % 3) * 40, 180 + (i % 4) * 26, -500 + (i % 5) * 220);
    c.scale.set(90 + (i % 3) * 40, 12 + (i % 2) * 6, 34);
    clouds.add(c);
  }
  scene.add(clouds);

  return {
    sun,
    hemi,
    sky,
    update(dt, t, focus) {
      // Keep the shadow frustum centred on the action.
      sun.position.set(focus.x - 225, 90, focus.z - 105);
      sun.target.position.set(focus.x, 0, focus.z);
      sky.position.set(focus.x, 0, focus.z);
      clouds.position.x = Math.sin(t * 0.004) * 30;
    },
  };
}
