// VERMILION KEYS — district standing: reputation per district, 0-100.
// Completing a story job in a district raises its standing by 65, so
// one job takes a district; escaping the police there adds 20. A
// district at 60 or above is taken over. The career map tints taken
// districts gold. The staged run takes six of the eight districts.

import { DISTRICTS } from '../../world/cityLayout.js';

export const TAKEOVER_AT = 60;
export const JOB_STANDING = 65;
export const ESCAPE_STANDING = 20;

export class DistrictStanding {
  constructor(game) {
    this.game = game;
    this.standing = {};
    for (const d of DISTRICTS) this.standing[d.id] = 0;
  }

  recordJobComplete(districtId) {
    if (!(districtId in this.standing)) return;
    this.standing[districtId] = Math.min(100, this.standing[districtId] + JOB_STANDING);
  }

  recordEscape(districtId) {
    if (!(districtId in this.standing)) return;
    this.standing[districtId] = Math.min(100, this.standing[districtId] + ESCAPE_STANDING);
  }

  isTaken(districtId) {
    return (this.standing[districtId] || 0) >= TAKEOVER_AT;
  }

  takeovers() {
    return DISTRICTS.filter((d) => this.isTaken(d.id)).length;
  }

  serialize() {
    return { ...this.standing };
  }

  restore(s) {
    if (!s) return;
    for (const d of DISTRICTS) {
      if (typeof s[d.id] === 'number') this.standing[d.id] = s[d.id];
    }
  }
}
