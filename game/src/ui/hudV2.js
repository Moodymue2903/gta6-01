// VERMILION KEYS — HUD v2 (Fix Round 7).
// Same class name and interface as ui/hud.js, so boot.js can swap it
// with one import line. Everything hud.js showed is kept — mission
// card, wanted stars, police roster (nearest four, full count in the
// header), cash / rank / clock, health and armour, speed, crosshair,
// witness banner, scanner ticker — and the dumpState IDs
// (mission-card, wanted, cash-box, speed-box, location, police-roster,
// scanner-ticker, witness-banner) keep the same IDs.
//
// New in v2, all read from live state, never typed in:
//   * weapon slots bar — the four real weapons with live mag/reserve
//     ammo from game.weaponWheel, falling back to the view-model's
//     single weapon chip when the wheel is absent;
//   * crew portrait cards — cooldown rings and readiness from
//     game.crewAbilities, falling back to the view-model crew icons,
//     portraits from ui/portraits.js when it exists, initials otherwise;
//   * dialogue card — game.missionComms while a comm is live, else the
//     legacy showDialogue line;
//   * radio pill — game.radio, hidden when there is no radio system;
//   * damage readout — the live vehicle condition with a word
//     (SOLID / SCUFFED / DENTED / WRECKED), shown only in a car;
//   * square minimap — a larger square canvas: the existing circular
//     drawMinimap render composited onto a square water plate, with
//     district tints and enlarged police / heli blips on top, and a
//     square gold rim. drawMinimap hard-codes its 200 px circular
//     clip, so a square map can only be built by compositing it.
// Every text sits on a dark plate, so nothing clips on bright sky.

import { buildViewModel } from './viewModel.js';
import { drawMinimap } from './hud/minimap.js';
import { districtRects } from '../world/cityLayout.js';
import { BANNER_SECS, DIALOGUE_SECS, FLASH_SECS, FOUR, MINIMAP, ONE, ROSTER_MAX, STAR_INDEXES, THREE, TWO, ZERO } from './hudStyles.js';

// Square minimap canvas size (hud.js used MINIMAP.size = 200, round).
const MM2_SIZE = 260;
// The offscreen canvas drawMinimap draws into (its fixed 200 px).
const MM_OFF = 200;
// District-tint overlay strength on the square map.
const TINT_ALPHA = 0.16;
// Police blip half-size on the square map.
const BLIP_HALF = 4;
const HELI_R = 6;

// portraits.js is written by a parallel build agent; it may not exist
// yet when this module first loads, so it is imported dynamically and
// the HUD falls back to initial-letter portraits until it arrives.
let faceSVGFn = null;
let faceSVGLoading = false;
function loadPortraits() {
  if (faceSVGLoading) return;
  faceSVGLoading = true;
  import('./portraits.js').then((m) => {
    faceSVGFn = typeof m.faceSVG === 'function' ? m.faceSVG : null;
  }).catch(() => {
    faceSVGFn = null;
  });
}

function portraitHTML(name) {
  if (faceSVGFn) {
    try {
      return faceSVGFn(name);
    } catch (e) {
      // A portrait failure must never take the HUD down.
    }
  }
  return name ? name[ZERO] : '?';
}

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

// Roster state -> pill badge class (same mapping as hud.js).
function badgeClass(state) {
  if (state.includes('RAM')) return 'b-ram';
  if (state.includes('FLANK') || state.includes('INTERCEPT')) return 'b-flank';
  if (state.includes('AIR') || state.includes('SPOTLIGHT')) return 'b-air';
  if (state.includes('ROADBLOCK')) return 'b-block';
  if (state.includes('SWAT')) return 'b-swat';
  if (state.includes('PURSUIT')) return 'b-pursuit';
  return 'b-search';
}

function conditionWord(condition) {
  if (condition >= 85) return 'SOLID';
  if (condition >= 60) return 'SCUFFED';
  if (condition >= 30) return 'DENTED';
  return 'WRECKED';
}

