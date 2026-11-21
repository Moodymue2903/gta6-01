// VERMILION KEYS — menus: title, pause, death, busted.
// Overlays are plain DOM; the game loop keeps rendering behind them.

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
        <span><b>M</b> radio</span><span><b>ESC</b> pause</span><span><b>MOUSE</b> look / aim</span>
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
}
