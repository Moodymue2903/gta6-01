// VERMILION KEYS — render look (render-fix round, Step 1).
// EffectComposer post chain (three r160 jsm, vendored under
// game/vendor/jsm — no CDN, no network at runtime):
//   RenderPass -> UnrealBloomPass (subtle, emissive lights only) ->
//   ShaderPass(GradeShader: warm grade + saturation + contrast +
//   vignette) -> OutputPass (ACES tone map + sRGB).
// The existing light rig (buildLighting + installAtmosphere +
// setTimeOfDay presets) is NOT replaced — the composer only adds
// the post chain, and applyDayHaze only retunes the fog for the
// day look. The sun/hemi/rim/fill rig keeps working as before.
// If the composer import ever fails, boot.js must fall back to plain
// renderer.render — the game must never break on a missing import.

import * as THREE from 'three';
import { EffectComposer } from '../../vendor/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../vendor/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../../vendor/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../../vendor/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from '../../vendor/jsm/postprocessing/OutputPass.js';

// Warm grade: desaturate slightly, lift contrast, warm highlights,
// cool-neutral shadows, soft vignette.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uWarm: { value: 0.035 },
    uSat: { value: 1.12 },
    uContrast: { value: 1.06 },
    uVignette: { value: 0.28 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uWarm, uSat, uContrast, uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSat);
      c.rgb = (c.rgb - 0.5) * uContrast + 0.5;
      c.r += uWarm;
      c.b -= uWarm * 0.6;
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * uVignette;
      gl_FragColor = c;
    }
  `,
};

// RENDER-FIX ROUND (Step 1) — shadows behind a flag, default OFF.
// The matrix (diag-matrix.mjs, 2026-11-23) proved the doubling is the
// SHADOW PASS, not the composer: shadows off/composer off 2,293 calls,
// shadows on/composer off 4,345, shadows off/composer on 2,308,
// shadows on/composer on 4,360. The composer costs ~15 calls; the
// shadow pass costs ~2,052 calls / ~290k triangles every frame (it
// always did — the old autoReset=true counter just hid it). With
// SUN_SHADOWS=false the hero blob shadow (boot.js heroBlob) carries
// the grounding, and the real per-frame cost drops to ~2,308 calls.
// Flip to true ONLY if a capture needs real shadows; if so, tighten
// the frustum to the car and follow it (followSun below, half=60)
// instead of the ±70/±90 island-wide box.
export const SUN_SHADOWS = false;

export function applyShadowFlag(scene) {
  scene.traverse((o) => {
    if (o.isDirectionalLight) {
      o.castShadow = SUN_SHADOWS;
      o.shadow.mapSize.set(1024, 1024);
    }
  });
}

// Flip-back path (only when SUN_SHADOWS is true): keep the shadow
// frustum tight on the car and follow it, so the shadow map draws
// the neighbourhood, not the whole island.
export function followSun(sun, focus, half = 60) {
  const sc = sun.shadow.camera;
  sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half;
  sc.updateProjectionMatrix();
  sun.target.position.copy(focus);
  sun.position.copy(focus).add(new THREE.Vector3(-160, 240, 110));
  sun.target.updateMatrixWorld();
}

export function createComposer(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Bloom only for emissive lights (threshold 0.92 keeps it off the
  // flat geometry): siren glints, sun glints, the heli searchlight.
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.6, 0.92,
  );
  composer.addPass(bloom);
  const grade = new ShaderPass(GradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  // GOLDEN-HOUR ROUND — stash the passes so shot staging can retune
  // them (applyGoldenHour): the composer itself is the only handle the
  // game object keeps (g.composer), so the passes ride on userData.
  // EffectComposer is NOT an Object3D and has no userData by default,
  // so initialise the object first (assigning a property on undefined
  // throws and kills the whole composer — that is what happened on
  // the first golden-hour smoke test).
  composer.userData = { bloom, grade };
  return composer;
}

// Warm haze for the day look (cover/combat): warm tan fog, denser
// than the sunset 0.0011, so distant buildings melt into warm light
// instead of sitting in pale blue. The sky stays blue (the midday
// preset's skyTop), the haze is warm — warm/cool contrast. Only the
// fog colour and density change; the sun/hemi/rim/fill rig is the
// midday preset's and is left alone.
export function applyDayHaze(scene) {
  if (!scene.fog) return;
  scene.fog.color.setHex(0xe9cfa0);
  if (scene.fog.isFogExp2) scene.fog.density = 0.0032;
}

// GOLDEN-HOUR ROUND (deliberate override of the C4 1-3 result) —
// a time-of-day change, not a colour grade. Three judges named the
// setup: warm sunset light, backlit palms, soft haze, glowing
// vehicle lights. The GOLDEN preset below is the codeable form of it.
//
// ADAPTATIONS from the plan (golden-hour-plan.md), because the plan
// was written blind against the codebase:
// (1) Named applyGoldenHour, NOT applyGolden — world/skyAndLight.js
// already exports applyGolden (the old sunset preset) and shots.js
// imports it; a second applyGolden would collide.
// (2) No separate sunsetSky.js dome. The game ALREADY has a sky dome
// (lighting.js buildLighting: radius 1500, BackSide, the same 3-stop
// gradient + a sun glow). A second dome at radius 900 with
// renderOrder -1 would be painted over by the existing dome
// (renderOrder 0, both depthWrite false), so it would be invisible
// unless the existing dome was hidden — and hiding it would lose
// the sun glow. Instead this function retunes the EXISTING dome's
// uniforms to the plan's sunset colours (blue top, warm mid, golden
// horizon). Same gradient, sun glow kept, no second dome.
// (3) Does NOT set scene.background — the dome is the sky, and
// scene.background is never set anywhere in this codebase.
// (4) Calls refs.setSunDir: lighting.update() runs every sim tick
// and resets the sun position from the preset sunDir, so a
// repositioned sun would be undone on the next tick unless the
// sunDir itself is updated. setSunDir (lighting.js) makes the
// backlit direction survive the per-frame update.
export const GOLDEN = {
  sunColor: 0xffa45e,
  sunIntensity: 2.8,
  hemiSky: 0xffd6a8,
  hemiGround: 0xb9703f,
  hemiIntensity: 0.85,
  fog: 0xf2b07e,
  fogDensity: 0.0045,
  exposure: 1.08,
  bloom: 0.32,
  sat: 1.12,
  contrast: 1.08,
  warm: 0.05,
  vignette: 0.3,
  sunSideDeg: 35, // 0 = straight ahead of the camera; raise if the car goes too dark
  sunDistance: 220,
  sunHeight: 60, // about 15 degrees elevation: low sunset light
  // Sky dome colours (retune of the existing dome, see (2) above).
  skyTop: 0x3f6494,
  skyMid: 0xf0a476,
  skyHorizon: 0xffdcaa,
  skySun: 0xffe0b0,
};

export function applyGoldenHour(refs, camera, focus) {
  const { renderer, scene, sun, hemi, bloom, grade, sky, setSunDir } = refs;

  renderer.toneMappingExposure = GOLDEN.exposure;

  sun.color.set(GOLDEN.sunColor);
  sun.intensity = GOLDEN.sunIntensity;

  hemi.color.set(GOLDEN.hemiSky);
  hemi.groundColor.set(GOLDEN.hemiGround);
  hemi.intensity = GOLDEN.hemiIntensity;

  scene.fog = new THREE.FogExp2(GOLDEN.fog, GOLDEN.fogDensity);

  if (bloom) bloom.strength = GOLDEN.bloom;
  if (grade) {
    grade.uniforms.uSat.value = GOLDEN.sat;
    grade.uniforms.uContrast.value = GOLDEN.contrast;
    grade.uniforms.uWarm.value = GOLDEN.warm;
    grade.uniforms.uVignette.value = GOLDEN.vignette;
  }

  // Backlit sun: placed ahead of the camera, so it lights the scene from the far side
  // and rim-lights the car's roofline and the palms.
  const fwd = new THREE.Vector3();
  camera.getWorldDirection(fwd);
  fwd.y = 0;
  fwd.normalize();
  const dir = fwd.clone().applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    THREE.MathUtils.degToRad(GOLDEN.sunSideDeg),
  );
  sun.target.position.copy(focus);
  sun.position.copy(focus).addScaledVector(dir, GOLDEN.sunDistance);
  sun.position.y += GOLDEN.sunHeight;
  sun.target.updateMatrixWorld();

  // The sun direction (for the per-frame lighting.update and the sky
  // glow): from the focus toward the sun, normalized.
  const sunDir = sun.position.clone().sub(focus).normalize();
  if (setSunDir) setSunDir(sunDir);

  // Retune the existing sky dome to the plan's sunset gradient, and
  // move its sun glow to the backlit sun.
  if (sky && sky.material && sky.material.uniforms) {
    const u = sky.material.uniforms;
    if (u.topColor) u.topColor.value.setHex(GOLDEN.skyTop);
    if (u.midColor) u.midColor.value.setHex(GOLDEN.skyMid);
    if (u.horizonColor) u.horizonColor.value.setHex(GOLDEN.skyHorizon);
    if (u.sunColor) u.sunColor.value.setHex(GOLDEN.skySun);
    if (u.sunDir) u.sunDir.value.copy(sunDir);
  }
}

// COOL COUNTER-ACCENT (user update 2026-11-23 ~23:39 IST) — the
// golden-hour cover is almost one hue (orange/red/terracotta), and
// the judges called #1 "cohesive coral/teal/gold", so a single warm
// hue may read as flat in a new way. Keep the sunset warm, but
// restore a cool counter-accent from the camera side, opposite the
// warm sun. The teal arch and the blue sky top are the anchors.
// Created once, stored on the scene so shot staging (and the
// WITH/WITHOUT comparison probe) can find it again.
export function createCoolLight(scene) {
  if (scene.userData.coolLight) return scene.userData.coolLight;
  const cool = new THREE.DirectionalLight(0x7fd0e0, 0.45);
  cool.castShadow = false;
  scene.add(cool, cool.target);
  scene.userData.coolLight = cool;
  return cool;
}

export function followCool(cool, camera, focus) {
  const back = new THREE.Vector3();
  camera.getWorldDirection(back).negate();
  back.y = 0;
  back.normalize();
  cool.target.position.copy(focus);
  cool.position.copy(focus).addScaledVector(back, 120).add(new THREE.Vector3(0, 80, 0));
  cool.target.updateMatrixWorld();
}
