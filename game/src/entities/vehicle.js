// VERMILION KEYS — vehicles: six classes, arcade physics, damage.
// A car is a kinematic body with a velocity vector: forward speed plus a
// lateral slide that decays, so handbrake turns feel like a drift. The
// drawbridge ramp can launch a car airborne; gravity brings it back down.

import * as THREE from 'three';
import { PALETTE, clamp } from '../util.js';
import { isLand } from '../world/roadNetwork.js';

export const VEHICLE_CLASSES = {
  compact: { name: 'Pinto', topSpeed: 28, accel: 13, grip: 1.0, len: 3.4, wid: 1.7, h: 1.35, hp: 70 },
  sedan: { name: 'Sedan', topSpeed: 32, accel: 14, grip: 1.0, len: 4.4, wid: 1.85, h: 1.4, hp: 90 },
  muscle: { name: 'Muscle', topSpeed: 36, accel: 15, grip: 0.92, len: 4.8, wid: 2.0, h: 1.35, hp: 110 },
  sports: { name: 'Comet GT', topSpeed: 43, accel: 18, grip: 1.05, len: 4.3, wid: 2.0, h: 1.15, hp: 80 },
  van: { name: 'Van', topSpeed: 26, accel: 11, grip: 0.95, len: 5.0, wid: 2.1, h: 2.1, hp: 130 },
  bike: { name: 'Bike', topSpeed: 38, accel: 17, grip: 1.15, len: 2.2, wid: 0.8, h: 1.1, hp: 40 },
};

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Build a low-poly car from boxes. Returns a Group; userData holds the
// wheels (for spin), the light bar (police) and the smoke anchor.
export function makeCarMesh(cls, color, police = false) {
  const def = VEHICLE_CLASSES[cls];
  const g = new THREE.Group();
  const L = def.len;
  const W = def.wid;
  const H = def.h;
  const body = box(L, H * 0.55, W, police ? PALETTE.policeWhite : color, 0, H * 0.32, 0);
  g.add(body);
  const cabinH = cls === 'van' ? H * 0.55 : H * 0.5;
  const cabinL = cls === 'bike' ? 0.5 : L * (cls === 'van' ? 0.62 : 0.48);
  const cabin = box(cabinL, cabinH, W * 0.86, police ? PALETTE.policeBlack : 0x1c2733, cls === 'van' ? -L * 0.08 : -L * 0.04, H * 0.6 + cabinH / 2, 0);
  g.add(cabin);
  if (cls === 'muscle' || cls === 'sports') {
    g.add(box(L * 0.16, 0.1, W * 0.9, 0x1a1a20, -L * 0.46, H * 0.62, 0)); // spoiler
  }
  if (cls === 'bike') {
    g.add(box(0.5, 0.5, 0.5, 0x222226, 0.1, H * 0.75, 0)); // rider torso
  }
  // Headlights / taillights.
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tl = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const s of [-1, 1]) {
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.4), hl);
    h1.position.set(L / 2, H * 0.35, s * W * 0.32);
    g.add(h1);
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.42), tl);
    t1.position.set(-L / 2, H * 0.35, s * W * 0.32);
    g.add(t1);
  }
  // Wheels.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14141a });
  const wx = cls === 'bike' ? [L * 0.32, -L * 0.32] : [L * 0.32, L * 0.32, -L * 0.32, -L * 0.32];
  const wz = cls === 'bike' ? [0, 0] : [W / 2, -W / 2, W / 2, -W / 2];
  for (let i = 0; i < wx.length; i++) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx[i], 0.36, wz[i]);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  let lightBar = null;
  if (police) {
    lightBar = new THREE.Group();
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    r.position.x = -0.28;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    b.position.x = 0.28;
    lightBar.add(r);
    lightBar.add(b);
    lightBar.position.set(-L * 0.04, H * 0.6 + cabinH + 0.1, 0);
    lightBar.userData = { r, b };
    g.add(lightBar);
    // Black doors + white body: add a black hood stripe.
    g.add(box(L * 0.5, 0.06, W * 0.98, PALETTE.policeBlack, L * 0.2, H * 0.62, 0));
  }
  g.userData = { wheels, lightBar, cls, def };
  return g;
}

