// VERMILION KEYS — screenshot staging: ?shot=cover|foot|police|mission.
// Each shot composes a deterministic scene from the live engine (scripted
// entity placement + a fixed number of fixed-timestep ticks), positions
// the camera, then freezes the sim and raises window.__shotReady so the
// screenshot driver can capture a real render — never a composite.

import { Car } from '../entities/vehicle.js';
import { choice } from '../util.js';

function driveScript(game, throttle, steer, handbrake, ticks) {
  game.scriptedDrive = { throttle, steer, handbrake };
  for (let i = 0; i < ticks; i++) game.stepSim(1 / 60);
  game.scriptedDrive = null;
}

export function stageShot(kind, game) {
  const g = game;
  g.state = 'shot';
  g.audio.radioOn = true;
  g.audio.setRadio(0);

  if (kind === 'cover') {
    // THE LEAP: coral supercar airborne over the rising drawbridge,
    // helicopter searchlight cone diagonal, roadblock behind, full HUD.
    g.city.bridge.forceUp = true;
    g.missions.start(8);
    g.police.addHeat(80, 'cover staging');
    // Player's coral supercar on the east causeway approach, at speed.
    const car = new Car(g, 'sports', 0xff6a4a, 208, 0, Math.PI / 2);
    car.speed = 38;
    g.player.enterCar(car);
    g.player.pos.set(208, 0, 0);
    // Two roadblock cruisers braking behind the leap.
    for (const s of [-1, 1]) {
      const rb = new Car(g, 'sedan', 0xf2f2f2, 186, s * 3.4, Math.PI / 2, true);
      rb.unit = { name: 'ROADBLOCK', state: 'roadblock', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
      rb.speed = 26;
      g.police.units.push(rb);
    }
    // Extra traffic on the causeway for density.
    for (const x of [168, 152]) {
      const t = new Car(g, 'sedan', 0x3a7ad9, x, 3.4, Math.PI / 2);
      t.speed = 12;
      g.traffic.cars.push(t);
    }
    // Run the sim: the car climbs the ramp and launches. Freeze at apex.
    g.scriptedDrive = { throttle: 1, steer: 0, handbrake: false };
    let apex = false;
    for (let i = 0; i < 300; i++) {
      g.stepSim(1 / 60);
      if (car.airborne && car.vy < 0 && car.pos.y > 3) {
        apex = true;
        break;
      }
    }
    g.scriptedDrive = null;
    // Compose the camera from the frozen car: rear three-quarter, low,
    // bridge behind, skyline and ferris wheel ahead.
    const c = car.pos;
    g.cameraCtl.setShotPose([c.x - 17, c.y + 5.5, c.z - 12], [c.x + 10, c.y + 1, c.z + 2]);
    g.hud.showDialogue('Marco', 'SYNDICATE', 'The bridge is up — leap it, or the Keys eat you!');
    void apex;
  } else if (kind === 'foot') {
    // ON FOOT: boardwalk crowd, carjacking in progress.
    g.player.spawn(100, 122, Math.PI * 0.6);
    const target = new Car(g, 'sedan', 0xe8c93a, 104, 119, Math.PI * 0.5);
    target.speed = 0;
    g.traffic.cars.push(target);
    // A fleeing pedestrian and a busy crowd around the player.
    for (let i = 0; i < 10; i++) {
      const p = g.peds.peds[i];
      p.pos.set(96 + (i % 5) * 3.2, 0, 116 + Math.floor(i / 5) * 5);
      p.state = i === 0 ? 'flee' : 'walk';
      p.fleeT = 3;
    }
    for (let i = 0; i < 120; i++) g.stepSim(1 / 60);
    g.cameraCtl.setShotPose([93, 3.2, 110], [104, 1.4, 120]);
    g.hud.setPrompt('E — STEAL CAR');
    g.hud.showDialogue('Mira', 'DRIVER', 'That yellow sedan is unlocked. Take it — quick.');
  } else if (kind === 'police') {
    // 5-STAR CHASE: muscle car on Marina Blvd, cruisers in pursuit,
    // roadblock ahead, helicopter with the searchlight cone.
    g.missions.start(3);
    g.police.addHeat(100, 'police staging');
    const car = new Car(g, 'muscle', 0xe84a3a, 40, 0, Math.PI / 2);
    car.speed = 30;
    g.player.enterCar(car);
    g.player.pos.set(40, 0, 0);
    for (let i = 0; i < 4; i++) g.police.spawnUnit('cruiser');
    g.police.makeRoadblock();
    driveScript(g, 1, 0, false, 90);
    const c = car.pos;
    g.cameraCtl.setShotPose([c.x - 15, c.y + 5, c.z - 13], [c.x + 12, c.y + 1, c.z + 2]);
    g.hud.showDialogue('Kiki', 'LOOKOUT', 'Five stars and they are not backing off. Break line of sight!');
  } else if (kind === 'mission') {
    // DEPTH: street race at gate 3, rivals alongside, crew and cash live.
    g.missions.start(7);
    g.progression.addCash(4200);
    g.progression.addRespect(320);
    const car = new Car(g, 'sports', 0xff6a4a, 140, 0, Math.PI / 2);
    car.speed = 34;
    g.player.enterCar(car);
    g.player.pos.set(140, 0, 0);
    g.missions.active.gate = 2;
    // Three rival racers on the route.
    for (const [x, z, col] of [[128, 4.4, 0x3a7ad9], [132, -4.4, 0xe8c93a], [146, 4.4, 0x2ea88a]]) {
      const r = new Car(g, 'muscle', col, x, z, Math.PI / 2);
      r.speed = 32;
      g.traffic.cars.push(r);
    }
    driveScript(g, 1, 0, false, 45);
    const c = car.pos;
    g.cameraCtl.setShotPose([c.x - 13, c.y + 4.5, c.z - 11], [c.x + 10, c.y + 1, c.z + 1]);
    g.hud.showDialogue('Mira', 'DRIVER', 'Gate three of eight — stay on the boulevard, do not lift!');
  }

  // Freeze the world, render one settled frame, signal readiness.
  g.hud.update(0);
  g.renderer.render(g.scene, g.camera);
  window.__shotReady = true;
  window.__shotKind = kind;
}
