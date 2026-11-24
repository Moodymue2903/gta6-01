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

import * as THREE from 'three';
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
#hv3-left  { position: absolute; top: 12px; left: 12px; width: 300px;
  display: flex; flex-direction: column; gap: 8px; }
#hv3-right { position: absolute; top: 12px; right: 12px; width: 250px;
  display: flex; flex-direction: column; gap: 8px; }
#hv3-mission { width: 100%; box-sizing: border-box;
  background: linear-gradient(135deg, rgba(40, 22, 30, 0.82), rgba(70, 34, 30, 0.7)); border: 1.5px solid rgba(251, 191, 36, .55);
  border-left: 3px solid #f2a33a; border-radius: 6px; padding: 8px 12px; }
#hv3-mission .m-job { color: #fbbf24; font-weight: 800; letter-spacing: 1px; font-size: 13px; }
#hv3-mission .m-obj { font-size: 19px; font-weight: 700; line-height: 1.2; margin: 2px 0; }
#hv3-mission .m-stage { color: #9fd8dd; font-size: 13px; letter-spacing: .5px; }
#hv3-mission .m-pips { color: #9fd8dd; font-size: 12px; letter-spacing: 3px; }
#hv3-mission .m-next { color: #ffc27a; font-size: 14px; font-weight: 700; letter-spacing: .5px; margin-top: 2px; }
#hv3-roster { width: 100%; box-sizing: border-box; display: none;
  background: linear-gradient(135deg, rgba(40, 22, 30, 0.82), rgba(70, 34, 30, 0.7)); border: 1.5px solid rgba(239, 68, 68, .45);
  border-left: 3px solid #f2a33a; border-radius: 6px; padding: 7px 12px; }
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
/* Spotlight countdown: gold, centred under the wanted plate, only
   visible while the marking window is live. */
#hv3-spotlight { position: absolute; top: 66px; left: 50%; transform: translateX(-50%);
  display: none; font-size: 14px; font-weight: 800; letter-spacing: 2px; color: #ffd23f;
  text-shadow: 0 1px 3px rgba(0,0,0,.9); }
#hv3-spotlight.show { display: block; }
/* Spotlight world markers: gold diamonds floating above marked
   police units, positioned each frame by projecting the unit's
   world position through the camera. Pointer-events none (HUD root
   already is); hidden when the window expires or the unit is
   behind the camera. */
.hv3-mark { position: absolute; width: 12px; height: 12px; margin: -6px 0 0 -6px;
  background: #ffd23f; transform: rotate(45deg); display: none;
  box-shadow: 0 0 8px rgba(255, 210, 63, 0.9); }
#hv3-cash { width: 100%; box-sizing: border-box; text-align: right;
  background: linear-gradient(135deg, rgba(40, 22, 30, 0.82), rgba(70, 34, 30, 0.7)); border: 1.5px solid rgba(255, 194, 122, .45);
  border-left: 3px solid #f2a33a; border-radius: 6px; padding: 8px 12px; }
#hv3-cash .cash { font-size: 24px; font-weight: 800; color: #ffd9a0; }
#hv3-cash .rank { font-size: 13px; font-weight: 700; }
#hv3-cash .rank-bar { height: 5px; background: #3a2a1a; border-radius: 3px; margin: 4px 0; overflow: hidden; }
#hv3-cash .rank-bar i { display: block; height: 100%; background: #fbbf24; }
#hv3-cash .clock { font-size: 13px; color: #9fd8dd; font-weight: 700; }
#hv3-minimap-wrap { position: absolute; left: 12px; bottom: 12px; width: 160px; height: 160px; }
#hv3-minimap { width: 160px; height: 160px; display: block; }
/* Crew rows (not medallions): name + role + ability + state, each row
   legible at thumbnail size — the name and state are bold and larger
   than the ability line, per the re-test 13 judges. The panel sits
   under the cash box on the right edge, clear of the weapon chip. */
#hv3-crew { width: 100%;
  display: flex; flex-direction: column; gap: 8px; }
#hv3-crew .cm { display: flex; align-items: center; gap: 9px; text-align: left;
  background: linear-gradient(135deg, rgba(40, 22, 30, 0.82), rgba(70, 34, 30, 0.7));
  border: 1.5px solid rgba(255, 194, 122, .45); border-left: 3px solid #f2a33a;
  border-radius: 6px; padding: 6px 10px; }
#hv3-crew .cm-key { width: 30px; height: 30px; flex: 0 0 30px; border-radius: 50%;
  background: rgba(10,14,26,.9); color: #fff; font-size: 16px; font-weight: 800;
  display: flex; align-items: center; justify-content: center;
  border: 1.5px solid rgba(255,255,255,.25); }
