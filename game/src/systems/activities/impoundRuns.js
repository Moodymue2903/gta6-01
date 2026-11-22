// VERMILION KEYS — impound runs / hot-car exports: steal a car and
// deliver it to the export gate at the east end of the container yard
// (430, -160). A delivered export counts (Hot-Car Exports +1, V$250)
// and the car is gone for good. The zone is a real painted gate in the
// yard, not a menu.

export const EXPORT_ZONE = { x: 430, z: -160, r: 12 };
export const EXPORT_PAY = 250;

export function updateImpound(game) {
  const p = game.player;
  if (!p.inCar) return;
  const car = p.inCar;
  if (!car.exportCandidate) return;
  if (Math.hypot(car.pos.x - EXPORT_ZONE.x, car.pos.z - EXPORT_ZONE.z) < EXPORT_ZONE.r) {
    car.exportCandidate = false;
    game.activities?.recordExport();
    game.hud?.banner('HOT-CAR EXPORTED', 'The buyer took it — V$250');
    game.audio?.blip('pass');
    p.exitCar();
    car.remove();
  }
}
