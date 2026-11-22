// VERMILION KEYS — stunt jumps: a stunt counts when the player's car
// stays airborne for at least one second and covers real distance.
// The drawbridge leap is the natural stunt: at launch speed it flies
// for a little over a second. Called from the car's landing branch.

export const STUNT_MIN_AIRTIME = 1;
export const STUNT_MIN_DIST = 4;

export function checkStuntLanding(game, airSeconds, dist) {
  if (airSeconds >= STUNT_MIN_AIRTIME && dist >= STUNT_MIN_DIST) {
    game.activities?.recordStuntJump(dist);
    return true;
  }
  return false;
}
