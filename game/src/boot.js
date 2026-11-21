// VERMILION KEYS — boot: renderer, wiring, fixed-60 Hz loop, state machine.
// States: title -> playing <-> paused, dead, busted, shot (screenshot mode),
// career, garage. One-shot keys are handled once per rendered frame (never
// inside the sim steps, so a press can never fire twice in one frame).

import * as THREE from 'three';
import { mulberry32, clamp } from './util.js';
import { buildCity } from './world/city.js';
import { GRAPH, isLand, nearestRoadPoint } from './world/roadNetwork.js';
import { buildLighting } from './world/lighting.js';
import { Player } from './entities/player.js';
import { Car } from './entities/vehicle.js';
import { Traffic } from './entities/traffic.js';
import { Pedestrians } from './entities/pedestrian.js';
import { Police } from './entities/police.js';
import { MissionSystem } from './systems/missions.js';
import { Combat } from './systems/combat.js';
import { Progression } from './systems/progression.js';
import { AudioSys } from './systems/audio.js';
import { HUD } from './ui/hud.js';
import { Menus } from './ui/menus.js';
import { Input } from './input.js';
import { CameraCtl } from './camera.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;

function param(name) {
  return new URLSearchParams(window.location.search).get(name);
}

window.addEventListener('error', (e) => {
  const d = document.getElementById('err');
  if (d) d.textContent = 'ERROR: ' + e.message;
});

class Game {
  constructor() {
    this.state = 'title';
    this.time = 0;
    this.scriptedDrive = null;
    const seed = Number(param('seed') ?? 1) || 1;
    this.rng = mulberry32(seed);
    this.shotKind = param('shot');

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    // ACES filmic tone mapping: without it bright values clip to flat
    // orange and the mid-tones sit muddy. Exposure is the master
    // brightness knob (see threejs_visual_quality).
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2500);

    this.lighting = buildLighting(this.scene);
    this.city = buildCity(this.scene, this.rng);
    this.roads = { nearestRoadPoint };
    this.input = new Input();
    this.cameraCtl = new CameraCtl(this);
    this.player = new Player(this);
    this.traffic = new Traffic(this);
    this.peds = new Pedestrians(this);
    this.police = new Police(this);
    this.missions = new MissionSystem(this);
    this.combat = new Combat(this);
    this.progression = new Progression(this);
    this.audio = new AudioSys(this);
    this.hud = new HUD(this);
    this.menus = new Menus(this);

    // The player's own coral sports car, parked by the start point.
    const s = this.city.spots.playerStart;
    this.starterCar = new Car(this, 'sports', 0xff6a4a, s.x + 6, s.z + 4, Math.PI / 2);
    this.starterCar.owned = true;
    // FIX ROUND 3 (T7): restore the saved garage tune onto the player's
    // own car. Progression loads the save before this car exists, so the
    // tune can only be applied now — without it a bought upgrade vanished
    // on reload while cash and missions survived.
    this.progression.restoreTune();
    this.player.spawn(s.x, s.z, s.heading);

    // FIX ROUND 3 — the garage mechanic: a static ped who never leaves
    // the Motor Works. Beside the pad (west side), facing the car.
    this.peds.spawnStatic(47.5, 128, Math.PI / 2);

