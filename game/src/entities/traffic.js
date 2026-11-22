// VERMILION KEYS — traffic: 20 civilian cars on the lane graph.
// Each car follows one edge at a time, yields to the car ahead, and flees
// from the player while wanted. Cars far from the player respawn near them
// so the streets always feel alive.
// FIX ROUND 3 — traffic that brakes: a car stops for the player on foot
// in front of it (gta7), instead of driving through them. And the shot
// director can pull cars in close for a dense street (placeNear).
// FIX ROUND 4 — no near-black cars: the re-test faulted "vehicles mostly
// black blocks". The 0x222226 slot is a mid grey now, so every traffic
// car reads as painted metal in every preset.
// FIX ROUND 5 — brake lights are real: a car lights its tails whenever
// it is braking (stopped for the player, yielding, or held at target
// speed zero), so a braked queue reads as a queue. Scooters (bikes) join
// the traffic pool for variety.

import { Car, VEHICLE_CLASSES } from './vehicle.js';
import { choice, rand } from '../util.js';
import { edgeHeading, lanePoint, nearestRoadPoint, pickNextEdge, randomEdge } from '../world/roadNetwork.js';
import { setBraking } from '../world/vehicleMaterials.js';

const TRAFFIC_CLASSES = ['compact', 'sedan', 'sedan', 'muscle', 'van', 'compact', 'bike'];
const COUNT = 20;

export class Traffic {
  constructor(game) {
    this.game = game;
    this.cars = [];
    for (let i = 0; i < COUNT; i++) {
      this.cars.push(this.spawnCar(game.rng, true));
    }
  }

  spawnCar(rng, anywhere) {
    const e = randomEdge(rng);
    const side = rng() < 0.5 ? 1 : -1;
    const t = rng();
    const p = lanePoint(e, t, side);
    const cls = choice(rng, TRAFFIC_CLASSES);
    const color = choice(rng, [0xe84a3a, 0x3a7ad9, 0xe8c93a, 0x2ea88a, 0xd97bd9, 0xe8e8e8, 0x4a4a58, 0xd97b2e]);
    const car = new Car(this.game, cls, color, p.x, p.z, edgeHeading(e, side));
    car.traffic = { edge: e, t, side, speed: rand(rng, 7, 12), targetSpeed: rand(rng, 8, 13) };
    return car;
  }

  // Pull n cars onto the roads near (x, z) for a dense shot street.
  placeNear(x, z, n) {
    let placed = 0;
    for (const car of this.cars) {
      if (placed >= n) break;
      const near = nearestRoadPoint(x + (this.game.rng() - 0.5) * 70, z + (this.game.rng() - 0.5) * 70);
      const side = this.game.rng() < 0.5 ? 1 : -1;
      const p = lanePoint(near.edge, near.t, side);
      car.pos.set(p.x, 0, p.z);
      car.traffic.edge = near.edge;
      car.traffic.t = near.t;
      car.traffic.side = side;
      car.traffic.speed = rand(this.game.rng, 4, 9);
      car.traffic.targetSpeed = rand(this.game.rng, 6, 10);
      car.heading = edgeHeading(near.edge, side);
      car.syncMesh();
      placed++;
    }
    return placed;
  }

  // A traffic car the player steals leaves the traffic pool.
  steal(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    delete car.traffic;
    return car;
  }

  update(dt) {
    const player = this.game.player;
    const px = player.inCar ? player.inCar.pos.x : player.pos.x;
    const pz = player.inCar ? player.inCar.pos.z : player.pos.z;
    const wanted = this.game.police.stars > 0;
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      const tr = car.traffic;
      if (!tr) continue;
      // Flee: wanted cars drive faster and away from the player.
      let targetSpeed = tr.targetSpeed;
      if (wanted) {
        const d = Math.hypot(car.pos.x - px, car.pos.z - pz);
        if (d < 55) targetSpeed = tr.targetSpeed * 1.6;
      }
      // Brake for the player on foot in front of the car.
      if (!player.inCar) {
        const dx = px - car.pos.x;
        const dz = pz - car.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 12 && d > 0.5) {
          const fx = Math.sin(car.heading);
          const fz = Math.cos(car.heading);
          if (dx * fx + dz * fz > 0) targetSpeed = 0; // player ahead
        }
      }
      // Yield to the car ahead on the same edge and lane.
      let blocked = false;
      for (const other of this.cars) {
        if (other === car || !other.traffic) continue;
        if (other.traffic.edge !== tr.edge || other.traffic.side !== tr.side) continue;
        const ahead = tr.side > 0 ? other.traffic.t - tr.t : tr.t - other.traffic.t;
        if (ahead > 0 && ahead < 0.035) {
          blocked = true;
          break;
        }
      }
      if (blocked) targetSpeed = 0;
      // FIX ROUND 5 — brake lights: on whenever the car is braking
      // (stopped for the player, yielding, or held at speed zero).
      setBraking(car, targetSpeed === 0);
      tr.speed += (targetSpeed - tr.speed) * Math.min(1, dt * 1.5);
      tr.t += (tr.side > 0 ? 1 : -1) * (tr.speed * dt) / tr.edge.len;
      if (tr.t >= 1 || tr.t <= 0) {
        const nodeId = tr.t >= 1 ? tr.edge.b : tr.edge.a;
        const next = pickNextEdge(this.game.rng, nodeId, tr.edge.id);
        const fromNode = tr.t >= 1 ? tr.edge.b : tr.edge.a;
        const enteringFromA = next.a === fromNode;
        tr.edge = next;
        tr.side = enteringFromA ? 1 : -1;
        tr.t = enteringFromA ? 0 : 1;
      }
      const p = lanePoint(tr.edge, tr.t, tr.side);
      car.pos.x = p.x;
      car.pos.z = p.z;
      car.heading = edgeHeading(tr.edge, tr.side);
      car.speed = tr.speed;
      car.syncMesh();
      // Respawn far-away cars near the player.
      const d = Math.hypot(car.pos.x - px, car.pos.z - pz);
      if (d > 320) {
        const near = nearestRoadPoint(px + (this.game.rng() - 0.5) * 160, pz + (this.game.rng() - 0.5) * 160);
        const e2 = near.edge;
        const side2 = this.game.rng() < 0.5 ? 1 : -1;
        const p2 = lanePoint(e2, near.t, side2);
        car.pos.set(p2.x, 0, p2.z);
        tr.edge = e2;
        tr.t = near.t;
        tr.side = side2;
        car.heading = edgeHeading(e2, side2);
        car.syncMesh();
      }
    }
    // Top the pool back up after thefts.
    while (this.cars.length < COUNT) {
      this.cars.push(this.spawnCar(this.game.rng, true));
    }
  }
}
