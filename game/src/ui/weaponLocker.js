// VERMILION KEYS — weapon locker (Fix Round 7).
// The garage's WEAPONS tab: the four real weapons with their live
// mag / reserve ammo from the combat system, plus a BUY AMMO option
// per gun that refills the reserve. Prices are the locker's own list;
// every ammo figure comes from game.combat, every cash figure from
// game.progression — nothing is typed in.
//
//   VESPER pistol  V$150  (+72 reserve)
//   MAKO SMG      V$300  (+180 reserve)
//   BREAKER shotgun V$250 (+36 reserve)
//   FISTS — free, no ammo to buy.

import { WEAPONS } from '../systems/combat.js';
import { CURRENCY } from '../world/cityLayout.js';

export const AMMO_PRICES = {
  pistol: 150,
  smg: 300,
  shotgun: 250,
};

export function renderWeaponLocker(game, el) {
  const combat = game.combat;
  const prog = game.progression;
  if (!combat || !prog) return;
  const rows = WEAPONS.map((w, i) => {
    const ammo = w.mag === Infinity
      ? '∞'
      : `${combat.inMag[i]} / ${combat.ammo[i]}`;
    let buy;
    if (w.id === 'fists') {
      buy = '<b class="up-price">FREE</b>';
    } else {
      const price = AMMO_PRICES[w.id];
      const afford = prog.cash >= price;
      buy = `<b class="up-price"${afford ? '' : ' style="color:#ff9a8a"'}>BUY AMMO ${CURRENCY}${price.toLocaleString('en-US')}</b>`;
    }
    const desc = w.id === 'fists'
      ? 'No ammo needed'
      : `BUY AMMO — full reserve refill +${w.ammo}`;
    return `<div class="up${w.id !== 'fists' && prog.cash < AMMO_PRICES[w.id] ? ' poor' : ''}"><b>${i + 1}</b><div class="up-body"><span>${w.name} · ${ammo}</span><i>${desc}</i></div>${buy}</div>`;
  }).join('');
  el.innerHTML = `<div class="cp-head">WEAPON LOCKER</div>${rows}`;
}

export function lockerBuy(game, index) {
  const w = WEAPONS[index];
  if (!w) return '';
  if (w.id === 'fists') return 'Fists need no ammo.';
  const price = AMMO_PRICES[w.id];
  const prog = game.progression;
  if (!prog || !game.combat) return '';
  if (prog.cash < price) return `Not enough cash for ${w.name} ammo.`;
  prog.addCash(-price);
  game.combat.ammo[index] += w.ammo;
  prog.save();
  return `${w.name} ammo +${w.ammo} reserve — ${CURRENCY}${price}.`;
}
