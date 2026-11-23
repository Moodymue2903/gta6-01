// VERMILION KEYS — weapon wheel (FIX ROUND 7).
// A radial weapon picker: hold Q to open, point the mouse (or press
// 1-4) to highlight a slot, release Q to equip. While the wheel is open
// the game runs at 0.35x so the player can pick under fire without the
// world running away — the game loop reads game.timeScale (coordinator
// wires that one line in boot.js; if it is not wired the wheel still
// opens and equips, just at full speed). Every slot is read from the
// live Combat state — WEAPONS / combat.weapon / combat.ammo /
// combat.inMag — never typed numbers, so the wheel can never disagree
// with the HUD chip. The wheel owns its own radial DOM inside #hud.
//
// COORDINATOR NOTE: combat.update must skip firing while the wheel is
// open (one-line gate: `if (this.game.weaponWheel?.open) skip the
// fire branch`). The wheel also reads keys 1-4 while open; combat's
// own Digit1-4 handling equips immediately, which is harmless — the
// wheel highlight simply follows the equipped slot — but if the
// coordinator prefers highlight-only selection it can gate those too.

import { WEAPONS } from './combat.js';

const OPEN_KEY = 'KeyQ';
const SLOT_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4'];
// Slot angles around the radial (degrees, 0 = up, clockwise): Fists
// top, VESPER right, MAKO bottom, BREAKER left — a cross the eye reads
// at a glance in a small cell.
const SLOT_ANGLES = [-90, 0, 90, 180];

function fmtAmmo(w, inMag, reserve) {
  if (w.mag === Infinity) return '∞';
  return inMag + ' / ' + reserve;
}

