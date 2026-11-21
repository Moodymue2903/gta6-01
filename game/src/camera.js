// VERMILION KEYS — camera: third-person follow with mouse orbit.
// Chase camera behind the car (wide, low, speed FOV kick); closer and
// higher on foot. Mouse drag orbits; the camera never goes under the ground.

import * as THREE from 'three';
import { clamp, lerp } from './util.js';

export class CameraCtl {
  constructor(game) {
    this.game = game;
    this.yaw = Math.PI; // behind the player, looking east at start
    this.pitch = 0.32;
    this.dist = 9;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shotPose = null; // {pos, lookAt} for screenshot staging
    this.shake = 0;
  }

  update(dt, input) {
    const cam = this.game.camera;
    if (this.shotPose) {
      cam.position.copy(this.shotPose.pos);
      cam.lookAt(this.shotPose.lookAt);
      return;
    }
    if (input) {
      this.yaw -= input.mouseDX * 0.004;
      this.pitch = clamp(this.pitch + input.mouseDY * 0.003, -0.1, 0.9);
    }
    const player = this.game.player;
    const inCar = player.inCar;
    const target = inCar ? inCar.pos : player.pos;
    const speed = inCar ? Math.abs(inCar.speed) : 0;
    const wantDist = inCar ? 9.5 + speed * 0.06 : 5.6;
    const wantHeight = inCar ? 3.4 : 2.6;
    this.dist = lerp(this.dist, wantDist, 1 - Math.exp(-3 * dt));
    // Follow the target's heading when driving fast, else free orbit.
    if (inCar && speed > 6) {
      const targetYaw = inCar.heading + Math.PI;
      let d = (targetYaw - this.yaw) % (Math.PI * 2);
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * (1 - Math.exp(-1.6 * dt));
    }
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const ox = Math.sin(this.yaw) * cp * this.dist;
    const oz = Math.cos(this.yaw) * cp * this.dist;
    const oy = sp * this.dist + wantHeight * 0.4;
    const want = new THREE.Vector3(target.x + ox, Math.max(1.2, target.y + oy), target.z + oz);
    this.pos.lerp(want, 1 - Math.exp(-8 * dt));
    const lookTarget = new THREE.Vector3(
      target.x + (inCar ? Math.sin(inCar.heading) * 6 : 0),
      target.y + 1.6,
      target.z + (inCar ? Math.cos(inCar.heading) * 6 : 0),
    );
    this.look.lerp(lookTarget, 1 - Math.exp(-10 * dt));
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.2);
      this.pos.x += (Math.random() - 0.5) * this.shake * 0.5;
      this.pos.y += (Math.random() - 0.5) * this.shake * 0.4;
    }
    cam.position.copy(this.pos);
    cam.lookAt(this.look);
    const targetFov = inCar ? 62 + clamp(speed / 43, 0, 1) * 12 : 60;
    if (Math.abs(cam.fov - targetFov) > 0.1) {
      cam.fov = lerp(cam.fov, targetFov, 1 - Math.exp(-4 * dt));
      cam.updateProjectionMatrix();
    }
  }

  addShake(n) {
    this.shake = Math.min(1.2, this.shake + n);
  }

  setShotPose(pos, lookAt) {
    this.shotPose = { pos: new THREE.Vector3(...pos), lookAt: new THREE.Vector3(...lookAt) };
  }
}
