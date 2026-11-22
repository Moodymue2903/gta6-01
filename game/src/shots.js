// VERMILION KEYS — screenshot staging: ?shot=cover|combat|career|garage.
// Each shot composes a deterministic scene from the live engine (scripted
// entity placement + a fixed number of fixed-timestep ticks), positions
// the camera, then freezes the sim and raises window.__shotReady so the
// screenshot driver can capture a real render — never a composite.
//
// FIX ROUND 5 — one consistent run, four frames from it (see
// shotDirector.js: jobs 1-7 done, four exports, three flares, three
// stunts, nine crew uses, three saves — 74.5%, V$13,850, ENFORCER):
//   1. cover — THE CAUSEWAY INTERCEPT: the late-afternoon leap, fixed
//      with the materials pass + a braked queue + a scooter + 16 peds,
//      roadblock below the landing, chaser behind, 5-star heat.
//   2. combat — YARD AMBUSH: the container yard at midday, third-person
//      over-shoulder, one profile shot at tick 149 (fresh tracer +
//      muzzle flash), 3/6 guards down, a dock worker on the phone
//      (witness) + fleeing peds. NO steal-car prompt, NO dialogue.
//   3. career — THE EMPIRE: the career pause menu over a REAL daytime
//      aerial render, 74.5% COMPLETE, 3 live save slots, crew, the
//      small tinted district map. NO wireframe map, NO flat navy.
//   4. garage — MOTOR WORKS: the car on the lift in the real interior,
//      warm bay lights, engine tune bought for real (V$9,850 left),
//      condition 75%, the 5 priced upgrades with stat bars.
// No frame shows dialogue text: the mission briefings are cleared at
// the freeze, so the frames read as pictures, not chat logs.

import * as THREE from 'three';
import { Car } from './entities/vehicle.js';
import { stageRun, completeJob, dumpState } from './world/shotDirector.js';
import { stageCoverDensity, stageYardDensity } from './world/density_spawner.js';
import { applyMidday, applyGolden } from './world/skyAndLight.js';
import { fireProfileShot } from './systems/combat/tracers.js';

