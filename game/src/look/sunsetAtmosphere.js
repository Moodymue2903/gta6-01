// VERMILION KEYS -- sunset atmosphere (Fix Round 8, Builder B).
// Owns scene.environment + the light rig. One call sets up the sky,
// the procedural PMREM envMap, the fog and the three-part light rig.
// ACESFilmic, exposure ~1.16. The key sun stays LOW over the ocean
// horizon (~15 deg elevation, matching the existing golden preset).
// Do NOT use a high sun: a sunset sun at 45 deg is wrong for this
// scene. The biggest danger is overexposure: a sunset can quickly
// become one flat orange image with no material separation, so the
// exposure is kept at 1.16 and the fill/rim stay restrained.
// Zero network assets, no HDRI download: the envMap is generated
// ONCE at boot from a procedural sunset scene (PMREMGenerator).
// installAtmosphere is safe to call again (shot staging re-applies
// it after applyGolden resets the preset): the second call only
// retunes lights / exposure / sky colours, it never regenerates
// the PMREM envMap.

import * as THREE from 'three';

// Four-stop sunset sky: deep cobalt zenith -> twilight violet ->
// fiery sunset band -> solar disc glow over the water. Same uniform
// names as world/lighting.js (topColor, midColor, horizonColor,
// sunDir, sunColor) so setTimeOfDay keeps working for every preset:
// the shader derives all four stops from those uniforms.
const SKY_FRAG_4STOP = `
varying vec3 vDir;
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 horizonColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
void main() {
  float h = clamp(vDir.y, -0.05, 1.0);
  // Stop 1: fiery sunset band hugging the horizon.
  vec3 col = horizonColor;
  // Stop 2: twilight violet / rose middle band.
  col = mix(col, midColor, smoothstep(0.04, 0.28, h));
  // Stop 3: violet deepening toward the zenith.
  col = mix(col, mix(midColor, topColor, 0.55), smoothstep(0.26, 0.58, h));
  // Stop 4: deep cobalt zenith.
  col = mix(col, topColor, smoothstep(0.55, 0.85, h));
  // Solar disc glow: tight bright disc + a wide soft wash.
  float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
  col += sunColor * (pow(s, 220.0) * 1.4 + pow(s, 10.0) * 0.18);
  // Glow reflected over the water: warm light just below the horizon,
  // strongest in the sun's azimuth, so the sea carries the sunset.
  vec3 flatDir = normalize(vec3(vDir.x, 0.0, vDir.z));
  vec3 flatSun = normalize(vec3(sunDir.x, 0.0, sunDir.z));
  float az = max(dot(flatDir, flatSun), 0.0);
  float below = clamp(-vDir.y, 0.0, 0.18);
  col += sunColor * below * 2.2 * pow(az, 4.0);
  gl_FragColor = vec4(col, 1.0);
}`;

// Sunset uniform values for the cover: deep cobalt zenith, twilight
// violet middle, fiery horizon. Applied on every install call so a
// preset reset (applyGolden in shot staging) cannot leave the sky in
// the old flat-orange values.
const SUNSET_SKY = {
  topColor: 0x1e2f6e,
  midColor: 0x7a4a9e,
  horizonColor: 0xff7a2a,
  sunColor: 0xffe0b0,
};

