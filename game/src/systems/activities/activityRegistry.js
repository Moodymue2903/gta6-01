// VERMILION KEYS — activity registry: the nine real progression tracks.
// Every counter reads live game state or increments from a real game
// event — never typed in. The career percentage is the plain mean of
// the nine track fractions, rounded to one decimal.
//
// The staged late-game run lands at 74.5% exactly:
//   Story Jobs 7/8, Street Races 3/3, Stunt Ramps 3/6, Smuggler
//   Contraband 3/10, Hot-Car Exports 4/6, District Takeovers 6/8,
//   Syndicate Respect 740/1000, Crew Loyalty 9/9, Gold Job Medals 7/8.
//   (7/8 + 6/8 + 3/3 + 3/6 + 3/10 + 4/6 + 740/1000 + 9/9 + 7/8) / 9
//   = 74.52% -> 74.5%.

export const ACTIVITIES = [
  { id: 'jobs', name: 'Story Jobs', max: 8 },
  { id: 'races', name: 'Street Races', max: 3 },
  { id: 'stunts', name: 'Stunt Ramps', max: 6 },
  { id: 'contraband', name: 'Smuggler Contraband', max: 10 },
  { id: 'exports', name: 'Hot-Car Exports', max: 6 },
  { id: 'takeovers', name: 'District Takeovers', max: 8 },
  { id: 'respect', name: 'Syndicate Respect', max: 1000 },
  { id: 'loyalty', name: 'Crew Loyalty', max: 9 },
  { id: 'medals', name: 'Gold Job Medals', max: 8 },
];

export function computeCareerPct(values) {
  let sum = 0;
  for (const a of ACTIVITIES) {
    const v = values[a.id] ?? 0;
    sum += Math.min(1, v / a.max);
  }
  return Math.round((sum / ACTIVITIES.length) * 1000) / 10;
}

export class ActivityRegistry {
  constructor(game) {
    this.game = game;
    // Counters owned here (the rest live in the systems that earn them).
    this.stunts = 0;
    this.flares = 0;
    this.flareIds = new Set();
    this.exports = 0;
    this.medals = 0;
    this.crewUses = 0;
  }

  // Current value of each track, read from live state.
  values() {
    const g = this.game;
    return {
      jobs: g.progression.missionsDone.size,
      races: g.progression.career.racesWon,
      stunts: this.stunts,
      contraband: Math.min(this.flares, 10),
      exports: this.exports,
      takeovers: g.districts ? g.districts.takeovers() : 0,
      respect: g.progression.respect,
      loyalty: this.crewUses,
      medals: this.medals,
    };
  }

  careerPct() {
    return computeCareerPct(this.values());
  }

  // One row per activity for the career screen: name, value, max, label.
  rows() {
    const v = this.values();
    return ACTIVITIES.map((a) => ({
      id: a.id,
      name: a.name,
      value: v[a.id],
      max: a.max,
      label: v[a.id] + ' / ' + a.max,
      frac: Math.min(1, v[a.id] / a.max),
    }));
  }

  // --- Event hooks: called by the systems that earn each counter. ---
  recordStuntJump(_dist) {
    this.stunts++;
  }

  recordFlare(id) {
    if (this.flareIds.has(id)) return false;
    this.flareIds.add(id);
    this.flares++;
    this.game.progression.addCash(100);
    return true;
  }

  recordExport() {
    this.exports++;
    this.game.progression.addCash(250);
  }

  recordMedal(gold) {
    if (gold) this.medals++;
  }

  recordCrewUse() {
    this.crewUses++;
  }

  // Per-frame update: flare pickups + impound runs.
  update(dt) {
    void dt;
    if (this.game.updateFlares) this.game.updateFlares();
    if (this.game.updateImpound) this.game.updateImpound();
  }

  serialize() {
    return {
      stunts: this.stunts,
      flares: this.flares,
      flareIds: [...this.flareIds],
      exports: this.exports,
      medals: this.medals,
      crewUses: this.crewUses,
    };
  }

  restore(s) {
    if (!s) return;
    this.stunts = s.stunts || 0;
    this.flares = s.flares || 0;
    this.flareIds = new Set(s.flareIds || []);
    this.exports = s.exports || 0;
    this.medals = s.medals || 0;
    this.crewUses = s.crewUses || 0;
  }
}
