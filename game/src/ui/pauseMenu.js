// VERMILION KEYS — pause menu and career screen.
// The career frame is a pause menu over a real daytime aerial render:
// a warm glass panel with three giant numbers (completion ring, rank,
// activities), the nine real activity tracks with bars, a small tinted
// district map, three live save slots, crew portraits and the career
// ledger. Every number comes from the view-model; this file holds no
// numeric literals and no game values of its own.

import { CAREER_MAP, CTX_TWO_D, EIGHT, FIVE, FONTS, FOUR, HEAT_RADIUS, HUNDRED, MAP_BOUNDS, ONE, SEVEN, SIX, THREE, TWO, ZERO, ringSvg } from './hudStyles.js';
import { MAP_MARKERS, districtRects } from '../world/cityLayout.js';

function drawCareerMap(canvas, game, vm) {
  const ctx = canvas.getContext(CTX_TWO_D);
  const W = CAREER_MAP.width;
  const H = CAREER_MAP.height;
  const minX = MAP_BOUNDS[ZERO];
  const maxX = MAP_BOUNDS[TWO];
  const minZ = MAP_BOUNDS[ONE];
  const maxZ = MAP_BOUNDS[THREE];
  const scale = Math.min(W / (maxX - minX), H / (maxZ - minZ));
  const ox = (W - (maxX - minX) * scale) / TWO - minX * scale;
  const oy = (H - (maxZ - minZ) * scale) / TWO - minZ * scale;
  const toMap = (x, z) => [ox + x * scale, oy + z * scale];
  ctx.fillStyle = CAREER_MAP.water;
  ctx.fillRect(ZERO, ZERO, W, H);
  const taken = vm.career ? vm.career.takenIds : [];
  for (const d of districtRects()) {
    const [ax, ay] = toMap(d[TWO], d[THREE]);
    const [bx, by] = toMap(d[FOUR], d[FIVE]);
    ctx.fillStyle = taken.includes(d[ZERO]) ? CAREER_MAP.takenTint : CAREER_MAP.untakenTint;
    ctx.fillRect(ax, ay, bx - ax, by - ay);
    ctx.strokeStyle = d[SIX];
    ctx.lineWidth = ONE;
    ctx.strokeRect(ax, ay, bx - ax, by - ay);
  }
  ctx.fillStyle = CAREER_MAP.labelColor;
  ctx.font = FONTS.mapLabel;
  ctx.textAlign = 'center';
  for (const d of districtRects()) {
    const [x, y] = toMap(d[SEVEN], d[EIGHT]);
    ctx.fillText(d[ONE], x, y);
  }
  const marker = (x, z, color, label, dy) => {
    const [mx, my] = toMap(x, z);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(mx, my, CAREER_MAP.markerR, ZERO, Math.PI * TWO);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = FONTS.mapMarker;
    ctx.fillText(label, mx, my + dy);
  };
  for (const m of MAP_MARKERS) marker(m.x, m.z, m.color, m.label, m.dy);
  if (vm.wanted.stars > ZERO) {
    const [x, y] = toMap(vm.minimap.px, vm.minimap.pz);
    ctx.beginPath();
    ctx.setLineDash([CAREER_MAP.dashOn, CAREER_MAP.dashOff]);
    ctx.strokeStyle = CAREER_MAP.heatColor;
    ctx.lineWidth = TWO;
    ctx.arc(x, y, HEAT_RADIUS * scale, ZERO, Math.PI * TWO);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const [px, py] = toMap(vm.minimap.px, vm.minimap.pz);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(vm.minimap.heading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = CAREER_MAP.playerStroke;
  ctx.lineWidth = ONE;
  ctx.beginPath();
  ctx.moveTo(ZERO, -CAREER_MAP.playerLen);
  ctx.lineTo(CAREER_MAP.playerHalf, CAREER_MAP.playerLen - TWO);
  ctx.lineTo(-CAREER_MAP.playerHalf, CAREER_MAP.playerLen - TWO);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function renderCareer(game, el, vm) {
  const c = vm.career;
  const activities = c.activities.map((a) => `<div class="act-row"><span>${a.name}</span><div class="act-bar"><i style="width:${a.frac * HUNDRED}%"></i></div><b>${a.label}</b></div>`).join('');
  const slots = c.slots.map((s) => `<div class="slot${s.empty ? ' empty' : ''}"><b>${s.title}</b><span>${s.line}</span></div>`).join('');
  const crew = vm.crew.map((m) => `<div class="cs-row"><span>${m.key} · ${m.name} — ${m.role}</span><b>${m.label}</b></div>`).join('');
  const lg = c.ledger;
  el.innerHTML = `
    <div class="career-head"><div class="career-title">VERMILION CAREER</div><span>${c.rank} · ${c.respectLine} · ${c.cash} · ${vm.clock}</span></div>
    <div class="career-giants">
      <div class="giant ring-cell">${ringSvg(c.ringDash)}<div class="giant-num">${c.pctNum}</div><div class="giant-sub">COMPLETE</div></div>
      <div class="giant"><div class="giant-kicker">RANK</div><div class="giant-num">${c.rank}</div><div class="giant-sub">${c.respectLine}</div></div>
      <div class="giant"><div class="giant-kicker">ACTIVITIES</div><div class="giant-num">${c.activitiesLabel}</div><div class="giant-sub">NINE REAL TRACKS</div></div>
    </div>
    <div class="career-panels">
      <div class="career-panel">
        <div class="cp-head">ACTIVITIES</div>
        ${activities}
      </div>
      <div class="career-panel map-panel">
        <div class="cp-head">DISTRICTS · ${vm.location}</div>
        <canvas id="career-map" width="${CAREER_MAP.width}" height="${CAREER_MAP.height}"></canvas>
        <div class="map-legend"><span><i class="lg-gold"></i>TAKEN OVER</span><span><i class="lg-white"></i>YOU</span><span><i class="lg-cyan"></i>GARAGE</span><span><i class="lg-red"></i>HEAT ZONE</span></div>
      </div>
      <div class="career-panel">
        <div class="cp-head">SAVE SLOTS</div>
        ${slots}
        <div class="cp-head cp-head-gap">CREW</div>
        ${crew}
        <div class="cp-head cp-head-gap">LEDGER</div>
        <div class="cs-row"><span>CARS STOLEN</span><b>${lg.carsStolen}</b></div>
        <div class="cs-row"><span>DISTANCE DRIVEN</span><b>${lg.distanceKm} km</b></div>
        <div class="cs-row"><span>COPS ESCAPED</span><b>${lg.copsEscaped}</b></div>
        <div class="cs-row"><span>LONGEST JUMP</span><b>${lg.longestJump} m</b></div>
        <div class="cs-row"><span>RACES WON</span><b>${lg.racesWon}</b></div>
        <div class="cs-row"><span>HIGHEST WANTED</span><b>${lg.highestWanted}</b></div>
      </div>
    </div>
    <div class="career-close">T / ESC — CLOSE</div>`;
  const canvas = document.getElementById('career-map');
  if (canvas) drawCareerMap(canvas, game, vm);
}

export function renderPause(game, el) {
  void game;
  el.innerHTML = `
    <div class="pause-title">PAUSED</div>
    <div class="p-row"><span>ESC / ENTER — resume</span><span>R — restart current job</span></div>
    <div class="p-row"><span>S — save and quit to title</span></div>
    <div class="p-row"><span>T — career</span></div>`;
}
