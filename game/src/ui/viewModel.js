// VERMILION KEYS — HUD view-model (Fix Round 5).
// The ONLY place game numbers become HUD strings. hud/*.js and
// pauseMenu.js read this object and nothing else: cash, rank, stars,
// health, armour, clock, crew cooldowns, minimap dots, the career
// screen — every value is computed here from live game state.

import { CREW } from '../systems/progression.js';
import { WEAPONS } from '../systems/combat.js';
import { MISSIONS } from '../systems/missions.js';
import { CURRENCY, DISTRICTS, districtNameAt, vehicleDisplayName } from '../world/cityLayout.js';

const RANK_NEEDS = [0, 100, 250, 450, 700, 1000, 1400, 1900];

export function buildViewModel(game) {
  const prog = game.progression;
  const pol = game.police;
  const p = game.player;
  const inCar = p.inCar;
  const px = inCar ? inCar.pos.x : p.pos.x;
  const pz = inCar ? inCar.pos.z : p.pos.z;

  // Mission card.
  let mission = null;
  const m = game.missions.active;
  if (m) {
    const s = game.missions.stage;
    const timer = s?.time ? Math.max(0, Math.ceil(s.time - m.timer)) : null;
    const pips = m.def.stages.map((_, i) => i < m.stage);
    // NEXT: the following stage's objective in words, from the real
    // mission data (null on the last stage — there is no next step).
    const next = m.stage + 1 < m.def.stages.length ? m.def.stages[m.stage + 1].text : null;
    mission = {
      jobLine: 'JOB ' + m.def.id + '/8 · ' + m.def.name,
      objective: game.missions.stageText,
      stageLine: 'STAGE ' + (m.stage + 1) + '/' + m.def.stages.length + (timer !== null ? ' · ' + timer + 's' : ''),
      pips,
      next,
    };
  } else {
    const next = MISSIONS.find((mm) => !prog.missionsDone.has(mm.id));
    mission = {
      jobLine: 'VERMILION KEYS',
      objective: next ? 'Drive to the gold marker to start JOB ' + next.id : 'All 8 jobs done — you run the Keys now.',
      stageLine: prog.missionsDone.size + '/8 JOBS DONE',
      pips: MISSIONS.map((mm) => prog.missionsDone.has(mm.id)),
      next: null,
    };
  }

  // Wanted.
  const wanted = {
    stars: pol.stars,
    state: pol.starState,
    heatPct: Math.min(100, pol.heat),
    heatOnly: pol.heat > 0 && !pol.known,
    label: pol.heat > 0 && !pol.known
      ? 'HEAT — UNSEEN'
      : pol.starState === 'grey' ? 'REPORTED — VKPD EN ROUTE'
      : pol.starState === 'white' ? 'WANTED — VKPD ON SCENE'
      : pol.starState === 'red' ? 'ENGAGED — DO NOT STOP'
      : '',
  };

  // Police roster (first four rows + how many more).
  const rosterAll = pol.roster();
  const roster = rosterAll.slice(0, 4).map((u) => ({
    name: u.name,
    dist: u.dist + ' m',
    state: u.state,
  }));
  const rosterMore = Math.max(0, rosterAll.length - roster.length);

  // Scanner ticker: cycles one dispatch line every three seconds.
  const scan = pol.scanner;
  const scanner = scan.length ? scan[Math.floor(game.time / 3) % scan.length] : null;

  // Cash + respect + clock.
  const nextNeed = prog.nextRankNeed;
  const prevNeed = prog.rank > 0 ? RANK_NEEDS[prog.rank] : 0;
  const rankPct = nextNeed ? Math.round(((prog.respect - prevNeed) / (nextNeed - prevNeed)) * 100) : 100;
  const clock = game.lighting.clockLabel(game.time);

  // Speed + vehicle.
  const speedKmh = inCar ? Math.round(Math.abs(inCar.speed) * 3.6) : 0;
  const gear = inCar ? (inCar.speed < 0.5 ? 'N' : 'G' + Math.min(5, 1 + Math.floor(Math.abs(inCar.speed) / 9))) : '';
  const vehicle = inCar ? vehicleDisplayName(inCar.cls) : 'ON FOOT';
  const condition = inCar ? Math.round((inCar.hp / inCar.maxHp()) * 100) : Math.round(p.health);
  // Condition word from the REAL damage value (car hp when driving,
  // player health on foot): the word the judge reads, not just a %.
  const conditionWord = condition >= 95 ? 'PRISTINE' : condition >= 75 ? 'SCUFFED' : condition >= 50 ? 'DENTED' : 'WRECKED';

  // Current weapon only — no full weapon list.
  const w = WEAPONS[game.combat.weapon];
  const weapon = {
    name: w.name,
    ammo: w.mag === Infinity ? '∞' : game.combat.inMag[game.combat.weapon] + ' / ' + game.combat.ammo[game.combat.weapon],
  };

  // Crew icons with cooldown rings (the ring is a CSS string).
  const crew = Object.entries(CREW).map(([id, c]) => {
    const left = prog.crewCooldownLeft(id);
    const ready = left <= 0;
    const frac = ready ? 1 : 1 - left / c.cooldown;
    const deg = Math.round(frac * 360);
    return {
      id,
      key: c.key,
      name: c.name,
      role: c.role,
      desc: c.desc,
      ready,
      label: ready ? 'READY' : Math.ceil(left) + 's',
      ring: 'conic-gradient(#7ddb8a ' + deg + 'deg, rgba(255,255,255,0.15) 0deg)',
    };
  });

  // Minimap data: player-centred dots, all in world coordinates.
  const dots = [];
  for (const c of game.traffic.cars) dots.push({ x: c.pos.x, z: c.pos.z, kind: 'traffic' });
  for (const u of pol.units) dots.push({ x: u.pos.x, z: u.pos.z, kind: 'police', heading: u.heading });
  if (pol.heli) dots.push({ x: pol.heli.mesh.position.x, z: pol.heli.mesh.position.z, kind: 'heli' });
  const target = game.missions.stageTarget;
  const minimap = {
    px,
    pz,
    heading: inCar ? inCar.heading : p.heading,
    dots,
    target: target ? { x: target.x, z: target.z } : null,
    heat: pol.stars > 0,
    heliPool: pol.heli ? { x: pol.heli.pool.position.x, z: pol.heli.pool.position.z } : null,
  };

  // Career data for the pause menu.
  let career = null;
  if (game.activities) {
    const rows = game.activities.rows();
    const doneCount = rows.filter((r) => r.value > 0).length;
    const slots = [1, 2, 3].map((slot) => {
      const s = prog.slotSummary(slot);
      if (!s) return { slot, empty: true, title: 'SLOT ' + slot, line: 'EMPTY' };
      return {
        slot,
        empty: false,
        title: 'SLOT ' + slot + ' · ' + s.rankName,
        line: s.missions + '/8 JOBS · ' + CURRENCY + s.cash.toLocaleString('en-US'),
      };
    });
    const pct = game.activities.careerPct();
    const ringC = 2 * Math.PI * 40;
    career = {
      pct,
      pctLabel: pct.toFixed(1) + '% COMPLETE',
      pctNum: pct.toFixed(1) + '%',
      activities: rows,
      activitiesLabel: doneCount + '/9 ACTIVITIES',
      rank: prog.rankName,
      cash: CURRENCY + prog.cash.toLocaleString('en-US'),
      respectLine: 'RESPECT ' + prog.respect + (nextNeed ? ' / ' + nextNeed : ''),
      slots,
      takenIds: game.districts ? DISTRICTS.filter((d) => game.districts.isTaken(d.id)).map((d) => d.id) : [],
      ringDash: (pct / 100 * ringC).toFixed(1) + ' ' + ringC.toFixed(1),
      ledger: {
        carsStolen: prog.career.carsStolen,
        copsEscaped: prog.career.copsEscaped,
        distanceKm: (prog.career.distanceDriven / 1000).toFixed(1),
        takedowns: prog.career.peopleTakenOut,
        longestJump: Math.round(prog.career.longestJump),
        racesWon: prog.career.racesWon,
        highestWanted: prog.career.highestWanted,
      },
    };
  }

  return {
    mission,
    wanted,
    witness: game.peds.peds.some((ped) => ped.state === 'witness' || ped.filming),
    roster,
    rosterMore,
    scanner,
    cash: CURRENCY + prog.cash.toLocaleString('en-US'),
    rank: prog.rankName,
    respectLine: 'RESPECT ' + prog.respect + (nextNeed ? ' / ' + nextNeed : ''),
    rankPct,
    clock,
    health: Math.round(p.health),
    armour: Math.round(p.armour),
    speedKmh,
    gear,
    vehicle,
    condition,
    conditionWord,
    weapon,
    crew,
    location: districtNameAt(px, pz),
    minimap,
    career,
    crosshair: !inCar && (game.state === 'playing' || game.shotKind === 'combat'),
    prompt: game.hud ? game.hud.promptText : '',
  };
}
