// VERMILION KEYS — menus: title, pause, death, busted, career, garage.
// Overlays are plain DOM; the game loop keeps rendering behind them.
//
// FIX ROUND 3 — the career and garage are real screens, not mock-ups:
//   * the career screen reads the live progression ledger (career stats,
//     missions done, rank), draws the city map from the real road graph
//     and islands, and lists the three real save slots;
//   * the garage screen reads the live garage: the car you arrived in,
//     its tuned stats, the price list with owned levels, and your cash.
//   Nothing on either screen is typed in — every number comes from the
//   game state at the moment the screen opens.
// FIX ROUND 4 — legibility: the career map's GARAGE and SAFEHOUSE
// labels overlapped (the two markers sit 7 px apart on the map), so
// GARAGE now labels below its dot and SAFEHOUSE above; BOARDWALK BEACH
// moved off the safehouse label. The save panel gets a live CREW
// section so the career screen has no large empty panel.

import { GRAPH, ISLANDS } from '../world/roadNetwork.js';
import { MISSIONS } from '../systems/missions.js';
import { UPGRADES, CREW } from '../systems/progression.js';

const DISTRICT_LABELS = [
  { x: -275, z: 0, name: 'DOWNTOWN' },
  { x: 70, z: 20, name: 'MARINA BLVD' },
  { x: 70, z: -140, name: 'MARINA' },
  { x: 110, z: 152, name: 'BOARDWALK BEACH' },
  { x: 240, z: 0, name: 'EAST CAUSEWAY' },
  { x: 370, z: 20, name: 'PORT DISTRICT' },
  { x: 370, z: -165, name: 'CONTAINER PORT' },
  { x: 370, z: 165, name: 'OLD TOWN' },
];

export class Menus {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('menus');
    this.titleEl = document.createElement('div');
    this.titleEl.id = 'title-screen';
    this.titleEl.innerHTML = `
      <div class="t-kicker">MAKE.FUN · GTA 6 BOUNTY</div>
      <h1>VERMILION<br>KEYS</h1>
      <div class="t-sub">An open-world crime game at golden hour — steal, race, leap.</div>
      <div class="t-controls">
        <span><b>WASD</b> drive / walk</span><span><b>SHIFT</b> sprint</span><span><b>SPACE</b> jump / handbrake</span>
        <span><b>E</b> enter / steal car</span><span><b>F</b> carjack</span><span><b>Q</b> weapon wheel</span>
        <span><b>1–4</b> weapons</span><span><b>R</b> reload</span><span><b>Z X C</b> crew perks</span>
        <span><b>M</b> radio</span><span><b>T</b> career</span><span><b>ESC</b> pause</span><span><b>MOUSE</b> look / aim</span>
      </div>
      <div class="t-start">PRESS ENTER TO START</div>
      <div class="t-save"></div>`;
    this.root.appendChild(this.titleEl);

    this.pauseEl = document.createElement('div');
    this.pauseEl.id = 'pause-screen';
    this.pauseEl.innerHTML = `
      <h1>PAUSED</h1>
      <div class="p-row"><span>ESC / ENTER — resume</span><span>R — restart current job</span></div>
      <div class="p-row"><span>S — save and quit to title</span></div>`;
    this.root.appendChild(this.pauseEl);

    this.endEl = document.createElement('div');
    this.endEl.id = 'end-screen';
    this.root.appendChild(this.endEl);

    // Career screen (T): three panels + a mission strip.
    this.careerEl = document.createElement('div');
    this.careerEl.id = 'career-screen';
    this.root.appendChild(this.careerEl);

