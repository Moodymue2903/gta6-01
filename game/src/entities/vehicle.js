// VERMILION KEYS — vehicles: six classes, arcade physics, damage.
// A car is a kinematic body with a velocity vector: forward speed plus a
// lateral slide that decays, so handbrake turns feel like a drift. The
// drawbridge ramp can launch a car airborne; gravity brings it back down.
// FIX ROUND 3 — the garage is real: every car carries a tune
// (engine/armour/handling levels from VERMILION MOTOR WORKS) and its
// effective top speed, max condition and grip follow the tune. Respray
// repaints the live mesh. Jumps are measured and recorded.
// FIX ROUND 4 — the cabin glass carries a faint emissive glow now, so
// a car at dusk or neon night reads as a lit cabin, not a black block
// on wheels (the re-test faulted "vehicles mostly black blocks").
// FIX ROUND 5 — materials pass: no black roofs or glass anywhere. The
// cabin is a lighter two-tone shade of the body colour (not dark
// 0x1c2733), sports/muscle/sedan get a pale roof panel on top, the glass
// band is the shared tinted-glass material, and the head/taillights are
// the shared makeCarLights set — traffic lights the tails while braking.
// Stunt landings are timed now: the car's airtime is measured and a
// landing over a second in the air counts as a stunt (Stunt Ramps).

