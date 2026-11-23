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
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.18, 0.6, 0.92,
  ));
  composer.addPass(new ShaderPass(GradeShader));
  composer.addPass(new OutputPass());
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
