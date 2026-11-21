// VERMILION KEYS — boot: renderer, wiring, fixed-60 Hz loop, state machine.
// States: title -> playing <-> paused, dead, busted, shot (screenshot mode).
// One-shot keys are handled once per rendered frame (never inside the sim
// steps, so a press can never fire twice in one frame).

import * as THREE from 'three';
import { mulberry32 } from './util.js';
import { buildCity } from './world/city.js';
import { GRAPH, nearestRoadPoint } from './world/roadNetwork.js';
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
    this.player.spawn(s.x, s.z, s.heading);

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
    if (st !== 'playing') return;
    if (input.pressed('Escape')) {
      this.state = 'paused';
      this.menus.showPause();
      return;
    }
    if (input.pressed('KeyE')) {
      if (this.player.inCar) {
        this.player.exitCar();
      } else {
        const nearStart = Math.hypot(this.player.pos.x - 60, this.player.pos.z - 138) < 7;
        if (!this.missions.active && nearStart) {
          this.startNextMission();
        } else if (!this.enterNearestCar()) {
          // Near the garage: store the car you arrived in.
          const nearGarage = Math.hypot(this.player.pos.x - 52, this.player.pos.z - 128) < 8;
          if (nearGarage) this.hud.setPrompt('No car in reach — garage stores the car you drive in.');
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
      if (car) this.hud.setPrompt('E — STEAL ' + car.def.name.toUpperCase());
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