import * as THREE from 'three';
import { PALETTE, clamp } from '../util.js';
import { isLand } from '../world/roadNetwork.js';
import { tintedGlassMaterial, lighterShade, makeCarLights, addRoofPanel } from '../world/vehicleMaterials.js';
import { checkStuntLanding } from '../systems/activities/stuntJumps.js';

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
  const bodyMat = new THREE.MeshLambertMaterial({ color: police ? PALETTE.policeWhite : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, H * 0.55, W), bodyMat);
  body.position.set(0, H * 0.32, 0);
  body.castShadow = true;
  g.add(body);
  const cabinH = cls === 'van' ? H * 0.55 : H * 0.5;
  const cabinL = cls === 'bike' ? 0.5 : L * (cls === 'van' ? 0.62 : 0.48);
  // FIX ROUND 5 — two-tone roof: the cabin is a lighter shade of the
  // body colour, never dark glass. Police cars keep the black cabin.
  const cabinColor = police ? PALETTE.policeBlack : lighterShade(color, 0.22);
  const cabin = box(cabinL, cabinH, W * 0.86, cabinColor, cls === 'van' ? -L * 0.08 : -L * 0.04, H * 0.6 + cabinH / 2, 0);
  g.add(cabin);
  // FIX ROUND 5 — a pale roof panel on the cabin top for the painted
  // classes, so the car reads as painted metal from above.
  if (!police && (cls === 'sports' || cls === 'muscle' || cls === 'sedan')) {
    addRoofPanel(g, L, W, H, color);
  }
  if (cls === 'muscle' || cls === 'sports') {
    g.add(box(L * 0.16, 0.1, W * 0.9, 0x1a1a20, -L * 0.46, H * 0.62, 0)); // spoiler
  }
  // Two-tone paint (FIX ROUND 3): a lighter stripe down the hood and
  // roof so the car reads as painted, not one flat slab of colour.
  if (!police && (cls === 'sports' || cls === 'muscle' || cls === 'sedan')) {
    const stripeCol = new THREE.Color(color).offsetHSL(0, -0.05, 0.22).getHex();
    g.add(box(L * 0.62, 0.05, W * 0.34, stripeCol, L * 0.08, H * 0.6, 0));
  }
  // Side details so the flank reads as a car, not a flat slab: a glass
  // band on the cabin flanks (slightly wider than the cabin, so it reads
  // from the side), dark side skirts, a bright grille strip and a rear
  // bumper. FIX ROUND 2: the cover car read as a flat orange slab from
  // behind because the flank had no detail at all.
  // FIX ROUND 4: the glass band glows faintly (emissive), so the cabin
  // reads at dusk and neon night instead of going black with the cabin.
  // FIX ROUND 5: the band is the shared tinted-glass material.
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(cabinL * 0.82, cabinH * 0.52, W * 0.9),
    tintedGlassMaterial(),
  );
  glass.position.set(cls === 'van' ? -L * 0.08 : -L * 0.04, H * 0.6 + cabinH / 2, 0);
  glass.castShadow = true;
  g.add(glass);
  for (const s of [-1, 1]) {
    g.add(box(L * 0.92, 0.16, 0.06, 0x1a1a20, 0, H * 0.16, s * (W / 2 + 0.01))); // side skirt
  }
  g.add(box(0.1, 0.24, W * 0.78, 0xc8c8d0, L / 2 - 0.02, H * 0.3, 0)); // grille
  g.add(box(0.1, 0.2, W * 0.78, 0x2a2a30, -L / 2 + 0.02, H * 0.3, 0)); // rear bumper
  if (cls === 'bike') {
    g.add(box(0.5, 0.5, 0.5, 0x222226, 0.1, H * 0.75, 0)); // rider torso
  }
  // Headlights / taillights: the shared set, with brake-light tails
  // traffic can light while braking (FIX ROUND 5).
  makeCarLights(g, L, W, H);
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
  g.userData = { wheels, lightBar, cls, def, bodyMat };
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
    this.pitch = 0; // nose-up angle while airborne / on the ramp (the leap read)
    this.slide = new THREE.Vector3();
    this.steer = 0;
    this.hp = this.def.hp;
    this.dead = false;
    this.smoke = 0;
    this.onFire = false;
    this.tireDamage = 0; // seconds of spike-strip damage left
    this.driver = null; // pedestrian who drives it, if any
    // Garage tune: engine/armour/handling levels (0-3). Modest, capped.
    this.tune = { engine: 0, armour: 0, handling: 0 };
    this._airStart = null; // takeoff point, for the longest-jump ledger
    this._airT0 = null; // takeoff time, for the stunt airtime check
    this.syncMesh();
    game.scene.add(this.mesh);
  }

  // Effective stats with the garage tune applied.
  topSpeed() {
    return this.def.topSpeed * (1 + 0.08 * (this.tune.engine || 0));
  }

  maxHp() {
    return Math.round(this.def.hp * (1 + 0.25 * (this.tune.armour || 0)));
  }

  grip() {
    return this.def.grip * (1 + 0.1 * (this.tune.handling || 0));
  }

  // Respray: repaint the live mesh and remember the new colour.
  repaint(color) {
    this.color = color;
    const m = this.mesh.userData.bodyMat;
    if (m) m.color.setHex(color);
    const stripeCol = new THREE.Color(color).offsetHSL(0, -0.05, 0.22).getHex();
    // The stripe is child 3 of the group for sports/muscle/sedan.
    for (const child of this.mesh.children) {
      if (child.geometry?.parameters?.width === this.def.len * 0.62) {
        child.material.color.setHex(stripeCol);
      }
    }
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    // Yaw: the mesh's nose (+X local) must point along the travel
    // direction. dir = (sin h, 0, cos h), but +X under Ry(h) maps to
    // (cos h, 0, -sin h) — 90 deg off, so every car in the game drove
    // sideways (nose north/south while travelling east/west). That is
    // why the cover car always read as a flat slab: the south camera
    // saw its 2 m rear, never its 4.3 m flank. Ry(h - PI/2) maps +X
    // onto dir exactly. (SECOND FIX ROUND — root cause of the slab read.)
    // Euler order XYZ applies the Z rotation in the car's local frame
    // first, then the yaw: pitch tilts the nose up around the lateral
    // axis, exactly what a takeoff needs.
    this.mesh.rotation.set(0, this.heading - Math.PI / 2, this.pitch);
    const spin = this.speed * 0.06;
    // Spin the wheels about their axle (the group's lateral Z axis).
    // The old code spun them about Y (vertical) — a lazy Susan, not a roll.
    for (const w of this.mesh.userData.wheels) w.rotation.z += spin;
  }

  // Arcade step. input: {throttle (-1..1), steer (-1..1), handbrake} or null.
  update(dt, input) {
    if (this.dead) return;
    const def = this.def;
    const top = this.topSpeed() * (this.tireDamage > 0 ? 0.45 : 1);
    if (this.tireDamage > 0) this.tireDamage -= dt;
    if (input) {
      const accel = input.throttle > 0 ? def.accel : def.accel * 0.85;
      this.speed += input.throttle * accel * dt;
      if (input.throttle === 0) this.speed *= Math.max(0, 1 - 0.6 * dt);
      if (this.speed > top) this.speed = top;
      if (this.speed < -top * 0.45) this.speed = -top * 0.45;
      const steerAuthority = clamp(Math.abs(this.speed) / 10, 0, 1) * (this.speed >= 0 ? 1 : -1);
      const steerRate = (input.handbrake ? 2.6 : 1.7) * this.grip();
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
        // Longest jump: horizontal distance from takeoff to landing.
        // FIX ROUND 5 — stunt timing: the airtime is measured from
        // takeoff; a landing over a second in the air with real
        // distance counts as a stunt (the player's car only).
        if (this._airStart) {
          const jump = Math.hypot(this.pos.x - this._airStart.x, this.pos.z - this._airStart.z);
          if (jump > 4) this.game.progression?.recordJump(jump);
          if (this.game.player.inCar === this && this._airT0 !== null) {
            checkStuntLanding(this.game, this.game.time - this._airT0, jump);
          }
          this._airStart = null;
          this._airT0 = null;
        }
        if (this.speed > 20) this.game.hud?.flash('land');
      }
    } else if (ground === -999) {
      // Drove off the drawbridge lip: keep the ramp's upward velocity.
      this.airborne = true;
      this.vy = Math.max(4, this.speed * 0.45);
      this._airStart = { x: this.pos.x, z: this.pos.z };
      this._airT0 = this.game.time;
    } else if (ground > 0) {
      // On the ramp: climb it; launch near the tip at speed — the leap.
      this.pos.y = ground;
      if (ground > 3 && this.speed > 24) {
        this.airborne = true;
        this.vy = this.speed * 0.42;
        this._airStart = { x: this.pos.x, z: this.pos.z };
        this._airT0 = this.game.time;
      }
    } else if (this.pos.y > 0.01) {
      if (this.pos.y > 0.5 && this.speed > 10) {
        // Drove off a raised lip (drawbridge tip) at speed: go airborne
        // and keep flying instead of snapping down to the road.
        this.airborne = true;
        this.vy = Math.max(2, this.speed * 0.25);
        this._airStart = { x: this.pos.x, z: this.pos.z };
        this._airT0 = this.game.time;
      } else {
        this.pos.y = Math.max(0, this.pos.y - 8 * dt);
      }
    } else {
      this.pos.y = 0;
    }

    // Pitch: nose up on takeoff and while climbing the ramp, nose
    // slightly down on the way down. A level car mid-air reads as
    // flying, not jumping — the pitch is what sells the leap.
    if (this.airborne) this.pitch = clamp(this.vy * 0.025, -0.12, 0.32);
    else if (ground > 0.5) this.pitch = 0.3;
    else this.pitch = 0;

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
    this.hp = this.maxHp();
    this.onFire = false;
    this.tireDamage = 0;
  }

  remove() {
    this.game.scene.remove(this.mesh);
  }
}