export function stageShot(kind, game) {
  const g = game;
  g.state = 'shot';
  g.audio.radioOn = true;
  g.audio.setRadio(0);

  if (kind === 'cover') {
    // THE CAUSEWAY INTERCEPT: the leap, westbound into the sunset —
    // kept from fix 4 (the late-afternoon causeway leap is the cover),
    // fixed with the materials pass, the density spawner and a visible
    // bridge deck + roadblock below. The run underneath is the real
    // late-game run (74.5%, V$13,850); JOB 8 starts on top of it.
    applyGolden(g);
    const { runCar } = stageRun(g);
    g.missions.start(8);
    // 5 stars, 8 units + heli: the full pursuit on the leap.
    g.police.addHeat(95, 'cover staging');
    // Hero car: the run car, back on the port side, westbound, at speed.
    runCar.pos.set(270, 0, 0);
    runCar.heading = -Math.PI / 2;
    runCar.speed = 30;
    runCar.airborne = false;
    runCar.vy = 0;
    runCar.syncMesh();
    g.player.pos.set(270, 0, 0);
    // The roadblock is BELOW THE LANDING (x 228, across the road,
    // head-on to the incoming hero): the leap IS the interception.
    for (const s of [-1, 1]) {
      const rb = new Car(g, 'sedan', 0xf2f2f2, 228, s * 3.4, Math.PI / 2, true);
      rb.unit = { name: 'ROADBLOCK', state: 'roadblock', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
      rb.speed = 0;
      g.police.units.push(rb);
    }
    // An interceptor chasing from behind (x 285), so the frame reads
    // pursuit on both sides of the leap.
    const chaser = new Car(g, 'sedan', 0xf2f2f2, 285, 0, -Math.PI / 2, true);
    chaser.unit = { name: 'INTERCEPTOR', state: 'pursue', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
    chaser.speed = 26;
    g.police.units.push(chaser);
    // Density: 8 cars pulled onto the causeway, a 6-car braked queue
    // with brake lights on, a scooter filtering past, 16 peds on the
    // promenade (6 bolting). The bridge is a street, not an empty set.
    stageCoverDensity(g);
    // Run the sim: the car climbs the west leaf and launches. Freeze
    // just after takeoff, while it is still RISING (vy > 0, so the pitch
    // is nose-up) and near the bridge (x <= 240), so the takeoff leaf,
    // the gap and the landing leaf are all legible in the frame and the
    // hero shadow blob sits on the far leaf below the car — the arc reads
    // as a jump, not flight. Never freeze descending.
    g.scriptedDrive = { throttle: 1, steer: 0, handbrake: false };
    for (let i = 0; i < 300; i++) {
      g.stepSim(1 / 60);
      if (runCar.airborne && runCar.vy > 0 && runCar.pos.x <= 240) break;
    }
    g.scriptedDrive = null;
    // The causeway lamp heads sit between any south camera and the car —
    // one filled the frame as a giant white disc. Hide the lamp heads
    // and poles within 12 m of the frozen car (staging only; the live
    // game keeps its lamps). The bridge, not a lamp, frames the jump.
    if (g.city.lamps && g.city.lampPoles) {
      const lm = new THREE.Matrix4();
      const lp = new THREE.Vector3();
      for (let i = 0; i < g.city.lamps.count; i++) {
        g.city.lamps.getMatrixAt(i, lm);
        lp.setFromMatrixPosition(lm);
        if (lp.distanceTo(runCar.pos) < 12) {
          lm.makeScale(0, 0, 0);
          g.city.lamps.setMatrixAt(i, lm);
          g.city.lampPoles.setMatrixAt(i, lm);
        }
      }
      g.city.lamps.instanceMatrix.needsUpdate = true;
      g.city.lampPoles.instanceMatrix.needsUpdate = true;
    }
    // Compose the helicopter: up-northwest of the car, in frame, its cone
    // falling diagonally onto the car. FIX ROUND 5: the fix-4 pose
    // (12 m west, 10 m north, 13.5 up) put the 9 m rotor ~24 m from the
    // camera — the black blades filled the top-left corner as a giant
    // X and the body was cut by the frame edge. At ~42 m the rotor
    // subtends ~12 deg, so the whole helicopter reads as a silhouette
    // in the upper-left, fully in frame, with the beam still slanting
    // diagonally onto the car.
    if (g.police.heli) {
      const hp = g.police.heli;
      hp.mesh.position.set(runCar.pos.x - 20, 12, runCar.pos.z - 26);
      hp.mesh.lookAt(runCar.pos.x, 0, runCar.pos.z);
      hp.pool.position.set(runCar.pos.x, 0.15, runCar.pos.z);
    }
    // Camera: due south of the car and slightly above it, so the flank
    // and top read and the car spans ~25% of the frame; fov 55. The
    // lamps at the leap are hidden above, so the bridge frames it.
    const c = runCar.pos;
    g.cameraCtl.setShotPose([c.x - 1, c.y + 3.5, c.z + 11], [c.x - 3, c.y + 2.5, c.z - 3]);
    g.camera.fov = 55;
    g.camera.updateProjectionMatrix();
  } else if (kind === 'combat') {
    // YARD AMBUSH: JOB 5 in the container yard at midday (12:30, blue
    // sky, bright colour-blocked containers). The same run at JOB 5:
    // jobs 1-4 done (V$5,250, respect 330), then the yard fight starts.
    // Third-person over-shoulder from the port road, the firing line
    // running east-west so a south camera sees the tracers in profile.
    applyMidday(g);
    for (const id of [1, 2, 3, 4]) completeJob(g, id);
    // Staging artifact: job 3's escape stage adds 45 heat on start, so
    // the run arrives at the yard already at 4 stars. Clear it — the
    // fight's own heat is start(5) 20 + witness 25 + shot 15 = 60,
    // 3 stars, 4 units, as designed. (Without this the frame showed
    // 5 stars and 8 units, and a converging cruiser rammed the player.)
    g.police.clearHeat();
    g.missions.start(5);
    // Stage the fight: 3 of the 6 guards already down, laid out with
    // downBody() (pale shirts, blood pools, dropped guns) in the open
    // aisle, where the camera sees them whole.
    const guards = g.missions.active.guards;
    const downSpots = [[388, -166], [402, -167], [408, -165]];
    [0, 3, 5].forEach((idx, k) => {
      const gd = guards[idx];
      gd.pos.set(downSpots[k][0], 0, downSpots[k][1]);
      gd.mesh.position.set(downSpots[k][0], 0, downSpots[k][1]);
      g.peds.downBody(gd);
    });
    // The aim target (guards[1]) sits 10 m east of the player, on the
    // crosshair; the second (guards[2]) 6 m further east, ~25 deg off
    // the camera ray, so the shot never targets it and the card stays
    // 4/6 DOWN, not 6/6. The cover guard (guards[4]) stays crouched
    // at (390,-170), off the camera ray.
    const aimGuard = guards[1];
    aimGuard.pos.set(394, 0, -166);
    aimGuard.mesh.position.set(394, 0, -166);
    const secondGuard = guards[2];
    secondGuard.pos.set(400, 0, -166);
    secondGuard.mesh.position.set(400, 0, -166);
    // Player on foot in the aisle, 10 m west of the aim guard, facing east.
    g.player.spawn(384, -162, Math.atan2(10, -4));
    // The frame shows a fight already going: the player is hurt (82) and
    // armoured (60), not fresh. spawn() resets health to 100, so set
    // these AFTER the spawn.
    g.player.health = 82;
    g.player.armour = 60;
    // Twelve dock workers and bystanders in the aisle; six of them bolt
    // east once the shots start (fleeT 3, so the bolt stays in frame).
    stageYardDensity(g);
    const fleeIdx = [3, 4, 5, 6, 7, 11];
    for (const i of fleeIdx) {
      const p = g.peds.peds[i];
      p.state = 'flee';
      p.fleeT = 3;
    }
    // A dock worker on the phone: reports at 0.5 s, before the freeze,
    // so the scanner ticker and the grey REPORTED stars are live — and
    // keeps filming after the call, phone up at the freeze. Bright
    // yellow shirt so the witness reads at frame scale. NOT one of the
    // 12 yard spots: peds[12], staged at (388,-160).
    const w = g.peds.peds[12];
    w.pos.set(388, 0, -160);
    w.mesh.position.set(388, 0, -160);
    w.state = 'witness';
    w.reportTimer = 0.5;
    w.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xe8c93a });
    // Four traffic cars pulled onto the port road for the density floor.
    g.traffic.placeNear(392, -160, 4);
    // Camera BEFORE the sim ticks: fire() shoots along the camera, and
    // pickAimTarget reads the camera too — the crosshair sits on the
    // up-guard at (394,-166). On the road south of the aisle, looking
    // north: the player is left of centre (clear of the minimap), the
    // guard is on the crosshair, and the shot's tracer crosses the
    // frame at ~91 deg to the view axis — a pure profile.
    // Apply the pose to the camera NOW (update(0)): until cameraCtl runs,
    // the camera still sits at the origin looking down -Z, and fire()
    // would shoot from there with no target.
    g.cameraCtl.setShotPose([378, 3.0, -158], [394, 1.3, -166]);
    g.cameraCtl.update(0, g.input);
    g.combat.select(2); // MAKO SMG
    // Run the sim: the witness reports, the cruisers converge (the
    // police spawn the moment they know), the civilians bolt.
    // 75 ticks (1.25 s), not 150: at 2.5 s a converging cruiser had
    // reached the player, rammed him (armour 60 -> 30) and parked on
    // the camera ray — it filled the lower half of the frame and stole
    // the shot (the card read 3/6 DOWN, not 4/6). At 1.25 s the units
    // are still converging, the fleers are mid-bolt, and the witness
    // (reported at 0.5 s) is still filming in frame.
    // ONE shot on the last tick (74), not a burst: only the shot that
    // hits the guard crosses the frame, so the single shot is fired
    // last, when its tracer (0.12 s life) and the muzzle flash are
    // freshest at the freeze. It downs the aimed guard (4/6 DOWN).
    for (let i = 0; i < 75; i++) {
      if (i === 74) fireProfileShot(g);
      g.stepSim(1 / 60);
    }
    // The sim's incidental contact (a converging unit or a traffic car
    // clipping the player) can shave the armour below the staged 60 —
    // the frame's design is a hurt (82) but armoured (60) player, so
    // the final numbers are set here, after the sim, as they were
    // after the spawn.
    g.player.health = 82;
    g.player.armour = 60;
    // A converging cruiser (or a traffic car) can still end up on the
    // camera ray: any vehicle within 10 m of the camera is moved east
    // along the port road — still converging, still in frame, no longer
    // blocking the fight or stealing the shot. Staging only, like the
    // lamp-hiding on the cover.
    {
      const camPos = g.camera.position;
      for (const u of g.police.units) {
        if (Math.hypot(u.pos.x - camPos.x, u.pos.z - camPos.z) < 10) {
          u.pos.set(425, 0, -160);
          u.syncMesh();
        }
      }
      for (const c of g.traffic.cars) {
        if (Math.hypot(c.pos.x - camPos.x, c.pos.z - camPos.z) < 6) {
          c.pos.set(430, 0, -158);
          c.syncMesh();
        }
      }
    }
    // No carjack prompt in a gunfight frame — the player is on foot and
    // no car is within 4.5 m, so the prompt is never set; handleKeys
    // returns early in shot mode in any case. The crosshair stays up.
    g.hud.crosshair.classList.add('show');
    // The mission beacon is a 26 m gold column over the target guard —
    // it would stand in the middle of the frame and hide the guard.
    // Hide it (and the ground marker) for this shot; the minimap keeps
    // the gold target diamond, so the objective still reads.
    g.missions.beacon.visible = false;
    g.missions.marker.visible = false;
  } else if (kind === 'career') {
    // THE EMPIRE: the career pause menu over a REAL daytime aerial
    // render of the Keys. The full run (74.5%, V$13,850, ENFORCER,
    // three live save slots) staged through the real mission/save APIs.
    const { runCar } = stageRun(g);
    void runCar;
    g.lighting.setTimeOfDay('day');
    // A little live heat, so the map shows its heat zone — but unseen
    // (reported: false), so the stars stay hidden and the map reads
    // heat-only, not a wanted chase.
    g.police.clearHeat();
    g.police.addHeat(25, 'career staging', { reported: false });
    // Player at the marina: the map arrow sits away from home, with the
    // escape route running back to the safehouse.
    g.player.spawn(60, -100, 0);
    // High wide camera over the marina and the skyline, behind the overlay.
    g.cameraCtl.setShotPose([80, 55, 90], [0, 5, -60]);
    g.menus.showCareer();
  } else if (kind === 'garage') {
    // THE REWARD: the Motor Works at dusk (19:40). The run car sits on
    // the lit hydraulic lift in the real interior, the garage screen
    // open beside it. The engine tune is bought for real on top of the
    // run (V$13,850 - $4,000 = V$9,850 left, engine level 1), and the
    // car arrives damaged (60/80 HP, 75%) so Repair is a real option.
    const { runCar } = stageRun(g);
    g.lighting.setTimeOfDay('dusk');
    // The run's incidental heat (peds struck during the stunt/export
    // drives took it to 5 stars) is cleared: the garage is a safe
    // tuning moment, not a chase — the frame is the reward, and the
    // 6-unit roster would cover the bay. One police tick after the
    // clear does what live play does a tick later: with known false the
    // wanted force is zero, so the orphaned units are trimmed and the
    // heli despawned (update trims to wantCruisers/wantSwat/wantHeli).
    g.police.clearHeat();
    g.police.update(0);
    runCar.pos.set(52, 0.54, 128);
    runCar.heading = 0;
    runCar.speed = 0;
    runCar.syncMesh();
    g.player.pos.set(52, 0.54, 128);
    runCar.damage(20);
    g.progression.buyUpgrade('engine');
    // A sedan and a bike in the bay, four street cars parked on the
    // beach outside the door (a fifth at (68,140) holds the frame's
    // 8-vehicle floor: run car + sedan + bike + 5 beach cars).
    const sedan = new Car(g, 'sedan', 0x3a7ad9, 42, 134, 0);
    sedan.speed = 0;
    g.traffic.cars.push(sedan);
    const bike = new Car(g, 'bike', 0xe8c93a, 56, 131, Math.PI / 2);
    bike.speed = 0;
    g.traffic.cars.push(bike);
    const beachCars = [
      [44, 140, 0x2ea88a], [50, 143, 0xe8c93a], [56, 140, 0xd93a2a],
      [62, 143, 0x8a6ad9], [68, 140, 0xd97bd9],
    ];
    for (const [x, z, col] of beachCars) {
      const bc = new Car(g, 'sedan', col, x, z, 0);
      bc.speed = 0;
      g.traffic.cars.push(bc);
    }
    // The mechanic (spawned at boot) stands beside the pad, facing the car.
    const mech = g.peds.peds.find((p) => p.static);
    if (mech) {
      mech.pos.set(47.5, 0, 128);
      mech.heading = Math.PI / 2;
    }
    // A worker in the bay and ten beachgoers outside the door. The run's
    // drives may have knocked one of them down — reset the mesh upright
    // (the walk branch never runs here: no sim ticks in this frame).
    const worker = g.peds.peds[0];
    worker.pos.set(55, 0, 126.5);
    worker.mesh.position.set(55, 0, 126.5);
    worker.mesh.rotation.set(0, worker.heading, 0);
    worker.mesh.position.y = 0;
    worker.mesh.visible = true;
    worker.state = 'walk';
    worker.idle = 0;
    for (let i = 0; i < 10; i++) {
      const p = g.peds.peds[1 + i];
      const x = 44 + i * 2;
      const z = 136 + (i % 3) * 3;
      p.pos.set(x, 0, z);
      p.mesh.position.set(x, 0, z);
      p.mesh.rotation.set(0, p.heading, 0);
      p.mesh.position.y = 0;
      p.mesh.visible = true;
      p.state = 'walk';
      p.idle = 0;
    }
    // Camera: from the north-west corner of the bay looking south-east
    // across the car — the rear three-quarter reads as a sports car on
    // the lift (the fix-5 camera sat 3.5 m behind the car, so the car
    // filled the frame as a flat slab and the lift posts as blue walls).
    // The back wall and neon sign sit behind the camera, so no sign
    // text lands at the screen edge; the door and the beach cars show
    // through the open front beyond the car, with the door light on it.
    g.cameraCtl.setShotPose([47.5, 3.0, 125.5], [52.5, 0.9, 129]);
    g.menus.showGarage();
  }

  // Freeze the world, render one settled frame, dump the live state for
  // the probes, signal readiness. (The mission banner and any dialogue
  // are cleared: they would cover the frame.)
  g.hud.clearBanner();
  g.hud.clearDialogue();
  g.hud.update(0);
  const focus =
    kind === 'cover' ? { x: 250, z: 0, r: 60 }
    : kind === 'combat' ? { x: 392, z: -162, r: 45 }
    : kind === 'career' ? { x: 0, z: 0, r: 260 }
    : { x: 52, z: 128, r: 45 };
  dumpState(g, kind, focus);
  g.renderer.render(g.scene, g.camera);
  window.__shotReady = true;
  window.__shotKind = kind;
}