    // Garage screen (E at the garage): right-side panel, the 3D car
    // shows on the left.
    this.garageEl = document.createElement('div');
    this.garageEl.id = 'garage-screen';
    this.root.appendChild(this.garageEl);
    this._garageMsg = '';
  }

  showTitle() {
    const save = this.game.progression.missionsDone.size > 0 || this.game.progression.cash > 250;
    this.titleEl.querySelector('.t-save').textContent = save
      ? `Save found: ${this.game.progression.missionsDone.size}/8 jobs done, $${this.game.progression.cash.toLocaleString('en-US')} — press ENTER to continue`
      : 'No save yet — a fresh start on the Keys.';
    this.titleEl.classList.add('show');
    this.pauseEl.classList.remove('show');
    this.endEl.classList.remove('show');
  }

  hideTitle() {
    this.titleEl.classList.remove('show');
  }

  showPause() {
    this.pauseEl.classList.add('show');
  }

  hidePause() {
    this.pauseEl.classList.remove('show');
  }

  showEnd(kind, text) {
    this.endEl.innerHTML = `<h1>${kind}</h1><div class="t-sub">${text}</div><div class="t-start">PRESS ENTER TO RESPAWN</div>`;
    this.endEl.classList.add('show');
  }

  hideEnd() {
    this.endEl.classList.remove('show');
  }

  // --- Career screen -------------------------------------------------
  showCareer() {
    const g = this.game;
    const prog = g.progression;
    const c = prog.career;
    const done = prog.missionsDone.size;
    const pct = Math.round((done / 8) * 100);
    const distKm = (c.distanceDriven / 1000).toFixed(1);
    const jumpM = Math.round(c.longestJump);
    const wantedStars = '★'.repeat(c.highestWanted) || '—';
    const nextNeed = prog.nextRankNeed;
    const stat = (label, value) => `<div class="cs-row"><span>${label}</span><b>${value}</b></div>`;

    const slots = [1, 2, 3].map((slot) => {
      const s = prog.slotSummary(slot);
      if (!s) return `<div class="slot empty"><b>SLOT ${slot}</b><span>EMPTY</span></div>`;
      return `<div class="slot"><b>SLOT ${slot} · ${s.rankName}</b><span>${s.missions}/8 JOBS · $${s.cash.toLocaleString('en-US')}</span></div>`;
    }).join('');

    // FIX ROUND 4 — live crew roster in the save panel: the panel had
    // ~170 px of empty space under three slots. Every row is real state
    // (key, name, role, cooldown from the progression system).
    const crew = Object.entries(CREW).map(([id, cr]) => {
      const left = prog.crewCooldownLeft(id);
      const ready = left <= 0;
      return `<div class="cs-row"><span>${cr.key} · ${cr.name} — ${cr.role}</span><b>${ready ? 'READY' : Math.ceil(left) + 's'}</b></div>`;
    }).join('');

    const missions = MISSIONS.map((m) => {
      const isDone = prog.missionsDone.has(m.id);
      return `<div class="ms${isDone ? ' done' : ''}"><b>JOB ${m.id} · ${m.name}</b><span>${m.giver} · $${m.reward.toLocaleString('en-US')}</span><i>${isDone ? 'DONE' : 'OPEN'}</i></div>`;
    }).join('');

    this.careerEl.innerHTML = `
      <div class="career-head"><h1>VERMILION CAREER</h1><span>${prog.rankName} · RESPECT ${prog.respect}${nextNeed ? ' / ' + nextNeed : ''} · $${prog.cash.toLocaleString('en-US')}</span></div>
      <div class="career-panels">
        <div class="career-panel">
          <div class="cp-head">CAREER · ${pct}% COMPLETE</div>
          ${stat('CARS STOLEN', c.carsStolen)}
          ${stat('COPS ESCAPED', c.copsEscaped)}
          ${stat('DISTANCE DRIVEN', distKm + ' km')}
          ${stat('PEOPLE TAKEN OUT', c.peopleTakenOut)}
          ${stat('LONGEST JUMP', jumpM + ' m')}
          ${stat('RACES WON', c.racesWon)}
          ${stat('HIGHEST WANTED', wantedStars)}
          <div class="cs-foot">${done}/8 JOBS DONE — ${done >= 8 ? 'YOU RUN THE KEYS NOW' : 'NEXT JOB: ' + (MISSIONS.find((m) => !prog.missionsDone.has(m.id))?.name || '—')}</div>
        </div>
        <div class="career-panel map-panel">
          <div class="cp-head">CITY MAP · 3 ISLANDS · 8 DISTRICTS</div>
          <canvas id="career-map" width="560" height="300"></canvas>
          <div class="map-legend"><span><i class="lg-gold"></i>SAFEHOUSE</span><span><i class="lg-cyan"></i>GARAGE</span><span><i class="lg-red"></i>HEAT ZONE</span><span><i class="lg-white"></i>YOU</span></div>
        </div>
        <div class="career-panel">
          <div class="cp-head">SAVE SLOTS</div>
          ${slots}
          <div class="cs-foot">Saves are real — progress, cash and career carry across sessions.</div>
          <div class="cp-head" style="margin-top:14px">CREW</div>
          ${crew}
        </div>
      </div>
      <div class="career-strip">${missions}</div>
      <div class="career-close">T / ESC — CLOSE</div>`;
    this.careerEl.classList.add('show');
    this.drawCareerMap();
  }

  hideCareer() {
    this.careerEl.classList.remove('show');
  }

  drawCareerMap() {
    const canvas = document.getElementById('career-map');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const x0 = -460, x1 = 490, z0 = -210, z1 = 210;
    const scale = Math.min(W / (x1 - x0), H / (z1 - z0));
    const ox = (W - (x1 - x0) * scale) / 2 - x0 * scale;
    const oy = (H - (z1 - z0) * scale) / 2 - z0 * scale;
    const toMap = (x, z) => [ox + x * scale, oy + z * scale];
    const g = this.game;
    const p = g.player;
    const px = p.inCar ? p.inCar.pos.x : p.pos.x;
    const pz = p.inCar ? p.inCar.pos.z : p.pos.z;

    // Water.
    ctx.fillStyle = '#0e5a6a';
    ctx.fillRect(0, 0, W, H);
    // Islands.
    for (const isl of ISLANDS) {
      const [ax, ay] = toMap(isl.x0, isl.z0);
      const [bx, by] = toMap(isl.x1, isl.z1);
      ctx.fillStyle = isl.name === 'boardwalk' ? '#c8a878' : '#a89880';
      ctx.fillRect(ax, ay, bx - ax, by - ay);
    }
    // Roads.
    ctx.strokeStyle = '#2e2e38';
    ctx.lineWidth = 2;
    for (const e of GRAPH.edges) {
      const [ax, ay] = toMap(e.ax, e.az);
      const [bx, by] = toMap(e.bx, e.bz);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
    // District labels.
    ctx.fillStyle = 'rgba(255, 233, 201, 0.85)';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    for (const d of DISTRICT_LABELS) {
      const [x, y] = toMap(d.x, d.z);
      ctx.fillText(d.name, x, y);
    }
    // Heat zone (wanted search circle) + escape route to the safehouse.
    if (g.police.stars > 0) {
      const [x, y] = toMap(px, pz);
      ctx.beginPath();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#ff4030';
      ctx.lineWidth = 2;
      ctx.arc(x, y, 120 * scale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const [sx, sy] = toMap(60, 138);
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.moveTo(x, y);
      ctx.lineTo(sx, sy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // Markers: safehouse, garage, hospital, marina, port, race start.
    // FIX ROUND 4: the label offset is per-marker — GARAGE sits 7 px
    // from SAFEHOUSE on the map, so its label goes BELOW its dot while
    // SAFEHOUSE labels above; the old single offset stacked the two
    // labels on top of each other.
    const marker = (x, z, color, label, labelDy = -9) => {
      const [mx, my] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.fillText(label, mx, my + labelDy);
    };
    marker(60, 138, '#ffc27a', 'SAFEHOUSE', -9);
    marker(52, 128, '#38bdf8', 'GARAGE', 17);
    marker(-280, 128, '#ffffff', 'HOSPITAL');
    marker(60, -128, '#9fd8dd', 'MARINA');
    marker(380, -150, '#9fd8dd', 'PORT');
    marker(-70, 0, '#7ddb8a', 'RACE');
    // Next mission target.
    const target = g.missions.stageTarget;
    if (target) {
      const [x, y] = toMap(target.x, target.z);
      ctx.fillStyle = '#ffc27a';
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-6, -6, 12, 12);
      ctx.restore();
    }
    // Player arrow.
    const [x, y] = toMap(px, pz);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.inCar ? p.inCar.heading : p.heading);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(6, 7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // --- Garage screen -------------------------------------------------
  showGarage() {
    this._garageMsg = '';
    this.refreshGarage();
    this.garageEl.classList.add('show');
  }

  hideGarage() {
    this.garageEl.classList.remove('show');
  }

  refreshGarage() {
    const g = this.game;
    const prog = g.progression;
    const car = prog.garageCar();
    if (!car) return;
    const next = MISSIONS.find((m) => !prog.missionsDone.has(m.id));
    const colorHex = '#' + car.color.toString(16).padStart(6, '0');
    // Stat bars: ratio against the tuned maximum for the class.
    const topPct = Math.round((car.topSpeed() / (car.def.topSpeed * 1.24)) * 100);
    const hpPct = Math.round((car.maxHp() / (car.def.hp * 1.75)) * 100);
    const gripPct = Math.round((car.grip() / (car.def.grip * 1.3)) * 100);
    const bar = (label, pct, val) => `<div class="gb-row"><span>${label}</span><div class="gb-bar"><i style="width:${pct}%"></i></div><b>${val}</b></div>`;
    const rows = UPGRADES.map((u, i) => {
      const lvl = prog.upgradeLevel(u.id);
      const maxed = u.max <= 3 && lvl >= u.max;
      const afford = prog.cash >= u.price;
      const pips = u.max <= 3 ? '●'.repeat(lvl) + '○'.repeat(u.max - lvl) : '';
      return `<div class="up${maxed ? ' maxed' : afford ? '' : ' poor'}"><b>${i + 1}</b><div class="up-body"><span>${u.name} ${pips}</span><i>${u.desc}</i></div><b class="up-price">$${u.price.toLocaleString('en-US')}</b></div>`;
    }).join('');

    this.garageEl.innerHTML = `
      <div class="garage-panel">
        <div class="gp-head">VERMILION MOTOR WORKS</div>
        <div class="gp-car"><span class="gp-swatch" style="background:${colorHex}"></span><b>${car.def.name.toUpperCase()}</b><span>CONDITION ${Math.round((car.hp / car.maxHp()) * 100)}%</span></div>
        ${bar('TOP SPEED', topPct, Math.round(car.topSpeed() * 3.6) + ' km/h')}
        ${bar('CONDITION', hpPct, car.maxHp() + ' HP')}
        ${bar('GRIP', gripPct, car.grip().toFixed(2))}
        <div class="gp-cash">CASH <b>$${prog.cash.toLocaleString('en-US')}</b></div>
        ${rows}
        <div class="gp-next">NEXT: ${next ? 'JOB ' + next.id + ' · ' + next.name + ' — $' + next.reward.toLocaleString('en-US') : 'ALL JOBS DONE — KINGPIN'}</div>
        <div class="gp-note">RESPRAY — NEW PAINT CLEARS UNSEEN HEAT</div>
        ${this._garageMsg ? `<div class="gp-msg">${this._garageMsg}</div>` : ''}
        <div class="gp-keys">1–5 BUY · ESC CLOSE</div>
      </div>`;
  }

  // Buy from the garage screen (keys 1–5); refreshes the panel so the
  // cash, levels and stat bars update from the real purchase.
  garageBuy(index) {
    const u = UPGRADES[index];
    if (!u) return;
    const res = this.game.progression.buyUpgrade(u.id);
    this._garageMsg = res.why;
    this.refreshGarage();
  }
}