function buildEnvMap(renderer, scene) {
  // Procedural sunset scene for the PMREM envMap: the same 4-stop
  // sky dome, a dark harbour floor below the horizon, a bright solar
  // disc, and a few bright rectangular industrial lights on the
  // horizon so chrome and clearcoat pick up warm window glints.
  const envScene = new THREE.Scene();
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: scene.userData.__skyVert || `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_Position.z = gl_Position.w;
}`,
    fragmentShader: SKY_FRAG_4STOP,
    // The env sky is warmed toward rose (mid 0x9a5a72, warm dark
    // floor): the envMap drives clearcoat reflections, and a pure
    // violet env turned the orange hero car pink in the first
    // drive render. The VISIBLE sky keeps its violet gradient;
    // only the reflection environment is warmed.
    uniforms: {
      topColor: { value: new THREE.Color(0x2a3a7a) },
      midColor: { value: new THREE.Color(0xa06a5a) },
      horizonColor: { value: new THREE.Color(SUNSET_SKY.horizonColor) },
      sunDir: { value: new THREE.Vector3(-0.55, 0.26, -0.62).normalize() },
      sunColor: { value: new THREE.Color(SUNSET_SKY.sunColor) },
    },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 24, 16), skyMat);
  envScene.add(dome);
  // Dark harbour floor below the horizon line (warm dark, so
  // downward reflections stay warm, not violet).
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(50, 24),
    new THREE.MeshBasicMaterial({ color: 0x2a2018, side: THREE.DoubleSide }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.5;
  envScene.add(floor);
  // Bright solar disc low over the water.
  const sunDir = new THREE.Vector3(-0.55, 0.26, -0.62).normalize();
  const disc = new THREE.Mesh(
    new THREE.SphereGeometry(3.2, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
  );
  disc.position.copy(sunDir).multiplyScalar(44);
  envScene.add(disc);
  // Industrial lights: bright warm rectangles on the harbour horizon.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
  const lightGeo = new THREE.BoxGeometry(3.5, 1.2, 0.4);
  const spots = [
    [-38, 2.5, -18, 0.5], [30, 3.0, -30, -0.4], [42, 2.0, 12, 1.2],
    [-12, 4.0, -42, 0.1], [8, 2.2, 44, 2.6], [-44, 3.2, 8, 1.9],
  ];
  for (const [x, y, z, ry] of spots) {
    const m = new THREE.Mesh(lightGeo, lightMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    envScene.add(m);
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.04, 0.1, 100);
  pmrem.dispose();
  skyMat.dispose();
  return rt.texture;
}

function retuneLights(lighting) {
  if (!lighting) return;
  // Key: ONE shadow-casting directional light, warm, low over the
  // ocean horizon (~15 deg, the existing golden preset direction is
  // kept: only colour and intensity are retuned).
  if (lighting.sun) {
    lighting.sun.color.setHex(0xff7e33);
    lighting.sun.intensity = 3.0;
    lighting.sun.shadow.mapSize.set(2048, 2048);
    lighting.sun.shadow.camera.left = -70;
    lighting.sun.shadow.camera.right = 70;
    lighting.sun.shadow.camera.top = 70;
    lighting.sun.shadow.camera.bottom = -70;
    lighting.sun.shadow.camera.near = 10;
    lighting.sun.shadow.camera.far = 700;
    lighting.sun.shadow.bias = -0.0006;
    lighting.sun.shadow.camera.updateProjectionMatrix();
  }
  // Sky fill: cool-violet sky, warm ground. Lifts shadowed faces
  // without flattening the sunset direction. Muted toward rose
  // (not pure violet) and kept at 1.1: the first drive render
  // showed the pure-violet fill turning the orange hero car pink.
  if (lighting.hemi) {
    lighting.hemi.color.setHex(0x9a7a8e);
    lighting.hemi.groundColor.setHex(0x6a4532);
    lighting.hemi.intensity = 1.0;
  }
  // Rim: cool, from behind-left, separates the dark side of the car
  // from the darker background. No shadow.
  if (lighting.rim) {
    lighting.rim.color.setHex(0x4cc9f0);
    lighting.rim.intensity = 1.0;
  }
  // Warm fill from the camera side: lifts, never flattens. 1.05:
  // it is the light that actually hits the car's rear (the face
  // the cover camera sees), so it must stay warm or the rear goes
  // pink under the violet sky fill.
  if (lighting.fill) {
    lighting.fill.color.setHex(0xffd9a0);
    lighting.fill.intensity = 1.2;
  }
}

export function installAtmosphere(scene, renderer, lighting) {
  if (!scene || !renderer) return null;
  // Renderer: ACES filmic, restrained exposure, sRGB output.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.16;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const first = !scene.userData.__sunsetAtmosphere;
  if (first) {
    scene.userData.__sunsetAtmosphere = true;
    // Swap the existing sky dome's fragment shader for the 4-stop
    // version, keeping the SAME material and uniforms object, so
    // lighting.js setTimeOfDay keeps driving the sky for every
    // preset (midday blue, dusk, neon) instead of breaking.
    if (lighting && lighting.sky && lighting.sky.material) {
      const mat = lighting.sky.material;
      scene.userData.__skyVert = mat.vertexShader;
      mat.fragmentShader = SKY_FRAG_4STOP;
      mat.needsUpdate = true;
    }
    // Fog matched to the horizon colour: distant buildings melt
    // into rose haze instead of monochrome amber. FogExp2, density
    // low enough that a 200 m ship stays readable.
    scene.fog = new THREE.FogExp2(0xe88a6a, 0.0011);
    // Procedural PMREM envMap, generated ONCE at boot.
    scene.environment = buildEnvMap(renderer, scene);
  }
  // Sunset sky colours (re-applied on every call: shot staging
  // calls applyGolden first, which resets the preset uniforms).
  if (lighting && lighting.sky && lighting.sky.material) {
    const u = lighting.sky.material.uniforms;
    if (u.topColor) u.topColor.value.setHex(SUNSET_SKY.topColor);
    if (u.midColor) u.midColor.value.setHex(SUNSET_SKY.midColor);
    if (u.horizonColor) u.horizonColor.value.setHex(SUNSET_SKY.horizonColor);
    if (u.sunColor) u.sunColor.value.setHex(SUNSET_SKY.sunColor);
  }
  if (scene.fog) scene.fog.color.setHex(0xe88a6a);
  retuneLights(lighting);
  return {
    exposure: 1.16,
    fogDensity: 0.0011,
    envMapReady: !!scene.environment,
  };
}
