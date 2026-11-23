// VERMILION KEYS — missions: 8 story jobs, data-driven state machine.
// Stage types: goto, chase, collect, survive, destroy, race, deliver,
// escape, fight. Each stage has text, a target, a radius and an optional
// timer; the system runs the beacon, the dialogue and the pass/fail rules.
// FIX ROUND 3 — JOB 5 is now MARKET CRACKDOWN, a real on-foot fight:
// five syndicate guards at the night market, a live HOSTILES DOWN
// counter, then secure the package. The old survive-and-wait job
// (THE DROP) proved nothing on a screenshot.
// FIX ROUND 5 — JOB 5 is now YARD AMBUSH: six syndicate guards in the
// container yard at midday, the fight frame's daylight shootout. A job
// also earns its medal and its district now: gold if the job finishes
// inside its par time at full health, and the district where the job
// completes gains standing (one job takes a district). Both feed the
// nine-track activity registry, never typed numbers.

import * as THREE from 'three';
import { Car } from '../entities/vehicle.js';
import { clamp } from '../util.js';
import { districtAt } from '../world/cityLayout.js';

export const MISSIONS = [
  {
    id: 1, name: 'BAGMAN', giver: 'Zia', giverRole: 'DRIVER',
    briefing: 'First job, runner. Pick up the package at the marina and bring it to the safehouse. No cops, no noise.',
    reward: 800, respect: 60, par: 240,
    stages: [
      { type: 'goto', text: 'Pick up the package at the marina', x: 60, z: -128, radius: 6 },
      { type: 'deliver', text: 'Deliver the package to the safehouse', x: 60, z: 138, radius: 7, time: 150 },
    ],
  },
  {
    id: 2, name: 'HOT WHEELS', giver: 'Lo', giverRole: 'MECHANIC',
    briefing: 'A courier is running product through downtown in a muscle car. Chase him down, ram him till he stops, take the case.',
    reward: 1200, respect: 80, par: 300,
    stages: [
      { type: 'chase', text: 'Chase the courier — ram him until he stops', target: 'courier', radius: 6, time: 180 },
      { type: 'collect', text: 'Grab the case from the wreck', radius: 5 },
    ],
  },
  {
    id: 3, name: 'LOSE THE HEAT', giver: 'Kiki', giverRole: 'LOOKOUT',
    briefing: 'The Keys PD is all over you. Break line of sight, let the heat die, then slip to the hospital hideout.',
    reward: 1000, respect: 80, par: 300,
    stages: [
      { type: 'escape', text: 'Break line of sight — lose the cops', time: 150 },
      { type: 'goto', text: 'Reach the hospital hideout', x: -280, z: 128, radius: 8 },
    ],
  },
  {
    id: 4, name: 'DOCKSIDE', giver: 'Zia', giverRole: 'DRIVER',
    briefing: 'A container truck at the port is carrying syndicate cash. Steal it, bring it to the garage. The PD will notice.',
    reward: 2000, respect: 110, par: 360,
    stages: [
      { type: 'goto', text: 'Reach the container truck at the port', x: 380, z: -150, radius: 8 },
      { type: 'deliver', text: 'Drive the truck to the garage — stay alive', x: 52, z: 128, radius: 8, time: 210, wanted: 2 },
    ],
  },
  {
    id: 5, name: 'YARD AMBUSH', giver: 'Kiki', giverRole: 'LOOKOUT',
    briefing: 'The syndicate runs the container yard at the port. Clear their guards and secure the package — the PD will hear the shots.',
    reward: 1800, respect: 110, par: 300,
    stages: [
      { type: 'fight', text: 'Eliminate the syndicate guards', count: 6, time: 180 },
      { type: 'goto', text: 'Secure the yard package', x: 390, z: -166, radius: 5 },
    ],
  },
  {
    id: 6, name: 'RIVAL DOWN', giver: 'Lo', giverRole: 'MECHANIC',
    briefing: 'A rival hitter is waiting in the old town. Reach him and put him down — drive-by or on foot, your call.',
    reward: 2500, respect: 140, par: 300,
    stages: [
      { type: 'goto', text: 'Reach the old town meet', x: 380, z: 80, radius: 8 },
      { type: 'destroy', text: 'Take out the rival', target: 'rival', radius: 30, time: 180 },
    ],
  },
  {
    id: 7, name: 'GRAND PRIX', giver: 'Zia', giverRole: 'DRIVER',
    briefing: 'Street race, eight gates, three rivals, one pot. Beat the clock and beat them. No shortcuts — the gates are the route.',
    reward: 3000, respect: 160, par: 300,
    stages: [
      { type: 'race', text: 'Race the gates — 8 to go', time: 165 },
    ],
  },
  {
    id: 8, name: 'KINGPIN', giver: 'Marco', giverRole: 'SYNDICATE',
    briefing: 'Last job. Hit the syndicate cars at the port, then run — the drawbridge is up, so you leap it. Do not stop. Do not look back.',
    reward: 5000, respect: 220, par: 420,
    stages: [
      { type: 'destroy', text: 'Destroy the syndicate cars at the port', target: 'syndicate', count: 3, radius: 60, time: 240 },
      { type: 'escape', text: 'Lose the cops — then leap the drawbridge', time: 150 },
      { type: 'goto', text: 'Reach the safehouse — you are the Kingpin now', x: 60, z: 138, radius: 8 },
    ],
  },
];

