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
  // A braked queue: three westbound cars behind the roadblock (north
  // lane, z=-2.2) and three eastbound cars on the far side (z=+2.2),
  // all stopped with brake lights on.
  const queue = [
    { x: 236, z: -2.2, h: -Math.PI / 2 },
    { x: 244, z: -2.2, h: -Math.PI / 2 },
    { x: 252, z: -2.2, h: -Math.PI / 2 },
    { x: 210, z: 2.2, h: Math.PI / 2 },
    { x: 218, z: 2.2, h: Math.PI / 2 },
    { x: 226, z: 2.2, h: Math.PI / 2 },
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
  const scooter = new Car(g, 'bike', 0xe8c93a, 240, -4.6, -Math.PI / 2);
  scooter.speed = 0;
  g.traffic.cars.push(scooter);
  // Sixteen pedestrians on the promenade / sidewalks by the bridge.
  const pedSpots = [];
  for (let i = 0; i < 16; i++) {
    pedSpots.push({
      x: 232 + (i % 8) * 5.5,
      z: i < 8 ? 9 + (i % 3) * 2 : -9 - (i % 3) * 2,
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
