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

// FIX ROUND 2 — time-of-day presets. The clean re-test (0-3, all 12
// criteria to #5) faulted one thing above all: #5 varies time of day
// across its four frames (bright daylight, dusk, neon night) while our
// sheet is the same flat orange sky in all four ("uniform flat orange
// sky", "monochrome orange"). Each shot now picks its own preset; the
// cover keeps the fix-1 golden hour. setTimeOfDay swaps the sky
// uniforms, fog, sun, hemisphere, rim, fill and cloud tint together,
// and update() positions the sun from the CURRENT sunDir so the preset
// survives the staging ticks.
const PRESETS = {
  // Bright golden hour (cover). The fix-1 values, unchanged.
  golden: {
    sunDir: [-0.55, 0.22, -0.62], sunColor: 0xffb347, sunIntensity: 3.4,
    skyTop: 0x9a6ab8, skyMid: 0xe8894a, skyHorizon: 0xff8a2a, sunGlow: 0xffe0b0,
    fog: 0xff9a45, hemiSky: 0xffb98a, hemiGround: 0x8a6a72, hemiIntensity: 1.35,
    rimColor: 0x7a9fff, rimIntensity: 0.9, fillColor: 0xffd9a0, fillIntensity: 0.85,
    cloud: 0xffe0b8, exposure: 1.3,
  },
  // Bright daylight (foot): high blue sky, pale horizon, teal water.
  day: {
    sunDir: [0.35, 0.72, -0.35], sunColor: 0xfff2d0, sunIntensity: 3.2,
    skyTop: 0x2a6ad9, skyMid: 0x6ab8e8, skyHorizon: 0xcfe8f2, sunGlow: 0xfff8e0,
    fog: 0xa8d0e8, hemiSky: 0xbfd9ff, hemiGround: 0x8a7a5a, hemiIntensity: 1.15,
    rimColor: 0x9fc0ff, rimIntensity: 0.7, fillColor: 0xd8ecff, fillIntensity: 0.9,
    cloud: 0xffffff, exposure: 1.25,
  },
  // Dusk purple-pink (police): very low pink sun, violet shadows.
  dusk: {
    sunDir: [-0.72, 0.12, -0.35], sunColor: 0xff6a8a, sunIntensity: 2.8,
    skyTop: 0x4a2a6a, skyMid: 0xd95a8a, skyHorizon: 0xff7a5a, sunGlow: 0xffb0c0,
    fog: 0xc97a8a, hemiSky: 0xc98ab8, hemiGround: 0x5a3a5a, hemiIntensity: 1.1,
    rimColor: 0xb08aff, rimIntensity: 0.8, fillColor: 0xffb0d0, fillIntensity: 0.7,
    cloud: 0xffb0a0, exposure: 1.3,
  },
  // Neon night (mission): dark violet sky, cool moonlight key, lit
  // windows and lamps carry the frame. Exposure stays up so the frame
  // stays bright in its own palette.
  // RE-AUTHOR FIX: the first neon render came out too dark (mean RGB
  // [37,36,69]) — the hero car vanished into the road. The key/fill
  // were all at night levels at once (sun 1.3, hemi 0.75, fill 0.6).
  // Lifted to moonlight + city-glow levels (sun 2.0, hemi 1.05,
  // fill 0.95) so the cars and road read while the sky stays dark
  // violet — night, but legible.
  neon: {
    sunDir: [0.2, 0.35, 0.6], sunColor: 0x8a9fff, sunIntensity: 2.0,
    skyTop: 0x0a0a2a, skyMid: 0x3a2a6a, skyHorizon: 0x8a4a8a, sunGlow: 0xc0d0ff,
    fog: 0x2a1a4a, hemiSky: 0x2a3a6a, hemiGround: 0x1a1a2a, hemiIntensity: 1.05,
    rimColor: 0x6a8aff, rimIntensity: 0.9, fillColor: 0x8a7aff, fillIntensity: 0.95,
    cloud: 0x3a2a55, exposure: 1.25,
  },
};

export function buildLighting(scene) {
  // Sky dome: gradient peach horizon -> violet zenith, with a sun glow.
  // FIX ROUND: the sun was too high and too far west, so its disc sat
  // outside the cover frame; it is lower now and swung north so the glow
  // reads in the north-looking cover shot. Sky top lifted so the upper
  // sky is violet, not near-black.
  let sunDir = new THREE.Vector3(...PRESETS.golden.sunDir).normalize();
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
    // Swap the whole light rig to a named time of day. Used by shot
    // staging only; the live game always runs golden hour.
    setTimeOfDay(name) {
      const p = PRESETS[name] || PRESETS.golden;
      sunDir = new THREE.Vector3(...p.sunDir).normalize();
      skyMat.uniforms.topColor.value.setHex(p.skyTop);
      skyMat.uniforms.midColor.value.setHex(p.skyMid);
      skyMat.uniforms.horizonColor.value.setHex(p.skyHorizon);
      skyMat.uniforms.sunColor.value.setHex(p.sunGlow);
      skyMat.uniforms.sunDir.value.copy(sunDir);
      scene.fog.color.setHex(p.fog);
      sun.color.setHex(p.sunColor);
      sun.intensity = p.sunIntensity;
      hemi.color.setHex(p.hemiSky);
      hemi.groundColor.setHex(p.hemiGround);
      hemi.intensity = p.hemiIntensity;
      rim.color.setHex(p.rimColor);
      rim.intensity = p.rimIntensity;
      fill.color.setHex(p.fillColor);
      fill.intensity = p.fillIntensity;
      cloudMat.color.setHex(p.cloud);
      return p.exposure;
    },
    update(dt, t, focus) {
      // Keep the shadow frustum centred on the action. The sun offset
      // follows the CURRENT sunDir (a preset can move the sun), so the
      // light direction and the sky-disc direction always agree.
      sun.position.set(focus.x + sunDir.x * 270, focus.y + sunDir.y * 270, focus.z + sunDir.z * 270);
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