const HUDV2_CSS = `
#minimap-wrap { width: 266px; }
#minimap { width: 260px; height: 260px; border-radius: 6px; }
#weapon-slots { position: absolute; right: 14px; top: 132px; display: flex; gap: 8px; }
.ws-slot { min-width: 62px; text-align: center; background: rgba(11, 17, 32, .88);
  border: 1.5px solid rgba(255, 255, 255, .18); border-radius: 6px; padding: 6px 8px; }
.ws-slot.equipped { border-color: #ffc27a; background: rgba(60, 40, 10, .92); }
.ws-slot .ws-key { display: block; font-size: 11px; font-weight: 800; color: #9fd8dd; letter-spacing: 1px; }
.ws-slot b { display: block; color: #ffc27a; font-size: 14px; letter-spacing: 1px; }
.ws-slot span { color: #fff; font-size: 13px; font-weight: 700; }
#crew-cards { position: absolute; right: 14px; bottom: 150px; display: flex; gap: 8px; }
.cc-card { width: 88px; text-align: center; background: rgba(11, 17, 32, .88);
  border: 1.5px solid rgba(255, 194, 122, .55); border-radius: 6px; padding: 6px 4px; }
.cc-card.ready { border-color: #7ddb8a; }
.cc-card.active { border-color: #38bdf8; }
.cc-face { width: 42px; height: 42px; margin: 0 auto; border-radius: 50%; overflow: hidden;
  background: rgba(10, 14, 26, .92); color: #fff; font-size: 22px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; }
.cc-face svg { width: 100%; height: 100%; display: block; }
.cc-name { font-size: 12px; font-weight: 800; color: #fff; margin-top: 3px; }
.cc-role { font-size: 10px; color: #9fd8dd; letter-spacing: 1px; }
.cc-label { font-size: 11px; color: #ffd9a0; font-weight: 700; }
.cc-card.ready .cc-label { color: #7ddb8a; }
#radio-pill { position: absolute; right: 14px; top: 198px; display: none;
  background: rgba(11, 17, 32, .88); border: 1.5px solid rgba(56, 189, 248, .55);
  border-radius: 6px; padding: 6px 12px; font-size: 13px; font-weight: 700;
  letter-spacing: 1px; color: #9fd8dd; max-width: 380px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; }
#radio-pill.show { display: block; }
#radio-pill b { color: #ffc27a; }
#damage-readout { position: absolute; right: 14px; bottom: 258px; display: none;
  background: rgba(11, 17, 32, .88); border: 1.5px solid rgba(255, 194, 122, .55);
  border-radius: 6px; padding: 5px 10px; font-size: 13px; font-weight: 800;
  letter-spacing: 1px; color: #ffd9a0; }
#damage-readout.show { display: block; }
#damage-readout b { color: #fff; }
#dialogue .dlg-face { overflow: hidden; padding: 0; }
#dialogue .dlg-face svg { width: 100%; height: 100%; display: block; }
`;

export class HUD {
  constructor(game) {
    this.game = game;
    loadPortraits();
    if (!document.getElementById('hudv2-style')) {
      const style = document.createElement('style');
      style.id = 'hudv2-style';
      style.textContent = HUDV2_CSS;
      document.head.appendChild(style);
    }
    const hud = document.getElementById('hud');
    this.root = hud;

    this.missionCard = el('div', 'mission-card', hud);
    this.wanted = el('div', 'wanted', hud, '<span class="w-label">WANTED</span><span class="w-stars"></span><div class="w-heat"><i></i></div><div class="w-state"></div>');
    this.witnessEl = el('div', 'witness-banner', hud, 'WITNESS CALLING VKPD · LINE OF SIGHT');
    this.roster = el('div', 'police-roster', hud);
    this.cashBox = el('div', 'cash-box', hud);
    this.minimapWrap = el('div', 'minimap-wrap', hud);
    this.minimap = el('canvas', 'minimap', this.minimapWrap);
    this.minimap.width = MM2_SIZE;
    this.minimap.height = MM2_SIZE;
    this._mmOff = document.createElement('canvas');
    this._mmOff.width = MM_OFF;
    this._mmOff.height = MM_OFF;
    this.haWrap = el('div', 'health-armour', this.minimapWrap);
    this.haWrap.innerHTML = '<div class="ha-row"><span>HEALTH</span><div class="ha-bar"><i></i></div><b></b></div><div class="ha-row"><span>ARMOUR</span><div class="ha-bar"><i></i></div><b></b></div>';
    this.healthFill = this.haWrap.children[ZERO].querySelector('i');
    this.healthNum = this.haWrap.children[ZERO].querySelector('b');
    this.armourFill = this.haWrap.children[ONE].querySelector('i');
    this.armourNum = this.haWrap.children[ONE].querySelector('b');
    this.location = el('div', 'location', this.minimapWrap);
    this.speedBox = el('div', 'speed-box', hud);
    this.weaponSlots = el('div', 'weapon-slots', hud);
    this.crewCards = el('div', 'crew-cards', hud);
    this.radioPill = el('div', 'radio-pill', hud);
    this.damageEl = el('div', 'damage-readout', hud);
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
    this._dlgLegacy = null;
  }

  showDialogue(name, role, text) {
    this._dlgLegacy = { name, role, text };
    this._dialogueT = DIALOGUE_SECS;
    this.renderDialogue();
  }

  clearDialogue() {
    this._dialogueT = ZERO;
    this._dlgLegacy = null;
    this.dialogue.classList.remove('show');
  }

