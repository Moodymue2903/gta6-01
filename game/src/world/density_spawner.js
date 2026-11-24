// VERMILION KEYS — density spawner (Fix Round 5, C1).
// Fixed spawn rules, enforced by the state dump: the cover shows at
// least 12 vehicles and 16 pedestrians; every frame shows at least 8
// vehicles and 12 pedestrians. Variety: coupes, delivery vans,
// scooters/mopeds, taxis, cruisers and police. A braked queue holds
// its brake lights on. Pedestrians panic on gunfire under 30 m
// (pedestrian.js reactToGunfire).

import { Car } from '../entities/vehicle.js';
import { setBraking } from './vehicleMaterials.js';
import { nearestRoadPoint, lanePoint, edgeHeading } from './roadNetwork.js';

export const COVER_MIN_VEHICLES = 12;
export const COVER_MIN_PEDS = 16;
export const FRAME_MIN_VEHICLES = 8;
export const FRAME_MIN_PEDS = 12;

// The cover: a braked civilian queue on the causeway approach behind
// the roadblock, plus a scooter, plus a promenade crowd. Cars are
// stopped (targetSpeed 0) with brake lights on, so the queue reads.
export function stageCoverDensity(game) {
  const g = game;
  // Eight cars pulled onto the roads near the causeway.
  g.traffic.placeNear(278, 0, 8);
  // A braked queue: three westbound cars held at the roadblock on the
  // flat west approach (north lane, z=-2.2) and three eastbound cars on
  // the far side (z=+2.2), all stopped with brake lights on.
  // FIX ROUND 6 — the fix-5 queue sat at x 236-252, ON the raised
  // drawbridge leaves: with the cover's bridge lowered for the
  // grounded chase, those cars would float where the ramp was. The
  // queue now holds on flat road west of the bridge (x 200-224).
  const queue = [
    { x: 204, z: -2.2, h: -Math.PI / 2 },
    { x: 212, z: -2.2, h: -Math.PI / 2 },
    { x: 220, z: -2.2, h: -Math.PI / 2 },
    { x: 208, z: 2.2, h: Math.PI / 2 },
    { x: 216, z: 2.2, h: Math.PI / 2 },
    { x: 224, z: 2.2, h: Math.PI / 2 },
  ];
  let qi = 0;
  for (const car of g.traffic.cars) {
    if (qi >= queue.length) break;
    const q = queue[qi];
    const near = nearestRoadPoint(q.x, q.z);
    car.pos.set(q.x, 0, q.z);
    car.heading = q.h;
    car.speed = 0;
    car.traffic.edge = near.edge;
    car.traffic.t = near.t;
    car.traffic.side = q.z < 0 ? -1 : 1;
    car.traffic.speed = 0;
    car.traffic.targetSpeed = 0;
    car.syncMesh();
    setBraking(car, true);
    qi++;
  }
  // A scooter in the queue: a Key Hopper (bike) filtering past the
  // stopped cars on the north lane.
  // FIX ROUND 6 — the fix-5 scooter sat at (240,-4.6), over the
  // drawbridge gap itself; grounded, it belongs east of the bridge,
  // filtering past the chase on the north lane by the hero car.
  const scooter = new Car(g, 'bike', 0xe8c93a, 268, -4.6, -Math.PI / 2);
  scooter.speed = 0;
  g.traffic.cars.push(scooter);
  // Sixteen pedestrians on the promenade / sidewalks by the bridge.
  // FIX ROUND 6 — the south row is bunched west of the bridge
  // (2.5 m spacing, x 232-250): the fix-5 row ran to x 270, and the
  // cover camera now sits at (272, 9) — a ped 3 m from the lens
  // would fill the frame. The north row keeps its full spread.
  // RECORDING 33 (user, 2026-11-24 10:24 IST): the 32b039ec cover
  // frame reads peds as WALKING ON WATER. The cover NPCs and the
  // stageCoverCrowd archetypes were moved to island 3, but this
  // south row (x 232-250, z 9-13) still stands on the quay slabs in
  // the water channel (x 230-250) and reads as on the teal water.
  // Moved BOTH rows to the NEAR side (island 3, x 250-270): south
  // row x 252-269.5, north row x 250-267.5 (2.5 m spacing, so no ped
  // sits 3 m from the lens). Cover branch only (stageCoverDensity
  // is cover).
  // REVISION (recapture 3): the south row at z 9-13, x 252-269.5
  // fell out of frame to the left (too far south for the camera's
  // west-northwest view), so the left side read empty. South row
  // moved to the sidewalk edge (x 250-257, z 6-8): island 3 tan
  // land, inside the frame's left edge, off the road. North row
  // unchanged (visible near the building).
  const pedSpots = [];
  for (let i = 0; i < 16; i++) {
    pedSpots.push({
      x: (i < 8 ? 250 : 250) + (i % 8) * (i < 8 ? 1.0 : 2.5),
      z: i < 8 ? 6 + (i % 3) * 1 : -9 - (i % 3) * 2,
      flee: i < 6,
    });
  }
  pedSpots.forEach((s, i) => {
    const p = g.peds.peds[i];
    if (!p) return;
    p.pos.set(s.x, 0, s.z);
    p.mesh.position.set(s.x, 0, s.z);
    // A ped staged here may have been knocked down during the run's
    // drives — reset the mesh upright, or it renders lying flat while
    // fleeing (the flee branch only sets rotation.y).
    p.mesh.rotation.set(0, p.heading, 0);
    p.mesh.position.y = 0;
    p.mesh.visible = true;
    if (s.flee) {
      p.state = 'flee';
      p.fleeT = 3;
    } else {
      p.state = 'walk';
      p.idle = 0;
    }
  });
  return countNear(game, 250, 0, 60);
}

