// VERMILION KEYS — pedestrians: 35 walkers on the sidewalks.
// Walkers wander between sidewalk points, idle, and flee from the player
// when a crime happens nearby. A car hit knocks one down (and adds heat).

import * as THREE from 'three';
import { choice, rand } from '../util.js';
import { randomSidewalkPoint } from '../world/roadNetwork.js';

const COUNT = 35;
const SHIRTS = [0xe84a3a, 0x3a7ad9, 0xe8c93a, 0x2ea88a, 0xd97bd9, 0xe8e8e8, 0x222226, 0xd97b2e, 0x8a6a3a];

function makePedMesh(shirt) {
  const g = new THREE.Group();
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.72, 0.3), mat(shirt));
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), mat(0xc98a5a));
  head.position.y = 1.68;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), mat(0x2a2a34));
  legL.position.set(-0.14, 0.35, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  g.add(legL, legR);
  g.userData = { legL, legR, phase: Math.random() * 6 };
  return g;
}

export class Pedestrians {
  constructor(game) {
    this.game = game;
    this.peds = [];
    for (let i = 0; i < COUNT; i++) {
      const p = randomSidewalkPoint(game.rng, 0, 0, 400);
      this.peds.push(this.spawn(game.rng, p.x, p.z));
    }
  }

  spawn(rng, x, z) {
    const mesh = makePedMesh(choice(rng, SHIRTS));
    this.game.scene.add(mesh);
    return {
      mesh,
      pos: new THREE.Vector3(x, 0, z),
      heading: rand(rng, 0, Math.PI * 2),
      state: 'walk',
      target: randomSidewalkPoint(rng, x, z, 60),
      idle: rand(rng, 0, 2),
      speed: rand(rng, 1.1, 1.8),
      downTimer: 0,
    };
  }

  update(dt) {
    const player = this.game.player;
    const px = player.inCar ? player.inCar.pos.x : player.pos.x;
    const pz = player.inCar ? player.inCar.pos.z : player.pos.z;
    const playerSpeed = player.inCar ? Math.abs(player.inCar.speed) : 0;
    for (const p of this.peds) {
      if (p.state === 'down') {
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          // Get back up somewhere else and walk on.
          const spot = randomSidewalkPoint(this.game.rng, px, pz, 120);
          p.pos.set(spot.x, 0, spot.z);
          p.mesh.rotation.set(0, p.heading, 0);
          p.mesh.visible = true;
          p.state = 'walk';
          p.target = randomSidewalkPoint(this.game.rng, spot.x, spot.z, 60);
        }
        continue;
      }
      const dx = p.pos.x - px;
      const dz = p.pos.z - pz;
      const d = Math.hypot(dx, dz);
      // Flee a nearby crime or a fast car.
      if (p.state !== 'flee' && ((this.game.police.stars > 0 && d < 16) || (player.inCar && playerSpeed > 8 && d < 9))) {
        p.state = 'flee';
        p.fleeT = rand(this.game.rng, 2.5, 4.5);
      }
      if (p.state === 'flee') {
        p.fleeT -= dt;
        const run = 5.5;
        p.pos.x += (dx / (d || 1)) * run * dt;
        p.pos.z += (dz / (d || 1)) * run * dt;
        p.heading = Math.atan2(dx, dz);
        if (p.fleeT <= 0) p.state = 'walk';
      } else if (p.idle > 0) {
        p.idle -= dt;
      } else {
        const tx = p.target.x - p.pos.x;
        const tz = p.target.z - p.pos.z;
        const td = Math.hypot(tx, tz);
        if (td < 1.5) {
          p.target = randomSidewalkPoint(this.game.rng, p.pos.x, p.pos.z, 60);
          p.idle = rand(this.game.rng, 0.5, 3);
        } else {
          p.pos.x += (tx / td) * p.speed * dt;
          p.pos.z += (tz / td) * p.speed * dt;
          p.heading = Math.atan2(tx, tz);
          p.mesh.userData.phase += dt * p.speed * 4;
        }
      }
      // Hit by the player's car: knock down, add heat.
      if (player.inCar && playerSpeed > 3 && d < 1.9 && p.state !== 'down') {
        this.knockDown(p, 'car');
      }
      p.mesh.position.copy(p.pos);
      p.mesh.rotation.y = p.heading;
      if (p.state === 'walk' && p.idle <= 0) {
        const s = Math.sin(p.mesh.userData.phase) * 0.5;
        p.mesh.userData.legL.rotation.x = s;
        p.mesh.userData.legR.rotation.x = -s;
      }
    }
  }

  knockDown(p, cause) {
    p.state = 'down';
    p.downTimer = 6;
    p.mesh.rotation.set(Math.PI / 2 - 0.15, p.heading, 0);
    p.mesh.position.y = 0.35;
    if (cause === 'car') this.game.police.addHeat(30, 'pedestrian struck');
    if (cause === 'shot') this.game.police.addHeat(15, 'pedestrian shot');
    this.game.audio?.blip('thud');
  }

  // Nearest pedestrian within range of a point (for shooting).
  nearest(x, z, range) {
    let best = null;
    let bestD = range;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.pos.x - x, p.pos.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}
