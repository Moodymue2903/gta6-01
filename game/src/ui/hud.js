// VERMILION KEYS — HUD: mission card, wanted stars, police roster,
// cash + respect, circular minimap, speed, weapons, radio, crew chips,
// dialogue bar, banners, crosshair and damage flashes. All DOM + one
// small 2D canvas; the game canvas stays clean for the screenshots.

import { GRAPH } from '../world/roadNetwork.js';
import { CREW } from '../systems/progression.js';
import { WEAPONS } from '../systems/combat.js';

function el(tag, id, parent, html = '') {
  const e = document.createElement(tag);
  if (id) e.id = id;
  e.innerHTML = html;
  parent.appendChild(e);
  return e;
}

export class HUD {
  constructor(game) {
    this.game = game;
    const hud = document.getElementById('hud');
    this.root = hud;

    this.missionCard = el('div', 'mission-card', hud);
    this.wanted = el('div', 'wanted', hud, '<span class="w-label">WANTED</span><span class="w-stars"></span>');
    this.roster = el('div', 'police-roster', hud);
    this.cashBox = el('div', 'cash-box', hud);
    this.minimapWrap = el('div', 'minimap-wrap', hud);
    this.minimap = el('canvas', 'minimap', this.minimapWrap);
    this.minimap.width = 230;
    this.minimap.height = 230;
    this.location = el('div', 'location', this.minimapWrap);
    this.speedBox = el('div', 'speed-box', hud);
    this.weaponSlots = el('div', 'weapon-slots', hud);
    this.wheel = el('div', 'weapon-wheel', hud);
    this.radioBox = el('div', 'radio-box', hud);
    this.crewChips = el('div', 'crew-chips', hud);
    this.dialogue = el('div', 'dialogue', hud);
    this.bannerEl = el('div', 'banner', hud);
    this.promptEl = el('div', 'prompt', hud);
    this.crosshair = el('div', 'crosshair', hud, '<div class="ch-dot"></div>');
    this.vignette = el('div', 'vignette', hud);
    this._bannerT = 0;
    this._dialogueT = 0;
    this._flashT = 0;
  }

  showDialogue(name, role, text) {
    this.dialogue.innerHTML = `<div class="dlg-face">${name[0]}</div><div class="dlg-body"><b>${name} <i>${role}</i></b><span>${text}</span></div>`;
    this.dialogue.classList.add('show');
    this._dialogueT = 7;
  }

  // Open the weapon wheel (screenshot staging: the cover shows the wheel
  // the way #5's does). Placed right of centre, not dead centre — the
  // cover's hero and bridge sit centre-left, so the wheel goes over the
  // open water on the right instead of covering the action.
  showWeaponWheel() {
    const g = this.game;
    this.wheel.innerHTML = WEAPONS.map((w, i) => {
      const mag = g.combat.inMag[i];
      return `<div class="ww-slot"><b>${i + 1} · ${w.name}</b><span>${w.mag === Infinity ? '∞' : mag + ' / ' + g.combat.ammo[i]}</span></div>`;
    }).join('');
    this.wheel.classList.add('open');
    // Upper-right, in the open sky — clear of the leaping car (the
    // first spot, 76%/58%, put the wheel's slots over the car's nose).
    this.wheel.style.left = '82%';
    this.wheel.style.top = '40%';
  }

  banner(title, sub = '') {
    this.bannerEl.innerHTML = `<h2>${title}</h2><p>${sub}</p>`;
    this.bannerEl.classList.add('show');
    this._bannerT = 3.6;
  }

  // Hide the banner immediately (screenshot staging: the big title card
  // would cover the middle of the frame).
  clearBanner() {
    this._bannerT = 0;
    this.bannerEl.classList.remove('show');
  }

  flash(kind) {
    this.vignette.className = 'show ' + kind;
    this._flashT = 0.45;
  }

  setPrompt(text) {
    if (text) {
      this.promptEl.textContent = text;
      this.promptEl.classList.add('show');
    } else {
      this.promptEl.classList.remove('show');
    }
  }

