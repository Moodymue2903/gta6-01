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
// FIX ROUND 5 — the career and garage screens are rendered by
// pauseMenu.js / garageMenu.js from the shared view-model (the same
// numbers the HUD shows), so the pause menu and the HUD can never
// disagree. The title drops the Q weapon-wheel control (there is no
// wheel any more — weapons switch on keys 1-4 directly), and the save
// line reads V$ like every other cash figure in the game.

import { buildViewModel } from './viewModel.js';
import { renderCareer, renderPause } from './pauseMenu.js';
import { renderGarage, garageBuy as buyFromGarage } from './garageMenu.js';

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
        <span><b>E</b> enter / steal car</span><span><b>F</b> carjack</span>
        <span><b>1–4</b> weapons</span><span><b>R</b> reload</span><span><b>Z X C</b> crew perks</span>
        <span><b>M</b> radio</span><span><b>T</b> career</span><span><b>ESC</b> pause</span><span><b>MOUSE</b> look / aim</span>
      </div>
      <div class="t-start">PRESS ENTER TO START</div>
      <div class="t-save"></div>`;
    this.root.appendChild(this.titleEl);

    this.pauseEl = document.createElement('div');
    this.pauseEl.id = 'pause-screen';
    this.root.appendChild(this.pauseEl);

    this.endEl = document.createElement('div');
    this.endEl.id = 'end-screen';
    this.root.appendChild(this.endEl);

    // Career screen (T): the pause menu over the live render — rendered
    // by pauseMenu.js from the view-model when it opens.
    this.careerEl = document.createElement('div');
    this.careerEl.id = 'career-screen';
    this.root.appendChild(this.careerEl);

    // Garage screen (E at the garage): right-side panel, the 3D car
    // shows on the left — rendered by garageMenu.js when it opens.
    this.garageEl = document.createElement('div');
    this.garageEl.id = 'garage-screen';
    this.root.appendChild(this.garageEl);
    this._garageMsg = '';
  }

  showTitle() {
    const save = this.game.progression.missionsDone.size > 0 || this.game.progression.cash > 250;
    this.titleEl.querySelector('.t-save').textContent = save
      ? `Save found: ${this.game.progression.missionsDone.size}/8 jobs done, V$${this.game.progression.cash.toLocaleString('en-US')} — press ENTER to continue`
      : 'No save yet — a fresh start on the Keys.';
    this.titleEl.classList.add('show');
    this.pauseEl.classList.remove('show');
    this.endEl.classList.remove('show');
  }

  hideTitle() {
    this.titleEl.classList.remove('show');
  }

  showPause() {
    renderPause(this.game, this.pauseEl);
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
  // Rendered fresh from the view-model every time it opens, so the
  // ring, the rank, the nine activity bars and the save slots always
  // match the live game state (and the HUD showing behind it).
  // The career screen covers the whole viewport, so the HUD is hidden
  // while it is open — otherwise the mission card, roster, minimap and
  // cash box bleed through the warm glass and collide with the career
  // text. The aerial render still shows through behind the glass.
  showCareer() {
    renderCareer(this.game, this.careerEl, buildViewModel(this.game));
    this.careerEl.classList.add('show');
    this.game.hud.root.style.display = 'none';
  }

  hideCareer() {
    this.careerEl.classList.remove('show');
    this.game.hud.root.style.display = '';
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
    renderGarage(this.game, this.garageEl, this._garageMsg);
  }

  // Buy from the garage screen (keys 1–5); refreshes the panel so the
  // cash, levels and stat bars update from the real purchase.
  garageBuy(index) {
    this._garageMsg = buyFromGarage(this.game, index);
    this.refreshGarage();
  }
}
