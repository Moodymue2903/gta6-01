// VERMILION KEYS — garage menu (Fix Round 5, Frame 4).
// The Motor Works panel: the car on the lift, its tuned stat bars,
// the five priced upgrades from the vehicle catalog, and cash — all
// read from live state at the moment the screen opens. Prices and
// effects come from vehicleCatalog (UPGRADES), never typed here.

import { MISSIONS } from '../systems/missions.js';
import { UPGRADES } from '../systems/progression.js';
import { CURRENCY, vehicleDisplayName } from '../world/cityLayout.js';
import { renderWeaponLocker, lockerBuy } from './weaponLocker.js';

// Active garage tab, kept across refreshes (menus.js re-renders on
// every purchase). Switched by clicking the tab header — boot.js only
// routes Digit1-5 / Escape in the garage state, so there is no key
// binding for the tabs.
let garageTab = 'upgrades';

// The five upgrades grouped into four categories for display only:
// the key number stays the UPGRADES index + 1, so keys 1-5 still buy
// the same upgrade they always did.
const UPGRADE_CATEGORIES = [
  { title: 'ENGINE', ids: ['engine'] },
  { title: 'ARMOUR', ids: ['armour'] },
  { title: 'HANDLING', ids: ['handling'] },
  { title: 'VISUAL', ids: ['respray', 'repair'] },
];

const TAB_STYLE = 'pointer-events:auto;cursor:pointer;background:rgba(11,17,32,.88);border:1.5px solid rgba(255,255,255,.18);border-radius:6px;padding:7px 16px;color:#c8d0dc;font-weight:800;letter-spacing:1px;font-size:14px;';
const TAB_ON_STYLE = 'pointer-events:auto;cursor:pointer;background:rgba(60,40,10,.92);border:1.5px solid #38bdf8;border-radius:6px;padding:7px 16px;color:#fff;font-weight:800;letter-spacing:1px;font-size:14px;';

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
  const upgradeRow = (u, i) => {
    const lvl = prog.upgradeLevel(u.id);
    const maxed = u.max <= 3 && lvl >= u.max;
    const afford = prog.cash >= u.price;
    const pips = u.max <= 3 ? '●'.repeat(lvl) + '○'.repeat(u.max - lvl) : '';
    return `<div class="up${maxed ? ' maxed' : afford ? '' : ' poor'}"><b>${i + 1}</b><div class="up-body"><span>${u.name} ${pips}</span><i>${u.desc}</i></div><b class="up-price">${CURRENCY}${u.price.toLocaleString('en-US')}</b></div>`;
  };
  // FIX ROUND 7 — upgrades grouped into four categories (Engine /
  // Armour / Handling / Visual: respray + repair). Display-only: the
  // key number is still the UPGRADES index + 1.
  const rows = UPGRADE_CATEGORIES.map((cat) => `<div class="cp-head cp-head-gap">${cat.title}</div>` + cat.ids.map((id) => {
    const i = UPGRADES.findIndex((u) => u.id === id);
    return upgradeRow(UPGRADES[i], i);
  }).join('')).join('');
  const tabBtn = (tab, label) => `<button type="button" data-tab="${tab}" style="${garageTab === tab ? TAB_ON_STYLE : TAB_STYLE}">${label}</button>`;

  el.innerHTML = `
    <div class="garage-panel">
      <div class="gp-head">VERMILION MOTOR WORKS</div>
      <div class="gp-car"><span class="gp-swatch" style="background:${colorHex}"></span><b>${vehicleDisplayName(car.cls).toUpperCase()}</b><span>CONDITION ${Math.round((car.hp / car.maxHp()) * 100)}%</span></div>
      ${bar('TOP SPEED', topPct, Math.round(car.topSpeed() * 3.6) + ' km/h')}
      ${bar('CONDITION', hpPct, car.maxHp() + ' HP')}
      ${bar('GRIP', gripPct, car.grip().toFixed(2))}
      <div class="gp-cash">CASH <b>${CURRENCY}${prog.cash.toLocaleString('en-US')}</b></div>
      <div style="display:flex;gap:10px;margin:6px 0 10px;pointer-events:auto">${tabBtn('upgrades', 'UPGRADES')}${tabBtn('weapons', 'WEAPONS')}</div>
      ${garageTab === 'weapons' ? '<div id="weapon-locker"></div>' : rows}
      <div class="gp-next">NEXT: ${next ? 'JOB ' + next.id + ' · ' + next.name + ' — ' + CURRENCY + next.reward.toLocaleString('en-US') : 'ALL JOBS DONE — KINGPIN'}</div>
      <div class="gp-note">CHAMELEON RESPRAY — NEW PAINT CLEARS UNSEEN HEAT</div>
      ${msg ? `<div class="gp-msg">${msg}</div>` : ''}
      <div class="gp-keys">${garageTab === 'weapons' ? '1–4 BUY AMMO · ESC CLOSE' : '1–5 BUY · ESC CLOSE'}</div>
    </div>`;
  // Tab clicks: #menus is pointer-events:none, so the buttons re-enable
  // it inline and re-render in place on the same element.
  for (const btn of el.querySelectorAll('[data-tab]')) {
    btn.addEventListener('click', () => {
      garageTab = btn.getAttribute('data-tab');
      renderGarage(game, el, msg);
    });
  }
  if (garageTab === 'weapons') {
    const lockerEl = el.querySelector('#weapon-locker');
    if (lockerEl) renderWeaponLocker(game, lockerEl);
  }
}

export function garageBuy(game, index) {
  // FIX ROUND 7 — the active tab decides the purchase: upgrades keep
  // the existing buyUpgrade path (index is the UPGRADES index, keys
  // 1-5), weapons route to the locker (index is the WEAPONS index,
  // keys 1-4; a 5th key on the weapons tab buys nothing).
  if (garageTab === 'weapons') return lockerBuy(game, index);
  const u = UPGRADES[index];
  if (!u) return '';
  const res = game.progression.buyUpgrade(u.id);
  return res.why;
}
