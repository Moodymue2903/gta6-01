// VERMILION KEYS — combat: four weapons, wheel, hitscan fire.
// Fire is a ray from the camera through the crosshair against simple
// sphere targets (cars, peds, police units). Tracers and muzzle flash
// are cheap meshes that fade in under a tenth of a second.

import * as THREE from 'three';
import { clamp } from '../util.js';

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
    this.wheelOpen = false;
    this.tracers = [];
    this.aimTarget = null;
    // Weapon wheel DOM (radial, shown while Q is held).
    this.wheelEl = document.createElement('div');
    this.wheelEl.id = 'weapon-wheel';
    this.wheelEl.innerHTML = WEAPONS.map((w, i) => `<div class="ww-slot" data-i="${i}"><b>${i + 1}</b><span>${w.name}</span></div>`).join('');
    document.getElementById('hud').appendChild(this.wheelEl);
    // Muzzle flash sprite at the camera.
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.flash.visible = false;
    game.scene.add(this.flash);
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
    // Wheel: hold Q, pick with 1-4 or click.
    const wantWheel = !!input.keys['KeyQ'];
    if (wantWheel !== this.wheelOpen) {
      this.wheelOpen = wantWheel;
      this.wheelEl.classList.toggle('open', wantWheel);
    }
    if (this.wheelOpen) {
      for (let i = 0; i < 4; i++) {
        if (input.pressed('Digit' + (i + 1))) this.select(i);
      }
    }
    if (input.pressed('KeyR')) this.startReload();
    // Lock-on: nearest shootable thing near the crosshair.
    this.aimTarget = this.pickAimTarget();
    // Fire on mouse click (or F while driving? no — mouse only).
    const firing = input.mouseDown && (WEAPONS[this.weapon].auto || input.pressedMouse);
    if (firing && this.cooldown <= 0 && this.reloadT <= 0) this.fire();
    // Fade tracers.
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.09);
      if (t.life <= 0) {
        this.game.scene.remove(t.mesh);
        this.tracers.splice(i, 1);
      }
    }
    if (this.flash.visible) {
      this.flash.material.opacity -= dt * 12;
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
    return best;
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
    // Muzzle flash at the bottom-right of the view.
    this.flash.position.copy(origin).addScaledVector(dir, 1.4);
    this.flash.position.y -= 0.25;
    this.flash.position.x += 0.25;
    this.flash.lookAt(origin.clone().addScaledVector(dir, 5));
    this.flash.material.opacity = 0.9;
    this.flash.visible = true;
    const target = this.aimTarget;
    const range = w.range;
    let end;
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
      }
    } else {
      end = origin.clone().addScaledVector(dir, range);
      this.game.police.addHeat(4, 'shot fired');
    }
    // Tracer line.
    const geo = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    this.game.scene.add(line);
    this.tracers.push({ mesh: line, life: 0.09 });
    this.game.audio?.shot(w.id);
    this.game.cameraCtl.addShake(w.id === 'shotgun' ? 0.35 : 0.12);
  }
}
