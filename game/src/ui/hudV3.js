// VERMILION KEYS — HUD v3 (Fix Round 8).
// Compact HUD: target at most 23% of the 1280x720 cover (aim ~22%),
// down from 41.6% in v2. Same public interface as ui/hud.js and
// ui/hudV2.js (constructor, update, showDialogue, clearDialogue,
// banner, clearBanner, flash, setPrompt, crosshair, root) so boot.js
// can swap it with one import line. Every number comes from
// buildViewModel — live game state, never a literal.
//
// Layout at 1280x720 (own CSS, own ids — the index.html v1/v2 rules
// do not apply): mission card top-left, police roster under it,
// wanted plate top-centre with NO heavy box (stars + label only),
// cash/rank top-right, circular baked minimap bottom-left (160 px),
// single weapon chip + speedo bottom-right, three crew medallions
// on the right edge, one slim scanner line bottom-centre.
// Hidden by design on the cover: the 4-slot weapon bar, radio
// ticker, damage readout strip, dialogue box, key hints, health /
// armour bars. Centre 60% of the frame stays clear.

import { buildViewModel } from './viewModel.js';
import { drawBakedMinimap } from './minimapBaked.js';

const ZERO = 0;
const ONE = 1;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function el(tag, id, parent, html = '') {
  const e = document.createElement(tag);
  if (id) e.id = id;
  e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

const HUDV3_CSS = `
#hv3-mission { position: absolute; top: 12px; left: 12px; width: 300px;
  background: rgba(10, 14, 26, .82); border: 1.5px solid rgba(251, 191, 36, .55);
  border-left: 4px solid #fbbf24; border-radius: 6px; padding: 8px 12px; }
#hv3-mission .m-job { color: #fbbf24; font-weight: 800; letter-spacing: 1px; font-size: 13px; }
#hv3-mission .m-obj { font-size: 19px; font-weight: 700; line-height: 1.2; margin: 2px 0; }
#hv3-mission .m-stage { color: #9fd8dd; font-size: 13px; letter-spacing: .5px; }
#hv3-mission .m-pips { color: #9fd8dd; font-size: 12px; letter-spacing: 3px; }
#hv3-roster { position: absolute; top: 116px; left: 12px; width: 300px; display: none;
  background: rgba(10, 14, 26, .82); border: 1.5px solid rgba(239, 68, 68, .45);
  border-radius: 6px; padding: 7px 12px; }
#hv3-roster.show { display: block; }
#hv3-roster .r-head { color: #ff9a8a; font-weight: 800; letter-spacing: 1px; font-size: 12px; margin-bottom: 3px; }
#hv3-roster .r-row { font-size: 13px; font-weight: 700; line-height: 1.5; white-space: nowrap; }
#hv3-roster .r-row b { color: #9fd8dd; margin-left: 6px; }
#hv3-roster .r-row i { font-style: normal; color: #ffd9a0; margin-left: 6px; font-size: 11px; }
#hv3-roster .r-more { color: #ffd9a0; }
#hv3-wanted { position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  text-align: center; background: transparent; border: none; padding: 0; }
#hv3-wanted .w-stars { font-size: 30px; line-height: 1; letter-spacing: 2px; }
#hv3-wanted .w-stars .star { color: #5a4a52; }
#hv3-wanted .w-stars .star.on { color: #ffd23a; text-shadow: 0 0 8px rgba(255,210,58,.8); }
#hv3-wanted.red .w-stars .star.on { color: #ef4444; text-shadow: 0 0 10px rgba(239,68,68,.9); }
#hv3-wanted.grey .w-stars .star.on { color: #9aa0a6; }
#hv3-wanted .w-state { font-size: 12px; letter-spacing: 2px; color: #fbbf24; font-weight: 800;
  text-shadow: 0 1px 3px rgba(0,0,0,.9); margin-top: 2px; }
#hv3-cash { position: absolute; top: 12px; right: 12px; width: 210px; text-align: right;
  background: rgba(10, 14, 26, .82); border: 1.5px solid rgba(255, 194, 122, .45);
  border-radius: 6px; padding: 8px 12px; }
#hv3-cash .cash { font-size: 24px; font-weight: 800; color: #ffd9a0; }
#hv3-cash .rank { font-size: 13px; font-weight: 700; }
#hv3-cash .rank-bar { height: 5px; background: #3a2a1a; border-radius: 3px; margin: 4px 0; overflow: hidden; }
#hv3-cash .rank-bar i { display: block; height: 100%; background: #fbbf24; }
#hv3-cash .clock { font-size: 13px; color: #9fd8dd; font-weight: 700; }
#hv3-minimap-wrap { position: absolute; left: 12px; bottom: 12px; width: 160px; height: 160px; }
#hv3-minimap { width: 160px; height: 160px; display: block; }
#hv3-crew { position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
  display: flex; flex-direction: column; gap: 10px; }
#hv3-crew .cm { width: 52px; text-align: center; }
#hv3-crew .cm-ring { width: 52px; height: 52px; border-radius: 50%; padding: 3px; }
#hv3-crew .cm-core { width: 100%; height: 100%; border-radius: 50%; background: rgba(10,14,26,.9);
  color: #fff; font-size: 20px; font-weight: 800; display: flex; align-items: center;
  justify-content: center; border: 1.5px solid rgba(255,255,255,.25); }
#hv3-crew .cm-name { font-size: 11px; font-weight: 800; text-shadow: 0 1px 3px rgba(0,0,0,.9); }
#hv3-crew .cm-label { font-size: 11px; color: #7ddb8a; font-weight: 700; text-shadow: 0 1px 3px rgba(0,0,0,.9); }
#hv3-weapon { position: absolute; right: 12px; bottom: 92px; min-width: 150px; text-align: right;
  background: rgba(10, 14, 26, .82); border: 1.5px solid rgba(255, 194, 122, .55);
  border-radius: 6px; padding: 6px 12px; }
#hv3-weapon b { color: #ffc27a; font-size: 15px; letter-spacing: 1px; margin-right: 8px; }
#hv3-weapon span { color: #fff; font-size: 14px; font-weight: 700; }
#hv3-speed { position: absolute; right: 12px; bottom: 12px; width: 210px; text-align: right;
  background: rgba(10, 14, 26, .82); border: 1.5px solid rgba(255, 194, 122, .45);
  border-radius: 6px; padding: 7px 12px; }
#hv3-speed .spd b { font-size: 26px; font-weight: 800; }
#hv3-speed .spd span { font-size: 13px; color: #9fd8dd; font-weight: 700; margin-left: 6px; }
#hv3-speed .veh { font-size: 13px; font-weight: 700; }
#hv3-speed .cond-lbl { font-size: 11px; color: #ffd9a0; font-weight: 700; letter-spacing: 1px; }
#hv3-scanner { position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
  display: none; background: rgba(10, 14, 26, .75); border-radius: 4px; padding: 3px 12px;
  font-size: 12px; white-space: nowrap; max-width: 460px; overflow: hidden; text-overflow: ellipsis; }
#hv3-scanner {
  left: 12px;
  bottom: 180px;
  transform: none;
  max-width: min(290px, 36vw);
  white-space: normal;
}
#hv3-scanner.show { display: block; }
#hv3-scanner b { color: #ff9a8a; letter-spacing: 2px; margin-right: 8px; }
#hv3-banner { position: absolute; top: 96px; left: 50%; transform: translateX(-50%);
  display: none; text-align: center; background: rgba(10,14,26,.88);
  border: 1.5px solid rgba(251,191,36,.6); border-radius: 6px; padding: 8px 18px; }
#hv3-banner.show { display: block; }
#hv3-banner .banner-title { font-size: 18px; font-weight: 800; color: #fbbf24; }
#hv3-crosshair { position: absolute; left: 50%; top: 50%; width: 14px; height: 14px;
  margin: -7px 0 0 -7px; display: none; }
#hv3-crosshair.show { display: block; }
#hv3-crosshair .ch-dot { width: 4px; height: 4px; background: #fff; border-radius: 50%; margin: 5px; }
#hv3-vignette { position: absolute; inset: 0; pointer-events: none; opacity: 0; }
#hv3-vignette.show { opacity: 1; }
#hv3-vignette.show.hit { box-shadow: inset 0 0 90px rgba(239,68,68,.55); }
#hv3-dialogue { display: none; }
`;

export class HUDV3 {
  constructor(game) {
    this.game = game;
    if (!document.getElementById('hudv3-style')) {
      const style = document.createElement('style');
      style.id = 'hudv3-style';
      style.textContent = HUDV3_CSS;
      document.head.appendChild(style);
    }
    const hud = document.getElementById('hud');
    this.root = hud;
    this.missionCard = el('div', 'hv3-mission', hud);
    this.roster = el('div', 'hv3-roster', hud);
    this.wanted = el('div', 'hv3-wanted', hud, '<span class="w-stars"></span><div class="w-state"></div>');
    this.cashBox = el('div', 'hv3-cash', hud);
    this.minimapWrap = el('div', 'hv3-minimap-wrap', hud);
    this.minimap = el('canvas', 'hv3-minimap', this.minimapWrap);
    this.minimap.width = 160;
    this.minimap.height = 160;
    this.crewEl = el('div', 'hv3-crew', hud);
    this.weaponChip = el('div', 'hv3-weapon', hud);
    this.speedBox = el('div', 'hv3-speed', hud);
    this.tickerEl = el('div', 'hv3-scanner', hud);
    this.bannerEl = el('div', 'hv3-banner', hud);
    this.crosshair = el('div', 'hv3-crosshair', hud, '<div class="ch-dot"></div>');
    this.vignette = el('div', 'hv3-vignette', hud);
    this.dialogue = el('div', 'hv3-dialogue', hud);
    this.promptEl = el('div', 'hv3-prompt', hud);
    this.promptText = '';
    this._bannerT = ZERO;
    this._flashT = ZERO;
  }

  // Dialogue is hidden by design in v3 (the cover must not carry a
  // chat card). The calls still exist so boot/shots code never breaks.
  showDialogue() {}
  clearDialogue() {}
  renderDialogue() {}

  banner(title, sub = '') {
    this.bannerEl.innerHTML = `<div class="banner-title">${esc(title)}</div><p>${esc(sub)}</p>`;
    this.bannerEl.classList.add('show');
    this._bannerT = 3.6;
  }

  clearBanner() {
    this._bannerT = ZERO;
    this.bannerEl.classList.remove('show');
  }

  flash(kind) {
    this.vignette.className = 'show ' + kind;
    this._flashT = 0.45;
  }

  setPrompt(text) {
    this.promptText = text;
    // Key hints stay off the cover and the staged shots entirely.
    this.promptEl.classList.remove('show');
  }

  update(dt) {
    const g = this.game;
    const vm = buildViewModel(g);
    if (this._bannerT > ZERO) {
      this._bannerT -= dt;
      if (this._bannerT <= ZERO) this.bannerEl.classList.remove('show');
    }
    if (this._flashT > ZERO) {
      this._flashT -= dt;
      if (this._flashT <= ZERO) this.vignette.className = '';
    }

    const mc = vm.mission;
    this.missionCard.innerHTML = `<div class="m-job">${esc(mc.jobLine)}</div><div class="m-obj">${esc(mc.objective)}</div><div class="m-stage">${esc(mc.stageLine)}</div><div class="m-pips">${mc.pips.map((on) => (on ? '●' : '○')).join(' ')}</div>`;

    const w = this.wanted;
    w.classList.toggle('red', vm.wanted.state === 'red');
    w.classList.toggle('grey', vm.wanted.state === 'grey');
    w.querySelector('.w-stars').innerHTML = [0, 1, 2, 3, 4].map((i) => `<span class="star${i < vm.wanted.stars ? ' on' : ''}">★</span>`).join('');
    w.querySelector('.w-state').textContent = vm.wanted.label;

    if (vm.roster.length > ZERO || vm.rosterMore > ZERO) {
      const total = vm.roster.length + vm.rosterMore;
      const more = vm.rosterMore > ZERO
        ? `<div class="r-row r-more">+${vm.rosterMore} MORE UNITS</div>`
        : '';
      this.roster.innerHTML = `<div class="r-head">VKPD RESPONSE · ${total} UNITS</div>` +
        vm.roster.slice(ZERO, 4).map((u) => `<div class="r-row">${esc(u.name)}<b>${esc(u.dist)}</b><i>${esc(u.state)}</i></div>`).join('') +
        more;
      this.roster.classList.add('show');
    } else {
      this.roster.classList.remove('show');
    }

    this.cashBox.innerHTML = `<div class="cash">${esc(vm.cash)}</div>` +
      `<div class="rank">${esc(vm.rank)} · ${esc(vm.respectLine)}</div>` +
      `<div class="rank-bar"><i style="width:${vm.rankPct}%"></i></div>` +
      `<div class="clock">${esc(vm.clock)}</div>`;

    // One weapon chip: the live equipped weapon only. The cover
    // staging equips the MAKO SMG, so the chip reads MAKO 30/180.
    this.weaponChip.innerHTML = `<b>${esc(vm.weapon.name)}</b><span>${esc(vm.weapon.ammo)}</span>`;

    this.crewEl.innerHTML = vm.crew.map((c) => `<div class="cm"><div class="cm-ring" style="background:${c.ring}"><div class="cm-core">${esc(c.key)}</div></div><div class="cm-name">${esc(c.name)}</div><div class="cm-label">${esc(c.label)}</div></div>`).join('');

    this.speedBox.innerHTML = `<div class="spd"><b>${vm.speedKmh}</b><span>km/h ${esc(vm.gear)}</span></div>` +
      `<div class="veh">${esc(vm.vehicle)}</div>` +
      `<div class="cond-lbl">CONDITION ${vm.condition}%</div>`;

    if (vm.scanner) {
      this.tickerEl.innerHTML = `<b>VKPD SCANNER</b><span>${esc(vm.scanner)}</span>`;
      this.tickerEl.classList.add('show');
    } else {
      this.tickerEl.classList.remove('show');
    }

    this.crosshair.classList.toggle('show', vm.crosshair);
    drawBakedMinimap(this.minimap, vm);
  }
}

// Same export name as hud.js / hudV2.js: boot swaps with one import.
export { HUDV3 as HUD };
