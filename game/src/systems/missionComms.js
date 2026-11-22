// VERMILION KEYS — mission comms (FIX ROUND 7).
// Story dialogue that follows the mission state machine. The module
// OBSERVES game.missions.active and its stage index; on a mission start
// or a stage advance it sets the current card from its own data table
// mapping (jobId, stageIndex) -> {speaker, line}. Every line is
// original dialogue written against the real mission data — the
// speaker is the job's giver or a crew member who would plausibly be
// on the radio for that stage, and the line refers to the stage's
// actual objective (marina pickup, courier chase, yard guards,
// syndicate cars, the drawbridge leap). The new HUD renders the card
// from current() — this module does NOT call hud.showDialogue, so the
// old letter-tile dialogue and this card never fight over the same
// screen space. In live play a card lives ~6 s; showForShot pins one
// for screenshot staging (until = Infinity).

import { MISSIONS } from './missions.js';

const CARD_SECONDS = 6;

// Speaker -> role, matching the roles progression.js / missions.js use.
const ROLES = {
  Marco: 'SYNDICATE',
  Mira: 'DRIVER',
  Lo: 'MECHANIC',
  Kiki: 'LOOKOUT',
};

// (jobId, stageIndex) -> {speaker, line}. Stage 0 of a job is the
// briefing beat (the giver speaks); later stages are the crew member
// closest to that leg of the job. Lines quote the stage objective
// rather than inventing new goals.
const LINES = {
  // 1 BAGMAN — Mira: marina pickup, then the safehouse run.
  '1,0': { speaker: 'Mira', line: 'Package is at the marina, runner. Quiet streets, no cops, no noise — that is the whole job.' },
  '1,1': { speaker: 'Mira', line: 'You have it. Now the safehouse, same speed. Do not let a patrol get curious.' },
  // 2 HOT WHEELS — Lo: the courier chase, then the case.
  '2,0': { speaker: 'Lo', line: 'There he is — the gold muscle car, running product downtown. Ram him till he stops!' },
  '2,1': { speaker: 'Lo', line: 'He is done. Grab the case from the wreck before his friends arrive.' },
  // 3 LOSE THE HEAT — Kiki: break line of sight, then the hideout.
  '3,0': { speaker: 'Kiki', line: 'Every unit in the Keys is on you. Break line of sight — alleys, garages, anywhere they cannot see you.' },
  '3,1': { speaker: 'Kiki', line: 'Heat is dying. Slip to the hospital hideout and stay out of sight till it is gone.' },
  // 4 DOCKSIDE — Mira: the truck, then the run to the garage.
  '4,0': { speaker: 'Mira', line: 'Container truck at the port, syndicate cash inside. Take it clean and the PD never has to know.' },
  '4,1': { speaker: 'Mira', line: 'You have the truck — now drive it to the garage and stay alive. They will notice. They always notice.' },
  // 5 YARD AMBUSH — Kiki: six guards in the container yard, then the package.
  '5,0': { speaker: 'Kiki', line: 'Six guards in the yard, and they are not here to talk. Clear them, then the package is yours.' },
  '5,1': { speaker: 'Kiki', line: 'Yard is quiet. Secure the package — the PD heard the shots, so do not linger.' },
  // 6 RIVAL DOWN — Lo: the old-town meet, then the rival.
  '6,0': { speaker: 'Lo', line: 'The hitter is waiting in the old town. Get there in one piece — he has friends on every corner.' },
  '6,1': { speaker: 'Lo', line: 'That is him. Put him down — drive-by or on foot, your call. Make it stick.' },
  // 7 GRAND PRIX — Mira: eight gates, three rivals.
  '7,0': { speaker: 'Mira', line: 'Eight gates, three rivals, one pot. Beat the clock and beat them. No shortcuts — the gates are the route.' },
  // 8 KINGPIN — Marco: the syndicate cars, the escape, the drawbridge leap.
  '8,0': { speaker: 'Marco', line: 'Last job. Hit the syndicate cars at the port — all three — and do not stop for the smoke.' },
  '8,1': { speaker: 'Marco', line: 'The Keys PD is coming down on you now. Lose them. Then the drawbridge — it is up, so you leap it.' },
  '8,2': { speaker: 'Marco', line: 'You are almost there. Reach the safehouse and you are the Kingpin now. Do not look back.' },
};

// Fallback if a (job, stage) pair has no scripted line: the giver
// reads the stage text itself, so the card is never empty or wrong.
function fallbackLine(def, stageIndex) {
  const s = def.stages[stageIndex];
  return { speaker: def.giver, line: s ? s.text : def.briefing };
}

export class MissionComms {
  constructor(game) {
    this.game = game;
    this._card = null; // {speaker, role, text, until, jobId, stage}
    this._seenJob = null;
    this._seenStage = -1;
  }

  _setCard(jobId, stageIndex, until) {
    const def = MISSIONS.find((m) => m.id === jobId);
    if (!def) return;
    const entry = LINES[jobId + ',' + stageIndex] || fallbackLine(def, stageIndex);
    this._card = {
      speaker: entry.speaker,
      role: ROLES[entry.speaker] || def.giverRole,
      text: entry.line,
      until,
      jobId,
      stage: stageIndex,
    };
    this._seenJob = jobId;
    this._seenStage = stageIndex;
  }

  // The card the HUD renders, or null when no card is live.
  current() {
    if (!this._card) return null;
    if (this._card.until !== Infinity && this.game.time > this._card.until) {
      this._card = null;
      return null;
    }
    return this._card;
  }

  // Screenshot staging: pin a card that never expires. 'cover' is
  // Marco's KINGPIN line; 'combat' is Kiki's YARD AMBUSH line.
  showForShot(kind) {
    if (kind === 'combat') {
      this._setCard(5, 0, Infinity);
    } else {
      // Default (and 'cover'): the KINGPIN briefing beat.
      this._setCard(8, 0, Infinity);
    }
    return this._card;
  }

  clearForShot() {
    this._card = null;
    this._seenJob = null;
    this._seenStage = -1;
  }

  update(dt) {
    const active = this.game.missions ? this.game.missions.active : null;
    if (!active) {
      // No job running: a pinned staging card survives (until =
      // Infinity), a live card expires on its own via current().
      if (this._card && this._card.until !== Infinity && this.game.time > this._card.until) {
        this._card = null;
      }
      this._seenJob = null;
      this._seenStage = -1;
      return;
    }
    const jobId = active.def.id;
    const stage = active.stage;
    // Mission start or stage advance: new card, ~6 s of life.
    if (jobId !== this._seenJob || stage !== this._seenStage) {
      this._setCard(jobId, stage, this.game.time + CARD_SECONDS);
    }
  }
}
