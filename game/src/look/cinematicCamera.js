// VERMILION KEYS -- cinematic camera (Fix Round 8, Builder B).
// Chase rig + over-the-shoulder combat camera + garage turntable.
// The cover rig is computed from the REAL sim pose every time: the
// car's position, heading and speed decide the camera, never a
// hand-posed guess. Cover: low rear three-quarter chase, locked to
// the car's heading, behind-RIGHT (ocean on the right, the car's
// right flank to the camera). Height ~2.0 m above the car's base,
// ~6.2 m behind, ~1.35 m to the right, FOV 62 deg base rising to
// ~70 at 155 km/h, pitch ~8 deg down, look-ahead 12 m, spring lag
// + slight vibration, no strong shake. Car 30-35% of frame width,
// centre-right. Police cruiser left foreground, second cruiser
// behind, heli upper-left, ship + cranes right, sunset horizon
// upper-middle. Roadside objects close to the lens (lamps every
// 24 m, palms every 18 m, lane dashes every 9 m) give speed parallax.
//
// Coordinate convention (from entities/vehicle.js): the car mesh
// nose is local +X, heading h gives travel dir (sin h, 0, cos h),
// and the car's RIGHT side is local -Z, which maps to world
// (cos h, 0, -sin h). The cover pose is sim-dependent (Builder A:
// ~x 239-242, y ~2-6, heading -PI/2+0.35, pitch 0.14, speed 43),
// so coverPose takes the live car and derives everything from it.

import * as THREE from 'three';
import { clamp, lerp } from '../util.js';

export function forwardOf(heading) {
  return new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
}

// The car's right side in world space (local -Z under Ry(h - PI/2)).
export function rightOf(heading) {
  return new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
}

export function coverPose(car) {
  const pos = car.pos;
  const heading = car.heading;
  const speed = Math.abs(car.speed || 0);
  const fwd = forwardOf(heading);
  const right = rightOf(heading);
  const camPos = new THREE.Vector3()
    .copy(pos)
    .addScaledVector(fwd, -6.2)
    .addScaledVector(right, 1.35);
  // Low: ~2.0 m above the car's base. When the hero is airborne
  // over the drawbridge gap the camera rises with it, so the car
  // stays centred instead of dropping out of frame.
  camPos.y = pos.y + 1.6;
  const lookAt = new THREE.Vector3()
    .copy(pos)
    .addScaledVector(fwd, 12);
  lookAt.y = pos.y + 0.6;
  // FOV 62 base -> ~70 at 155 km/h (43 m/s): the middle of the
  // two models' ranges (Gemini 62->68, ChatGPT 68-72).
  const fov = 62 + clamp(speed / 43, 0, 1) * 8;
  return { pos: camPos, lookAt, fov };
}

export function combatPose(player) {
  const pos = player.pos;
  const heading = player.heading;
  const fwd = forwardOf(heading);
  const right = rightOf(heading);
  const camPos = new THREE.Vector3()
    .copy(pos)
    .addScaledVector(fwd, -2.5)
    .addScaledVector(right, 0.6);
  camPos.y = pos.y + 1.6;
  const lookAt = new THREE.Vector3()
    .copy(pos)
    .addScaledVector(fwd, 20);
  lookAt.y = pos.y + 1.2;
  return { pos: camPos, lookAt, fov: 64 };
}

export function garagePose(car) {
  const pos = car.pos;
  // Turntable: ~4.4 m out, ~2.1 m up, on a three-quarter angle from
  // the car's heading, so the car fills at least 55% of the frame.
  const a = car.heading - 0.9;
  const camPos = new THREE.Vector3(
    pos.x + Math.sin(a) * 4.4,
    pos.y + 2.1,
    pos.z + Math.cos(a) * 4.4,
  );
  const lookAt = new THREE.Vector3(pos.x, pos.y + 0.9, pos.z);
  return { pos: camPos, lookAt, fov: 55 };
}

// Smoothed chase rig for live driving / the driving test: spring
// lag on position and look, a slight speed vibration, FOV kick.
// Shot staging uses coverPose directly (frozen pose, no smoothing).
export class ChaseRig {
  constructor() {
    this.smoothPos = new THREE.Vector3();
    this.smoothLook = new THREE.Vector3();
    this.ready = false;
    this.t = 0;
  }

  reset(car) {
    const p = coverPose(car);
    this.smoothPos.copy(p.pos);
    this.smoothLook.copy(p.lookAt);
    this.ready = true;
  }

  update(dt, car, camera) {
    const p = coverPose(car);
    if (!this.ready) this.reset(car);
    this.t += dt;
    const kPos = 1 - Math.exp(-6 * dt);
    const kLook = 1 - Math.exp(-9 * dt);
    this.smoothPos.lerp(p.pos, kPos);
    this.smoothLook.lerp(p.lookAt, kLook);
    const speedK = clamp(Math.abs(car.speed || 0) / 43, 0, 1);
    // Slight vibration only: 0.02 m at full speed, no strong shake.
    const vib = 0.02 * speedK;
    camera.position.set(
      this.smoothPos.x,
      this.smoothPos.y + Math.sin(this.t * 37) * vib,
      this.smoothPos.z,
    );
    camera.lookAt(this.smoothLook);
    const targetFov = p.fov;
    if (Math.abs(camera.fov - targetFov) > 0.1) {
      camera.fov = lerp(camera.fov, targetFov, 1 - Math.exp(-4 * dt));
      camera.updateProjectionMatrix();
    }
    return p;
  }
}
