// VERMILION KEYS — HUD: mission card, wanted stars, police roster,
// cash plus respect plus clock, colour minimap with health and armour
// bars beneath it, speed, one weapon chip, crew icons with cooldown
// rings, witness banner, scanner ticker, crosshair and flashes. The
// HUD reads the view-model only — every number on screen comes from
// buildViewModel, never from a literal in this file. No radio box, no
// full weapon list, no dialogue text on the cover frames.

import { buildViewModel } from './viewModel.js';
import { drawMinimap } from './hud/minimap.js';
import { BANNER_SECS, DIALOGUE_SECS, FLASH_SECS, MINIMAP, ONE, ROSTER_MAX, STAR_INDEXES, ZERO } from './hudStyles.js';

function el(tag, id, parent, html = '') {
  const e = document.createElement(tag);
  if (id) e.id = id;
  e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

// Roster state -> pill badge class.
function badgeClass(state) {
  if (state.includes('RAM')) return 'b-ram';
  if (state.includes('FLANK') || state.includes('INTERCEPT')) return 'b-flank';
  if (state.includes('AIR') || state.includes('SPOTLIGHT')) return 'b-air';
  if (state.includes('ROADBLOCK')) return 'b-block';
  if (state.includes('SWAT')) return 'b-swat';
  if (state.includes('PURSUIT')) return 'b-pursuit';
  return 'b-search';
}

export class HUD {
  constructor(game) {
    this.game = game;
    const hud = document.getElementById('hud');
    this.root = hud;

    this.missionCard = el('div', 'mission-card', hud);
    this.wanted = el('div', 'wanted', hud, '<span class="w-label">WANTED</span><span class="w-stars"></span><div class="w-heat"><i></i></div><div class="w-state"></div>');
    this.witnessEl = el('div', 'witness-banner', hud, 'WITNESS CALLING VKPD · LINE OF SIGHT');
    this.roster = el('div', 'police-roster', hud);
    this.cashBox = el('div', 'cash-box', hud);
    this.minimapWrap = el('div', 'minimap-wrap', hud);
    this.minimap = el('canvas', 'minimap', this.minimapWrap);
    this.minimap.width = MINIMAP.size;
    this.minimap.height = MINIMAP.size;
    this.haWrap = el('div', 'health-armour', this.minimapWrap);
    this.haWrap.innerHTML = '<div class="ha-row"><span>HEALTH</span><div class="ha-bar"><i></i></div><b></b></div><div class="ha-row"><span>ARMOUR</span><div class="ha-bar"><i></i></div><b></b></div>';
    this.healthFill = this.haWrap.children[ZERO].querySelector('i');
    this.healthNum = this.haWrap.children[ZERO].querySelector('b');
    this.armourFill = this.haWrap.children[ONE].querySelector('i');
    this.armourNum = this.haWrap.children[ONE].querySelector('b');
    this.location = el('div', 'location', this.minimapWrap);
    this.speedBox = el('div', 'speed-box', hud);
    this.weaponChip = el('div', 'weapon-chip', hud);
    this.crewIcons = el('div', 'crew-icons', hud);
    this.dialogue = el('div', 'dialogue', hud);
    this.bannerEl = el('div', 'banner', hud);
    this.promptEl = el('div', 'prompt', hud);
    this.crosshair = el('div', 'crosshair', hud, '<div class="ch-dot"></div>');
    this.vignette = el('div', 'vignette', hud);
    this.tickerEl = el('div', 'scanner-ticker', hud);
    this.promptText = '';
    this._bannerT = ZERO;
    this._dialogueT = ZERO;
    this._flashT = ZERO;
  }

  showDialogue(name, role, text) {
    this.dialogue.innerHTML = `<div class="dlg-face">${name[ZERO]}</div><div class="dlg-body"><b>${name} <i>${role}</i></b><span>${text}</span></div>`;
    this.dialogue.classList.add('show');
    this._dialogueT = DIALOGUE_SECS;
  }

  clearDialogue() {
    this._dialogueT = ZERO;
    this.dialogue.classList.remove('show');
  }

  banner(title, sub = '') {
    this.bannerEl.innerHTML = `<div class="banner-title">${title}</div><p>${sub}</p>`;
    this.bannerEl.classList.add('show');
    this._bannerT = BANNER_SECS;
  }

  clearBanner() {
    this._bannerT = ZERO;
    this.bannerEl.classList.remove('show');
  }

  flash(kind) {
    this.vignette.className = 'show ' + kind;
    this._flashT = FLASH_SECS;
  }

  setPrompt(text) {
    this.promptText = text;
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.classList.add('show');
    } else {
      this.promptEl.classList.remove('show');
    }
  }

  update(dt) {
    const g = this.game;
    const vm = buildViewModel(g);
    if (this._bannerT > ZERO) {
      this._bannerT -= dt;
      if (this._bannerT <= ZERO) this.bannerEl.classList.remove('show');
    }
    if (this._dialogueT > ZERO) {
      this._dialogueT -= dt;
      if (this._dialogueT <= ZERO) this.dialogue.classList.remove('show');
    }
    if (this._flashT > ZERO) {
      this._flashT -= dt;
      if (this._flashT <= ZERO) this.vignette.className = '';
    }

    // Mission card, with stage pips.
    const mc = vm.mission;
    this.missionCard.innerHTML = `<div class="m-job">${mc.jobLine}</div><div class="m-obj">${mc.objective}</div><div class="m-stage">${mc.stageLine}</div><div class="m-pips">${mc.pips.map((on) => (on ? '●' : '○')).join(' ')}</div>`;

    // Wanted stars — grey reported, white acknowledged, red engaged;
    // unseen heat shows an amber bar and no stars.
    const w = this.wanted;
    w.classList.toggle('hot', vm.wanted.stars > ZERO);
    w.classList.toggle('grey', vm.wanted.state === 'grey');
    w.classList.toggle('red', vm.wanted.state === 'red');
    w.classList.toggle('heat-only', vm.wanted.heatOnly);
    w.querySelector('.w-stars').innerHTML = STAR_INDEXES.map((i) => `<span class="star${i < vm.wanted.stars ? ' on' : ''}">★</span>`).join('');
    w.querySelector('.w-heat i').style.width = `${vm.wanted.heatPct}%`;
    w.querySelector('.w-state').textContent = vm.wanted.label;

    // Witness banner: a witness is on the phone right now.
    this.witnessEl.classList.toggle('show', vm.witness);

    // Police roster: four rows plus a more line.
    if (vm.roster.length > ZERO || vm.rosterMore > ZERO) {
      const total = vm.roster.length + vm.rosterMore;
      const more = vm.rosterMore > ZERO
        ? `<div class="r-row r-more">+${vm.rosterMore} MORE UNITS</div>`
        : '';
      this.roster.innerHTML = `<div class="r-head">VKPD RESPONSE · ${total} UNITS</div>` +
        vm.roster.map((u) => `<div class="r-row"><span class="r-dot"></span>${u.name}<b>${u.dist}</b><i class="badge ${badgeClass(u.state)}">${u.state}</i></div>`).join('') +
        more;
      this.roster.classList.add('show');
    } else {
      this.roster.classList.remove('show');
    }

    // Scanner ticker.
    if (vm.scanner) {
      this.tickerEl.innerHTML = `<b>VKPD SCANNER</b><span>${vm.scanner}</span>`;
      this.tickerEl.classList.add('show');
    } else {
      this.tickerEl.classList.remove('show');
    }

    // Cash, rank, clock.
    this.cashBox.innerHTML = `<div class="cash">${vm.cash}</div>` +
      `<div class="rank">${vm.rank} · ${vm.respectLine}</div>` +
      `<div class="rank-bar"><i style="width:${vm.rankPct}%"></i></div>` +
      `<div class="clock">${vm.clock}</div>`;

    // Speed and vehicle.
    this.speedBox.innerHTML = `<div class="spd"><b>${vm.speedKmh}</b><span>km/h ${vm.gear}</span></div>` +
      `<div class="veh">${vm.vehicle}</div>` +
      `<div class="cond"><i style="width:${vm.condition}%"></i></div><div class="cond-lbl">CONDITION ${vm.condition}%</div>`;

    // One weapon chip: the current weapon only.
    this.weaponChip.innerHTML = `<b>${vm.weapon.name}</b><span>${vm.weapon.ammo}</span>`;

    // Crew icons with cooldown rings.
    this.crewIcons.innerHTML = vm.crew.map((c) => `<div class="crew-item${c.ready ? ' ready' : ''}"><div class="ci-ring" style="background:${c.ring}"><div class="ci-core">${c.key}</div></div><span>${c.name}</span><i>${c.label}</i></div>`).join('');

    // Health and armour bars under the minimap.
    this.healthFill.style.width = `${vm.health}%`;
    this.healthNum.textContent = `${vm.health}`;
    this.armourFill.style.width = `${vm.armour}%`;
    this.armourNum.textContent = `${vm.armour}`;

    // Crosshair: visible when on foot and aiming.
    this.crosshair.classList.toggle('show', vm.crosshair);

    // Minimap, drawn from the view-model.
    drawMinimap(this.minimap, vm);

    // Location label.
    this.location.textContent = vm.location;
  }
}
