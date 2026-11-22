// VERMILION KEYS — Royal Palms (Fix Round 7, C4/C1).
// Instanced curved-trunk Royal Palms: the trunk is a bent tube (not a
// straight cylinder) and the fronds are flattened, drooping cones /
// planes — NOT the solid green cones the old city palms use (one of
// those filled the cover frame as a giant green pyramid in fix 6).
// Plus beach props (striped cabanas, loungers, umbrellas) and
// bougainvillea planters (magenta flower clusters) lining the median.
//
// DEFAULT SPOTS — all OUTSIDE the cover sightline band
// (x 120-280, z -45..15), so these complement rather than duplicate
// the old city palms (which shots.js hides inside that band):
//   * beach row: x -40..200 step ~20, z 152-158 (south sand, in front
//     of the boardwalk; the old palms sit at z 122/148, these are
//     seaward of them)
//   * marina row: x -40..200 step ~30, z -152..-146 (Coral Marina quay)
//   * west row: x -320..-120 step ~40, z 150-156 (Saffron Pier sand)
//   * cabanas / loungers / umbrellas: beach z 156-162, x -30..190
//   * bougainvillea planters: low (0.8 m) boxes on the causeway
//     median edges z +/-7, x 190-260 — INSIDE the sightline band in
//     plan, but low enough to read as median planting, never as a
//     pyramid; the band rule exists for tall crowns, not ground flora.
// Pass explicit spots to override the defaults: buildRoyalPalms(game,
// [{x, z, s}]) where s is an optional height scale (default 1).

import * as THREE from 'three';
import { canvasTexture, mulberry32, rand } from '../util.js';
import { PALETTE } from '../util.js';

export const DEFAULT_PALM_SPOTS = (() => {
  const spots = [];
  for (let x = -40; x <= 200; x += 20) spots.push({ x, z: 154, s: 1 });
  for (let x = -40; x <= 200; x += 30) spots.push({ x, z: -149, s: 0.9 });
  for (let x = -320; x <= -120; x += 40) spots.push({ x, z: 153, s: 1.1 });
  return spots;
})();

// Bougainvillea planters: low median boxes, magenta flower clusters.
export const PLANTER_SPOTS = (() => {
  const spots = [];
  for (let x = 190; x <= 260; x += 12) {
    spots.push({ x, z: -7 });
    spots.push({ x: x + 6, z: 7 });
  }
  return spots;
})();

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