  renderDialogue() {
    // A live mission comm wins over the legacy line while it is live.
    const comm = this.game.missionComms?.current?.() ?? null;
    if (comm && (comm.until === undefined || this.game.time < comm.until)) {
      this.dialogue.innerHTML = `<div class="dlg-face">${portraitHTML(comm.speaker)}</div><div class="dlg-body"><b>${esc(comm.speaker)} <i>${esc(comm.role || '')}</i></b><span>${esc(comm.text)}</span></div>`;
      this.dialogue.classList.add('show');
      return;
    }
    if (this._dlgLegacy && this._dialogueT > ZERO) {
      const d = this._dlgLegacy;
      this.dialogue.innerHTML = `<div class="dlg-face">${portraitHTML(d.name)}</div><div class="dlg-body"><b>${esc(d.name)} <i>${esc(d.role)}</i></b><span>${esc(d.text)}</span></div>`;
      this.dialogue.classList.add('show');
      return;
    }
    this.dialogue.classList.remove('show');
  }

  banner(title, sub = '') {
    this.bannerEl.innerHTML = `<div class="banner-title">${esc(title)}</div><p>${esc(sub)}</p>`;
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

  // Square minimap: the circular drawMinimap render composited onto a
  // square water plate, district tints and enlarged police / heli
  // blips on top, square gold rim. All positions come from vm.minimap.
  drawSquareMinimap(vm) {
    const canvas = this.minimap;
    const ctx = canvas.getContext('2d');
    const S = MM2_SIZE;
    drawMinimap(this._mmOff, vm);
    ctx.clearRect(ZERO, ZERO, S, S);
    ctx.fillStyle = '#0e7a8a';
    ctx.fillRect(ZERO, ZERO, S, S);
    ctx.drawImage(this._mmOff, ZERO, ZERO, S, S);
    const mm = vm.minimap;
    const scale = MINIMAP.scale * (S / MM_OFF);
    const centre = S / TWO;
    ctx.globalAlpha = TINT_ALPHA;
    for (const d of districtRects()) {
      ctx.fillStyle = d[6];
      ctx.fillRect(
        centre + (d[TWO] - mm.px) * scale,
        centre + (d[THREE] - mm.pz) * scale,
        (d[FOUR] - d[TWO]) * scale,
        (d[5] - d[THREE]) * scale,
      );
    }
    ctx.globalAlpha = ONE;
    for (const dot of mm.dots) {
      const x = centre + (dot.x - mm.px) * scale;
      const y = centre + (dot.z - mm.pz) * scale;
      if (dot.kind === 'police') {
        ctx.fillStyle = '#ff3a3a';
        ctx.fillRect(x - BLIP_HALF, y - BLIP_HALF, BLIP_HALF * TWO, BLIP_HALF * TWO);
      } else if (dot.kind === 'heli') {
        ctx.fillStyle = '#ff9a3a';
        ctx.beginPath();
        ctx.arc(x, y, HELI_R, ZERO, Math.PI * TWO);
        ctx.fill();
      }
    }
    ctx.strokeStyle = 'rgba(255,194,122,0.9)';
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, S - 3, S - 3);
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
      if (this._dialogueT <= ZERO) this._dlgLegacy = null;
    }
    if (this._flashT > ZERO) {
      this._flashT -= dt;
      if (this._flashT <= ZERO) this.vignette.className = '';
    }