export class Car {
  constructor(game, cls, color, x, z, heading, police = false) {
    this.game = game;
    this.cls = cls;
    this.def = VEHICLE_CLASSES[cls];
    this.color = color;
    this.police = police;
    this.mesh = makeCarMesh(cls, color, police);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.vy = 0;
    this.airborne = false;
    this.slide = new THREE.Vector3();
    this.steer = 0;
    this.hp = this.def.hp;
    this.dead = false;
    this.smoke = 0;
    this.onFire = false;
    this.tireDamage = 0; // seconds of spike-strip damage left
    this.driver = null; // pedestrian who drives it, if any
    this.syncMesh();
    game.scene.add(this.mesh);
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, this.heading, 0);
    const spin = this.speed * 0.06;
    for (const w of this.mesh.userData.wheels) w.rotation.y += spin;
  }

  // Arcade step. input: {throttle (-1..1), steer (-1..1), handbrake} or null.
  update(dt, input) {
    if (this.dead) return;
    const def = this.def;
    const top = def.topSpeed * (this.tireDamage > 0 ? 0.45 : 1);
    if (this.tireDamage > 0) this.tireDamage -= dt;
    if (input) {
      const accel = input.throttle > 0 ? def.accel : def.accel * 0.85;
      this.speed += input.throttle * accel * dt;
      if (input.throttle === 0) this.speed *= Math.max(0, 1 - 0.6 * dt);
      if (this.speed > top) this.speed = top;
      if (this.speed < -top * 0.45) this.speed = -top * 0.45;
      const steerAuthority = clamp(Math.abs(this.speed) / 10, 0, 1) * (this.speed >= 0 ? 1 : -1);
      const steerRate = (input.handbrake ? 2.6 : 1.7) * def.grip;
      this.heading += input.steer * steerRate * steerAuthority * dt;
      if (input.handbrake) {
        // Slide: keep some old lateral velocity, bleed speed a little.
        const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
        const lat = new THREE.Vector3().copy(this.slide);
        this.slide.addScaledVector(fwd, -this.speed * 0.25 * dt);
        this.slide.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
        this.speed *= Math.max(0, 1 - 0.25 * dt);
        void lat;
      } else {
        this.slide.multiplyScalar(Math.max(0, 1 - 6 * dt));
      }
    } else {
      this.speed *= Math.max(0, 1 - 0.8 * dt);
      if (Math.abs(this.speed) < 0.1) this.speed = 0;
      this.slide.multiplyScalar(Math.max(0, 1 - 6 * dt));
    }
    const fwd = new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading));
    const vel = fwd.clone().multiplyScalar(this.speed).add(this.slide);
    this.pos.addScaledVector(vel, dt);

    // Ground: drawbridge ramp, gap (airborne), or flat ground.
    const ground = this.game.city.groundHeightAt(this.pos.x, this.pos.z);
    if (this.airborne) {
      this.vy -= 22 * dt;
      this.pos.y += this.vy * dt;
      const g = ground === -999 ? -999 : ground;
      if (g !== -999 && this.pos.y <= g) {
        this.pos.y = g;
        this.airborne = false;
        this.vy = 0;
        if (this.speed > 20) this.game.hud?.flash('land');
      }
    } else if (ground === -999) {
      // Drove off the drawbridge lip: keep the ramp's upward velocity.
      this.airborne = true;
      this.vy = Math.max(4, this.speed * 0.45);
    } else if (ground > 0) {
      // On the ramp: climb it; leaving the lip at speed launches.
      const wasY = this.pos.y;
      this.pos.y = ground;
      if (ground - wasY > 0.12 && this.speed > 24) {
        this.airborne = true;
        this.vy = this.speed * 0.42;
      }
    } else {
      this.pos.y = 0;
    }

    // Stay on land: water slows and pushes back; deep water respawns.
    if (!isLand(this.pos.x, this.pos.z)) {
      this.speed *= Math.max(0, 1 - 2.5 * dt);
      const near = this.game.roads.nearestRoadPoint(this.pos.x, this.pos.z);
      if (near.dist > 26) {
        this.pos.set(near.x, 0, near.z);
        this.speed = 0;
        this.airborne = false;
        this.vy = 0;
      }
    }

    // Building collision: circle vs AABB push-out.
    const r = this.def.len / 2;
    for (const c of this.game.city.colliders) {
      const cx = clamp(this.pos.x, c.x0, c.x1);
      const cz = clamp(this.pos.z, c.z0, c.z1);
      const dx = this.pos.x - cx;
      const dz = this.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (r - d) / d;
        this.pos.x += dx * push;
        this.pos.z += dz * push;
        const impact = Math.abs(this.speed);
        if (impact > 12) this.damage(impact * 0.5, 'wall');
        this.speed *= 0.55;
      }
    }

    // Smoke / fire feedback.
    if (this.hp < 35 && this.hp > 0) this.smoke += dt;
    if (this.hp < 15 && this.hp > 0 && !this.onFire) {
      this.onFire = true;
      this.game.audio?.blip('fire');
    }
    this.syncMesh();
  }

  damage(n, _cause) {
    if (this.dead) return;
    this.hp -= n;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.game.audio?.boom();
      this.game.hud?.flash('boom');
    }
  }

  repair() {
    this.hp = this.def.hp;
    this.onFire = false;
    this.tireDamage = 0;
  }

  remove() {
    this.game.scene.remove(this.mesh);
  }
}
