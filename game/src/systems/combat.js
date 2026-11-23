// VERMILION KEYS — combat: four weapons, hitscan fire.
// Fire is a ray from the camera through the crosshair against simple
// sphere targets (cars, peds, police units). Tracers and muzzle flash
// are cheap meshes that fade in just over a tenth of a second.
// FIX ROUND 3 — combat you can see: a real muzzle-flash point light,
// impact sparks at the hit point, tracers that live 0.12 s (long enough
// to survive a screenshot freeze), civilians who panic at the shots,
// and every shot is a crime a witness can report.
// FIX ROUND 4 — the flash is a small ROUND disc now (CircleGeometry),
// not a square plane: at 2 m from the camera the old 0.5 m plane read
// as a giant white square covering the player. Tracers are thicker
// (r=0.07) and brighter so the burst reads at small size.
// FIX ROUND 4b — the muzzle moved from 2 m ahead of the camera to the
// shooter's gun: the fix-4 muzzle sat ~2 m from the lens (the camera
// is 6-9 m behind the player in third person), so the disc still
// filled the frame as a giant white blob and the tracer as a white
// wedge. At the gun the same disc reads as a flash, ~30 px.
// FIX ROUND 5 — the weapon wheel is gone (the HUD shows one weapon
// chip only; weapons switch on keys 1-4 directly), and every shot
// kill is counted on the combat system so the state dump can read it.

import * as THREE from 'three';
import { getRigMuzzle } from '../look/characterRig.js';

export const WEAPONS = [
  { id: 'fists', name: 'FISTS', dmg: 20, range: 2.4, rate: 2.2, auto: false, ammo: Infinity, mag: Infinity },
  { id: 'pistol', name: 'VESPER', dmg: 26, range: 70, rate: 3.2, auto: false, ammo: 72, mag: 12 },
  { id: 'smg', name: 'MAKO', dmg: 13, range: 55, rate: 9, auto: true, ammo: 180, mag: 30 },
  { id: 'shotgun', name: 'BREAKER', dmg: 9, pellets: 6, range: 26, rate: 1.1, auto: false, ammo: 36, mag: 6 },
];