export class WeaponWheel {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.selected = game.combat ? game.combat.weapon : 0;
    this._mouseX = null;
    this._mouseY = null;
    this._wasOpen = false;
    // Own cursor tracking: input.js only tracks the mouse while a
    // button is held, and the wheel selects by hovering, so it listens
    // for itself.
    this._onMove = (e) => {
      this._mouseX = e.clientX;
      this._mouseY = e.clientY;
    };
    window.addEventListener('mousemove', this._onMove);
    this._buildDom();
  }

  _buildDom() {
    const hud = document.getElementById('hud');
    this.root = document.createElement('div');
    this.root.id = 'weapon-wheel';
    // Inline styles: the wheel owns its DOM and no shared stylesheet
    // is edited in this round.
    Object.assign(this.root.style, {
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: '340px',
      height: '340px',
      transform: 'translate(-50%, -50%)',
      display: 'none',
      pointerEvents: 'none',
      zIndex: '30',
      fontFamily: "'Arial Narrow', Arial, sans-serif",
    });
    this.root.innerHTML =
      '<div style="position:absolute;left:50%;top:50%;width:136px;height:136px;transform:translate(-50%,-50%);border-radius:50%;background:rgba(11,17,32,0.88);border:2px solid #fbbf24;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#f5d9a0;">' +
      '<span style="font-size:11px;letter-spacing:2px;color:#14a0b8;">WEAPON</span>' +
      '<span class="ww-center-name" style="font-size:20px;font-weight:bold;letter-spacing:1px;"></span>' +
      '<span class="ww-center-ammo" style="font-size:14px;color:#fff;"></span>' +
      '<span style="font-size:9px;letter-spacing:0.5px;color:#aaa;white-space:nowrap;">RELEASE Q<br>TO EQUIP</span></div>';
    this._slotEls = WEAPONS.map((w, i) => {
      const a = (SLOT_ANGLES[i] * Math.PI) / 180;
      const r = 128;
      const el = document.createElement('div');
      el.className = 'ww-slot';
      Object.assign(el.style, {
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '108px',
        height: '64px',
        marginLeft: '-54px',
        marginTop: '-32px',
        transform: `translate(${Math.cos(a) * r}px, ${Math.sin(a) * r}px)`,
        background: 'rgba(11,17,32,0.88)',
        border: '2px solid rgba(255,255,255,0.25)',
        borderRadius: '8px',
        color: '#fff',
        textAlign: 'center',
        paddingTop: '7px',
        boxSizing: 'border-box',
      });
      el.innerHTML =
        `<div style="font-size:10px;color:#fbbf24;letter-spacing:1px;">[${i + 1}] ${w.id === 'fists' ? 'MELEE' : 'GUN'}</div>` +
        `<div class="ww-name" style="font-size:17px;font-weight:bold;letter-spacing:1px;">${w.name}</div>` +
        `<div class="ww-ammo" style="font-size:13px;color:#7ddb8a;"></div>`;
      this.root.appendChild(el);
      return el;
    });
    hud.appendChild(this.root);
  }

  // Slots from the live Combat state — the single source of truth.
  slots() {
    const c = this.game.combat;
    return WEAPONS.map((w, i) => ({
      id: w.id,
      name: w.name,
      ammo: w.mag === Infinity ? Infinity : c.ammo[i],
      inMag: w.mag === Infinity ? Infinity : c.inMag[i],
      ammoLabel: fmtAmmo(w, c.inMag[i], c.ammo[i]),
      equipped: c.weapon === i,
      selected: this.selected === i,
    }));
  }

  openForShot() {
    // Screenshot staging: force the wheel open on the equipped weapon.
    this.selected = this.game.combat.weapon;
    this._setOpen(true);
    this._render();
  }

  closeForShot() {
    this._setOpen(false);
  }

  _setOpen(v) {
    if (this.open === v) return;
    this.open = v;
    this.root.style.display = v ? 'block' : 'none';
    // Slow-mo while open; the game loop applies game.timeScale to dt.
    this.game.timeScale = v ? 0.35 : 1;
    if (v) this.game.audio?.blip('switch');
  }

  _render() {
    const list = this.slots();
    list.forEach((s, i) => {
      const el = this._slotEls[i];
      el.querySelector('.ww-ammo').textContent = s.ammoLabel;
      const isSel = s.selected;
      const isEq = s.equipped;
      el.style.borderColor = isSel ? '#fbbf24' : isEq ? '#14a0b8' : 'rgba(255,255,255,0.25)';
      el.style.background = isSel ? 'rgba(60,40,8,0.95)' : 'rgba(11,17,32,0.88)';
      el.style.boxShadow = isSel ? '0 0 18px rgba(251,191,36,0.55)' : 'none';
    });
    const cur = list[this.selected];
    this.root.querySelector('.ww-center-name').textContent = cur.name;
    this.root.querySelector('.ww-center-ammo').textContent = cur.ammoLabel;
  }

  _pickFromMouse() {
    if (this._mouseX === null) return;
    const rect = this.root.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = this._mouseX - cx;
    const dy = this._mouseY - cy;
    if (Math.hypot(dx, dy) < 55) return; // dead zone over the centre
    const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    // Nearest slot angle wins.
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < SLOT_ANGLES.length; i++) {
      let d = Math.abs(deg - SLOT_ANGLES[i]);
      if (d > 180) d = 360 - d;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    this.selected = best;
  }

  update(dt, input) {
    const held = !!(input.keys && input.keys[OPEN_KEY]);
    if (held && !this.open) {
      // Opening snaps the highlight to the equipped weapon.
      this.selected = this.game.combat.weapon;
      this._setOpen(true);
    }
    if (this.open) {
      // Keys 1-4 highlight while open; the mouse hovers a slot.
      for (let i = 0; i < SLOT_KEYS.length; i++) {
        if (input.pressed(SLOT_KEYS[i])) this.selected = i;
      }
      this._pickFromMouse();
      this._render();
      if (!held) {
        // Release Q: equip the highlighted weapon.
        this.game.combat.select(this.selected);
        this._setOpen(false);
      }
    }
    this._wasOpen = this.open;
  }

  destroy() {
    window.removeEventListener('mousemove', this._onMove);
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
  }
}
