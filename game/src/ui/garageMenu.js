// VERMILION KEYS — garage menu (Fix Round 5, Frame 4).
// The Motor Works panel: the car on the lift, its tuned stat bars,
// the five priced upgrades from the vehicle catalog, and cash — all
// read from live state at the moment the screen opens. Prices and
// effects come from vehicleCatalog (UPGRADES), never typed here.

import { MISSIONS } from '../systems/missions.js';
import { UPGRADES } from '../systems/progression.js';
import { CURRENCY, vehicleDisplayName } from '../world/cityLayout.js';

export function renderGarage(game, el, msg = '') {
  const prog = game.progression;
  const car = prog.garageCar();
  if (!car) return;
  const next = MISSIONS.find((m) => !prog.missionsDone.has(m.id));
  const colorHex = '#' + car.color.toString(16).padStart(6, '0');
  const topPct = Math.round((car.topSpeed() / (car.def.topSpeed * 1.24)) * 100);
  const hpPct = Math.round((car.maxHp() / (car.def.hp * 1.75)) * 100);
  const gripPct = Math.round((car.grip() / (car.def.grip * 1.3)) * 100);
  const bar = (label, pct, val) => `<div class="gb-row"><span>${label}</span><div class="gb-bar"><i style="width:${pct}%"></i></div><b>${val}</b></div>`;
  const rows = UPGRADES.map((u, i) => {
    const lvl = prog.upgradeLevel(u.id);
    const maxed = u.max <= 3 && lvl >= u.max;
    const afford = prog.cash >= u.price;
    const pips = u.max <= 3 ? '●'.repeat(lvl) + '○'.repeat(u.max - lvl) : '';
    return `<div class="up${maxed ? ' maxed' : afford ? '' : ' poor'}"><b>${i + 1}</b><div class="up-body"><span>${u.name} ${pips}</span><i>${u.desc}</i></div><b class="up-price">${CURRENCY}${u.price.toLocaleString('en-US')}</b></div>`;
  }).join('');

  el.innerHTML = `
    <div class="garage-panel">
      <div class="gp-head">VERMILION MOTOR WORKS</div>
      <div class="gp-car"><span class="gp-swatch" style="background:${colorHex}"></span><b>${vehicleDisplayName(car.cls).toUpperCase()}</b><span>CONDITION ${Math.round((car.hp / car.maxHp()) * 100)}%</span></div>
      ${bar('TOP SPEED', topPct, Math.round(car.topSpeed() * 3.6) + ' km/h')}
      ${bar('CONDITION', hpPct, car.maxHp() + ' HP')}
      ${bar('GRIP', gripPct, car.grip().toFixed(2))}
      <div class="gp-cash">CASH <b>${CURRENCY}${prog.cash.toLocaleString('en-US')}</b></div>
      ${rows}
      <div class="gp-next">NEXT: ${next ? 'JOB ' + next.id + ' · ' + next.name + ' — ' + CURRENCY + next.reward.toLocaleString('en-US') : 'ALL JOBS DONE — KINGPIN'}</div>
      <div class="gp-note">CHAMELEON RESPRAY — NEW PAINT CLEARS UNSEEN HEAT</div>
      ${msg ? `<div class="gp-msg">${msg}</div>` : ''}
      <div class="gp-keys">1–5 BUY · ESC CLOSE</div>
    </div>`;
}

export function garageBuy(game, index) {
  const u = UPGRADES[index];
  if (!u) return '';
  const res = game.progression.buyUpgrade(u.id);
  return res.why;
}