export function buildRoyalPalms(game, spots = DEFAULT_PALM_SPOTS) {
  const g = new THREE.Group();
  const rng = mulberry32(20261122);
  const up = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4();
  const q4 = new THREE.Quaternion();
  const eul = new THREE.Euler();

  // --- Curved trunk: a tube along a quadratic bezier that leans as
  // it rises (the Royal Palm curve). One geometry, instanced.
  const lean = 1.1;
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(lean * 0.3, 3.6, 0),
    new THREE.Vector3(lean, 7.2, 0),
  );
  const trunkGeo = new THREE.TubeGeometry(curve, 8, 0.26, 6, false);
  const trunks = new THREE.InstancedMesh(trunkGeo, lambert(PALETTE.palmTrunk), spots.length);
  trunks.castShadow = true;
  const yaws = [];
  spots.forEach((p, i) => {
    const yaw = rand(rng, 0, Math.PI * 2);
    yaws.push(yaw);
    eul.set(0, yaw, 0);
    q4.setFromEuler(eul);
    m4.compose(new THREE.Vector3(p.x, 0, p.z), q4, new THREE.Vector3(p.s || 1, (p.s || 1) * rand(rng, 0.9, 1.15), p.s || 1));
    trunks.setMatrixAt(i, m4);
  });
  g.add(trunks);

  // --- Fronds: flattened cones, drooping outward from the crown hub.
  // 7 fronds per palm, each a cone squashed flat (scale z 0.16) and
  // tilted down ~55 deg, so the crown reads as separate fronds from
  // every angle instead of one solid cone.
  const FRONDS = 7;
  const frondGeo = new THREE.ConeGeometry(0.55, 3.4, 4);
  frondGeo.translate(0, 1.7, 0); // base at the hub
  frondGeo.scale(1, 1, 0.16);
  const fronds = new THREE.InstancedMesh(frondGeo, lambert(0x2f7a44), spots.length * FRONDS);
  fronds.castShadow = true;
  const hubGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const hubs = new THREE.InstancedMesh(hubGeo, lambert(0x4a8a3a), spots.length);
  let fi = 0;
  spots.forEach((p, i) => {
    const s = p.s || 1;
    // Trunk tip: the bezier leans +x by `lean`, rotated by this
    // palm's yaw, so the hub and fronds sit on the real trunk tip.
    const yaw = yaws[i];
    const topX = p.x + lean * s * Math.cos(yaw);
    const topY = 7.2 * s;
    const topZ = p.z - lean * s * Math.sin(yaw);
    m4.makeTranslation(topX, topY, topZ);
    hubs.setMatrixAt(i, m4);
    for (let f = 0; f < FRONDS; f++) {
      const a = (f / FRONDS) * Math.PI * 2 + rand(rng, -0.2, 0.2);
      // Tilt the frond down from vertical, then yaw it outward.
      const yawQ = new THREE.Quaternion().setFromAxisAngle(up, a);
      const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.95);
      q4.copy(yawQ).multiply(tilt);
      m4.compose(new THREE.Vector3(topX, topY, topZ), q4, new THREE.Vector3(s, s, s));
      fronds.setMatrixAt(fi++, m4);
    }
  });
  g.add(fronds);
  g.add(hubs);

  // --- Beach props: striped cabanas, loungers, umbrellas. Fixed
  // positions on the south sand (z 156-162), clear of the old city
  // umbrellas (x -20..160, z 144-152).
  const cabanaCols = [0xff6a4a, 0x2ea88a, 0xe8c93a, 0xd95a8a, 0x3a7ad9];
  const cabanaSpots = [[-30, 158], [30, 160], [90, 157], [150, 160], [190, 158]];
  cabanaSpots.forEach(([x, z], i) => {
    const col = cabanaCols[i % cabanaCols.length];
    const awnTex = canvasTexture(64, 16, (ctx, w, h) => {
      for (let sx = 0; sx < w; sx += 16) {
        ctx.fillStyle = (sx / 16) % 2 === 0 ? '#f2e8d8' : '#' + col.toString(16).padStart(6, '0');
        ctx.fillRect(sx, 0, 16, h);
      }
    });
    const cab = new THREE.Group();
    const awn = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 2.6), new THREE.MeshLambertMaterial({ map: awnTex }));
    awn.position.y = 2.4;
    awn.rotation.x = 0.1;
    awn.castShadow = true;
    cab.add(awn);
    for (const [ox, oz] of [[-1.5, -1.1], [1.5, -1.1], [-1.5, 1.1], [1.5, 1.1]]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 5), lambert(0xe8e8e8));
      post.position.set(ox, 1.2, oz);
      cab.add(post);
    }
    const lounger = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.35, 0.7), lambert(col));
    lounger.position.set(0, 0.45, 0);
    lounger.castShadow = true;
    cab.add(lounger);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.08), lambert(col));
    back.position.set(-0.8, 0.7, 0);
    back.rotation.z = 0.5;
    cab.add(back);
    cab.position.set(x, 0, z);
    cab.rotation.y = rand(rng, -0.3, 0.3);
    g.add(cab);
  });
  // Standalone umbrellas between the cabanas.
  const umbCols = [0xff9a3a, 0x2ea88a, 0xd95a8a];
  [[0, 162], [60, 161], [120, 162], [175, 161]].forEach(([x, z], i) => {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 5), lambert(0xe8e8e8));
    pole.position.set(x, 1.2, z);
    g.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.9, 8), lambert(umbCols[i % umbCols.length]));
    canopy.position.set(x, 2.6, z);
    canopy.castShadow = true;
    g.add(canopy);
  });

  // --- Bougainvillea planters on the causeway median edges. ---
  // Low limestone boxes (0.8 m) with magenta / pink flower clusters:
  // three small spheres per planter, so the median reads as planted
  // colour, not bare concrete, without ever blocking a sightline.
  const flowerCols = [0xd95a8a, 0xff4ad9, 0xe84a8a, 0xff7ab0];
  for (const p of PLANTER_SPOTS) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 1.0), lambert(PALETTE.lime));
    box.position.set(p.x, 0.4, p.z);
    box.castShadow = true;
    g.add(box);
    for (let k = 0; k < 3; k++) {
      const f = new THREE.Mesh(
        new THREE.SphereGeometry(rand(rng, 0.32, 0.48), 8, 6),
        lambert(flowerCols[(k + (p.x | 0)) % flowerCols.length]),
      );
      f.position.set(p.x - 0.7 + k * 0.7, 1.05, p.z + rand(rng, -0.15, 0.15));
      f.castShadow = true;
      g.add(f);
    }
  }

  game.scene.add(g);
  return g;
}