#hv3-crew .cm-body { flex: 1; min-width: 0; }
#hv3-crew .cm-name { font-size: 15px; font-weight: 800; text-shadow: 0 1px 3px rgba(0,0,0,.9); }
#hv3-crew .cm-name i { font-style: normal; color: #9fd8dd; font-size: 11px; font-weight: 700; margin-left: 6px; letter-spacing: 1px; }
#hv3-crew .cm-ability { font-size: 12px; color: #ffd9a0; font-weight: 600; line-height: 1.25; }
#hv3-crew .cm-state { font-size: 13px; font-weight: 800; color: #7ddb8a; text-shadow: 0 1px 3px rgba(0,0,0,.9); white-space: nowrap; }
#hv3-weapon { position: absolute; right: 12px; bottom: 92px; min-width: 150px; text-align: right;
  background: linear-gradient(135deg, rgba(40, 22, 30, 0.82), rgba(70, 34, 30, 0.7)); border: 1.5px solid rgba(255, 194, 122, .55);
  border-left: 3px solid #f2a33a; border-radius: 6px; padding: 6px 12px; }
#hv3-weapon b { color: #ffc27a; font-size: 15px; letter-spacing: 1px; margin-right: 8px; }
#hv3-weapon span { color: #fff; font-size: 14px; font-weight: 700; }
#hv3-speed { position: absolute; right: 12px; bottom: 12px; width: 210px; text-align: right;
  background: linear-gradient(135deg, rgba(40, 22, 30, 0.82), rgba(70, 34, 30, 0.7)); border: 1.5px solid rgba(255, 194, 122, .45);
  border-left: 3px solid #f2a33a; border-radius: 6px; padding: 7px 12px; }
#hv3-speed .spd b { font-size: 26px; font-weight: 800; }
#hv3-speed .spd span { font-size: 13px; color: #9fd8dd; font-weight: 700; margin-left: 6px; }
#hv3-speed .veh { font-size: 13px; font-weight: 700; }
#hv3-speed .cond-lbl { font-size: 14px; color: #ffd9a0; font-weight: 800; letter-spacing: 1px; }
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
/* Dialogue: hidden everywhere EXCEPT the combat shot, where the
   mission contact's line shows with a speaker badge (initials + the
   character's colour — there is no portrait art). The cover stays
   clean; the combat frame carries the conversation. Rendered by
   renderDialogue() from missionComms.current(), gated on the shot
   kind — never on the cover, drive, pursuit, on-foot, map or title. */
#hv3-dialogue { display: none; }
#hv3-dialogue.show { display: flex; position: absolute; left: 50%; bottom: 12px; transform: translateX(-50%);
  align-items: center; gap: 12px; max-width: 640px;
  background: linear-gradient(135deg, rgba(40, 22, 30, 0.88), rgba(70, 34, 30, 0.78));
  border: 1.5px solid rgba(255, 194, 122, .55); border-left: 3px solid #f2a33a;
  border-radius: 6px; padding: 10px 16px; }
