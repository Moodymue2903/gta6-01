// VERMILION KEYS — police: 5-star wanted system, dispatch, roadblocks,
// spike strips, SWAT vans and the helicopter with its searchlight cone.
// Heat rises with crime and only decays once no unit can see the player.

import * as THREE from 'three';
import { Car } from './vehicle.js';
import { choice, clamp, rand } from '../util.js';
import { edgeHeading, lanePoint, nearestRoadPoint } from '../world/roadNetwork.js';

const UNIT_NAMES = ['VKPD-07', 'VKPD-12', 'VKPD-19', 'VKPD-23', 'VKPD-31', 'VKPD-44', 'VKPD-52', 'VKPD-68', 'VKPD-71', 'VKPD-85'];
const MAX_UNITS = 8;

function makeHeliMesh() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2a2a34 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 2.2), bodyMat);
  body.castShadow = true;
  g.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.5, 0.5), bodyMat);
  tail.position.set(-4, 0.4, 0);
  g.add(tail);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.0, 2.0),
    new THREE.MeshLambertMaterial({ color: 0x9fd8dd, emissive: 0x224455 }),
  );
  glass.position.set(1.8, 0.2, 0);
  g.add(glass);
  const rotor = new THREE.Group();
  rotor.position.y = 1.1;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x1a1a20 }));
  rotor.add(blade);
  const blade2 = blade.clone();
  blade2.rotation.y = Math.PI / 2;
  rotor.add(blade2);
  g.add(rotor);
  // Searchlight cone: apex at the heli, base on the ground below the player.
  const coneGeo = new THREE.ConeGeometry(7, 46, 14, 1, true);
  coneGeo.translate(0, -23, 0);
  const cone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  cone.rotation.x = -Math.PI / 2;
  g.add(cone);
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(6.5, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  pool.rotation.x = -Math.PI / 2;
  g.add(pool);
  g.userData = { rotor, cone, pool };
  return g;
}

export class Police {
  constructor(game) {
    this.game = game;
    this.heat = 0;
    this.stars = 0;
    this.units = [];
    this.heli = null;
    this.heliAngle = 0;
    this.unseenTimer = 0;
    this.bustedTimer = 0;
    this.roadblock = null; // {x, z, strip, cars}
    this.swat = [];
    this._unitSeq = 0;
  }

  get wanted() {
    return this.stars > 0;
  }

  addHeat(n, _reason) {
    this.heat = clamp(this.heat + n, 0, 100);
    this.stars = this.heat <= 0 ? 0 : Math.min(5, Math.ceil(this.heat / 20));
  }

  clearHeat() {
    this.heat = 0;
    this.stars = 0;
  }

  spawnUnit(kind) {
    const player = this.game.player;
    const px = player.inCar ? player.inCar.pos.x : player.pos.x;
    const pz = player.inCar ? player.inCar.pos.z : player.pos.z;
    const near = nearestRoadPoint(px + rand(this.game.rng, -90, 90), pz + rand(this.game.rng, -90, 90));
    const side = this.game.rng() < 0.5 ? 1 : -1;
    const p = lanePoint(near.edge, near.t, side);
    const cls = kind === 'swat' ? 'van' : 'sedan';
    const car = new Car(this.game, cls, 0xf2f2f2, p.x, p.z, edgeHeading(near.edge, side), true);
    car.unit = {
      name: kind === 'swat' ? 'SWAT-' + (++this._unitSeq) : choice(this.game.rng, UNIT_NAMES),
      state: 'pursue',
      kind,
      blockTarget: null,
      ramCooldown: 0,
    };
    this.units.push(car);
    return car;
  }

  spawnHeli() {
    const mesh = makeHeliMesh();
    this.game.scene.add(mesh);
    this.heli = { mesh, angle: 0 };
    this.game.audio?.blip('heli');
  }

  despawnHeli() {
    if (!this.heli) return;
    this.game.scene.remove(this.heli.mesh);
    this.heli = null;
  }

