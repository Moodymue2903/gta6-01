// VERMILION KEYS — population director (Fix Round 7, C1).
// Civilian density with a bounded pool and distance-based activation:
// archetype pedestrians beyond ~150 m of the player are parked
// (mesh hidden) and near ones are visible and wandering. The director
// does NOT duplicate the walk / flee / witness / guard state machine
// in entities/pedestrian.js — archetype peds are plain ped objects
// pushed into game.peds.peds, so Pedestrians.update drives them.
// Gunfire panic and police-alert reactions are likewise delegated to
// the existing reactToGunfire() / update() paths.

import * as THREE from 'three';
import { Car } from '../entities/vehicle.js';
import { choice, mulberry32, rand } from '../util.js';
import { countNear, stageCoverDensity } from './density_spawner.js';
import { setBraking } from './vehicleMaterials.js';
import { randomSidewalkPoint } from './roadNetwork.js';

// Dedicated colour stream (seeded, never touches game.rng) so
// archetype shirts are fixed per seed like the rest of the city.
const colorRng = mulberry32(20261122);

export const ACTIVATION_RADIUS = 150;
const SHIRTS = [0xe84a3a, 0x3a7ad9, 0xe8c93a, 0x2ea88a, 0xd97bd9, 0xe8e8e8, 0x222226, 0xd97b2e, 0x8a6a3a];

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

// Archetype silhouettes, built on the same proportions as
// pedestrian.js makePedMesh (body first child, head, two legs, hidden
// phone, userData { legL, legR, phase, phone, gun }) so the existing
// update loop, downBody() and knockDown() all work on them unchanged.
export function makeArchetypeMesh(kind) {
  const g = new THREE.Group();
  let shirt = choice(colorRng, SHIRTS);
  if (kind === 'tourist') shirt = choice(colorRng, [0xffd23a, 0x2ea88a, 0xff6a4a, 0xe8e8e8]);
  if (kind === 'lookout') shirt = 0x1a1a20;
  if (kind === 'skater') shirt = choice(colorRng, [0x3a7ad9, 0xd97bd9, 0xe8c93a]);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.3), lambert(shirt));
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), lambert(0xc98a5a));
  head.position.y = 1.68;
  g.add(head);
  if (kind === 'tourist') {
    // Sunhat: a wide disc + a shallow dome — the tourist read at a
    // distance is the hat, not the shirt.
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12), lambert(0xf2e6d8));
    brim.position.y = 1.88;
    g.add(brim);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xe8c93a));
    dome.position.y = 1.88;
    g.add(dome);
    // Beach bag on the shoulder.
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.14), lambert(0x2ea88a));
    bag.position.set(-0.36, 1.05, 0);
    g.add(bag);
  } else if (kind === 'skater') {
    // Cap + brim, worn backwards; board tucked under the arm.
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 8), lambert(0xd93a2a));
    cap.position.y = 1.88;
    g.add(cap);
    const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.22), lambert(0xd93a2a));
    brim.position.set(0, 1.86, -0.3);
    g.add(brim);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.85), lambert(0xe8c93a));
    board.position.set(0.38, 0.95, 0);
    board.rotation.x = 0.15;
    g.add(board);
  } else if (kind === 'lookout') {
    // Dark suit + red bandana like a guard — but no gun. The bandana
    // is the syndicate tell; the empty hands are what separates a
    // lookout from a guard.
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.1, 0.52), lambert(0xd93a2a));
    band.position.y = 1.78;
    g.add(band);
    const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.5, 0.32), lambert(0x14141a));
    jacket.position.y = 1.18;
    g.add(jacket);
  }
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), lambert(0x2a2a34));
  legL.position.set(-0.14, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  // Skaters stand with a wider, ready stance.
  if (kind === 'skater') {
    legL.position.x = -0.2;
    legR.position.x = 0.2;
    legL.rotation.z = 0.12;
    legR.rotation.z = -0.12;
  }
  g.add(legL, legR);
  // Hidden phone (witnesses raise it): same slot pedestrian.js uses.
  const phone = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.3, 0.05),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22, emissive: 0xfff2c0, emissiveIntensity: 1.0 }),
  );
  phone.position.set(0.44, 1.52, 0.18);
  phone.visible = false;
  g.add(phone);
  g.userData = { legL, legR, phase: Math.random() * 6, phone, gun: null };
  return g;
}

export class PopulationDirector {
  constructor(game) {
    this.game = game;
    this.archetypes = []; // archetype ped objects (also in game.peds.peds)
    this.activationRadius = ACTIVATION_RADIUS;
  }

