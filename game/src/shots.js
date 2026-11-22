// VERMILION KEYS — screenshot staging: ?shot=cover|combat|career|garage.
// Each shot composes a deterministic scene from the live engine (scripted
// entity placement + a fixed number of fixed-timestep ticks), positions
// the camera, then freezes the sim and raises window.__shotReady so the
// screenshot driver can capture a real render — never a composite.
//
// FIX ROUND 5 — one consistent run, four frames from it (see
// shotDirector.js: jobs 1-7 done, four exports, three flares, three
// stunts, nine crew uses, three saves — 74.5%, V$13,850, ENFORCER):
//   1. cover — THE CAUSEWAY INTERCEPT: the grounded sunset chase
//      (fix 6 finish): the hero big in the right foreground on the wet
//      causeway at top speed, its bright tail bar and glass reading
//      as a car's rear; the nearest cruiser tucked smaller up-road
//      behind it in the north lane, the oncoming interceptor and the
//      roadblock further up-road, the heli high and restrained, the
//      port (ship, cranes) on the right — 5-star heat, no leap, no
//      palms in the sightline, no cream box blocking the port.
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
import { tintedGlassMaterial } from './world/vehicleMaterials.js';
import { fireProfileShot } from './systems/combat/tracers.js';

export function stageShot(kind, game) {
  const g = game;
  g.state = 'shot';
  g.audio.radioOn = true;
  g.audio.setRadio(0);

  if (kind === 'cover') {
    // THE CAUSEWAY INTERCEPT: GROUNDED, at speed, westbound into the
    // sunset — FIX ROUND 6 replaces the fix-4/5 leap. The leap read as
    // a physics glitch (nose-up car over a broken span, flat orange
    // sky, a spotlight wedge for a composition), so the cover is now
    // the target's shot: the hero car flat on the wet causeway with
    // its contact shadow under it, a cruiser tight on its tail, an
    // oncoming interceptor ahead with its headlights on, the roadblock
    // beyond the lowered drawbridge, the heli high with a restrained
    // beam, and the port (cranes, cargo ship) on the right. The run
    // underneath is the real late-game run (74.5%, V$13,850); JOB 8
    // starts on top of it. The drive loop below is kept verbatim from
    // fix 5 (same ticks, same 17:59 clock) — it only advances the
    // world; every pose is re-staged after it, grounded.
    applyGolden(g);
    const { runCar } = stageRun(g);
    g.missions.start(8);
    // 5 stars, 8 units + heli: the full pursuit on the chase.
    g.police.addHeat(95, 'cover staging');
    // Hero car: the run car, back on the port side, westbound, at speed.
    runCar.pos.set(270, 0, 0);
    runCar.heading = -Math.PI / 2;
    runCar.speed = 30;
    runCar.airborne = false;
    runCar.vy = 0;
    runCar.syncMesh();
    g.player.pos.set(270, 0, 0);
    // The roadblock is BEYOND THE LOWERED BRIDGE (x 228, across the
    // road, head-on to the incoming hero): the interception the hero
    // is driving into, on flat road.
    for (const s of [-1, 1]) {
      const rb = new Car(g, 'sedan', 0xf2f2f2, 228, s * 3.4, Math.PI / 2, true);
      rb.unit = { name: 'ROADBLOCK', state: 'roadblock', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
      rb.speed = 0;
      g.police.units.push(rb);
    }
    // The chase cars (tight chaser behind, oncoming interceptor
    // ahead) are staged AFTER the drive loop below, so the loop's
    // ticks cannot drive them off their marks — they are frozen poses,
    // not pursuers mid-sim.
    // Density: 8 cars pulled onto the causeway, a 6-car braked queue
    // with brake lights on, a scooter filtering past, 16 peds on the
    // promenade (6 bolting). The bridge is a street, not an empty set.
    stageCoverDensity(g);
    // Run the sim: the car climbs the west leaf and launches. This
    // loop is verbatim fix 5 — it only advances the world (traffic,
    // fleeing peds, converging units, the 17:59 clock). Every pose
    // below is re-staged after it, grounded, so the leap it ends in
    // never reaches the frame.
    g.scriptedDrive = { throttle: 1, steer: 0, handbrake: false };
    for (let i = 0; i < 300; i++) {
      g.stepSim(1 / 60);
      if (runCar.airborne && runCar.vy > 0 && runCar.pos.x <= 240) break;
    }
    g.scriptedDrive = null;
    // Lower the drawbridge for the grounded chase: the raised leaves
    // + gap are the leap's geometry, and a grounded car driving at a
    // raised bridge reads as the same broken causeway. The bridge
    // lowers on its own timer in live play too; here it is lowered
    // for the frame, and the leaves are rotated down with city
    // updates (which move nothing else — no traffic, peds or police).
    g.city.bridge.forceUp = false;
    g.city.bridge.up = false;
    g.city.bridge.state = 'down';
    g.city.bridge.timer = 60;
    for (let i = 0; i < 120; i++) g.city.update(1 / 60, g.time);
    // Re-ground the hero: flat on the east approach at (258,0,0) —
    // inside the Ochre Causeway district, so the street ribbon reads
    // the causeway, not Key Westyard — westbound at top speed
    // (43 m/s reads 155 km/h), pitch zero, wheels on the road. The
    // contact shadow is reset under it by hand — stepSim is not run
    // again, so the blob would otherwise sit where the leap left it,
    // over the gap — and it sits at y 0.09, above the wet band.
    runCar.pos.set(258, 0, 0);
    runCar.heading = -Math.PI / 2;
    runCar.speed = 43;
    runCar.airborne = false;
    runCar.vy = 0;
    runCar.pitch = 0;
    runCar.syncMesh();
    g.player.pos.set(258, 0, 0);
    g.heroBlob.position.set(258, 0.09, 0);
    g.heroBlob.scale.set(4.3 * 0.62, 2.0 * 0.75, 1);
    // FIX ROUND 6 (finish): 0.55 was too faint to ground the car at
    // this range — the hero floated. 0.68 reads as a real contact
    // shadow under a car at speed.
    g.heroBlob.material.opacity = 0.68;
    // Hero rear separation (FIX ROUND 6 finish): from behind, the
    // sports body reads as one flat orange face — the dim corner
    // taillights (0x881111) do not separate it. A full-width bright
    // tail bar and a tinted-glass rear window, attached to the hero
    // mesh like the exhaust flames, so the rear reads as a car's rear:
    // lit tail bar, glass, bumper, body. Staging only, like the flames.
    {
      const tailBar = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.22, 1.5),
        new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
      );
      tailBar.position.set(-2.17, 0.47, 0);
      runCar.mesh.add(tailBar);
      const rearGlass = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.30, 1.4),
        tintedGlassMaterial(),
      );
      // The sports cabin rear face sits at local x -1.20 (cabin centre
      // -0.17, half-length 1.03); the panel sits just proud of it.
      rearGlass.position.set(-1.23, 0.98, 0);
      runCar.mesh.add(rearGlass);
    }
    // The chase, frozen (FIX ROUND 6 finish): the fix-5/6 chaser sat
    // at (260,-2.4) — 2 m astern of the hero and 2.4 m north — so from
    // the rear camera it was the same distance as the hero, the same
    // size, and brighter white: it read as the hero's co-star, not its
    // pursuer. A literally-astern cruiser cannot be framed smaller
    // than the hero from a rear camera on a straight road (it is
    // always on the camera's side of the hero), so the nearest unit
    // sits where the frame reads it as behind: up-road in the north
    // lane at (252,-3.2), 6 m past the hero and 3.2 m north — further
    // from the lens than the hero, ~half its size, its roof and light
    // bar tucked behind the hero's roofline, still state 'pursue' on
    // the roster. The interceptor and the roadblock stay where they
    // were: 24 m and 30 m up-road, small, the trap the hero is
    // driving into. (The interceptor sits on the lowered east leaf
    // (its top is at y 0.32), so its height is set to the leaf, not
    // the road.)
    const chaser = new Car(g, 'sedan', 0xf2f2f2, 252, -3.2, -Math.PI / 2, true);
    chaser.unit = { name: 'INTERCEPTOR', state: 'pursue', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
    chaser.speed = 40;
    g.police.units.push(chaser);
    const oncoming = new Car(g, 'sedan', 0xf2f2f2, 234, 1.5, Math.PI / 2, true);
    oncoming.unit = { name: 'VKPD-07', state: 'pursue', kind: 'cruiser', blockTarget: null, ramCooldown: 0 };
    oncoming.speed = 25;
    oncoming.pos.y = 0.32;
    oncoming.syncMesh();
    g.police.units.push(oncoming);
    // De-conflict: the loop's traffic and the spawned units converged
    // on the old (leap) position, so anything that ended up within
    // 7 m of the hero, the chaser or the interceptor — or within 5 m
    // of the camera — is moved east onto the approach behind the
    // camera, still in the world and still on the roster, no longer
    // sitting on the hero or blocking the lens.
    {
      const keepOut = [
        { x: 258, z: 0, r: 7 }, { x: 252, z: -3.2, r: 7 }, { x: 234, z: 1.5, r: 7 },
        { x: 263, z: 6.2, r: 5 },
      ];
      const clearOf = (x, z) => keepOut.every((k) => Math.hypot(x - k.x, z - k.z) > k.r);
      for (const c of g.traffic.cars) {
        if (!clearOf(c.pos.x, c.pos.z)) {
          c.pos.set(302, 0, c.pos.z < 0 ? -2.2 : 2.2);
          c.syncMesh();
        }
      }
      for (const u of g.police.units) {
        if (u === chaser || u === oncoming) continue;
        if (u.unit && u.unit.name === 'ROADBLOCK') continue;
        if (!clearOf(u.pos.x, u.pos.z)) {
          u.pos.set(306, 0, u.pos.z < 0 ? -3 : 3);
          u.syncMesh();
        }
      }
    }
    // Wet causeway: low additive glints lying on the road — the sun's
    // reflection on wet asphalt. Warm streaks west of the hero toward
    // the sunset, one cool streak under the interceptor's headlights.
    // They sit just above the road (y 0.09) with no depth write, so
    // they can never z-fight the asphalt.
    // FIX ROUND 6 (finish): the fix-6 streaks (0.08-0.16) were
    // invisible against the dark wet band — the road still read as
    // flat tan/grey, not wet. The streaks are roughly doubled, the
    // hero gets a warm reflection pool under it, and the interceptor
    // gets a cool headlight streak, so the wet reads at frame scale.
    {
      const streak = (x, z, len, wid, color, opacity) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(len, wid),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, 0.1, z);
        m.renderOrder = 3;
        g.scene.add(m);
      };
      streak(248, -1.5, 16, 1.6, 0xff9a3a, 0.30);
      streak(236, 1.5, 20, 1.2, 0xff7a2a, 0.22);
      streak(224, -2.5, 18, 1.4, 0xffb347, 0.18);
      streak(264, 2.5, 12, 1.2, 0xff9a3a, 0.22);
      streak(234, -1.5, 10, 1.0, 0xfff2d0, 0.16);
      // Warm reflection pool under the hero + its exhaust glow.
      streak(258, 0, 7, 3.4, 0xff8a2a, 0.28);
      streak(258, 0, 4.5, 2.2, 0xffd9a0, 0.20);
      // Cool headlight reflection stretching west from the interceptor.
      streak(228, 1.5, 12, 1.0, 0xcfe8ff, 0.20);
      // Cool headlight reflection west from the tucked chaser.
      streak(246, -3.2, 9, 0.9, 0xcfe8ff, 0.16);
      // FIX ROUND 6 (finish 2): the wet band read as a black void in
      // the mid-road — the opaque band covers the road's own lane
      // dashes, and the glints alone do not carry it. White centre
      // dashes laid on the band, plus one long warm streak down the
      // middle, so the wet reads as a road with markings and sun on it.
      for (const dx of [236, 246, 256, 266]) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(3, 0.35),
          new THREE.MeshBasicMaterial({ color: 0xf2f2e8, transparent: true, opacity: 0.85, depthWrite: false }),
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(dx, 0.12, 0);
        dash.renderOrder = 3;
        g.scene.add(dash);
      }
      streak(242, 0.5, 18, 1.2, 0xff9a3a, 0.20);
    }
    // Exhaust flames: two small additive cones at the hero's tailpipes
    // plus a warm point light, so the speed reads as fire as well as
    // motion. They ride on the car mesh, so they sit exactly at the
    // tailpipes whatever the final pose is.
    {
      const flameMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
      for (const s of [-1, 1]) {
        const flame = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.8, 6), flameMat);
        flame.rotation.z = Math.PI / 2;
        flame.position.set(-2.45, 0.32, s * 0.55);
        runCar.mesh.add(flame);
      }
      const glow = new THREE.PointLight(0xff8a2a, 8, 7, 1.6);
      glow.position.set(-2.6, 0.5, 0);
      runCar.mesh.add(glow);
    }
    // The causeway lamp heads sit between any south camera and the car —
    // one filled the frame as a giant white disc. Hide the lamp heads
    // and poles within 12 m of the frozen car (staging only; the live
    // game keeps its lamps), and within 8 m of the camera itself.
    // The bridge, not a lamp, frames the chase.
    if (g.city.lamps && g.city.lampPoles) {
      const lm = new THREE.Matrix4();
      const lp = new THREE.Vector3();
      for (let i = 0; i < g.city.lamps.count; i++) {
        g.city.lamps.getMatrixAt(i, lm);
        lp.setFromMatrixPosition(lm);
        if (lp.distanceTo(runCar.pos) < 12 || Math.hypot(lp.x - 263, lp.z - 6.2) < 8) {
          lm.makeScale(0, 0, 0);
          g.city.lamps.setMatrixAt(i, lm);
          g.city.lampPoles.setMatrixAt(i, lm);
        }
      }
      g.city.lamps.instanceMatrix.needsUpdate = true;
      g.city.lampPoles.instanceMatrix.needsUpdate = true;
    }
    // Palms (FIX ROUND 6 finish): the crown is a solid 3.4 m cone,
    // and one on the cover sightline reads as a giant green pyramid,
    // not a palm — the fix-6 comment claimed them removed, but the
    // spots were never actually filtered, and one still sits at the
    // frame's left edge. Hide every palm whose crown falls in the
    // sightline band (x 120-280, z -45..15): the camera looks
    // west-northwest, so that band is the frame. Staging only; the
    // live game keeps its palms.
    if (g.city.palms) {
      const { trunks, crowns, spots } = g.city.palms;
      const zm = new THREE.Matrix4();
      spots.forEach((p, i) => {
        if (p.x > 120 && p.x < 280 && p.z > -45 && p.z < 15) {
          zm.makeScale(0, 0, 0);
          trunks.setMatrixAt(i, zm);
          crowns.setMatrixAt(i, zm);
        }
      });
      trunks.instanceMatrix.needsUpdate = true;
      crowns.instanceMatrix.needsUpdate = true;
    }
    // Compose the helicopter: up-northwest of the car, in frame, its cone
    // falling diagonally onto the car. FIX ROUND 6 — the fix-5 pose
    // (12 m west, 10 m north, 13.5 up) put the 9 m rotor ~24 m from the
    // camera and the beam filled the frame as a giant white wedge. The
    // heli now sits ~45 m out and 17 m up, so the rotor subtends ~11
    // deg and reads as a silhouette in the upper frame — and the beam
    // is restrained at staging (inner cone 0.25 -> 0.12, outer 0.07 ->
    // 0.03, pool 0.4 -> 0.18, hotspot smaller), so the searchlight
    // supports the chase instead of overwhelming it.
    // FIX ROUND 6 (finish): even that pose still read as a big heli
    // with a bright wedge in the revision-3 frame, so it goes further
    // out and higher (~52 m out, 20 m up) and the beam is restrained
    // again (cone 0.08, outer 0.02, pool 0.12).
    if (g.police.heli) {
      const hp = g.police.heli;
      hp.mesh.position.set(runCar.pos.x - 34, 20, runCar.pos.z - 38);
      hp.mesh.lookAt(runCar.pos.x, 0, runCar.pos.z);
      hp.pool.position.set(runCar.pos.x, 0.15, runCar.pos.z);
      const ud = hp.mesh.userData;
      if (ud.cone) ud.cone.material.opacity = 0.08;
      if (ud.coneOuter) ud.coneOuter.material.opacity = 0.02;
      if (ud.hotspot) ud.hotspot.scale.set(3.0, 3.0, 1);
      if (hp.pool) hp.pool.material.opacity = 0.12;
    }
    // Camera (FIX ROUND 6 finish): the fix-6 camera sat 10.7 m from
    // the hero, so the hero was a small slab and the astern chaser
    // matched it. The camera now sits ~8 m off the hero's rear
    // quarter, low (2.0 m) and south, looking west-northwest — the
    // hero's rear and sunlit south flank fill the right foreground
    // (fully in frame: the first finish pose clipped the hero's rear
    // off the right edge), the tucked chaser sits smaller up-road to
    // the left, the interceptor and the roadblock run away to the
    // left, and the ship and cranes stand on the right against the
    // sunset. fov 50: the hero holds its size while the chase still
    // fits the frame.
    g.cameraCtl.setShotPose([263, 2.0, 6.2], [252, 1.0, -1.0]);
    g.camera.fov = 50;
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
    // Enemy markers: small red downward triangles floating above the
    // two guards still standing, so the enemy side reads at a glance
    // (the target's red markers over its gunmen). The aim guard gets
    // none — the shot drops him, and a marker over a downed body
    // would float over the wrong thing.
    for (const gd of [guards[2], guards[4]]) {
      const marker = new THREE.Mesh(
        new THREE.ConeGeometry(0.35, 0.7, 4),
        new THREE.MeshBasicMaterial({ color: 0xff2a2a }),
      );
      marker.rotation.x = Math.PI;
      marker.position.set(gd.pos.x, 2.7, gd.pos.z);
      g.scene.add(marker);
    }
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
    // FIX ROUND 6 (finish): the bike sat at (56,131), 5 m from the
    // garage camera and hard against the panel edge, so it read as a
    // yellow box cut by the UI. Two metres west it sits fully in the
    // 3D view, parked in the bay clear of the car.
    // FIX ROUND 6 (finish 2): REVERTED — (54,132) lands almost
    // exactly on the camera's view axis, so the bike filled the
    // centre of the frame as a big yellow slab in front of the car.
    // Back at (56,131) it sits at the panel edge, small: a parked
    // bike in the bay, not a second hero.
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
    // FIX ROUND 6 — the worker stands by the door on the west side,
    // clear of the car's camera-side flank, so the three-quarter view
    // reads the car, not a bystander leaning on it.
    // FIX ROUND 6 (finish): the beachgoers stood at (44-62, 136-142)
    // — one of them 1.6 m from the garage camera at (57.5,136.5), so
    // it filled the frame's bottom-left corner as a giant orange blob.
    // They now stand west along the beach (34-52, 136-142), no one
    // within 5.5 m of the lens and none on the view axis: any that
    // fall in frame read as small figures outside the door, not
    // lens-fillers.
    const worker = g.peds.peds[0];
    worker.pos.set(47, 0, 131);
    worker.mesh.position.set(47, 0, 131);
    worker.mesh.rotation.set(0, worker.heading, 0);
    worker.mesh.position.y = 0;
    worker.mesh.visible = true;
    worker.state = 'walk';
    worker.idle = 0;
    for (let i = 0; i < 10; i++) {
      const p = g.peds.peds[1 + i];
      const x = 34 + i * 2;
      const z = 136 + (i % 3) * 3;
      p.pos.set(x, 0, z);
      p.mesh.position.set(x, 0, z);
      p.mesh.rotation.set(0, p.heading, 0);
      p.mesh.position.y = 0;
      p.mesh.visible = true;
      p.state = 'walk';
      p.idle = 0;
    }
    // Camera: FIX ROUND 6 — from the open front (south-east), looking
    // north-west across the car: the front-right three-quarter reads
    // as a sports car on the lift (grille, headlights, flank), the
    // two lift posts frame it instead of crossing it, and the tool
    // shelf and the mechanic sit behind it to the west. The fix-5
    // camera sat 3.5 m behind the car, so the car filled the frame
    // as a flat slab and a post crossed it as a blue wall.
    g.cameraCtl.setShotPose([57.5, 2.8, 136.5], [51.5, 1.0, 127.5]);
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