  update(dt) {
    const player = this.game.player;
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    const pSpeed = player.inCar ? Math.abs(player.inCar.speed) : 0;

    // Desired force by stars.
    const wantCruisers = this.stars === 0 ? 0 : Math.min(MAX_UNITS, this.stars + 1);
    const wantSwat = this.stars >= 4 ? Math.min(2, this.stars - 3) : 0;
    const wantHeli = this.stars >= 4;
    while (this.units.filter((u) => u.unit.kind === 'cruiser').length < wantCruisers) this.spawnUnit('cruiser');
    while (this.units.filter((u) => u.unit.kind === 'swat').length < wantSwat) this.spawnUnit('swat');
    if (wantHeli && !this.heli) this.spawnHeli();
    if (!wantHeli && this.heli) this.despawnHeli();
    // Trim extra units when the heat falls.
    while (this.units.filter((u) => u.unit.kind === 'cruiser').length > wantCruisers) {
      const extra = this.units.find((u) => u.unit.kind === 'cruiser');
      this.removeUnit(extra);
    }
    while (this.units.filter((u) => u.unit.kind === 'swat').length > wantSwat) {
      const extra = this.units.find((u) => u.unit.kind === 'swat');
      this.removeUnit(extra);
    }

    // Heat decay: only when nobody can see the player for 12 s.
    let anyoneNear = false;
    for (const u of this.units) {
      if (Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z) < 110) anyoneNear = true;
    }
    if (this.heli) anyoneNear = true; // the searchlight never loses you
    if (anyoneNear) {
      this.unseenTimer = 0;
    } else {
      this.unseenTimer += dt;
      if (this.unseenTimer > 12 && this.heat > 0) {
        this.heat = Math.max(0, this.heat - 10 * dt);
        this.stars = this.heat <= 0 ? 0 : Math.min(5, Math.ceil(this.heat / 20));
      }
    }

    // Roadblocks at 3+ stars: two cruisers across the road ahead.
    if (this.stars >= 3 && !this.roadblock && pSpeed > 12) {
      this.makeRoadblock();
    }
    if (this.roadblock) {
      const rb = this.roadblock;
      rb.timer -= dt;
      if (rb.timer <= 0 || Math.hypot(rb.x - pPos.x, rb.z - pPos.z) > 220) {
        this.clearRoadblock();
      }
    }