  // Distance-based activation + congestion braking, once per tick.
  // Parked archetypes stay in game.peds.peds (the update loop still
  // moves them, cheaply) but render nothing until the player is near.
  // NOTE: Pedestrians.update sets mesh.visible = true when a downed
  // ped gets back up — a parked ped that was knocked down reappears;
  // the next director tick re-parks it if it is still far away.
  update(dt) {
    void dt;
    const game = this.game;
    if (!game.player || !game.peds) return;
    const player = game.player;
    const px = player.inCar ? player.inCar.pos.x : player.pos.x;
    const pz = player.inCar ? player.inCar.pos.z : player.pos.z;
    const r = this.activationRadius;
    for (const p of this.archetypes) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - px, p.pos.z - pz);
      p.mesh.visible = d <= r;
    }
    // Congestion braking: a traffic car boxed in by three or more
    // neighbours at near-zero speed lights its brake lights, so a
    // jam reads as a jam. Traffic.update recomputes braking on its
    // own pass; this only adds the jam case it cannot see.
    if (game.traffic && game.traffic.cars) {
      const cars = game.traffic.cars;
      for (const car of cars) {
        if (!car.traffic || car.dead) continue;
        if (Math.abs(car.speed) > 2) continue;
        let neighbours = 0;
        for (const other of cars) {
          if (other === car || other.dead) continue;
          if (Math.hypot(other.pos.x - car.pos.x, other.pos.z - car.pos.z) < 10) neighbours++;
          if (neighbours >= 3) break;
        }
        if (neighbours >= 3) setBraking(car, true);
      }
    }
  }

  // Gunfire panic: delegated to the existing state machine.
  reactToGunfire(x, z) {
    this.game.peds.reactToGunfire(x, z);
  }

  spawnArchetype(kind, x, z) {
    const game = this.game;
    const rng = game.rng;
    const mesh = makeArchetypeMesh(kind);
    game.scene.add(mesh);
    const p = {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: rand(rng, 0, Math.PI * 2),
      state: 'walk',
      target: randomSidewalkPoint(rng, x, z, 60),
      idle: rand(rng, 0, 2),
      // Skaters move faster than the 1.1-1.8 walk band.
      speed: kind === 'skater' ? rand(rng, 2.4, 2.8) : rand(rng, 1.1, 1.8),
      downTimer: 0,
      fleeT: 0,
      alertT: 0,
      hideT: 0,
      reportTimer: 0,
      witnessCrime: null,
      filming: false,
      filmT: 0,
      guard: false,
      archetype: kind,
    };
    mesh.position.copy(p.pos);
    mesh.rotation.y = p.heading;
    game.peds.peds.push(p);
    this.archetypes.push(p);
    return p;
  }

  // Cover staging: the base density, then 1 scooter filtering on the
  // north lane by the hero, then archetype peds on the promenade.
  // The base stage already adds 1 scooter at (268,-4.6), so this one
  // makes exactly 2 scooters in frame (the plan's target).
  stageCoverCrowd(game) {
    const base = stageCoverDensity(game);
    void base;
    const scooters = [
      { x: 264, z: -4.6, color: 0x3a7ad9 },
    ];
    for (const s of scooters) {
      const scooter = new Car(game, 'bike', s.color, s.x, s.z, -Math.PI / 2);
      scooter.speed = 0;
      game.traffic.cars.push(scooter);
    }
    // Archetype peds on the promenade edges, interleaved with (not on
    // top of) the 16 staged peds at z +/-9..13: tourists south, a
    // skater pair north, lookouts watching the chase from both sides.
    // RECORDING 33 (user, 2026-11-24 10:24 IST): the 32b039ec cover
    // frame reads peds as WALKING ON WATER. The 8 cover NPCs were
    // moved to island 3, but these archetypes at x 234-249 stand on
    // the quay slabs in the water channel (x 230-250) and still read
    // as on the teal water. Moved to the NEAR side (island 3,
    // x 252-267) on tan land, no water between them and the camera;
    // south ones shifted to z 7-8 so they don't sit on the cover
    // NPCs (z 10-14). Cover branch only (stageCoverCrowd is cover).
    const spots = [
      { kind: 'tourist', x: 252, z: 7 },
      { kind: 'tourist', x: 258, z: -10 },
      { kind: 'tourist', x: 264, z: 8 },
      { kind: 'skater',  x: 254, z: -11 },
      { kind: 'skater',  x: 262, z: 7 },
      { kind: 'lookout', x: 250, z: -9 },
      { kind: 'lookout', x: 265, z: -11 },
      { kind: 'tourist', x: 256, z: 8 },
    ];
    for (const s of spots) {
      const p = this.spawnArchetype(s.kind, s.x, s.z);
      p.state = 'walk';
      p.idle = 0;
    }
    return countNear(game, 250, 0, 60);
  }

  densityAt(x, z, r) {
    return countNear(this.game, x, z, r);
  }
}
