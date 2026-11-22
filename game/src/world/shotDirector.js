// VERMILION KEYS — shot director (Fix Round 5).
// Stages the ONE consistent run every frame comes from, and dumps the
// live state each shot freezes with. The run: jobs 1-7 done across six
// districts, four hot-car exports, three causeway flares, three stunt
// leaps, nine crew uses, three live save slots. It lands at 74.5%
// career (see activityRegistry.js) with V$13,850 and ENFORCER rank.
// The cover then starts JOB 8 on top of this run; the garage buys the
// engine tune on top of it; the combat frame is the same run at JOB 5.

import { Car } from '../entities/vehicle.js';
import { countNear } from './density_spawner.js';
import { buildViewModel } from '../ui/viewModel.js';

// Districts where each job completes (player teleported there first,
// so district standing increments from the real complete() event).
// Jobs 2 and 4 both complete in Bazaar Quay — that is why the run
// takes six districts, not seven.
const JOB_DISTRICT_SPOTS = {
  1: [60, -128],
  2: [60, 128],
  3: [-280, 128],
  4: [52, 128],
  5: [390, -160],
  6: [380, 80],
  7: [60, 0],
};

function driveScript(game, throttle, steer, ticks, until) {
  game.scriptedDrive = { throttle, steer, handbrake: false };
  let n = 0;
  for (let i = 0; i < ticks; i++) {
    game.stepSim(1 / 60);
    n++;
    if (until && until()) break;
  }
  game.scriptedDrive = null;
  return n;
}

export function completeJob(game, id) {
  const spot = JOB_DISTRICT_SPOTS[id];
  if (spot) game.player.spawn(spot[0], spot[1], 0);
  game.missions.start(id);
  game.missions.complete();
}

export function stageRun(game) {
  const g = game;
  const prog = g.progression;
  g.city.bridge.forceUp = true;

  // Jobs 1-2, then the earliest save (SLOT 3: 2/8, V$2,250).
  completeJob(g, 1);
  completeJob(g, 2);
  prog.save(3);
  // Jobs 3-4, then the mid save (SLOT 2: 4/8, V$5,250).
  completeJob(g, 3);
  completeJob(g, 4);
  prog.save(2);
  // Jobs 5-7. Job 7's completion records the first race win.
  completeJob(g, 5);
  completeJob(g, 6);
  completeJob(g, 7);
  // Two more race wins on the record (Street Races 3/3).
  prog.recordRaceWin();
  prog.recordRaceWin();

  // Four hot-car exports: steal a traffic car, drive it east into the
  // EXPORT gate at (430, -160). The export event itself pays V$250.
  for (let e = 0; e < 4; e++) {
    const before = g.activities.exports;
    const car = g.traffic.cars.find((c) => !c.dead && c.traffic);
    if (!car) break;
    g.player.spawn(390, -156, 0);
    g.traffic.steal(car);
    prog.recordCarStolen();
    car.exportCandidate = true;
    g.player.enterCar(car);
    car.pos.set(390, 0, -160);
    car.heading = Math.PI / 2;
    car.speed = 12;
    car.syncMesh();
    driveScript(g, 1, 0, 240, () => g.activities.exports > before);
  }
  if (g.player.inCar) g.player.exitCar();

  // Three stunt leaps on the causeway in the run car. The first pass
  // also collects the three causeway flares (Contraband 3/10).
  const runCar = new Car(g, 'sports', 0xff7a55, 290, 0, -Math.PI / 2);
  runCar.speed = 30;
  g.player.enterCar(runCar);
  for (let pass = 0; pass < 3; pass++) {
    runCar.pos.set(290, 0, 0);
    runCar.heading = -Math.PI / 2;
    runCar.speed = 30;
    runCar.airborne = false;
    runCar.vy = 0;
    runCar.syncMesh();
    driveScript(g, 1, 0, 420, () => runCar.pos.x < 195);
  }

  // Nine crew uses: each of the three crew twice more after the first
  // use (Crew Loyalty 9/9). Cooldowns are reset between uses in staging
  // so the uses themselves stay real useCrew() calls.
  for (const id of ['mira', 'lo', 'kiki']) {
    for (let i = 0; i < 3; i++) {
      prog.crewUsed[id] = -999;
      prog.useCrew(id);
    }
  }

  // Latest save (SLOT 1: 7/8, V$13,850, ENFORCER, 74.5%).
  prog.save(1);
  g.hud.clearBanner();
  return { runCar };
}

export function countVisible(game, x, z, r) {
  return countNear(game, x, z, r);
}

// Freeze the live state into window.__stateDump for the T1/T8 probes:
// HUD text scraped from the DOM, the view-model numbers, the activity
// registry, and the density counts around the shot's focus point.
export function dumpState(game, kind, focus) {
  const vm = buildViewModel(game);
  const hudText = {};
  const read = (id) => {
    const el = document.getElementById(id);
    return el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  };
  for (const id of ['mission-card', 'wanted', 'cash-box', 'speed-box', 'location', 'police-roster', 'scanner-ticker', 'witness-banner']) {
    hudText[id] = read(id);
  }
  const counts = focus ? countNear(game, focus.x, focus.z, focus.r) : null;
  const dump = {
    kind,
    cash: game.progression.cash,
    cashLabel: vm.cash,
    rank: vm.rank,
    respect: game.progression.respect,
    jobsDone: game.progression.missionsDone.size,
    careerPct: game.activities ? game.activities.careerPct() : null,
    activities: game.activities ? game.activities.values() : null,
    health: vm.health,
    armour: vm.armour,
    clock: vm.clock,
    stars: vm.wanted.stars,
    starState: vm.wanted.state,
    units: game.police.units.length,
    traffic: game.traffic.cars.length,
    peds: game.peds.peds.length,
    stunts: game.activities ? game.activities.stunts : null,
    exports: game.activities ? game.activities.exports : null,
    flares: game.activities ? game.activities.flares : null,
    medals: game.activities ? game.activities.medals : null,
    crewUses: game.activities ? game.activities.crewUses : null,
    takeovers: game.districts ? game.districts.takeovers() : null,
    counts,
    hudText,
    minimap: vm.minimap,
  };
  window.__stateDump = dump;
  return dump;
}
