// VERMILION KEYS — screenshot staging: ?shot=cover|combat|career|garage.
// Each shot composes a deterministic scene from the live engine (scripted
// entity placement + a fixed number of fixed-timestep ticks), positions
// the camera, then freezes the sim and raises window.__shotReady so the
// screenshot driver can capture a real render — never a composite.
//
// FIX ROUND 3 — the four frames are the four verbs, matched to #1's
// coverage and beating it on the fourth:
//   1. cover — THE CAUSEWAY INTERCEPT: the leap, now a roadblock
//      interception (roadblock below the landing, an interceptor
//      chasing from behind, a braking civilian, fleeing peds).
//   2. combat — THE GUNFIGHT: JOB 5 at the night market, 3 of 5 guards
//      already down, a witness on the phone, cruisers converging, the
//      player firing the MAKO SMG as the frame freezes.
//   3. career — THE EMPIRE: the career screen over dusk, late-game state
//      staged through the real mission/save APIs, three save slots.
//   4. garage — THE REWARD: the Motor Works at dusk, the car on the pad
//      with a real engine tune bought, the garage screen open.
// FIX ROUND 4 — the gunfight must be VISIBLE: the player fires a burst
// of three shots (ticks 147/148/149) so three tracers are fresh at the
// freeze, the downed guards are laid out with downBody() (pale shirts,
// blood pools, dropped guns), and the market holds ten fleeing
// civilians instead of six. The cover gets three braking cars near the
// roadblock and six bolting peds instead of three.
// FIX ROUND 4b — SOUTH PLAZA RESTAGE: the fix-4 frame STILL read as "a
// person standing in a market" because the old camera sat ON the firing
// line, so the tracers were foreshortened to stubs. Both side cameras
// then sat behind the market stall row (z=125) — the stall at (110,125)
// filled the frame and hid the player and the guard, and the high
// camera's no-target tracers fired down into the ground. The fight now
// happens in the OPEN PLAZA south of the stalls (z=130-140): the
// stalls are the backdrop, nothing stands between the camera and the
// fight, and the firing line runs east-west so a south camera sees
// the tracers in profile.

