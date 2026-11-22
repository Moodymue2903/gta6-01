// VERMILION KEYS — progression: cash, respect ranks, garage, saves.
// Crew perks run on cooldowns: Mira swaps plates (drops heat), Lo fixes
// the car, Kiki reveals every police unit on the minimap.
// FIX ROUND 3 — the career is a real ledger, not a number:
//   * career stats (cars stolen, escapes, distance, takedowns, jumps,
//     races won, highest wanted) are recorded by the systems that earn
//     them and read by the career screen — never typed into the DOM.
//   * three real save slots (save/load/summary), each a full state.
//   * garage upgrades are real purchases: check cash -> deduct -> apply
//     to the car's tune -> save. Multipliers are modest and capped.
// FIX ROUND 5 — the Motor Works price list carries its display names
// (Twin-Turbo, Kevlar Plates, Drift Suspension, Chameleon Respray,
// Full Repair), and the save carries the activity registry and the
// district standing with it, so a reloaded career keeps its 74.5%.

const SAVE_KEY = 'vk-save-v1';

export const RANKS = [
  { name: 'ROOKIE', need: 0 },
  { name: 'WHEELMAN', need: 100 },
  { name: 'BAGMAN', need: 250 },
  { name: 'HUSTLER', need: 450 },
  { name: 'ENFORCER', need: 700 },
  { name: 'SHOT CALLER', need: 1000 },
  { name: 'FIXER', need: 1400 },
  { name: 'KINGPIN', need: 1900 },
];

export const CREW = {
  mira: { name: 'Mira', role: 'DRIVER', key: 'Z', cooldown: 90, desc: 'Swap plates — drops one wanted star' },
  lo: { name: 'Lo', role: 'MECHANIC', key: 'X', cooldown: 60, desc: 'Quick fix — repairs your car to full' },
  kiki: { name: 'Kiki', role: 'LOOKOUT', key: 'C', cooldown: 90, desc: 'Eyes out — reveals all police for 20s' },
};

// VERMILION MOTOR WORKS — the garage price list. Upgrades apply to the
// car you arrived in; respray also clears unseen Heat (a fresh coat
// and new plates make the car a different car to the cameras).
export const UPGRADES = [
  { id: 'engine', name: 'Twin-Turbo', price: 4000, desc: '+8% top speed', max: 3 },
  { id: 'armour', name: 'Kevlar Plates', price: 3000, desc: '+25% max condition', max: 3 },
  { id: 'handling', name: 'Drift Suspension', price: 2500, desc: '+10% grip', max: 3 },
  { id: 'respray', name: 'Chameleon Respray', price: 450, desc: 'New paint — clears unseen Heat', max: 99 },
  { id: 'repair', name: 'Full Repair', price: 300, desc: 'Restore condition to full', max: 99 },
];

const PAINTS = [0xff6a4a, 0x3a7ad9, 0xe8c93a, 0x2ea88a, 0xd97bd9, 0xe8e8e8, 0xd97b2e, 0x8a6ad9];

export class Progression {
  constructor(game) {
    this.game = game;
    this.cash = 250;
    this.respect = 0;
    this.missionsDone = new Set();
    this.ownedCars = []; // {cls, color} stored at the garage
    this.crewUsed = { mira: -999, lo: -999, kiki: -999 };
    this.revealUntil = 0;
    // Tune from the save, held until the starter car exists — see
    // restoreTune(). The tune lives on the car in memory, so the save
    // has to carry it and the Game has to apply it after the car is built.
    this._savedTune = null;
    // Activity registry + district standing from the save, held until
    // the Game builds those systems (same deferred pattern as the tune).
    this._savedActivities = null;
    this._savedDistricts = null;
    // Career ledger — every counter is written by the system that earns it.
    this.career = {
      carsStolen: 0,
      copsEscaped: 0,
      distanceDriven: 0, // metres
      peopleTakenOut: 0,
      longestJump: 0, // metres
      racesWon: 0,
      highestWanted: 0,
    };
    this.load();
  }

  get rank() {
    let r = 0;
    for (let i = 0; i < RANKS.length; i++) {
      if (this.respect >= RANKS[i].need) r = i;
    }
    return r;
  }

  get rankName() {
    return RANKS[this.rank].name;
  }

