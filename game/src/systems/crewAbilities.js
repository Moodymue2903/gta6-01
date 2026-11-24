// VERMILION KEYS — crew abilities (FIX ROUND 7).
// Activation feedback + the one extra effect on top of progression.js.
// useCrew() in progression.js ALREADY does the real work — Zia sheds
// exactly one wanted star, Lo repairs the car and heals 25, Kiki
// sets spotlightUntil/revealUntil = time + 20 — so this module NEVER re-implements
// those effects and never writes crewUsed. It only OBSERVES
// progression.crewUsed timestamps, detects a fresh use, records the
// activation for the HUD, and adds the one effect progression.js does
// not have: Zia's Driver's Cut, a +25% top-speed boost for 8 s.
// The coordinator wires Car.update to read speedBoostActive() (and
// multiply top speed by 1.25 while it is live).

import { CREW } from './progression.js';

const BOOST_SECONDS = 8;
const BOOST_MULT = 1.25;
// How long a Lo repair still counts as "active" on the crew card
// (the repair itself is instant, the feedback lingers briefly).
const LO_ACTIVE_SECONDS = 4;

export class CrewAbilities {
  constructor(game) {
    this.game = game;
    this.boostUntil = 0;
    this.lastActivation = null; // {id, time} | null
    // Last observed crewUsed timestamps, so a fresh use is a change.
    this._seen = {};
    for (const id of Object.keys(CREW)) {
      this._seen[id] = this.game.progression.crewUsed[id];
    }
  }

  // The multiplier the coordinator applies to top speed. Kept as a
  // named getter so Car.update reads one honest number.
  get boostMultiplier() {
    return BOOST_MULT;
  }

  speedBoostActive() {
    return this.game.time < this.boostUntil;
  }

  speedBoostLeft() {
    return Math.max(0, this.boostUntil - this.game.time);
  }

  update(dt) {
    const prog = this.game.progression;
    for (const id of Object.keys(CREW)) {
      const usedAt = prog.crewUsed[id];
      if (usedAt !== this._seen[id]) {
        this._seen[id] = usedAt;
        // A timestamp of -999 is the never-used sentinel, not a use.
        if (usedAt > -999) this._onCrewUsed(id, usedAt);
      }
    }
  }

  _onCrewUsed(id, at) {
    this.lastActivation = { id, time: at };
    if (id === 'mira') {
      // Driver's Cut: +25% top speed for 8 s, on top of Zia's
      // plate-swap (already applied by progression.useCrew).
      this.boostUntil = this.game.time + BOOST_SECONDS;
    }
    this.game.audio?.blip('crew');
  }

  // Portrait-card state for the HUD: live readiness, cooldown and
  // whether the ability's effect is live right now. All numbers come
  // from progression.js — nothing is typed here.
  hudState() {
    const prog = this.game.progression;
    const now = this.game.time;
    return Object.entries(CREW).map(([id, c]) => {
      const left = prog.crewCooldownLeft(id);
      const ready = left <= 0;
      const frac = ready ? 1 : 1 - left / c.cooldown;
      let active = false;
      if (id === 'mira') active = this.speedBoostActive();
      else if (id === 'kiki') active = now < prog.revealUntil;
      else if (id === 'lo') {
        active = this.lastActivation !== null
          && this.lastActivation.id === 'lo'
          && now - this.lastActivation.time < LO_ACTIVE_SECONDS;
      }
      return {
        id,
        name: c.name,
        role: c.role,
        key: c.key,
        desc: c.desc,
        ready,
        cooldownLeft: left,
        cooldownLabel: ready ? 'READY' : Math.ceil(left) + 's',
        frac,
        active,
      };
    });
  }
}
