// VERMILION KEYS — ambient props (Fix Round 5, density pass).
// Fruit stands, crates, neon signs and trash bins in the market, the
// boardwalk and the docks. Fixed positions from a dedicated RNG so the
// city, traffic and missions reproduce exactly.

import * as THREE from 'three';
import { canvasTexture, choice, mulberry32 } from '../util.js';

function neonSignTexture(text, color) {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#140a18';
    ctx.fillRect(0, 0, w, h);
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = color;
    ctx.fillText(text, w / 2, h / 2);
  });
}

export function placeProps(scene) {
  const rng = mulberry32(20261125);
  const colliders = [];

  // Fruit stands: counter + striped awning + bright fruit boxes.
  // Two by the night market, one on the boardwalk, one at the docks.
  const standSpots = [
    { x: 66, z: 132, c: 0xff6a4a },
    { x: 144, z: 132, c: 0x2ea88a },
    { x: 120, z: 112, c: 0xe8c93a },
    { x: 330, z: -150, c: 0xd95a8a },
  ];
  const fruitCols = [0xff6a4a, 0xe8c93a, 0x2ea88a, 0xd95a8a, 0xff9a3a];
  for (const s of standSpots) {
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 1.0, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x6a4a3a }),
    );
    counter.position.set(s.x, 0.5, s.z);
    counter.castShadow = true;
    scene.add(counter);
    for (let j = 0; j < 5; j++) {
      const fruit = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.3, 0.4),
        new THREE.MeshLambertMaterial({ color: choice(rng, fruitCols) }),
      );
      fruit.position.set(s.x - 0.9 + j * 0.45, 1.15, s.z + (rng() - 0.5) * 0.5);
      scene.add(fruit);
    }
    const awn = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.1, 1.9),
      new THREE.MeshLambertMaterial({ color: s.c }),
    );
    awn.position.set(s.x, 2.5, s.z);
    awn.rotation.x = 0.1;
    awn.castShadow = true;
    scene.add(awn);
    colliders.push({ x0: s.x - 1.4, z0: s.z - 0.8, x1: s.x + 1.4, z1: s.z + 0.8 });
  }

  // Crates: stacked boxes at the market edge and all over the docks.
  const crateSpots = [
    [62, 118], [64, 118], [63, 120], [148, 120], [150, 118],
    [320, -140], [322, -140], [321, -142], [440, -120], [442, -120],
    [300, -100], [360, -190], [410, -120], [200, 120], [90, 150],
  ];
  const crateCols = [0xa8824a, 0x8a6a3a, 0xc8a86a];
  for (const [x, z] of crateSpots) {
    const n = 1 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) {
      const crate = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.1, 1.1),
        new THREE.MeshLambertMaterial({ color: choice(rng, crateCols) }),
      );
      crate.position.set(x + (rng() - 0.5) * 0.4, 0.55 + i * 1.1, z + (rng() - 0.5) * 0.4);
      crate.rotation.y = rng() * 0.6;
      crate.castShadow = true;
      scene.add(crate);
    }
    colliders.push({ x0: x - 0.8, z0: z - 0.8, x1: x + 0.8, z1: z + 0.8 });
  }

  // Neon signs on the boardwalk facades: BAZAAR, FISH, RUM, TACOS.
  const signs = [
    { x: 80, z: 108, text: 'BAZAAR', color: '#ff3366', rot: 0 },
    { x: 130, z: 108, text: 'FISH', color: '#1995ad', rot: 0 },
    { x: 30, z: 108, text: 'RUM', color: '#ffb703', rot: 0 },
    { x: 180, z: 108, text: 'TACOS', color: '#ff6a4a', rot: 0 },
  ];
  for (const s of signs) {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 1.75),
      new THREE.MeshBasicMaterial({ map: neonSignTexture(s.text, s.color) }),
    );
    sign.position.set(s.x, 5.5, s.z);
    sign.rotation.y = s.rot;
    scene.add(sign);
  }

  // Trash bins along the main roads.
  const binSpots = [
    [-20, 8], [60, 8], [140, 8], [200, 8], [60, 102], [140, 102],
    [300, -152], [380, -152], [460, -152], [-280, 8], [-140, 78],
  ];
  for (const [x, z] of binSpots) {
    const bin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.4, 1.0, 8),
      new THREE.MeshLambertMaterial({ color: 0x3a4a3a }),
    );
    bin.position.set(x, 0.5, z);
    bin.castShadow = true;
    scene.add(bin);
  }

  return { colliders };
}