const RACE_GATES = [
  { x: -70, z: 0 }, { x: -20, z: 0 }, { x: 60, z: 0 }, { x: 140, z: 0 },
  { x: 200, z: 110 }, { x: 140, z: 110 }, { x: 60, z: 110 }, { x: -20, z: 110 },
];

// Container-yard guard posts (fixed, deterministic): four in the open
// aisle between the road and the north container row, one crouched
// behind the row gap, one at the far east end.
const YARD_GUARDS = [
  { x: 388, z: -164, cover: false },
  { x: 394, z: -166, cover: false },
  { x: 400, z: -164, cover: false },
  { x: 406, z: -166, cover: false },
  { x: 390, z: -170, cover: true },
  { x: 410, z: -164, cover: false },
];

export class MissionSystem {
  constructor(game) {
    this.game = game;
    this.active = null; // {def, stage, timer, totalTimer, data}
    this.completed = new Set();
    // 3D objective beacon: a gold column (NormalBlending, not additive —
    // the additive cylinder read WHITE in daylight/golden hour). Saturated
    // gold core, toneMapped false so the gold stays saturated in the
    // golden-hour light; a darker rim cylinder as a child so it follows
    // the beacon's position/visibility/scale automatically.
    const geo = new THREE.CylinderGeometry(2.2, 2.2, 26, 12, 1, true);
    this.beacon = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({ color: 0xffc21a, transparent: true, opacity: 0.35, blending: THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    const rimGeo = new THREE.CylinderGeometry(2.6, 2.6, 26, 12, 1, true);
    const rim = new THREE.Mesh(
      rimGeo,
      new THREE.MeshBasicMaterial({ color: 0x8a5a10, transparent: true, opacity: 0.35, blending: THREE.NormalBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    );
    this.beacon.add(rim);
    this.beacon.visible = false;
    game.scene.add(this.beacon);
    this.marker = new THREE.Mesh(
      new THREE.CircleGeometry(3, 20),
      new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.5 }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.visible = false;
    game.scene.add(this.marker);
  }

  get current() {
    return this.active ? this.active.def : null;
  }

  get stage() {
    return this.active ? this.active.def.stages[this.active.stage] : null;
  }

  get stageText() {
    const s = this.stage;
    if (!s) return '';
    if (s.type === 'race') return `Race the gates — ${8 - this.active.gate} of 8 left`;
    if (s.type === 'destroy' && s.count) return `${s.text} (${this.active.kills}/${s.count})`;
    if (s.type === 'fight') return `${s.text} — ${this.active.kills}/${s.count} DOWN`;
    return s.text;
  }

  get stageTarget() {
    if (!this.active) return null;
    const s = this.stage;
    if (!s) return null;
    if (s.type === 'chase' && this.active.chaseCar) return { x: this.active.chaseCar.pos.x, z: this.active.chaseCar.pos.z };
    if (s.type === 'destroy' && this.active.targets?.length) {
      const t = this.active.targets.find((t) => !t.dead);
      if (t) return { x: t.pos.x, z: t.pos.z };
    }
    if (s.type === 'fight' && this.active.guards?.length) {
      const t = this.active.guards.find((p) => p.state !== 'down');
      if (t) return { x: t.pos.x, z: t.pos.z };
    }
    if (s.type === 'race') {
      const g = RACE_GATES[this.active.gate];
      if (g) return g;
    }
    if (s.x !== undefined) return { x: s.x, z: s.z };
    return null;
  }

  start(id) {
    const def = MISSIONS.find((m) => m.id === id);
    if (!def || this.active) return false;
    this.active = { def, stage: 0, timer: 0, totalTimer: 0, gate: 0, kills: 0, chaseCar: null, targets: [], guards: [], data: {} };
    this.setupStage();
    this.game.hud?.showDialogue(def.giver, def.giverRole, def.briefing);
    this.game.hud?.banner('JOB ' + def.id + ' — ' + def.name, def.briefing);
    this.game.audio?.blip('mission');
    return true;
  }

  setupStage() {
    const s = this.stage;
    if (!s) return;
    this.active.timer = 0;
    if (s.type === 'chase') {
      // The courier: a fast muscle car that flees along the roads.
      const car = new Car(this.game, 'muscle', 0xd9b380, -280, 0, Math.PI / 2);
      car.chaseTarget = true;
      this.active.chaseCar = car;
      this.game.hud?.showDialogue('Lo', 'MECHANIC', 'There he is — the gold muscle car. Ram him till he stops!');
    }
    if (s.type === 'destroy') {
      const spots = s.target === 'syndicate'
        ? [{ x: 340, z: -160 }, { x: 400, z: -160 }, { x: 460, z: -150 }]
        : [{ x: 380, z: 80 }];
      this.active.targets = spots.map((p) => {
        const car = new Car(this.game, 'sedan', 0x1a1a20, p.x, p.z, 0);
        car.targetCar = true;
        return car;
      });
      this.active.kills = 0;
    }
    if (s.type === 'fight') {
      // Six syndicate guards in the container yard. They hold their post
      // and stay down when shot — the mission counts them.
      this.active.guards = YARD_GUARDS.map((p) => this.game.peds.spawnGuard(p.x, p.z, 0, p.cover));
      this.active.kills = 0;
      // The yard is loud: the PD is already on its way.
      this.game.police.addHeat(20, 'yard ambush');
    }
    if (s.type === 'survive') {
      // Kiki waits at the drop point; police waves come to her.
      this.game.police.addHeat(40, 'drop ambush');
    }
    if (s.wanted) {
      this.game.police.addHeat(s.wanted * 20, 'mission heat');
    }
    if (s.type === 'escape') {
      this.game.police.addHeat(45, 'mission heat');
    }
  }

  advance() {
    const a = this.active;
    a.stage++;
    if (a.stage >= a.def.stages.length) {
      this.complete();
      return;
    }
    this.setupStage();
    const s = this.stage;
    this.game.hud?.showDialogue(a.def.giver, a.def.giverRole, s.text);
  }

  fail(reason) {
    if (!this.active) return;
    const def = this.active.def;
    this.teardown();
    this.game.hud?.banner('JOB FAILED — ' + def.name, reason);
    this.game.audio?.blip('fail');
  }

  complete() {
    const a = this.active;
    const def = a.def;
    // Gold medal: the whole job inside its par time, at full health.
    // District standing: the job completes in the district the player
    // is standing in — one job takes a district.
    const p = this.game.player;
    const px = p.inCar ? p.inCar.pos.x : p.pos.x;
    const pz = p.inCar ? p.inCar.pos.z : p.pos.z;
    const gold = (a.totalTimer || 0) <= (def.par || 9999) && p.health >= 100;
    this.game.activities?.recordMedal(gold);
    this.game.districts?.recordJobComplete(districtAt(px, pz).id);
    this.game.progression.addCash(def.reward);
    this.game.progression.addRespect(def.respect);
    this.game.progression.missionsDone.add(def.id);
    if (def.id === 7) this.game.progression.recordRaceWin();
    this.game.progression.save();
    this.teardown();
    this.game.hud?.banner('JOB COMPLETE — ' + def.name, `+V$${def.reward}  •  +${def.respect} respect`);
    this.game.hud?.showDialogue(def.giver, def.giverRole, 'Clean. The money is yours. Next job when you are ready.');
    this.game.audio?.blip('pass');
  }

  teardown() {
    if (this.active?.chaseCar) this.active.chaseCar.remove();
    if (this.active?.targets) for (const t of this.active.targets) t.remove();
    if (this.active?.guards) for (const p of this.active.guards) this.game.peds.removePed(p);
    this.active = null;
    this.beacon.visible = false;
    this.marker.visible = false;
  }

  update(dt) {
    if (!this.active) {
      this.beacon.visible = false;
      this.marker.visible = false;
      return;
    }
    const a = this.active;
    const s = this.stage;
    const player = this.game.player;
    const pPos = player.inCar ? player.inCar.pos : player.pos;
    a.timer += dt;
    a.totalTimer = (a.totalTimer || 0) + dt;

    // Stage timer.
    if (s.time && a.timer > s.time) {
      this.fail('Out of time.');
      return;
    }
    // Player death fails the job.
    if (player.dead) {
      this.fail('You went down.');
      return;
    }

    // Beacon follows the current target.
    const target = this.stageTarget;
    if (target) {
      this.beacon.visible = true;
      this.beacon.position.set(target.x, 13, target.z);
      this.beacon.rotation.y += dt;
      this.beacon.material.opacity = 0.28 + Math.sin(this.game.time * 4) * 0.1;
      this.marker.visible = true;
      this.marker.position.set(target.x, 0.1, target.z);
    } else {
      this.beacon.visible = false;
      this.marker.visible = false;
    }

    switch (s.type) {
      case 'goto':
      case 'deliver': {
        if (Math.hypot(pPos.x - s.x, pPos.z - s.z) < s.radius) this.advance();
        break;
      }
      case 'collect': {
        if (this.active.chaseCar && this.active.chaseCar.dead) {
          if (Math.hypot(pPos.x - this.active.chaseCar.pos.x, pPos.z - this.active.chaseCar.pos.z) < s.radius) {
            this.advance();
          }
        }
        break;
      }
      case 'chase': {
        const c = this.active.chaseCar;
        if (!c) break;
        // Courier flees: steer away from the player along the roads.
        const dx = c.pos.x - pPos.x;
        const dz = c.pos.z - pPos.z;
        const want = Math.atan2(dx, dz);
        let dh = (want - c.heading) % (Math.PI * 2);
        if (dh > Math.PI) dh -= Math.PI * 2;
        if (dh < -Math.PI) dh += Math.PI * 2;
        c.update(dt, { throttle: 1, steer: clamp(dh * 2, -1, 1), handbrake: false });
        if (c.dead) {
          this.game.hud?.showDialogue('Lo', 'MECHANIC', 'He is done. Grab the case from the wreck.');
          this.advance();
        }
        break;
      }
      case 'escape': {
        if (this.game.police.stars === 0) this.advance();
        break;
      }
      case 'survive': {
        // Waves of police keep coming; survive the timer.
        if (a.timer > s.time) this.advance();
        else if (Math.floor(a.timer) % 20 === 0 && a.timer - dt < Math.floor(a.timer)) {
          this.game.police.spawnUnit('cruiser');
        }
        break;
      }
      case 'fight': {
        // Guards down count live; the stage clears when all six are down.
        const down = this.active.guards.filter((p) => p.state === 'down').length;
        this.active.kills = down;
        if (s.count && down >= s.count) this.advance();
        break;
      }
      case 'destroy': {
        const alive = this.active.targets.filter((t) => !t.dead);
        this.active.kills = this.active.targets.length - alive.length;
        if (s.count && this.active.kills >= s.count) {
          this.advance();
        } else if (!s.count && alive.length === 0) {
          this.advance();
        }
        break;
      }
      case 'race': {
        const g = RACE_GATES[a.gate];
        if (g && Math.hypot(pPos.x - g.x, pPos.z - g.z) < 10) {
          a.gate++;
          this.game.audio?.blip('gate');
          if (a.gate >= RACE_GATES.length) this.advance();
        }
        break;
      }
    }
  }
}
