// VERMILION KEYS — container yard (Fix Round 5, Frame 2).
// A real place on the port island, north of the port road: bright
// colour-blocked container stacks, a gantry crane, floodlights, and the
// EXPORT gate at the east end of the road. The yard ambush (JOB 5)
// fight happens in the open aisle between the north container row and
// the road — nothing stands between the south camera and the fight.
// The export zone is the painted gate at (430, -160).

import * as THREE from 'three';
import { Car } from '../entities/vehicle.js';
import { attachContactShadow } from './vehicleMaterials.js';
import { canvasTexture, choice, mulberry32 } from '../util.js';

const CONTAINER_COLORS = [0xd93a2a, 0x2a6ad9, 0xe8c93a, 0x2ea88a, 0xff7a2a, 0x7a4ad9];

export function buildContainerYard(scene, game) {
  const rng = mulberry32(20261126);
  const colliders = [];
  const yardVehicles = [];

  // Container rows: north rows at z=-184 and z=-172, with a gap in the
  // -172 row (x 375-405) so the fight aisle opens to the road; a south
  // row at z=-148 behind the camera line.
  const rows = [
    { z: -184, x0: 335, x1: 445 },
    { z: -172, x0: 335, x1: 445, gap: [375, 405] },
    { z: -148, x0: 335, x1: 445 },
  ];
  const boxGeo = new THREE.BoxGeometry(6, 2.6, 2.5);
  for (const row of rows) {
    for (let x = row.x0; x <= row.x1; x += 6.5) {
      if (row.gap && x >= row.gap[0] && x < row.gap[1]) continue;
      const color = choice(rng, CONTAINER_COLORS);
      const mat = new THREE.MeshLambertMaterial({ color });
      const c = new THREE.Mesh(boxGeo, mat);
      c.position.set(x, 1.3, row.z);
      c.castShadow = true;
      c.receiveShadow = true;
      scene.add(c);
      colliders.push({ x0: x - 3.1, z0: row.z - 1.35, x1: x + 3.1, z1: row.z + 1.35 });
      // Second-storey stack on about half the containers.
      if (rng() < 0.5) {
        const c2 = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: choice(rng, CONTAINER_COLORS) }));
        c2.position.set(x, 3.9, row.z);
        c2.castShadow = true;
        scene.add(c2);
      }
      // Corrugated ribs: three thin dark strips on the visible face.
      for (const ox of [-2, 0, 2]) {
        const rib = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 2.4, 0.12),
          new THREE.MeshLambertMaterial({ color: 0x000000, transparent: true, opacity: 0.18 }),
        );
        rib.position.set(x + ox, 1.3, row.z + 1.3);
        scene.add(rib);
      }
    }
  }

  // Gantry crane over the north rows.
  {
    const crane = new THREE.Group();
    crane.position.set(400, 0, -180);
    const mat = new THREE.MeshLambertMaterial({ color: 0xd9a83a });
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 18, 1.6), mat);
      leg.position.set(s * 9, 9, 0);
      crane.add(leg);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(24, 1.6, 2.2), mat);
    beam.position.set(0, 18.5, 0);
    crane.add(beam);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.6), new THREE.MeshLambertMaterial({ color: 0x3a7ad9 }));
    cab.position.set(-4, 17, 0);
    crane.add(cab);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 9, 4), new THREE.MeshBasicMaterial({ color: 0x222222 }));
    line.position.set(6, 13.5, 0);
    crane.add(line);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.4), new THREE.MeshLambertMaterial({ color: 0x2a2a34 }));
    hook.position.set(6, 8.6, 0);
    crane.add(hook);
    scene.add(crane);
    colliders.push({ x0: 390, z0: -181, x1: 392, z1: -179 });
    colliders.push({ x0: 408, z0: -181, x1: 410, z1: -179 });
  }

  // Floodlight poles: bright heads, two real point lights.
  for (const [x, z] of [[350, -166], [430, -166]]) {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.16, 9, 6),
      new THREE.MeshLambertMaterial({ color: 0x2a2a30 }),
    );
    pole.position.set(x, 4.5, z);
    scene.add(pole);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }),
    );
    head.position.set(x, 9.1, z);
    scene.add(head);
    const pl = new THREE.PointLight(0xfff2d0, 22, 30, 1.5);
    pl.position.set(x, 8.6, z);
    scene.add(pl);
  }

  // EXPORT gate: painted zone + sign at the east end of the port road.
  {
    const zone = new THREE.Mesh(
      new THREE.PlaneGeometry(16, 9),
      new THREE.MeshBasicMaterial({ color: 0x2ea88a, transparent: true, opacity: 0.35 }),
    );
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(430, 0.09, -160);
    scene.add(zone);
    const signTex = canvasTexture(256, 64, (ctx, w, h) => {
      ctx.fillStyle = '#0d2a24';
      ctx.fillRect(0, 0, w, h);
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#7ddb8a';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#7ddb8a';
      ctx.fillText('EXPORT', w / 2, h / 2);
    });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 1.5),
      new THREE.MeshBasicMaterial({ map: signTex }),
    );
    sign.position.set(430, 4.2, -168);
    scene.add(sign);
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 4.2, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2a2a30 }),
    );
    post.position.set(433.5, 2.1, -168);
    scene.add(post);
  }

  // Yard vehicles: two box trucks, two sedans, a muscle car and a van,
  // parked around the apron and the road. They are real cars (not
  // traffic) so they stay put for the fight frame.
  const yardCars = [
    { cls: 'van', color: 0xe8e8e8, x: 345, z: -158, h: Math.PI / 2 },
    { cls: 'van', color: 0xd97b2e, x: 420, z: -166, h: -Math.PI / 2 },
    { cls: 'sedan', color: 0x3a7ad9, x: 360, z: -152, h: 0 },
    { cls: 'sedan', color: 0xe8c93a, x: 445, z: -152, h: Math.PI },
    { cls: 'muscle', color: 0xd93a2a, x: 415, z: -140, h: Math.PI / 2 },
    { cls: 'compact', color: 0x2ea88a, x: 338, z: -140, h: 0 },
  ];
  for (const yc of yardCars) {
    const car = new Car(game, yc.cls, yc.color, yc.x, yc.z, yc.h);
    car.speed = 0;
    attachContactShadow(scene, yc.x, yc.z, car.def.len, car.def.wid);
    yardVehicles.push(car);
  }

  return { colliders, yardVehicles };
}