export class Combat {
  constructor(game) {
    this.game = game;
    this.weapon = 0;
    this.ammo = WEAPONS.map((w) => w.ammo);
    this.inMag = WEAPONS.map((w) => w.mag);
    this.cooldown = 0;
    this.reloadT = 0;
    this.tracers = [];
    this.sparks = [];
    this.aimTarget = null;
    this.kills = 0; // peds knocked down by shots (the fight's body count)
    // Muzzle flash disc at the shooter's gun. FIX ROUND 6 — the fix-4b
    // disc (r=0.22) read as a ~30 px star at full size and vanished at
    // sheet scale. At r=0.5 the flash is a real bloom at the gun, and
    // its light is stronger so the shooter's hands and the street
    // catch it for the frozen frame.
    this.flash = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 12),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.flash.visible = false;
    game.scene.add(this.flash);
    // Muzzle-flash point light: the flash lights the shooter's hands,
    // the cover and the street for a frame. Intensity 10, distance 16.
    this.flashLight = new THREE.PointLight(0xffe9a0, 0, 16);
    game.scene.add(this.flashLight);
  }

  select(i) {
    if (i < 0 || i >= WEAPONS.length) return;
    this.weapon = i;
    this.reloadT = 0;
    this.game.audio?.blip('switch');
  }

  startReload() {
    const w = WEAPONS[this.weapon];
    if (w.mag === Infinity || this.reloadT > 0) return;
    if (this.inMag[this.weapon] >= w.mag || this.ammo[this.weapon] <= 0) return;
    this.reloadT = 1.2;
    this.game.audio?.blip('reload');
  }

  update(dt, input) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadT > 0) {
      this.reloadT -= dt;
      if (this.reloadT <= 0) {
        const w = WEAPONS[this.weapon];
        const need = w.mag - this.inMag[this.weapon];
        const take = Math.min(need, this.ammo[this.weapon]);
        this.inMag[this.weapon] += take;
        this.ammo[this.weapon] -= take;
      }
    }
    // Weapons switch on keys 1-4 directly — unless the wheel is open,
    // when the keys only highlight a slot in the wheel (FIX ROUND 7).
    if (!this.game.weaponWheel?.open) {
      for (let i = 0; i < 4; i++) {
        if (input.pressed('Digit' + (i + 1))) this.select(i);
      }
    }
    if (input.pressed('KeyR')) this.startReload();
    // Lock-on: nearest shootable thing near the crosshair.
    this.aimTarget = this.pickAimTarget();
    // Fire on mouse click (or F while driving? no — mouse only).
    // FIX ROUND 7 — no firing while the weapon wheel is open: a click
    // while choosing a weapon must not shoot.
    const firing = input.mouseDown && !this.game.weaponWheel?.open && (WEAPONS[this.weapon].auto || input.pressedMouse);
    if (firing && this.cooldown <= 0 && this.reloadT <= 0) this.fire();
    // Fade tracers (FIX ROUND 6: 0.30 s, not 0.12 — a tracer that is
    // still near full opacity at the freeze reads at sheet size, and
    // each tracer fades against its own max life and base opacity so
    // the fat core and its glow halo fade together).
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, (t.baseOpacity || 0.95) * (t.life / t.maxLife));
      if (t.life <= 0) {
        this.game.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }
    // Fade impact sparks.
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.mesh.material.opacity = Math.max(0, s.life / 0.15);
      if (s.life <= 0) {
        this.game.scene.remove(s.mesh);
        this.sparks.splice(i, 1);
      }
    }
    if (this.flash.visible) {
      this.flash.material.opacity -= dt * 12;
      this.flashLight.intensity = Math.max(0, this.flashLight.intensity - dt * 48);
      if (this.flash.material.opacity <= 0) this.flash.visible = false;
    }
  }

  pickAimTarget() {
    const cam = this.game.camera;
    const origin = cam.position;
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    let best = null;
    let bestD = 60;
    const consider = (pos, radius, obj) => {
      const to = new THREE.Vector3().subVectors(pos, origin);
      const along = to.dot(dir);
      if (along < 1 || along > bestD) return;
      const perp = to.clone().addScaledVector(dir, -along);
      if (perp.length() < radius + along * 0.03) {
        bestD = along;
        best = obj;
      }
    };
    for (const car of [...this.game.traffic.cars, ...this.game.police.units]) {
      if (car.dead) continue;
      consider(new THREE.Vector3(car.pos.x, 1, car.pos.z), 2.6, { kind: 'car', car });
    }
    for (const p of this.game.peds.peds) {
      if (p.state === 'down') continue;
      consider(new THREE.Vector3(p.pos.x, 1.2, p.pos.z), 1.1, { kind: 'ped', ped: p });
    }
    for (const t of this.game.missions.active?.targets ?? []) {
      if (t.dead) continue;
      consider(new THREE.Vector3(t.pos.x, 1, t.pos.z), 2.6, { kind: 'car', car: t });
    }
    // Mission guards are shootable too (they are peds, covered above),
    // but the crosshair should prefer them at the market: they are the
    // fight. The ped loop already includes them.
    return best;
  }

  // Impact sparks: a fan of bright lines at the hit point, plus a
  // short-lived impact flash disc so the hit reads as a burst, not a
  // pinprick. FIX ROUND 6 — the fix-5 sparks were 6 short lines that
  // vanished at sheet scale: 14 longer lines and a real flash.
  spawnSparks(at) {
    const pts = [];
    const rng = this.game.rng;
    for (let i = 0; i < 14; i++) {
      const a = rng() * Math.PI * 2;
      const b = (rng() - 0.5) * 1.4;
      const len = 0.9 + rng() * 1.3;
      pts.push(at.x, at.y, at.z);
      pts.push(at.x + Math.cos(a) * len, at.y + b, at.z + Math.sin(a) * len);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xffd23a, transparent: true, opacity: 1 });
    const lines = new THREE.LineSegments(geo, mat);
    this.game.scene.add(lines);
    this.sparks.push({ mesh: lines, life: 0.15 });
    // Impact flash: a bright additive disc at the hit point, facing
    // the camera, fading with the sparks (same 0.15 s life so the
    // shared fade loop removes it).
    const burst = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 16),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    burst.position.copy(at);
    burst.lookAt(this.game.camera.position);
    this.game.scene.add(burst);
    this.sparks.push({ mesh: burst, life: 0.15 });
  }

  fire() {
    const w = WEAPONS[this.weapon];
    if (w.mag !== Infinity) {
      if (this.inMag[this.weapon] <= 0) {
        this.startReload();
        return;
      }
      this.inMag[this.weapon]--;
    }
    this.cooldown = 1 / w.rate;
    const cam = this.game.camera;
    const origin = cam.position.clone();
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    // Muzzle point: at the shooter's gun, NOT at the camera. FIX ROUND
    // 4 put the muzzle 2.0 m ahead of the camera — but in third person
    // the camera sits ~6-9 m behind the player, so the flash disc sat
    // ~2 m from the lens and subtended ~180 px: the giant white blob
    // that covered the player in the fix-4 combat frame, and the
    // tracer's near end was ~80 px wide (the white wedge). At the gun
    // (~9 m from the camera in the combat shot) the same disc is
    // ~30 px and the tracer reads as a line to the target. The aim
    // itself still comes from the camera ray (pickAimTarget / dir) —
    // only the visible muzzle moves to the gun.
    const shooterPos = this.game.player.inCar ? this.game.player.inCar.pos : this.game.player.pos;
    const muzzle = shooterPos.clone().addScaledVector(dir, 1.2);
    muzzle.y = shooterPos.y + (this.game.player.inCar ? 1.2 : 1.45);
    // FIX ROUND 8 — if the player mesh is a character rig, the muzzle
    // is the weapon's own muzzle, not a point 1.2 m ahead of the feet.
    const rigMuzzle = getRigMuzzle(this.game.player?.mesh);
    if (rigMuzzle) muzzle.copy(rigMuzzle);
    // Muzzle flash at the gun + its light.
    this.flash.position.copy(muzzle);
    this.flash.lookAt(origin.clone().addScaledVector(dir, 5));
    this.flash.material.opacity = 1.0;
    this.flash.visible = true;
    this.flashLight.position.copy(muzzle);
    this.flashLight.intensity = 10;
    // Aim pose: the player's right arm comes up while firing.
    if (this.game.player) this.game.player.aimT = 0.35;
    const target = this.aimTarget;
    const range = w.range;
    let end;
    const shooter = this.game.player.inCar ? this.game.player.inCar.pos : this.game.player.pos;
    if (target) {
      end = target.kind === 'car'
        ? new THREE.Vector3(target.car.pos.x, 1, target.car.pos.z)
        : new THREE.Vector3(target.ped.pos.x, 1.2, target.ped.pos.z);
      const pellets = w.pellets || 1;
      const totalDmg = w.dmg * pellets;
      if (target.kind === 'car') {
        target.car.damage(totalDmg, 'shot');
        if (target.car.police) this.game.police.addHeat(10, 'shot at police');
        else this.game.police.addHeat(8, 'shot fired');
      } else {
        this.game.peds.knockDown(target.ped, 'shot');
        this.kills++;
      }
      this.spawnSparks(end);
    } else {
      end = origin.clone().addScaledVector(dir, range);
      // A missed shot is heard but not attributed: with no witness the
      // police do not know it was the player, so no units are dispatched
      // (reported: false). The witness is what makes a shooting known —
      // that is the two-path design T3 tests. A hit is a visible crime
      // with a victim, so the car/ped heats below stay reported.
      this.game.police.addHeat(4, 'shot fired', { reported: false });
    }
    // Tracer: a fat additive cylinder from the muzzle to the hit point,
    // so it reads as a line at screenshot size (a 1 px THREE.Line does
    // not, and one from the camera origin is foreshortened to nothing).
    // FIX ROUND 6 — the fix-4 tracer (r=0.07) was a hairline at sheet
    // scale: the core is r=0.15 now with a soft r=0.30 glow halo around
    // it, and both live 0.30 s so the shot is still near full opacity
    // at the freeze.
    const toEnd = end.clone().sub(muzzle);
    const tLen = toEnd.length();
    const tracerDir = toEnd.clone().normalize();
    const tracer = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, tLen, 5, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    tracer.position.copy(muzzle).addScaledVector(toEnd, 0.5);
    tracer.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tracerDir);
    this.game.scene.add(tracer);
    this.tracers.push({ mesh: tracer, life: 0.3, maxLife: 0.3, baseOpacity: 0.95 });
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.3, tLen, 5, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffc23a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    glow.position.copy(tracer.position);
    glow.quaternion.copy(tracer.quaternion);
    this.game.scene.add(glow);
    this.tracers.push({ mesh: glow, life: 0.3, maxLife: 0.3, baseOpacity: 0.3 });
    // The world reacts: civilians bolt, and a witness may report the shots.
    this.game.peds.reactToGunfire(shooter.x, shooter.z);
    this.game.police.reportCrime(shooter.x, shooter.z, 'shots fired');
    this.game.audio?.shot(w.id);
    this.game.cameraCtl.addShake(w.id === 'shotgun' ? 0.35 : 0.12);
  }
}