  get nextRankNeed() {
    return this.rank + 1 < RANKS.length ? RANKS[this.rank + 1].need : null;
  }

  addCash(n) {
    this.cash += n;
  }

  addRespect(n) {
    const before = this.rank;
    this.respect += n;
    if (this.rank > before) {
      this.game.hud?.banner('RANK UP — ' + RANKS[this.rank].name, 'The Keys know your name now.');
      this.game.audio?.blip('rank');
    }
  }

  // --- Career ledger (called by the systems that earn each stat). ---
  recordCarStolen() { this.career.carsStolen++; }
  recordEscape() { this.career.copsEscaped++; }
  recordDistance(m) { this.career.distanceDriven += m; }
  recordTakedown() { this.career.peopleTakenOut++; }
  recordRaceWin() { this.career.racesWon++; }
  recordJump(m) {
    if (m > this.career.longestJump) this.career.longestJump = m;
  }
  noteWanted(stars) {
    if (stars > this.career.highestWanted) this.career.highestWanted = stars;
  }

  crewReady(id) {
    return this.game.time - this.crewUsed[id] >= CREW[id].cooldown;
  }

  crewCooldownLeft(id) {
    return Math.max(0, CREW[id].cooldown - (this.game.time - this.crewUsed[id]));
  }

  useCrew(id) {
    if (!this.crewReady(id)) return false;
    this.crewUsed[id] = this.game.time;
    // Crew Loyalty: every real use counts (FIX ROUND 5).
    this.game.activities?.recordCrewUse();
    const player = this.game.player;
    if (id === 'mira') {
      this.game.police.heat = Math.max(0, this.game.police.heat - 22);
      this.game.police.stars = this.game.police.heat <= 0 ? 0 : Math.min(5, Math.ceil(this.game.police.heat / 20));
      this.game.hud?.showDialogue('Mira', 'DRIVER', 'Plates swapped. They are looking for a different car now.');
    } else if (id === 'lo') {
      if (player.inCar) player.inCar.repair();
      player.heal(25);
      this.game.hud?.showDialogue('Lo', 'MECHANIC', 'Patched up. Good as new — do not scratch it again.');
    } else if (id === 'kiki') {
      this.revealUntil = this.game.time + 20;
      this.game.hud?.showDialogue('Kiki', 'LOOKOUT', 'Eyes out. Every unit in the Keys is on your map.');
    }
    this.game.audio?.blip('crew');
    return true;
  }

  storeCar(cls, color) {
    if (this.ownedCars.length >= 3) return false;
    this.ownedCars.push({ cls, color });
    this.save();
    return true;
  }

  // --- Garage: real purchases against the car you arrived in. ---
  garageCar() {
    return this.game.player.inCar || this.game.starterCar;
  }

  upgradeLevel(id) {
    const car = this.garageCar();
    if (!car || !car.tune) return 0;
    if (id === 'respray' || id === 'repair') return 0;
    return car.tune[id] || 0;
  }

  buyUpgrade(id) {
    const def = UPGRADES.find((u) => u.id === id);
    const car = this.garageCar();
    if (!def || !car) return { ok: false, why: 'No car at the garage.' };
    if (this.cash < def.price) return { ok: false, why: 'Not enough cash.' };
    if (id !== 'respray' && id !== 'repair' && (car.tune[id] || 0) >= def.max) {
      return { ok: false, why: 'Already maxed.' };
    }
    this.cash -= def.price;
    if (id === 'engine') car.tune.engine = (car.tune.engine || 0) + 1;
    else if (id === 'armour') {
      car.tune.armour = (car.tune.armour || 0) + 1;
      car.hp = car.maxHp();
    } else if (id === 'handling') car.tune.handling = (car.tune.handling || 0) + 1;
    else if (id === 'respray') {
      // Next paint in the rotation, applied to the live mesh, and the
      // unseen Heat is wiped — the cameras are looking for another car.
      const cur = PAINTS.indexOf(car.color);
      const next = PAINTS[(cur + 1) % PAINTS.length];
      car.repaint(next);
      this.game.police.clearHeat();
      this.game.police.known = false;
      this.game.police.starState = 'none';
    } else if (id === 'repair') {
      car.repair();
    }
    this.save();
    this.game.audio?.blip('pass');
    return { ok: true, why: def.name + ' installed.' };
  }

