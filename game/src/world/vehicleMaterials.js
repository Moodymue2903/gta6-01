// VERMILION KEYS — vehicle materials (Fix Round 5, brightness pass).
// No black roofs or glass anywhere: two-tone paint (a lighter roof
// panel), tinted glass with a faint warm glow, and emissive headlights
// and brake lights. Brake lights are real state — traffic turns them
// on while braking, so a braked queue reads as a queue.

import * as THREE from 'three';

export function tintedGlassMaterial() {
  return new THREE.MeshLambertMaterial({
    color: 0x7ab8d9,
    emissive: 0x2a4a5a,
    emissiveIntensity: 0.55,
  });
}

export function lighterShade(color, lift = 0.22) {
  return new THREE.Color(color).offsetHSL(0, -0.05, lift).getHex();
}

export function darkerShade(color, drop = 0.18) {
  return new THREE.Color(color).offsetHSL(0, 0.02, -drop).getHex();
}

// Headlight + taillight meshes for one car. The taillights are stored
// on the group so traffic can light them while braking.
export function makeCarLights(group, len, wid, h) {
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailDim = new THREE.MeshBasicMaterial({ color: 0x881111 });
  const tailBright = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const tails = [];
  for (const s of [-1, 1]) {
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.4), headMat);
    h1.position.set(len / 2, h * 0.35, s * wid * 0.32);
    group.add(h1);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.42), tailDim);
    t1.position.set(-len / 2, h * 0.35, s * wid * 0.32);
    group.add(t1);
    tails.push(t1);
  }
  group.userData.tailDim = tailDim;
  group.userData.tailBright = tailBright;
  group.userData.tails = tails;
  group.userData.braking = false;
}

export function setBraking(car, on) {
  const u = car.mesh.userData;
  if (!u.tails || u.braking === on) return;
  u.braking = on;
  for (const t of u.tails) t.material = on ? u.tailBright : u.tailDim;
}

// A lighter two-tone roof panel, so a car reads as painted metal from
// above instead of one flat slab of colour.
export function addRoofPanel(group, len, wid, h, color) {
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(len * 0.5, 0.06, wid * 0.8),
    new THREE.MeshLambertMaterial({ color: lighterShade(color, 0.25) }),
  );
  roof.position.set(-len * 0.04, h * 0.6 + h * 0.5 + 0.03, 0);
  roof.castShadow = true;
  group.add(roof);
  return roof;
}

// Contact shadow: a soft dark ellipse that sits on the ground under a
// parked car, grounding it. The hero blob in boot.js does the same for
// the player's car; this one is for parked yard / queue cars.
export function attachContactShadow(scene, x, z, len, wid) {
  const blob = new THREE.Mesh(
    new THREE.CircleGeometry(1, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(x, 0.07, z);
  blob.scale.set(len * 0.62, wid * 0.75, 1);
  blob.renderOrder = 4;
  scene.add(blob);
  return blob;
}
