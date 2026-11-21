// VERMILION KEYS — player on foot: third-person walker, jump, carjack.
// The player is a simple low-poly figure; movement is relative to the
// camera yaw so WASD always feels like the screen's directions.

import * as THREE from 'three';
import { clamp } from '../util.js';

function limb(w, h, d, color) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.castShadow = true;
  return m;
}

export function makePlayerMesh() {
  const g = new THREE.Group();
  const shirt = 0x2ea88a;
  const skin = 0xc98a5a;
  const pants = 0x2a2a34;
  const body = limb(0.62, 0.78, 0.34, shirt);
  body.position.y = 1.12;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.78;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  hair.position.y = 1.82;
  g.add(hair);
  const armL = limb(0.18, 0.72, 0.18, shirt);
  armL.position.set(-0.42, 1.14, 0);
  const armR = limb(0.18, 0.72, 0.18, shirt);
  armR.position.set(0.42, 1.14, 0);
  const legL = limb(0.22, 0.78, 0.22, pants);
  legL.position.set(-0.16, 0.39, 0);
  const legR = limb(0.22, 0.78, 0.22, pants);
  legR.position.set(0.16, 0.39, 0);
  g.add(armL, armR, legL, legR);
  g.userData = { armL, armR, legL, legR };
  return g;
}

export class Player {
  constructor(game) {
    this.game = game;
    this.mesh = makePlayerMesh();
    this.pos = new THREE.Vector3(0, 0, 0);
    this.heading = 0;
    this.vy = 0;
    this.grounded = true;
    this.health = 100;
    this.armour = 0;
    this.inCar = null; // Car instance or null
    this.walkPhase = 0;
    this.dead = false;
    // FIX ROUND 3 — aim timer: combat.fire() sets this to 0.35 s; while
    // it is > 0 the right arm holds the aim pose (gun out, arm raised).
    this.aimT = 0;
    game.scene.add(this.mesh);
  }

  spawn(x, z, heading) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.health = 100;
    this.dead = false;
    this.inCar = null;
    this.mesh.visible = true;
    this.syncMesh();
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, this.heading, 0);
  }

  update(dt, input) {
    if (this.dead || this.inCar) return;
    const camYaw = this.game.cameraCtl.yaw;
    let mx = 0;
    let mz = 0;
    if (input.keys['KeyW'] || input.keys['ArrowUp']) mz += 1;
    if (input.keys['KeyS'] || input.keys['ArrowDown']) mz -= 1;
    if (input.keys['KeyA'] || input.keys['ArrowLeft']) mx -= 1;
    if (input.keys['KeyD'] || input.keys['ArrowRight']) mx += 1;
    const sprint = input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    const speed = sprint ? 7.2 : 4.2;
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      // Camera-relative: forward is -sin/cos of camYaw on the ground plane.
      const fx = -Math.sin(camYaw);
      const fz = -Math.cos(camYaw);
      const rx = -fz;
      const rz = fx;
      const wx = fx * mz + rx * mx;
      const wz = fz * mz + rz * mx;
      this.pos.x += wx * speed * dt;
      this.pos.z += wz * speed * dt;
      this.heading = Math.atan2(wx, wz);
      this.walkPhase += dt * speed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.55;
      this.mesh.userData.legL.rotation.x = swing;
      this.mesh.userData.legR.rotation.x = -swing;
      this.mesh.userData.armL.rotation.x = -swing * 0.8;
      this.mesh.userData.armR.rotation.x = swing * 0.8;
    } else {
      this.mesh.userData.legL.rotation.x *= 0.8;
      this.mesh.userData.legR.rotation.x *= 0.8;
      this.mesh.userData.armL.rotation.x *= 0.8;
      this.mesh.userData.armR.rotation.x *= 0.8;
    }
    // Jump + gravity.
    if (input.pressed('Space') && this.grounded) {
      this.vy = 6.5;
      this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= 20 * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }
    // Building collision (circle vs AABB).
    const r = 0.5;
    for (const c of this.game.city.colliders) {
      const cx = clamp(this.pos.x, c.x0, c.x1);
      const cz = clamp(this.pos.z, c.z0, c.z1);
      const dx = this.pos.x - cx;
      const dz = this.pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        this.pos.x += (dx / d) * (r - d);
        this.pos.z += (dz / d) * (r - d);
      }
    }
    // FIX ROUND 3 — aim pose (runs last, so it wins over the walk swing
    // and the idle decay): right arm raised FORWARD, gun out, while aimT
    // runs. Positive rotation.x swings the arm toward the player's front
    // (local +Z); the old -1.3 pointed it backward, behind the player.
    if (this.aimT > 0) {
      this.aimT -= dt;
      this.mesh.userData.armR.rotation.x = 1.3;
    }
    this.syncMesh();
  }

  enterCar(car) {
    this.inCar = car;
    this.mesh.visible = false;
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    this.inCar = null;
    // Step out on the car's right side: right = (-cos h, 0, sin h).
    this.pos.set(
      car.pos.x - Math.cos(car.heading) * 2.4,
      0,
      car.pos.z + Math.sin(car.heading) * 2.4,
    );
    this.heading = car.heading;
    this.mesh.visible = true;
    this.syncMesh();
  }

  damage(n) {
    if (this.dead) return;
    let rest = n;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, rest);
      this.armour -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    this.game.hud?.flash('hurt');
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(n) {
    this.health = Math.min(100, this.health + n);
  }
}
