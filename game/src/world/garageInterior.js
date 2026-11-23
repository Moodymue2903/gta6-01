// VERMILION KEYS — garage interior (Fix Round 5, Frame 4).
// The Motor Works bay becomes a real interior: side walls and a
// ceiling over the existing canopy, a two-post hydraulic lift with a
// slowly rotating turntable under the car, warm bay lights, a bright
// door light from the open front, and dressing (tool shelf, tyre stack,
// oil drums). The front stays open to the street so the car can drive
// in and the door light can fall across the bay.

import * as THREE from 'three';
import { addWarmBayLights } from './skyAndLight.js';

export function buildGarageInterior(scene) {
  const cx = 52;
  const cz = 128;
  const colliders = [];

  // Side walls (the back wall already exists in city.js) and ceiling.
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x6a4a52 });
  for (const s of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.6, 9.5), wallMat);
    wall.position.set(cx + s * 6.1, 2.3, cz);
    wall.castShadow = true;
    wall.receiveShadow = true;
    scene.add(wall);
    colliders.push({ x0: cx + s * 6.1 - 0.2, z0: cz - 4.8, x1: cx + s * 6.1 + 0.2, z1: cz + 4.8 });
  }
  const ceiling = new THREE.Mesh(
    new THREE.BoxGeometry(12.5, 0.3, 9.5),
    new THREE.MeshLambertMaterial({ color: 0x2a2a34 }),
  );
  ceiling.position.set(cx, 4.9, cz);
  scene.add(ceiling);

  // Two-post hydraulic lift: two posts + arms under the car.
  // FIX (garage post crossing the car): the posts used to flank the
  // car at +/-1.4 m on its centre line (cz), so from the front-left
  // three-quarter garage camera the west post projected across the
  // car's midsection. They now stand 1.6 m toward the car's REAR
  // (cz-1.6, just behind the rear bumper line) and 1.8 m out, so from
  // the garage camera the west post projects ~50 px left of the car's
  // rear-left silhouette edge and the east post is hidden behind the
  // car body except for its top peeking above the roofline as bay
  // equipment. (Verified by projecting camera/car/post geometry.)
  const liftMat = new THREE.MeshLambertMaterial({ color: 0x1a4d8f });
  for (const s of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.5), liftMat);
    post.position.set(cx + s * 1.8, 1.3, cz - 1.6);
    post.castShadow = true;
    scene.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.18, 0.4), liftMat);
    arm.position.set(cx + s * 0.9, 0.55, cz - 1.6);
    scene.add(arm);
  }
  const liftPad = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.18, 2.4),
    new THREE.MeshLambertMaterial({ color: 0x3a3a44 }),
  );
  liftPad.position.set(cx, 0.45, cz - 0.4);
  liftPad.castShadow = true;
  liftPad.receiveShadow = true;
  scene.add(liftPad);

  // Turntable: a lit disc under the lift pad that rotates slowly.
  const turntable = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 0.12, 28),
    new THREE.MeshLambertMaterial({ color: 0x4a4a58, emissive: 0x1a2a3a, emissiveIntensity: 0.5 }),
  );
  turntable.position.set(cx, 0.32, cz);
  turntable.receiveShadow = true;
  scene.add(turntable);
  // Glowing ring around the turntable edge.
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.4, 0.07, 8, 40),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.set(cx, 0.4, cz);
  scene.add(ring);

  // Dressing: tool shelf on the back wall, tyre stack, oil drums.
  const shelf = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.8, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
  );
  shelf.position.set(cx - 3.6, 0.9, cz - 4.2);
  shelf.castShadow = true;
  scene.add(shelf);
  const toolCols = [0xd93a2a, 0xe8c93a, 0x2ea88a, 0x3a7ad9];
  toolCols.forEach((c, i) => {
    const tool = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.35, 0.35),
      new THREE.MeshLambertMaterial({ color: c }),
    );
    tool.position.set(cx - 4.7 + i * 0.75, 1.95, cz - 4.2);
    scene.add(tool);
  });
  for (let i = 0; i < 3; i++) {
    const tyre = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.18, 8, 16),
      new THREE.MeshLambertMaterial({ color: 0x14141a }),
    );
    tyre.rotation.x = Math.PI / 2;
    tyre.position.set(cx + 5.2, 0.2 + i * 0.38, cz - 3.6);
    tyre.castShadow = true;
    scene.add(tyre);
  }
  for (const [ox, oz, c] of [[-5.2, 3.4, 0xd93a2a], [-4.4, 3.6, 0x2ea88a]]) {
    const drum = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 1.0, 10),
      new THREE.MeshLambertMaterial({ color: c }),
    );
    drum.position.set(cx + ox, 0.5, cz + oz);
    drum.castShadow = true;
    scene.add(drum);
  }

  // Warm bay lights + bright door light.
  addWarmBayLights(scene, cx, cz);

  // FIX (pale car at dusk): the car read pale peach/cream in rounds
  // 1-4 while the paint was assumed to be vermilion 0xe85a24 — it was
  // actually light salmon 0xff7a55 (shotDirector.js run car; fixed
  // there to 0xe85a24). Rounds 1-4 proved the wash was not the light
  // level, the bay lights, or the env: adding a 120 spot, dimming the
  // bay lights 26 -> 7, and cutting envMapIntensity 1.4 -> 0.2 each
  // barely moved the car's pixels, so all three were reverted. This
  // modest saturated-orange key spot stays: it warms the camera-facing
  // flank the garage camera sees, at a level that cannot wash it out.
  const keySpot = new THREE.SpotLight(0xff8a30, 30, 20, 0.45, 0.5, 1.6);
  keySpot.position.set(cx - 4, 4.6, cz + 4);
  keySpot.target.position.set(cx, 0.8, cz);
  scene.add(keySpot);
  scene.add(keySpot.target);

  return {
    colliders,
    turntable,
    liftTopY: 0.54,
    update(dt) {
      turntable.rotation.y += dt * 0.25;
    },
  };
}