    // Unit AI.
    for (const u of [...this.units]) {
      if (u.dead) {
        this.removeUnit(u);
        continue;
      }
      const d = Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z);
      const unit = u.unit;
      unit.ramCooldown = Math.max(0, unit.ramCooldown - dt);
      let throttle = 0;
      let steer = 0;
      if (unit.state === 'roadblock') {
        // Parked across the road: hold position.
        throttle = 0;
        steer = 0;
        u.speed *= Math.max(0, 1 - 4 * dt);
      } else {
        // Pursue: steer toward the player, ram when close.
        const wantHeading = Math.atan2(pPos.x - u.pos.x, pPos.z - u.pos.z);
        let dh = (wantHeading - u.heading) % (Math.PI * 2);
        if (dh > Math.PI) dh -= Math.PI * 2;
        if (dh < -Math.PI) dh += Math.PI * 2;
        steer = clamp(dh * 1.8, -1, 1);
        throttle = d > 6 ? 1 : 0.7;
        if (this.stars >= 3 && unit.state !== 'block' && d > 40 && this.game.rng() < dt * 0.1) {
          unit.state = 'block';
          unit.blockTarget = { x: pPos.x, z: pPos.z };
        }
        if (unit.state === 'block') {
          // Cut ahead of the player and turn across the road.
          const bt = unit.blockTarget;
          const bd = Math.hypot(u.pos.x - bt.x, u.pos.z - bt.z);
          if (bd < 8) {
            unit.state = 'roadblock';
            u.heading += Math.PI / 2;
          } else {
            const bh = Math.atan2(bt.x - u.pos.x, bt.z - u.pos.z);
            let bh2 = (bh - u.heading) % (Math.PI * 2);
            if (bh2 > Math.PI) bh2 -= Math.PI * 2;
            if (bh2 < -Math.PI) bh2 += Math.PI * 2;
            steer = clamp(bh2 * 1.8, -1, 1);
            throttle = 1;
          }
        }
        // Ram: on contact, damage the player's car and shake the camera.
        if (d < 3.4 && unit.ramCooldown <= 0) {
          unit.ramCooldown = 1.2;
          if (player.inCar) {
            player.inCar.damage(6, 'ram');
            this.game.cameraCtl.addShake(0.5);
            this.game.audio?.blip('crash');
          } else {
            player.damage(12);
          }
        }
      }
      // Flash the light bar.
      const lb = u.mesh.userData.lightBar;
      if (lb) {
        const on = Math.floor(this.game.time * 6) % 2 === 0;
        lb.userData.r.material.color.setHex(on ? 0xff2222 : 0x551111);
        lb.userData.b.material.color.setHex(on ? 0x111155 : 0x2244ff);
      }
      u.update(dt, { throttle, steer, handbrake: false });
      // Unit-to-unit separation so cruisers do not pile up.
      for (const o of this.units) {
        if (o === u) continue;
        const ox = u.pos.x - o.pos.x;
        const oz = u.pos.z - o.pos.z;
        const od = Math.hypot(ox, oz);
        if (od > 0.01 && od < 4) {
          u.pos.x += (ox / od) * (4 - od) * 0.5;
          u.pos.z += (oz / od) * (4 - od) * 0.5;
        }
      }
    }

    // Helicopter: orbit the player, searchlight cone on them.
    if (this.heli) {
      const h = this.heli;
      h.angle += dt * 0.45;
      const hx = pPos.x + Math.cos(h.angle) * 26;
      const hz = pPos.z + Math.sin(h.angle) * 26;
      h.mesh.position.set(hx, 44, hz);
      h.mesh.lookAt(pPos.x, 0, pPos.z);
      h.mesh.userData.rotor.rotation.y += dt * 22;
      h.mesh.userData.pool.position.set(pPos.x - hx, -44 + 0.15, pPos.z - hz);
      h.mesh.userData.pool.rotation.set(0, 0, 0);
      h.mesh.userData.pool.lookAt(0, 1, 0);
    }

    // Busted: caught on foot, or boxed in while stopped in a car.
    let busted = false;
    if (!player.inCar && !player.dead) {
      for (const u of this.units) {
        if (Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z) < 3.2) busted = true;
      }
    }
    if (player.inCar && pSpeed < 1.5 && this.stars >= 2) {
      let near = 0;
      for (const u of this.units) {
        if (Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z) < 6) near++;
      }
      if (near >= 2) busted = true;
    }
    if (busted) {
      this.bustedTimer += dt;
      if (this.bustedTimer > 2.2) this.game.busted();
    } else {
      this.bustedTimer = 0;
    }
  }

  makeRoadblock() {
    const player = this.game.player;
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    const heading = player.inCar ? player.inCar.heading : player.heading;
    const ahead = 55;
    const bx = pPos.x + Math.sin(heading) * ahead;
    const bz = pPos.z + Math.cos(heading) * ahead;
    const near = nearestRoadPoint(bx, bz);
    // Park the two cruisers across the road: offset along the road's
    // perpendicular (-cos h, sin h) on either side of the centreline.
    const px = -Math.cos(heading);
    const pz = Math.sin(heading);
    const cars = [];
    for (const s of [-1, 1]) {
      const car = new Car(this.game, 'sedan', 0xf2f2f2, near.x + px * 3.4 * s, near.z + pz * 3.4 * s, heading + Math.PI / 2, true);
      car.unit = { name: 'ROADBLOCK', state: 'roadblock', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
      this.units.push(car);
      cars.push(car);
    }
    // Spike strip across the road just before the block.
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(9, 0.25, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
    );
    strip.position.set(near.x - Math.sin(heading) * 12, 0.15, near.z - Math.cos(heading) * 12);
    strip.rotation.y = heading;
    this.game.scene.add(strip);
    this.roadblock = { x: near.x, z: near.z, strip, cars, timer: 25, heading };
  }

  clearRoadblock() {
    if (!this.roadblock) return;
    this.game.scene.remove(this.roadblock.strip);
    for (const car of this.roadblock.cars) {
      const i = this.units.indexOf(car);
      if (i >= 0) this.units.splice(i, 1);
      car.remove();
    }
    this.roadblock = null;
  }

  removeUnit(car) {
    const i = this.units.indexOf(car);
    if (i >= 0) this.units.splice(i, 1);
    car.remove();
  }

  // Roster for the HUD: name, distance, state.
  roster() {
    const player = this.game.player;
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    return this.units.map((u) => ({
      name: u.unit.name,
      dist: Math.round(Math.hypot(u.pos.x - pPos.x, u.pos.z - pPos.z)),
      state: u.unit.state === 'roadblock' ? 'ROADBLOCK' : u.unit.state === 'block' ? 'FLANKING' : u.unit.kind === 'swat' ? 'SWAT' : 'RAMMING',
    }));
  }
}