  // --- Saves: three real slots. Slot 1 is the default (legacy key). ---
  stateObject() {
    return {
      cash: this.cash,
      respect: this.respect,
      missionsDone: [...this.missionsDone],
      ownedCars: this.ownedCars,
      career: { ...this.career },
      // FIX ROUND 3 (T7): the garage tune is persisted with the save.
      // Before this, the tune lived only on the car in memory — cash,
      // missions and rank survived a reload, but a bought upgrade
      // vanished. The tune saved is the player's own car (starterCar);
      // a tune bought on a stolen car dies with that car, as the car
      // itself does.
      tune: { ...(this.game.starterCar?.tune || this._savedTune || { engine: 0, armour: 0, handling: 0 }) },
      // FIX ROUND 5: the activity registry and district standing ride
      // with the save, so a reloaded career keeps its percentage.
      activities: this.game.activities?.serialize() ?? null,
      districts: this.game.districts?.serialize() ?? null,
    };
  }

  applyState(s) {
    if (!s) return;
    this.cash = s.cash ?? this.cash;
    this.respect = s.respect ?? 0;
    this.missionsDone = new Set(s.missionsDone ?? []);
    this.ownedCars = s.ownedCars ?? [];
    this.career = { ...(this.career || {}), ...(s.career ?? {}) };
    this._savedTune = s.tune
      ? { engine: s.tune.engine || 0, armour: s.tune.armour || 0, handling: s.tune.handling || 0 }
      : null;
    this._savedActivities = s.activities ?? null;
    this._savedDistricts = s.districts ?? null;
  }

  // Restore the saved garage tune onto the player's own car. Called once
  // from the Game constructor, after the starter car exists — Progression
  // loads the save before the car is built, so the tune can only be
  // applied here. Clears the held tune so it never applies twice.
  restoreTune() {
    if (!this._savedTune || !this.game.starterCar) return;
    Object.assign(this.game.starterCar.tune, this._savedTune);
    this._savedTune = null;
  }

  save(slot = 1) {
    try {
      localStorage.setItem(SAVE_KEY + '-slot' + slot, JSON.stringify(this.stateObject()));
      if (slot === 1) localStorage.setItem(SAVE_KEY, JSON.stringify(this.stateObject()));
    } catch (e) {
      // Storage may be unavailable in a sandbox; the game still runs.
    }
  }

  load(slot = 1) {
    try {
      const raw = localStorage.getItem(SAVE_KEY + '-slot' + slot)
        || (slot === 1 ? localStorage.getItem(SAVE_KEY) : null);
      if (!raw) return;
      this.applyState(JSON.parse(raw));
    } catch (e) {
      // Corrupt or missing save: start fresh.
    }
  }

  // Summary for the career screen's save-slot panel (null = empty slot).
  slotSummary(slot) {
    try {
      const raw = localStorage.getItem(SAVE_KEY + '-slot' + slot)
        || (slot === 1 ? localStorage.getItem(SAVE_KEY) : null);
      if (!raw) return null;
      const s = JSON.parse(raw);
      const respect = s.respect ?? 0;
      let rankName = 'ROOKIE';
      for (const r of RANKS) if (respect >= r.need) rankName = r.name;
      return {
        missions: (s.missionsDone ?? []).length,
        cash: s.cash ?? 0,
        rankName,
        jobName: (s.missionsDone ?? []).length >= 8 ? 'Kingpin' : 'Yard Ambush',
      };
    } catch (e) {
      return null;
    }
  }

  reset() {
    this.cash = 250;
    this.respect = 0;
    this.missionsDone = new Set();
    this.ownedCars = [];
    this._savedTune = null;
    this._savedActivities = null;
    this._savedDistricts = null;
    if (this.game.starterCar) this.game.starterCar.tune = { engine: 0, armour: 0, handling: 0 };
    this.career = {
      carsStolen: 0, copsEscaped: 0, distanceDriven: 0,
      peopleTakenOut: 0, longestJump: 0, racesWon: 0, highestWanted: 0,
    };
    try {
      localStorage.removeItem(SAVE_KEY);
      for (let i = 1; i <= 3; i++) localStorage.removeItem(SAVE_KEY + '-slot' + i);
    } catch (e) { /* ignore */ }
  }
}