    // Hero contact shadow: one dark ellipse on the surface below the
    // player (car or on foot). It grounds the hero, and on the cover
    // leap it is the proof the car is jumping a gap — the shadow sits on
    // the far leaf/road while the car is above the gap, so the height
    // reads as a jump instead of flight. Opacity fades with height.
    // FIX ROUND 2 (user feedback: the car read as flying, not leaping).
    this.heroBlob = new THREE.Mesh(
      new THREE.CircleGeometry(1, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthWrite: false }),
    );
    this.heroBlob.rotation.x = -Math.PI / 2;
    // Draw after the heli's searchlight pool (renderOrder 1-2): the pool
    // sits directly below the car on the cover, and without this the
    // additive pool washes the shadow out. The blob must read as a dark
    // ellipse ON the bright pool — the shadow that proves the leap.
    this.heroBlob.renderOrder = 5;
    this.scene.add(this.heroBlob);

    // Gold start beacon: the next job begins at the safehouse.
    const beaconGeo = new THREE.CylinderGeometry(2.4, 2.4, 30, 12, 1, true);
    this.startBeacon = new THREE.Mesh(
      beaconGeo,
      new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.startBeacon.position.set(60, 15, 138);
    this.scene.add(this.startBeacon);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
    window.addEventListener('pointerdown', () => this.audio.init(), { once: true });
    window.addEventListener('keydown', () => this.audio.resume(), { once: true });
  }

  // One fixed sim step. Drive input comes from the scripted override
  // (screenshot staging) or from the live keyboard.
  stepSim(dt) {
    this.time += dt;
    const input = this.input;
    const player = this.player;
    if (player.inCar) {
      const drive = this.scriptedDrive ?? input.driveInput();
      player.inCar.update(dt, drive);
      // FIX ROUND 3 — the career ledger counts real distance driven.
      this.progression.recordDistance(Math.abs(player.inCar.speed) * dt);
    } else {
      player.update(dt, input);
    }
    this.traffic.update(dt);
    this.peds.update(dt);
    this.police.update(dt);
    this.missions.update(dt);
    this.combat.update(dt, input);
    this.city.update(dt, this.time);
    this.audio.update(dt);
    const focus = player.inCar ? player.inCar.pos : player.pos;
    this.lighting.update(dt, this.time, focus);
    // Hero contact shadow under the player (car or on foot).
    const hero = player.inCar || player;
    const hx = hero.pos.x;
    const hz = hero.pos.z;
    const hg = this.city.groundHeightAt(hx, hz);
    const surfY = hg === -999 ? -1.4 : (isLand(hx, hz) ? Math.max(hg, 0) : -1.4);
    const hh = Math.max(0, hero.pos.y - surfY);
    this.heroBlob.position.set(hx, surfY + 0.06, hz);
    this.heroBlob.material.opacity = clamp(0.55 - hh * 0.04, 0.18, 0.55);
    if (player.inCar) {
      this.heroBlob.scale.set(player.inCar.def.len * 0.62, player.inCar.def.wid * 0.75, 1);
    } else {
      this.heroBlob.scale.set(0.9, 0.9, 1);
    }
    // Start beacon pulses while no job is active.
    const idle = !this.missions.active && (this.state === 'playing' || this.state === 'shot');
    this.startBeacon.visible = idle;
    if (idle) {
      this.startBeacon.rotation.y += dt;
      this.startBeacon.material.opacity = 0.32 + Math.sin(this.time * 3) * 0.12;
    }
    // Death / busted transitions.
    if (player.dead && this.state === 'playing') this.die();
  }

  driveInput() {
    return this.input.driveInput();
  }

  nearestCar(maxDist) {
    const p = this.player;
    const px = p.inCar ? p.inCar.pos.x : p.pos.x;
    const pz = p.inCar ? p.inCar.pos.z : p.pos.z;
    let best = null;
    let bestD = maxDist;
    const all = [this.starterCar, ...this.traffic.cars, ...this.police.units];
    for (const car of all) {
      if (!car || car.dead || car === p.inCar) continue;
      const d = Math.hypot(car.pos.x - px, car.pos.z - pz);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  enterNearestCar() {
    const car = this.nearestCar(4.5);
    if (!car) return false;
    if (car.police) return false; // never steal a police car
    if (this.traffic.cars.includes(car)) {
      this.traffic.steal(car);
      this.police.addHeat(25, 'carjacking');
      this.hud.showDialogue('Mira', 'DRIVER', 'Nice — that one is yours now. Lose the heat!');
      this.audio.blip('mission');
    }
    this.player.enterCar(car);
    return true;
  }

  startNextMission() {
    const next = [1, 2, 3, 4, 5, 6, 7, 8].find((id) => !this.progression.missionsDone.has(id));
    if (!next) return false;
    return this.missions.start(next);
  }

  startGame() {
    this.menus.hideTitle();
    this.state = 'playing';
    this.audio.init();
    this.audio.resume();
    this.hud.showDialogue('Mira', 'DRIVER', 'Welcome back to the Keys. Gold marker at the safehouse starts the next job.');
  }

  die() {
    this.state = 'dead';
    this.menus.showEnd('DOWN', 'The Keys got you. The hospital patches you up — for a price.');
    this.audio.blip('fail');
  }

  busted() {
    if (this.state !== 'playing') return;
    this.state = 'busted';
    this.progression.addCash(-200);
    this.menus.showEnd('CAUGHT', 'The VKPD booked you. Bail costs $200 — and the heat is off, for now.');
    this.audio.blip('fail');
  }

  respawn() {
    const h = this.city.spots.hospital;
    this.progression.addCash(-100);
    this.police.clearHeat();
    if (this.player.inCar) {
      this.player.inCar.remove();
      this.player.inCar = null;
    }
    this.player.spawn(h.x, h.z, 0);
    this.player.mesh.visible = true;
    this.menus.hideEnd();
    this.state = 'playing';
  }

  handleKeys() {
    const input = this.input;
    const st = this.state;
    if (st === 'title') {
      if (input.pressed('Enter') || input.pressed('NumpadEnter')) this.startGame();
      return;
    }
    if (st === 'dead' || st === 'busted') {
      if (input.pressed('Enter') || input.pressed('NumpadEnter')) this.respawn();
      return;
    }
    if (st === 'paused') {
      if (input.pressed('Escape') || input.pressed('Enter')) {
        this.state = 'playing';
        this.menus.hidePause();
      } else if (input.pressed('KeyR')) {
        this.missions.teardown();
        this.state = 'playing';
        this.menus.hidePause();
      } else if (input.pressed('KeyS')) {
        this.progression.save();
        this.state = 'title';
        this.menus.hidePause();
        this.menus.showTitle();
      }
      return;
    }
    // FIX ROUND 3 — career screen (T): the sim pauses, the renderer
    // keeps drawing behind the overlay.
    if (st === 'career') {
      if (input.pressed('KeyT') || input.pressed('Escape')) {
        this.state = 'playing';
        this.menus.hideCareer();
      }
      return;
    }
    // FIX ROUND 3 — garage screen (E at the garage): keys 1–5 buy.
    if (st === 'garage') {
      if (input.pressed('Escape')) {
        this.state = 'playing';
        this.menus.hideGarage();
      } else if (input.pressed('Digit1')) this.menus.garageBuy(0);
      else if (input.pressed('Digit2')) this.menus.garageBuy(1);
      else if (input.pressed('Digit3')) this.menus.garageBuy(2);
      else if (input.pressed('Digit4')) this.menus.garageBuy(3);
      else if (input.pressed('Digit5')) this.menus.garageBuy(4);
      return;
    }
    if (st !== 'playing') return;
    if (input.pressed('Escape')) {
      this.state = 'paused';
      this.menus.showPause();
      return;
    }
    // FIX ROUND 3 — T opens the career screen.
    if (input.pressed('KeyT')) {
      this.state = 'career';
      this.menus.showCareer();
      return;
    }
    if (input.pressed('KeyE')) {
      if (this.player.inCar) {
        this.player.exitCar();
      } else {
        const nearStart = Math.hypot(this.player.pos.x - 60, this.player.pos.z - 138) < 7;
        const nearGarage = Math.hypot(this.player.pos.x - 52, this.player.pos.z - 128) < 8;
        if (!this.missions.active && nearStart) {
          this.startNextMission();
        } else if (nearGarage) {
          // FIX ROUND 3 — E at the garage opens the Motor Works.
          this.state = 'garage';
          this.menus.showGarage();
        } else if (!this.enterNearestCar()) {
          // Nothing in reach.
        }
      }
    }
    if (input.pressed('KeyF') && !this.player.inCar) this.enterNearestCar();
    if (input.pressed('KeyM')) {
      const on = this.audio.toggleRadio();
      this.hud.showDialogue('RADIO', on ? 'ON' : 'OFF', on ? this.audio.stationName : 'Radio off.');
    }
    if (input.pressed('KeyN')) this.audio.setRadio(this.audio.station + 1);
    if (input.pressed('KeyZ')) this.progression.useCrew('mira');
    if (input.pressed('KeyX')) this.progression.useCrew('lo');
    if (input.pressed('KeyC')) this.progression.useCrew('kiki');
    if (input.pressed('Digit1')) this.combat.select(0);
    if (input.pressed('Digit2')) this.combat.select(1);
    if (input.pressed('Digit3')) this.combat.select(2);
    if (input.pressed('Digit4')) this.combat.select(3);
    // Interaction prompt.
    if (!this.player.inCar) {
      const car = this.nearestCar(4.5);
      const nearStart = Math.hypot(this.player.pos.x - 60, this.player.pos.z - 138) < 7;
      const nearGarage = Math.hypot(this.player.pos.x - 52, this.player.pos.z - 128) < 8;
      if (nearGarage) this.hud.setPrompt('E — GARAGE');
      else if (car) this.hud.setPrompt('E — STEAL ' + car.def.name.toUpperCase());
      else if (!this.missions.active && nearStart) this.hud.setPrompt('E — START JOB');
      else this.hud.setPrompt('');
    } else {
      this.hud.setPrompt('E — EXIT VEHICLE');
    }
  }
}

const game = new Game();
window.__game = game;

if (game.shotKind) {
  // Screenshot mode: stage the scene, freeze, render, signal readiness.
  game.state = 'shot';
  stageShot(game.shotKind, game);
  game.cameraCtl.update(0, game.input);
  game.renderer.render(game.scene, game.camera);
} else {
  game.menus.showTitle();
}

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.handleKeys();
  if (game.state === 'playing') {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      game.stepSim(STEP);
      acc -= STEP;
      n++;
    }
    if (n === 5) acc = 0;
  }
  game.cameraCtl.update(dt, game.input);
  game.hud.update(dt);
  game.renderer.render(game.scene, game.camera);
  game.input.endFrame();
}
requestAnimationFrame(frame);
