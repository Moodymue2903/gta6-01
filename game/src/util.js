// VERMILION KEYS — shared helpers: seeded randomness, math, palette.
// Every random choice in the game flows from a seeded RNG so a fixed seed
// reproduces the same city, traffic and missions exactly.

import * as THREE from 'three';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rand(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

export function randInt(rng, lo, hi) {
  return Math.floor(rand(rng, lo, hi + 1));
}

export function choice(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dampAngle(a, b, lambda, dt) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

// Golden-hour palette: amber sun, peach haze, violet shadows, teal water.
export const PALETTE = {
  skyTop: 0x6b4a8f,
  skyMid: 0xd97b54,
  skyHorizon: 0xffc27a,
  sun: 0xffd9a0,
  fog: 0xe8966a,
  water: 0x2e8f9e,
  waterDeep: 0x1d6f7d,
  sand: 0xe8c98f,
  asphalt: 0x3a3a42,
  asphaltLine: 0xd8c98a,
  sidewalk: 0x9a8a7a,
  grass: 0x7a8f5a,
  building: [0xe8a87c, 0xd98c6a, 0xc97b8f, 0x8fa8c9, 0xe8c98f, 0xb08a9e, 0x7a9e8f, 0xd9b380],
  roof: 0x5a4a52,
  palmTrunk: 0x7a5a42,
  palmLeaf: 0x3f8f4f,
  car: [0xe84a3a, 0x3a7ad9, 0xe8c93a, 0x2ea88a, 0xd97bd9, 0xe8e8e8, 0x222226, 0xd97b2e],
  coral: 0xff6a4a,
  policeWhite: 0xf2f2f2,
  policeBlack: 0x1a1a20,
  heli: 0x2a2a34,
};

export function canvasTexture(w, h, draw, repeatX = 1, repeatY = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