  update(dt) {
    const g = this.game;
    const p = g.player;
    const prog = g.progression;
    if (this._bannerT > 0) {
      this._bannerT -= dt;
      if (this._bannerT <= 0) this.bannerEl.classList.remove('show');
    }
    if (this._dialogueT > 0) {
      this._dialogueT -= dt;
      if (this._dialogueT <= 0) this.dialogue.classList.remove('show');
    }
    if (this._flashT > 0) {
      this._flashT -= dt;
      if (this._flashT <= 0) this.vignette.className = '';
    }

    // Mission card.
    const m = g.missions.active;
    if (m) {
      const s = g.missions.stage;
      const timer = s?.time ? ` <span class="m-timer">${Math.max(0, Math.ceil(s.time - m.timer))}s</span>` : '';
      this.missionCard.innerHTML = `<div class="m-job">JOB ${m.def.id}/8 · ${m.def.name}</div><div class="m-obj">${g.missions.stageText}</div><div class="m-stage">STAGE ${m.stage + 1}/${m.def.stages.length}${timer}</div>`;
      this.missionCard.classList.add('show');
    } else {
      const next = [...Array(8)].map((_, i) => i + 1).find((id) => !prog.missionsDone.has(id));
      this.missionCard.innerHTML = next
        ? `<div class="m-job">VERMILION KEYS</div><div class="m-obj">Drive to the gold marker to start JOB ${next}</div><div class="m-stage">${prog.missionsDone.size}/8 JOBS DONE</div>`
        : `<div class="m-job">VERMILION KEYS</div><div class="m-obj">All 8 jobs done — you run the Keys now.</div><div class="m-stage">KINGPIN</div>`;
      this.missionCard.classList.add('show');
    }

    // Wanted stars.
    const stars = g.police.stars;
    this.wanted.classList.toggle('hot', stars > 0);
    this.wanted.querySelector('.w-stars').innerHTML = [0, 1, 2, 3, 4]
      .map((i) => `<span class="star${i < stars ? ' on' : ''}">★</span>`).join('');

    // Police roster.
    const roster = g.police.roster();
    if (roster.length) {
      this.roster.innerHTML = `<div class="r-head">VKPD RESPONSE · ${roster.length} UNITS</div>` +
        roster.slice(0, 6).map((u) => `<div class="r-row"><span class="r-dot"></span>${u.name}<b>${u.dist} m</b><i>${u.state}</i></div>`).join('') +
        (roster.length > 6 ? `<div class="r-more">+${roster.length - 6} more units</div>` : '');
      this.roster.classList.add('show');
    } else {
      this.roster.classList.remove('show');
    }

    // Cash + respect.
    const nextNeed = prog.nextRankNeed;
    const prevNeed = prog.rank > 0 ? (prog.rank === 0 ? 0 : [0, 100, 250, 450, 700, 1000, 1400, 1900][prog.rank]) : 0;
    const pct = nextNeed ? Math.round(((prog.respect - prevNeed) / (nextNeed - prevNeed)) * 100) : 100;
    this.cashBox.innerHTML = `<div class="cash">$${prog.cash.toLocaleString('en-US')}</div>` +
      `<div class="rank">${prog.rankName} · RESPECT ${prog.respect}${nextNeed ? ' / ' + nextNeed : ''}</div>` +
      `<div class="rank-bar"><i style="width:${pct}%"></i></div>`;

    // Speed + vehicle.
    const inCar = p.inCar;
    const speedKmh = inCar ? Math.round(Math.abs(inCar.speed) * 3.6) : 0;
    const gear = inCar ? (inCar.speed < 0.5 ? 'N' : 'G' + Math.min(5, 1 + Math.floor(Math.abs(inCar.speed) / 9))) : '';
    const vName = inCar ? inCar.def.name.toUpperCase() : 'ON FOOT';
    const cond = inCar ? Math.round((inCar.hp / inCar.def.hp) * 100) : Math.round(p.health);
    this.speedBox.innerHTML = `<div class="spd"><b>${speedKmh}</b><span>km/h ${gear}</span></div>` +
      `<div class="veh">${vName}</div>` +
      `<div class="cond"><i style="width:${cond}%"></i></div><div class="cond-lbl">CONDITION ${cond}%</div>`;

    // Weapon slots.
    this.weaponSlots.innerHTML = WEAPONS.map((w, i) => {
      const mag = g.combat.inMag[i];
      return `<div class="ws${i === g.combat.weapon ? ' on' : ''}"><b>${i + 1}</b>${w.name}<span>${w.mag === Infinity ? '∞' : mag + ' / ' + g.combat.ammo[i]}</span></div>`;
    }).join('');

    // Radio.
    this.radioBox.innerHTML = g.audio.radioOn
      ? `♪ ${g.audio.stationName}`
      : '♪ RADIO OFF — M for music';

    // Crew chips with cooldowns.
    this.crewChips.innerHTML = Object.entries(CREW).map(([id, c]) => {
      const left = prog.crewCooldownLeft(id);
      const ready = left <= 0;
      return `<div class="crew${ready ? ' ready' : ''}"><b>${c.key}</b><span>${c.name}</span><i>${ready ? 'READY' : Math.ceil(left) + 's'}</i></div>`;
    }).join('');

    // Crosshair: visible when on foot and aiming.
    this.crosshair.classList.toggle('show', !inCar && g.state === 'playing');

    // Minimap.
    this.drawMinimap();

    // Location label.
    const px = inCar ? inCar.pos.x : p.pos.x;
    const pz = inCar ? inCar.pos.z : p.pos.z;
    this.location.textContent = this.locationName(px, pz);
  }

