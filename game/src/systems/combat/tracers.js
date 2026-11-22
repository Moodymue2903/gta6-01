// VERMILION KEYS — combat tracers (Fix Round 5, Frame 2).
// Thin helpers over combat.fire(): the yard fight fires profile shots
// so the tracers cross the frame, and the shot count is visible to
// the state dump. The tracers themselves live in combat.js.

export function fireProfileShot(game) {
  game.combat.fire();
}

export function tracerCount(game) {
  return game.combat.tracers.length;
}

export function muzzleVisible(game) {
  return game.combat.flash.visible;
}

export function kills(game) {
  return game.combat.kills;
}