// The yard fight: a dozen dock workers and bystanders in and around
// the aisle, most fleeing once the shots start.
export function stageYardDensity(game) {
  const g = game;
  const spots = [
    [378, -160], [382, -168], [386, -158], [394, -168], [398, -158],
    [402, -166], [406, -160], [410, -168], [376, -166], [388, -172],
    [396, -172], [404, -172],
  ];
  spots.forEach((s, i) => {
    const p = g.peds.peds[i];
    if (!p) return;
    p.pos.set(s[0], 0, s[1]);
    p.mesh.position.set(s[0], 0, s[1]);
    p.mesh.rotation.set(0, p.heading, 0);
    p.mesh.position.y = 0;
    p.mesh.visible = true;
    p.state = 'walk';
    p.idle = 0;
  });
  return countNear(game, 392, -162, 45);
}

// The waterfront pursuit: civilian traffic on Ocean Drive and a
// promenade crowd by the Bazaar Quay market stalls reacting to the
// chase. Modelled on stageCoverDensity / stageYardDensity: the same
// ped pool (35), the same flee staging (state 'flee', fleeT 3), the
// same upright/visible reset for peds knocked down earlier in the
// run. The 'pursuit' shot branch calls this by name.
// The hero drives east on Ocean Drive (z=108, north side) from (80,108)
// toward the market plaza (115,125); the stalls run x 70..140 at z=125,
// so the crowd stands on the promenade (z 116-121), south of the
// carriageway and on land — never on the road, never in the hero's path.
// The spots sit EAST of the chase camera (x ~112), so the fleeing peds
// read in the frame ahead of the hero, not behind the lens.
export function stagePursuitCrowd(game) {
  const g = game;
  // Six civilian cars pulled onto Ocean Drive near the pursuit.
  // placeNear keeps them driving on the lane graph; with stars up,
  // traffic.update flees them away from the player at 1.6x speed.
  const cars = g.traffic.placeNear(100, 110, 6);
  // Twelve pedestrians on the promenade: six bolt from the pursuit,
  // six keep walking.
  const pedSpots = [
    { x: 120, z: 117, flee: true },
    { x: 124, z: 119, flee: true },
    { x: 127, z: 116, flee: true },
    { x: 130, z: 120, flee: true },
    { x: 133, z: 117, flee: true },
    { x: 136, z: 119, flee: true },
    { x: 122, z: 120, flee: false },
    { x: 126, z: 118, flee: false },
    { x: 129, z: 121, flee: false },
    { x: 132, z: 116, flee: false },
    { x: 135, z: 121, flee: false },
    { x: 138, z: 118, flee: false },
  ];
  let stagedPeds = 0;
  let fleeing = 0;
  pedSpots.forEach((s, i) => {
    const p = g.peds.peds[i];
    if (!p) return;
    p.pos.set(s.x, 0, s.z);
    p.mesh.position.set(s.x, 0, s.z);
    // A ped staged here may have been knocked down during the run's
    // drives — reset the mesh upright, or it renders lying flat while
    // fleeing (the flee branch only sets rotation.y).
    p.mesh.rotation.set(0, p.heading, 0);
    p.mesh.position.y = 0;
    p.mesh.visible = true;
    if (s.flee) {
      p.state = 'flee';
      p.fleeT = 3;
      fleeing++;
    } else {
      p.state = 'walk';
      p.idle = 0;
    }
    stagedPeds++;
  });
  const d = countNear(game, 100, 112, 40);
  return { vehicles: d.vehicles, peds: d.peds, stagedCars: cars, stagedPeds, fleeing };
}

// Vehicles + pedestrians within radius r of (x, z): the state dump's
// density count. Counts traffic cars, police units, yard vehicles,
// the starter car and the player's car, plus every ped.
export function countNear(game, x, z, r) {
  const inR = (px, pz) => Math.hypot(px - x, pz - z) <= r;
  let vehicles = 0;
  const seen = new Set();
  const countCar = (c) => {
    if (!c || seen.has(c) || c.dead) return;
    seen.add(c);
    if (inR(c.pos.x, c.pos.z)) vehicles++;
  };
  for (const c of game.traffic.cars) countCar(c);
  for (const c of game.police.units) countCar(c);
  if (game.city.yardVehicles) for (const c of game.city.yardVehicles) countCar(c);
  countCar(game.starterCar);
  if (game.player.inCar) countCar(game.player.inCar);
  let peds = 0;
  for (const p of game.peds.peds) {
    if (inR(p.pos.x, p.pos.z)) peds++;
  }
  return { vehicles, peds };
}

// Park a traffic car on a road point (used by the export staging).
export function parkOnRoad(game, car, x, z, heading) {
  const near = nearestRoadPoint(x, z);
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.speed = 0;
  if (car.traffic) {
    car.traffic.edge = near.edge;
    car.traffic.t = near.t;
    car.traffic.side = 1;
    car.traffic.speed = 0;
    car.traffic.targetSpeed = 0;
  }
  car.syncMesh();
  return car;
}

export function roadPoint(x, z) {
  const near = nearestRoadPoint(x, z);
  return { edge: near.edge, t: near.t, x: near.x, z: near.z };
}

export function lanePointAt(edge, t, side) {
  return lanePoint(edge, t, side);
}

export function edgeHeadingOf(edge, side) {
  return edgeHeading(edge, side);
}