  locationName(x, z) {
    if (x < -90) return 'DOWNTOWN';
    if (x < 230) return z > 110 ? 'BOARDWALK BEACH' : z < -120 ? 'MARINA' : 'MARINA BLVD';
    if (x < 250) return 'EAST CAUSEWAY';
    return z < -120 ? 'CONTAINER PORT' : z > 120 ? 'OLD TOWN' : 'PORT DISTRICT';
  }

  drawMinimap() {
    const ctx = this.minimap.getContext('2d');
    const S = 230; // FIX ROUND 2: was 190 — unreadable at 320px thumbnail.
    const scale = 0.19; // px per metre (was 0.16)
    const g = this.game;
    const p = g.player;
    const cx = p.inCar ? p.inCar.pos.x : p.pos.x;
    const cz = p.inCar ? p.inCar.pos.z : p.pos.z;
    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.clip();
    // Water background: brighter teal so it reads as water at thumbnail size.
    ctx.fillStyle = '#0e7a8a';
    ctx.fillRect(0, 0, S, S);
    // Land: tinted per island, so the archipelago reads as islands.
    for (const isl of [
      { x0: -460, z0: -190, x1: -90, z1: 190, c: '#b8a888' },
      { x0: -70, z0: -160, x1: 230, z1: 160, c: '#d8c090' },
      { x0: 250, z0: -210, x1: 490, z1: 210, c: '#a89880' },
    ]) {
      ctx.fillStyle = isl.c;
      ctx.fillRect(S / 2 + (isl.x0 - cx) * scale, S / 2 + (isl.z0 - cz) * scale, (isl.x1 - isl.x0) * scale, (isl.z1 - isl.z0) * scale);
    }
    const toMap = (x, z) => [S / 2 + (x - cx) * scale, S / 2 + (z - cz) * scale];
    // Roads: thicker, near-black.
    ctx.strokeStyle = '#2e2e38';
    ctx.lineWidth = 4.5;
    for (const e of GRAPH.edges) {
      const [ax, ay] = toMap(e.ax, e.az);
      const [bx, by] = toMap(e.bx, e.bz);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    // Wanted search zone (FIX ROUND 2): a dashed red circle around the
    // player (the map is player-centred) while the heat is on.
    if (g.police.stars > 0) {
      ctx.beginPath();
      ctx.setLineDash([7, 6]);
      ctx.strokeStyle = '#ff4030';
      ctx.lineWidth = 3;
      ctx.arc(S / 2, S / 2, 120 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Traffic dots: opaque white, bigger.
    ctx.fillStyle = '#ffffff';
    for (const c of g.traffic.cars) {
      const [x, y] = toMap(c.pos.x, c.pos.z);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police (red) — always shown when wanted; with Kiki's reveal, all.
    const reveal = g.progression.revealUntil > g.time;
    if (g.police.stars > 0 || reveal) {
      ctx.fillStyle = '#ff3a3a';
      for (const u of g.police.units) {
        const [x, y] = toMap(u.pos.x, u.pos.z);
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (g.police.heli) {
        const [x, y] = toMap(g.police.heli.mesh.position.x, g.police.heli.mesh.position.z);
        ctx.fillStyle = '#ff9a3a';
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Mission target (gold diamond).
    const target = g.missions.stageTarget;
    if (target) {
      const [x, y] = toMap(target.x, target.z);
      ctx.fillStyle = '#ffc27a';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5.5, -5.5, 11, 11);
      ctx.restore();
    }
    // Player arrow (north-up).
    const heading = p.inCar ? p.inCar.heading : p.heading;
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, 8);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
    // Rim.
    ctx.strokeStyle = 'rgba(255,194,122,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