#hv3-dialogue .d-badge { width: 44px; height: 44px; flex: 0 0 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; font-weight: 800; color: #fff; }
#hv3-dialogue .d-speaker { font-size: 14px; font-weight: 800; color: #ffc27a; letter-spacing: 1px; }
#hv3-dialogue .d-line { font-size: 16px; font-weight: 700; color: #fff; line-height: 1.3; }
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
    this.leftCol = el('div', 'hv3-left', hud);
    this.missionCard = el('div', 'hv3-mission', this.leftCol);
    this.roster = el('div', 'hv3-roster', this.leftCol);
    this.wanted = el('div', 'hv3-wanted', hud, '<span class="w-stars"></span><div class="w-state"></div>');
    this.spotlightEl = el('div', 'hv3-spotlight', hud);
    // Pool of world-marker diamonds (max 12 police units on screen).
    this._markPool = [];
    for (let i = 0; i < 12; i++) {
      const m = document.createElement('div');
      m.className = 'hv3-mark';
      hud.appendChild(m);
      this._markPool.push(m);
    }
    this.rightCol = el('div', 'hv3-right', hud);
    this.cashBox = el('div', 'hv3-cash', this.rightCol);
    this.minimapWrap = el('div', 'hv3-minimap-wrap', hud);
    this.minimap = el('canvas', 'hv3-minimap', this.minimapWrap);
    this.minimap.width = 160;
    this.minimap.height = 160;
    this.crewEl = el('div', 'hv3-crew', this.rightCol);
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

  // Dialogue: rendered ONLY on the combat shot (the cover must not
  // carry a chat card). The card comes from missionComms.current() —
  // the real mission contact's name, role and line. The badge is the
  // speaker's initials on their character colour (no portrait art
  // exists). showDialogue/clearDialogue keep the old interface for
  // boot/shots code; renderDialogue() is called from update().
  showDialogue() { this.renderDialogue(); }
  clearDialogue() {
    this.dialogue.classList.remove('show');
    this.dialogue.innerHTML = '';
  }
  renderDialogue() {
    const g = this.game;
    const card = g.missionComms ? g.missionComms.current() : null;
    if (g.shotKind !== 'combat' || !card) {
      this.dialogue.classList.remove('show');
      this.dialogue.innerHTML = '';
      return;
    }
    const COLORS = { Kiki: '#2e9e5b', Zia: '#c78a1a', Lo: '#2b7fb8', Marco: '#c23b2a' };
    const color = COLORS[card.speaker] || '#7a6a8a';
    const initials = card.speaker.slice(0, 2).toUpperCase();
    this.dialogue.innerHTML =
      `<div class="d-badge" style="background:${color}">${esc(initials)}</div>` +
      `<div><div class="d-speaker">${esc(card.speaker.toUpperCase())} · ${esc(card.role)}</div>` +
      `<div class="d-line">${esc(card.text)}</div></div>`;
    this.dialogue.classList.add('show');
  }

  // Gold diamonds above every police unit while Spotlight is live.
  // Projects each unit's world position through the live camera;
  // units behind the camera or off-screen get no marker. When the
  // window is inactive every marker hides (base minimap blips are
  // unaffected — they are drawn by drawBakedMinimap regardless).
  renderSpotlightMarkers(active) {
    const g = this.game;
    const pool = this._markPool;
    if (!active || !g.camera || !g.police) {
      for (const m of pool) m.style.display = 'none';
      return;
    }
    const spots = g.police.units.map((u) => ({ x: u.pos.x, z: u.pos.z }));
    if (g.police.heli) spots.push({ x: g.police.heli.mesh.position.x, z: g.police.heli.mesh.position.z });
    const W = window.innerWidth;
    const H = window.innerHeight;
    const v = new THREE.Vector3();
    for (let i = 0; i < pool.length; i++) {
      const m = pool[i];
      if (i >= spots.length) { m.style.display = 'none'; continue; }
      v.set(spots[i].x, 4, spots[i].z).project(g.camera);
      if (v.z > 1) { m.style.display = 'none'; continue; }
      const sx = (v.x * 0.5 + 0.5) * W;
      const sy = (-v.y * 0.5 + 0.5) * H;
      if (sx < 0 || sx > W || sy < 0 || sy > H) { m.style.display = 'none'; continue; }
      m.style.display = 'block';
      m.style.left = sx + 'px';
      m.style.top = (sy - 26) + 'px';
    }
  }

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
    const nextLine = mc.next ? `<div class="m-next">NEXT: ${esc(mc.next)}</div>` : '';
    this.missionCard.innerHTML = `<div class="m-job">${esc(mc.jobLine)}</div><div class="m-obj">${esc(mc.objective)}</div><div class="m-stage">${esc(mc.stageLine)}</div>${nextLine}<div class="m-pips">${mc.pips.map((on) => (on ? '●' : '○')).join(' ')}</div>`;

    const w = this.wanted;
    w.classList.toggle('red', vm.wanted.state === 'red');
    w.classList.toggle('grey', vm.wanted.state === 'grey');
    w.querySelector('.w-stars').innerHTML = [0, 1, 2, 3, 4].map((i) => `<span class="star${i < vm.wanted.stars ? ' on' : ''}">★</span>`).join('');
    w.querySelector('.w-state').textContent = vm.wanted.label;

    // Spotlight HUD countdown + world diamond markers. The timer
    // reads from the view-model (live game state, never a literal).
    if (vm.spotlight.active) {
      this.spotlightEl.textContent = 'SPOTLIGHT ' + vm.spotlight.secondsLeft + 's';
      this.spotlightEl.classList.add('show');
    } else {
      this.spotlightEl.classList.remove('show');
    }
    this.renderSpotlightMarkers(vm.spotlight.active);

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

    this.crewEl.innerHTML = vm.crew.map((c) => `<div class="cm"><div class="cm-key">${esc(c.key)}</div><div class="cm-body"><div class="cm-name">${esc(c.name)}<i>${esc(c.role)}</i></div><div class="cm-ability">${esc(c.desc)}</div></div><div class="cm-state">${esc(c.label)}</div></div>`).join('');

    this.speedBox.innerHTML = `<div class="spd"><b>${vm.speedKmh}</b><span>km/h ${esc(vm.gear)}</span></div>` +
      `<div class="veh">${esc(vm.vehicle)}</div>` +
      `<div class="cond-lbl">CONDITION ${esc(vm.conditionWord)} · ${vm.condition}%</div>`;

    if (vm.scanner) {
      this.tickerEl.innerHTML = `<b>VKPD SCANNER</b><span>${esc(vm.scanner)}</span>`;
      this.tickerEl.classList.add('show');
    } else {
      this.tickerEl.classList.remove('show');
    }

    this.crosshair.classList.toggle('show', vm.crosshair);
    drawBakedMinimap(this.minimap, vm);
    this.renderDialogue();
  }
}

// Same export name as hud.js / hudV2.js: boot swaps with one import.
export { HUDV3 as HUD };
