// VERMILION KEYS — progression: cash, respect ranks, garage, saves.
// Crew perks run on cooldowns: Mira swaps plates (drops heat), Lo fixes
// the car, Kiki reveals every police unit on the minimap.

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

export class Progression {
  constructor(game) {
    this.game = game;
    this.cash = 250;
    this.respect = 0;
    this.missionsDone = new Set();
    this.ownedCars = []; // {cls, color} stored at the garage
    this.crewUsed = { mira: -999, lo: -999, kiki: -999 };
    this.revealUntil = 0;
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

  crewReady(id) {
    return this.game.time - this.crewUsed[id] >= CREW[id].cooldown;
  }

  crewCooldownLeft(id) {
    return Math.max(0, CREW[id].cooldown - (this.game.time - this.crewUsed[id]));
  }

  useCrew(id) {
    if (!this.crewReady(id)) return false;
    this.crewUsed[id] = this.game.time;
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

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.cash,
        respect: this.respect,
        missionsDone: [...this.missionsDone],
        ownedCars: this.ownedCars,
      }));
    } catch (e) {
      // Storage may be unavailable in a sandbox; the game still runs.
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      this.cash = s.cash ?? this.cash;
      this.respect = s.respect ?? 0;
      this.missionsDone = new Set(s.missionsDone ?? []);
      this.ownedCars = s.ownedCars ?? [];
    } catch (e) {
      // Corrupt or missing save: start fresh.
    }
  }

  reset() {
    this.cash = 250;
    this.respect = 0;
    this.missionsDone = new Set();
    this.ownedCars = [];
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* ignore */ }
  }
}
