// VERMILION KEYS — screenshot staging: ?shot=cover|foot|police|mission.
// Each shot composes a deterministic scene from the live engine (scripted
// entity placement + a fixed number of fixed-timestep ticks), positions
// the camera, then freezes the sim and raises window.__shotReady so the
// screenshot driver can capture a real render — never a composite.

import { Car } from './entities/vehicle.js';
import { choice } from './util.js';

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
    // THE LEAP, westbound into the sunset: coral supercar airborne over
    // the raised drawbridge, helicopter searchlight cone diagonal across
    // the frame, roadblock behind, full HUD.
    g.city.bridge.forceUp = true;
    g.missions.start(8);
    // FIX ROUND: the first cover showed $250 / ROOKIE 0/100 on a JOB 8/8
    // frame — inconsistent. Stage it mid/late-game like #5's cover
    // ($3,800, STAGE 4/5): $4,450, BAGMAN 320/450.
    g.progression.addCash(4200);
    g.progression.addRespect(320);
    // FIX ROUND: heat 80 (4 stars, 6 units) -> 95 (5 stars, 8 units +
    // heli). #5's cover shows 9 units; the roster panel lists 6 + more.
    g.police.addHeat(95, 'cover staging');
    // Hero car: coral sports coupe on the port side, westbound, at speed.
    // FIX ROUND: lighter coral (0xff7a55) — the first cover's car read
    // dark maroon on its shadowed flank.
    const car = new Car(g, 'sports', 0xff7a55, 270, 0, -Math.PI / 2);
    car.speed = 30;
    g.player.enterCar(car);
    g.player.pos.set(270, 0, 0);
    // Two roadblock cruisers behind the leap (east, on the port side).
    for (const s of [-1, 1]) {
      const rb = new Car(g, 'sedan', 0xf2f2f2, 284, s * 3.4, -Math.PI / 2, true);
      rb.unit = { name: 'ROADBLOCK', state: 'roadblock', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
      rb.speed = 22;
      g.police.units.push(rb);
    }
    // Run the sim: the car climbs the west leaf and launches. Freeze just
    // past the tip (x <= 237), while the raised bridge and gap are still
    // right behind it — not at the apex, where the bridge is out of frame.
    g.scriptedDrive = { throttle: 1, steer: 0, handbrake: false };
    for (let i = 0; i < 300; i++) {
      g.stepSim(1 / 60);
      if (car.airborne && (car.pos.x <= 237 || (car.vy < 0 && car.pos.y > 3))) break;
    }
    g.scriptedDrive = null;
    // Compose the helicopter: up-northwest of the car, in frame, its cone
    // falling diagonally onto the car. FIX ROUND: the first cover cropped
    // the heli at the top edge (y 24, too high and too far north). Lower
    // and closer to the look line so the rotors clear the border.
    // FIX ROUND 2: further west (x -10 -> -16) so the beam slants
    // diagonally across the frame instead of dropping vertically.
    if (g.police.heli) {
      const hp = g.police.heli;
      hp.mesh.position.set(car.pos.x - 16, 18, car.pos.z - 14);
      hp.mesh.lookAt(car.pos.x, 0, car.pos.z);
      hp.pool.position.set(car.pos.x, 0.15, car.pos.z);
    }
    // Camera: south of the flight path and low, looking north-west — the
    // car in profile against the water and the sunset sky (not a building),
    // the raised bridge leaves and the gap below it, the boardwalk skyline
    // to the left, a lamp post as foreground framing.
    // FIX ROUND: closer and lower (z +16 -> +11, y -2 -> -1) with a wider
    // lens (fov 48 -> 55) so the car spans ~25% of the frame instead of
    // ~15%, and the helicopter fits above it with room to spare.
    const c = car.pos;
    g.cameraCtl.setShotPose([c.x + 6, c.y - 1, c.z + 11], [c.x - 6, c.y + 3, c.z - 4]);
    g.camera.fov = 55;
    g.camera.updateProjectionMatrix();
    g.hud.clearBanner();
    g.hud.showDialogue('Marco', 'SYNDICATE', 'The bridge is up — leap it, or the Keys eat you!');
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
    // 5-STAR CHASE: muscle car on the beach at sunset, cruisers in
    // pursuit, roadblock ahead on the sand, helicopter with the
    // searchlight cone. The camera sits over the water, so no building
    // can block the frame.
    g.missions.start(3);
    g.police.addHeat(100, 'police staging');
    // FIX ROUND: the muscle car was dark red (0xb8302a) and sank into the
    // light pool. Brighter red so the hero reads against the sand.
    const car = new Car(g, 'muscle', 0xd93a2a, 120, 150, Math.PI / 2);
    car.speed = 30;
    g.player.enterCar(car);
    g.player.pos.set(120, 150, 0);
    for (let i = 0; i < 4; i++) g.police.spawnUnit('cruiser');
    // Roadblock ahead on the sand: two cruisers across the beach.
    for (const s of [-1, 1]) {
      const rb = new Car(g, 'sedan', 0xf2f2f2, 168, 150 + s * 4.5, -Math.PI / 2, true);
      rb.unit = { name: 'ROADBLOCK', state: 'roadblock', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
      rb.speed = 0;
      g.police.units.push(rb);
    }
    driveScript(g, 1, 0, false, 90);
    // Compose the helicopter: north-east of the car, over the open sea
    // (no building can hide it), its cone falling diagonally onto the car.
    // FIX ROUND: lower (18 -> 15) and closer so it is unmistakably in
    // frame, not a smudge at the edge.
    // FIX ROUND 2: lower again (15 -> 11) and closer in — fix 1 put it
    // just above the top edge (34 deg above the look line, fov allows 30).
    // FIX ROUND 3: the (x+10, 11, z-12) spot is INSIDE the boardwalk
    // building the camera looks past — the heli was hidden behind it.
    // Put it south of the car, over the open beach/sea, in the camera's
    // view and clear of every building.
    // FIX ROUND 4: (x-6, 13, z+18) is BEHIND the camera (camera sits at
    // z+14) — the beam passed a few metres from the lens as a huge pale
    // column. Put it east of the car, over the sea: in frame, clear of
    // the buildings (west), clear of the camera, cone slanting onto the car.
    if (g.police.heli) {
      const hp = g.police.heli;
      hp.mesh.position.set(car.pos.x + 20, 11, car.pos.z + 5);
      hp.mesh.lookAt(car.pos.x, 0, car.pos.z);
      hp.pool.position.set(car.pos.x, 0.15, car.pos.z);
    }
    const c = car.pos;
    // Camera: south of the car over the open water and HIGH, looking
    // north — the car and the pursuit against the boardwalk skyline and
    // the sky, teal sea in the foreground, pursuers below the sightline.
    // FIX ROUND: lower and closer (y +6 -> +3.5, z +20 -> +14) — the first
    // frame's high camera shrank the car and let one brown building wall
    // eat the left half of the frame.
    g.cameraCtl.setShotPose([c.x - 8, c.y + 3.5, c.z + 14], [c.x + 6, c.y + 1, c.z - 4]);
    g.hud.showDialogue('Kiki', 'LOOKOUT', 'Five stars and they are not backing off. Break line of sight!');
  } else if (kind === 'mission') {
    // DEPTH: street race on the east end of Marina Blvd, rivals
    // alongside, the next gate's beacon ahead, crew and cash live. The
    // camera sits in the bridge plaza clearing, so no building blocks it.
    g.missions.start(7);
    g.progression.addCash(4200);
    g.progression.addRespect(320);
    // FIX ROUND: lighter coral, matching the cover hero.
    const car = new Car(g, 'sports', 0xff7a55, 180, 0, Math.PI / 2);
    car.speed = 34;
    g.player.enterCar(car);
    g.player.pos.set(180, 0, 0);
    g.missions.active.gate = 4; // next gate (200, 110): beacon ahead, north-east
    // Three rival racers ahead and alongside, in the lanes.
    for (const [x, z, col] of [[192, 2.2, 0x3a7ad9], [196, -2.2, 0xe8c93a], [200, 4.4, 0x2ea88a]]) {
      const r = new Car(g, 'muscle', col, x, z, Math.PI / 2);
      r.speed = 32;
      g.traffic.cars.push(r);
    }
    driveScript(g, 1, 0, false, 30);
    const c = car.pos;
    // FIX ROUND: the first race frame was mostly empty sky with a lamp
    // post dead centre splitting it. Lower and closer (y +5 -> +3, z +13
    // -> +16, x -12 -> -8) so the pack fills the frame, the skyline sits
    // on the upper third, and the lamp post slides to the frame edge.
    // FIX ROUND 2: onto the road centreline and right behind the hero
    // (x -8 -> +2, z +16 -> +12, y +3 -> +2.5) — fix 1 still left a lamp
    // post dead centre because the camera sat on the lamp line.
    // FIX ROUND 3: fix 2 cropped the hero (only its rear corner showed)
    // — the camera was 12 m behind a 4.3 m car at fov 60. Pull back to
    // 18 m and raise to y +4 so the hero sits whole in the lower centre.
    // FIX ROUND 4: nudge right (x +2 -> +4) so the blue rival is not
    // cropped by the left edge.
    g.cameraCtl.setShotPose([c.x + 4, c.y + 4, c.z + 18], [c.x + 8, c.y + 1.5, c.z - 2]);
    g.hud.showDialogue('Mira', 'DRIVER', 'Gate five of eight — stay on the boulevard, do not lift!');
  }

  // Freeze the world, render one settled frame, signal readiness.
  // (The mission title banner is cleared: it would cover the frame.)
  g.hud.clearBanner();
  g.hud.update(0);
  g.renderer.render(g.scene, g.camera);
  window.__shotReady = true;
  window.__shotKind = kind;
}