    // Mission card, with stage pips.
    const mc = vm.mission;
    this.missionCard.innerHTML = `<div class="m-job">${esc(mc.jobLine)}</div><div class="m-obj">${esc(mc.objective)}</div><div class="m-stage">${esc(mc.stageLine)}</div><div class="m-pips">${mc.pips.map((on) => (on ? '●' : '○')).join(' ')}</div>`;

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
        vm.roster.slice(ZERO, ROSTER_MAX).map((u) => `<div class="r-row"><span class="r-dot"></span>${esc(u.name)}<b>${esc(u.dist)}</b><i class="badge ${badgeClass(u.state)}">${esc(u.state)}</i></div>`).join('') +
        more;
      this.roster.classList.add('show');
    } else {
      this.roster.classList.remove('show');
    }

    // Scanner ticker.
    if (vm.scanner) {
      this.tickerEl.innerHTML = `<b>VKPD SCANNER</b><span>${esc(vm.scanner)}</span>`;
      this.tickerEl.classList.add('show');
    } else {
      this.tickerEl.classList.remove('show');
    }

    // Cash, rank, clock.
    this.cashBox.innerHTML = `<div class="cash">${esc(vm.cash)}</div>` +
      `<div class="rank">${esc(vm.rank)} · ${esc(vm.respectLine)}</div>` +
      `<div class="rank-bar"><i style="width:${vm.rankPct}%"></i></div>` +
      `<div class="clock">${esc(vm.clock)}</div>`;

    // Speed and vehicle.
    this.speedBox.innerHTML = `<div class="spd"><b>${vm.speedKmh}</b><span>km/h ${esc(vm.gear)}</span></div>` +
      `<div class="veh">${esc(vm.vehicle)}</div>` +
      `<div class="cond"><i style="width:${vm.condition}%"></i></div><div class="cond-lbl">CONDITION ${vm.condition}%</div>`;

    // Weapon slots: the wheel's four real weapons, or the single
    // view-model weapon chip when there is no wheel yet.
    const wheelSlots = g.weaponWheel?.slots?.() ?? null;
    if (Array.isArray(wheelSlots) && wheelSlots.length > ZERO) {
      this.weaponSlots.innerHTML = wheelSlots.map((s, i) => {
        const ammo = s.ammo === Infinity ? '∞' : `${s.inMag} / ${s.ammo}`;
        return `<div class="ws-slot${s.equipped || s.selected ? ' equipped' : ''}"><span class="ws-key">${i + ONE}</span><b>${esc(s.name)}</b><span>${esc(ammo)}</span></div>`;
      }).join('');
    } else {
      this.weaponSlots.innerHTML = `<div class="ws-slot equipped"><span class="ws-key">1</span><b>${esc(vm.weapon.name)}</b><span>${esc(vm.weapon.ammo)}</span></div>`;
    }

    // Crew portrait cards: crewAbilities when present, else the
    // view-model crew icons (same live cooldowns, portrait fallback).
    const abilities = g.crewAbilities?.hudState?.() ?? null;
    if (Array.isArray(abilities) && abilities.length > ZERO) {
      this.crewCards.innerHTML = abilities.map((a) => {
        const ready = !!a.ready;
        const label = ready ? 'READY' : `${Math.ceil(a.cooldownLeft || ZERO)}s`;
        const deg = Math.round((a.frac ?? (ready ? ONE : ZERO)) * 360);
        const ring = `conic-gradient(#7ddb8a ${deg}deg, rgba(255,255,255,0.15) 0deg)`;
        return `<div class="cc-card${ready ? ' ready' : ''}${a.active ? ' active' : ''}"><div class="cc-face" style="background:${ring};padding:3px"><div style="width:100%;height:100%;border-radius:50%;overflow:hidden;background:rgba(10,14,26,.92);display:flex;align-items:center;justify-content:center">${portraitHTML(a.name)}</div></div><div class="cc-name">${esc(a.name)} · ${esc(a.key || '')}</div><div class="cc-role">${esc(a.role || '')}</div><div class="cc-label">${esc(label)}</div></div>`;
      }).join('');
    } else {
      this.crewCards.innerHTML = vm.crew.map((c) => `<div class="cc-card${c.ready ? ' ready' : ''}"><div class="cc-face" style="background:${c.ring};padding:3px"><div style="width:100%;height:100%;border-radius:50%;overflow:hidden;background:rgba(10,14,26,.92);display:flex;align-items:center;justify-content:center">${portraitHTML(c.name)}</div></div><div class="cc-name">${esc(c.name)} · ${esc(c.key)}</div><div class="cc-role">${esc(c.role)}</div><div class="cc-label">${esc(c.label)}</div></div>`).join('');
    }

    // Radio pill: only when the radio system exists.
    const pill = g.radio?.pill?.() ?? null;
    if (pill && pill.on) {
      this.radioPill.innerHTML = `<b>${esc(pill.station)}</b> — ${esc(pill.track || '')}`;
      this.radioPill.classList.add('show');
    } else if (pill) {
      this.radioPill.innerHTML = 'RADIO OFF · M TO TUNE';
      this.radioPill.classList.add('show');
    } else {
      this.radioPill.classList.remove('show');
    }

    // Damage readout: live vehicle condition, only while in a car.
    if (vm.vehicle !== 'ON FOOT') {
      this.damageEl.innerHTML = `<b>${vm.condition}%</b> ${conditionWord(vm.condition)}`;
      this.damageEl.classList.add('show');
    } else {
      this.damageEl.classList.remove('show');
    }

    // Dialogue: live comm first, legacy line second.
    this.renderDialogue();

    // Health and armour bars under the minimap.
    this.healthFill.style.width = `${vm.health}%`;
    this.healthNum.textContent = `${vm.health}`;
    this.armourFill.style.width = `${vm.armour}%`;
    this.armourNum.textContent = `${vm.armour}`;

    // Crosshair: visible when on foot and aiming.
    this.crosshair.classList.toggle('show', vm.crosshair);

    // Square minimap, drawn from the view-model.
    this.drawSquareMinimap(vm);

    // Location label.
    this.location.textContent = vm.location;
  }
}
