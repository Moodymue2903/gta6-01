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
  // FIX ROUND: the sun was too high and too far west, so its disc sat
  // outside the cover frame; it is lower now and swung north so the glow
  // reads in the north-looking cover shot. Sky top lifted so the upper
  // sky is violet, not near-black.
  const sunDir = new THREE.Vector3(-0.55, 0.22, -0.62).normalize();
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

  // Warm haze so the far skyline melts into the light. FIX ROUND: the
  // haze started too far out (220) for the cover's skyline to melt.
  scene.fog = new THREE.Fog(PALETTE.fog, 160, 1500);

  // Golden-hour sun, low from the west-northwest. FIX ROUND: intensity
  // 2.6 -> 3.4 — the first sheet's sunlit faces still read muddy.
  const sun = new THREE.DirectionalLight(0xffb347, 3.4);
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

  // Soft sky fill so shadowed faces stay readable and violet. FIX
  // ROUND: 0.85 left every camera-facing facade in muddy shadow (the sun
  // lights the far faces, the camera sees the near ones). 1.2 with a
  // brighter ground colour lifts them to warm violet instead of brown.
  const hemi = new THREE.HemisphereLight(0xffb98a, 0x8a6a72, 1.35);
  scene.add(hemi);

  // Rim: cool light from behind the hero, aimed back at the camera, so a
  // dark car or character separates from a bright sky. Shadowless.
  const rim = new THREE.DirectionalLight(0x7a9fff, 0.9);
  rim.position.set(-100, 60, -150);
  scene.add(rim);
  scene.add(rim.target);

  // Warm fill from the camera side (south-east): the faces the shots
  // actually see. Shadowless, low intensity — it lifts, never flattens.
  // FIX ROUND 2: 0.7 -> 0.85 — the low sun barely lights horizontal
  // surfaces (roads), and the fill is what keeps them readable.
  const fill = new THREE.DirectionalLight(0xffd9a0, 0.85);
  fill.position.set(120, 80, 120);
  scene.add(fill);
  scene.add(fill.target);

  // A few slow-drifting haze clouds: flat additive sprites.
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffe0b8, transparent: true, opacity: 0.35, fog: false,
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
    rim,
    fill,
    sky,
    update(dt, t, focus) {
      // Keep the shadow frustum centred on the action. The offset matches
      // sunDir above (x -148, y 59, z -167 ~= -0.55, 0.22, -0.62 * 270) so
      // the light direction and the sky-disc direction agree.
      sun.position.set(focus.x - 148, 59, focus.z - 167);
      sun.target.position.set(focus.x, 0, focus.z);
      // Rim stays behind the action (north-west), fill stays on the
      // camera side (south-east); both track the focus like the sun.
      rim.position.set(focus.x - 100, 60, focus.z - 150);
      rim.target.position.set(focus.x, 0, focus.z);
      fill.position.set(focus.x + 120, 80, focus.z + 120);
      fill.target.position.set(focus.x, 0, focus.z);
      sky.position.set(focus.x, 0, focus.z);
      clouds.position.x = Math.sin(t * 0.004) * 30;
    },
  };
}
