// VERMILION KEYS — sky and light helpers (Fix Round 5).
// The midday preset lives in lighting.js; this module applies it and
// adds the warm bay lights the garage interior needs. The sun stays
// the preset's sun — this module never invents a second key light.

import * as THREE from 'three';

export function applyMidday(game) {
  game.lighting.setTimeOfDay('midday');
  game.renderer.toneMappingExposure = 1.25;
}

export function applyGolden(game) {
  game.lighting.setTimeOfDay('golden');
  game.renderer.toneMappingExposure = 1.3;
}

// Three warm bay lights over a garage bay, plus a bright door light
// from the open front. No shadows — the sun already casts those.
export function addWarmBayLights(scene, cx, cz) {
  const lights = [];
  for (const [ox, oz] of [[-3.5, -2], [3.5, -2], [0, 2.5]]) {
    const pl = new THREE.PointLight(0xffb36a, 26, 16, 1.6);
    pl.position.set(cx + ox, 4.1, cz + oz);
    scene.add(pl);
    lights.push(pl);
  }
  // Bright door light: a cool-white wash from the open front.
  const door = new THREE.PointLight(0xfff2d0, 40, 22, 1.4);
  door.position.set(cx, 3.2, cz + 7.5);
  scene.add(door);
  lights.push(door);
  return lights;
}