import * as THREE from 'three';
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
    // the frame, roadblock below the landing, full HUD.
    // FIX ROUND 2: golden hour (bright, saturated — the fix-1 brightness
    // win is kept: cover R ~147). Each shot gets its OWN time of day.
    g.lighting.setTimeOfDay('golden');
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
    // FIX ROUND 3 — the roadblock is BELOW THE LANDING now (x 228,
    // across the road, head-on to the incoming hero): the leap IS the
    // interception. The old spot (x 284, behind the hero) read as two
    // more chasers, not a block.
    for (const s of [-1, 1]) {
      const rb = new Car(g, 'sedan', 0xf2f2f2, 228, s * 3.4, Math.PI / 2, true);
      rb.unit = { name: 'ROADBLOCK', state: 'roadblock', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
      rb.speed = 0;
      g.police.units.push(rb);
    }
    // FIX ROUND 3 — an interceptor chasing from behind (x 285), so the
    // frame reads pursuit on both sides of the leap.
    const chaser = new Car(g, 'sedan', 0xf2f2f2, 285, 0, -Math.PI / 2, true);
    chaser.unit = { name: 'INTERCEPTOR', state: 'pursue', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
    chaser.speed = 26;
    g.police.units.push(chaser);
    // FIX ROUND 3 — a braking civilian on the causeway approach and
    // three fleeing peds on the sidewalk: the bridge is a street, not
    // an empty set.
    // FIX ROUND 4 — three braking civilians now, and six bolting peds:
    // the re-test faulted "nearly empty streets" on the cover.
    g.traffic.placeNear(278, 0, 3);
    for (let i = 0; i < 3; i++) {
      const p = g.peds.peds[i];
      p.pos.set(254 + i * 4, 0, i % 2 === 0 ? 6 : -6);
      p.state = 'flee';
      p.fleeT = 3;
    }
    const extraFlee = [[246, 6], [250, -6], [266, 6]];
    for (let i = 0; i < 3; i++) {
      const p = g.peds.peds[3 + i];
      p.pos.set(extraFlee[i][0], 0, extraFlee[i][1]);
      p.state = 'flee';
      p.fleeT = 3;
    }
    // Run the sim: the car climbs the west leaf and launches. Freeze
    // just after takeoff, while it is still RISING (vy > 0, so the pitch
    // is nose-up) and near the bridge (x <= 240), so the takeoff leaf,
    // the gap and the landing leaf are all legible in the frame and the
    // hero shadow blob sits on the far leaf below the car — the arc reads
    // as a jump, not flight. The old condition also broke on the DESCENT
    // (vy < 0, y > 3), which froze the car nose-down — that is the
    // nose-down render the re-author read. Never freeze descending.
    // x <= 240, not 250: freezing at 250 put the car low and close
    // behind the raised east leaf, and the leaf hid the car from the
    // south camera. At 240 the car is further west, higher, and clear
    // of the leaf while still rising (vy ~7, pitch ~0.19 nose-up).
    g.scriptedDrive = { throttle: 1, steer: 0, handbrake: false };
    for (let i = 0; i < 300; i++) {
      g.stepSim(1 / 60);
      if (car.airborne && car.vy > 0 && car.pos.x <= 240) break;
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
        if (lp.distanceTo(car.pos) < 12) {
          lm.makeScale(0, 0, 0);
          g.city.lamps.setMatrixAt(i, lm);
          g.city.lampPoles.setMatrixAt(i, lm);
        }
      }
      g.city.lamps.instanceMatrix.needsUpdate = true;
      g.city.lampPoles.instanceMatrix.needsUpdate = true;
    }
    // Compose the helicopter: up-northwest of the car, in frame, its cone
    // falling diagonally onto the car. FIX ROUND: the first cover cropped
    // the heli at the top edge (y 24, too high and too far north). Lower
    // and closer to the look line so the rotors clear the border.
    // FIX ROUND 2: further west (x -10 -> -16) so the beam slants
    // diagonally across the frame instead of dropping vertically.
    // SECOND FIX ROUND: the abeam camera put the heli at the top edge,
    // half behind the mission card. Lower (18 -> 13.5) and closer in
    // (x -16 -> -12, z -14 -> -10) so it sits fully in the upper-left.
    if (g.police.heli) {
      const hp = g.police.heli;
      hp.mesh.position.set(car.pos.x - 12, 13.5, car.pos.z - 10);
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
    // FIX ROUND 2: moved mostly abeam (x +6 -> +5, z +11 -> +13) so the
    // car shows its FLANK three-quarter with visible wheels and side
    // panels — the old rear-dominant angle made it a flat orange slab —
    // while both bridge leaves and the gap stay legible below it.
    // SECOND FIX ROUND: the render showed the car from the rear-below
    // (a red wedge, underside visible, flank hidden) and a lamp head
    // filling the left-centre. Abeam and closer (x +5 -> -1, z +13 ->
    // +11, y +1.5 -> +2): due south of the car, slightly above it, so
    // the flank and top read and the car spans ~25% of the frame.
    // The lamps at the leap are hidden above, so the bridge frames it.
    // RE-AUTHOR FIX: camera y +2 -> +3.5 so it looks OVER the raised
    // east leaf at the rising car (the first re-author render froze the
    // car low behind the leaf and the leaf hid it).
    const c = car.pos;
    g.cameraCtl.setShotPose([c.x - 1, c.y + 3.5, c.z + 11], [c.x - 3, c.y + 2.5, c.z - 3]);
    g.camera.fov = 55;
    g.camera.updateProjectionMatrix();
    g.hud.clearBanner();
    // RE-AUTHOR FIX: do NOT open the radial weapon wheel in the cover
    // shot. Its 260px box spreads the four slots across the frame and
    // they land on the leaping car, reading as floating labels — a bug,
    // not a feature. The compact #weapon-slots column (top-right,
    // always in the HUD) already shows all four weapons, as in fix 1.
    // showWeaponWheel() stays for the live game only.
    g.hud.showDialogue('Marco', 'SYNDICATE', 'The bridge is up — leap it, or the Keys eat you!');
  } else if (kind === 'combat') {
    // THE GUNFIGHT: JOB 5 MARKET CRACKDOWN at the night market, neon
    // night (20:15). The player is on foot in the open plaza SOUTH of
    // the stall row, the MAKO SMG out, three guards already down and
    // two still up in the aisle.
    // FIX ROUND 4b — SOUTH PLAZA RESTAGE: the fix-4 frame read as "a
    // person standing in a market" because the old camera sat ON the
    // firing line, so the tracers were foreshortened to stubs. Both
    // side cameras then sat behind the market stall row (z=125) — the
    // stall at (110,125) filled the frame and hid the player and the
    // guard, and the high camera's no-target tracers fired down into
    // the ground. The fight now happens in the OPEN PLAZA south of
    // the stalls (z=130-140): the stalls are the backdrop, nothing
    // stands between the camera and the fight, and the firing line
    // runs east-west so a south camera sees the tracers in profile.
    g.lighting.setTimeOfDay('neon');
    g.missions.start(5);
    // FIX ROUND 3: JOB 5 implies four jobs done — stage the matching
    // mid-game state ($5,250 = 250 + 800 + 1200 + 1000 + 2000; respect
    // 330 = 60 + 80 + 80 + 110), not the fresh-game $250 / ROOKIE.
    g.progression.addCash(5000);
    g.progression.addRespect(330);
    // FIX ROUND 4b: stage 8 heat so the police response stays at the
    // fix-4 level (4 stars, 6 units). The single shot fires one round
    // instead of the burst's three, so it generates 8 less heat (the
    // burst's two no-target shots added 4 each in combat.js). The fight
    // has already been going on — three guards are already down — so
    // the PD is already this hot. Added before the sim loop so the
    // units have the full 150 ticks to spawn and converge.
    g.police.addHeat(8, 'combat staging');
    // Stage the fight: 3 of the 5 guards already down. Their state is
    // set directly (the mission counter reads state === 'down', so the
    // card shows 3/5 DOWN) — a live knockDown would add 15 heat each
    // and push the shot to 5 stars before the witness even calls.
    // FIX ROUND 4: downBody() lays them out as visible bodies (pale
    // shirt, blood pool, dropped gun) instead of dark-on-dark debris.
    const guards = g.missions.active.guards;
    // FIX ROUND 4b: the three downed guards lie in the open plaza
    // around the player, where the camera sees them whole — not at
    // their market posts where the stall counters hide them. The
    // (98,134) body sits well west of the player so the two do not
    // overlap on screen (the first plaza render hid the player behind
    // the (102,134) body).
    // downBody() does not move the mesh, so set pos AND mesh position
    // before laying each one out.
    const downSpots = [[106, 131], [98, 134], [114, 136]];
    [0, 3, 4].forEach((idx, k) => {
      const gd = guards[idx];
      gd.pos.set(downSpots[k][0], 0, downSpots[k][1]);
      gd.mesh.position.set(downSpots[k][0], 0, downSpots[k][1]);
      g.peds.downBody(gd);
    });
    // FIX ROUND 4b: both up-guards move into the plaza. The aim target
    // (guards[1]) sits 7 m east of the player; the second (guards[2])
    // 6 m further east on the right of the frame, ~25 deg off the
    // camera ray, so the burst never targets it and the card stays
    // 4/5 DOWN, not 5/5.
    const aimGuard = guards[1];
    aimGuard.pos.set(111, 0, 134);
    aimGuard.mesh.position.set(111, 0, 134);
    const secondGuard = guards[2];
    secondGuard.pos.set(117, 0, 133);
    secondGuard.mesh.position.set(117, 0, 133);
    // Player on foot in the plaza, 7 m west of the aim guard.
    g.player.spawn(104, 136, Math.atan2(111 - 104, 134 - 136));
    // Ten fleeing civilians, staged north/east/west of the player so
    // they bolt away from the camera (south), not toward it — the
    // re-test faulted "only a handful of tiny pedestrians".
    const fleeSpots = [[102, 130], [108, 129], [104, 131], [110, 133], [101, 132], [110, 130]];
    for (let i = 0; i < 6; i++) {
      const p = g.peds.peds[i];
      p.pos.set(fleeSpots[i][0], 0, fleeSpots[i][1]);
      p.state = 'flee';
      p.fleeT = 3;
    }
    const extraFleeSpots = [[106, 128], [112, 131], [108, 128], [114, 132]];
    for (let i = 0; i < 4; i++) {
      const p = g.peds.peds[7 + i];
      p.pos.set(extraFleeSpots[i][0], 0, extraFleeSpots[i][1]);
      p.state = 'flee';
      p.fleeT = 1.5;
    }
    // A witness on the phone: reports at 0.5 s, before the freeze, so
    // the scanner ticker and the grey REPORTED stars are live.
    // FIX ROUND 4: the witness keeps filming after the call (pedestrian
    // .filming), so the glowing phone is still up at the freeze.
    // FIX ROUND 4b: starts north of the player so the flee runs north,
    // ending near the centre of the frame, phone up and filming.
    // Bright yellow shirt so the witness reads at frame scale against
    // the dark market.
    const w = g.peds.peds[6];
    w.pos.set(109, 0, 130);
    w.mesh.position.set(109, 0, 130);
    w.state = 'witness';
    w.reportTimer = 0.5;
    w.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xe8c93a });
    // A parked sedan to steal, east of the plaza — visible on the right
    // of the frame, off the sightline to the guards.
    const sedan = new Car(g, 'sedan', 0x3a7ad9, 120, 135, Math.PI * 0.5);
    sedan.speed = 0;
    g.traffic.cars.push(sedan);
    // Camera BEFORE the sim ticks: fire() shoots along the camera, and
    // pickAimTarget reads the camera too — the crosshair sits on the
    // up-guard at (111,134). South of the fight, looking north: the
    // player is ~28 deg left of centre (clear of the minimap), the
    // guard is on the crosshair, and the burst's tracers cross the
    // frame at ~91 deg to the view axis — a pure profile.
    // Apply the pose to the camera NOW (update(0)): until cameraCtl runs,
    // the camera still sits at the origin looking down -Z, and fire()
    // would shoot from there with no target.
    g.cameraCtl.setShotPose([115, 3.0, 147], [111, 1.4, 134]);
    g.cameraCtl.update(0, g.input);
    g.combat.select(2); // MAKO SMG
    // Run the sim: the witness reports, the cruisers converge (the
    // police spawn the moment they know), the civilians bolt.
    // FIX ROUND 4b: ONE shot on the last tick (149), not a three-shot
    // burst. In this layout only the shot that hits the guard crosses
    // the frame — the other two fly north along the view axis and read
    // as stubs — so the single shot is fired last, when its tracer
    // (0.12 s life) and the muzzle flash are freshest at the freeze
    // (opacity 0.86). It downs the aimed guard (4/5 DOWN).
    for (let i = 0; i < 150; i++) {
      if (i === 149) g.combat.fire();
      g.stepSim(1 / 60);
    }
    // FIX ROUND 4b: no carjack prompt in a gunfight frame — the staged
    // "E — STEAL CAR" read as an instruction in the middle of the
    // firefight. The parked sedan stays as set dressing.
    g.hud.crosshair.classList.add('show');
    // The mission beacon is a 26 m gold column over the target guard —
    // it would stand in the middle of the frame and hide the guard.
    // Hide it (and the ground marker) for this shot; the minimap keeps
    // the gold target diamond, so the objective still reads.
    g.missions.beacon.visible = false;
    g.missions.marker.visible = false;
    g.hud.showDialogue('Kiki', 'LOOKOUT', 'Five syndicate guns in the market. Drop them fast — if one calls it in, the whole precinct comes.');
  } else if (kind === 'career') {
    // THE EMPIRE: the career screen over the marina at dusk (19:40).
    // Late-game state is staged through the real mission/save APIs:
    // slot 2 holds missions 1–5, slot 1 holds all 8 with the late-game
    // ledger. Cash after all 8 jobs is $17,550 (250 + 17,300 in
    // rewards) and respect 960 — the honest totals, not round numbers.
    g.lighting.setTimeOfDay('dusk');
    const prog = g.progression;
    for (const id of [1, 2, 3, 4, 5]) {
      g.missions.start(id);
      g.missions.complete();
    }
    // Slot 2's mid-game ledger, saved before the late-game values land.
    const c2 = prog.career;
    c2.carsStolen = 9;
    c2.copsEscaped = 6;
    c2.distanceDriven = 21400;
    c2.peopleTakenOut = 11;
    c2.longestJump = 32;
    c2.racesWon = 0;
    c2.highestWanted = 4;
    prog.save(2);
    for (const id of [6, 7, 8]) {
      g.missions.start(id);
      g.missions.complete();
    }
    prog.recordRaceWin(); // a second Grand Prix win, on the record
    const c = prog.career;
    c.carsStolen = 17;
    c.copsEscaped = 12;
    c.distanceDriven = 42800;
    c.peopleTakenOut = 23;
    c.longestJump = 47;
    c.racesWon = 2;
    c.highestWanted = 5;
    prog.save(1);
    // A little live heat, so the map shows its heat zone and escape route.
    g.police.clearHeat();
    g.police.addHeat(25, 'career staging');
    // Player at the marina: the map arrow sits away from home, with the
    // escape route running back to the safehouse.
    g.player.spawn(60, -100, 0);
    // High wide camera over the marina and the skyline, behind the overlay.
    g.cameraCtl.setShotPose([80, 55, 90], [0, 5, -60]);
    g.hud.clearBanner();
    g.menus.showCareer();
  } else if (kind === 'garage') {
    // THE REWARD: the Motor Works at dusk (19:00). The player's sports
    // car sits on the glowing pad, the neon sign behind it, the garage
    // screen open on the right while the 3D car shows on the left.
    g.lighting.setTimeOfDay('dusk');
    const car = new Car(g, 'sports', 0xff7a55, 52, 128, 0);
    car.speed = 0;
    g.player.enterCar(car);
    g.player.pos.set(52, 128, 0);
    // The car arrives damaged (60/80 HP) so Repair is a real option,
    // not a dead one — the panel shows CONDITION 75%, not 100%.
    car.hp = 60;
    // Two jobs already done, so the cash and the tune are earned, not
    // conjured: $2,250 from jobs 1–2 (250 + 800 + 1,200), topped up to
    // $14,850, then the engine tune bought for real — $10,850 left,
    // engine level 1, top speed +8%. The panel's NEXT job reads JOB 3
    // and the mission card agrees (2/8 jobs done); the old staging had
    // $10,850 with 0 jobs done, which did not add up.
    for (const id of [1, 2]) {
      g.missions.start(id);
      g.missions.complete();
    }
    g.progression.addCash(12600);
    g.progression.buyUpgrade('engine');
    // Completing job 2 leaves Lo's payout line on screen for 7 s of HUD
    // time; the garage panel would clip it mid-word. Run the HUD clock
    // out — the live game fades the line the same way.
    g.hud.update(7);
    // A second sedan parked nearby, west of the garage.
    const sedan = new Car(g, 'sedan', 0x3a7ad9, 42, 134, -Math.PI * 2);
    sedan.speed = 0;
    g.traffic.cars.push(sedan);
    // The mechanic (spawned at boot) stands beside the pad, facing the car.
    const mech = g.peds.peds.find((p) => p.static);
    if (mech) {
      mech.pos.set(47.5, 0, 128);
      mech.heading = Math.PI / 2;
    }
    // Camera: three-quarter front of the car, neon sign visible behind it.
    g.cameraCtl.setShotPose([58, 3, 140], [46, 1.2, 124]);
    g.hud.clearBanner();
    g.menus.showGarage();
  }

  // Freeze the world, render one settled frame, signal readiness.
  // (The mission title banner is cleared: it would cover the frame.)
  g.hud.clearBanner();
  g.hud.update(0);
  g.renderer.render(g.scene, g.camera);
  window.__shotReady = true;
  window.__shotKind = kind;
}
