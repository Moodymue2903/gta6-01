// VERMILION KEYS — career dashboard v3 (Fix Round 8).
// One dark panel: a large conic ring at the live completion %,
// the live rank, the live activities count, the real activity
// progress rows, and three stat tiles. Everything comes from the
// view-model (vm.career) — no numbers are typed here. Dropped vs
// the round-7 career screen: the district grid, the save-slot
// column, and the trophies tile (no trophy system exists). At
// 256 px wide only the ring, the % and the rank stay legible, so
// those three are huge.

import { careerGroups } from './careerActivities.js';

const ZERO = 0;

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CAREER3_CSS = `
#cv3-panel { width: min(860px, 92vw); margin: 0 auto; background: rgba(10, 14, 26, .92);
  border: 1.5px solid rgba(255, 194, 122, .55); border-radius: 10px; padding: 22px 26px;
  color: #fff; font-family: 'Segoe UI', Arial, sans-serif; text-align: left; }
#cv3-panel .cv3-head { font-size: 15px; font-weight: 800; letter-spacing: 3px; color: #fbbf24; }
#cv3-panel .cv3-act { font-size: 13px; color: #9fd8dd; letter-spacing: 1px; margin-top: 2px; }
#cv3-panel .cv3-giants { display: flex; gap: 28px; align-items: center; margin: 16px 0 10px; }
#cv3-panel .cv3-ring { width: 168px; height: 168px; border-radius: 50%; flex: none;
  display: flex; flex-direction: column; align-items: center; justify-content: center; }
#cv3-panel .cv3-ring-in { width: 138px; height: 138px; border-radius: 50%;
  background: rgba(10, 14, 26, .96); display: flex; flex-direction: column;
  align-items: center; justify-content: center; }
#cv3-panel .cv3-pct { font-size: 44px; font-weight: 800; line-height: 1; }
#cv3-panel .cv3-pct-sub { font-size: 12px; letter-spacing: 2px; color: #9fd8dd; font-weight: 700; margin-top: 4px; }
#cv3-panel .cv3-rank-kicker { font-size: 13px; letter-spacing: 3px; color: #9fd8dd; font-weight: 700; }
#cv3-panel .cv3-rank { font-size: 52px; font-weight: 800; line-height: 1.05; }
#cv3-panel .cv3-acts { font-size: 26px; font-weight: 800; line-height: 1.1; margin-top: 10px; }
#cv3-panel .cv3-acts-sub { font-size: 12px; letter-spacing: 2px; color: #9fd8dd; font-weight: 700; }
#cv3-panel .cv3-rows { margin-top: 8px; }
#cv3-panel .cv3-group { font-size: 12px; font-weight: 800; letter-spacing: 2px; color: #fbbf24; margin: 10px 0 4px; }
#cv3-panel .cv3-row { display: flex; gap: 10px; align-items: center; font-size: 14px; margin: 3px 0; }
#cv3-panel .cv3-row span { width: 170px; flex: none; }
#cv3-panel .cv3-bar { flex: 1; height: 8px; background: #3a2a1a; border-radius: 4px; overflow: hidden; }
#cv3-panel .cv3-bar i { display: block; height: 100%; background: #fbbf24; }
#cv3-panel .cv3-row b { width: 74px; text-align: right; flex: none; }
#cv3-panel .cv3-tiles { display: flex; gap: 12px; margin-top: 16px; }
#cv3-panel .cv3-tile { flex: 1; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14);
  border-radius: 8px; padding: 10px 14px; text-align: center; }
#cv3-panel .cv3-tile-k { font-size: 11px; letter-spacing: 2px; color: #9fd8dd; font-weight: 700; }
#cv3-panel .cv3-tile-v { font-size: 24px; font-weight: 800; margin-top: 2px; }
#cv3-panel .cv3-close { margin-top: 14px; font-size: 12px; letter-spacing: 2px; color: #c8d0dc; text-align: center; }
`;

export function renderCareerV3(game, el, vm) {
  const c = vm.career;
  if (!c) return;
  if (!document.getElementById('career3-style')) {
    const style = document.createElement('style');
    style.id = 'career3-style';
    style.textContent = CAREER3_CSS;
    document.head.appendChild(style);
  }
  const { groups, actTitle } = careerGroups(game, vm);
  const rows = groups.map((g) => `<div class="cv3-group">${esc(g.title)}</div>` + g.rows.map((a) => `<div class="cv3-row"><span>${esc(a.name)}</span><div class="cv3-bar"><i style="width:${Math.round(a.frac * 100)}%"></i></div><b>${esc(a.label)}</b></div>`).join('')).join('');
  const jobsRow = c.activities.find((a) => a.id === 'jobs');
  const deg = Math.round(c.pct * 3.6);
  const ring = `conic-gradient(#fbbf24 ${deg}deg, rgba(255,255,255,0.15) 0deg)`;
  el.innerHTML = `
    <div id="cv3-panel">
      <div class="cv3-head">VERMILION CAREER</div>
      <div class="cv3-act">${esc(actTitle)} · ${esc(c.rank)} · ${esc(c.respectLine)} · ${esc(c.cash)} · ${esc(vm.clock)}</div>
      <div class="cv3-giants">
        <div class="cv3-ring" style="background:${ring}"><div class="cv3-ring-in"><div class="cv3-pct">${esc(c.pctNum)}</div><div class="cv3-pct-sub">COMPLETE</div></div></div>
        <div>
          <div class="cv3-rank-kicker">RANK</div>
          <div class="cv3-rank">${esc(c.rank)}</div>
          <div class="cv3-acts">${esc(c.activitiesLabel)} ✓</div>
          <div class="cv3-acts-sub">NINE REAL TRACKS</div>
        </div>
      </div>
      <div class="cv3-rows">${rows}</div>
      <div class="cv3-tiles">
        <div class="cv3-tile"><div class="cv3-tile-k">RESPECT</div><div class="cv3-tile-v">${esc(c.respectLine.replace('RESPECT ', ''))}</div></div>
        <div class="cv3-tile"><div class="cv3-tile-k">CASH</div><div class="cv3-tile-v">${esc(c.cash)}</div></div>
        <div class="cv3-tile"><div class="cv3-tile-k">JOBS</div><div class="cv3-tile-v">${esc(jobsRow ? jobsRow.label : '')}</div></div>
      </div>
      <div class="cv3-close">T / ESC — CLOSE</div>
    </div>`;
}
